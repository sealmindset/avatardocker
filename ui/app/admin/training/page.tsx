"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  StageEditModal, 
  PulseStage, 
  StageVersion, 
  DEFAULT_PULSE_STAGES,
  STAGES_KEY,
  STAGES_VERSIONS_KEY 
} from "@/components/admin/StageEditModal";

// ============================================================================
// TYPES
// ============================================================================

interface ExperienceLevelConfig {
  id: string;
  name: string;
  icon: string;
  description: string;
  enabled: boolean;
  contentFilter: string;
}

interface TrainingSettings {
  introVideoEnabled: boolean;
  introVideoUrl: string;
  autoPlayIntro: boolean;
  showRubric: boolean;
  showMasteryStatus: boolean;
  showTrainerFeedback: boolean;
  requireLevelSelection: boolean;
}

// ============================================================================
// DEFAULT DATA
// ============================================================================
const DEFAULT_EXPERIENCE_LEVELS: ExperienceLevelConfig[] = [
  {
    id: "beginner",
    name: "Beginner",
    icon: "🌱",
    description: "New to sales or PULSE methodology",
    enabled: true,
    contentFilter: "beginner",
  },
  {
    id: "intermediate",
    name: "Intermediate",
    icon: "🌿",
    description: "Some sales experience, learning PULSE",
    enabled: true,
    contentFilter: "beginner,intermediate",
  },
  {
    id: "advanced",
    name: "Advanced",
    icon: "🌳",
    description: "Experienced sales professional refining skills",
    enabled: true,
    contentFilter: "beginner,intermediate,advanced",
  },
];

const DEFAULT_SETTINGS: TrainingSettings = {
  introVideoEnabled: true,
  introVideoUrl: "/intro.mp4",
  autoPlayIntro: true,
  showRubric: true,
  showMasteryStatus: true,
  showTrainerFeedback: true,
  requireLevelSelection: true,
};

// ============================================================================
// STORAGE KEYS
// ============================================================================
const STORAGE_KEYS = {
  modules: "pulse_admin_training_modules",
  levels: "pulse_admin_training_levels",
  settings: "pulse_admin_training_settings",
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function TrainingAdminPage() {
  const [activeTab, setActiveTab] = useState<"modules" | "levels" | "settings" | "analytics">("modules");
  const [experienceLevels, setExperienceLevels] = useState<ExperienceLevelConfig[]>(DEFAULT_EXPERIENCE_LEVELS);
  const [settings, setSettings] = useState<TrainingSettings>(DEFAULT_SETTINGS);
  const [hasChanges, setHasChanges] = useState(false);
  
  // PULSE Stages state (for editing)
  const [pulseStages, setPulseStages] = useState<PulseStage[]>(DEFAULT_PULSE_STAGES);
  const [stageVersions, setStageVersions] = useState<Record<number, StageVersion[]>>({});
  const [selectedStage, setSelectedStage] = useState<PulseStage | null>(null);
  const [showStageModal, setShowStageModal] = useState(false);
  
  // Video upload state
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Load from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedLevels = localStorage.getItem(STORAGE_KEYS.levels);
      if (savedLevels) {
        try {
          setExperienceLevels(JSON.parse(savedLevels));
        } catch {}
      }
      const savedSettings = localStorage.getItem(STORAGE_KEYS.settings);
      if (savedSettings) {
        try {
          setSettings(JSON.parse(savedSettings));
        } catch {}
      }
      // Load PULSE stages
      const savedStages = localStorage.getItem(STAGES_KEY);
      if (savedStages) {
        try {
          setPulseStages(JSON.parse(savedStages));
        } catch {}
      }
      const savedStageVersions = localStorage.getItem(STAGES_VERSIONS_KEY);
      if (savedStageVersions) {
        try {
          setStageVersions(JSON.parse(savedStageVersions));
        } catch {}
      }
    }
  }, []);

  const handleSaveAll = () => {
    localStorage.setItem(STORAGE_KEYS.levels, JSON.stringify(experienceLevels));
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
    setHasChanges(false);
  };

  // Open stage editor
  const openStageEditor = (stage: PulseStage) => {
    setSelectedStage(stage);
    setShowStageModal(true);
  };

  // Save stage changes
  const handleSaveStage = (stageNum: number, prompt: string, keyBehaviors: string[]) => {
    // Save current version to history
    const currentStage = pulseStages.find(s => s.stage === stageNum);
    if (currentStage) {
      const currentVersions = stageVersions[stageNum] || [];
      const newVersion: StageVersion = {
        version: currentVersions.length + 1,
        timestamp: new Date().toISOString(),
        keyBehaviors: currentStage.keyBehaviors,
        prompt: currentStage.prompt,
      };
      const updatedVersions = { ...stageVersions, [stageNum]: [...currentVersions, newVersion] };
      setStageVersions(updatedVersions);
      localStorage.setItem(STAGES_VERSIONS_KEY, JSON.stringify(updatedVersions));
    }

    // Update stage
    const updatedStages = pulseStages.map(s => 
      s.stage === stageNum ? { ...s, prompt, keyBehaviors } : s
    );
    setPulseStages(updatedStages);
    localStorage.setItem(STAGES_KEY, JSON.stringify(updatedStages));
    setShowStageModal(false);
  };

  const handleToggleLevel = (levelId: string) => {
    setExperienceLevels(prev => prev.map(l => 
      l.id === levelId ? { ...l, enabled: !l.enabled } : l
    ));
    setHasChanges(true);
  };

  const handleUpdateSettings = (key: keyof TrainingSettings, value: boolean | string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  // Video upload handlers
  const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/x-msvideo", "video/webm"];
  const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

  const validateVideoFile = (file: File): string | null => {
    if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
      return `Invalid file type: ${file.type}. Allowed types: MP4, MOV, AVI, WebM`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File too large: ${(file.size / (1024 * 1024)).toFixed(2)}MB. Maximum size is 100MB`;
    }
    return null;
  };

  const uploadVideo = async (file: File) => {
    setIsUploading(true);
    setUploadProgress(0);
    setUploadError(null);
    setUploadSuccess(false);

    // Validate file
    const validationError = validateVideoFile(file);
    if (validationError) {
      setUploadError(validationError);
      setIsUploading(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append("video", file);

      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const response = await fetch("/api/upload-video", {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Upload failed");
      }

      setUploadProgress(100);
      setUploadSuccess(true);
      
      // Update settings to ensure URL is correct
      handleUpdateSettings("introVideoUrl", "/intro.mp4");
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    // Prevent upload if already uploading
    if (isUploading) return;

    const files = e.dataTransfer.files;
    if (files.length > 1) {
      setUploadError("Please upload only one video file at a time");
      return;
    }
    if (files.length === 1) {
      uploadVideo(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Prevent upload if already uploading
    if (isUploading) return;

    const files = e.target.files;
    if (files && files.length > 1) {
      setUploadError("Please upload only one video file at a time");
      e.target.value = "";
      return;
    }
    if (files && files.length === 1) {
      uploadVideo(files[0]);
    }
    // Reset input so same file can be selected again
    e.target.value = "";
  };

  const getColorForStage = (stage: number) => {
    switch (stage) {
      case 1: return { bg: "bg-blue-500", light: "bg-blue-50", border: "border-blue-200", text: "text-blue-700" };
      case 2: return { bg: "bg-green-500", light: "bg-green-50", border: "border-green-200", text: "text-green-700" };
      case 3: return { bg: "bg-yellow-500", light: "bg-yellow-50", border: "border-yellow-200", text: "text-yellow-700" };
      case 4: return { bg: "bg-orange-500", light: "bg-orange-50", border: "border-orange-200", text: "text-orange-700" };
      case 5: return { bg: "bg-purple-500", light: "bg-purple-50", border: "border-purple-200", text: "text-purple-700" };
      default: return { bg: "bg-gray-500", light: "bg-gray-50", border: "border-gray-200", text: "text-gray-700" };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-gray-500 hover:text-gray-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold">Training Administration</h1>
            <p className="text-sm text-gray-500">Customize the PULSE training program</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/training"
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Preview Training →
          </Link>
          {hasChanges && (
            <button
              onClick={handleSaveAll}
              className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 transition-colors"
            >
              Save Changes
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {[
          { id: "modules" as const, label: "Training Modules", icon: "📚" },
          { id: "levels" as const, label: "Experience Levels", icon: "🎯" },
          { id: "settings" as const, label: "Settings", icon: "⚙️" },
          { id: "analytics" as const, label: "Analytics", icon: "📊" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              activeTab === tab.id
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {/* Training Modules Tab */}
        {activeTab === "modules" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">PULSE Training Modules</h2>
                <p className="text-sm text-gray-500">Click on any module to edit its content, key behaviors, and prompts</p>
              </div>
            </div>

            {/* Stage Progress Indicator */}
            <div className="flex items-center gap-2 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
              {pulseStages.map((stage, i) => (
                <div key={stage.stage} className="flex items-center">
                  <button 
                    onClick={() => openStageEditor(stage)}
                    className="flex flex-col items-center hover:scale-110 transition-transform cursor-pointer"
                  >
                    <div className={`w-10 h-10 rounded-full text-white flex items-center justify-center font-bold ${getColorForStage(stage.stage).bg}`}>
                      {stage.name.charAt(0)}
                    </div>
                    <div className="text-xs font-medium mt-1">{stage.name}</div>
                  </button>
                  {i < pulseStages.length - 1 && (
                    <div className="w-8 h-0.5 bg-gray-300 mx-1"></div>
                  )}
                </div>
              ))}
            </div>

            {/* Module Cards - Clickable */}
            <div className="space-y-3">
              {pulseStages.map((stage) => {
                const colors = getColorForStage(stage.stage);
                return (
                  <button
                    key={stage.stage}
                    onClick={() => openStageEditor(stage)}
                    className={`w-full text-left rounded-xl border-2 p-4 ${colors.border} ${colors.light} hover:shadow-lg hover:scale-[1.01] transition-all cursor-pointer`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-xl ${colors.bg} text-white flex items-center justify-center font-bold text-xl`}>
                        {stage.name.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900">{stage.name}</h3>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">
                              Stage {stage.stage}
                            </span>
                            {stageVersions[stage.stage]?.length > 0 && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                                v{stageVersions[stage.stage].length + 1}
                              </span>
                            )}
                          </div>
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                            Edit
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{stage.description}</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {stage.keyBehaviors.map((behavior: string, idx: number) => (
                            <span key={idx} className={`text-xs px-2 py-1 rounded-full ${colors.light} ${colors.text} border ${colors.border}`}>
                              {behavior}
                            </span>
                          ))}
                        </div>
                        <div className="mt-3 p-2 bg-gray-50 rounded text-xs font-mono text-gray-600 max-h-16 overflow-hidden">
                          {stage.prompt.substring(0, 120)}...
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Stage Edit Modal */}
        {selectedStage && (
          <StageEditModal
            stage={selectedStage}
            versions={stageVersions[selectedStage.stage] || []}
            isOpen={showStageModal}
            onClose={() => setShowStageModal(false)}
            onSave={handleSaveStage}
          />
        )}

        {/* Experience Levels Tab */}
        {activeTab === "levels" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Experience Levels</h2>
                <p className="text-sm text-gray-500">Configure available experience levels for trainees</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {experienceLevels.map((level) => (
                <div
                  key={level.id}
                  className={`rounded-xl border-2 p-4 transition-all ${
                    level.enabled ? "border-emerald-200 bg-emerald-50" : "border-gray-200 bg-gray-50 opacity-60"
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{level.icon}</span>
                      <h3 className="font-semibold text-gray-900">{level.name}</h3>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={level.enabled}
                        onChange={() => handleToggleLevel(level.id)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>
                  <p className="text-sm text-gray-600">{level.description}</p>
                  <div className="mt-3 text-xs text-gray-500">
                    Content filter: {level.contentFilter}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === "settings" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold">Training Settings</h2>
              <p className="text-sm text-gray-500">Configure global training program settings</p>
            </div>

            <div className="space-y-6">
              {/* Intro Video Settings */}
              <div className="border border-gray-200 rounded-xl p-4">
                <h3 className="font-medium text-gray-900 mb-4">Intro Video</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">Enable Intro Video</div>
                      <div className="text-xs text-gray-500">Show intro video on training page</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.introVideoEnabled}
                        onChange={(e) => handleUpdateSettings("introVideoEnabled", e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">Auto-play on First Visit</div>
                      <div className="text-xs text-gray-500">Automatically play video for new users</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.autoPlayIntro}
                        onChange={(e) => handleUpdateSettings("autoPlayIntro", e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                  
                  {/* Video Upload Section */}
                  <div className="pt-4 border-t border-gray-100">
                    <label className="block font-medium text-sm mb-2">Upload New Video</label>
                    <div
                      className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-all ${
                        isDragging 
                          ? "border-blue-500 bg-blue-50" 
                          : uploadError 
                            ? "border-red-300 bg-red-50"
                            : "border-gray-300 hover:border-gray-400"
                      }`}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                    >
                      {isUploading ? (
                        <div className="flex flex-col items-center">
                          <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-3"></div>
                          <p className="text-sm text-gray-600">Uploading video...</p>
                          {uploadProgress > 0 && (
                            <div className="w-full max-w-xs mt-2">
                              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-blue-600 transition-all duration-300"
                                  style={{ width: `${uploadProgress}%` }}
                                />
                              </div>
                              <p className="text-xs text-gray-500 mt-1">{uploadProgress}%</p>
                            </div>
                          )}
                        </div>
                      ) : uploadSuccess ? (
                        <div className="flex flex-col items-center">
                          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-3">
                            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <p className="text-sm font-medium text-green-700">Video uploaded successfully!</p>
                          <p className="text-xs text-gray-500 mt-1">The intro video has been replaced.</p>
                          <button
                            onClick={() => setUploadSuccess(false)}
                            className="mt-3 text-xs text-blue-600 hover:underline"
                          >
                            Upload another video
                          </button>
                        </div>
                      ) : (
                        <>
                          <input
                            type="file"
                            accept="video/mp4,video/quicktime,video/x-msvideo,video/webm"
                            onChange={handleFileSelect}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          />
                          <div className="flex flex-col items-center">
                            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                              </svg>
                            </div>
                            <p className="text-sm text-gray-600">
                              <span className="font-medium text-blue-600">Click to upload</span> or drag and drop
                            </p>
                            <p className="text-xs text-gray-500 mt-1">MP4, MOV, AVI, or WebM (max 100MB)</p>
                          </div>
                        </>
                      )}
                    </div>
                    
                    {/* Error Message */}
                    {uploadError && (
                      <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-start gap-2">
                          <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div>
                            <p className="text-sm font-medium text-red-700">Upload failed</p>
                            <p className="text-xs text-red-600 mt-0.5">{uploadError}</p>
                          </div>
                          <button
                            onClick={() => setUploadError(null)}
                            className="ml-auto text-red-400 hover:text-red-600"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    )}
                    
                    {/* Current Video Preview */}
                    <div className="mt-4">
                      <label className="block font-medium text-sm mb-2">Current Video</label>
                      <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-3">
                        <div className="w-10 h-10 rounded bg-gray-200 flex items-center justify-center">
                          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-700">intro.mp4</p>
                          <p className="text-xs text-gray-500">{settings.introVideoUrl}</p>
                        </div>
                        <a
                          href={settings.introVideoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Preview
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* UI Components Settings */}
              <div className="border border-gray-200 rounded-xl p-4">
                <h3 className="font-medium text-gray-900 mb-4">UI Components</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">Show Rubric</div>
                      <div className="text-xs text-gray-500">Display rubric in training sidebar</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.showRubric}
                        onChange={(e) => handleUpdateSettings("showRubric", e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">Show Mastery Status</div>
                      <div className="text-xs text-gray-500">Display mastery progress tracker</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.showMasteryStatus}
                        onChange={(e) => handleUpdateSettings("showMasteryStatus", e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">Show Trainer Feedback</div>
                      <div className="text-xs text-gray-500">Display trainer feedback section</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.showTrainerFeedback}
                        onChange={(e) => handleUpdateSettings("showTrainerFeedback", e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Onboarding Settings */}
              <div className="border border-gray-200 rounded-xl p-4">
                <h3 className="font-medium text-gray-900 mb-4">Onboarding</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">Require Level Selection</div>
                      <div className="text-xs text-gray-500">Users must select experience level before training</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.requireLevelSelection}
                        onChange={(e) => handleUpdateSettings("requireLevelSelection", e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === "analytics" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold">Training Analytics</h2>
              <p className="text-sm text-gray-500">View training program usage and performance metrics</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                <div className="text-2xl font-bold text-blue-700">0</div>
                <div className="text-sm text-blue-600">Total Trainees</div>
              </div>
              <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                <div className="text-2xl font-bold text-green-700">0</div>
                <div className="text-sm text-green-600">Completed Training</div>
              </div>
              <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
                <div className="text-2xl font-bold text-yellow-700">0</div>
                <div className="text-sm text-yellow-600">In Progress</div>
              </div>
              <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
                <div className="text-2xl font-bold text-purple-700">0%</div>
                <div className="text-sm text-purple-600">Avg. Mastery</div>
              </div>
            </div>

            <div className="border border-gray-200 rounded-xl p-6 text-center text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="text-sm">Analytics data will appear here once trainees start using the training program.</p>
              <p className="text-xs text-gray-400 mt-1">Connect to analytics backend to enable tracking</p>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
