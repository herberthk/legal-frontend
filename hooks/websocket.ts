"use client";

import { useRef, useState, useCallback, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type WebSocketStatus =
  | "idle"
  | "connecting"
  | "open"
  | "closed"
  | "error";

/**
 * Inbound messages are always either:
 *   - string  — UTF-8 text frames from the server
 *   - ArrayBuffer — raw binary frames (e.g. PCM audio)
 *
 * The hook never attempts JSON.parse — callers handle the protocol themselves.
 */
export type WsInbound = string | ArrayBuffer;

export interface UseWebSocketOptions {
  /** Called for every message received from the server */
  onMessage: (data: WsInbound) => void;
  /** Called on socket error */
  onError?: (event: Event) => void;
  /** Called when the socket closes */
  onClose?: (event: CloseEvent) => void;
  /**
   * Automatically reconnect on unexpected close.
   * Default: false
   */
  reconnect?: boolean;
  /** Delay in ms between reconnect attempts. Default: 2000 */
  reconnectDelay?: number;
}

export interface UseWebSocketReturn {
  status: WebSocketStatus;
  /**
   * Send a plain UTF-8 string to the server.
   * (The Bun server expects raw text, not JSON-wrapped objects.)
   */
  send: (text: string) => void;
  /** Open (or re-open) the connection to the given URL */
  connect: (url: string) => void;
  /** Intentionally close the connection */
  disconnect: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWebSocket(options: UseWebSocketOptions): UseWebSocketReturn {
  const [status, setStatus] = useState<WebSocketStatus>("idle");

  const socketRef = useRef<WebSocket | null>(null);
  const urlRef = useRef<string | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentionalCloseRef = useRef<boolean>(false);
  const optionsRef = useRef(options);
  // Ref to connect() so ws.onclose can call it without use-before-declare errors
  const connectRef = useRef<(url: string) => void>(() => {});

  // Keep option callbacks current without re-creating the socket
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const clearReconnectTimer = () => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  };

  const connect = (url: string) => {
    intentionalCloseRef.current = true;
    socketRef.current?.close();
    clearReconnectTimer();

    urlRef.current = url;
    intentionalCloseRef.current = false;

    const ws = new WebSocket(url);

    // Critical: receive binary frames as ArrayBuffer, not Blob.
    // Blobs require an extra async read step and add latency to audio playback.
    ws.binaryType = "arraybuffer";

    socketRef.current = ws;
    setStatus("connecting");

    ws.onopen = () => {
      console.log("ws opened");
      setStatus("open");
    };

    ws.onmessage = (event: MessageEvent<string | ArrayBuffer>) => {
      // Pass messages through as-is — no JSON parsing.
      // Strings are protocol signals (READY:, TEXT:, DONE, ERROR:)
      // ArrayBuffers are raw PCM audio frames.
      console.log("ws message", event.data);
      optionsRef.current.onMessage(event.data);
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
        reconnectTimerRef.current = setTimeout(() => {
          connectRef.current(urlRef.current!);
        }, delay);
      }
    };
  };

  useEffect(() => {
    connectRef.current = connect;
  }, []);

  const disconnect = () => {
    intentionalCloseRef.current = true;
    clearReconnectTimer();
    socketRef.current?.close();
    socketRef.current = null;
    urlRef.current = null;
    setStatus("idle");
  };

  const send = (text: string) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      throw new Error("[useWebSocket] Cannot send — socket is not open");
    }
    console.log("ws message to send", text);
    socketRef.current.send(text);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      intentionalCloseRef.current = true;
      clearReconnectTimer();
      socketRef.current?.close();
    };
  }, []);

  return { status, send, connect, disconnect };
}
