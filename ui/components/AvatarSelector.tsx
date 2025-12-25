"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ImageCarousel } from "./ImageCarousel";

/**
 * AvatarSelector Component
 * 
 * Allows selecting an avatar for a persona from the ModelScope LiteAvatarGallery.
 * Integrates with the database API to persist avatar selections.
 * Supports preloading avatars into the LRU cache for faster session starts.
 */

interface AvatarInfo {
  id: string;
  name: string;
  gender: "female" | "male";
  style: string;
  thumbnail_url?: string;
  downloaded: boolean;
}

interface PersonaAvatarConfig {
  persona_key: string;
  avatar_id: string | null;
  avatar_gender: "female" | "male";
  avatar_style: string;
  avatar_randomize: boolean;
}

interface AvatarSelectorProps {
  personaKey: string;
  initialAvatarId?: string | null;
  initialGender?: "female" | "male";
  initialStyle?: string;
  initialRandomize?: boolean;
  onAvatarChange?: (avatarId: string | null, gender: "female" | "male") => void;
  onSave?: (config: PersonaAvatarConfig) => void;
  showSaveButton?: boolean;
  disabled?: boolean;
  compact?: boolean;
}

export function AvatarSelector({
  personaKey,
  initialAvatarId = null,
  initialGender = "female",
  initialStyle = "casual",
  initialRandomize = false,
  onAvatarChange,
  onSave,
  showSaveButton = true,
  disabled = false,
  compact = false,
}: AvatarSelectorProps) {
  // State
  const [avatarId, setAvatarId] = useState<string | null>(initialAvatarId);
  const [gender, setGender] = useState<"female" | "male">(initialGender);
  const [style, setStyle] = useState<string>(initialStyle);
  const [randomize, setRandomize] = useState<boolean>(initialRandomize);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Avatar catalog
  const [availableAvatars, setAvailableAvatars] = useState<AvatarInfo[]>([]);
  const [loadingAvatars, setLoadingAvatars] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Saving state
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // Preload state
  const [preloading, setPreloading] = useState(false);
  const [preloadStatus, setPreloadStatus] = useState<string | null>(null);

  // Fetch available avatars from the avatar service
  const fetchAvatars = useCallback(async () => {
    setLoadingAvatars(true);
    setError(null);
    try {
      // Try the catalog endpoint first (ModelScope avatars)
      const response = await fetch("/api/orchestrator/avatars/catalog");
      if (response.ok) {
        const data = await response.json();
        setAvailableAvatars(data.avatars || []);
      } else {
        // Fallback to local avatars
        const localResponse = await fetch("/api/avatars/local");
        if (localResponse.ok) {
          const localData = await localResponse.json();
          setAvailableAvatars(localData.avatars || []);
        } else {
          setError("Failed to load avatars");
        }
      }
    } catch (err) {
      console.error("Failed to fetch avatars:", err);
      setError("Failed to load avatars");
    } finally {
      setLoadingAvatars(false);
    }
  }, []);

  // Fetch avatars on mount
  useEffect(() => {
    fetchAvatars();
  }, [fetchAvatars]);

  // Update local state when props change
  useEffect(() => {
    setAvatarId(initialAvatarId);
    setGender(initialGender);
    setStyle(initialStyle);
    setRandomize(initialRandomize);
    setHasChanges(false);
  }, [initialAvatarId, initialGender, initialStyle, initialRandomize]);

  // Handle avatar selection
  const handleAvatarSelect = (avatar: AvatarInfo) => {
    setAvatarId(avatar.id);
    setStyle(avatar.style);
    setHasChanges(true);
    setSaveSuccess(false);
    onAvatarChange?.(avatar.id, gender);
  };

  // Handle gender change
  const handleGenderChange = (newGender: "female" | "male") => {
    setGender(newGender);
    setHasChanges(true);
    setSaveSuccess(false);
    // Clear avatar selection when gender changes
    setAvatarId(null);
    onAvatarChange?.(null, newGender);
  };

  // Handle randomize toggle
  const handleRandomizeToggle = () => {
    setRandomize(!randomize);
    setHasChanges(true);
    setSaveSuccess(false);
  };

  // Save avatar configuration to database
  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    setError(null);
    
    try {
      const config: PersonaAvatarConfig = {
        persona_key: personaKey,
        avatar_id: avatarId,
        avatar_gender: gender,
        avatar_style: style,
        avatar_randomize: randomize,
      };
      
      const response = await fetch(`/api/personas/${personaKey}/avatar`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to save avatar configuration");
      }
      
      setHasChanges(false);
      setSaveSuccess(true);
      onSave?.(config);
      
      // Auto-hide success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);
      
    } catch (err) {
      console.error("Failed to save avatar:", err);
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  // Preload avatar into cache
  const handlePreload = async () => {
    if (!avatarId) return;
    
    setPreloading(true);
    setPreloadStatus("Preloading avatar...");
    
    try {
      const response = await fetch("/api/orchestrator/avatar/preload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar_ids: [avatarId] }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setPreloadStatus(`✓ Preloaded (${data.loaded?.length || 0} loaded)`);
      } else {
        setPreloadStatus("✗ Preload failed");
      }
    } catch (err) {
      console.error("Preload failed:", err);
      setPreloadStatus("✗ Preload failed");
    } finally {
      setPreloading(false);
      // Clear status after 3 seconds
      setTimeout(() => setPreloadStatus(null), 3000);
    }
  };

  // Filter avatars by gender
  const filteredAvatars = availableAvatars.filter(a => a.gender === gender);

  // Convert to carousel format
  const carouselItems = filteredAvatars.map(a => ({
    id: a.id,
    name: a.name,
    thumbnailUrl: a.thumbnail_url,
    gender: a.gender,
    style: a.style,
  }));

  // Find selected avatar name for display
  const selectedAvatar = availableAvatars.find(a => a.id === avatarId);

  return (
    <div className={`${disabled ? "opacity-50 pointer-events-none" : ""}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className={`font-semibold text-gray-800 ${compact ? "text-sm" : "text-base"}`}>
          Avatar Selection
        </h3>
        <div className="flex items-center gap-2">
          {/* Randomize Toggle */}
          <label className="flex items-center gap-2 text-xs text-gray-600">
            <span>Randomize</span>
            <button
              onClick={handleRandomizeToggle}
              disabled={disabled}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                randomize ? "bg-green-500" : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  randomize ? "translate-x-4" : "translate-x-1"
                }`}
              />
            </button>
          </label>
        </div>
      </div>

      {/* Randomize Info */}
      {randomize && (
        <div className="mb-3 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-800">
          <strong>Random Mode:</strong> Avatar will be randomly selected from {gender} avatars each session.
        </div>
      )}

      {/* Gender Selection */}
      <div className="mb-4">
        <label className={`block font-medium text-gray-700 mb-1 ${compact ? "text-xs" : "text-sm"}`}>
          Gender
        </label>
        <div className="flex gap-2">
          <button
            onClick={() => handleGenderChange("female")}
            disabled={disabled}
            className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
              gender === "female"
                ? "bg-pink-100 border-pink-400 text-pink-800"
                : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}
          >
            👩 Female
          </button>
          <button
            onClick={() => handleGenderChange("male")}
            disabled={disabled}
            className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
              gender === "male"
                ? "bg-blue-100 border-blue-400 text-blue-800"
                : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}
          >
            👨 Male
          </button>
        </div>
      </div>

      {/* Avatar Carousel */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className={`font-medium text-gray-700 ${compact ? "text-xs" : "text-sm"}`}>
            Avatar {randomize && <span className="text-gray-400 text-xs">(default)</span>}
          </label>
          {selectedAvatar && (
            <span className="text-xs text-purple-600 font-medium">
              Selected: {selectedAvatar.name}
            </span>
          )}
        </div>
        
        {loadingAvatars ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
            <span className="ml-2 text-sm text-gray-500">Loading avatars...</span>
          </div>
        ) : error ? (
          <div className="text-center py-4 text-red-500 text-sm">
            {error}
            <button
              onClick={fetchAvatars}
              className="ml-2 text-purple-600 hover:underline"
            >
              Retry
            </button>
          </div>
        ) : (
          <ImageCarousel
            items={carouselItems}
            selectedId={avatarId || ""}
            onSelect={(item) => {
              const avatar = filteredAvatars.find(a => a.id === item.id);
              if (avatar) handleAvatarSelect(avatar);
            }}
            itemsPerView={compact ? 3 : 4}
            disabled={randomize || disabled}
            emptyMessage={`No ${gender} avatars available. Download from Avatar Manager.`}
          />
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Preload Button */}
          {avatarId && !randomize && (
            <button
              onClick={handlePreload}
              disabled={preloading || disabled}
              className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {preloading ? "Preloading..." : "🚀 Preload"}
            </button>
          )}
          
          {/* Preload Status */}
          {preloadStatus && (
            <span className={`text-xs ${preloadStatus.startsWith("✓") ? "text-green-600" : "text-red-600"}`}>
              {preloadStatus}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Save Success */}
          {saveSuccess && (
            <span className="text-xs text-green-600">✓ Saved</span>
          )}
          
          {/* Error */}
          {error && !loadingAvatars && (
            <span className="text-xs text-red-600">{error}</span>
          )}
          
          {/* Save Button */}
          {showSaveButton && (
            <button
              onClick={handleSave}
              disabled={!hasChanges || saving || disabled}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                hasChanges && !saving
                  ? "bg-purple-600 hover:bg-purple-700 text-white"
                  : "bg-gray-200 text-gray-500 cursor-not-allowed"
              }`}
            >
              {saving ? "Saving..." : "Save Avatar"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to fetch persona avatar configuration from database
 */
export function usePersonaAvatar(personaKey: string) {
  const [config, setConfig] = useState<PersonaAvatarConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/personas/${personaKey}/avatar`);
        if (response.ok) {
          const data = await response.json();
          setConfig(data);
        } else if (response.status === 404) {
          // Persona not found in database, use defaults
          setConfig(null);
        } else {
          throw new Error("Failed to fetch avatar config");
        }
      } catch (err) {
        console.error("Failed to fetch persona avatar:", err);
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    };

    if (personaKey) {
      fetchConfig();
    }
  }, [personaKey]);

  return { config, loading, error, refetch: () => setConfig(null) };
}

export default AvatarSelector;
