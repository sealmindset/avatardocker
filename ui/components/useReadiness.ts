"use client";

import { useEffect, useState } from "react";

export type ReadinessSnapshot = {
  timestamp: string | null;
  overall: number | null;
  technical: number | null;
  communication: number | null;
  structure: number | null;
  behavioral: number | null;
};

export type ReadinessHistoryResponse = {
  userId: string;
  latest: ReadinessSnapshot | null;
  history: ReadinessSnapshot[];
};

export function useReadiness(userId: string | null) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ReadinessHistoryResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!userId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/orchestrator/readiness/${encodeURIComponent(userId)}`);
        const ct = res.headers.get("content-type") || "";
        const payload = ct.includes("application/json") ? await res.json() : await res.text();
        if (!cancelled) {
          if (typeof payload === "string") {
            setError(payload || "Failed to load readiness");
          } else {
            setData(payload as ReadinessHistoryResponse);
          }
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load readiness");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { loading, error, data };
}
