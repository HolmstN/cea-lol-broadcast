import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import "./App.css";

type Status = "idle" | "connecting" | "connected" | "not_found" | "error";

export default function App() {
  const [status, setStatus] = useState<Status>("idle");
  const [events, setEvents] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const unlistenRef = useRef<UnlistenFn | null>(null);

  useEffect(() => {
    return () => {
      unlistenRef.current?.();
    };
  }, []);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [events]);

  async function connect() {
    setStatus("connecting");
    setError(null);

    // Subscribe to LCU events before connecting
    unlistenRef.current?.();
    unlistenRef.current = await listen<unknown>("lcu-event", (e) => {
      setEvents((prev) => [
        ...prev.slice(-199), // keep last 200
        JSON.stringify(e.payload, null, 2),
      ]);
    });

    await listen("lcu-disconnected", () => {
      setStatus("idle");
    });

    try {
      const found = await invoke<boolean>("connect_lcu");
      setStatus(found ? "connected" : "not_found");
    } catch (e) {
      setStatus("error");
      setError(String(e));
    }
  }

  return (
    <main>
      <header>
        <h1>CEA LoL Broadcast</h1>
        <div className="status-row">
          <span className={`dot ${status}`} />
          <span className="status-label">{statusLabel(status)}</span>
          <button onClick={connect} disabled={status === "connecting" || status === "connected"}>
            {status === "connecting" ? "Connecting…" : "Connect to LCU"}
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </header>

      <div className="log" ref={logRef}>
        {events.length === 0 ? (
          <p className="empty">No events yet — connect and interact with the League client.</p>
        ) : (
          events.map((ev, i) => (
            <pre key={i} className="event">{ev}</pre>
          ))
        )}
      </div>
    </main>
  );
}

function statusLabel(s: Status) {
  return {
    idle: "Not connected",
    connecting: "Connecting…",
    connected: "Connected",
    not_found: "League client not found",
    error: "Error",
  }[s];
}
