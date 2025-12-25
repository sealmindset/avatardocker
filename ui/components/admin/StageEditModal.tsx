"use client";

import { useState, useEffect } from "react";

// ============================================================================
// TYPES
// ============================================================================
export interface PulseStage {
  stage: number;
  name: string;
  description: string;
  keyBehaviors: string[];
  prompt: string;
}

export interface StageVersion {
  version: number;
  timestamp: string;
  keyBehaviors: string[];
  prompt: string;
}

interface PromptAnalysis {
  wordCount: number;
  hasPersonaReference: boolean;
  hasRoleDefinition: boolean;
  hasBehaviorGuidelines: boolean;
  hasResponseFormat: boolean;
  hasContextAwareness: boolean;
  hasToneGuidance: boolean;
  warnings: string[];
}

// ============================================================================
// STORAGE KEYS
// ============================================================================
export const STAGES_KEY = "pulse_stages";
export const STAGES_VERSIONS_KEY = "pulse_stage_versions";

// ============================================================================
// DEFAULT PULSE STAGES
// ============================================================================
export const DEFAULT_PULSE_STAGES: PulseStage[] = [
  {
    stage: 1,
    name: "Probe",
    description: "Initial greeting, building rapport, discovering customer needs",
    keyBehaviors: ["Greeting", "Open-ended questions", "Active listening"],
    prompt: `STAGE 1: PROBE - Initial Discovery

OBJECTIVE:
Establish rapport and begin discovering the customer's needs through genuine curiosity.

TRAINEE SHOULD:
1. Greet the customer warmly and professionally
2. Use open-ended questions to understand why they're visiting
3. Practice active listening - acknowledge what they share
4. Avoid jumping to product pitches too early
5. Build initial trust through authentic engagement

DETECTION CRITERIA:
- Customer has been greeted appropriately
- At least one discovery question has been asked
- Customer has shared initial reason for visit

ADVANCEMENT TO STAGE 2:
Move to Understand when customer has shared specific sleep issues or needs.`,
  },
  {
    stage: 2,
    name: "Understand",
    description: "Deep dive into customer's situation, pain points, emotional reasons",
    keyBehaviors: ["Empathy", "Paraphrasing", "Identifying hot buttons"],
    prompt: `STAGE 2: UNDERSTAND - Deep Discovery

OBJECTIVE:
Uncover the emotional drivers and pain points behind the customer's needs.

TRAINEE SHOULD:
1. Show genuine empathy for customer's sleep challenges
2. Paraphrase what the customer shares to confirm understanding
3. Identify "hot buttons" - emotional triggers that drive decisions
4. Ask follow-up questions to go deeper
5. Connect sleep issues to quality of life impacts

DETECTION CRITERIA:
- Trainee has demonstrated empathy
- Customer's pain points have been acknowledged
- Emotional reasons for purchase are being explored

ADVANCEMENT TO STAGE 3:
Move to Link when emotional hot buttons have been identified.`,
  },
  {
    stage: 3,
    name: "Link",
    description: "Connecting product features to customer's specific needs",
    keyBehaviors: ["Feature-benefit linking", "Mini-talks", "Ownership language"],
    prompt: `STAGE 3: LINK - Connecting Solutions

OBJECTIVE:
Connect Sleep Number features directly to the customer's specific needs and desires.

TRAINEE SHOULD:
1. Link product features to customer's stated pain points
2. Use "mini-talks" to explain benefits concisely
3. Employ ownership language ("your bed", "when you wake up")
4. Reference the customer's specific situation
5. Build value before discussing price

DETECTION CRITERIA:
- Features have been connected to customer needs
- Benefits are personalized to the customer
- Ownership language is being used

ADVANCEMENT TO STAGE 4:
Move to Solve when product recommendations have been made.`,
  },
  {
    stage: 4,
    name: "Solve",
    description: "Presenting solutions, handling objections, demonstrating value",
    keyBehaviors: ["Objection handling (LERA)", "Financing options", "Value building"],
    prompt: `STAGE 4: SOLVE - Addressing Concerns

OBJECTIVE:
Handle objections professionally and demonstrate the full value proposition.

TRAINEE SHOULD:
1. Use LERA framework for objections (Listen, Empathize, Respond, Ask)
2. Present financing options when price concerns arise
3. Continue building value through benefits
4. Address concerns without being defensive
5. Keep the conversation moving toward commitment

DETECTION CRITERIA:
- Objections are being handled professionally
- Value is being reinforced
- Customer concerns are being addressed

ADVANCEMENT TO STAGE 5:
Move to Earn when major objections have been addressed.`,
  },
  {
    stage: 5,
    name: "Earn",
    description: "Closing the sale, asking for commitment, finalizing the purchase",
    keyBehaviors: ["Assumptive close", "Professional recommendation", "3T's close"],
    prompt: `STAGE 5: EARN - Closing with Confidence

OBJECTIVE:
Confidently ask for the sale and guide the customer to commitment.

TRAINEE SHOULD:
1. Use assumptive closing language
2. Make a professional recommendation based on the conversation
3. Apply the 3T's close (Today, Tomorrow, Together)
4. Handle final hesitations with confidence
5. Celebrate the customer's decision

DETECTION CRITERIA:
- A clear ask for commitment has been made
- Professional recommendation has been given
- Customer is being guided toward decision

SALE OUTCOME:
Evaluate whether the sale was won or lost based on customer response.`,
  },
];

// ============================================================================
// ANALYZE PROMPT FUNCTION
// ============================================================================
function analyzePrompt(content: string): PromptAnalysis {
  const warnings: string[] = [];
  const lowerContent = content.toLowerCase();
  
  const hasPersonaReference = /persona|director|relater|socializer|thinker|customer|role/i.test(content);
  const hasRoleDefinition = /you are|your role|act as|behave as/i.test(content);
  const hasBehaviorGuidelines = /guideline|behavior|should|must|always|never/i.test(content);
  const hasResponseFormat = /format|response|return|output|json/i.test(content);
  const hasContextAwareness = /context|conversation|previous|history|remember/i.test(content);
  const hasToneGuidance = /tone|emotion|feeling|mood|attitude|manner/i.test(content);
  
  if (!hasRoleDefinition) warnings.push("Missing role definition (e.g., 'You are...')");
  if (!hasBehaviorGuidelines) warnings.push("No behavior guidelines found");
  if (!hasResponseFormat) warnings.push("Response format not specified");
  if (content.length < 100) warnings.push("Prompt may be too short for effective guidance");
  if (content.length > 5000) warnings.push("Prompt is very long - consider condensing");
  if (lowerContent.includes("todo") || lowerContent.includes("fixme")) warnings.push("Contains TODO/FIXME markers");
  
  return {
    wordCount: content.split(/\s+/).filter(w => w.length > 0).length,
    hasPersonaReference,
    hasRoleDefinition,
    hasBehaviorGuidelines,
    hasResponseFormat,
    hasContextAwareness,
    hasToneGuidance,
    warnings,
  };
}

// ============================================================================
// STAGE EDIT MODAL COMPONENT
// ============================================================================
interface StageEditModalProps {
  stage: PulseStage;
  versions: StageVersion[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (stageNum: number, prompt: string, keyBehaviors: string[]) => void;
}

export function StageEditModal({ stage, versions, isOpen, onClose, onSave }: StageEditModalProps) {
  const [editedPrompt, setEditedPrompt] = useState(stage.prompt);
  const [editedBehaviors, setEditedBehaviors] = useState<string[]>(stage.keyBehaviors);
  const [newBehavior, setNewBehavior] = useState("");
  const [hasChanges, setHasChanges] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [analysis, setAnalysis] = useState<PromptAnalysis | null>(null);

  useEffect(() => {
    setEditedPrompt(stage.prompt);
    setEditedBehaviors(stage.keyBehaviors);
    setHasChanges(false);
    setShowAnalysis(false);
    setShowConfirm(false);
    setAnalysis(null);
    setNewBehavior("");
  }, [stage]);

  if (!isOpen) return null;

  const checkChanges = (prompt: string, behaviors: string[]) => {
    const promptChanged = prompt !== stage.prompt;
    const behaviorsChanged = JSON.stringify(behaviors) !== JSON.stringify(stage.keyBehaviors);
    setHasChanges(promptChanged || behaviorsChanged);
  };

  const handlePromptChange = (value: string) => {
    setEditedPrompt(value);
    checkChanges(value, editedBehaviors);
    setShowAnalysis(false);
    setAnalysis(null);
  };

  const addBehavior = () => {
    if (newBehavior.trim() && !editedBehaviors.includes(newBehavior.trim())) {
      const updated = [...editedBehaviors, newBehavior.trim()];
      setEditedBehaviors(updated);
      setNewBehavior("");
      checkChanges(editedPrompt, updated);
    }
  };

  const removeBehavior = (index: number) => {
    const updated = editedBehaviors.filter((_, i) => i !== index);
    setEditedBehaviors(updated);
    checkChanges(editedPrompt, updated);
  };

  const handleAnalyze = () => {
    const result = analyzePrompt(editedPrompt);
    setAnalysis(result);
    setShowAnalysis(true);
  };

  const handleProceedToConfirm = () => {
    if (!analysis) {
      handleAnalyze();
    }
    setShowConfirm(true);
  };

  const handleConfirmSave = () => {
    onSave(stage.stage, editedPrompt, editedBehaviors);
    setHasChanges(false);
    setShowConfirm(false);
    setShowAnalysis(false);
  };

  const handleRevert = (version: StageVersion) => {
    setEditedPrompt(version.prompt);
    setEditedBehaviors(version.keyBehaviors);
    checkChanges(version.prompt, version.keyBehaviors);
    setShowVersions(false);
    setShowAnalysis(false);
    setAnalysis(null);
  };

  const stageColors = ["", "bg-blue-500", "bg-green-500", "bg-yellow-500", "bg-orange-500", "bg-purple-500"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full ${stageColors[stage.stage]} text-white flex items-center justify-center font-bold`}>
              {stage.stage}
            </div>
            <div>
              <h2 className="text-xl font-semibold">{stage.name}</h2>
              <span className="text-xs text-gray-500">{stage.description}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {versions.length > 0 && (
              <button
                onClick={() => setShowVersions(!showVersions)}
                className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                v{versions.length + 1}
              </button>
            )}
            <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full" aria-label="Close">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Version History Dropdown */}
        {showVersions && versions.length > 0 && (
          <div className="border-b bg-gray-100 p-3 max-h-40 overflow-y-auto">
            <div className="text-xs font-medium text-gray-600 mb-2">Version History</div>
            <div className="space-y-1">
              {[...versions].reverse().map((v) => (
                <button
                  key={v.version}
                  onClick={() => handleRevert(v)}
                  className="w-full text-left px-3 py-2 text-sm bg-white rounded hover:bg-blue-50 flex justify-between items-center"
                >
                  <span>Version {v.version}</span>
                  <span className="text-xs text-gray-500">{new Date(v.timestamp).toLocaleString()}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Key Behaviors Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Key Behaviors (Tags)
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {editedBehaviors.map((behavior, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gray-100 text-sm"
                >
                  {behavior}
                  <button
                    onClick={() => removeBehavior(idx)}
                    className="ml-1 text-gray-500 hover:text-red-500"
                    aria-label={`Remove ${behavior}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newBehavior}
                onChange={(e) => setNewBehavior(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addBehavior()}
                placeholder="Add new behavior..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-sm"
              />
              <button
                onClick={addBehavior}
                disabled={!newBehavior.trim()}
                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
          </div>

          {/* Prompt Content */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Stage Prompt
            </label>
            <textarea
              value={editedPrompt}
              onChange={(e) => handlePromptChange(e.target.value)}
              className="w-full h-64 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent font-mono text-sm resize-none"
              placeholder="Enter stage prompt..."
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>{editedPrompt.split(/\s+/).filter(w => w.length > 0).length} words</span>
              <span>{editedPrompt.length} characters</span>
            </div>
          </div>

          {/* Analysis Section */}
          {showAnalysis && analysis && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-blue-50 px-4 py-2 border-b flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <span className="font-medium text-blue-800">Prompt Analysis</span>
              </div>
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    {analysis.hasRoleDefinition ? (
                      <span className="text-green-600">✓</span>
                    ) : (
                      <span className="text-red-500">✗</span>
                    )}
                    <span>Role Definition</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {analysis.hasBehaviorGuidelines ? (
                      <span className="text-green-600">✓</span>
                    ) : (
                      <span className="text-red-500">✗</span>
                    )}
                    <span>Behavior Guidelines</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {analysis.hasResponseFormat ? (
                      <span className="text-green-600">✓</span>
                    ) : (
                      <span className="text-amber-500">!</span>
                    )}
                    <span>Response Format</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {analysis.hasContextAwareness ? (
                      <span className="text-green-600">✓</span>
                    ) : (
                      <span className="text-gray-400">○</span>
                    )}
                    <span>Context Awareness</span>
                  </div>
                </div>

                {analysis.warnings.length > 0 && (
                  <div className="mt-3 p-3 bg-amber-50 rounded-lg">
                    <div className="text-sm font-medium text-amber-800 mb-1">Warnings</div>
                    <ul className="text-sm text-amber-700 space-y-1">
                      {analysis.warnings.map((w, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-amber-500">⚠</span>
                          {w}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="text-xs text-gray-500 pt-2 border-t">
                  Word count: {analysis.wordCount} | ✓ = Present | ✗ = Missing | ○ = Optional | ! = Suggested
                </div>
              </div>
            </div>
          )}

          {/* Confirmation Dialog */}
          {showConfirm && (
            <div className="border-2 border-blue-300 rounded-lg overflow-hidden bg-blue-50">
              <div className="px-4 py-3 flex items-center gap-2 border-b border-blue-200">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-medium text-blue-800">Confirm Save</span>
              </div>
              <div className="p-4">
                <p className="text-sm text-gray-700 mb-4">
                  Are you sure you want to save these changes? This will create a new version of Stage {stage.stage}: {stage.name}.
                </p>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setShowConfirm(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-white text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmSave}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                  >
                    Confirm &amp; Save
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-500">
              {hasChanges && <span className="text-amber-600">● Unsaved changes</span>}
            </div>
            {hasChanges && !showAnalysis && (
              <button
                onClick={handleAnalyze}
                className="px-3 py-1.5 text-sm border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Analyze
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={handleProceedToConfirm}
              disabled={!hasChanges || showConfirm}
              className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
