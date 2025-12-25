"use client";

import { useEffect, useState } from "react";

type Props = {
  level: number; // 1-5 scale
  trend?: "rising" | "falling" | "stable";
};

export default function EngagementOverlay({ level, trend = "stable" }: Props) {
  const [animatedLevel, setAnimatedLevel] = useState(level);

  // Smooth animation when level changes
  useEffect(() => {
    const duration = 800; // ms
    const startLevel = animatedLevel;
    const endLevel = level;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedLevel(startLevel + (endLevel - startLevel) * eased);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [level]);

  // Calculate position (1=bottom/100%, 5=top/0%)
  // Level 1 = 85% from top, Level 5 = 15% from top
  const linePosition = 85 - ((animatedLevel - 1) / 4) * 70;

  // Get gradient colors based on level
  const getGradientColors = () => {
    if (animatedLevel <= 2) {
      // Disengaged - Red gradient
      return {
        line: "from-red-600 via-red-500 to-red-600",
        glow: "rgba(239, 68, 68, 0.8)",
        gradient: "from-red-600/50 via-red-500/30 to-transparent",
        pulse: "bg-red-500",
      };
    } else if (animatedLevel <= 3.5) {
      // Partial engagement - Yellow/Orange gradient
      return {
        line: "from-amber-500 via-yellow-400 to-amber-500",
        glow: "rgba(245, 158, 11, 0.8)",
        gradient: "from-amber-500/50 via-yellow-400/30 to-transparent",
        pulse: "bg-amber-400",
      };
    } else {
      // Full engagement - Green gradient
      return {
        line: "from-emerald-500 via-green-400 to-emerald-500",
        glow: "rgba(16, 185, 129, 0.8)",
        gradient: "from-emerald-500/50 via-green-400/30 to-transparent",
        pulse: "bg-green-400",
      };
    }
  };

  const colors = getGradientColors();

  // Get label based on level
  const getLabel = () => {
    if (animatedLevel <= 1.5) return "Disengaged";
    if (animatedLevel <= 2.5) return "Losing Interest";
    if (animatedLevel <= 3.5) return "Neutral";
    if (animatedLevel <= 4.5) return "Interested";
    return "Fully Engaged";
  };

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-30">
      {/* Gradient fill from line to bottom */}
      <div
        className={`absolute left-0 right-0 bottom-0 bg-gradient-to-t ${colors.gradient} transition-all duration-700`}
        style={{
          top: `${linePosition}%`,
        }}
      />

      {/* The floating line */}
      <div
        className="absolute left-0 right-0 transition-all duration-700 ease-out"
        style={{
          top: `${linePosition}%`,
          transform: "translateY(-50%)",
        }}
      >
        {/* Outer glow effect */}
        <div
          className="absolute left-0 right-0 h-6 blur-xl opacity-70"
          style={{
            background: colors.glow,
            top: "-10px",
          }}
        />

        {/* Inner glow effect */}
        <div
          className="absolute left-0 right-0 h-3 blur-md opacity-90"
          style={{
            background: colors.glow,
            top: "-4px",
          }}
        />

        {/* Main gradient line - ultra thin but bright */}
        <div
          className={`w-full bg-gradient-to-r ${colors.line} opacity-80`}
          style={{
            height: '0.5px',
            boxShadow: `0 0 6px 1px ${colors.glow}, 0 0 15px 3px ${colors.glow}, 0 0 30px 6px ${colors.glow}, 0 0 60px 12px ${colors.glow}`,
          }}
        />

        {/* Animated shimmer effect along the line */}
        <div className="absolute inset-0 overflow-hidden" style={{ height: '0.5px' }}>
          <div
            className={`absolute h-full w-40 ${colors.pulse} opacity-90 blur-[1px]`}
            style={{
              animation: "shimmer 3s ease-in-out infinite",
              left: "-128px",
            }}
          />
        </div>
        <style jsx>{`
          @keyframes shimmer {
            0% { transform: translateX(0); opacity: 0; }
            10% { opacity: 0.8; }
            90% { opacity: 0.8; }
            100% { transform: translateX(calc(100vw + 128px)); opacity: 0; }
          }
        `}</style>

        {/* Trend indicator arrow */}
        {trend !== "stable" && (
          <div
            className={`absolute right-4 flex items-center transition-all duration-300 ${
              trend === "rising" ? "-top-6 animate-bounce" : "top-2 animate-bounce"
            }`}
            style={{
              animationDuration: "1.5s",
            }}
          >
            <svg
              className={`w-5 h-5 ${
                trend === "rising" ? "text-green-400 rotate-0" : "text-red-400 rotate-180"
              }`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        )}

        {/* Label badge */}
        <div
          className="absolute left-4 -top-8 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-sm border transition-all duration-500"
          style={{
            backgroundColor:
              animatedLevel <= 2
                ? "rgba(239, 68, 68, 0.3)"
                : animatedLevel <= 3.5
                ? "rgba(245, 158, 11, 0.3)"
                : "rgba(16, 185, 129, 0.3)",
            borderColor:
              animatedLevel <= 2
                ? "rgba(239, 68, 68, 0.5)"
                : animatedLevel <= 3.5
                ? "rgba(245, 158, 11, 0.5)"
                : "rgba(16, 185, 129, 0.5)",
            color:
              animatedLevel <= 2
                ? "rgb(254, 202, 202)"
                : animatedLevel <= 3.5
                ? "rgb(254, 243, 199)"
                : "rgb(167, 243, 208)",
          }}
        >
          {getLabel()}
        </div>
      </div>

      {/* Side glow effects */}
      <div
        className="absolute left-0 w-1 transition-all duration-700"
        style={{
          top: `${linePosition}%`,
          bottom: 0,
          background: `linear-gradient(to bottom, ${colors.glow}, transparent)`,
        }}
      />
      <div
        className="absolute right-0 w-1 transition-all duration-700"
        style={{
          top: `${linePosition}%`,
          bottom: 0,
          background: `linear-gradient(to bottom, ${colors.glow}, transparent)`,
        }}
      />
    </div>
  );
}
