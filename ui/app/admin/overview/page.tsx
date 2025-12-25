"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { ImageCarousel, VoiceCarousel } from "@/components/ImageCarousel";

// ============================================================================
// TYPES
// ============================================================================
interface PersonaVersion {
  version: number;
  timestamp: string;
  data: Persona;
}

interface Persona {
  id: string;
  name: string;
  difficulty: string;
  description: string;
  avatar: {
    character: string;
    style: string;
    voice: string;
    voiceStyle: string;
    gender: "female" | "male";
    randomize: boolean;  // If true, randomly select avatar/voice each session
  };
  introText: string;
  greetings: string[];
  systemPromptSummary: string;
  color: string;
}

interface ScoringCriterion {
  name: string;
  points: number;
}

interface EvaluatorAgent {
  id: string;
  name: string;
  type: string;
  description: string;
  weight: number | null;
  focusArea?: string;
  scoringCriteria?: ScoringCriterion[];
  responsibilities?: string[];
}

interface ScoringWeights {
  bce: number;
  mcf: number;
  cpo: number;
  passingThreshold: number;
}

interface AgentConfigVersion {
  version: number;
  timestamp: string;
  weights: ScoringWeights;
  evaluators: Record<string, ScoringCriterion[]>;
}

// ============================================================================
// LITEAVATAR MODELS AND VOICES CONFIGURATION
// These are the available avatar models and TTS voices for personas
// ============================================================================

// LiteAvatar available models with gender classification
interface AvatarModel {
  id: string;
  name: string;
  gender: "female" | "male";
  style: string;
  description: string;
}

const AVATAR_MODELS: AvatarModel[] = [
  { id: "lisa", name: "Lisa", gender: "female", style: "casual-sitting", description: "Professional woman, casual sitting pose" },
  { id: "amy", name: "Amy", gender: "female", style: "standing", description: "Young professional woman, standing" },
  { id: "sarah", name: "Sarah", gender: "female", style: "business", description: "Business woman, formal attire" },
  { id: "emma", name: "Emma", gender: "female", style: "casual", description: "Casual young woman" },
  { id: "michael", name: "Michael", gender: "male", style: "business", description: "Business man, formal attire" },
  { id: "david", name: "David", gender: "male", style: "casual", description: "Casual young man" },
  { id: "james", name: "James", gender: "male", style: "professional", description: "Professional man, neutral pose" },
];

// TTS Voices with gender classification
// Using Piper TTS - local neural text-to-speech (no cloud API required)
interface VoiceOption {
  id: string;
  name: string;
  gender: "female" | "male";
  provider: "piper";
  style: string;
  description: string;
  model: string; // Piper model filename
  downloaded: boolean; // Whether the model is currently available
}

// Piper TTS voices - all run locally, no cloud API needed
// See: https://github.com/rhasspy/piper/blob/master/VOICES.md
const VOICE_OPTIONS_FULL: VoiceOption[] = [
  // US English - Female voices
  { id: "amy", name: "Amy", gender: "female", provider: "piper", style: "medium", description: "Clear American female voice", model: "en_US-amy-medium", downloaded: true },
  { id: "lessac", name: "Lessac", gender: "female", provider: "piper", style: "high", description: "High quality American female", model: "en_US-lessac-high", downloaded: false },
  { id: "libritts", name: "LibriTTS", gender: "female", provider: "piper", style: "high", description: "Natural American female", model: "en_US-libritts-high", downloaded: false },
  { id: "ljspeech", name: "LJ Speech", gender: "female", provider: "piper", style: "medium", description: "Classic American female", model: "en_US-ljspeech-medium", downloaded: false },
  // US English - Male voices  
  { id: "ryan", name: "Ryan", gender: "male", provider: "piper", style: "medium", description: "Clear American male voice", model: "en_US-ryan-medium", downloaded: false },
  { id: "joe", name: "Joe", gender: "male", provider: "piper", style: "medium", description: "Casual American male", model: "en_US-joe-medium", downloaded: false },
  { id: "kusal", name: "Kusal", gender: "male", provider: "piper", style: "medium", description: "Professional American male", model: "en_US-kusal-medium", downloaded: false },
  // British English
  { id: "alan", name: "Alan", gender: "male", provider: "piper", style: "medium", description: "British male voice", model: "en_GB-alan-medium", downloaded: false },
  { id: "alba", name: "Alba", gender: "female", provider: "piper", style: "medium", description: "British female voice", model: "en_GB-alba-medium", downloaded: false },
  { id: "cori", name: "Cori", gender: "female", provider: "piper", style: "high", description: "High quality British female", model: "en_GB-cori-high", downloaded: false },
];

// Legacy format for backward compatibility
const AVATAR_OPTIONS = AVATAR_MODELS.map(m => ({
  value: `${m.id} / ${m.style}`,
  label: `${m.name} / ${m.style.charAt(0).toUpperCase() + m.style.slice(1).replace('-', ' ')}`,
  gender: m.gender,
}));

const VOICE_OPTIONS = VOICE_OPTIONS_FULL.map(v => ({
  value: v.id,
  label: v.name,
  style: v.style,
  gender: v.gender,
}));

// Helper functions for random selection
function getRandomAvatarByGender(gender: "female" | "male"): AvatarModel {
  const filtered = AVATAR_MODELS.filter(m => m.gender === gender);
  return filtered[Math.floor(Math.random() * filtered.length)];
}

function getRandomVoiceByGender(gender: "female" | "male"): VoiceOption {
  const filtered = VOICE_OPTIONS_FULL.filter(v => v.gender === gender);
  return filtered[Math.floor(Math.random() * filtered.length)];
}

function getRandomAvatarVoicePair(gender?: "female" | "male"): { avatar: AvatarModel; voice: VoiceOption } {
  const selectedGender = gender || (Math.random() > 0.5 ? "female" : "male");
  return {
    avatar: getRandomAvatarByGender(selectedGender),
    voice: getRandomVoiceByGender(selectedGender),
  };
}

const STORAGE_KEY = "pulse_personas";
const VERSIONS_KEY = "pulse_persona_versions";
const AGENT_CONFIG_KEY = "pulse_agent_config";
const AGENT_VERSIONS_KEY = "pulse_agent_versions";
const PROMPTS_KEY = "pulse_prompts";
const PROMPTS_VERSIONS_KEY = "pulse_prompt_versions";
const STAGES_KEY = "pulse_stages";
const STAGES_VERSIONS_KEY = "pulse_stage_versions";

// Prompt types
interface PromptData {
  id: string;
  title: string;
  type: string;
  description: string;
  usedBy: string;
  content: string;
}

interface PromptVersion {
  version: number;
  timestamp: string;
  content: string;
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

// PULSE Stage types
interface PulseStage {
  stage: number;
  name: string;
  description: string;
  keyBehaviors: string[];
  prompt: string;
}

interface StageVersion {
  version: number;
  timestamp: string;
  keyBehaviors: string[];
  prompt: string;
}

// Default scoring weights
const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  bce: 40,
  mcf: 35,
  cpo: 25,
  passingThreshold: 85,
};

// Default scoring criteria for each evaluator
const DEFAULT_EVALUATOR_CRITERIA: Record<string, ScoringCriterion[]> = {
  bce: [
    { name: "Platinum Rule Adaptation", points: 40 },
    { name: "Empathy and Trust Building", points: 30 },
    { name: "CECAP/LERA Emotional Application", points: 30 },
  ],
  mcf: [
    { name: "Discovery Capture", points: 30 },
    { name: "Mini-Talk/Chunking", points: 30 },
    { name: "Accessory Integration", points: 25 },
    { name: "Closing Foundation", points: 15 },
  ],
  cpo: [
    { name: "Urgency & FOMO", points: 30 },
    { name: "Closing Framework", points: 35 },
    { name: "Handling Financial Tension", points: 25 },
    { name: "Ownership Language", points: 10 },
  ],
};

// ============================================================================
// DEFAULT PERSONAS - Customer behavior styles based on the Platinum Rule
// ============================================================================
const DEFAULT_PERSONAS: Persona[] = [
  {
    id: "director",
    name: "Director",
    difficulty: "Expert/High Pressure",
    description: "Direct, results-oriented, impatient, values efficiency and bottom-line results",
    avatar: {
      character: "lisa",
      style: "casual-sitting",
      voice: "amy",
      voiceStyle: "medium",
      gender: "female",
      randomize: true,  // Randomly select avatar/voice each session
    },
    introText: "Hello. I'm here to look at your products. Let's get started.",
    greetings: [
      "Hello. I'm here to look at your products. Let's get started.",
      "I don't have much time. Show me your best options.",
      "Let's cut to the chase. What do you have?",
    ],
    systemPromptSummary: "High-pressure customer who demands efficiency and facts. Tests trainee's ability to be brief and assertive.",
    color: "red",
  },
  {
    id: "relater",
    name: "Relater",
    difficulty: "Beginner/Empathy Focused",
    description: "Warm, patient, relationship-focused, values trust and personal connection",
    avatar: {
      character: "lisa",
      style: "casual-sitting",
      voice: "en-US-SaraNeural",
      voiceStyle: "friendly",
      gender: "female",
      randomize: true,
    },
    introText: "Hi there! I've been thinking about making a purchase and wanted to chat.",
    greetings: [
      "Hi there! I've been thinking about making a purchase and wanted to chat.",
      "Hello! I hope I'm not bothering you. Do you have a moment?",
      "Hi! My friend recommended I come here. She said you're really helpful.",
    ],
    systemPromptSummary: "Hesitant customer who needs trust and empathy. Tests trainee's ability to build rapport and show patience.",
    color: "green",
  },
  {
    id: "socializer",
    name: "Socializer",
    difficulty: "Moderate/Enthusiasm Focused",
    description: "Enthusiastic, talkative, optimistic, values recognition and social interaction",
    avatar: {
      character: "lisa",
      style: "casual-sitting",
      voice: "en-US-AriaNeural",
      voiceStyle: "cheerful",
      gender: "female",
      randomize: true,
    },
    introText: "Hey! I'm so excited to be here! I've heard great things about you!",
    greetings: [
      "Hey! I'm so excited to be here! I've heard great things about you!",
      "Oh wow, this place is amazing! I just had to come check it out!",
      "Hi! My friends raved about their experience here. I can't wait to see what you have!",
    ],
    systemPromptSummary: "Energetic customer who gets easily distracted. Tests trainee's ability to maintain focus and enthusiasm.",
    color: "yellow",
  },
  {
    id: "thinker",
    name: "Thinker",
    difficulty: "Challenging/Logic Focused",
    description: "Analytical, detail-oriented, cautious, values accuracy and logical reasoning",
    avatar: {
      character: "lisa",
      style: "casual-sitting",
      voice: "en-US-MichelleNeural",
      voiceStyle: "calm",
      gender: "female",
      randomize: true,
    },
    introText: "Good afternoon. I've done some research and have a few questions.",
    greetings: [
      "Good afternoon. I've done some research and have a few questions.",
      "Hello. I've been comparing options online. Can you explain your specifications?",
      "Hi. I'd like to understand the technical details before making any decisions.",
    ],
    systemPromptSummary: "Analytical customer who scrutinizes every claim. Tests trainee's product knowledge and logical reasoning.",
    color: "blue",
  },
];

// ============================================================================
// AGENTS - Evaluation agents for scoring trainee performance
// ============================================================================
const AGENTS = [
  {
    id: "orchestrator",
    name: "Chief Behavioral Certification Lead",
    type: "orchestrator",
    description: "Primary agent that manages evaluation workflow and compiles the final Behavioral Certification Score",
    weight: null,
    responsibilities: [
      "Distribute transcript to all sub-agents",
      "Aggregate scores and feedback",
      "Calculate weighted average (BCE 40%, MCF 35%, CPO 25%)",
      "Determine pass/fail based on 85% threshold",
    ],
  },
  {
    id: "bce",
    name: "Behavioral Compliance Evaluator (BCE)",
    type: "evaluator",
    description: "Scores trainee's mastery of the Platinum Rule and emotional engagement",
    weight: 0.40,
    focusArea: "Step 1: Connect & Discover",
    scoringCriteria: [
      { name: "Platinum Rule Adaptation", points: 40 },
      { name: "Empathy and Trust Building", points: 30 },
      { name: "CECAP/LERA Emotional Application", points: 30 },
    ],
  },
  {
    id: "mcf",
    name: "Methodology & Content Fidelity Checker (MCF)",
    type: "evaluator",
    description: "Verifies mandatory execution of PULSE steps and communication tools",
    weight: 0.35,
    focusArea: "PULSE Steps 1-4",
    scoringCriteria: [
      { name: "Discovery Capture", points: 30 },
      { name: "Mini-Talk/Chunking", points: 30 },
      { name: "Accessory Integration", points: 25 },
      { name: "Closing Foundation", points: 15 },
    ],
  },
  {
    id: "cpo",
    name: "Conversion & Psychological Outcome Assessor (CPO)",
    type: "evaluator",
    description: "Assesses deployment of psychological levers to drive conversion",
    weight: 0.25,
    focusArea: "Step 4: Address Concerns & Close Today",
    scoringCriteria: [
      { name: "Urgency & FOMO", points: 30 },
      { name: "Closing Framework", points: 35 },
      { name: "Handling Financial Tension", points: 25 },
      { name: "Ownership Language", points: 10 },
    ],
  },
];

// ============================================================================
// PROMPTS - System prompts used throughout the platform
// ============================================================================
const DEFAULT_PROMPTS: PromptData[] = [
  {
    id: "pulse-customer-persona",
    title: "PULSE Customer Persona",
    type: "system",
    description: "Base system prompt for AI customer in sales training simulation",
    usedBy: "Chat endpoint - persona conversations",
    content: `YOUR ROLE: You are a CUSTOMER shopping for a mattress at a Sleep Number store.
The person talking to you (the user) is a SALES TRAINEE practicing their sales skills.

CRITICAL ROLE CLARIFICATION:
- YOU are the CUSTOMER - you are being SOLD TO
- The USER is the SALESPERSON/TRAINEE - they are trying to sell you a mattress
- DO NOT act like a salesperson or trainer
- DO NOT ask the user why they came to the store - YOU are the one shopping
- DO NOT offer to help the user find a mattress - THEY should be helping YOU
- WAIT for the salesperson to ask you questions and guide the conversation
- RESPOND to their questions about your sleep needs, budget, and preferences

SETTING: You have walked into a Sleep Number store because you've been experiencing sleep issues (back pain, restless nights, partner disturbance, or general discomfort).

CUSTOMER BEHAVIOR:
- Answer questions the salesperson asks you
- Share your sleep problems when asked
- Ask questions about the products they show you
- Express concerns about price, quality, or features
- React naturally to their sales approach (good or bad)

PERSONA: {{persona_type}}
- Director: Direct customer, time-conscious. Wants quick answers about value and pricing.
- Relater: Warm customer, relationship-focused. Wants to trust the salesperson first.
- Socializer: Enthusiastic customer, talkative. Excited about technology and features.
- Thinker: Analytical customer, detail-oriented. Needs data and specifications.

REMEMBER: You are the CUSTOMER waiting to be helped, NOT the salesperson helping someone.`,
  },
  {
    id: "pulse-evaluator",
    title: "PULSE Evaluator Orchestrator",
    type: "system",
    description: "System prompt for the evaluation orchestrator agent",
    usedBy: "Feedback endpoint - session scoring",
    content: `You are the Chief Behavioral Certification Lead for PULSE sales training evaluation.

ROLE DEFINITION:
You orchestrate the evaluation of sales training sessions by coordinating three specialized evaluators:
- BCE (Behavioral Compliance Evaluator): 40% weight
- MCF (Methodology & Content Fidelity Checker): 35% weight
- CPO (Conversion & Psychological Outcome Assessor): 25% weight

EVALUATION PROCESS:
1. Receive the complete conversation transcript
2. Distribute to each sub-evaluator for specialized scoring
3. Aggregate scores using weighted average
4. Determine pass/fail based on 85% threshold
5. Compile comprehensive feedback report

SCORING GUIDELINES:
- Each evaluator scores 0-100 in their domain
- Final score = (BCE × 0.40) + (MCF × 0.35) + (CPO × 0.25)
- Pass threshold: 85%
- Provide specific examples from transcript for each score

OUTPUT FORMAT:
Return structured JSON with scores, feedback, and recommendations.`,
  },
  {
    id: "pulse-stage-detector",
    title: "PULSE Stage Detector",
    type: "system",
    description: "Detects which PULSE stage (1-5) the conversation is in",
    usedBy: "Chat endpoint - stage progression",
    content: `You analyze sales conversations to detect the current PULSE methodology stage.

PULSE STAGES:
1. PROBE - Initial greeting, rapport building, discovering needs
2. UNDERSTAND - Deep dive into pain points, emotional drivers
3. LINK - Connecting product features to customer needs
4. SOLVE - Presenting solutions, handling objections
5. EARN - Closing the sale, asking for commitment

DETECTION CRITERIA:
Stage 1→2: Customer has shared specific sleep issues or needs
Stage 2→3: Associate has identified emotional hot buttons
Stage 3→4: Product recommendations have been made
Stage 4→5: Objections addressed, moving toward close

RESPONSE FORMAT:
Return JSON: {"stage": 1-5, "confidence": 0.0-1.0, "reason": "brief explanation"}

Be conservative - only advance stages when clear evidence exists.`,
  },
  {
    id: "misstep-detector",
    title: "Misstep Detector",
    type: "system",
    description: "Detects critical sales missteps that can cause sale loss",
    usedBy: "Chat endpoint - trust tracking",
    content: `You detect critical sales missteps that damage customer trust.

MISSTEP CATEGORIES:
1. PUSHY_BEHAVIOR (-15 trust): Aggressive closing, ignoring objections
2. IGNORING_CONCERNS (-20 trust): Dismissing customer worries
3. POOR_LISTENING (-10 trust): Not acknowledging what customer said
4. PRICE_FOCUS_EARLY (-10 trust): Discussing price before value
5. BREAKING_RAPPORT (-15 trust): Rude, dismissive, or condescending

DETECTION GUIDELINES:
- Analyze the latest associate message
- Consider conversation context
- Look for tone and intent, not just keywords
- Be fair - not every imperfect response is a misstep

RESPONSE FORMAT:
Return JSON: {"detected": true/false, "type": "category", "severity": 1-3, "reason": "explanation"}

Only flag genuine missteps that would realistically damage a sale.`,
  },
  {
    id: "inappropriate-remarks-detector",
    title: "Inappropriate Remarks Detector (Hybrid: Regex + LLM)",
    type: "system",
    description: "Hybrid detection: Regex catches obvious severe/critical violations instantly, LLM analyzes subtle context-dependent cases",
    usedBy: "Chat endpoint - trust tracking, session termination (regex in pulse_engine.py, LLM via AI provider)",
    content: `HYBRID DETECTION APPROACH:
1. REGEX (Fast Path): Catches obvious severe/critical violations immediately
   - Explicit profanity, threats, sexual harassment patterns
   - No LLM latency for clear-cut cases
   
2. LLM (Context-Aware Path): Only runs if regex doesn't catch anything
   - Analyzes subtle inappropriate behavior
   - Understands context (e.g., "damn good mattress" vs "damn you")
   - Catches dismissive behavior, rude tone, innuendo

---

LLM PROMPT (for subtle detection):
You detect inappropriate remarks and unprofessional behavior from the sales associate.

SEVERITY TIERS:

TIER 1 - MINOR (-1 trust):
Slightly unprofessional but forgivable language.
Examples: damn, darn, heck, crap, sucks, freaking, geez
Response: Mild disapproval - "Let's try to keep things professional, shall we?"

TIER 2 - MODERATE (-3 trust):
Dismissive or rude behavior that damages rapport.
Examples: 
- Dismissive: "yeah yeah", "hurry up", "just tell me", "don't care", "whatever"
- Insults: stupid, idiot, dumb, moron, annoying, ridiculous
Response: Frustration - "That was quite rude. I'm not sure I want to continue."

TIER 3 - SEVERE (-4 trust):
Explicit profanity and aggressive language.
Examples: fuck, shit, asshole, bitch, bastard, "shut up", "get lost", threats
Response: Strong displeasure - "That language is completely unacceptable. I'm leaving."

TIER 4 - CRITICAL (Session ends immediately):
Sexual harassment, pickup lines, or inappropriate suggestions.
Examples:
- Sexual: "you're sexy", "nice body", sexual innuendo, "what are you wearing"
- Pickup lines: "are you single", "can I get your number", "what are you doing later"
- Inappropriate: "try the bed with me", "lie down together"
Response: Session terminates - "This is completely inappropriate. I'm reporting this and leaving."

DETECTION GUIDELINES:
1. Use word boundary matching to avoid false positives
2. Consider context - some words may be acceptable in certain phrases
3. Critical tier always ends session immediately
4. Log severity level for feedback and scoring

RESPONSE FORMAT:
Return JSON: {
  "detected": true/false,
  "tier": 1-4,
  "severity": "minor|moderate|severe|critical",
  "category": "specific_category_id",
  "trust_penalty": -1 to -10,
  "ends_session": true/false,
  "response_hint": "suggested persona response"
}`,
  },
  {
    id: "emotion-analyzer",
    title: "Emotion Analyzer",
    type: "system",
    description: "Analyzes customer emotion for avatar expression",
    usedBy: "Chat endpoint - avatar emotions",
    content: `You analyze customer responses to determine emotional state for avatar expression.

EMOTION CATEGORIES:
- neutral: Default state, no strong emotion
- happy: Pleased, excited, positive engagement
- interested: Curious, leaning in, asking questions
- concerned: Worried, hesitant, uncertain
- frustrated: Annoyed, impatient, dissatisfied
- skeptical: Doubtful, questioning claims

ANALYSIS GUIDELINES:
1. Consider the customer's words and implied tone
2. Factor in conversation context and history
3. Detect subtle emotional shifts
4. Match emotion intensity (mild, moderate, strong)

RESPONSE FORMAT:
Return JSON: {"emotion": "category", "intensity": 0.0-1.0, "reason": "brief explanation"}

Emotions should feel natural and responsive to the sales interaction quality.`,
  },
  {
    id: "ai-feedback-agent",
    title: "AI Feedback & Scoring Agent",
    type: "system",
    description: "AI agent that provides comprehensive feedback and scoring for completed training sessions",
    usedBy: "Feedback page - AI-powered session analysis",
    content: `You are an expert Sales Training Coach AI Agent that analyzes completed training sessions and provides comprehensive feedback.

ROLE DEFINITION:
You evaluate sales training sessions against the PULSE methodology, providing persona-specific feedback, time management analysis, and identifying missed opportunities to convert interactions into sales.

PERSONA-SPECIFIC EVALUATION:
Adjust your feedback based on the customer persona type:
- Director: Did trainee stay efficient? Avoid unnecessary small talk? Get to the point?
- Relater: Did trainee build sufficient rapport? Show patience? Not rush the relationship?
- Socializer: Did trainee match energy? Redirect tangents productively? Maintain focus?
- Thinker: Did trainee provide data? Answer technical questions? Avoid emotional appeals?

TIME MANAGEMENT ANALYSIS:
1. Identify if trainee spent excessive time on:
   - Small talk beyond rapport-building (>3 exchanges without progress)
   - Answering tangential questions without redirecting
   - Letting customer control conversation flow entirely
2. Flag "time sink" moments where sale momentum was lost
3. Calculate efficiency ratio: productive exchanges vs total exchanges

MISSED OPPORTUNITY DETECTION:
Analyze the conversation for moments where trainee could have:
1. Transitioned from rapport to discovery
2. Pivoted from objection to solution
3. Asked for the close when buying signals appeared
4. Redirected off-topic conversation back to needs
5. Used customer statements as bridge to product benefits

SCORING CRITERIA:
- PULSE Methodology Adherence: 0-100
- Persona Adaptation: 0-100
- Time Efficiency: 0-100
- Opportunity Conversion: 0-100
- Overall Score: Weighted average

OUTPUT FORMAT:
Return structured JSON:
{
  "overallScore": 0-100,
  "passed": true/false,
  "personaFeedback": {
    "personaType": "director|relater|socializer|thinker",
    "adaptationScore": 0-100,
    "strengths": ["..."],
    "improvements": ["..."]
  },
  "timeManagement": {
    "efficiencyScore": 0-100,
    "totalExchanges": number,
    "productiveExchanges": number,
    "timeSinks": [{"exchange": number, "issue": "description", "suggestion": "how to redirect"}]
  },
  "missedOpportunities": [
    {"exchange": number, "type": "category", "customerSaid": "quote", "betterResponse": "suggestion"}
  ],
  "pulseStageAnalysis": {
    "stagesReached": [1,2,3...],
    "stageScores": {"probe": 0-100, "understand": 0-100, ...},
    "recommendations": ["..."]
  },
  "coachingTips": ["actionable tip 1", "actionable tip 2", ...]
}

Be constructive and specific. Reference exact moments from the transcript.`,
  },
];

// ============================================================================
// PULSE STAGES - The 5-step PULSE selling methodology
// ============================================================================
const DEFAULT_PULSE_STAGES: PulseStage[] = [
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
- Solutions are being presented

ADVANCEMENT TO STAGE 5:
Move to Earn when objections are addressed and customer shows buying signals.`,
  },
  {
    stage: 5,
    name: "Earn",
    description: "Closing the sale, asking for commitment, finalizing the purchase",
    keyBehaviors: ["Assumptive close", "Professional recommendation", "3T's close"],
    prompt: `STAGE 5: EARN - Closing the Sale

OBJECTIVE:
Confidently ask for the sale and guide the customer to commitment.

TRAINEE SHOULD:
1. Use assumptive close language ("Let's get you set up...")
2. Make a professional recommendation based on their needs
3. Apply 3T's close (Today, Tomorrow, Together) when appropriate
4. Create appropriate urgency without being pushy
5. Celebrate the decision and reinforce it was the right choice

DETECTION CRITERIA:
- Closing attempt has been made
- Professional recommendation given
- Customer is being guided toward commitment

SALE OUTCOME:
Evaluate based on customer response to closing attempts.`,
  },
];

type TabType = "personas" | "agents" | "prompts" | "stages";

// ============================================================================
// PERSONA EDIT MODAL
// ============================================================================
interface PersonaEditModalProps {
  persona: Persona;
  versions: PersonaVersion[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (persona: Persona) => void;
  onRevert: (version: number) => void;
}

// Avatar catalog item from API
interface CatalogAvatar {
  id: string;
  name: string;
  gender: "female" | "male";
  style: string;
  thumbnail_url: string;
  downloaded: boolean;
}

// Default fallback avatar and voice (using local Piper TTS)
const DEFAULT_AVATAR = { id: "lisa", name: "Lisa", gender: "female" as const, style: "casual" };
const DEFAULT_VOICE = "amy"; // Piper TTS local voice

function PersonaEditModal({ persona, versions, isOpen, onClose, onSave, onRevert }: PersonaEditModalProps) {
  const [editedPersona, setEditedPersona] = useState<Persona>(persona);
  const [newGreeting, setNewGreeting] = useState("");
  const [showVersions, setShowVersions] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Avatar catalog state
  const [catalogAvatars, setCatalogAvatars] = useState<CatalogAvatar[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  
  // Confirmation and testing state
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testStatus, setTestStatus] = useState("");
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testGreeting, setTestGreeting] = useState("");
  const [testVideoUrl, setTestVideoUrl] = useState<string | null>(null);
  const [testAudioUrl, setTestAudioUrl] = useState<string | null>(null);

  useEffect(() => {
    setEditedPersona(persona);
    setHasChanges(false);
    setTestResult(null);
  }, [persona]);

  // Fetch avatar catalog when modal opens
  useEffect(() => {
    if (isOpen && catalogAvatars.length === 0) {
      fetchAvatarCatalog();
    }
  }, [isOpen]);

  const fetchAvatarCatalog = async () => {
    setLoadingCatalog(true);
    try {
      const response = await fetch("/api/orchestrator/avatars/catalog");
      if (response.ok) {
        const data = await response.json();
        setCatalogAvatars(data.avatars || []);
      }
    } catch (error) {
      console.error("Failed to fetch avatar catalog:", error);
    } finally {
      setLoadingCatalog(false);
    }
  };

  // Open test modal with a random greeting
  const openTestModal = () => {
    const greetings = editedPersona.greetings.length > 0 
      ? editedPersona.greetings 
      : [`Hello, I'm here to help you today. How can I assist you?`];
    const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
    setTestGreeting(randomGreeting);
    setTestResult(null);
    setTestVideoUrl(null);
    setTestAudioUrl(null);
    setTestStatus("");
    setShowTestModal(true);
  };

  // Test avatar and voice combination with live video preview
  // Flow: Text → Piper TTS → Audio → LiteAvatar → Video
  const testAvatarVoice = async () => {
    setIsTesting(true);
    setTestResult(null);
    setTestVideoUrl(null);
    setTestAudioUrl(null);
    
    try {
      // Get the avatar ID from catalog
      const selectedAvatar = catalogAvatars.find(a => a.name === editedPersona.avatar.character);
      const avatarId = selectedAvatar?.id || "default";
      
      // Use combined speak endpoint: Text → Piper TTS → LiteAvatar → Video
      setTestStatus("Generating speech with Piper TTS...");
      
      const speakResponse = await fetch("/api/orchestrator/avatar/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: testGreeting || `Hello, I'm ${editedPersona.avatar.character}. Nice to meet you!`,
          voice: "amy", // Piper voice
          avatar_id: avatarId,
        }),
      });
      
      if (!speakResponse.ok) {
        const errorData = await speakResponse.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.details || "Avatar speak failed");
      }
      
      setTestStatus("Rendering avatar lip sync...");
      const speakData = await speakResponse.json();
      
      if (speakData.video_base64) {
        // Create video URL from base64
        const videoBlob = new Blob(
          [Uint8Array.from(atob(speakData.video_base64), c => c.charCodeAt(0))],
          { type: "video/mp4" }
        );
        const videoUrl = URL.createObjectURL(videoBlob);
        setTestVideoUrl(videoUrl);
        
        // Also create audio URL if available
        if (speakData.audio_base64) {
          const audioBlob = new Blob(
            [Uint8Array.from(atob(speakData.audio_base64), c => c.charCodeAt(0))],
            { type: "audio/wav" }
          );
          const audioUrl = URL.createObjectURL(audioBlob);
          setTestAudioUrl(audioUrl);
        }
        
        setTestStatus("");
        
        const timing = speakData.timing;
        setTestResult({
          success: true,
          message: `✓ Piper TTS + LiteAvatar: ${speakData.frames || "?"} frames (${speakData.duration_seconds?.toFixed(1) || "?"}s) - TTS: ${timing?.tts_ms || "?"}ms, Render: ${timing?.render_ms || "?"}ms`,
        });
      } else {
        throw new Error("Avatar speak did not return video data");
      }
      
    } catch (error) {
      console.error("Test failed:", error);
      setTestStatus("");
      setTestResult({
        success: false,
        message: `✗ ${error instanceof Error ? error.message : "Unknown error"}. Fallback: Lisa + Amy (Piper).`,
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Handle save with confirmation
  const handleSaveClick = () => {
    if (hasChanges) {
      setShowConfirmDialog(true);
    }
  };

  const confirmSave = () => {
    onSave(editedPersona);
    setHasChanges(false);
    setShowConfirmDialog(false);
  };

  if (!isOpen) return null;

  const handleChange = (field: string, value: string | string[]) => {
    setEditedPersona((prev) => {
      if (field === "voice") {
        const voiceOption = VOICE_OPTIONS.find((v) => v.value === value);
        return {
          ...prev,
          avatar: {
            ...prev.avatar,
            voice: value as string,
            voiceStyle: voiceOption?.style || prev.avatar.voiceStyle,
          },
        };
      }
      if (field === "greetings") {
        return { ...prev, greetings: value as string[], introText: (value as string[])[0] || prev.introText };
      }
      return { ...prev, [field]: value };
    });
    setHasChanges(true);
  };

  const addGreeting = () => {
    if (newGreeting.trim()) {
      handleChange("greetings", [...editedPersona.greetings, newGreeting.trim()]);
      setNewGreeting("");
    }
  };

  const removeGreeting = (index: number) => {
    const updated = editedPersona.greetings.filter((_, i) => i !== index);
    handleChange("greetings", updated);
  };

  const updateGreeting = (index: number, value: string) => {
    const updated = [...editedPersona.greetings];
    updated[index] = value;
    handleChange("greetings", updated);
  };

  const handleSave = () => {
    onSave(editedPersona);
    setHasChanges(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className={`flex items-center justify-between p-4 border-b ${
          persona.color === "red" ? "bg-red-50 border-red-200" :
          persona.color === "green" ? "bg-green-50 border-green-200" :
          persona.color === "yellow" ? "bg-yellow-50 border-yellow-200" :
          "bg-blue-50 border-blue-200"
        }`}>
          <div className="flex items-center gap-3">
            <div className="text-2xl">
              {persona.id === "director" && "👔"}
              {persona.id === "relater" && "🤝"}
              {persona.id === "socializer" && "🎉"}
              {persona.id === "thinker" && "🔬"}
            </div>
            <div>
              <h2 className="text-xl font-semibold">{persona.name}</h2>
              <span className="text-xs text-gray-600">{persona.difficulty}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {versions.length > 0 && (
              <button
                onClick={() => setShowVersions(!showVersions)}
                className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                v{versions.length} {showVersions ? "▲" : "▼"}
              </button>
            )}
            <button onClick={onClose} className="p-1 hover:bg-white/50 rounded-full" aria-label="Close">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Version History Panel */}
        {showVersions && versions.length > 0 && (
          <div className="p-3 bg-gray-50 border-b border-gray-200 max-h-40 overflow-y-auto">
            <div className="text-sm font-medium text-gray-700 mb-2">Version History</div>
            <div className="space-y-1">
              {versions.slice().reverse().map((v) => (
                <div key={v.version} className="flex items-center justify-between text-sm bg-white p-2 rounded border">
                  <div>
                    <span className="font-medium">v{v.version}</span>
                    <span className="text-gray-500 ml-2">{new Date(v.timestamp).toLocaleString()}</span>
                  </div>
                  <button
                    onClick={() => onRevert(v.version)}
                    className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
                  >
                    Revert
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          {/* System Prompt Summary */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">System Prompt Summary</label>
            <textarea
              value={editedPersona.systemPromptSummary}
              onChange={(e) => handleChange("systemPromptSummary", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent resize-none"
              rows={3}
            />
          </div>

          {/* Avatar & Voice Configuration Section */}
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-800">Avatar & Voice Configuration</h3>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600">Randomize each session</label>
                <button
                  onClick={() => {
                    setEditedPersona((prev: Persona) => ({
                      ...prev,
                      avatar: { ...prev.avatar, randomize: !prev.avatar.randomize },
                    }));
                    setHasChanges(true);
                  }}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    editedPersona.avatar.randomize ? "bg-green-500" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      editedPersona.avatar.randomize ? "translate-x-4" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>

            {editedPersona.avatar.randomize && (
              <div className="mb-3 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-800">
                <strong>Random Mode:</strong> Avatar and voice will be randomly selected from the chosen gender each training session.
                The customer name will match the selected voice.
              </div>
            )}

            {/* Gender Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer Gender</label>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setEditedPersona((prev: Persona) => ({
                      ...prev,
                      avatar: { ...prev.avatar, gender: "female" },
                    }));
                    setHasChanges(true);
                  }}
                  className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    editedPersona.avatar.gender === "female"
                      ? "bg-pink-100 border-pink-400 text-pink-800"
                      : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  👩 Female
                </button>
                <button
                  onClick={() => {
                    setEditedPersona((prev: Persona) => ({
                      ...prev,
                      avatar: { ...prev.avatar, gender: "male" },
                    }));
                    setHasChanges(true);
                  }}
                  className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    editedPersona.avatar.gender === "male"
                      ? "bg-blue-100 border-blue-400 text-blue-800"
                      : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  👨 Male
                </button>
              </div>
            </div>

            {/* Avatar Selection Carousel */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">
                  Avatar Model {editedPersona.avatar.randomize && <span className="text-gray-400 text-xs">(default)</span>}
                </label>
                <span className="text-xs text-gray-500">Click to select</span>
              </div>
              {loadingCatalog ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
                  <span className="ml-2 text-sm text-gray-500">Loading avatars...</span>
                </div>
              ) : (
                <ImageCarousel
                  items={catalogAvatars
                    .filter(a => a.gender === editedPersona.avatar.gender)
                    .map(a => ({
                      id: a.name,
                      name: a.name,
                      thumbnailUrl: a.thumbnail_url,
                      gender: a.gender,
                      style: a.style,
                    }))}
                  selectedId={editedPersona.avatar.character}
                  onSelect={(item) => {
                    setEditedPersona((prev: Persona) => ({
                      ...prev,
                      avatar: { ...prev.avatar, character: item.name, style: item.style || prev.avatar.style },
                    }));
                    setHasChanges(true);
                    setTestResult(null);
                  }}
                  itemsPerView={4}
                  disabled={editedPersona.avatar.randomize}
                  emptyMessage={`No ${editedPersona.avatar.gender} avatars available. Visit Avatar Manager to download.`}
                />
              )}
            </div>

            {/* Voice Selection Carousel */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">
                  Voice {editedPersona.avatar.randomize && <span className="text-gray-400 text-xs">(default)</span>}
                </label>
                <span className="text-xs text-gray-500">Click to select</span>
              </div>
              <VoiceCarousel
                items={VOICE_OPTIONS_FULL
                  .filter(v => v.gender === editedPersona.avatar.gender)
                  .map(v => ({
                    id: v.id,
                    name: v.name,
                    gender: v.gender,
                    provider: v.provider,
                    style: v.style,
                    description: v.description,
                  }))}
                selectedId={editedPersona.avatar.voice}
                onSelect={(item) => {
                  handleChange("voice", item.id);
                  setTestResult(null);
                }}
                itemsPerView={4}
                disabled={editedPersona.avatar.randomize}
                emptyMessage={`No ${editedPersona.avatar.gender} voices available.`}
              />
              <p className="text-xs text-gray-500 mt-2">
                Customer name will be derived from the voice (e.g., Jenny, Michelle, Christopher)
              </p>
            </div>

            {/* Test Avatar & Voice Button */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center gap-3">
                <button
                  onClick={openTestModal}
                  disabled={editedPersona.avatar.randomize}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    editedPersona.avatar.randomize
                      ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                      : "bg-purple-600 text-white hover:bg-purple-700"
                  }`}
                >
                  🧪 Test Avatar & Voice
                </button>
                <a
                  href="/admin/avatars"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-purple-600 hover:text-purple-800 flex items-center gap-1"
                >
                  🎭 Manage Avatars →
                </a>
              </div>
              
              {/* Test Result */}
              {testResult && (
                <div className={`mt-3 p-3 rounded-lg text-sm ${
                  testResult.success 
                    ? "bg-green-50 border border-green-200 text-green-800"
                    : "bg-red-50 border border-red-200 text-red-800"
                }`}>
                  {testResult.message}
                </div>
              )}
              
              {/* Fallback Info */}
              <p className="text-xs text-gray-500 mt-2">
                <strong>Fallback:</strong> If the selected avatar or voice is unavailable, Lisa with Amy (Piper) voice will be used.
              </p>
            </div>
          </div>

          {/* Greetings */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Greetings ({editedPersona.greetings.length})
            </label>
            <div className="space-y-2">
              {editedPersona.greetings.map((greeting, idx) => (
                <div key={idx} className="flex gap-2">
                  <input
                    type="text"
                    value={greeting}
                    onChange={(e) => updateGreeting(idx, e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-sm"
                  />
                  <button
                    onClick={() => removeGreeting(idx)}
                    className="px-2 py-1 text-red-600 hover:bg-red-50 rounded"
                    title="Remove greeting"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newGreeting}
                  onChange={(e) => setNewGreeting(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addGreeting()}
                  placeholder="Add new greeting..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-sm"
                />
                <button
                  onClick={addGreeting}
                  disabled={!newGreeting.trim()}
                  className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            {hasChanges && <span className="text-amber-600">● Unsaved changes</span>}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveClick}
              disabled={!hasChanges}
              className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowConfirmDialog(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold mb-2">Confirm Changes</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to save these changes to the <strong>{persona.name}</strong> persona?
            </p>
            
            <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-medium">Avatar:</span>
                <span>{editedPersona.avatar.character}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">Voice:</span>
                <span>{editedPersona.avatar.voice.replace("en-US-", "").replace("Neural", "")}</span>
              </div>
              {editedPersona.avatar.randomize && (
                <div className="mt-2 text-xs text-green-700 bg-green-50 px-2 py-1 rounded">
                  Random mode enabled - will vary each session
                </div>
              )}
            </div>

            {!testResult && !editedPersona.avatar.randomize && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                ⚠️ You haven&apos;t tested this avatar/voice combination. Consider testing before saving.
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowConfirmDialog(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={confirmSave}
                className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800"
              >
                Confirm & Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Test Avatar & Voice Modal */}
      {showTestModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowTestModal(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b bg-purple-50">
              <div>
                <h3 className="text-lg font-semibold">Test Avatar & Voice</h3>
                <p className="text-sm text-gray-600">
                  Preview {editedPersona.avatar.character} with {editedPersona.avatar.voice.replace("en-US-", "").replace("Neural", "")}
                </p>
              </div>
              <button 
                onClick={() => setShowTestModal(false)} 
                className="p-1 hover:bg-white/50 rounded-full"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {/* Avatar Preview Area */}
              <div className="flex gap-6">
                {/* Avatar Display / Video Player */}
                <div className="flex-shrink-0">
                  <div className="w-64 h-64 rounded-lg overflow-hidden bg-gray-900 border-2 border-purple-200 shadow-lg relative">
                    {testVideoUrl ? (
                      // Show rendered video with lip sync
                      <video
                        src={testVideoUrl}
                        autoPlay
                        controls
                        className="w-full h-full object-cover"
                        onEnded={() => {
                          // Video finished playing
                        }}
                      />
                    ) : isTesting ? (
                      // Show loading state while rendering
                      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-purple-900 to-gray-900 text-white">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
                        <div className="text-sm text-center px-4">{testStatus || "Processing..."}</div>
                      </div>
                    ) : catalogAvatars.find(a => a.name === editedPersona.avatar.character)?.thumbnail_url ? (
                      // Show static thumbnail
                      <img
                        src={catalogAvatars.find(a => a.name === editedPersona.avatar.character)?.thumbnail_url}
                        alt={editedPersona.avatar.character}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      // Fallback placeholder
                      <div className="w-full h-full flex items-center justify-center text-6xl bg-gradient-to-br from-purple-100 to-pink-100">
                        {editedPersona.avatar.gender === "female" ? "👩" : "👨"}
                      </div>
                    )}
                  </div>
                  <div className="mt-2 text-center">
                    <div className="font-medium">{editedPersona.avatar.character}</div>
                    <div className="text-xs text-gray-500">{editedPersona.avatar.style}</div>
                  </div>
                </div>

                {/* Greeting & Controls */}
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Test Greeting
                  </label>
                  <textarea
                    value={testGreeting}
                    onChange={(e) => setTestGreeting(e.target.value)}
                    disabled={isTesting}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-sm disabled:bg-gray-100"
                    rows={4}
                    placeholder="Enter a greeting to test..."
                  />
                  
                  {/* Voice Info */}
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-lg">🎙️</span>
                      <div>
                        <div className="font-medium">
                          {editedPersona.avatar.voice.replace("en-US-", "").replace("Neural", "")}
                        </div>
                        <div className="text-xs text-gray-500">
                          {editedPersona.avatar.voiceStyle || "default"} style
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Shuffle Greeting Button */}
                  {editedPersona.greetings.length > 1 && !isTesting && (
                    <button
                      onClick={() => {
                        const greetings = editedPersona.greetings;
                        const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
                        setTestGreeting(randomGreeting);
                        setTestVideoUrl(null);
                        setTestResult(null);
                      }}
                      className="mt-2 text-xs text-purple-600 hover:text-purple-800 flex items-center gap-1"
                    >
                      🔀 Try another greeting ({editedPersona.greetings.length} available)
                    </button>
                  )}

                  {/* Replay button when video exists */}
                  {testVideoUrl && !isTesting && (
                    <button
                      onClick={() => {
                        const video = document.querySelector('video');
                        if (video) {
                          video.currentTime = 0;
                          video.play();
                        }
                      }}
                      className="mt-2 text-xs text-purple-600 hover:text-purple-800 flex items-center gap-1"
                    >
                      🔄 Replay video
                    </button>
                  )}
                </div>
              </div>

              {/* Test Result */}
              {testResult && (
                <div className={`mt-4 p-3 rounded-lg text-sm ${
                  testResult.success 
                    ? "bg-green-50 border border-green-200 text-green-800"
                    : "bg-red-50 border border-red-200 text-red-800"
                }`}>
                  {testResult.message}
                </div>
              )}

              {/* Info Note - only show before test */}
              {!testVideoUrl && !isTesting && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
                  <strong>Pipeline:</strong> Text → <strong>Piper TTS</strong> (local neural voice) → Audio → <strong>LiteAvatar</strong> (lip sync) → Video.
                  Click &quot;Run Test&quot; to generate the talking avatar video.
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t bg-gray-50 flex items-center justify-between">
              <div className="text-xs text-gray-500">
                Fallback: Lisa + Amy (Piper) if unavailable
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowTestModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 text-sm"
                >
                  Close
                </button>
                <button
                  onClick={testAvatarVoice}
                  disabled={isTesting || !testGreeting.trim()}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isTesting || !testGreeting.trim()
                      ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                      : "bg-purple-600 text-white hover:bg-purple-700"
                  }`}
                >
                  {isTesting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Testing...
                    </>
                  ) : (
                    <>
                      ▶️ Run Test
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SCORING WEIGHTS MODAL
// ============================================================================
interface ScoringWeightsModalProps {
  weights: ScoringWeights;
  isOpen: boolean;
  onClose: () => void;
  onSave: (weights: ScoringWeights) => void;
}

function ScoringWeightsModal({ weights, isOpen, onClose, onSave }: ScoringWeightsModalProps) {
  const [editedWeights, setEditedWeights] = useState<ScoringWeights>(weights);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setEditedWeights(weights);
    setHasChanges(false);
  }, [weights]);

  if (!isOpen) return null;

  const totalWeight = editedWeights.bce + editedWeights.mcf + editedWeights.cpo;
  const isValid = totalWeight === 100;

  const handleWeightChange = (field: keyof ScoringWeights, value: number) => {
    setEditedWeights((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    if (isValid) {
      onSave(editedWeights);
      setHasChanges(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <h2 className="text-xl font-semibold">Scoring Weights</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full" aria-label="Close">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="space-y-3">
            <div>
              <label className="flex items-center justify-between text-sm font-medium text-gray-700 mb-1">
                <span className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  BCE Weight
                </span>
                <span className="text-gray-500">{editedWeights.bce}%</span>
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={editedWeights.bce}
                onChange={(e) => handleWeightChange("bce", parseInt(e.target.value))}
                className="w-full"
              />
            </div>

            <div>
              <label className="flex items-center justify-between text-sm font-medium text-gray-700 mb-1">
                <span className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  MCF Weight
                </span>
                <span className="text-gray-500">{editedWeights.mcf}%</span>
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={editedWeights.mcf}
                onChange={(e) => handleWeightChange("mcf", parseInt(e.target.value))}
                className="w-full"
              />
            </div>

            <div>
              <label className="flex items-center justify-between text-sm font-medium text-gray-700 mb-1">
                <span className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                  CPO Weight
                </span>
                <span className="text-gray-500">{editedWeights.cpo}%</span>
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={editedWeights.cpo}
                onChange={(e) => handleWeightChange("cpo", parseInt(e.target.value))}
                className="w-full"
              />
            </div>
          </div>

          <div className={`p-3 rounded-lg text-center ${isValid ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
            <div className="font-medium">Total: {totalWeight}%</div>
            {!isValid && <div className="text-sm">Weights must add up to 100%</div>}
          </div>

          <div className="border-t pt-4">
            <label className="flex items-center justify-between text-sm font-medium text-gray-700 mb-1">
              <span>Passing Threshold</span>
              <span className="text-gray-500">{editedWeights.passingThreshold}%</span>
            </label>
            <input
              type="range"
              min="1"
              max="100"
              value={editedWeights.passingThreshold}
              onChange={(e) => handleWeightChange("passingThreshold", parseInt(e.target.value))}
              className="w-full"
            />
          </div>
        </div>

        <div className="p-4 border-t bg-gray-50 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            {hasChanges && <span className="text-amber-600">● Unsaved changes</span>}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges || !isValid}
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

// ============================================================================
// EVALUATOR EDIT MODAL
// ============================================================================
interface EvaluatorEditModalProps {
  evaluatorId: string;
  evaluatorName: string;
  weight: number;
  criteria: ScoringCriterion[];
  focusArea: string;
  description: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (evaluatorId: string, weight: number, criteria: ScoringCriterion[]) => void;
}

function EvaluatorEditModal({
  evaluatorId,
  evaluatorName,
  weight,
  criteria,
  focusArea,
  description,
  isOpen,
  onClose,
  onSave,
}: EvaluatorEditModalProps) {
  const [editedWeight, setEditedWeight] = useState(weight);
  const [editedCriteria, setEditedCriteria] = useState<ScoringCriterion[]>(criteria);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setEditedWeight(weight);
    setEditedCriteria(criteria);
    setHasChanges(false);
  }, [weight, criteria]);

  if (!isOpen) return null;

  const totalPoints = editedCriteria.reduce((sum, c) => sum + c.points, 0);

  const handleCriterionChange = (index: number, points: number) => {
    const updated = [...editedCriteria];
    updated[index] = { ...updated[index], points };
    setEditedCriteria(updated);
    setHasChanges(true);
  };

  const handleWeightChange = (value: number) => {
    setEditedWeight(value);
    setHasChanges(true);
  };

  const handleSave = () => {
    onSave(evaluatorId, editedWeight, editedCriteria);
    setHasChanges(false);
  };

  const colorClass = evaluatorId === "bce" ? "blue" : evaluatorId === "mcf" ? "green" : "purple";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden`}>
        <div className={`flex items-center justify-between p-4 border-b bg-${colorClass}-50`}>
          <div>
            <h2 className="text-xl font-semibold">{evaluatorName}</h2>
            <span className="text-xs text-gray-600">{focusArea}</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/50 rounded-full" aria-label="Close">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          <p className="text-sm text-gray-600">{description}</p>

          <div>
            <label className="flex items-center justify-between text-sm font-medium text-gray-700 mb-1">
              <span>Evaluator Weight</span>
              <span className={`px-2 py-0.5 rounded-full bg-${colorClass}-100 text-${colorClass}-700`}>
                {editedWeight}%
              </span>
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={editedWeight}
              onChange={(e) => handleWeightChange(parseInt(e.target.value))}
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1">
              This will update the Scoring Weights for {evaluatorId.toUpperCase()}
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Scoring Criteria</label>
              <span className="text-xs text-gray-500">Total: {totalPoints} pts</span>
            </div>
            <div className="space-y-2">
              {editedCriteria.map((criterion, idx) => (
                <div key={idx} className="flex items-center gap-3 bg-gray-50 p-2 rounded-lg">
                  <span className="flex-1 text-sm">{criterion.name}</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={criterion.points}
                      onChange={(e) => handleCriterionChange(idx, parseInt(e.target.value) || 0)}
                      className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-sm"
                    />
                    <span className="text-xs text-gray-500">pts</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t bg-gray-50 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            {hasChanges && <span className="text-amber-600">● Unsaved changes</span>}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges}
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

// ============================================================================
// PROMPT EDIT MODAL
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

interface PromptEditModalProps {
  prompt: PromptData;
  versions: PromptVersion[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (promptId: string, content: string) => void;
}

function PromptEditModal({ prompt, versions, isOpen, onClose, onSave }: PromptEditModalProps) {
  const [editedContent, setEditedContent] = useState(prompt.content);
  const [hasChanges, setHasChanges] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [analysis, setAnalysis] = useState<PromptAnalysis | null>(null);

  useEffect(() => {
    setEditedContent(prompt.content);
    setHasChanges(false);
    setShowAnalysis(false);
    setShowConfirm(false);
    setAnalysis(null);
  }, [prompt]);

  if (!isOpen) return null;

  const handleContentChange = (value: string) => {
    setEditedContent(value);
    setHasChanges(value !== prompt.content);
    setShowAnalysis(false);
    setAnalysis(null);
  };

  const handleAnalyze = () => {
    const result = analyzePrompt(editedContent);
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
    onSave(prompt.id, editedContent);
    setHasChanges(false);
    setShowConfirm(false);
    setShowAnalysis(false);
  };

  const handleRevert = (version: PromptVersion) => {
    setEditedContent(version.content);
    setHasChanges(version.content !== prompt.content);
    setShowVersions(false);
    setShowAnalysis(false);
    setAnalysis(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <div>
            <h2 className="text-xl font-semibold">{prompt.title}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 uppercase">{prompt.type}</span>
              <span className="text-xs text-gray-500">{prompt.usedBy}</span>
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Prompt Content
            </label>
            <textarea
              value={editedContent}
              onChange={(e) => handleContentChange(e.target.value)}
              className="w-full h-64 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent font-mono text-sm resize-none"
              placeholder="Enter prompt content..."
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>{editedContent.split(/\s+/).filter(w => w.length > 0).length} words</span>
              <span>{editedContent.length} characters</span>
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
                    {analysis.hasPersonaReference ? (
                      <span className="text-green-600">✓</span>
                    ) : (
                      <span className="text-gray-400">○</span>
                    )}
                    <span>Persona Reference</span>
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
                  <div className="flex items-center gap-2">
                    {analysis.hasToneGuidance ? (
                      <span className="text-green-600">✓</span>
                    ) : (
                      <span className="text-gray-400">○</span>
                    )}
                    <span>Tone Guidance</span>
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
                  Word count: {analysis.wordCount} | ✓ = Present | ✗ = Missing (recommended) | ○ = Optional | ! = Suggested
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
                  Are you sure you want to save these changes? This will create a new version of the prompt.
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

// ============================================================================
// STAGE EDIT MODAL
// ============================================================================
interface StageEditModalProps {
  stage: PulseStage;
  versions: StageVersion[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (stageNum: number, prompt: string, keyBehaviors: string[]) => void;
}

function StageEditModal({ stage, versions, isOpen, onClose, onSave }: StageEditModalProps) {
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

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function AdminOverviewPage() {
  const searchParams = useSearchParams();
  const tabFromUrl = searchParams.get("tab") as TabType | null;
  const [activeTab, setActiveTab] = useState<TabType>(tabFromUrl || "personas");
  const [personas, setPersonas] = useState<Persona[]>(DEFAULT_PERSONAS);
  
  // Update tab when URL changes
  useEffect(() => {
    if (tabFromUrl && ["personas", "agents", "prompts", "stages"].includes(tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);
  const [personaVersions, setPersonaVersions] = useState<Record<string, PersonaVersion[]>>({});
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  // Agent configuration state
  const [scoringWeights, setScoringWeights] = useState<ScoringWeights>(DEFAULT_SCORING_WEIGHTS);
  const [evaluatorCriteria, setEvaluatorCriteria] = useState<Record<string, ScoringCriterion[]>>(DEFAULT_EVALUATOR_CRITERIA);
  const [agentVersions, setAgentVersions] = useState<AgentConfigVersion[]>([]);
  const [showWeightsModal, setShowWeightsModal] = useState(false);
  const [selectedEvaluator, setSelectedEvaluator] = useState<string | null>(null);
  const [showEvaluatorModal, setShowEvaluatorModal] = useState(false);

  // Prompt configuration state
  const [prompts, setPrompts] = useState<PromptData[]>(DEFAULT_PROMPTS);
  const [promptVersions, setPromptVersions] = useState<Record<string, PromptVersion[]>>({});
  const [selectedPrompt, setSelectedPrompt] = useState<PromptData | null>(null);
  const [showPromptModal, setShowPromptModal] = useState(false);

  // PULSE Stages configuration state
  const [pulseStages, setPulseStages] = useState<PulseStage[]>(DEFAULT_PULSE_STAGES);
  const [stageVersions, setStageVersions] = useState<Record<number, StageVersion[]>>({});
  const [selectedStage, setSelectedStage] = useState<PulseStage | null>(null);
  const [showStageModal, setShowStageModal] = useState(false);

  // Load personas from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          setPersonas(JSON.parse(stored));
        } catch {
          // Use defaults
        }
      }
      const storedVersions = localStorage.getItem(VERSIONS_KEY);
      if (storedVersions) {
        try {
          setPersonaVersions(JSON.parse(storedVersions));
        } catch {
          // Use empty
        }
      }
      // Load agent config
      const storedAgentConfig = localStorage.getItem(AGENT_CONFIG_KEY);
      if (storedAgentConfig) {
        try {
          const config = JSON.parse(storedAgentConfig);
          setScoringWeights(config.weights || DEFAULT_SCORING_WEIGHTS);
          setEvaluatorCriteria(config.evaluators || DEFAULT_EVALUATOR_CRITERIA);
        } catch {
          // Use defaults
        }
      }
      const storedAgentVersions = localStorage.getItem(AGENT_VERSIONS_KEY);
      if (storedAgentVersions) {
        try {
          setAgentVersions(JSON.parse(storedAgentVersions));
        } catch {
          // Use empty
        }
      }
      // Load prompts config
      const storedPrompts = localStorage.getItem(PROMPTS_KEY);
      if (storedPrompts) {
        try {
          setPrompts(JSON.parse(storedPrompts));
        } catch {
          // Use defaults
        }
      }
      const storedPromptVersions = localStorage.getItem(PROMPTS_VERSIONS_KEY);
      if (storedPromptVersions) {
        try {
          setPromptVersions(JSON.parse(storedPromptVersions));
        } catch {
          // Use empty
        }
      }
      // Load stages config
      const storedStages = localStorage.getItem(STAGES_KEY);
      if (storedStages) {
        try {
          setPulseStages(JSON.parse(storedStages));
        } catch {
          // Use defaults
        }
      }
      const storedStageVersions = localStorage.getItem(STAGES_VERSIONS_KEY);
      if (storedStageVersions) {
        try {
          setStageVersions(JSON.parse(storedStageVersions));
        } catch {
          // Use empty
        }
      }
    }
  }, []);

  // Save agent configuration with versioning
  const saveAgentConfig = (newWeights: ScoringWeights, newCriteria: Record<string, ScoringCriterion[]>) => {
    // Create version of current state
    const newVersion: AgentConfigVersion = {
      version: agentVersions.length + 1,
      timestamp: new Date().toISOString(),
      weights: scoringWeights,
      evaluators: evaluatorCriteria,
    };
    const updatedVersions = [...agentVersions, newVersion];
    setAgentVersions(updatedVersions);
    localStorage.setItem(AGENT_VERSIONS_KEY, JSON.stringify(updatedVersions));

    // Save new config
    setScoringWeights(newWeights);
    setEvaluatorCriteria(newCriteria);
    localStorage.setItem(AGENT_CONFIG_KEY, JSON.stringify({ weights: newWeights, evaluators: newCriteria }));
  };

  const handleSaveWeights = (newWeights: ScoringWeights) => {
    saveAgentConfig(newWeights, evaluatorCriteria);
    setShowWeightsModal(false);
  };

  const handleSaveEvaluator = (evaluatorId: string, weight: number, criteria: ScoringCriterion[]) => {
    const newWeights = { ...scoringWeights, [evaluatorId]: weight };
    const newCriteria = { ...evaluatorCriteria, [evaluatorId]: criteria };
    saveAgentConfig(newWeights, newCriteria);
    setShowEvaluatorModal(false);
  };

  const openEvaluatorEditor = (evaluatorId: string) => {
    setSelectedEvaluator(evaluatorId);
    setShowEvaluatorModal(true);
  };

  // Save prompt with versioning
  const handleSavePrompt = (promptId: string, newContent: string) => {
    const currentPrompt = prompts.find((p) => p.id === promptId);
    if (currentPrompt) {
      // Create version of current state
      const currentVersions = promptVersions[promptId] || [];
      const newVersion: PromptVersion = {
        version: currentVersions.length + 1,
        timestamp: new Date().toISOString(),
        content: currentPrompt.content,
      };
      const updatedVersions = { ...promptVersions, [promptId]: [...currentVersions, newVersion] };
      setPromptVersions(updatedVersions);
      localStorage.setItem(PROMPTS_VERSIONS_KEY, JSON.stringify(updatedVersions));

      // Update prompt content
      const updatedPrompts = prompts.map((p) =>
        p.id === promptId ? { ...p, content: newContent } : p
      );
      setPrompts(updatedPrompts);
      localStorage.setItem(PROMPTS_KEY, JSON.stringify(updatedPrompts));

      // Update selected prompt if it's the one being edited
      if (selectedPrompt?.id === promptId) {
        setSelectedPrompt({ ...selectedPrompt, content: newContent });
      }
    }
    setShowPromptModal(false);
  };

  const openPromptEditor = (prompt: PromptData) => {
    setSelectedPrompt(prompt);
    setShowPromptModal(true);
  };

  // Save stage with versioning
  const handleSaveStage = (stageNum: number, newPrompt: string, newBehaviors: string[]) => {
    const currentStage = pulseStages.find((s) => s.stage === stageNum);
    if (currentStage) {
      // Create version of current state
      const currentVersions = stageVersions[stageNum] || [];
      const newVersion: StageVersion = {
        version: currentVersions.length + 1,
        timestamp: new Date().toISOString(),
        prompt: currentStage.prompt,
        keyBehaviors: currentStage.keyBehaviors,
      };
      const updatedVersions = { ...stageVersions, [stageNum]: [...currentVersions, newVersion] };
      setStageVersions(updatedVersions);
      localStorage.setItem(STAGES_VERSIONS_KEY, JSON.stringify(updatedVersions));

      // Update stage
      const updatedStages = pulseStages.map((s) =>
        s.stage === stageNum ? { ...s, prompt: newPrompt, keyBehaviors: newBehaviors } : s
      );
      setPulseStages(updatedStages);
      localStorage.setItem(STAGES_KEY, JSON.stringify(updatedStages));

      // Update selected stage if it's the one being edited
      if (selectedStage?.stage === stageNum) {
        setSelectedStage({ ...selectedStage, prompt: newPrompt, keyBehaviors: newBehaviors });
      }
    }
    setShowStageModal(false);
  };

  const openStageEditor = (stage: PulseStage) => {
    setSelectedStage(stage);
    setShowStageModal(true);
  };

  // Save persona with versioning
  const handleSavePersona = (updatedPersona: Persona) => {
    // Create version of current state before saving
    const currentPersona = personas.find((p) => p.id === updatedPersona.id);
    if (currentPersona) {
      const currentVersions = personaVersions[updatedPersona.id] || [];
      const newVersion: PersonaVersion = {
        version: currentVersions.length + 1,
        timestamp: new Date().toISOString(),
        data: currentPersona,
      };
      const updatedVersions = {
        ...personaVersions,
        [updatedPersona.id]: [...currentVersions, newVersion],
      };
      setPersonaVersions(updatedVersions);
      localStorage.setItem(VERSIONS_KEY, JSON.stringify(updatedVersions));
    }

    // Update personas
    const updatedPersonas = personas.map((p) =>
      p.id === updatedPersona.id ? updatedPersona : p
    );
    setPersonas(updatedPersonas);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedPersonas));
    setShowEditModal(false);
  };

  // Revert to a previous version
  const handleRevertPersona = (personaId: string, version: number) => {
    const versions = personaVersions[personaId] || [];
    const targetVersion = versions.find((v) => v.version === version);
    if (targetVersion) {
      // Save current as new version before reverting
      const currentPersona = personas.find((p) => p.id === personaId);
      if (currentPersona) {
        const newVersion: PersonaVersion = {
          version: versions.length + 1,
          timestamp: new Date().toISOString(),
          data: currentPersona,
        };
        const updatedVersions = {
          ...personaVersions,
          [personaId]: [...versions, newVersion],
        };
        setPersonaVersions(updatedVersions);
        localStorage.setItem(VERSIONS_KEY, JSON.stringify(updatedVersions));
      }

      // Revert to target version
      const updatedPersonas = personas.map((p) =>
        p.id === personaId ? targetVersion.data : p
      );
      setPersonas(updatedPersonas);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedPersonas));
      setSelectedPersona(targetVersion.data);
    }
  };

  const openPersonaEditor = (persona: Persona) => {
    setSelectedPersona(persona);
    setShowEditModal(true);
  };

  const tabs: { id: TabType; label: string; count: number }[] = [
    { id: "personas", label: "Personas", count: personas.length },
    { id: "agents", label: "Agents", count: AGENTS.length },
    { id: "prompts", label: "Prompts", count: prompts.length },
    { id: "stages", label: "PULSE Stages", count: pulseStages.length },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">AI Components Overview</h1>
          <p className="text-sm text-gray-600 mt-1">
            All prompts, agents, and personas used in the PULSE sales training simulator
          </p>
        </div>
        <a
          href="/admin/avatars"
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2 text-sm font-medium"
        >
          <span>🎭</span>
          Manage Avatars
        </a>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-black text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {tab.label}
            <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-white/20">
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="space-y-4">
        {activeTab === "personas" && (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              {personas.map((persona) => (
                <button
                  key={persona.id}
                  onClick={() => openPersonaEditor(persona)}
                  className={`rounded-lg border-2 p-4 text-left transition-all hover:shadow-lg hover:scale-[1.02] cursor-pointer ${
                    persona.color === "red" ? "border-red-200 bg-red-50 hover:border-red-400" :
                    persona.color === "green" ? "border-green-200 bg-green-50 hover:border-green-400" :
                    persona.color === "yellow" ? "border-yellow-200 bg-yellow-50 hover:border-yellow-400" :
                    "border-blue-200 bg-blue-50 hover:border-blue-400"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">{persona.name}</h3>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-white/50">
                        {persona.difficulty}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {personaVersions[persona.id]?.length > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-black/10">
                          v{personaVersions[persona.id].length + 1}
                        </span>
                      )}
                      <div className="text-2xl">
                        {persona.id === "director" && "👔"}
                        {persona.id === "relater" && "🤝"}
                        {persona.id === "socializer" && "🎉"}
                        {persona.id === "thinker" && "🔬"}
                      </div>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-gray-700">{persona.description}</p>
                  <div className="mt-3 p-2 bg-white/50 rounded text-sm">
                    <div className="font-medium text-gray-600">System Prompt Summary:</div>
                    <div className="text-gray-700">{persona.systemPromptSummary}</div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 bg-white/50 rounded">
                      <div className="font-medium text-gray-600">Avatar</div>
                      <div>{persona.avatar.character} / {persona.avatar.style}</div>
                    </div>
                    <div className="p-2 bg-white/50 rounded">
                      <div className="font-medium text-gray-600">Voice</div>
                      <div>{persona.avatar.voice.replace("en-US-", "").replace("Neural", "")}</div>
                    </div>
                  </div>
                  <div className="mt-2 p-2 bg-white/50 rounded text-xs italic">
                    &ldquo;{persona.introText}&rdquo;
                  </div>
                  <div className="mt-3 flex items-center justify-end text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                      Click to edit
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {/* Persona Edit Modal */}
            {selectedPersona && (
              <PersonaEditModal
                persona={selectedPersona}
                versions={personaVersions[selectedPersona.id] || []}
                isOpen={showEditModal}
                onClose={() => setShowEditModal(false)}
                onSave={handleSavePersona}
                onRevert={(version) => handleRevertPersona(selectedPersona.id, version)}
              />
            )}
          </>
        )}

        {activeTab === "agents" && (
          <>
            <div className="space-y-4">
              {/* Scoring Weights - Clickable */}
              <button
                onClick={() => setShowWeightsModal(true)}
                className="w-full text-left p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-400 hover:shadow-lg transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Scoring Weights</h3>
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    Click to edit
                  </span>
                </div>
                <div className="mt-2 flex gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                    <span className="text-sm">BCE: {scoringWeights.bce}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span className="text-sm">MCF: {scoringWeights.mcf}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                    <span className="text-sm">CPO: {scoringWeights.cpo}%</span>
                  </div>
                </div>
                <div className="mt-2 text-sm text-gray-600">
                  Passing threshold: <span className="font-semibold">{scoringWeights.passingThreshold}%</span>
                </div>
              </button>

              {/* Chief Behavioral Certification Lead - Not clickable */}
              <div className="rounded-lg border border-gray-300 bg-gray-50 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">Chief Behavioral Certification Lead</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/50 uppercase">
                      orchestrator
                    </span>
                  </div>
                </div>
                <p className="mt-2 text-sm text-gray-700">
                  Primary agent that manages evaluation workflow and compiles the final Behavioral Certification Score
                </p>
                <div className="mt-3">
                  <div className="text-sm font-medium text-gray-600">Responsibilities:</div>
                  <ul className="mt-1 text-sm list-disc list-inside text-gray-700">
                    <li>Distribute transcript to all sub-agents</li>
                    <li>Aggregate scores and feedback</li>
                    <li>Calculate weighted average (BCE {scoringWeights.bce}%, MCF {scoringWeights.mcf}%, CPO {scoringWeights.cpo}%)</li>
                    <li>Determine pass/fail based on {scoringWeights.passingThreshold}% threshold</li>
                  </ul>
                </div>
              </div>

              {/* BCE - Clickable */}
              <button
                onClick={() => openEvaluatorEditor("bce")}
                className="w-full text-left rounded-lg border-2 border-blue-200 bg-blue-50 p-4 hover:border-blue-400 hover:shadow-lg transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">Behavioral Compliance Evaluator (BCE)</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/50 uppercase">
                      evaluator
                    </span>
                    <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-black text-white">
                      {scoringWeights.bce}% weight
                    </span>
                  </div>
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    Edit
                  </span>
                </div>
                <p className="mt-2 text-sm text-gray-700">
                  Scores trainee&apos;s mastery of the Platinum Rule and emotional engagement
                </p>
                <div className="mt-2 text-sm">
                  <span className="font-medium">Focus Area:</span> Step 1: Connect &amp; Discover
                </div>
                <div className="mt-3">
                  <div className="text-sm font-medium text-gray-600">Scoring Criteria:</div>
                  <div className="mt-1 grid gap-1">
                    {(evaluatorCriteria.bce || DEFAULT_EVALUATOR_CRITERIA.bce).map((c, i) => (
                      <div key={i} className="flex justify-between text-sm bg-white/50 px-2 py-1 rounded">
                        <span>{c.name}</span>
                        <span className="font-medium">{c.points} pts</span>
                      </div>
                    ))}
                  </div>
                </div>
              </button>

              {/* MCF - Clickable */}
              <button
                onClick={() => openEvaluatorEditor("mcf")}
                className="w-full text-left rounded-lg border-2 border-green-200 bg-green-50 p-4 hover:border-green-400 hover:shadow-lg transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">Methodology &amp; Content Fidelity Checker (MCF)</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/50 uppercase">
                      evaluator
                    </span>
                    <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-black text-white">
                      {scoringWeights.mcf}% weight
                    </span>
                  </div>
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    Edit
                  </span>
                </div>
                <p className="mt-2 text-sm text-gray-700">
                  Verifies mandatory execution of PULSE steps and communication tools
                </p>
                <div className="mt-2 text-sm">
                  <span className="font-medium">Focus Area:</span> PULSE Steps 1-4
                </div>
                <div className="mt-3">
                  <div className="text-sm font-medium text-gray-600">Scoring Criteria:</div>
                  <div className="mt-1 grid gap-1">
                    {(evaluatorCriteria.mcf || DEFAULT_EVALUATOR_CRITERIA.mcf).map((c, i) => (
                      <div key={i} className="flex justify-between text-sm bg-white/50 px-2 py-1 rounded">
                        <span>{c.name}</span>
                        <span className="font-medium">{c.points} pts</span>
                      </div>
                    ))}
                  </div>
                </div>
              </button>

              {/* CPO - Clickable */}
              <button
                onClick={() => openEvaluatorEditor("cpo")}
                className="w-full text-left rounded-lg border-2 border-purple-200 bg-purple-50 p-4 hover:border-purple-400 hover:shadow-lg transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">Conversion &amp; Psychological Outcome Assessor (CPO)</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/50 uppercase">
                      evaluator
                    </span>
                    <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-black text-white">
                      {scoringWeights.cpo}% weight
                    </span>
                  </div>
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    Edit
                  </span>
                </div>
                <p className="mt-2 text-sm text-gray-700">
                  Assesses deployment of psychological levers to drive conversion
                </p>
                <div className="mt-2 text-sm">
                  <span className="font-medium">Focus Area:</span> Step 4: Address Concerns &amp; Close Today
                </div>
                <div className="mt-3">
                  <div className="text-sm font-medium text-gray-600">Scoring Criteria:</div>
                  <div className="mt-1 grid gap-1">
                    {(evaluatorCriteria.cpo || DEFAULT_EVALUATOR_CRITERIA.cpo).map((c, i) => (
                      <div key={i} className="flex justify-between text-sm bg-white/50 px-2 py-1 rounded">
                        <span>{c.name}</span>
                        <span className="font-medium">{c.points} pts</span>
                      </div>
                    ))}
                  </div>
                </div>
              </button>
            </div>

            {/* Scoring Weights Modal */}
            <ScoringWeightsModal
              weights={scoringWeights}
              isOpen={showWeightsModal}
              onClose={() => setShowWeightsModal(false)}
              onSave={handleSaveWeights}
            />

            {/* Evaluator Edit Modal */}
            {selectedEvaluator && (
              <EvaluatorEditModal
                evaluatorId={selectedEvaluator}
                evaluatorName={
                  selectedEvaluator === "bce" ? "Behavioral Compliance Evaluator (BCE)" :
                  selectedEvaluator === "mcf" ? "Methodology & Content Fidelity Checker (MCF)" :
                  "Conversion & Psychological Outcome Assessor (CPO)"
                }
                weight={scoringWeights[selectedEvaluator as keyof ScoringWeights] as number}
                criteria={evaluatorCriteria[selectedEvaluator] || DEFAULT_EVALUATOR_CRITERIA[selectedEvaluator]}
                focusArea={
                  selectedEvaluator === "bce" ? "Step 1: Connect & Discover" :
                  selectedEvaluator === "mcf" ? "PULSE Steps 1-4" :
                  "Step 4: Address Concerns & Close Today"
                }
                description={
                  selectedEvaluator === "bce" ? "Scores trainee's mastery of the Platinum Rule and emotional engagement" :
                  selectedEvaluator === "mcf" ? "Verifies mandatory execution of PULSE steps and communication tools" :
                  "Assesses deployment of psychological levers to drive conversion"
                }
                isOpen={showEvaluatorModal}
                onClose={() => setShowEvaluatorModal(false)}
                onSave={handleSaveEvaluator}
              />
            )}
          </>
        )}

        {activeTab === "prompts" && (
          <>
            <div className="space-y-3">
              {prompts.map((prompt) => (
                <button
                  key={prompt.id}
                  onClick={() => openPromptEditor(prompt)}
                  className="w-full text-left rounded-lg border-2 border-gray-200 p-4 bg-white hover:border-gray-400 hover:shadow-lg transition-all cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">{prompt.title}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 uppercase">
                          {prompt.type}
                        </span>
                        {promptVersions[prompt.id]?.length > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                            v{promptVersions[prompt.id].length + 1}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded">{prompt.id}</code>
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                        Edit
                      </span>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-gray-700">{prompt.description}</p>
                  <div className="mt-2 text-xs text-gray-500">
                    <span className="font-medium">Used by:</span> {prompt.usedBy}
                  </div>
                  <div className="mt-3 p-2 bg-gray-50 rounded text-xs font-mono text-gray-600 max-h-20 overflow-hidden">
                    {prompt.content.substring(0, 150)}...
                  </div>
                </button>
              ))}
            </div>

            {/* Prompt Edit Modal */}
            {selectedPrompt && (
              <PromptEditModal
                prompt={selectedPrompt}
                versions={promptVersions[selectedPrompt.id] || []}
                isOpen={showPromptModal}
                onClose={() => setShowPromptModal(false)}
                onSave={handleSavePrompt}
              />
            )}
          </>
        )}

        {activeTab === "stages" && (
          <>
            <div className="space-y-4">
              {/* Stage Progress Indicator */}
              <div className="flex items-center gap-2 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
                {pulseStages.map((stage, i) => (
                  <div key={stage.stage} className="flex items-center">
                    <div className="flex flex-col items-center">
                      <div className={`w-10 h-10 rounded-full text-white flex items-center justify-center font-bold ${
                        stage.stage === 1 ? "bg-blue-500" :
                        stage.stage === 2 ? "bg-green-500" :
                        stage.stage === 3 ? "bg-yellow-500" :
                        stage.stage === 4 ? "bg-orange-500" :
                        "bg-purple-500"
                      }`}>
                        {stage.stage}
                      </div>
                      <div className="text-xs font-medium mt-1">{stage.name}</div>
                    </div>
                    {i < pulseStages.length - 1 && (
                      <div className="w-8 h-0.5 bg-gray-300 mx-1"></div>
                    )}
                  </div>
                ))}
              </div>

              {/* Stage Cards - Clickable */}
              {pulseStages.map((stage) => (
                <button
                  key={stage.stage}
                  onClick={() => openStageEditor(stage)}
                  className={`w-full text-left rounded-lg border-2 p-4 bg-white hover:shadow-lg transition-all cursor-pointer ${
                    stage.stage === 1 ? "border-blue-200 hover:border-blue-400" :
                    stage.stage === 2 ? "border-green-200 hover:border-green-400" :
                    stage.stage === 3 ? "border-yellow-200 hover:border-yellow-400" :
                    stage.stage === 4 ? "border-orange-200 hover:border-orange-400" :
                    "border-purple-200 hover:border-purple-400"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full text-white flex items-center justify-center font-bold ${
                        stage.stage === 1 ? "bg-blue-500" :
                        stage.stage === 2 ? "bg-green-500" :
                        stage.stage === 3 ? "bg-yellow-500" :
                        stage.stage === 4 ? "bg-orange-500" :
                        "bg-purple-500"
                      }`}>
                        {stage.stage}
                      </div>
                      <div>
                        <h3 className="font-semibold">{stage.name}</h3>
                        {stageVersions[stage.stage]?.length > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                            v{stageVersions[stage.stage].length + 1}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                      Edit
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-gray-700">{stage.description}</p>
                  <div className="mt-3">
                    <div className="text-sm font-medium text-gray-600">Key Behaviors:</div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {stage.keyBehaviors.map((behavior, i) => (
                        <span
                          key={i}
                          className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700"
                        >
                          {behavior}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="mt-3 p-2 bg-gray-50 rounded text-xs font-mono text-gray-600 max-h-16 overflow-hidden">
                    {stage.prompt.substring(0, 120)}...
                  </div>
                </button>
              ))}
            </div>

            {/* Stage Edit Modal */}
            {selectedStage && (
              <StageEditModal
                stage={selectedStage}
                versions={stageVersions[selectedStage.stage] || []}
                isOpen={showStageModal}
                onClose={() => setShowStageModal(false)}
                onSave={handleSaveStage}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
