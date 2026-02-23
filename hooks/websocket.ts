"use client";

import { useRef, useState, useCallback, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type WebSocketStatus =
  | "idle"
  | "connecting"
  | "open"
  | "closed"
  | "error";

export interface UseWebSocketOptions<TInbound> {
  /** Called whenever a message is received from the server */
  onMessage: (data: TInbound) => void;
  /** Called on connection error */
  onError?: (event: Event) => void;
  /** Called when the socket closes */
  onClose?: (event: CloseEvent) => void;
  /**
   * If true, automatically attempt to reconnect on unexpected close.
   * Default: false
   */
  reconnect?: boolean;
  /** Delay in ms between reconnect attempts. Default: 2000 */
  reconnectDelay?: number;
}

export interface UseWebSocketReturn<TOutbound> {
  status: WebSocketStatus;
  /** Send a message to the WebSocket server. Throws if the socket is not open. */
  send: (data: TOutbound) => void;
  /** Manually open the connection */
  connect: (url: string) => void;
  /** Close the connection */
  disconnect: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWebSocket<TInbound = unknown, TOutbound = unknown>(
  options: UseWebSocketOptions<TInbound>,
): UseWebSocketReturn<TOutbound> {
  const [status, setStatus] = useState<WebSocketStatus>("idle");

  const socketRef = useRef<WebSocket | null>(null);
  const urlRef = useRef<string | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentionalCloseRef = useRef<boolean>(false);
  const optionsRef = useRef(options);
  // Stores the connect function itself so ws.onclose can call it without
  // closing over the const declaration (which would be a use-before-declare error)
  const connectRef = useRef<(url: string) => void>(() => {});

  // Keep options ref current so callbacks always see the latest values
  // without causing connect/disconnect to re-create
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const connect = useCallback(
    (url: string) => {
      // Close any existing socket first
      intentionalCloseRef.current = true;
      socketRef.current?.close();
      clearReconnectTimer();

      urlRef.current = url;
      intentionalCloseRef.current = false;

      const ws = new WebSocket(url);
      socketRef.current = ws;
      setStatus("connecting");

      ws.onopen = () => setStatus("open");

      ws.onmessage = (event: MessageEvent) => {
        try {
          const parsed: TInbound =
            typeof event.data === "string"
              ? JSON.parse(event.data)
              : event.data;
          optionsRef.current.onMessage(parsed);
        } catch (err) {
          console.error("[useWebSocket] Failed to parse message:", err);
        }
      };

      ws.onerror = (event: Event) => {
        setStatus("error");
        optionsRef.current.onError?.(event);
      };

      ws.onclose = (event: CloseEvent) => {
        setStatus("closed");
        optionsRef.current.onClose?.(event);
        socketRef.current = null;

        if (
          !intentionalCloseRef.current &&
          optionsRef.current.reconnect &&
          urlRef.current
        ) {
          const delay = optionsRef.current.reconnectDelay ?? 2000;
          // Use connectRef instead of connect directly to avoid
          // the "variable accessed before declaration" ESLint error
          reconnectTimerRef.current = setTimeout(() => {
            connectRef.current(urlRef.current!);
          }, delay);
        }
      };
    },
    [clearReconnectTimer],
  );

  // Keep connectRef in sync with the latest connect function
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  const disconnect = useCallback(() => {
    intentionalCloseRef.current = true;
    clearReconnectTimer();
    socketRef.current?.close();
    socketRef.current = null;
    urlRef.current = null;
    setStatus("idle");
  }, [clearReconnectTimer]);

  const send = useCallback((data: TOutbound) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      throw new Error("[useWebSocket] Cannot send — socket is not open");
    }
    const payload = typeof data === "string" ? data : JSON.stringify(data);
    socketRef.current.send(payload);
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      intentionalCloseRef.current = true;
      clearReconnectTimer();
      socketRef.current?.close();
    };
  }, [clearReconnectTimer]);

  return { status, send, connect, disconnect };
}
