"use client";

import { useEffect, useMemo, useState } from "react";

type Agent = {
  id?: string;
  name: string;
  description?: string;
  defaultPromptId?: string;
  updatedAt?: string;
  updatedBy?: string;
};

export default function AgentsManager() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/orchestrator/admin/agents");
        const data = await res.json().catch(() => null);
        if (!cancelled) {
          const arr = Array.isArray(data?.agents) ? data.agents : (Array.isArray(data) ? data : []);
          setAgents(arr);
          setDirty(false);
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message || "Failed to load agents");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const add = () => {
    setAgents(a => [...a, { name: "", description: "", defaultPromptId: "" }]);
    setDirty(true);
  };

  const remove = (idx: number) => {
    setAgents(a => a.filter((_, i) => i !== idx));
    setDirty(true);
  };

  const update = (idx: number, key: keyof Agent, value: string) => {
    setAgents(a => a.map((it, i) => i === idx ? { ...it, [key]: value } : it));
    setDirty(true);
  };

  const save = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/orchestrator/admin/agents", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agents }),
      });
      if (!res.ok) throw new Error(`Save failed (${res.status})`);
      setDirty(false);
    } catch (e: any) {
      setError(e.message || "Failed to save agents");
    } finally {
      setLoading(false);
    }
  };

  const canSave = useMemo(() => dirty && agents.every(a => a.name?.trim().length > 0), [dirty, agents]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={add} className="rounded border border-gray-300 px-3 py-1 text-sm">Add Agent</button>
        <button onClick={save} disabled={!canSave || loading} className="rounded bg-black px-3 py-1 text-sm text-white disabled:opacity-60">{loading ? "Saving..." : "Save"}</button>
        {error && <div className="ml-2 rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">{error}</div>}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left">
              <th className="px-2 py-1">Name</th>
              <th className="px-2 py-1">Description</th>
              <th className="px-2 py-1">Default Prompt Id</th>
              <th className="px-2 py-1"></th>
            </tr>
          </thead>
          <tbody>
            {agents.map((a, idx) => (
              <tr key={idx} className="border-t">
                <td className="px-2 py-1"><input value={a.name || ""} onChange={e => update(idx, "name", e.target.value)} className="w-56 rounded border px-2 py-1" /></td>
                <td className="px-2 py-1"><input value={a.description || ""} onChange={e => update(idx, "description", e.target.value)} className="w-80 rounded border px-2 py-1" /></td>
                <td className="px-2 py-1"><input value={a.defaultPromptId || ""} onChange={e => update(idx, "defaultPromptId", e.target.value)} className="w-64 rounded border px-2 py-1" /></td>
                <td className="px-2 py-1 text-right"><button onClick={() => remove(idx)} className="rounded border border-gray-300 px-2 py-1">Remove</button></td>
              </tr>
            ))}
            {agents.length === 0 && (
              <tr><td colSpan={4} className="px-2 py-4 text-center text-gray-500">No agents</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
