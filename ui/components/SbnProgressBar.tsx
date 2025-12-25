"use client";

type Props = {
  currentStep: 1 | 2 | 3 | 4 | 5;
};

// PULSE Selling framework steps
// P – Probe, U – Understand, L – Link, S – Simplify, E – Earn
const STEPS = ["Probe", "Understand", "Link", "Simplify", "Earn"] as const;

export default function PulseProgressBar({ currentStep }: Props) {
  return (
    <ol className="grid grid-cols-5 gap-2 text-xs">
      {STEPS.map((label, idx) => {
        const step = (idx + 1) as Props["currentStep"];
        const active = step === currentStep;
        return (
          <li
            key={label}
            className={`rounded border px-2 py-2 text-center ${
              active ? "border-black bg-black text-white" : "border-gray-200 bg-gray-50 text-gray-700"
            }`}
            aria-current={active ? "step" : undefined}
          >
            <div className="font-medium">Step {step}</div>
            <div>{label}</div>
          </li>
        );
      })}
    </ol>
  );
}
