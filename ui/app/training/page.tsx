"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

// ============================================================================
// PULSE STAGES DATA - Comprehensive training content for each stage
// ============================================================================
interface PulseStage {
  stage: number;
  name: string;
  letter: string;
  description: string;
  keyBehaviors: string[];
  objective: string;
  traineeShouldDo: string[];
  detectionCriteria: string[];
  advancementCriteria: string;
  beginnerTips: string[];
  advancedTechniques: string[];
  commonMistakes: string[];
  exampleScenario: {
    situation: string;
    goodResponse: string;
    whyItWorks: string;
  };
  practiceQuestion: string;
  color: string;
  bgGradient: string;
}

const PULSE_STAGES: PulseStage[] = [
  {
    stage: 1,
    name: "Probe",
    letter: "P",
    description: "Initial greeting, building rapport, discovering customer needs",
    keyBehaviors: ["Greeting", "Open-ended questions", "Active listening"],
    objective: "Establish rapport and begin discovering the customer's needs through genuine curiosity.",
    traineeShouldDo: [
      "Greet the customer warmly and professionally",
      "Use open-ended questions to understand why they're visiting",
      "Practice active listening - acknowledge what they share",
      "Avoid jumping to product pitches too early",
      "Build initial trust through authentic engagement",
    ],
    detectionCriteria: [
      "Customer has been greeted appropriately",
      "At least one discovery question has been asked",
      "Customer has shared initial reason for visit",
    ],
    advancementCriteria: "Move to Understand when customer has shared specific sleep issues or needs.",
    beginnerTips: [
      "Start with a genuine smile and warm greeting",
      "Ask 'What brings you in today?' rather than 'Can I help you?'",
      "Let the customer finish speaking before responding",
      "Take mental notes of key words they use",
    ],
    advancedTechniques: [
      "Mirror the customer's energy level and communication style",
      "Use the 'funnel technique' - start broad, then narrow down",
      "Notice non-verbal cues that indicate comfort or hesitation",
      "Create a 'safe space' for honest conversation",
    ],
    commonMistakes: [
      "Immediately launching into product features",
      "Asking closed yes/no questions",
      "Interrupting the customer",
      "Appearing distracted or disinterested",
    ],
    exampleScenario: {
      situation: "A couple walks into the store looking around at the beds.",
      goodResponse: "Good afternoon! Welcome to Sleep Number. I'm Sarah. What brings you both in today - are you exploring options for better sleep, or is there something specific on your mind?",
      whyItWorks: "This greeting is warm, introduces yourself, and asks an open-ended question that invites them to share their story rather than just say 'yes' or 'no'.",
    },
    practiceQuestion: "A customer enters looking tired and stressed. What would be your opening approach to make them feel welcome while discovering their needs?",
    color: "blue",
    bgGradient: "from-blue-500 to-blue-600",
  },
  {
    stage: 2,
    name: "Understand",
    letter: "U",
    description: "Deep dive into customer's situation, pain points, emotional reasons",
    keyBehaviors: ["Empathy", "Paraphrasing", "Identifying hot buttons"],
    objective: "Uncover the emotional drivers and pain points behind the customer's needs.",
    traineeShouldDo: [
      "Show genuine empathy for customer's sleep challenges",
      "Paraphrase what the customer shares to confirm understanding",
      "Identify 'hot buttons' - emotional triggers that drive decisions",
      "Ask follow-up questions to go deeper",
      "Connect sleep issues to quality of life impacts",
    ],
    detectionCriteria: [
      "Trainee has demonstrated empathy",
      "Customer's pain points have been acknowledged",
      "Emotional reasons for purchase are being explored",
    ],
    advancementCriteria: "Move to Link when emotional hot buttons have been identified.",
    beginnerTips: [
      "Use phrases like 'That sounds frustrating' or 'I can imagine how that affects you'",
      "Repeat back what you heard: 'So if I understand correctly...'",
      "Ask 'How does that make you feel?' to uncover emotions",
      "Look for the 'why behind the why'",
    ],
    advancedTechniques: [
      "Identify the 'hot button' - the emotional trigger that will drive the decision",
      "Connect sleep issues to broader life impacts (work, relationships, health)",
      "Use silence strategically to let customers elaborate",
      "Recognize buying signals in emotional statements",
    ],
    commonMistakes: [
      "Moving to solutions before fully understanding the problem",
      "Focusing only on logical needs, ignoring emotional drivers",
      "Failing to paraphrase and confirm understanding",
      "Making assumptions about what the customer wants",
    ],
    exampleScenario: {
      situation: "Customer mentions they wake up with back pain every morning.",
      goodResponse: "Back pain every morning - that must be exhausting. How long has this been going on? And when you wake up in pain like that, how does it affect the rest of your day?",
      whyItWorks: "This response acknowledges the pain emotionally, asks for more context, and connects the symptom to broader life impact - uncovering the 'hot button'.",
    },
    practiceQuestion: "A customer says 'My partner and I have different sleep preferences and it's causing arguments.' How would you explore this further to understand the emotional impact?",
    color: "green",
    bgGradient: "from-green-500 to-green-600",
  },
  {
    stage: 3,
    name: "Link",
    letter: "L",
    description: "Connecting product features to customer's specific needs",
    keyBehaviors: ["Feature-benefit linking", "Mini-talks", "Ownership language"],
    objective: "Connect Sleep Number features directly to the customer's specific needs and desires.",
    traineeShouldDo: [
      "Link product features to customer's stated pain points",
      "Use 'mini-talks' to explain benefits concisely",
      "Employ ownership language ('your bed', 'when you wake up')",
      "Reference the customer's specific situation",
      "Build value before discussing price",
    ],
    detectionCriteria: [
      "Features have been connected to customer needs",
      "Benefits are personalized to the customer",
      "Ownership language is being used",
    ],
    advancementCriteria: "Move to Solve when product recommendations have been made.",
    beginnerTips: [
      "Always tie features back to what the customer told you",
      "Use their exact words when describing benefits",
      "Say 'your bed' instead of 'the bed' or 'this bed'",
      "Keep mini-talks under 30 seconds",
    ],
    advancedTechniques: [
      "Create mental pictures: 'Imagine waking up without that back pain...'",
      "Use the 'Feel, Felt, Found' technique for common concerns",
      "Layer benefits to build cumulative value",
      "Connect features to their specific hot button identified earlier",
    ],
    commonMistakes: [
      "Listing features without connecting to customer needs",
      "Using generic benefit language that could apply to anyone",
      "Talking about the product instead of the customer's experience",
      "Overwhelming with too much information at once",
    ],
    exampleScenario: {
      situation: "Customer mentioned they wake up with back pain and it affects their work productivity.",
      goodResponse: "You mentioned that back pain is affecting your work. With your Sleep Number bed, you can adjust your firmness to find exactly what your back needs. Many customers tell me that once they found their number, they started waking up pain-free - imagine starting your workday feeling refreshed instead of stiff.",
      whyItWorks: "This links the adjustable firmness feature directly to their stated problem (back pain) and their hot button (work productivity), using ownership language and painting a picture of the outcome.",
    },
    practiceQuestion: "A customer told you they and their partner have different firmness preferences. How would you link the DualAir technology to their specific situation?",
    color: "yellow",
    bgGradient: "from-yellow-500 to-yellow-600",
  },
  {
    stage: 4,
    name: "Solve",
    letter: "S",
    description: "Presenting solutions, handling objections, demonstrating value",
    keyBehaviors: ["Objection handling (LERA)", "Financing options", "Value building"],
    objective: "Handle objections professionally and demonstrate the full value proposition.",
    traineeShouldDo: [
      "Use LERA framework for objections (Listen, Empathize, Respond, Ask)",
      "Present financing options when price concerns arise",
      "Continue building value through benefits",
      "Address concerns without being defensive",
      "Keep the conversation moving toward commitment",
    ],
    detectionCriteria: [
      "Objections are being handled professionally",
      "Value is being reinforced",
      "Solutions are being presented",
    ],
    advancementCriteria: "Move to Earn when objections are addressed and customer shows buying signals.",
    beginnerTips: [
      "Welcome objections - they show the customer is engaged",
      "Never argue or get defensive",
      "Use LERA: Listen fully, Empathize, Respond with value, Ask if that helps",
      "Have financing options ready to present naturally",
    ],
    advancedTechniques: [
      "Reframe price as investment in health and quality of life",
      "Use 'cost per night' calculations to put price in perspective",
      "Address the objection behind the objection",
      "Create urgency through value, not pressure",
    ],
    commonMistakes: [
      "Getting defensive when price is questioned",
      "Immediately offering discounts",
      "Ignoring objections or dismissing concerns",
      "Failing to circle back to the customer's hot button",
    ],
    exampleScenario: {
      situation: "Customer says 'This is more expensive than I expected.'",
      goodResponse: "I completely understand - it's a significant investment. Let me ask you this: you mentioned that back pain is affecting your work and you're not sleeping well. If this bed could give you back those productive mornings and restful nights, what would that be worth to you over the next 10-15 years? Also, we have financing options that can make this very manageable - would you like me to show you what that looks like?",
      whyItWorks: "This uses LERA - listens and empathizes, then responds by connecting back to their hot button and reframing the investment, then asks about financing.",
    },
    practiceQuestion: "A customer says 'I need to think about it and talk to my spouse.' How would you handle this objection using the LERA framework?",
    color: "orange",
    bgGradient: "from-orange-500 to-orange-600",
  },
  {
    stage: 5,
    name: "Earn",
    letter: "E",
    description: "Closing the sale, asking for commitment, finalizing the purchase",
    keyBehaviors: ["Assumptive close", "Professional recommendation", "3T's close"],
    objective: "Confidently ask for the sale and guide the customer to commitment.",
    traineeShouldDo: [
      "Use assumptive close language ('Let's get you set up...')",
      "Make a professional recommendation based on their needs",
      "Apply 3T's close (Today, Tomorrow, Together) when appropriate",
      "Create appropriate urgency without being pushy",
      "Celebrate the decision and reinforce it was the right choice",
    ],
    detectionCriteria: [
      "Closing attempt has been made",
      "Professional recommendation given",
      "Customer is being guided toward commitment",
    ],
    advancementCriteria: "Evaluate based on customer response to closing attempts.",
    beginnerTips: [
      "Don't be afraid to ask for the sale - you've earned it",
      "Use assumptive language: 'Let's get you set up' vs 'Would you like to buy?'",
      "Make a clear recommendation: 'Based on everything you've shared, I recommend...'",
      "Celebrate their decision to reinforce it was the right choice",
    ],
    advancedTechniques: [
      "Use the 3T's: Today (why now), Tomorrow (what they'll experience), Together (partnership)",
      "Create natural urgency through current promotions or delivery timing",
      "Handle last-minute hesitation by revisiting their hot button",
      "Set up the post-purchase experience to build loyalty",
    ],
    commonMistakes: [
      "Waiting for the customer to close themselves",
      "Being pushy or using high-pressure tactics",
      "Failing to make a clear recommendation",
      "Not celebrating and reinforcing the decision",
    ],
    exampleScenario: {
      situation: "Customer has tried the bed, objections are addressed, and they seem ready.",
      goodResponse: "Based on everything you've shared about your back pain and wanting to feel more productive at work, I'd recommend the Sleep Number i8 with the FlexFit base. Let's get you set up today so you can start sleeping better this week. We can have it delivered as early as Thursday - does that work for your schedule?",
      whyItWorks: "This makes a clear professional recommendation tied to their needs, uses assumptive close language, and creates natural urgency with delivery timing.",
    },
    practiceQuestion: "You've addressed all objections and the customer says 'This all sounds great.' What would you say to professionally close the sale?",
    color: "purple",
    bgGradient: "from-purple-500 to-purple-600",
  },
];

// ============================================================================
// EXPERIENCE LEVELS
// ============================================================================
type ExperienceLevel = "beginner" | "intermediate" | "advanced";

const EXPERIENCE_LEVELS = [
  {
    id: "beginner" as ExperienceLevel,
    name: "Beginner",
    description: "New to sales or the PULSE methodology",
    icon: "🌱",
  },
  {
    id: "intermediate" as ExperienceLevel,
    name: "Intermediate",
    description: "Some sales experience, learning PULSE",
    icon: "🌿",
  },
  {
    id: "advanced" as ExperienceLevel,
    name: "Advanced",
    description: "Experienced sales professional refining skills",
    icon: "🌳",
  },
];

// ============================================================================
// TRAINER VIDEO COMPONENT
// ============================================================================
const INTRO_PLAYED_KEY = "pulse_intro_played";

interface TrainerVideoProps {
  experienceLevel: ExperienceLevel | null;
  onSelectLevel: (level: ExperienceLevel) => void;
}

function TrainerVideo({ experienceLevel, onSelectLevel }: TrainerVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);

  useEffect(() => {
    // Check if intro has been played before
    const played = localStorage.getItem(INTRO_PLAYED_KEY);
    if (played === "true") {
      setHasPlayed(true);
      setShowOverlay(true);
    } else {
      // Auto-play on first visit
      if (videoRef.current) {
        videoRef.current.play().then(() => {
          setIsPlaying(true);
        }).catch(() => {
          // Autoplay blocked, show overlay
          setShowOverlay(true);
        });
      }
    }
  }, []);

  const handlePlay = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play();
      setIsPlaying(true);
      setShowOverlay(false);
    }
  };

  const handleVideoEnd = () => {
    setIsPlaying(false);
    setShowOverlay(true);
    setHasPlayed(true);
    localStorage.setItem(INTRO_PLAYED_KEY, "true");
  };

  const handleVideoPause = () => {
    setIsPlaying(false);
    setShowOverlay(true);
  };

  return (
    <div className="relative rounded-xl overflow-hidden bg-gradient-to-br from-blue-100 to-purple-100 shadow-lg">
      <div className="aspect-video relative">
        <video
          ref={videoRef}
          src="/intro.mp4"
          playsInline
          onEnded={handleVideoEnd}
          onPause={handleVideoPause}
          onPlay={() => { setIsPlaying(true); setShowOverlay(false); }}
          className="w-full h-full object-cover"
        />
        
        {/* Overlay with experience level selection */}
        {showOverlay && !isPlaying && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-black/60 via-black/50 to-black/70 p-6">
            {/* Experience Level Selection */}
            <div className="text-center mb-6">
              <h3 className="text-white text-xl font-semibold mb-2">
                {experienceLevel ? "Your Experience Level" : "Select Your Experience Level"}
              </h3>
              <p className="text-white/70 text-sm">
                {experienceLevel 
                  ? "Click to change or watch the intro again"
                  : "Choose the level that best matches your sales experience"
                }
              </p>
            </div>
            
            {/* Level Buttons */}
            <div className="flex flex-wrap justify-center gap-3 mb-6">
              {EXPERIENCE_LEVELS.map((level) => (
                <button
                  key={level.id}
                  onClick={() => onSelectLevel(level.id)}
                  className={`px-5 py-3 rounded-xl transition-all flex items-center gap-2 ${
                    experienceLevel === level.id
                      ? "bg-white text-gray-900 shadow-lg scale-105"
                      : "bg-white/20 text-white hover:bg-white/30 hover:scale-105"
                  }`}
                >
                  <span className="text-xl">{level.icon}</span>
                  <div className="text-left">
                    <div className="font-medium">{level.name}</div>
                    <div className={`text-xs ${experienceLevel === level.id ? "text-gray-500" : "text-white/60"}`}>
                      {level.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Play Again Button */}
            {hasPlayed && (
              <button
                onClick={handlePlay}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition-all text-sm"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                Watch Intro Again
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MASTERY STATUS COMPONENT
// ============================================================================
interface MasteryStatusProps {
  stages: { stage: number; name: string; score: number; status: "not_started" | "in_progress" | "mastered" }[];
}

function MasteryStatus({ stages }: MasteryStatusProps) {
  const overallProgress = stages.filter(s => s.status === "mastered").length / stages.length * 100;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Mastery Status</h3>
        <span className="text-sm text-gray-500">{Math.round(overallProgress)}% Complete</span>
      </div>
      
      {/* Progress Bar */}
      <div className="h-2 bg-gray-100 rounded-full mb-4 overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
          style={{ width: `${overallProgress}%` }}
        />
      </div>

      {/* Stage Progress */}
      <div className="space-y-2">
        {stages.map((stage) => (
          <div key={stage.stage} className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              stage.status === "mastered" 
                ? "bg-green-100 text-green-700" 
                : stage.status === "in_progress"
                ? "bg-yellow-100 text-yellow-700"
                : "bg-gray-100 text-gray-400"
            }`}>
              {stage.status === "mastered" ? "✓" : stage.stage}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">{stage.name}</span>
                <span className="text-xs text-gray-500">
                  {stage.status === "mastered" ? "Mastered" : stage.status === "in_progress" ? "In Progress" : "Not Started"}
                </span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-300 ${
                    stage.status === "mastered" 
                      ? "bg-green-500" 
                      : stage.status === "in_progress"
                      ? "bg-yellow-500"
                      : "bg-gray-200"
                  }`}
                  style={{ width: `${stage.score}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// RUBRIC COMPONENT
// ============================================================================
interface RubricProps {
  currentStage: PulseStage | null;
}

function Rubric({ currentStage }: RubricProps) {
  if (!currentStage) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <h3 className="font-semibold text-gray-900 mb-3">Rubric</h3>
        <p className="text-sm text-gray-500">Select a PULSE stage to see the rubric.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <div className={`w-8 h-8 rounded-full bg-${currentStage.color}-500 text-white flex items-center justify-center font-bold text-sm`}>
          {currentStage.letter}
        </div>
        <h3 className="font-semibold text-gray-900">Rubric — {currentStage.name}</h3>
      </div>

      <div className="space-y-4">
        <div>
          <h4 className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">Success Criteria</h4>
          <ul className="space-y-1">
            {currentStage.traineeShouldDo.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-green-500 mt-0.5">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-2">Common Mistakes</h4>
          <ul className="space-y-1">
            {currentStage.commonMistakes.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-red-500 mt-0.5">✗</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// TRAINER FEEDBACK COMPONENT
// ============================================================================
interface TrainerFeedbackProps {
  feedback: string | null;
  nextQuestion: string | null;
}

function TrainerFeedback({ feedback, nextQuestion }: TrainerFeedbackProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <h3 className="font-semibold text-gray-900 mb-3">Trainer Feedback</h3>
      <div className="text-sm text-gray-700">
        {feedback || "Complete a practice exercise to receive personalized feedback."}
      </div>
      {nextQuestion && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <span className="text-xs font-semibold text-gray-500 uppercase">Next Question</span>
          <p className="text-sm text-gray-700 mt-1">{nextQuestion}</p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN TRAINING PAGE
// ============================================================================
export default function TrainingPage() {
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel | null>(null);
  const [selectedStage, setSelectedStage] = useState<PulseStage | null>(null);
  const [trainerFeedback, setTrainerFeedback] = useState<string | null>(null);
  const [nextQuestion, setNextQuestion] = useState<string | null>(null);
  const [masteryStages, setMasteryStages] = useState(
    PULSE_STAGES.map(s => ({
      stage: s.stage,
      name: s.name,
      score: 0,
      status: "not_started" as const,
    }))
  );

  // Load saved progress from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedLevel = localStorage.getItem("pulse_training_level");
      if (savedLevel) {
        setExperienceLevel(savedLevel as ExperienceLevel);
      }
      const savedMastery = localStorage.getItem("pulse_training_mastery");
      if (savedMastery) {
        try {
          setMasteryStages(JSON.parse(savedMastery));
        } catch {
          // Use defaults
        }
      }
    }
  }, []);

  const handleSelectLevel = (level: ExperienceLevel) => {
    setExperienceLevel(level);
    localStorage.setItem("pulse_training_level", level);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <span className="text-white font-bold text-lg">P</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">PULSE Sales Training</h1>
              <p className="text-sm text-gray-600">Master the art of consultative selling for high-value products</p>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Trainer Video Introduction */}
            <TrainerVideo experienceLevel={experienceLevel} onSelectLevel={handleSelectLevel} />

            {/* Experience Level Selection */}
            {!experienceLevel && (
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Your Experience Level</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {EXPERIENCE_LEVELS.map((level) => (
                    <button
                      key={level.id}
                      onClick={() => handleSelectLevel(level.id)}
                      className="p-4 rounded-xl border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-all text-left group"
                    >
                      <div className="text-3xl mb-2">{level.icon}</div>
                      <h3 className="font-semibold text-gray-900 group-hover:text-blue-700">{level.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">{level.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* PULSE Overview */}
            {experienceLevel && (
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">The PULSE Methodology</h2>
                  <button
                    onClick={() => {
                      setExperienceLevel(null);
                      localStorage.removeItem("pulse_training_level");
                    }}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Change Level
                  </button>
                </div>
                
                <p className="text-sm text-gray-600 mb-6">
                  PULSE is designed for selling high-value products through genuine connection and understanding. 
                  Unlike pushy car-salesperson tactics, PULSE builds trust and helps customers feel confident in their decision.
                </p>

                {/* PULSE Steps Visual */}
                <div className="flex items-center justify-between mb-6 overflow-x-auto pb-2">
                  {PULSE_STAGES.map((stage, idx) => (
                    <div key={stage.stage} className="flex items-center">
                      <div className="flex flex-col items-center">
                        <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${stage.bgGradient} text-white flex items-center justify-center font-bold text-lg shadow-lg`}>
                          {stage.letter}
                        </div>
                        <span className="text-xs font-medium mt-2 text-gray-700">{stage.name}</span>
                      </div>
                      {idx < PULSE_STAGES.length - 1 && (
                        <div className="w-8 h-0.5 bg-gray-300 mx-2"></div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Stage Cards */}
                <div className="space-y-3">
                  {PULSE_STAGES.map((stage) => (
                    <Link
                      key={stage.stage}
                      href={`/training/${stage.stage}`}
                      className={`block p-4 rounded-xl border-2 hover:shadow-lg transition-all ${
                        stage.stage === 1 ? "border-blue-200 hover:border-blue-400 bg-blue-50/50" :
                        stage.stage === 2 ? "border-green-200 hover:border-green-400 bg-green-50/50" :
                        stage.stage === 3 ? "border-yellow-200 hover:border-yellow-400 bg-yellow-50/50" :
                        stage.stage === 4 ? "border-orange-200 hover:border-orange-400 bg-orange-50/50" :
                        "border-purple-200 hover:border-purple-400 bg-purple-50/50"
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${stage.bgGradient} text-white flex items-center justify-center font-bold flex-shrink-0`}>
                          {stage.letter}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-gray-900">{stage.name}</h3>
                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{stage.description}</p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {stage.keyBehaviors.map((behavior, idx) => (
                              <span key={idx} className="text-xs px-2 py-1 rounded-full bg-white/80 text-gray-600 border border-gray-200">
                                {behavior}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Why PULSE is Different */}
            {experienceLevel && (
              <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-6 text-white shadow-lg">
                <h2 className="text-lg font-semibold mb-4">Why PULSE is Different</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white/10 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-red-400">✗</span>
                      <span className="font-medium">Traditional Sales</span>
                    </div>
                    <ul className="text-sm text-gray-300 space-y-1">
                      <li>• Push products immediately</li>
                      <li>• Focus on features and specs</li>
                      <li>• High-pressure closing tactics</li>
                      <li>• Transactional relationship</li>
                    </ul>
                  </div>
                  <div className="bg-white/10 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-green-400">✓</span>
                      <span className="font-medium">PULSE Approach</span>
                    </div>
                    <ul className="text-sm text-gray-300 space-y-1">
                      <li>• Discover needs first</li>
                      <li>• Connect to emotional drivers</li>
                      <li>• Professional recommendations</li>
                      <li>• Trusted advisor relationship</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* User Info */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                  D
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-gray-900">Demo User</div>
                  <div className="text-sm text-gray-500">
                    {experienceLevel 
                      ? `${EXPERIENCE_LEVELS.find(l => l.id === experienceLevel)?.icon} ${EXPERIENCE_LEVELS.find(l => l.id === experienceLevel)?.name}`
                      : "Select level above"
                    }
                  </div>
                </div>
              </div>
            </div>

            {/* Rubric */}
            <Rubric currentStage={selectedStage || PULSE_STAGES[0]} />

            {/* Trainer Feedback */}
            <TrainerFeedback feedback={trainerFeedback} nextQuestion={nextQuestion} />

            {/* Mastery Status */}
            <MasteryStatus stages={masteryStages} />

            {/* Quick Actions */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-3">Quick Actions</h3>
              <div className="space-y-2">
                <Link
                  href="/pre-session"
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">Practice Simulation</div>
                    <div className="text-xs text-gray-500">Role-play with AI customer</div>
                  </div>
                </Link>
                <Link
                  href="/feedback"
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">View Scorecard</div>
                    <div className="text-xs text-gray-500">Review past performance</div>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

