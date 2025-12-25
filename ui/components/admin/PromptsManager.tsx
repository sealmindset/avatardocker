"use client";

import { useEffect, useMemo, useState } from "react";

type PromptItem = { id: string; title?: string; type?: string; agentId?: string; version?: number; updatedAt?: string };

type Prompt = { id?: string; title: string; type: string; agentId?: string; content: string; version?: number; updatedAt?: string; updatedBy?: string };

export default function PromptsManager() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<PromptItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [filter, setFilter] = useState("");

  const loadList = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/orchestrator/admin/prompts");
      const data = await res.json().catch(() => null);
      const arr = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
      setItems(arr);
    } catch (e: any) {
      setError(e.message || "Failed to load prompts");
    } finally {
      setLoading(false);
    }
  };

  const loadOne = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/orchestrator/admin/prompts/${encodeURIComponent(id)}`);
      const full = await res.json();
      setPrompt(full);
      setSelectedId(id);
      const vr = await fetch(`/api/orchestrator/admin/prompts/${encodeURIComponent(id)}/versions`);
      const vjson = await vr.json().catch(() => null);
      setVersions(Array.isArray(vjson?.items) ? vjson.items : (Array.isArray(vjson) ? vjson : []));
    } catch (e: any) {
      setError(e.message || "Failed to load prompt");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadList(); }, []);

  const onNew = () => {
    setPrompt({ title: "", type: "system", agentId: "", content: "" });
    setSelectedId(null);
  };

  const onSave = async () => {
    if (!prompt) return;
    setLoading(true);
    setError(null);
    try {
      if (prompt.id) {
        const res = await fetch(`/api/orchestrator/admin/prompts/${encodeURIComponent(prompt.id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(prompt),
        });
        if (!res.ok) throw new Error(`Save failed (${res.status})`);
      } else {
        const res = await fetch(`/api/orchestrator/admin/prompts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(prompt),
        });
        if (!res.ok) throw new Error(`Create failed (${res.status})`);
      }
      await loadList();
    } catch (e: any) {
      setError(e.message || "Failed to save prompt");
    } finally {
      setLoading(false);
    }
  };

  const onDelete = async () => {
    if (!prompt?.id) return;
    if (!confirm("Delete this prompt?")) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/orchestrator/admin/prompts/${encodeURIComponent(prompt.id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      setPrompt(null);
      setSelectedId(null);
      await loadList();
    } catch (e: any) {
      setError(e.message || "Failed to delete prompt");
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => items.filter(i => {
    const t = `${i.title || ""} ${i.type || ""} ${i.agentId || ""}`.toLowerCase();
    return t.includes(filter.toLowerCase());
  }), [items, filter]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <input placeholder="Search" value={filter} onChange={e => setFilter(e.target.value)} className="w-full rounded border px-2 py-1 text-sm" />
          <button onClick={onNew} className="rounded border border-gray-300 px-3 py-1 text-sm">New</button>
        </div>
        <div className="max-h-[480px] overflow-auto rounded border">
          {filtered.map(i => (
            <button key={i.id} onClick={() => loadOne(i.id)} className={`flex w-full items-center justify-between border-b px-3 py-2 text-left text-sm ${selectedId === i.id ? "bg-gray-100" : ""}`}>
              <div>
                <div className="font-medium">{i.title || i.id}</div>
                <div className="text-xs text-gray-500">{i.type || ""} {i.version ? `v${i.version}` : ""}</div>
              </div>
              <div className="text-xs text-gray-500">{i.updatedAt ? new Date(i.updatedAt).toLocaleString() : ""}</div>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="p-3 text-center text-sm text-gray-500">No prompts</div>
          )}
        </div>
      </div>
      <div className="lg:col-span-2 space-y-3">
        <div className="flex items-center gap-2">
          <button onClick={onSave} disabled={!prompt || loading} className="rounded bg-black px-3 py-1 text-sm text-white disabled:opacity-60">{loading ? "Saving..." : "Save"}</button>
          <button onClick={onDelete} disabled={!prompt?.id || loading} className="rounded border border-gray-300 px-3 py-1 text-sm">Delete</button>
          {error && <div className="ml-2 rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">{error}</div>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-600">Title</label>
            <input value={prompt?.title || ""} onChange={e => setPrompt(p => p ? { ...p, title: e.target.value } : p)} className="mt-1 w-full rounded border px-2 py-1 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-600">Type</label>
            <select value={prompt?.type || "system"} onChange={e => setPrompt(p => p ? { ...p, type: e.target.value } : p)} className="mt-1 w-full rounded border px-2 py-1 text-sm">
              <option value="system">system</option>
              <option value="instruction">instruction</option>
              <option value="tooling">tooling</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-600">Agent Id</label>
            <input value={prompt?.agentId || ""} onChange={e => setPrompt(p => p ? { ...p, agentId: e.target.value } : p)} className="mt-1 w-full rounded border px-2 py-1 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-600">Version</label>
            <input value={prompt?.version?.toString() || ""} readOnly className="mt-1 w-full rounded border bg-gray-50 px-2 py-1 text-sm" />
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-600">Content</label>
          <textarea value={prompt?.content || ""} onChange={e => setPrompt(p => p ? { ...p, content: e.target.value } : p)} className="mt-1 h-72 w-full rounded border p-2 font-mono text-sm" />
        </div>
        <div>
          <div className="mb-1 text-sm font-medium">Versions</div>
          <div className="max-h-40 overflow-auto rounded border">
            {versions.map((v, idx) => (
              <div key={idx} className="flex items-center justify-between border-b px-3 py-2 text-sm">
                <div>v{v.version || v} <span className="ml-2 text-xs text-gray-500">{v.updatedAt ? new Date(v.updatedAt).toLocaleString() : ""}</span></div>
                <a href={`/api/orchestrator/admin/prompts/${encodeURIComponent(prompt?.id || "")}/versions/${encodeURIComponent(v.version || v)}`} className="text-xs text-gray-600 underline">Open</a>
              </div>
            ))}
            {versions.length === 0 && (
              <div className="p-3 text-center text-sm text-gray-500">No versions</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
