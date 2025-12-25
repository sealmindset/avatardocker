"use client";

import { useEffect, useState, useRef } from "react";

type Props = {
  trustScore: number; // 0-10
  size?: "sm" | "md" | "lg";
  showLabels?: boolean;
};

export default function SentimentGauge({ 
  trustScore, 
  size = "md",
  showLabels = true,
}: Props) {
  const [animatedAngle, setAnimatedAngle] = useState(-90);
  const [jitter, setJitter] = useState(0);
  const jitterIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Map trust score (0-10) to angle (-90 to 90 degrees)
  // -90 = Frustrated (left), 0 = Engaged (center), 90 = Delighted (right)
  const targetAngle = ((trustScore / 10) * 180) - 90;
  
  // Animate the needle to target position
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedAngle(targetAngle);
    }, 100);
    return () => clearTimeout(timer);
  }, [targetAngle]);
  
  // Add continuous subtle jitter to make needle feel alive
  useEffect(() => {
    // Clear any existing interval
    if (jitterIntervalRef.current) {
      clearInterval(jitterIntervalRef.current);
    }
    
    // Create jitter effect - random small fluctuations
    jitterIntervalRef.current = setInterval(() => {
      // Random jitter between -3 and +3 degrees
      const newJitter = (Math.random() - 0.5) * 6;
      setJitter(newJitter);
    }, 150); // Update every 150ms for jumpy feel
    
    return () => {
      if (jitterIntervalRef.current) {
        clearInterval(jitterIntervalRef.current);
      }
    };
  }, []);
  
  // Size configurations
  const sizeConfig = {
    sm: { width: 120, height: 70, needleLength: 45, fontSize: "text-[8px]" },
    md: { width: 180, height: 100, needleLength: 65, fontSize: "text-[10px]" },
    lg: { width: 240, height: 130, needleLength: 85, fontSize: "text-xs" },
  };
  
  const config = sizeConfig[size];
  const centerX = config.width / 2;
  const centerY = config.height - 10;
  
  // Calculate needle end position (base angle + jitter)
  const displayAngle = animatedAngle + jitter;
  const needleAngle = (displayAngle * Math.PI) / 180;
  const needleX = centerX + Math.cos(needleAngle - Math.PI / 2) * config.needleLength;
  const needleY = centerY + Math.sin(needleAngle - Math.PI / 2) * config.needleLength;
  
  // Get sentiment label based on trust score
  const getSentimentLabel = () => {
    if (trustScore <= 3) return "Frustrated";
    if (trustScore <= 6) return "Engaged";
    return "Delighted";
  };
  
  const getSentimentColor = () => {
    if (trustScore <= 3) return "text-red-600";
    if (trustScore <= 6) return "text-yellow-600";
    return "text-green-600";
  };

  return (
    <div className="relative" style={{ width: config.width, height: config.height }}>
      <svg
        width={config.width}
        height={config.height}
        viewBox={`0 0 ${config.width} ${config.height}`}
        className="drop-shadow-lg"
      >
        {/* Background arc - gradient from red to yellow to green */}
        <defs>
          <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="30%" stopColor="#f97316" />
            <stop offset="50%" stopColor="#eab308" />
            <stop offset="70%" stopColor="#84cc16" />
            <stop offset="100%" stopColor="#22c55e" />
          </linearGradient>
          <filter id="gaugeShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.3"/>
          </filter>
        </defs>
        
        {/* Outer arc background */}
        <path
          d={`M ${centerX - config.needleLength - 10} ${centerY} 
              A ${config.needleLength + 10} ${config.needleLength + 10} 0 0 1 ${centerX + config.needleLength + 10} ${centerY}`}
          fill="none"
          stroke="rgba(255,255,255,0.3)"
          strokeWidth="20"
          strokeLinecap="round"
          filter="url(#gaugeShadow)"
        />
        
        {/* Colored arc */}
        <path
          d={`M ${centerX - config.needleLength} ${centerY} 
              A ${config.needleLength} ${config.needleLength} 0 0 1 ${centerX + config.needleLength} ${centerY}`}
          fill="none"
          stroke="url(#gaugeGradient)"
          strokeWidth="12"
          strokeLinecap="round"
        />
        
        {/* Needle */}
        <line
          x1={centerX}
          y1={centerY}
          x2={needleX}
          y2={needleY}
          stroke="#374151"
          strokeWidth="3"
          strokeLinecap="round"
          style={{
            transition: "all 0.1s ease-out",
          }}
        />
        
        {/* Needle base circle */}
        <circle
          cx={centerX}
          cy={centerY}
          r="6"
          fill="#374151"
        />
        <circle
          cx={centerX}
          cy={centerY}
          r="3"
          fill="#9ca3af"
        />
      </svg>
      
      {/* Labels */}
      {showLabels && (
        <>
          <span className={`absolute bottom-0 left-1 ${config.fontSize} font-medium text-red-600 drop-shadow-sm`}>
            Frustrated
          </span>
          <span className={`absolute top-0 left-1/2 -translate-x-1/2 ${config.fontSize} font-medium text-yellow-600 drop-shadow-sm`}>
            Engaged
          </span>
          <span className={`absolute bottom-0 right-1 ${config.fontSize} font-medium text-green-600 drop-shadow-sm`}>
            Delighted
          </span>
        </>
      )}
      
      {/* Current sentiment indicator */}
      <div className={`absolute -bottom-5 left-1/2 -translate-x-1/2 ${config.fontSize} font-bold ${getSentimentColor()} bg-white/80 px-2 py-0.5 rounded-full shadow-sm`}>
        {getSentimentLabel()}
      </div>
    </div>
  );
}
