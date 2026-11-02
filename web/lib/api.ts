"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// In production the Go server serves this app, so the API is same-origin (""). `next dev` sets
// NEXT_PUBLIC_API_URL=http://localhost:8080 via .env.development.
export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function api<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(API_BASE + path, {
    method,
    credentials: "include",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON error page */
  }
  if (!res.ok) {
    const msg = (data as { error?: string } | null)?.error ?? `Request failed (${res.status})`;
    throw new ApiError(res.status, msg);
  }
  return data as T;
}

// ---------- types ----------

export type User = { id: string; email: string; retention_days: number; created_at: string };
export type MeResponse = {
  user: User;
  active_sessions: number;
  limits: { max_endpoints: number; max_tunnels: number; max_body_bytes: number };
};

export type Endpoint = {
  id: string;
  name: string;
  public_token: string;
  hook_url: string;
  status: "active" | "inactive";
  forward_url: string;
  request_count: number;
  last_request_at: string | null;
  created_at: string;
  tunnel_connected: boolean;
};

export type DeliveryStatus = "pending" | "delivered" | "failed" | "no_tunnel";
export type DeliveryBrief = {
  id: string;
  kind: "forward" | "replay";
  status: DeliveryStatus;
  response_code: number | null;
  duration_ms: number | null;
};

export type RequestSummary = {
  id: string;
  endpoint_id: string;
  method: string;
  path: string;
  query: string;
  content_type: string;
  size: number;
  source_ip: string;
  received_at: string;
  delivery: DeliveryBrief | null;
};

export type BodyView = { body_base64: string; body_text: string | null };
export type Delivery = {
  id: string;
  request_id: string;
  kind: "forward" | "replay";
  status: DeliveryStatus;
  destination: string;
  response_code: number | null;
  response_headers: Record<string, string[]> | null;
  response_body: BodyView;
  duration_ms: number | null;
  error: string;
  created_at: string;
  completed_at: string | null;
};
export type RequestDetail = Omit<RequestSummary, "delivery"> & {
  headers: Record<string, string[]>;
  body: BodyView;
  deliveries: Delivery[];
};

export type Stats = { endpoints: number; requests: number; delivered: number; failed: number };

export type LiveEvent =
  | { type: "request"; request: RequestSummary }
  | { type: "delivery"; request_id: string; endpoint_id: string; delivery: DeliveryBrief; error: string }
  | { type: "tunnel"; endpoint_id: string; connected: boolean };

// ---------- hooks ----------

/** Loads the signed-in user; redirects to /login when the session is missing or expired. */
export function useMe() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const refresh = useCallback(async () => {
    try {
      setMe(await api<MeResponse>("GET", "/api/v1/me"));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        const next = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = `/login/?next=${next}`;
      }
    }
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  return { me, refresh };
}

/** Subscribes to the dashboard WebSocket with automatic reconnect. Returns connection state. */
export function useLive(onEvent: (e: LiveEvent) => void) {
  const handler = useRef(onEvent);
  handler.current = onEvent;
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let closed = false;
    let attempt = 0;

    const open = () => {
      const base = API_BASE || window.location.origin;
      ws = new WebSocket(base.replace(/^http/, "ws") + "/api/v1/ws/dashboard");
      ws.onopen = () => {
        attempt = 0;
        setConnected(true);
      };
      ws.onmessage = (m) => {
        try {
          handler.current(JSON.parse(m.data) as LiveEvent);
        } catch {
          /* ignore malformed event */
        }
      };
      ws.onclose = () => {
        setConnected(false);
        if (!closed) timer = setTimeout(open, Math.min(1000 * 2 ** attempt++, 15000));
      };
    };
    open();
    return () => {
      closed = true;
      clearTimeout(timer);
      ws?.close();
    };
  }, []);

  return connected;
}

// ---------- formatting ----------

export function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${Math.floor(s)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
