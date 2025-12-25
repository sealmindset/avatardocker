"use client";

type Props = {
  level: number; // 1-5 scale
  trend?: "rising" | "falling" | "stable";
  size?: "sm" | "md" | "lg";
};

export default function EngagementGauge({
  level,
  trend = "stable",
  size = "md",
}: Props) {
  // Size configurations
  const sizeConfig = {
    sm: { barHeight: 6, fontSize: "text-[10px]", gap: "gap-0.5", padding: "px-2 py-1" },
    md: { barHeight: 8, fontSize: "text-xs", gap: "gap-1", padding: "px-3 py-2" },
    lg: { barHeight: 10, fontSize: "text-sm", gap: "gap-1.5", padding: "px-4 py-2" },
  };

  const config = sizeConfig[size];

  // Get label based on level
  const getLabel = () => {
    switch (level) {
      case 1: return "Disengaged";
      case 2: return "Distracted";
      case 3: return "Neutral";
      case 4: return "Interested";
      case 5: return "Engaged";
      default: return "Neutral";
    }
  };

  // Get color based on level
  const getBarColor = (barIndex: number) => {
    if (barIndex > level) return "bg-gray-200";
    if (level <= 2) return "bg-red-400";
    if (level === 3) return "bg-yellow-400";
    return "bg-green-400";
  };

  // Get trend icon
  const getTrendIcon = () => {
    if (trend === "rising") {
      return (
        <svg className="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
      );
    }
    if (trend === "falling") {
      return (
        <svg className="w-3 h-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      );
    }
    return (
      <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
      </svg>
    );
  };

  return (
    <div className={`bg-white/90 backdrop-blur rounded-lg shadow-sm border border-gray-200 ${config.padding}`}>
      <div className="flex items-center justify-between mb-1">
        <span className={`${config.fontSize} font-medium text-gray-600`}>Engagement</span>
        <div className="flex items-center gap-1">
          {getTrendIcon()}
          <span className={`${config.fontSize} font-semibold ${
            level <= 2 ? "text-red-600" : level === 3 ? "text-yellow-600" : "text-green-600"
          }`}>
            {getLabel()}
          </span>
        </div>
      </div>

      {/* Bar visualization */}
      <div className={`flex ${config.gap}`}>
        {[1, 2, 3, 4, 5].map((barIndex) => (
          <div
            key={barIndex}
            className={`flex-1 rounded-sm transition-all duration-300 ${getBarColor(barIndex)}`}
            style={{ height: config.barHeight }}
          />
        ))}
      </div>
    </div>
  );
}
