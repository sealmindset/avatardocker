"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

// ============================================================================
// TYPES
// ============================================================================

interface AvatarBatch {
  id: string;
  name: string;
  count: number;
  description: string;
  release_date?: string;
}

interface CatalogAvatar {
  id: string;
  batch: string;
  gender: "female" | "male" | "unknown";
  style: string;
  name: string;
  size_mb: number;
  thumbnail_url?: string;
  downloaded?: boolean;
  downloaded_at?: string;
}

interface LocalAvatar {
  id: string;
  name: string;
  gender: string;
  style: string;
  path: string;
  size_mb: number;
  downloaded_at: string;
  source: string;
}

interface Voice {
  id: string;
  name: string;
  gender: string;
  provider: string;
  model: string;
  description: string;
  download_url?: string;
  downloaded?: boolean;
}

interface PiperVoiceCatalog {
  id: string;
  name: string;
  gender: string;
  quality: string;
  language: string;
  sample_url: string;
  download_url: string;
  onnx_url: string;
  json_url: string;
  size_mb: number;
  downloaded?: boolean;
}

interface DownloadJob {
  status: "starting" | "downloading" | "completed" | "failed";
  progress: number;
  message: string;
  avatar_id: string;
  name: string;
}

// ============================================================================
// AVATAR MANAGER PAGE
// ============================================================================

// Piper voice catalog from HuggingFace with audio sample URLs from rhasspy/piper-samples
const PIPER_VOICE_CATALOG: PiperVoiceCatalog[] = [
  { id: "amy", name: "Amy", gender: "female", quality: "medium", language: "en_US", sample_url: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/samples/rainbow.wav", download_url: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx", onnx_url: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx", json_url: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx.json", size_mb: 63 },
  { id: "lessac", name: "Lessac", gender: "female", quality: "medium", language: "en_US", sample_url: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/samples/rainbow.wav", download_url: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx", onnx_url: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx", json_url: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json", size_mb: 63 },
  { id: "libritts", name: "LibriTTS", gender: "female", quality: "high", language: "en_US", sample_url: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/libritts/high/samples/rainbow.wav", download_url: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/libritts/high/en_US-libritts-high.onnx", onnx_url: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/libritts/high/en_US-libritts-high.onnx", json_url: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/libritts/high/en_US-libritts-high.onnx.json", size_mb: 75 },
  { id: "libritts_r", name: "LibriTTS-R", gender: "female", quality: "medium", language: "en_US", sample_url: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/libritts_r/medium/samples/rainbow.wav", download_url: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/libritts_r/medium/en_US-libritts_r-medium.onnx", onnx_url: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/libritts_r/medium/en_US-libritts_r-medium.onnx", json_url: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/libritts_r/medium/en_US-libritts_r-medium.onnx.json", size_mb: 63 },
  { id: "ryan", name: "Ryan", gender: "male", quality: "medium", language: "en_US", sample_url: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/ryan/medium/samples/rainbow.wav", download_url: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/ryan/medium/en_US-ryan-medium.onnx", onnx_url: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/ryan/medium/en_US-ryan-medium.onnx", json_url: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/ryan/medium/en_US-ryan-medium.onnx.json", size_mb: 63 },
  { id: "ryan_high", name: "Ryan (High)", gender: "male", quality: "high", language: "en_US", sample_url: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/ryan/high/samples/rainbow.wav", download_url: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/ryan/high/en_US-ryan-high.onnx", onnx_url: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/ryan/high/en_US-ryan-high.onnx", json_url: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/ryan/high/en_US-ryan-high.onnx.json", size_mb: 75 },
  { id: "arctic", name: "Arctic", gender: "male", quality: "medium", language: "en_US", sample_url: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/arctic/medium/samples/rainbow.wav", download_url: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/arctic/medium/en_US-arctic-medium.onnx", onnx_url: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/arctic/medium/en_US-arctic-medium.onnx", json_url: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/arctic/medium/en_US-arctic-medium.onnx.json", size_mb: 63 },
  { id: "joe", name: "Joe", gender: "male", quality: "medium", language: "en_US", sample_url: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/joe/medium/samples/rainbow.wav", download_url: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/joe/medium/en_US-joe-medium.onnx", onnx_url: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/joe/medium/en_US-joe-medium.onnx", json_url: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/joe/medium/en_US-joe-medium.onnx.json", size_mb: 63 },
  { id: "kusal", name: "Kusal", gender: "male", quality: "medium", language: "en_US", sample_url: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/kusal/medium/samples/rainbow.wav", download_url: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/kusal/medium/en_US-kusal-medium.onnx", onnx_url: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/kusal/medium/en_US-kusal-medium.onnx", json_url: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/kusal/medium/en_US-kusal-medium.onnx.json", size_mb: 63 },
  { id: "l2arctic", name: "L2 Arctic", gender: "male", quality: "medium", language: "en_US", sample_url: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/l2arctic/medium/samples/rainbow.wav", download_url: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/l2arctic/medium/en_US-l2arctic-medium.onnx", onnx_url: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/l2arctic/medium/en_US-l2arctic-medium.onnx", json_url: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/l2arctic/medium/en_US-l2arctic-medium.onnx.json", size_mb: 63 },
  { id: "jenny", name: "Jenny", gender: "female", quality: "medium", language: "en_GB", sample_url: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/jenny_dioco/medium/samples/rainbow.wav", download_url: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/jenny_dioco/medium/en_GB-jenny_dioco-medium.onnx", onnx_url: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/jenny_dioco/medium/en_GB-jenny_dioco-medium.onnx", json_url: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/jenny_dioco/medium/en_GB-jenny_dioco-medium.onnx.json", size_mb: 63 },
  { id: "alba", name: "Alba", gender: "female", quality: "medium", language: "en_GB", sample_url: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/alba/medium/samples/rainbow.wav", download_url: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/alba/medium/en_GB-alba-medium.onnx", onnx_url: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/alba/medium/en_GB-alba-medium.onnx", json_url: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/alba/medium/en_GB-alba-medium.onnx.json", size_mb: 63 },
  { id: "cori", name: "Cori", gender: "female", quality: "high", language: "en_GB", sample_url: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/cori/high/samples/rainbow.wav", download_url: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/cori/high/en_GB-cori-high.onnx", onnx_url: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/cori/high/en_GB-cori-high.onnx", json_url: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/cori/high/en_GB-cori-high.onnx.json", size_mb: 75 },
  { id: "alan", name: "Alan", gender: "male", quality: "medium", language: "en_GB", sample_url: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/alan/medium/samples/rainbow.wav", download_url: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/alan/medium/en_GB-alan-medium.onnx", onnx_url: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/alan/medium/en_GB-alan-medium.onnx", json_url: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/alan/medium/en_GB-alan-medium.onnx.json", size_mb: 63 },
];

export default function AvatarManagerPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"avatars" | "voices">("avatars");
  
  // Local avatars state
  const [localAvatars, setLocalAvatars] = useState<LocalAvatar[]>([]);
  const [loadingLocal, setLoadingLocal] = useState(true);
  
  // Catalog state
  const [batches, setBatches] = useState<AvatarBatch[]>([]);
  const [catalogAvatars, setCatalogAvatars] = useState<CatalogAvatar[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  
  // Voices state
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [voiceFilter, setVoiceFilter] = useState<"all" | "female" | "male">("all");
  const [downloadingVoice, setDownloadingVoice] = useState<string | null>(null);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null);
  
  // Avatar filter state
  const [avatarFilter, setAvatarFilter] = useState<"all" | "female" | "male">("all");
  const [downloadingAvatar, setDownloadingAvatar] = useState<string | null>(null);
  
  // Download state
  const [downloadJobs, setDownloadJobs] = useState<Record<string, DownloadJob>>({});
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState<CatalogAvatar | null>(null);
  const [downloadName, setDownloadName] = useState("");
  const [downloadGender, setDownloadGender] = useState<"female" | "male">("female");

  // Fetch local avatars
  const fetchLocalAvatars = useCallback(async () => {
    setLoadingLocal(true);
    try {
      const response = await fetch("/api/orchestrator/avatars/local");
      if (response.ok) {
        const data = await response.json();
        setLocalAvatars(data.avatars || []);
      }
    } catch (error) {
      console.error("Failed to fetch local avatars:", error);
    } finally {
      setLoadingLocal(false);
    }
  }, []);

  // Fetch catalog
  const fetchCatalog = useCallback(async () => {
    setLoadingCatalog(true);
    try {
      const response = await fetch("/api/orchestrator/avatars/catalog");
      if (response.ok) {
        const data = await response.json();
        setBatches(data.batches || []);
        setCatalogAvatars(data.avatars || []);
      }
    } catch (error) {
      console.error("Failed to fetch catalog:", error);
    } finally {
      setLoadingCatalog(false);
    }
  }, []);

  // Fetch voices
  const fetchVoices = useCallback(async () => {
    setLoadingVoices(true);
    try {
      const response = await fetch("/api/orchestrator/voices/local");
      if (response.ok) {
        const data = await response.json();
        setVoices(data.voices || []);
      }
    } catch (error) {
      console.error("Failed to fetch voices:", error);
    } finally {
      setLoadingVoices(false);
    }
  }, []);

  // Initial load - fetch local avatars and catalog on mount
  useEffect(() => {
    fetchLocalAvatars();
    fetchCatalog();
  }, [fetchLocalAvatars, fetchCatalog]);

  // Load tab-specific data
  useEffect(() => {
    if (activeTab === "voices" && voices.length === 0) {
      fetchVoices();
    }
  }, [activeTab, voices.length, fetchVoices]);

  // Start download
  const startDownload = async () => {
    if (!selectedAvatar) return;

    try {
      const response = await fetch("/api/orchestrator/avatars/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          avatar_id: selectedAvatar.id,
          name: downloadName || selectedAvatar.name,
          gender: downloadGender,
          style: selectedAvatar.style,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Start polling for status
        pollDownloadStatus(data.job_id, selectedAvatar.id);
        setShowDownloadModal(false);
        setSelectedAvatar(null);
      }
    } catch (error) {
      console.error("Failed to start download:", error);
    }
  };

  // Poll download status
  const pollDownloadStatus = async (jobId: string, avatarId: string) => {
    const poll = async () => {
      try {
        const response = await fetch(`/api/orchestrator/avatars/download/${jobId}`);
        if (response.ok) {
          const status = await response.json();
          setDownloadJobs((prev) => ({ ...prev, [avatarId]: status }));

          if (status.status === "downloading" || status.status === "starting") {
            setTimeout(poll, 1000);
          } else if (status.status === "completed") {
            fetchLocalAvatars();
            // Remove from jobs after a delay
            setTimeout(() => {
              setDownloadJobs((prev) => {
                const next = { ...prev };
                delete next[avatarId];
                return next;
              });
            }, 3000);
          }
        }
      } catch (error) {
        console.error("Failed to poll download status:", error);
      }
    };
    poll();
  };

  // Delete avatar
  const deleteAvatar = async (avatarId: string) => {
    if (!confirm(`Delete avatar "${avatarId}"? This cannot be undone.`)) return;

    try {
      const response = await fetch(`/api/orchestrator/avatars/local/${encodeURIComponent(avatarId)}`, {
        method: "DELETE",
      });
      if (response.ok) {
        fetchLocalAvatars();
      }
    } catch (error) {
      console.error("Failed to delete avatar:", error);
    }
  };

  // Play/stop voice sample
  const playVoiceSample = (voiceId: string, sampleUrl: string) => {
    // If already playing this voice, stop it
    if (playingVoice === voiceId && audioRef) {
      audioRef.pause();
      audioRef.currentTime = 0;
      setPlayingVoice(null);
      setAudioRef(null);
      return;
    }
    
    // Stop any currently playing audio
    if (audioRef) {
      audioRef.pause();
      audioRef.currentTime = 0;
    }
    
    // Create and play new audio
    const audio = new Audio(sampleUrl);
    audio.onended = () => {
      setPlayingVoice(null);
      setAudioRef(null);
    };
    audio.onerror = () => {
      console.error("Failed to load audio sample");
      setPlayingVoice(null);
      setAudioRef(null);
    };
    audio.play();
    setPlayingVoice(voiceId);
    setAudioRef(audio);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/admin/overview")}
              className="text-gray-600 hover:text-gray-900"
            >
              ← Back
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Avatar Manager</h1>
          </div>
          <div className="text-sm text-gray-500">
            {localAvatars.length} avatar{localAvatars.length !== 1 ? "s" : ""} downloaded
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <nav className="flex px-6">
          {[
            { id: "avatars", label: "Local Avatars" },
            { id: "voices", label: "Local Voices" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-black text-black"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <main className="p-6">
        {/* Local Avatars Tab */}
        {activeTab === "avatars" && (
          <div>
            {/* Info Banner */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🎭</span>
                <div>
                  <h3 className="font-medium text-blue-900">ModelScope LiteAvatar Gallery</h3>
                  <p className="text-sm text-blue-700 mt-1">
                    High-quality avatar models for realistic video generation. No cloud services required.
                  </p>
                </div>
              </div>
            </div>

            {/* Filter Buttons */}
            <div className="flex items-center gap-4 mb-6">
              <div className="flex gap-2">
                {(["all", "female", "male"] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setAvatarFilter(filter)}
                    className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                      avatarFilter === filter
                        ? filter === "female"
                          ? "bg-pink-100 border-pink-400 text-pink-800"
                          : filter === "male"
                          ? "bg-blue-100 border-blue-400 text-blue-800"
                          : "bg-gray-800 border-gray-800 text-white"
                        : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {filter === "all" ? "All" : filter === "female" ? "👩 Female" : "👨 Male"}
                  </button>
                ))}
              </div>
              <a
                href="https://modelscope.cn/models/HumanAIGC-Engineering/LiteAvatarGallery"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                Browse all avatars on ModelScope →
              </a>
            </div>

            {/* Downloaded Avatars Section */}
            {localAvatars.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  Downloaded Avatars ({localAvatars.filter((a: LocalAvatar) => avatarFilter === "all" || a.gender === avatarFilter).length})
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {localAvatars
                    .filter((a: LocalAvatar) => avatarFilter === "all" || a.gender === avatarFilter)
                    .map((avatar: LocalAvatar) => (
                      <div
                        key={avatar.id}
                        className="bg-white rounded-lg border-2 border-green-200 overflow-hidden relative"
                      >
                        <div className="absolute top-2 right-2 z-10">
                          <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">
                            ✓ Downloaded
                          </span>
                        </div>
                        <div className="aspect-square bg-gray-100 flex items-center justify-center">
                          <span className="text-4xl">👤</span>
                        </div>
                        <div className="p-3">
                          <div className="flex items-start justify-between mb-1">
                            <h3 className="font-medium text-gray-900 text-sm">{avatar.name}</h3>
                            <span
                              className={`px-1.5 py-0.5 text-xs rounded ${
                                avatar.gender === "female"
                                  ? "bg-pink-100 text-pink-700"
                                  : "bg-blue-100 text-blue-700"
                              }`}
                            >
                              {avatar.gender}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500">
                            <span>{avatar.size_mb} MB</span>
                            <span className="mx-1">•</span>
                            <span>{avatar.style}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Available Avatars Section */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                Available Avatars ({catalogAvatars.filter((a: CatalogAvatar) => avatarFilter === "all" || a.gender === avatarFilter).length})
              </h3>
              {loadingCatalog ? (
                <div className="text-center py-12 text-gray-500">Loading catalog...</div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {catalogAvatars
                    .filter((a: CatalogAvatar) => avatarFilter === "all" || a.gender === avatarFilter)
                    .map((avatar: CatalogAvatar) => {
                      const isDownloaded = localAvatars.some((la: LocalAvatar) => la.id === avatar.id);
                      const isDownloading = downloadingAvatar === avatar.id || !!downloadJobs[avatar.id];
                      const job = downloadJobs[avatar.id];

                      return (
                        <div
                          key={avatar.id}
                          className={`bg-white rounded-lg border overflow-hidden transition-all ${
                            isDownloaded
                              ? "border-green-200 bg-green-50"
                              : "border-gray-200 hover:border-blue-300 hover:shadow-md"
                          }`}
                        >
                          {/* Thumbnail */}
                          <div className="relative aspect-square bg-gray-100">
                            {avatar.thumbnail_url ? (
                              <img
                                src={avatar.thumbnail_url}
                                alt={avatar.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-400">
                                <span className="text-4xl">👤</span>
                              </div>
                            )}
                            {isDownloaded && (
                              <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full p-1">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              </div>
                            )}
                          </div>
                          
                          {/* Info */}
                          <div className="p-3">
                            <div className="flex items-start justify-between mb-1">
                              <h3 className="font-medium text-gray-900 text-sm">{avatar.name}</h3>
                              <span
                                className={`px-1.5 py-0.5 text-xs rounded ${
                                  avatar.gender === "female"
                                    ? "bg-pink-100 text-pink-700"
                                    : "bg-blue-100 text-blue-700"
                                }`}
                              >
                                {avatar.gender}
                              </span>
                            </div>

                            <div className="text-xs text-gray-500 mb-2">
                              <span>{avatar.size_mb} MB</span>
                              <span className="mx-1">•</span>
                              <span>{avatar.style}</span>
                            </div>

                            {isDownloaded ? (
                              <span className="block w-full px-3 py-1.5 text-xs text-center bg-green-100 text-green-700 rounded">
                                ✓ Downloaded
                              </span>
                            ) : isDownloading ? (
                              <div>
                                <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                                  <div
                                    className="bg-blue-500 h-2 rounded-full transition-all animate-pulse"
                                    style={{ width: `${job?.progress || 10}%` }}
                                  />
                                </div>
                                <span className="text-xs text-blue-600">{job?.message || "Starting..."}</span>
                              </div>
                            ) : (
                              <button
                                onClick={async () => {
                                  setDownloadingAvatar(avatar.id);
                                  setSelectedAvatar(avatar);
                                  setDownloadName(avatar.name);
                                  setDownloadGender(avatar.gender === "male" ? "male" : "female");
                                  
                                  try {
                                    const response = await fetch("/api/orchestrator/avatars/download", {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({
                                        avatar_id: avatar.id,
                                        name: avatar.name,
                                        gender: avatar.gender,
                                        style: avatar.style,
                                      }),
                                    });

                                    if (response.ok) {
                                      const data = await response.json();
                                      pollDownloadStatus(data.job_id, avatar.id);
                                    }
                                  } catch (error) {
                                    console.error("Failed to start download:", error);
                                  } finally {
                                    setDownloadingAvatar(null);
                                  }
                                }}
                                className="w-full px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                              >
                                ⬇️ Download
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Local Voices Tab */}
        {activeTab === "voices" && (
          <div>
            {/* Info Banner */}
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🎙️</span>
                <div>
                  <h3 className="font-medium text-purple-900">Piper TTS Voice Library</h3>
                  <p className="text-sm text-purple-700 mt-1">
                    High-quality, local text-to-speech voices. No cloud services required.
                    Sample voices at{" "}
                    <a
                      href="https://piper.ttstool.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline font-medium hover:text-purple-900"
                    >
                      piper.ttstool.com
                    </a>{" "}
                    before downloading.
                  </p>
                </div>
              </div>
            </div>

            {/* Filter Buttons */}
            <div className="flex items-center gap-4 mb-6">
              <span className="text-sm font-medium text-gray-700">Filter by gender:</span>
              <div className="flex gap-2">
                {(["all", "female", "male"] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setVoiceFilter(filter)}
                    className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                      voiceFilter === filter
                        ? filter === "female"
                          ? "bg-pink-100 border-pink-400 text-pink-800"
                          : filter === "male"
                          ? "bg-blue-100 border-blue-400 text-blue-800"
                          : "bg-gray-800 border-gray-800 text-white"
                        : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {filter === "all" ? "All" : filter === "female" ? "👩 Female" : "👨 Male"}
                  </button>
                ))}
              </div>
              <a
                href="https://huggingface.co/rhasspy/piper-voices/tree/main/en/en_US"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto text-sm text-purple-600 hover:text-purple-800 flex items-center gap-1"
              >
                Browse all voices on HuggingFace →
              </a>
            </div>

            {/* Downloaded Voices Section */}
            {voices.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  Downloaded Voices ({voices.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {voices
                    .filter((v) => voiceFilter === "all" || v.gender === voiceFilter)
                    .map((voice) => (
                      <div
                        key={voice.id}
                        className="bg-white rounded-lg border-2 border-green-200 p-4 relative"
                      >
                        <div className="absolute top-2 right-2">
                          <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">
                            ✓ Downloaded
                          </span>
                        </div>
                        <div className="flex items-start justify-between mb-2 pr-20">
                          <h3 className="font-medium text-gray-900">{voice.name}</h3>
                          <span
                            className={`px-2 py-1 text-xs rounded-full ${
                              voice.gender === "female"
                                ? "bg-pink-100 text-pink-700"
                                : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {voice.gender}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mb-2">{voice.description}</p>
                        <div className="text-xs text-gray-400">
                          <p>Model: {voice.model}</p>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Available Voices Section */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                Available Piper Voices ({PIPER_VOICE_CATALOG.filter((v) => voiceFilter === "all" || v.gender === voiceFilter).length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {PIPER_VOICE_CATALOG
                  .filter((v) => voiceFilter === "all" || v.gender === voiceFilter)
                  .map((voice) => {
                    const isDownloaded = voices.some((v) => v.id === voice.id);
                    const isDownloading = downloadingVoice === voice.id;
                    
                    return (
                      <div
                        key={voice.id}
                        className={`bg-white rounded-lg border p-4 transition-all ${
                          isDownloaded
                            ? "border-green-200 bg-green-50"
                            : "border-gray-200 hover:border-purple-300 hover:shadow-md"
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="font-medium text-gray-900">{voice.name}</h3>
                            <p className="text-xs text-gray-500">{voice.language}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-1 text-xs rounded-full ${
                                voice.quality === "high"
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {voice.quality}
                            </span>
                            <span
                              className={`px-2 py-1 text-xs rounded-full ${
                                voice.gender === "female"
                                  ? "bg-pink-100 text-pink-700"
                                  : "bg-blue-100 text-blue-700"
                              }`}
                            >
                              {voice.gender}
                            </span>
                          </div>
                        </div>
                        
                        <div className="text-sm text-gray-500 mb-3">
                          <span>{voice.size_mb} MB</span>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => playVoiceSample(voice.id, voice.sample_url)}
                            className={`flex-1 px-3 py-1.5 text-sm text-center border rounded flex items-center justify-center gap-1 transition-all ${
                              playingVoice === voice.id
                                ? "border-purple-500 bg-purple-100 text-purple-800"
                                : "border-purple-300 text-purple-700 hover:bg-purple-50"
                            }`}
                          >
                            {playingVoice === voice.id ? "⏹️ Stop" : "🔊 Sample"}
                          </button>
                          {isDownloaded ? (
                            <span className="flex-1 px-3 py-1.5 text-sm text-center bg-green-100 text-green-700 rounded">
                              ✓ Downloaded
                            </span>
                          ) : isDownloading ? (
                            <span className="flex-1 px-3 py-1.5 text-sm text-center bg-purple-100 text-purple-700 rounded animate-pulse">
                              Downloading...
                            </span>
                          ) : (
                            <button
                              onClick={async () => {
                                setDownloadingVoice(voice.id);
                                try {
                                  const response = await fetch("/api/orchestrator/voices/download", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                      voice_id: voice.id,
                                      name: voice.name,
                                      gender: voice.gender,
                                      onnx_url: voice.onnx_url,
                                      json_url: voice.json_url,
                                    }),
                                  });
                                  if (response.ok) {
                                    fetchVoices();
                                  }
                                } catch (error) {
                                  console.error("Failed to download voice:", error);
                                } finally {
                                  setDownloadingVoice(null);
                                }
                              }}
                              className="flex-1 px-3 py-1.5 text-sm bg-purple-600 text-white rounded hover:bg-purple-700"
                            >
                              ⬇️ Download
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Download Modal */}
      {showDownloadModal && selectedAvatar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-lg font-semibold mb-4">Download Avatar</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Avatar ID</label>
                <input
                  type="text"
                  value={selectedAvatar.id}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={downloadName}
                  onChange={(e) => setDownloadName(e.target.value)}
                  placeholder="Enter a name for this avatar"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDownloadGender("female")}
                    className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium ${
                      downloadGender === "female"
                        ? "bg-pink-100 border-pink-400 text-pink-800"
                        : "bg-white border-gray-300 text-gray-600"
                    }`}
                  >
                    👩 Female
                  </button>
                  <button
                    onClick={() => setDownloadGender("male")}
                    className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium ${
                      downloadGender === "male"
                        ? "bg-blue-100 border-blue-400 text-blue-800"
                        : "bg-white border-gray-300 text-gray-600"
                    }`}
                  >
                    👨 Male
                  </button>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowDownloadModal(false);
                  setSelectedAvatar(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={startDownload}
                className="flex-1 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800"
              >
                Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
