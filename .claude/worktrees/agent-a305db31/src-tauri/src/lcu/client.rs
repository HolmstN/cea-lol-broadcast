use super::LcuCredentials;
use base64::{engine::general_purpose::STANDARD, Engine};
use futures_util::{SinkExt, StreamExt};
use serde_json::Value;
use tauri::{AppHandle, Emitter};
use tokio_tungstenite::{
    connect_async_tls_with_config,
    tungstenite::{
        handshake::client::generate_key,
        http::{header, Request},
        Message,
    },
    Connector,
};

pub struct LcuClient {
    app: AppHandle,
}

impl LcuClient {
    pub fn new(app: AppHandle) -> Self {
        Self { app }
    }

    /// Connect to the LCU WebSocket and begin forwarding events to the frontend.
    /// Spawns a background task — returns immediately after the handshake succeeds.
    pub async fn connect(&self, creds: LcuCredentials) -> anyhow::Result<()> {
        let url = format!("wss://127.0.0.1:{}/", creds.port);
        let auth = STANDARD.encode(format!("riot:{}", creds.password));

        let request = Request::builder()
            .uri(&url)
            .header(header::AUTHORIZATION, format!("Basic {auth}"))
            .header(header::HOST, format!("127.0.0.1:{}", creds.port))
            .header(header::CONNECTION, "Upgrade")
            .header(header::UPGRADE, "websocket")
            .header(header::SEC_WEBSOCKET_VERSION, "13")
            .header(header::SEC_WEBSOCKET_KEY, generate_key())
            .body(())?;

        // LCU uses a self-signed certificate — we must disable verification.
        let tls = native_tls::TlsConnector::builder()
            .danger_accept_invalid_certs(true)
            .build()?;

        let (mut ws, _) =
            connect_async_tls_with_config(request, None, false, Some(Connector::NativeTls(tls)))
                .await?;

        // Subscribe to all JSON API events.
        ws.send(Message::Text(
            serde_json::to_string(&serde_json::json!([5, "OnJsonApiEvent"]))?.into(),
        ))
        .await?;

        let app = self.app.clone();

        tokio::spawn(async move {
            while let Some(result) = ws.next().await {
                match result {
                    Ok(Message::Text(text)) => {
                        // LCU event format: [8, "OnJsonApiEvent", { eventType, uri, data }]
                        if let Ok(Value::Array(arr)) = serde_json::from_str::<Value>(&text) {
                            if arr.len() == 3 {
                                let _ = app.emit("lcu-event", &arr[2]);
                            }
                        }
                    }
                    Ok(Message::Close(_)) => {
                        let _ = app.emit("lcu-disconnected", ());
                        break;
                    }
                    Err(e) => {
                        eprintln!("[LCU] WebSocket error: {e}");
                        let _ = app.emit("lcu-disconnected", ());
                        break;
                    }
                    _ => {}
                }
            }
        });

        Ok(())
    }
}
