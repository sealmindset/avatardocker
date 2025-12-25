"use client";

import { useMemo } from "react";
import { useReadiness } from "./useReadiness";

function labelForScore(score: number | null): string {
  if (score == null || !isFinite(score)) return "No data";
  if (score >= 85) return "Strong";
  if (score >= 60) return "Emerging";
  return "Early";
}

export function ReadinessCard({ userId }: { userId: string | null }) {
  const { loading, error, data } = useReadiness(userId);

  const latest = data?.latest || null;
  const band = useMemo(() => labelForScore(latest?.overall ?? null), [latest]);

  return (
    <div className="rounded border border-gray-200 p-4">
      <div className="text-lg font-medium">Readiness (Pilot)</div>
      <div className="mt-1 text-xs text-gray-500">Experimental longitudinal scoring from recent sessions.</div>
      {loading && <div className="mt-3 text-sm text-gray-600">Loading readiness...</div>}
      {!loading && error && <div className="mt-3 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</div>}
      {!loading && !error && (
        <>
          <div className="mt-3 flex items-baseline gap-2">
            <div className="text-3xl font-bold">
              {typeof latest?.overall === "number" ? `${Math.round(latest.overall)} / 100` : "—"}
            </div>
            <div className="text-sm text-gray-600">{band}</div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-700">
            <div>
              <div className="font-medium">Technical</div>
              <div>{latest?.technical != null ? Math.round(latest.technical) : "—"}</div>
            </div>
            <div>
              <div className="font-medium">Communication</div>
              <div>{latest?.communication != null ? Math.round(latest.communication) : "—"}</div>
            </div>
            <div>
              <div className="font-medium">Structure</div>
              <div>{latest?.structure != null ? Math.round(latest.structure) : "—"}</div>
            </div>
            <div>
              <div className="font-medium">Behavioral</div>
              <div>{latest?.behavioral != null ? Math.round(latest.behavioral) : "—"}</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
