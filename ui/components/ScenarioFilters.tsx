"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/components/SessionContext";

// PULSE Selling steps (P – Probe, U – Understand, L – Link, S – Simplify, E – Earn)
const STEPS = [
  "1: Probe",
  "2: Understand",
  "3: Link",
  "4: Simplify",
  "5: Earn",
];

const OBJECTIONS = ["Price (C2)", "Comfort", "Absent Partner"];
const FRAMEWORKS = ["CECAP", "LERA", "3T's"];

// Framework acronym definitions
const FRAMEWORK_INFO = {
  CECAP: {
    name: "CECAP",
    description: "A framework for handling emotional objections and building trust through empathy.",
    letters: [
      { letter: "C", word: "Clarify", description: "Ask clarifying questions to understand the real concern" },
      { letter: "E", word: "Empathize", description: "Show genuine understanding of their feelings" },
      { letter: "C", word: "Check", description: "Verify you understand their concern correctly" },
      { letter: "A", word: "Address", description: "Provide a thoughtful response to their concern" },
      { letter: "P", word: "Proceed", description: "Move forward with the conversation" },
    ],
  },
  LERA: {
    name: "LERA",
    description: "A structured approach for overcoming price and value objections.",
    letters: [
      { letter: "L", word: "Listen", description: "Actively listen to the full objection without interrupting" },
      { letter: "E", word: "Empathize", description: "Acknowledge their concern and show understanding" },
      { letter: "R", word: "Respond", description: "Address the objection with value-focused solutions" },
      { letter: "A", word: "Ask", description: "Confirm the objection is resolved and ask to proceed" },
    ],
  },
  "3T's": {
    name: "3T's Close",
    description: "A closing technique that creates urgency and commitment.",
    letters: [
      { letter: "T", word: "Today", description: "Emphasize the benefits of deciding today" },
      { letter: "T", word: "Tomorrow", description: "Highlight what they might miss by waiting" },
      { letter: "T", word: "Together", description: "Partner with them to make the decision together" },
    ],
  },
};

function FrameworkModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold">Sales Frameworks</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(80vh-120px)] space-y-6">
          {Object.values(FRAMEWORK_INFO).map((fw) => (
            <div key={fw.name} className="rounded-lg border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <h3 className="font-semibold text-lg">{fw.name}</h3>
                <p className="text-sm text-gray-600 mt-1">{fw.description}</p>
              </div>
              <div className="p-4 space-y-2">
                {fw.letters.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-bold text-sm">
                      {item.letter}
                    </div>
                    <div className="flex-1 pt-1">
                      <span className="font-medium">{item.word}</span>
                      <span className="text-gray-600"> — {item.description}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full py-2 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ScenarioFilters() {
  const { filters, setFilters } = useSession();
  const [step, setStep] = useState<string>(filters.step ?? "");
  const [objection, setObjection] = useState<string>(filters.objection ?? "");
  const [framework, setFramework] = useState<string>(filters.framework ?? "");
  const [showFrameworkModal, setShowFrameworkModal] = useState(false);

  useEffect(() => {
    setFilters({ step, objection, framework });
  }, [step, objection, framework, setFilters]);

  return (
    <div className="space-y-3 rounded border border-gray-200 p-4">
      <div className="font-medium">Scenario Filters</div>
      <label className="block text-sm">
        <span className="text-gray-700">PULSE Step</span>
        <select
          className="mt-1 w-full rounded border border-gray-300 p-2"
          value={step}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStep(e.target.value)}
        >
          <option value="">All</option>
          {STEPS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        <span className="text-gray-700">Objection Type</span>
        <select
          className="mt-1 w-full rounded border border-gray-300 p-2"
          value={objection}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setObjection(e.target.value)}
        >
          <option value="">All</option>
          {OBJECTIONS.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </label>

      <div className="block text-sm">
        <div className="flex items-center gap-2">
          <span className="text-gray-700">Framework</span>
          <button
            type="button"
            onClick={() => setShowFrameworkModal(true)}
            className="p-0.5 hover:bg-gray-100 rounded-full transition-colors"
            title="Frameworks"
            aria-label="Frameworks"
          >
            <svg className="w-4 h-4 text-gray-500 hover:text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        </div>
        <select
          className="mt-1 w-full rounded border border-gray-300 p-2"
          value={framework}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFramework(e.target.value)}
        >
          <option value="">All</option>
          {FRAMEWORKS.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </div>

      <FrameworkModal 
        isOpen={showFrameworkModal} 
        onClose={() => setShowFrameworkModal(false)} 
      />
    </div>
  );
}
