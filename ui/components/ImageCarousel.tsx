"use client";

import React, { useState, useRef, useEffect } from "react";

interface CarouselItem {
  id: string;
  name: string;
  thumbnailUrl?: string;
  description?: string;
  gender?: "female" | "male";
  style?: string;
}

interface ImageCarouselProps {
  items: CarouselItem[];
  selectedId: string;
  onSelect: (item: CarouselItem) => void;
  title?: string;
  itemsPerView?: number;
  showNames?: boolean;
  disabled?: boolean;
  emptyMessage?: string;
}

export function ImageCarousel({
  items,
  selectedId,
  onSelect,
  title,
  itemsPerView = 4,
  showNames = true,
  disabled = false,
  emptyMessage = "No items available",
}: ImageCarouselProps) {
  const [scrollIndex, setScrollIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const maxScrollIndex = Math.max(0, items.length - itemsPerView);

  const scrollLeft = () => {
    setScrollIndex((prev) => Math.max(0, prev - 1));
  };

  const scrollRight = () => {
    setScrollIndex((prev) => Math.min(maxScrollIndex, prev + 1));
  };

  useEffect(() => {
    const selectedIndex = items.findIndex((item) => item.id === selectedId);
    if (selectedIndex >= 0) {
      const targetScroll = Math.max(0, Math.min(selectedIndex - 1, maxScrollIndex));
      setScrollIndex(targetScroll);
    }
  }, [selectedId, items, maxScrollIndex]);

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={`relative ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
      {title && (
        <div className="text-sm font-medium text-gray-700 mb-2">{title}</div>
      )}

      <div className="relative flex items-center">
        {/* Left Arrow */}
        <button
          onClick={scrollLeft}
          disabled={scrollIndex === 0}
          className={`absolute left-0 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white shadow-lg border border-gray-200 transition-all ${
            scrollIndex === 0
              ? "opacity-30 cursor-not-allowed"
              : "hover:bg-gray-50 hover:shadow-xl"
          }`}
          style={{ transform: "translateX(-50%)" }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Carousel Container */}
        <div
          ref={containerRef}
          className="flex-1 overflow-hidden mx-4"
        >
          <div
            className="flex gap-3 transition-transform duration-300 ease-out"
            style={{
              transform: `translateX(-${scrollIndex * (100 / itemsPerView + 3)}%)`,
            }}
          >
            {items.map((item) => (
              <div
                key={item.id}
                onClick={() => !disabled && onSelect(item)}
                className={`flex-shrink-0 cursor-pointer transition-all duration-200 ${
                  disabled ? "cursor-not-allowed" : ""
                }`}
                style={{ width: `calc(${100 / itemsPerView}% - 12px)` }}
              >
                <div
                  className={`relative rounded-lg overflow-hidden border-2 transition-all ${
                    selectedId === item.id
                      ? "border-purple-500 ring-2 ring-purple-200 shadow-lg scale-105"
                      : "border-gray-200 hover:border-gray-400 hover:shadow-md"
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="aspect-square bg-gray-100 relative">
                    {item.thumbnailUrl ? (
                      <img
                        src={item.thumbnailUrl}
                        alt={item.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "/placeholder-avatar.png";
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-3xl bg-gradient-to-br from-purple-100 to-pink-100">
                        {item.gender === "female" ? "👩" : "👨"}
                      </div>
                    )}

                    {/* Selected Checkmark */}
                    {selectedId === item.id && (
                      <div className="absolute top-1 right-1 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Name */}
                  {showNames && (
                    <div className={`px-2 py-1.5 text-center text-xs font-medium truncate ${
                      selectedId === item.id ? "bg-purple-50 text-purple-700" : "bg-white text-gray-700"
                    }`}>
                      {item.name}
                      {item.style && (
                        <span className="text-gray-400 ml-1">({item.style})</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Arrow */}
        <button
          onClick={scrollRight}
          disabled={scrollIndex >= maxScrollIndex}
          className={`absolute right-0 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white shadow-lg border border-gray-200 transition-all ${
            scrollIndex >= maxScrollIndex
              ? "opacity-30 cursor-not-allowed"
              : "hover:bg-gray-50 hover:shadow-xl"
          }`}
          style={{ transform: "translateX(50%)" }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Pagination Dots */}
      {items.length > itemsPerView && (
        <div className="flex justify-center gap-1 mt-3">
          {Array.from({ length: maxScrollIndex + 1 }).map((_, i) => (
            <button
              key={i}
              onClick={() => setScrollIndex(i)}
              className={`w-2 h-2 rounded-full transition-all ${
                i === scrollIndex ? "bg-purple-500 w-4" : "bg-gray-300 hover:bg-gray-400"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface VoiceCarouselItem {
  id: string;
  name: string;
  gender: "female" | "male";
  provider: string;
  style: string;
  description?: string;
}

interface VoiceCarouselProps {
  items: VoiceCarouselItem[];
  selectedId: string;
  onSelect: (item: VoiceCarouselItem) => void;
  title?: string;
  itemsPerView?: number;
  disabled?: boolean;
  emptyMessage?: string;
}

export function VoiceCarousel({
  items,
  selectedId,
  onSelect,
  title,
  itemsPerView = 5,
  disabled = false,
  emptyMessage = "No voices available",
}: VoiceCarouselProps) {
  const [scrollIndex, setScrollIndex] = useState(0);

  const maxScrollIndex = Math.max(0, items.length - itemsPerView);

  const scrollLeft = () => {
    setScrollIndex((prev) => Math.max(0, prev - 1));
  };

  const scrollRight = () => {
    setScrollIndex((prev) => Math.min(maxScrollIndex, prev + 1));
  };

  useEffect(() => {
    const selectedIndex = items.findIndex((item) => item.id === selectedId);
    if (selectedIndex >= 0) {
      const targetScroll = Math.max(0, Math.min(selectedIndex - 1, maxScrollIndex));
      setScrollIndex(targetScroll);
    }
  }, [selectedId, items, maxScrollIndex]);

  if (items.length === 0) {
    return (
      <div className="text-center py-4 text-gray-500 text-sm">
        {emptyMessage}
      </div>
    );
  }

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case "edge": return "🎙️";
      case "openai": return "🤖";
      case "elevenlabs": return "🎧";
      case "piper": return "🔊";
      default: return "🔈";
    }
  };

  const getProviderColor = (provider: string) => {
    switch (provider) {
      case "edge": return "bg-blue-100 text-blue-700";
      case "openai": return "bg-green-100 text-green-700";
      case "elevenlabs": return "bg-purple-100 text-purple-700";
      case "piper": return "bg-orange-100 text-orange-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className={`relative ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
      {title && (
        <div className="text-sm font-medium text-gray-700 mb-2">{title}</div>
      )}

      <div className="relative flex items-center">
        {/* Left Arrow */}
        <button
          onClick={scrollLeft}
          disabled={scrollIndex === 0}
          className={`absolute left-0 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white shadow-lg border border-gray-200 transition-all ${
            scrollIndex === 0
              ? "opacity-30 cursor-not-allowed"
              : "hover:bg-gray-50 hover:shadow-xl"
          }`}
          style={{ transform: "translateX(-50%)" }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Carousel Container */}
        <div className="flex-1 overflow-hidden mx-4">
          <div
            className="flex gap-2 transition-transform duration-300 ease-out"
            style={{
              transform: `translateX(-${scrollIndex * (100 / itemsPerView + 2)}%)`,
            }}
          >
            {items.map((item) => (
              <div
                key={item.id}
                onClick={() => !disabled && onSelect(item)}
                className={`flex-shrink-0 cursor-pointer transition-all duration-200 ${
                  disabled ? "cursor-not-allowed" : ""
                }`}
                style={{ width: `calc(${100 / itemsPerView}% - 8px)` }}
              >
                <div
                  className={`rounded-lg border-2 p-2 transition-all ${
                    selectedId === item.id
                      ? "border-purple-500 bg-purple-50 shadow-md"
                      : "border-gray-200 bg-white hover:border-gray-400 hover:shadow-sm"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getProviderIcon(item.provider)}</span>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium truncate ${
                        selectedId === item.id ? "text-purple-700" : "text-gray-800"
                      }`}>
                        {item.name}
                      </div>
                      <div className="text-xs text-gray-500 truncate">{item.style}</div>
                    </div>
                    {selectedId === item.id && (
                      <div className="w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className={`mt-1 text-xs px-1.5 py-0.5 rounded inline-block ${getProviderColor(item.provider)}`}>
                    {item.provider}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Arrow */}
        <button
          onClick={scrollRight}
          disabled={scrollIndex >= maxScrollIndex}
          className={`absolute right-0 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white shadow-lg border border-gray-200 transition-all ${
            scrollIndex >= maxScrollIndex
              ? "opacity-30 cursor-not-allowed"
              : "hover:bg-gray-50 hover:shadow-xl"
          }`}
          style={{ transform: "translateX(50%)" }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Pagination Dots */}
      {items.length > itemsPerView && (
        <div className="flex justify-center gap-1 mt-2">
          {Array.from({ length: maxScrollIndex + 1 }).map((_, i) => (
            <button
              key={i}
              onClick={() => setScrollIndex(i)}
              className={`w-2 h-2 rounded-full transition-all ${
                i === scrollIndex ? "bg-purple-500 w-4" : "bg-gray-300 hover:bg-gray-400"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
