"use client";

import { useSession } from "@/components/SessionContext";

const PERSONAS = [
  { key: "director", name: "Director", blurb: "Decisive, results-focused, impatient with delays." },
  { key: "relater", name: "Relater", blurb: "Warm, relationship-driven, values trust and rapport." },
  { key: "socializer", name: "Socializer", blurb: "Expressive, enthusiastic, responds to energy and stories." },
  { key: "thinker", name: "Thinker", blurb: "Cautious, analytical, requires detail and logic." },
];

export default function PersonaSelector() {
  const { persona, setPersona } = useSession();

  const handleSelect = (key: string) => {
    console.log("[PersonaSelector] Selected persona:", key);
    setPersona(key);
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {PERSONAS.map((p) => (
        <button
          key={p.key}
          onClick={() => handleSelect(p.key)}
          className={`rounded border p-4 text-left transition hover:shadow ${
            persona === p.key ? "border-black ring-2 ring-black" : "border-gray-200"
          }`}
        >
          <div className="font-medium">{p.name}</div>
          <p className="mt-1 text-sm text-gray-600">{p.blurb}</p>
        </button>
      ))}
    </div>
  );
}
