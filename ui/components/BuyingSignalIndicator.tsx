"use client";

type Props = {
  strength: number; // 0-100
  readyToClose?: boolean;
  size?: "sm" | "md" | "lg";
};

export default function BuyingSignalIndicator({
  strength,
  readyToClose = false,
  size = "md",
}: Props) {
  // Size configurations
  const sizeConfig = {
    sm: { height: 6, fontSize: "text-[10px]", padding: "px-2 py-1" },
    md: { height: 8, fontSize: "text-xs", padding: "px-3 py-2" },
    lg: { height: 10, fontSize: "text-sm", padding: "px-4 py-2" },
  };

  const config = sizeConfig[size];

  // Get label based on strength
  const getLabel = () => {
    if (strength >= 80) return "Strong Intent";
    if (strength >= 60) return "High Interest";
    if (strength >= 40) return "Moderate";
    if (strength >= 20) return "Low Interest";
    return "Exploring";
  };

  // Get color based on strength
  const getColor = () => {
    if (strength >= 80) return "bg-green-500";
    if (strength >= 60) return "bg-green-400";
    if (strength >= 40) return "bg-yellow-400";
    if (strength >= 20) return "bg-orange-400";
    return "bg-gray-300";
  };

  // Get text color based on strength
  const getTextColor = () => {
    if (strength >= 60) return "text-green-600";
    if (strength >= 40) return "text-yellow-600";
    if (strength >= 20) return "text-orange-600";
    return "text-gray-500";
  };

  return (
    <div className={`bg-white/90 backdrop-blur rounded-lg shadow-sm border border-gray-200 ${config.padding}`}>
      <div className="flex items-center justify-between mb-1">
        <span className={`${config.fontSize} font-medium text-gray-600`}>Buying Signal</span>
        <div className="flex items-center gap-1">
          {readyToClose && (
            <span className="flex items-center gap-0.5 text-green-600">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className={`${config.fontSize} font-semibold`}>Ready!</span>
            </span>
          )}
          {!readyToClose && (
            <span className={`${config.fontSize} font-semibold ${getTextColor()}`}>
              {getLabel()}
            </span>
          )}
        </div>
      </div>

      {/* Progress bar visualization */}
      <div className="relative">
        <div
          className="w-full bg-gray-200 rounded-full overflow-hidden"
          style={{ height: config.height }}
        >
          <div
            className={`h-full rounded-full transition-all duration-500 ${getColor()}`}
            style={{ width: `${Math.min(100, Math.max(0, strength))}%` }}
          />
        </div>
        {/* Threshold markers */}
        <div className="absolute inset-0 flex">
          <div className="w-1/5 border-r border-gray-300/50" />
          <div className="w-1/5 border-r border-gray-300/50" />
          <div className="w-1/5 border-r border-gray-300/50" />
          <div className="w-1/5 border-r border-gray-300/50" />
          <div className="w-1/5" />
        </div>
      </div>

      {/* Percentage label */}
      <div className={`mt-1 text-right ${config.fontSize} text-gray-400`}>
        {strength}%
      </div>
    </div>
  );
}
