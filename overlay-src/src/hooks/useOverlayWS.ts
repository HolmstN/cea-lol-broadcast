import { useState, useEffect } from 'react';

export interface OverlayState {
  scene: string;
  params: Record<string, string>;
}

export function useOverlayWS(): OverlayState {
  const [state, setState] = useState<OverlayState>({ scene: 'idle', params: {} });

  useEffect(() => {
    let ws: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let dead = false;

    function connect() {
      ws = new WebSocket('ws://127.0.0.1:7233');
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data as string) as { scene: string; params: Record<string, string> };
          if (msg.scene) setState({ scene: msg.scene, params: msg.params ?? {} });
        } catch { /* ignore */ }
      };
      ws.onclose = () => {
        if (!dead) timer = setTimeout(connect, 3000);
      };
    }

    connect();
    return () => {
      dead = true;
      if (timer) clearTimeout(timer);
      ws?.close();
    };
  }, []);

  return state;
}
