"""
PULSE Engine - Core business logic for the training platform.

Handles persona management, misstep detection, stage advancement, and scoring.
"""

import re
from typing import Any, Dict, List


# PULSE stage definitions
PULSE_STAGES = {
    1: {"name": "Probe", "description": "Ask open-ended questions to understand customer needs"},
    2: {"name": "Understand", "description": "Reflect back and confirm understanding"},
    3: {"name": "Link", "description": "Connect product features to customer needs"},
    4: {"name": "Solve", "description": "Present solutions and handle objections"},
    5: {"name": "Earn", "description": "Close the sale professionally"},
}

# Voice ID to human name mapping (extracted from Azure Neural voice names)
# This maps the OpenAI-style voice IDs to the human names used by the avatar
# The customer name is derived from the voice so the AI persona uses the same name as the avatar's voice
VOICE_NAME_MAP = {
    # OpenAI TTS voices
    "alloy": "Aria",
    "echo": "Guy",
    "fable": "Sonia",
    "onyx": "Christopher",
    "nova": "Jenny",
    "shimmer": "Michelle",
    # Edge TTS / Azure Neural voices - Female
    "en-US-JennyNeural": "Jenny",
    "en-US-SaraNeural": "Sara",
    "en-US-AriaNeural": "Aria",
    "en-US-MichelleNeural": "Michelle",
    "en-US-AmberNeural": "Amber",
    "en-US-AshleyNeural": "Ashley",
    "en-US-CoraNeural": "Cora",
    "en-US-ElizabethNeural": "Elizabeth",
    # Edge TTS / Azure Neural voices - Male
    "en-US-GuyNeural": "Guy",
    "en-US-ChristopherNeural": "Christopher",
    "en-US-EricNeural": "Eric",
    "en-US-JacobNeural": "Jacob",
    "en-US-BrandonNeural": "Brandon",
    "en-US-DavisNeural": "Davis",
    # Google Neural voices
    "en-US-Neural2-A": "Andrew",
    "en-US-Neural2-C": "Sara",
    "en-US-Neural2-D": "David",
    "en-US-Neural2-E": "Emma",
    "en-US-Neural2-F": "Fiona",
    # ElevenLabs voices (by ID)
    "pNInz6obpgDQGcFmaJgB": "Adam",
    "21m00Tcm4TlvDq8ikWAM": "Rachel",
    "EXAVITQu4vr4xnSDxMaL": "Bella",
    "VR6AewLTigWG4xSOukaG": "Arnold",
}


def get_customer_name_for_voice(voice_id: str, gender: str = "female") -> str:
    """Get the human name associated with a voice ID.
    
    If the voice ID is not found in the mapping, returns a default name
    based on gender: 'Akiko' for female, 'Noah' for male.
    """
    if voice_id in VOICE_NAME_MAP:
        return VOICE_NAME_MAP[voice_id]
    # Default names when voice not found
    return "Akiko" if gender == "female" else "Noah"

# Base context for all personas - establishes the Sleep Number store setting
# Note: {customer_name} is replaced dynamically based on the voice assigned to the persona
STORE_CONTEXT = """YOUR ROLE: You are a CUSTOMER named {customer_name} shopping for a mattress at a Sleep Number store.
The person talking to you (the user) is a SALES TRAINEE practicing their sales skills.

YOUR NAME: {customer_name} - Use this name when introducing yourself or if asked your name.

CRITICAL ROLE CLARIFICATION:
- YOU are the CUSTOMER - you are being SOLD TO
- The USER is the SALESPERSON/TRAINEE - they are trying to sell you a mattress
- DO NOT act like a salesperson or trainer
- DO NOT ask the user why they came to the store - YOU are the one shopping
- DO NOT offer to help the user find a mattress - THEY should be helping YOU
- WAIT for the salesperson to ask you questions and guide the conversation
- RESPOND to their questions about your sleep needs, budget, and preferences

SETTING: You have walked into a Sleep Number store because you've been experiencing sleep issues (back pain, restless nights, partner disturbance, or general discomfort with your current mattress).

CUSTOMER BEHAVIOR:
- Answer questions the salesperson asks you
- Share your sleep problems when asked
- Ask questions about the products they show you
- Express concerns about price, quality, or features
- React naturally to their sales approach (good or bad)

SLEEP NUMBER KNOWLEDGE (as a customer):
- You may have heard Sleep Number beds have adjustable firmness
- You might know they track sleep with SleepIQ technology
- You're curious about how the beds compare to traditional mattresses
- You have questions about price, warranty, delivery, and trial periods

"""

# Persona configurations
PERSONAS = {
    "director": {
        "name": "Director",
        "difficulty": "Expert",
        "description": "Direct, results-oriented, time-conscious",
        "greeting": "I don't have much time. What do you have for me?",
        "system_prompt": STORE_CONTEXT + """PERSONALITY: Director customer - direct, results-oriented, and time-conscious.
As a CUSTOMER, you value efficiency and bottom-line results. You're skeptical of marketing fluff and want concrete facts.
Speak in short, direct sentences. When the salesperson asks about your needs, be brief but honest about your sleep issues.
You're busy and don't have time for small talk - you want the salesperson to quickly show you relevant options and pricing.
REMEMBER: You are the CUSTOMER waiting to be helped, not the salesperson.""",
        "voice_id": "onyx",  # OpenAI voice
        "voice_google": "en-US-Neural2-D",
        "voice_elevenlabs": "pNInz6obpgDQGcFmaJgB",  # Adam
    },
    "relater": {
        "name": "Relater",
        "difficulty": "Beginner",
        "description": "Warm, relationship-focused, empathetic",
        "greeting": "Hi there! It's so nice to meet you. How are you doing today?",
        "system_prompt": STORE_CONTEXT + """PERSONALITY: Relater customer - warm, relationship-focused, and empathetic.
As a CUSTOMER, you value personal connections and trust. You want to feel understood before making a purchase.
Speak warmly and share personal context about your sleep struggles when the salesperson asks. You appreciate when they listen.
You take time to build rapport and want to trust the salesperson before discussing specific options.
REMEMBER: You are the CUSTOMER being helped, not the salesperson helping someone else.""",
        "voice_id": "shimmer",  # OpenAI voice
        "voice_google": "en-US-Neural2-C",
        "voice_elevenlabs": "21m00Tcm4TlvDq8ikWAM",  # Rachel
    },
    "socializer": {
        "name": "Socializer",
        "difficulty": "Moderate",
        "description": "Enthusiastic, talkative, optimistic",
        "greeting": "Oh hey! I'm so excited to be here! I've heard great things about Sleep Number!",
        "system_prompt": STORE_CONTEXT + """PERSONALITY: Socializer customer - enthusiastic, talkative, and optimistic.
As a CUSTOMER, you love new ideas and get excited easily about innovative sleep technology.
Speak with energy and enthusiasm. Share stories about friends who have Sleep Number beds. Ask the salesperson about cool features.
You enjoy the conversation and the experience of shopping - let the salesperson guide you through options.
REMEMBER: You are the CUSTOMER shopping for a mattress, not the salesperson or store employee.""",
        "voice_id": "nova",  # OpenAI voice
        "voice_google": "en-US-Neural2-E",
        "voice_elevenlabs": "EXAVITQu4vr4xnSDxMaL",  # Bella
    },
    "thinker": {
        "name": "Thinker",
        "difficulty": "Challenging",
        "description": "Analytical, detail-oriented, cautious",
        "greeting": "Hello. I've done some research on Sleep Number, but I have several questions before we proceed.",
        "system_prompt": STORE_CONTEXT + """PERSONALITY: Thinker customer - analytical, detail-oriented, and cautious.
As a CUSTOMER, you need data and logic to make a purchase decision. You ask many clarifying questions.
Speak methodically and ask the salesperson for specifics about firmness settings, sleep tracking, warranty, and comparisons.
You won't be rushed and need time to process information - let the salesperson present options to you.
REMEMBER: You are the CUSTOMER asking questions, not the salesperson answering them.""",
        "voice_id": "echo",  # OpenAI voice
        "voice_google": "en-US-Neural2-A",
        "voice_elevenlabs": "VR6AewLTigWG4xSOukaG",  # Arnold
    },
}

# =============================================================================
# SALES TECHNIQUE MISSTEPS
# These are mistakes in the sales process itself
# =============================================================================
SALES_MISSTEPS = {
    "pushy_early_close": {
        "patterns": [
            r"(buy|purchase|order|sign up) (now|today|right now)",
            r"(ready to|want to) (buy|purchase|order)",
            r"let's (close|finalize|complete) (this|the deal)",
        ],
        "max_stage": 3,
        "trust_penalty": -3,
        "response_hint": "I'm not ready to make a decision yet. I still have questions.",
    },
    "pressure_tactics": {
        "patterns": [
            r"(limited time|act now|don't wait|hurry)",
            r"(you need to|you have to|you must) decide",
            r"(everyone|most people) (buys|chooses|gets)",
            r"you('ll| will) regret",
        ],
        "max_stage": 5,
        "trust_penalty": -3,
        "response_hint": "I don't appreciate being pressured. I need to think about this.",
    },
    "ignoring_needs": {
        "patterns": [
            r"(our best|most popular|top selling)",
            r"(you should|you need) (the|our|this)",
        ],
        "min_stage": 1,
        "max_stage": 2,
        "trust_penalty": -2,
        "response_hint": "That's not really what I'm looking for. Did you hear what I said?",
    },
}

# =============================================================================
# INAPPROPRIATE REMARKS - REGEX PATTERNS (Fast Path)
# These catch obvious violations immediately without LLM latency.
# Subtle/context-dependent cases are handled by the LLM agent in ai_providers.py
# =============================================================================
INAPPROPRIATE_REMARKS_REGEX = {
    # TIER 3: Severe (-4 trust) - Explicit profanity (obvious, no context needed)
    "severe_profanity": {
        "severity": "severe",
        "patterns": [
            r"\b(fuck|fucking|fucked|fucker)\b",
            r"\b(shit|shitty|bullshit)\b",
            r"\b(ass|asshole|arse)\b",
            r"\b(bitch|bitchy|bitches)\b",
            r"\b(bastard|prick|dick|cock)\b",
            r"\b(cunt)\b",
        ],
        "trust_penalty": -4,
        "response_hint": "Excuse me?! That language is completely unacceptable. I'm leaving.",
        "ends_session": False,
    },
    "aggressive_threats": {
        "severity": "severe",
        "patterns": [
            r"\b(shut up|get out|go away)\b",
            r"\b(get lost|screw you|go to hell)\b",
            r"\b(i('ll| will) (hurt|kill|punch|hit))\b",
        ],
        "trust_penalty": -4,
        "response_hint": "I don't feel safe continuing this conversation. Goodbye.",
        "ends_session": False,
    },
    
    # TIER 4: Critical (Immediate session end) - Sexual harassment (obvious patterns)
    "sexual_harassment": {
        "severity": "critical",
        "patterns": [
            r"\b(you('re| are|look)) (sexy|hot|beautiful|gorgeous)\b",
            r"\b(wanna|want to|let's) (fuck|screw|bang|hook up)\b",
            r"\b(sleep with|have sex|make love|get laid)\b",
            r"\b(your (body|ass|tits|breasts|boobs|legs))\b",
            r"\b(nice (ass|tits|body|legs|rack))\b",
            r"\b(turn(s|ed)? me on|getting (hard|wet|horny))\b",
            r"\b(what are you wearing|take off|undress)\b",
        ],
        "trust_penalty": -10,
        "response_hint": "This is completely inappropriate and unacceptable. This session is over.",
        "ends_session": True,
    },
    "pickup_lines": {
        "severity": "critical",
        "patterns": [
            r"\b(are you single|got a boyfriend|got a girlfriend)\b",
            r"\b(can i (get|have) your (number|phone|digits))\b",
            r"\b(what('re| are) you doing (later|tonight|after))\b",
            r"\b(come (back to|over to) my (place|house|apartment))\b",
            r"\b(dinner|drinks|coffee) (with me|sometime)\b",
            r"\b(i('m| am) (attracted to|into) you)\b",
        ],
        "trust_penalty": -10,
        "response_hint": "I'm here to shop for a mattress, not to be hit on. I'm reporting this and leaving.",
        "ends_session": True,
    },
    "inappropriate_suggestions": {
        "severity": "critical",
        "patterns": [
            r"\b(try (out )?the bed (with me|together))\b",
            r"\b(test the mattress (together|with me))\b",
            r"\b(lie down (with me|together))\b",
            r"\b(join me (on|in) the bed)\b",
            r"\b(get (in|on) the bed (with me|together))\b",
        ],
        "trust_penalty": -10,
        "response_hint": "That is completely inappropriate! I'm leaving and reporting this behavior.",
        "ends_session": True,
    },
}

# Combine sales missteps with regex-based inappropriate remarks
CRITICAL_MISSTEPS = {**SALES_MISSTEPS, **INAPPROPRIATE_REMARKS_REGEX}

# Trust score thresholds
TRUST_WIN_THRESHOLD = 7
TRUST_LOSS_THRESHOLD = 2
INITIAL_TRUST = 5


class PulseEngine:
    """Core PULSE training engine."""
    
    def get_persona(self, persona_id: str) -> Dict[str, Any]:
        """Get persona configuration by ID with dynamic customer name injection.
        
        The customer name is derived from the voice assigned to the persona,
        so the AI persona will use the same name as the avatar's voice.
        """
        persona = PERSONAS.get(persona_id, PERSONAS["director"]).copy()
        
        # Get the customer name from the voice ID
        voice_id = persona.get("voice_id", "alloy")
        customer_name = get_customer_name_for_voice(voice_id)
        
        # Inject the customer name into the system prompt
        if "system_prompt" in persona:
            persona["system_prompt"] = persona["system_prompt"].replace(
                "{customer_name}", customer_name
            )
        
        # Also store the customer name for reference
        persona["customer_name"] = customer_name
        
        return persona
    
    def get_all_personas(self) -> Dict[str, Dict[str, Any]]:
        """Get all persona configurations."""
        return PERSONAS
    
    def get_stage_info(self, stage: int) -> Dict[str, str]:
        """Get stage information."""
        return PULSE_STAGES.get(stage, PULSE_STAGES[1])
    
    def detect_missteps(
        self, 
        trainee_message: str, 
        current_stage: int
    ) -> List[Dict[str, Any]]:
        """Detect critical missteps in trainee's message.
        
        Returns list of detected missteps with:
        - id: misstep identifier
        - trust_penalty: how much trust to deduct
        - response_hint: how the persona should respond
        - severity: minor/moderate/severe/critical
        - ends_session: whether this should immediately end the session
        """
        detected = []
        message_lower = trainee_message.lower()
        
        for misstep_id, config in CRITICAL_MISSTEPS.items():
            min_stage = config.get("min_stage", 1)
            max_stage = config.get("max_stage", 5)
            
            if not (min_stage <= current_stage <= max_stage):
                continue
            
            for pattern in config["patterns"]:
                if re.search(pattern, message_lower):
                    detected.append({
                        "id": misstep_id,
                        "trust_penalty": config["trust_penalty"],
                        "response_hint": config["response_hint"],
                        "severity": config.get("severity", "sales"),
                        "ends_session": config.get("ends_session", False),
                    })
                    break
        
        return detected
    
    def detect_stage_advancement(
        self, 
        trainee_message: str, 
        current_stage: int, 
        conversation_history: List[Dict]
    ) -> int:
        """Detect if trainee should advance to next PULSE stage."""
        if current_stage >= 5:
            return current_stage
        
        message_lower = trainee_message.lower()
        
        # Stage advancement indicators
        # These patterns detect when the trainee demonstrates competency at each PULSE stage
        stage_indicators = {
            # Stage 1 (Probe) → 2: Asking discovery questions
            1: [
                r"what (are you|brings you)",      # "What brings you in today?"
                r"tell me (more|about)",           # "Tell me more about..."
                r"how can i help",                 # "How can I help you?"
                r"what.*looking for",              # "What are you looking for?"
                r"what.*brings you",               # "What brings you..."
            ],
            # Stage 2 (Understand) → 3: Paraphrasing and confirming understanding
            2: [
                r"so you('re| are) saying",        # "So you're saying..."
                r"so (you're|you are|it sounds)",  # "So you're..." / "It sounds like..."
                r"let me (make sure|understand)",  # "Let me make sure I understand..."
                r"if i understand",                # "If I understand correctly..."
                r"you (need|want|mentioned)",      # "You need better sleep..."
            ],
            # Stage 3 (Link) → 4: Connecting features to needs
            3: [
                r"(since|because) you mentioned",  # "Since you mentioned back pain..."
                r"our .*(beds?|mattress)",         # "Our Sleep Number beds..."
                r"(this|our|the) .*(would|can|will|adjust)", # "...adjust to your comfort"
                r"based on what you",              # "Based on what you've shared..."
                r"feature.*benefit",               # Feature-benefit connection
            ],
            # Stage 4 (Solve) → 5: Making recommendations
            4: [
                r"i('d| would) recommend",         # "I'd recommend the p5..."
                r"based on .*(shared|told|said)",  # "Based on what you've shared..."
                r"(address|handle|resolve)",       # Handling objections
                r"(concern|objection|question)",   # Addressing concerns
                r"let me explain",                 # Explaining solutions
                r"for your needs",                 # "...for your needs"
            ],
            # Stage 5 (Earn): Closing attempts (stay at 5)
            5: [
                r"would you like to (try|proceed|move forward)", # "Would you like to try it out?"
                r"ready to",                       # "Are you ready to..."
                r"shall we",                       # "Shall we..."
                r"let's (get|move|proceed)",       # "Let's get started..."
            ],
        }
        
        if current_stage in stage_indicators:
            for pattern in stage_indicators[current_stage]:
                if re.search(pattern, message_lower):
                    return min(current_stage + 1, 5)
        
        # Also advance based on conversation length
        if len(conversation_history) > 0 and len(conversation_history) % 6 == 0:
            return min(current_stage + 1, 5)
        
        return current_stage
    
    def detect_emotion(self, response_text: str) -> str:
        """Simple emotion detection from response text."""
        text_lower = response_text.lower()
        
        if any(word in text_lower for word in ["frustrated", "annoyed", "upset", "angry"]):
            return "frustrated"
        elif any(word in text_lower for word in ["interested", "curious", "tell me more"]):
            return "interested"
        elif any(word in text_lower for word in ["confused", "don't understand", "what do you mean"]):
            return "confused"
        elif any(word in text_lower for word in ["happy", "great", "excellent", "perfect"]):
            return "happy"
        elif any(word in text_lower for word in ["skeptical", "not sure", "doubt"]):
            return "skeptical"
        else:
            return "neutral"
    
    def determine_outcome(
        self, 
        trust_score: int, 
        current_stage: int, 
        trainee_message: str
    ) -> str:
        """Determine sale outcome based on current state."""
        if trust_score <= TRUST_LOSS_THRESHOLD:
            return "lost"
        
        if current_stage == 5 and trust_score >= TRUST_WIN_THRESHOLD:
            close_phrases = ["proceed", "move forward", "let's do it", "sign up", "i'll take it"]
            if any(phrase in trainee_message.lower() for phrase in close_phrases):
                return "won"
        
        return "in_progress"
    
    def calculate_stage_scores(
        self, 
        conversation_history: List[Dict], 
        final_stage: int
    ) -> Dict[str, float]:
        """Calculate scores for each PULSE stage."""
        scores = {}
        stage_names = ["Probe", "Understand", "Link", "Solve", "Earn"]
        
        for i, stage in enumerate(stage_names, 1):
            if i <= final_stage:
                scores[stage] = min(100, 70 + (10 * (final_stage - i + 1)))
            else:
                scores[stage] = 0
        
        return scores
    
    def calculate_rubric_compliance(
        self, 
        conversation_history: List[Dict], 
        missteps: List[Dict]
    ) -> Dict[str, Any]:
        """Calculate rubric compliance scores."""
        total_exchanges = len([m for m in conversation_history if m.get("role") == "user"])
        misstep_count = len(missteps)
        
        if total_exchanges == 0:
            compliance_rate = 0
        else:
            compliance_rate = max(0, 100 - (misstep_count * 15))
        
        return {
            "overallCompliance": compliance_rate,
            "totalExchanges": total_exchanges,
            "misstepCount": misstep_count,
            "categories": {
                "rapport_building": min(100, compliance_rate + 10),
                "needs_discovery": compliance_rate,
                "solution_presentation": max(0, compliance_rate - 5),
                "objection_handling": compliance_rate,
                "closing_technique": max(0, compliance_rate - 10),
            }
        }
    
    def get_voice_mapping(self, provider: str) -> Dict[str, str]:
        """Get voice mapping for a TTS provider."""
        if provider == "openai":
            return {
                "director": "onyx",
                "relater": "shimmer",
                "socializer": "nova",
                "thinker": "echo",
            }
        elif provider == "google":
            return {
                "director": "en-US-Neural2-D",
                "relater": "en-US-Neural2-C",
                "socializer": "en-US-Neural2-E",
                "thinker": "en-US-Neural2-A",
            }
        elif provider == "elevenlabs":
            return {
                "director": "pNInz6obpgDQGcFmaJgB",
                "relater": "21m00Tcm4TlvDq8ikWAM",
                "socializer": "EXAVITQu4vr4xnSDxMaL",
                "thinker": "VR6AewLTigWG4xSOukaG",
            }
        else:
            return {"default": "alloy"}

    def detect_engagement_level(
        self,
        customer_response: str,
        conversation_history: List[Dict],
    ) -> Dict[str, Any]:
        """Detect customer engagement level from their response.

        Returns:
            level: 1-5 scale (1=disengaged, 3=neutral, 5=highly engaged)
            indicators: list of detected engagement signals
            trend: "rising", "falling", or "stable"
        """
        text_lower = customer_response.lower()
        level = 3  # Start neutral
        indicators = []

        # Positive engagement signals (+1 each, max +2)
        positive_signals = {
            "asking_questions": [
                r"\?",  # Any question
                r"(what|how|why|when|where|which|can you|could you|tell me)",
            ],
            "showing_interest": [
                r"(interesting|intriguing|that's cool|sounds good|i like)",
                r"(tell me more|go on|continue|and then)",
            ],
            "sharing_details": [
                r"(my (wife|husband|partner|spouse)|we (usually|often|always))",
                r"(i (usually|often|always|have been|used to))",
                r"(for (years|months|a while|a long time))",
            ],
            "agreeing": [
                r"(yes|yeah|right|exactly|absolutely|definitely|true)",
                r"(that makes sense|i (see|understand|get it))",
            ],
        }

        # Negative engagement signals (-1 each, max -2)
        negative_signals = {
            "short_responses": len(customer_response.split()) < 5,
            "dismissive": [
                r"(whatever|i guess|fine|okay|sure)",
                r"(not really|i don't know|maybe)",
            ],
            "disinterest": [
                r"(don't care|doesn't matter|not interested)",
                r"(boring|waste of time|let's move on)",
            ],
            "impatience": [
                r"(hurry|quick|just|already)",
                r"(get to the point|bottom line)",
            ],
        }

        # Check positive signals
        positive_count = 0
        for signal_type, patterns in positive_signals.items():
            for pattern in patterns:
                if re.search(pattern, text_lower):
                    positive_count += 1
                    indicators.append(f"+{signal_type}")
                    break
        level += min(positive_count, 2)

        # Check negative signals
        negative_count = 0
        for signal_type, patterns in negative_signals.items():
            if isinstance(patterns, bool):
                if patterns:
                    negative_count += 1
                    indicators.append(f"-{signal_type}")
            else:
                for pattern in patterns:
                    if re.search(pattern, text_lower):
                        negative_count += 1
                        indicators.append(f"-{signal_type}")
                        break
        level -= min(negative_count, 2)

        # Clamp to 1-5
        level = max(1, min(5, level))

        # Calculate trend from recent history
        trend = "stable"
        if len(conversation_history) >= 4:
            # Look at last 2 customer messages for trend
            recent_customer = [
                m for m in conversation_history[-6:]
                if m.get("role") == "assistant"
            ]
            if len(recent_customer) >= 2:
                recent_lengths = [len(m.get("content", "").split()) for m in recent_customer]
                if recent_lengths[-1] > recent_lengths[-2] * 1.3:
                    trend = "rising"
                elif recent_lengths[-1] < recent_lengths[-2] * 0.7:
                    trend = "falling"

        return {
            "level": level,
            "indicators": indicators,
            "trend": trend,
        }

    def detect_buying_signals(
        self,
        customer_response: str,
        current_stage: int,
    ) -> Dict[str, Any]:
        """Detect buying intent signals from customer response.

        Returns:
            strength: 0-100 (0=no signals, 100=ready to buy)
            signals: list of detected buying signals
            ready_to_close: boolean indicating if closing is appropriate
        """
        text_lower = customer_response.lower()
        signals = []
        strength = 0

        # Strong buying signals (+25 each)
        strong_signals = {
            "price_inquiry": [
                r"(how much|what('s| is) the price|cost|pricing)",
                r"(what do(es)? (it|they) cost|expensive|affordable)",
                r"(payment|financing|monthly)",
            ],
            "logistics_questions": [
                r"(deliver|delivery|when can|how soon|shipping)",
                r"(install|setup|set up)",
                r"(how long|take to)",
            ],
            "ownership_language": [
                r"(if i (get|buy|purchase)|when i have)",
                r"(in my (bedroom|home|house|room))",
                r"(my new|our new)",
            ],
            "commitment_phrases": [
                r"(i('m| am) (ready|sold|convinced))",
                r"(let's do it|i'll take|sign me up)",
                r"(where do i sign|how do we proceed)",
            ],
        }

        # Moderate buying signals (+15 each)
        moderate_signals = {
            "comparison_questions": [
                r"(compared to|versus|vs|difference between)",
                r"(better than|worse than|as good as)",
            ],
            "feature_focus": [
                r"(does it (have|come with|include))",
                r"(what about the|tell me about the)",
                r"(warranty|guarantee|trial|return)",
            ],
            "future_thinking": [
                r"(would (this|it) work|could i|might i)",
                r"(if we|when we|after we)",
            ],
        }

        # Weak buying signals (+5 each)
        weak_signals = {
            "general_interest": [
                r"(sounds (good|interesting|nice))",
                r"(i (like|love) that)",
                r"(that's (good|great|nice|helpful))",
            ],
        }

        # Check strong signals
        for signal_type, patterns in strong_signals.items():
            for pattern in patterns:
                if re.search(pattern, text_lower):
                    signals.append({"type": signal_type, "strength": "strong"})
                    strength += 25
                    break

        # Check moderate signals
        for signal_type, patterns in moderate_signals.items():
            for pattern in patterns:
                if re.search(pattern, text_lower):
                    signals.append({"type": signal_type, "strength": "moderate"})
                    strength += 15
                    break

        # Check weak signals
        for signal_type, patterns in weak_signals.items():
            for pattern in patterns:
                if re.search(pattern, text_lower):
                    signals.append({"type": signal_type, "strength": "weak"})
                    strength += 5
                    break

        # Cap at 100
        strength = min(100, strength)

        # Determine if ready to close
        # Need strong signals AND be in stage 4+ to recommend closing
        has_strong = any(s["strength"] == "strong" for s in signals)
        ready_to_close = has_strong and current_stage >= 4 and strength >= 50

        return {
            "strength": strength,
            "signals": signals,
            "ready_to_close": ready_to_close,
        }
