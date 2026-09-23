"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { fetchDutyFloor, fetchDutyWsToken, type DutyFloorResponse } from "@/lib/api";
import { getWsBaseUrl } from "@/lib/ws";

const DUTY_QUERY_KEY = ["duty-floor"];

export function useDutyFloor() {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: DUTY_QUERY_KEY,
    queryFn: fetchDutyFloor,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    let ws: WebSocket | null = null;
    let pingTimer: ReturnType<typeof setInterval> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    async function connect() {
      try {
        const { token } = await fetchDutyWsToken();
        ws = new WebSocket(`${getWsBaseUrl()}/api/ws/duty?token=${encodeURIComponent(token)}`);

        ws.onopen = () => setConnected(true);
        ws.onmessage = (event) => {
          const msg = JSON.parse(event.data as string) as {
            type: string;
            data?: DutyFloorResponse;
          };
          if ((msg.type === "snapshot" || msg.type === "update") && msg.data) {
            queryClient.setQueryData(DUTY_QUERY_KEY, msg.data);
            void queryClient.invalidateQueries({ queryKey: ["duty-summary"] });
          }
        };
        ws.onclose = () => {
          setConnected(false);
          if (pingTimer) clearInterval(pingTimer);
          if (!closed) {
            reconnectTimer = setTimeout(() => void connect(), 3000);
          }
        };
        ws.onerror = () => ws?.close();

        pingTimer = setInterval(() => {
          if (ws?.readyState === WebSocket.OPEN) ws.send("ping");
        }, 25_000);
      } catch {
        setConnected(false);
        if (!closed) {
          reconnectTimer = setTimeout(() => void connect(), 5000);
        }
      }
    }

    void connect();
    return () => {
      closed = true;
      if (pingTimer) clearInterval(pingTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [queryClient]);

  return { floor: data, isLoading, isError, connected, refetch };
}
