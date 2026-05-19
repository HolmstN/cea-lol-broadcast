use futures_util::{SinkExt, StreamExt};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::net::TcpListener;
use tokio::sync::{broadcast, Mutex};
use tokio_tungstenite::tungstenite::Message;

#[derive(Clone, serde::Serialize, serde::Deserialize, Default)]
pub struct SceneState {
    pub scene: String,
    pub params: HashMap<String, String>,
}

pub struct OverlayServer {
    pub state: Arc<Mutex<SceneState>>,
    pub tx: broadcast::Sender<String>,
}

impl OverlayServer {
    pub fn new() -> Arc<Self> {
        let (tx, _) = broadcast::channel(32);
        Arc::new(Self {
            state: Arc::new(Mutex::new(SceneState::default())),
            tx,
        })
    }

    pub fn start(self: Arc<Self>) {
        tauri::async_runtime::spawn(async move {
            let listener = match TcpListener::bind("127.0.0.1:7233").await {
                Ok(l) => l,
                Err(e) => {
                    eprintln!("[Overlay] Failed to bind on port 7233: {e}");
                    return;
                }
            };
            eprintln!("[Overlay] WebSocket server listening on ws://127.0.0.1:7233");
            loop {
                let (stream, _) = match listener.accept().await {
                    Ok(s) => s,
                    Err(e) => {
                        eprintln!("[Overlay] accept error: {e}");
                        continue;
                    }
                };
                let server = self.clone();
                tauri::async_runtime::spawn(async move { server.handle(stream).await });
            }
        });
    }

    async fn handle(self: Arc<Self>, stream: tokio::net::TcpStream) {
        let ws = match tokio_tungstenite::accept_async(stream).await {
            Ok(ws) => ws,
            Err(e) => {
                eprintln!("[Overlay] WS handshake error: {e}");
                return;
            }
        };
        let (mut sink, mut src) = ws.split();

        // Immediately send current scene state to the new client.
        let current = {
            let s = self.state.lock().await;
            serde_json::to_string(&*s).unwrap_or_default()
        };
        if !current.is_empty() {
            let _ = sink.send(Message::Text(current.into())).await;
        }

        let mut rx = self.tx.subscribe();

        loop {
            tokio::select! {
                msg = rx.recv() => {
                    match msg {
                        Ok(text) => {
                            if sink.send(Message::Text(text.into())).await.is_err() {
                                break;
                            }
                        }
                        Err(_) => break,
                    }
                }
                msg = src.next() => {
                    match msg {
                        Some(Ok(Message::Close(_))) | None => break,
                        _ => {}
                    }
                }
            }
        }
    }

    pub async fn set_scene(&self, scene: String, params: HashMap<String, String>) {
        let state = SceneState { scene, params };
        let json = serde_json::to_string(&state).unwrap_or_default();
        *self.state.lock().await = state;
        let _ = self.tx.send(json);
    }

    pub async fn get_state(&self) -> SceneState {
        self.state.lock().await.clone()
    }
}

pub fn start_file_server(overlays_path: PathBuf) {
    tauri::async_runtime::spawn(async move {
        let listener = match TcpListener::bind("127.0.0.1:7234").await {
            Ok(l) => l,
            Err(e) => {
                eprintln!("[FileServer] Failed to bind on port 7234: {e}");
                return;
            }
        };
        eprintln!("[FileServer] Serving overlays at http://127.0.0.1:7234/");
        loop {
            let (stream, _) = match listener.accept().await {
                Ok(s) => s,
                Err(_) => continue,
            };
            let path = overlays_path.clone();
            tauri::async_runtime::spawn(async move { handle_http(stream, path).await });
        }
    });
}

async fn handle_http(stream: tokio::net::TcpStream, base: PathBuf) {
    use tokio::io::{AsyncBufReadExt, AsyncWriteExt};

    let (reader, mut writer) = stream.into_split();
    let mut reader = tokio::io::BufReader::new(reader);

    let mut request_line = String::new();
    if reader.read_line(&mut request_line).await.is_err() {
        return;
    }

    // Drain remaining request headers
    loop {
        let mut line = String::new();
        if reader.read_line(&mut line).await.is_err() {
            break;
        }
        if line == "\r\n" || line.trim().is_empty() {
            break;
        }
    }

    let parts: Vec<&str> = request_line.split_whitespace().collect();
    let raw_path = parts.get(1).copied().unwrap_or("/");
    let stripped = raw_path.split('?').next().unwrap_or("/").trim_start_matches('/');
    let rel = if stripped.is_empty() { "overlay-live.html" } else { stripped };

    // Block directory traversal; allow single subdirectory (e.g. icons/)
    if rel.contains("..") || rel.contains('\\') || rel.starts_with('/') {
        let _ = writer.write_all(b"HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\n\r\n").await;
        return;
    }

    let target = base.join(rel);
    let ct = if rel.ends_with(".html") { "text/html; charset=utf-8" }
             else if rel.ends_with(".png")  { "image/png" }
             else if rel.ends_with(".jpg") || rel.ends_with(".jpeg") { "image/jpeg" }
             else if rel.ends_with(".css")  { "text/css" }
             else if rel.ends_with(".js")   { "application/javascript" }
             else { "application/octet-stream" };

    match tokio::fs::read(&target).await {
        Ok(data) => {
            let headers = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: {ct}\r\nContent-Length: {}\r\nCache-Control: no-cache\r\n\r\n",
                data.len()
            );
            let _ = writer.write_all(headers.as_bytes()).await;
            let _ = writer.write_all(&data).await;
        }
        Err(_) => {
            let _ = writer.write_all(b"HTTP/1.1 404 Not Found\r\nContent-Length: 9\r\n\r\nNot Found").await;
        }
    }
}
