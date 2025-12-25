"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

// ============================================================================
// PULSE STAGES DATA - Same as main training page
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
// EXPERIENCE LEVEL TYPE
// ============================================================================
type ExperienceLevel = "beginner" | "intermediate" | "advanced";

// ============================================================================
// PRACTICE SCENARIOS FOR EACH STAGE
// ============================================================================
interface PracticeScenario {
  id: string;
  title: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  situation: string;
  customerType: string;
  hint: string;
}

const PRACTICE_SCENARIOS: Record<number, PracticeScenario[]> = {
  1: [
    {
      id: "probe-1",
      title: "The Quiet Browser",
      difficulty: "beginner",
      situation: "A customer walks in and starts looking at beds without making eye contact. They seem hesitant to engage.",
      customerType: "Introverted, needs space",
      hint: "Give them a moment, then approach with a soft, non-threatening greeting.",
    },
    {
      id: "probe-2",
      title: "The Couple with Different Needs",
      difficulty: "intermediate",
      situation: "A couple enters, and one seems excited while the other looks skeptical with arms crossed.",
      customerType: "Mixed engagement levels",
      hint: "Acknowledge both, find common ground, and address the skeptic's concerns early.",
    },
    {
      id: "probe-3",
      title: "The Researcher",
      difficulty: "advanced",
      situation: "A customer comes in with printed reviews and competitor comparisons, asking very specific technical questions.",
      customerType: "Analytical, detail-oriented",
      hint: "Match their energy with facts, but redirect to understanding their personal needs.",
    },
  ],
  2: [
    {
      id: "understand-1",
      title: "Surface-Level Answers",
      difficulty: "beginner",
      situation: "Customer says 'I just need a new bed' and doesn't elaborate when asked why.",
      customerType: "Reserved, guarded",
      hint: "Use gentle follow-up questions and share relatable examples to open them up.",
    },
    {
      id: "understand-2",
      title: "The Emotional Buyer",
      difficulty: "intermediate",
      situation: "Customer mentions their spouse recently passed away and they can't sleep in their old bed anymore.",
      customerType: "Grieving, emotional",
      hint: "Lead with empathy, don't rush to solutions, acknowledge the emotional weight.",
    },
    {
      id: "understand-3",
      title: "The Health-Focused Customer",
      difficulty: "advanced",
      situation: "Customer has chronic pain issues and has tried many solutions. They're skeptical anything will help.",
      customerType: "Skeptical, experienced",
      hint: "Validate their experience, ask about what has and hasn't worked, find the specific pain points.",
    },
  ],
  3: [
    {
      id: "link-1",
      title: "Feature Overload",
      difficulty: "beginner",
      situation: "You've learned the customer has back pain. Now you need to explain how Sleep Number helps without overwhelming them.",
      customerType: "Needs simple explanations",
      hint: "Focus on ONE feature that directly addresses their main concern.",
    },
    {
      id: "link-2",
      title: "The Tech-Savvy Customer",
      difficulty: "intermediate",
      situation: "Customer is interested in the sleep tracking features but you need to connect it to their stated goal of better energy.",
      customerType: "Technology enthusiast",
      hint: "Link the data/insights to their desired outcome, not just the cool features.",
    },
    {
      id: "link-3",
      title: "The Value Seeker",
      difficulty: "advanced",
      situation: "Customer mentioned they want quality but also mentioned budget concerns. You need to build value before price comes up.",
      customerType: "Price-conscious but quality-focused",
      hint: "Use ownership language and paint a picture of long-term value and daily benefits.",
    },
  ],
  4: [
    {
      id: "solve-1",
      title: "The Price Objection",
      difficulty: "beginner",
      situation: "Customer says 'This is way more than I wanted to spend.'",
      customerType: "Budget-conscious",
      hint: "Use LERA: Listen, Empathize, Respond with value, Ask about financing.",
    },
    {
      id: "solve-2",
      title: "The Spouse Card",
      difficulty: "intermediate",
      situation: "Customer says 'I need to talk to my husband/wife before making a decision.'",
      customerType: "Joint decision maker",
      hint: "Respect the need while exploring if there are specific concerns to address.",
    },
    {
      id: "solve-3",
      title: "The Competitor Comparison",
      difficulty: "advanced",
      situation: "Customer says 'I saw a similar bed at [competitor] for less. Why should I pay more here?'",
      customerType: "Comparison shopper",
      hint: "Don't bash competitors. Focus on unique value and their specific needs.",
    },
  ],
  5: [
    {
      id: "earn-1",
      title: "The Ready Buyer",
      difficulty: "beginner",
      situation: "Customer has tried the bed, loves it, and says 'This feels amazing.' They're waiting for you to guide them.",
      customerType: "Ready to buy",
      hint: "Make a clear recommendation and use assumptive close language.",
    },
    {
      id: "earn-2",
      title: "The Hesitant Yes",
      difficulty: "intermediate",
      situation: "Customer says 'I think this is the one...' but trails off and looks uncertain.",
      customerType: "Almost ready, needs reassurance",
      hint: "Acknowledge their choice, reinforce the benefits, and gently guide to next steps.",
    },
    {
      id: "earn-3",
      title: "The Last-Minute Doubt",
      difficulty: "advanced",
      situation: "Customer was ready to buy but suddenly says 'Wait, maybe I should sleep on this decision.'",
      customerType: "Cold feet",
      hint: "Revisit their hot button, use 3T's (Today, Tomorrow, Together), create natural urgency.",
    },
  ],
};

// ============================================================================
// MAIN STAGE DETAIL PAGE
// ============================================================================
export default function StageDetailPage() {
  const params = useParams();
  const router = useRouter();
  const stageNum = parseInt(params.stage as string);
  const stage = PULSE_STAGES.find(s => s.stage === stageNum);
  
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>("beginner");
  const [activeTab, setActiveTab] = useState<"learn" | "practice" | "examples">("learn");
  const [selectedScenario, setSelectedScenario] = useState<PracticeScenario | null>(null);
  const [userResponse, setUserResponse] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedLevel = localStorage.getItem("pulse_training_level");
      if (savedLevel) {
        setExperienceLevel(savedLevel as ExperienceLevel);
      }
    }
  }, []);

  if (!stage) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Stage Not Found</h1>
          <p className="text-gray-600 mb-4">The requested PULSE stage does not exist.</p>
          <Link href="/training" className="text-blue-600 hover:underline">
            Return to Training
          </Link>
        </div>
      </div>
    );
  }

  const scenarios = PRACTICE_SCENARIOS[stageNum] || [];
  const filteredScenarios = scenarios.filter(s => 
    experienceLevel === "advanced" ? true :
    experienceLevel === "intermediate" ? s.difficulty !== "advanced" :
    s.difficulty === "beginner"
  );

  const prevStage = stageNum > 1 ? PULSE_STAGES.find(s => s.stage === stageNum - 1) : null;
  const nextStage = stageNum < 5 ? PULSE_STAGES.find(s => s.stage === stageNum + 1) : null;

  const handleSubmitResponse = async () => {
    if (!userResponse.trim()) return;
    setIsSubmitting(true);
    // Simulate API call for feedback
    await new Promise(resolve => setTimeout(resolve, 1000));
    setShowFeedback(true);
    setIsSubmitting(false);
  };

  const getColorClasses = (stageNum: number) => {
    switch (stageNum) {
      case 1: return { bg: "bg-blue-500", border: "border-blue-200", light: "bg-blue-50", text: "text-blue-700" };
      case 2: return { bg: "bg-green-500", border: "border-green-200", light: "bg-green-50", text: "text-green-700" };
      case 3: return { bg: "bg-yellow-500", border: "border-yellow-200", light: "bg-yellow-50", text: "text-yellow-700" };
      case 4: return { bg: "bg-orange-500", border: "border-orange-200", light: "bg-orange-50", text: "text-orange-700" };
      case 5: return { bg: "bg-purple-500", border: "border-purple-200", light: "bg-purple-50", text: "text-purple-700" };
      default: return { bg: "bg-gray-500", border: "border-gray-200", light: "bg-gray-50", text: "text-gray-700" };
    }
  };

  const colors = getColorClasses(stageNum);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-600 mb-6">
          <Link href="/training" className="hover:text-gray-900">Training</Link>
          <span>/</span>
          <span className="text-gray-900 font-medium">Stage {stageNum}: {stage.name}</span>
        </div>

        {/* Header */}
        <div className={`rounded-2xl ${colors.light} ${colors.border} border-2 p-6 mb-8`}>
          <div className="flex items-start gap-4">
            <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${stage.bgGradient} text-white flex items-center justify-center font-bold text-2xl shadow-lg`}>
              {stage.letter}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-gray-900">{stage.name}</h1>
                <span className={`text-xs px-2 py-1 rounded-full ${colors.light} ${colors.text} font-medium`}>
                  Stage {stageNum} of 5
                </span>
              </div>
              <p className="text-gray-600 text-lg">{stage.description}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                {stage.keyBehaviors.map((behavior, idx) => (
                  <span key={idx} className="text-sm px-3 py-1 rounded-full bg-white/80 text-gray-700 border border-gray-200">
                    {behavior}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Stage Navigation */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            {PULSE_STAGES.map((s) => (
              <Link
                key={s.stage}
                href={`/training/${s.stage}`}
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${
                  s.stage === stageNum
                    ? `bg-gradient-to-br ${s.bgGradient} text-white shadow-lg scale-110`
                    : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                }`}
              >
                {s.letter}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {prevStage && (
              <Link
                href={`/training/${prevStage.stage}`}
                className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                {prevStage.name}
              </Link>
            )}
            {nextStage && (
              <Link
                href={`/training/${nextStage.stage}`}
                className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {nextStage.name}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
          {[
            { id: "learn" as const, label: "Learn", icon: "📚" },
            { id: "practice" as const, label: "Practice", icon: "🎯" },
            { id: "examples" as const, label: "Examples", icon: "💡" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                activeTab === tab.id
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Learn Tab */}
            {activeTab === "learn" && (
              <>
                {/* Objective */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <span className="text-2xl">🎯</span> Objective
                  </h2>
                  <p className="text-gray-700 text-lg">{stage.objective}</p>
                </div>

                {/* What You Should Do */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="text-2xl">✅</span> What You Should Do
                  </h2>
                  <ul className="space-y-3">
                    {stage.traineeShouldDo.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <span className={`w-6 h-6 rounded-full ${colors.bg} text-white flex items-center justify-center text-xs font-bold flex-shrink-0`}>
                          {idx + 1}
                        </span>
                        <span className="text-gray-700">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Tips by Experience Level */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="text-2xl">{experienceLevel === "beginner" ? "🌱" : experienceLevel === "intermediate" ? "🌿" : "🌳"}</span>
                    {experienceLevel === "beginner" ? "Beginner Tips" : experienceLevel === "intermediate" ? "Intermediate Techniques" : "Advanced Techniques"}
                  </h2>
                  <ul className="space-y-2">
                    {(experienceLevel === "advanced" ? stage.advancedTechniques : stage.beginnerTips).map((tip, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-gray-700">
                        <span className={colors.text}>•</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Common Mistakes */}
                <div className="bg-red-50 rounded-xl border border-red-200 p-6">
                  <h2 className="text-lg font-semibold text-red-900 mb-4 flex items-center gap-2">
                    <span className="text-2xl">⚠️</span> Common Mistakes to Avoid
                  </h2>
                  <ul className="space-y-2">
                    {stage.commonMistakes.map((mistake, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-red-800">
                        <span className="text-red-500">✗</span>
                        {mistake}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Advancement Criteria */}
                <div className={`${colors.light} rounded-xl border ${colors.border} p-6`}>
                  <h2 className={`text-lg font-semibold ${colors.text} mb-3 flex items-center gap-2`}>
                    <span className="text-2xl">🚀</span> When to Move to Next Stage
                  </h2>
                  <p className="text-gray-700">{stage.advancementCriteria}</p>
                </div>
              </>
            )}

            {/* Practice Tab */}
            {activeTab === "practice" && (
              <>
                {/* Trainer Question */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <span className="text-2xl">❓</span> Trainer Question
                  </h2>
                  <p className="text-gray-700 text-lg mb-4">{stage.practiceQuestion}</p>
                  <textarea
                    value={userResponse}
                    onChange={(e) => {
                      setUserResponse(e.target.value);
                      setShowFeedback(false);
                    }}
                    placeholder="Type your response here..."
                    className="w-full h-32 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                  <div className="flex justify-between items-center mt-4">
                    <span className="text-sm text-gray-500">{userResponse.length} characters</span>
                    <button
                      onClick={handleSubmitResponse}
                      disabled={!userResponse.trim() || isSubmitting}
                      className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                        userResponse.trim() && !isSubmitting
                          ? `bg-gradient-to-r ${stage.bgGradient} text-white hover:opacity-90`
                          : "bg-gray-200 text-gray-500 cursor-not-allowed"
                      }`}
                    >
                      {isSubmitting ? "Analyzing..." : "Submit Response"}
                    </button>
                  </div>
                </div>

                {/* Feedback */}
                {showFeedback && (
                  <div className="bg-green-50 rounded-xl border border-green-200 p-6">
                    <h2 className="text-lg font-semibold text-green-900 mb-3 flex items-center gap-2">
                      <span className="text-2xl">💬</span> Trainer Feedback
                    </h2>
                    <p className="text-gray-700 mb-4">
                      Good effort! Here are some observations about your response:
                    </p>
                    <ul className="space-y-2 text-gray-700">
                      <li className="flex items-start gap-2">
                        <span className="text-green-500">✓</span>
                        You addressed the customer&apos;s situation directly.
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-yellow-500">!</span>
                        Consider using more open-ended questions to encourage dialogue.
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-500">→</span>
                        Try incorporating ownership language like &quot;your&quot; and &quot;you&apos;ll experience&quot;.
                      </li>
                    </ul>
                  </div>
                )}

                {/* Practice Scenarios */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="text-2xl">🎭</span> Practice Scenarios
                  </h2>
                  <div className="space-y-3">
                    {filteredScenarios.map((scenario) => (
                      <button
                        key={scenario.id}
                        onClick={() => setSelectedScenario(selectedScenario?.id === scenario.id ? null : scenario)}
                        className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                          selectedScenario?.id === scenario.id
                            ? `${colors.border} ${colors.light}`
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-medium text-gray-900">{scenario.title}</h3>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              scenario.difficulty === "beginner" ? "bg-green-100 text-green-700" :
                              scenario.difficulty === "intermediate" ? "bg-yellow-100 text-yellow-700" :
                              "bg-red-100 text-red-700"
                            }`}>
                              {scenario.difficulty}
                            </span>
                          </div>
                          <svg className={`w-5 h-5 text-gray-400 transition-transform ${selectedScenario?.id === scenario.id ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                        {selectedScenario?.id === scenario.id && (
                          <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
                            <div>
                              <span className="text-xs font-semibold text-gray-500 uppercase">Situation</span>
                              <p className="text-gray-700 mt-1">{scenario.situation}</p>
                            </div>
                            <div>
                              <span className="text-xs font-semibold text-gray-500 uppercase">Customer Type</span>
                              <p className="text-gray-700 mt-1">{scenario.customerType}</p>
                            </div>
                            <div className={`p-3 rounded-lg ${colors.light}`}>
                              <span className={`text-xs font-semibold ${colors.text} uppercase`}>Hint</span>
                              <p className="text-gray-700 mt-1">{scenario.hint}</p>
                            </div>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Examples Tab */}
            {activeTab === "examples" && (
              <>
                {/* Example Scenario */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="text-2xl">📖</span> Example Scenario
                  </h2>
                  
                  <div className="space-y-4">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <span className="text-xs font-semibold text-gray-500 uppercase">Situation</span>
                      <p className="text-gray-700 mt-1">{stage.exampleScenario.situation}</p>
                    </div>
                    
                    <div className={`p-4 ${colors.light} rounded-lg border ${colors.border}`}>
                      <span className={`text-xs font-semibold ${colors.text} uppercase`}>Good Response</span>
                      <p className="text-gray-800 mt-1 italic">&quot;{stage.exampleScenario.goodResponse}&quot;</p>
                    </div>
                    
                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                      <span className="text-xs font-semibold text-green-700 uppercase">Why It Works</span>
                      <p className="text-gray-700 mt-1">{stage.exampleScenario.whyItWorks}</p>
                    </div>
                  </div>
                </div>

                {/* Key Phrases */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="text-2xl">💬</span> Key Phrases for {stage.name}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {stageNum === 1 && (
                      <>
                        <div className="p-3 bg-gray-50 rounded-lg text-sm">&quot;What brings you in today?&quot;</div>
                        <div className="p-3 bg-gray-50 rounded-lg text-sm">&quot;Tell me more about that...&quot;</div>
                        <div className="p-3 bg-gray-50 rounded-lg text-sm">&quot;How long has this been going on?&quot;</div>
                        <div className="p-3 bg-gray-50 rounded-lg text-sm">&quot;What have you tried so far?&quot;</div>
                      </>
                    )}
                    {stageNum === 2 && (
                      <>
                        <div className="p-3 bg-gray-50 rounded-lg text-sm">&quot;That sounds frustrating...&quot;</div>
                        <div className="p-3 bg-gray-50 rounded-lg text-sm">&quot;So if I understand correctly...&quot;</div>
                        <div className="p-3 bg-gray-50 rounded-lg text-sm">&quot;How does that affect your day?&quot;</div>
                        <div className="p-3 bg-gray-50 rounded-lg text-sm">&quot;What would it mean to you if...&quot;</div>
                      </>
                    )}
                    {stageNum === 3 && (
                      <>
                        <div className="p-3 bg-gray-50 rounded-lg text-sm">&quot;Based on what you shared...&quot;</div>
                        <div className="p-3 bg-gray-50 rounded-lg text-sm">&quot;With your Sleep Number bed...&quot;</div>
                        <div className="p-3 bg-gray-50 rounded-lg text-sm">&quot;Imagine waking up and...&quot;</div>
                        <div className="p-3 bg-gray-50 rounded-lg text-sm">&quot;This means you&apos;ll be able to...&quot;</div>
                      </>
                    )}
                    {stageNum === 4 && (
                      <>
                        <div className="p-3 bg-gray-50 rounded-lg text-sm">&quot;I completely understand...&quot;</div>
                        <div className="p-3 bg-gray-50 rounded-lg text-sm">&quot;Let me ask you this...&quot;</div>
                        <div className="p-3 bg-gray-50 rounded-lg text-sm">&quot;What would it be worth to you...&quot;</div>
                        <div className="p-3 bg-gray-50 rounded-lg text-sm">&quot;We have options that can help...&quot;</div>
                      </>
                    )}
                    {stageNum === 5 && (
                      <>
                        <div className="p-3 bg-gray-50 rounded-lg text-sm">&quot;Based on everything you&apos;ve shared, I recommend...&quot;</div>
                        <div className="p-3 bg-gray-50 rounded-lg text-sm">&quot;Let&apos;s get you set up...&quot;</div>
                        <div className="p-3 bg-gray-50 rounded-lg text-sm">&quot;We can have it delivered by...&quot;</div>
                        <div className="p-3 bg-gray-50 rounded-lg text-sm">&quot;You&apos;ve made a great choice...&quot;</div>
                      </>
                    )}
                  </div>
                </div>

                {/* Video Examples Placeholder */}
                <div className="bg-gray-100 rounded-xl border border-gray-200 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <span className="text-2xl">🎬</span> Video Examples
                  </h2>
                  <p className="text-gray-600 mb-4">Watch real examples of the {stage.name} stage in action.</p>
                  <div className="aspect-video bg-gray-200 rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <svg className="w-16 h-16 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-gray-500">Video examples coming soon</p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Progress Card */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-3">Your Progress</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Stage Completion</span>
                  <span className="font-medium">0%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full ${colors.bg} rounded-full`} style={{ width: "0%" }} />
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>0/3 exercises completed</span>
                </div>
              </div>
            </div>

            {/* Detection Criteria */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-3">Detection Criteria</h3>
              <p className="text-xs text-gray-500 mb-3">How the AI evaluates this stage:</p>
              <ul className="space-y-2">
                {stage.detectionCriteria.map((criteria, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className={colors.text}>•</span>
                    {criteria}
                  </li>
                ))}
              </ul>
            </div>

            {/* Quick Links */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-3">Quick Actions</h3>
              <div className="space-y-2">
                <Link
                  href="/pre-session"
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className={`w-8 h-8 rounded-lg ${colors.light} flex items-center justify-center`}>
                    <svg className={`w-4 h-4 ${colors.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">Practice This Stage</div>
                    <div className="text-xs text-gray-500">Role-play simulation</div>
                  </div>
                </Link>
                <Link
                  href="/training"
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">All Stages</div>
                    <div className="text-xs text-gray-500">Return to overview</div>
                  </div>
                </Link>
              </div>
            </div>

            {/* Related Frameworks */}
            {stageNum === 4 && (
              <div className={`${colors.light} rounded-xl border ${colors.border} p-4`}>
                <h3 className={`font-semibold ${colors.text} mb-3`}>LERA Framework</h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-gray-700">L</span>
                    <span className="text-gray-600">Listen - Hear the full objection</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-gray-700">E</span>
                    <span className="text-gray-600">Empathize - Acknowledge their concern</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-gray-700">R</span>
                    <span className="text-gray-600">Respond - Address with value</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-gray-700">A</span>
                    <span className="text-gray-600">Ask - Check if that helps</span>
                  </li>
                </ul>
              </div>
            )}

            {stageNum === 5 && (
              <div className={`${colors.light} rounded-xl border ${colors.border} p-4`}>
                <h3 className={`font-semibold ${colors.text} mb-3`}>3T&apos;s Close</h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-gray-700">Today</span>
                    <span className="text-gray-600">Why act now</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-gray-700">Tomorrow</span>
                    <span className="text-gray-600">What they&apos;ll experience</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-gray-700">Together</span>
                    <span className="text-gray-600">Partnership going forward</span>
                  </li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
