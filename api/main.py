"""
PULSE Training API - AvatarDocker Version

MLX-only AI provider for Apple Silicon local LLM inference.
No cloud dependencies (OpenAI, Anthropic, Azure).
"""

import logging
import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from ai_providers import get_ai_provider, get_tts_provider
from database import Database
from pulse_engine import PulseEngine
import storage
import readiness_service
import avatar_manager

# Configure logging
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Database instance
db = Database()

# PULSE Engine
pulse_engine = PulseEngine()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    logger.info("Starting PULSE API...")
    await db.connect()
    logger.info(f"AI Provider: {os.getenv('AI_PROVIDER', 'openai')}")
    logger.info(f"TTS Provider: {os.getenv('TTS_PROVIDER', 'openai')}")
    yield
    logger.info("Shutting down PULSE API...")
    await db.disconnect()


app = FastAPI(
    title="PULSE Training API",
    description="Behavioral Certification Platform - Docker Local Version",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# Request/Response Models
# =============================================================================

class SessionStartRequest(BaseModel):
    userId: str = "anonymous"
    personaId: str = "director"
    scenario: Dict[str, Any] = Field(default_factory=dict)
    avatarId: Optional[str] = None  # Override persona's default avatar
    voiceId: Optional[str] = None   # Override persona's default voice


class SessionStartResponse(BaseModel):
    sessionId: str
    personaId: str
    personaName: str
    difficulty: str
    description: str
    greeting: str
    currentStage: int
    stageName: str
    trustScore: int
    avatarId: Optional[str] = None   # Avatar used for this session
    voiceId: Optional[str] = None    # Voice used for this session


class ChatRequest(BaseModel):
    sessionId: str
    message: str
    personaId: str = "director"
    persona: Optional[str] = None
    conversationHistory: List[Dict[str, str]] = Field(default_factory=list)
    currentStage: int = 1
    trustScore: int = 5


class ChatResponse(BaseModel):
    sessionId: str
    response: str
    emotion: str
    currentStage: int
    stageName: str
    trustScore: int
    saleOutcome: str
    missteps: List[Dict[str, Any]]
    audioUrl: Optional[str] = None
    audioBase64: Optional[str] = None
    # EQ Intelligence metrics
    engagementLevel: Optional[int] = None  # 1-5 scale
    engagementTrend: Optional[str] = None  # "rising", "falling", "stable"
    buyingSignalStrength: Optional[int] = None  # 0-100
    readyToClose: Optional[bool] = None


class SessionCompleteRequest(BaseModel):
    sessionId: str
    conversationHistory: List[Dict[str, str]] = Field(default_factory=list)
    currentStage: int = 1
    trustScore: int = 5
    saleOutcome: str = "in_progress"
    missteps: List[Dict[str, Any]] = Field(default_factory=list)
    personaId: str = "director"


class TTSRequest(BaseModel):
    text: str
    voiceId: Optional[str] = None
    personaId: Optional[str] = None


# =============================================================================
# Health Check
# =============================================================================

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "ai_provider": os.getenv("AI_PROVIDER", "openai"),
        "tts_provider": os.getenv("TTS_PROVIDER", "openai"),
        "environment": os.getenv("ENVIRONMENT", "development"),
    }


# =============================================================================
# Session Endpoints
# =============================================================================

@app.post("/api/session/start", response_model=SessionStartResponse)
async def start_session(request: SessionStartRequest):
    """Start a new training session."""
    try:
        session_id = str(uuid.uuid4())
        persona = pulse_engine.get_persona(request.personaId)
        
        # Resolve avatar and voice for this session
        # Priority: request override > database persona config > None
        avatar_id = request.avatarId
        voice_id = request.voiceId
        
        # Try to get persona config from database for avatar/voice
        db_persona = await db.get_persona_by_key(request.personaId)
        if db_persona:
            if not avatar_id:
                avatar_id = db_persona.get("avatar_id")
            if not voice_id:
                voice_id = db_persona.get("voice_id")
        
        # Store session in database with avatar/voice tracking
        await db.create_session_with_avatar(
            session_id=session_id,
            user_id=request.userId,
            persona_id=request.personaId,
            avatar_id=avatar_id,
            voice_id=voice_id,
            scenario=request.scenario
        )
        
        logger.info(
            f"Session started: {session_id} with persona {request.personaId}, "
            f"avatar={avatar_id}, voice={voice_id}"
        )
        
        return SessionStartResponse(
            sessionId=session_id,
            personaId=request.personaId,
            personaName=persona["name"],
            difficulty=persona["difficulty"],
            description=persona["description"],
            greeting=persona["greeting"],
            currentStage=1,
            stageName="Probe",
            trustScore=5,
            avatarId=avatar_id,
            voiceId=voice_id
        )
        
    except Exception as e:
        logger.error(f"Session start error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Main chat endpoint for conversation with AI persona."""
    try:
        # Get persona configuration
        persona = pulse_engine.get_persona(request.personaId)
        
        # Get AI provider for LLM-based detection
        ai_provider = get_ai_provider()
        
        # HYBRID DETECTION APPROACH:
        # 1. Regex (fast path) - catches obvious severe/critical violations immediately
        # 2. LLM (context-aware path) - only runs if regex doesn't catch anything
        
        # Step 1: Detect missteps using regex (sales + obvious inappropriate remarks)
        regex_missteps = pulse_engine.detect_missteps(request.message, request.currentStage)
        
        # Check if regex caught any inappropriate remarks (severe/critical)
        regex_caught_inappropriate = any(
            m.get("severity") in ["severe", "critical"] 
            for m in regex_missteps
        )
        
        # Step 2: Only call LLM if regex didn't catch obvious violations
        # This saves latency and API costs for clear-cut cases
        missteps = regex_missteps.copy()
        if not regex_caught_inappropriate:
            # LLM analyzes for subtle inappropriate behavior (minor/moderate or context-dependent)
            inappropriate_result = await ai_provider.detect_inappropriate_remarks(request.message)
            logger.info(f"LLM inappropriate remarks detection: {inappropriate_result}")
            
            if inappropriate_result.get("detected", False):
                missteps.append({
                    "id": inappropriate_result.get("category", "inappropriate_remark"),
                    "trust_penalty": inappropriate_result.get("trust_penalty", -1),
                    "response_hint": inappropriate_result.get("response_hint", ""),
                    "severity": inappropriate_result.get("severity", "minor"),
                    "ends_session": inappropriate_result.get("ends_session", False),
                    "reason": inappropriate_result.get("reason", ""),
                })
        else:
            logger.info(f"Regex caught severe/critical violation - skipping LLM call")
        
        # Check for session-ending missteps (critical severity)
        session_ended_by_misstep = any(m.get("ends_session", False) for m in missteps)
        
        # Detect stage advancement (skip if session is ending)
        new_stage = request.currentStage
        if not session_ended_by_misstep:
            new_stage = pulse_engine.detect_stage_advancement(
                request.message, 
                request.currentStage, 
                request.conversationHistory
            )
        
        # Calculate trust score changes
        trust_score = request.trustScore
        
        # Decrease trust for missteps
        for misstep in missteps:
            trust_score += misstep["trust_penalty"]
            severity = misstep.get("severity", "sales")
            logger.info(f"Misstep detected: {misstep['id']} (severity: {severity}, penalty: {misstep['trust_penalty']})")
        
        # Increase trust for stage advancement (good sales technique)
        if new_stage > request.currentStage:
            trust_score += 1  # +1 trust for advancing a stage
            logger.info(f"Trust increased: stage advanced {request.currentStage} → {new_stage}")
        
        # Small trust boost for engaging conversation (no missteps)
        if not missteps and len(request.conversationHistory) > 0:
            # Every 3rd exchange without missteps, small trust boost
            if len(request.conversationHistory) % 3 == 0:
                trust_score += 0.5
        
        # Clamp trust score to valid range
        trust_score = max(0, min(10, int(trust_score)))
        
        # Build conversation for AI
        messages = request.conversationHistory.copy()
        messages.append({"role": "user", "content": request.message})
        
        # Modify system prompt based on missteps
        system_prompt = persona["system_prompt"]
        if missteps:
            hint = missteps[0]["response_hint"]
            severity = missteps[0].get("severity", "sales")
            if session_ended_by_misstep:
                # Critical misstep - persona should end the conversation
                system_prompt += f"\n\nCRITICAL: The salesperson made a completely unacceptable remark. You are ENDING this conversation immediately. Say: {hint}"
            elif severity == "severe":
                system_prompt += f"\n\nIMPORTANT: The salesperson used very inappropriate language. Respond with strong displeasure and consider leaving. Hint: {hint}"
            elif severity == "moderate":
                system_prompt += f"\n\nIMPORTANT: The salesperson was rude or dismissive. Respond with frustration. Hint: {hint}"
            elif severity == "minor":
                system_prompt += f"\n\nNOTE: The salesperson used slightly unprofessional language. Show mild disapproval. Hint: {hint}"
            else:
                system_prompt += f"\n\nIMPORTANT: The salesperson just made a sales mistake. Respond with skepticism. Hint: {hint}"
        
        # Add stage context
        stage_info = pulse_engine.get_stage_info(new_stage)
        system_prompt += f"\n\nCurrent conversation stage: {stage_info['name']} - {stage_info['description']}"
        
        # Get AI response (ai_provider already initialized above for inappropriate remarks detection)
        ai_response = await ai_provider.generate_response(messages[-20:], system_prompt)
        
        # Detect emotion
        emotion = pulse_engine.detect_emotion(ai_response)

        # Detect engagement level from customer response
        engagement = pulse_engine.detect_engagement_level(
            ai_response,
            request.conversationHistory
        )

        # Detect buying signals from customer response
        buying_signals = pulse_engine.detect_buying_signals(
            ai_response,
            new_stage
        )

        # Determine sale outcome
        sale_outcome = pulse_engine.determine_outcome(
            trust_score, new_stage, request.message
        )
        
        # Store in database
        await db.add_conversation_turn(
            session_id=request.sessionId,
            role="user",
            content=request.message,
            stage=request.currentStage
        )
        await db.add_conversation_turn(
            session_id=request.sessionId,
            role="assistant",
            content=ai_response,
            emotion=emotion,
            stage=new_stage
        )
        
        # Store missteps
        for misstep in missteps:
            await db.add_misstep(request.sessionId, misstep)
        
        # Update session
        await db.update_session(
            session_id=request.sessionId,
            current_stage=new_stage,
            trust_score=trust_score,
            sale_outcome=sale_outcome
        )

        # If session ended by misstep, create scorecard with transcript immediately
        if session_ended_by_misstep:
            # Build full transcript including current exchange
            transcript = []
            now_utc = datetime.now(timezone.utc).isoformat()
            for msg in request.conversationHistory:
                transcript.append({
                    "role": msg.get("role", "unknown"),
                    "content": msg.get("content", ""),
                    "timestamp": msg.get("timestamp", now_utc),
                })
            # Add the current user message and AI response
            transcript.append({
                "role": "user",
                "content": request.message,
                "timestamp": now_utc,
            })
            transcript.append({
                "role": "assistant",
                "content": ai_response,
                "timestamp": now_utc,
            })

            # Create scorecard with transcript for review
            scorecard = {
                "overallScore": 0,  # Session ended prematurely
                "stageScores": {},
                "rubricCompliance": {},
                "aiFeedback": {
                    "summary": "Session ended due to inappropriate remarks",
                    "strengths": [],
                    "improvements": ["Review company policies on appropriate workplace communication"],
                    "recommendations": ["Complete sensitivity training before next session"],
                },
                "transcript": transcript,
                "endReason": "inappropriate_remark",
            }
            await db.create_scorecard(request.sessionId, scorecard)
            logger.info(f"Scorecard created for session ended by misstep: {request.sessionId}")

        logger.info(f"Chat: session={request.sessionId}, stage={new_stage}, trust={trust_score}")
        
        # Generate TTS audio for the response
        audio_base64 = None
        try:
            tts_provider = get_tts_provider()
            # Get voice for persona
            voice_map = {
                "director": "onyx",
                "relater": "shimmer", 
                "socializer": "nova",
                "thinker": "echo"
            }
            voice = voice_map.get(request.persona.lower() if request.persona else "relater", "alloy")
            audio_bytes = await tts_provider.synthesize(ai_response, voice)
            import base64
            audio_base64 = base64.b64encode(audio_bytes).decode("utf-8")
            logger.info(f"TTS generated: {len(audio_bytes)} bytes")
        except Exception as tts_error:
            logger.error(f"TTS error: {tts_error}")
        
        return ChatResponse(
            sessionId=request.sessionId,
            response=ai_response,
            emotion=emotion,
            currentStage=new_stage,
            stageName=stage_info["name"],
            trustScore=trust_score,
            saleOutcome=sale_outcome,
            missteps=missteps,
            audioUrl=None,
            audioBase64=audio_base64,
            engagementLevel=engagement["level"],
            engagementTrend=engagement["trend"],
            buyingSignalStrength=buying_signals["strength"],
            readyToClose=buying_signals["ready_to_close"],
        )
        
    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/session/complete")
async def complete_session(request: SessionCompleteRequest):
    """Complete a training session and generate scorecard."""
    try:
        # Calculate scores
        stage_scores = pulse_engine.calculate_stage_scores(
            request.conversationHistory, 
            request.currentStage
        )
        rubric_compliance = pulse_engine.calculate_rubric_compliance(
            request.conversationHistory, 
            request.missteps
        )
        
        # Calculate overall score
        base_score = rubric_compliance["overallCompliance"]
        stage_bonus = (request.currentStage / 5) * 20
        trust_bonus = (request.trustScore / 10) * 15
        outcome_bonus = 15 if request.saleOutcome == "won" else (0 if request.saleOutcome == "lost" else 5)
        overall_score = min(100, base_score + stage_bonus + trust_bonus + outcome_bonus)
        
        # Generate AI feedback
        ai_provider = get_ai_provider()
        ai_feedback = await ai_provider.generate_feedback(
            conversation_history=request.conversationHistory,
            final_stage=request.currentStage,
            trust_score=request.trustScore,
            sale_outcome=request.saleOutcome,
            missteps=request.missteps
        )
        
        # Determine end reason
        end_reason = "completed"
        if request.saleOutcome == "won":
            end_reason = "sale_won"
        elif request.saleOutcome == "lost":
            # Check if lost due to inappropriate remark
            critical_missteps = [m for m in request.missteps if m.get("severity") == "critical"]
            if critical_missteps:
                end_reason = "inappropriate_remark"
            else:
                end_reason = "sale_lost"

        # Build transcript for review (full conversation with metadata)
        transcript = []
        for msg in request.conversationHistory:
            transcript.append({
                "role": msg.get("role", "unknown"),
                "content": msg.get("content", ""),
                "timestamp": msg.get("timestamp", datetime.utcnow().isoformat()),
            })

        # Build scorecard
        scorecard = {
            "sessionId": request.sessionId,
            "completedAt": datetime.utcnow().isoformat(),
            "overallScore": round(overall_score, 1),
            "saleOutcome": request.saleOutcome,
            "finalStage": request.currentStage,
            "finalStageName": pulse_engine.get_stage_info(request.currentStage)["name"],
            "trustScore": request.trustScore,
            "stageScores": stage_scores,
            "rubricCompliance": rubric_compliance,
            "missteps": request.missteps,
            "aiFeedback": ai_feedback,
            "personaId": request.personaId,
            "totalExchanges": len([m for m in request.conversationHistory if m.get("role") == "user"]),
            "transcript": transcript,
            "endReason": end_reason,
        }
        
        # Store scorecard
        await db.create_scorecard(request.sessionId, scorecard)
        
        # Update session
        await db.update_session(
            session_id=request.sessionId,
            overall_score=overall_score,
            sale_outcome=request.saleOutcome,
            end_time=datetime.utcnow()
        )
        
        logger.info(f"Session completed: {request.sessionId}, score={overall_score}")
        
        return scorecard
        
    except Exception as e:
        logger.error(f"Session complete error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/feedback/{session_id}")
async def get_feedback(session_id: str):
    """Get feedback for a completed session."""
    try:
        scorecard = await db.get_scorecard(session_id)
        
        if not scorecard:
            raise HTTPException(status_code=404, detail="Session not found")
        
        return scorecard
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Feedback error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# TTS Endpoints
# =============================================================================

@app.post("/api/tts")
async def text_to_speech(request: TTSRequest):
    """Generate speech audio from text."""
    try:
        tts_provider = get_tts_provider()
        
        # Get voice based on persona
        voice_id = request.voiceId
        if not voice_id and request.personaId:
            persona = pulse_engine.get_persona(request.personaId)
            voice_id = persona.get("voice_id")
        
        audio_data = await tts_provider.synthesize(request.text, voice_id)
        
        return StreamingResponse(
            iter([audio_data]),
            media_type="audio/mpeg",
            headers={"Content-Disposition": "inline; filename=speech.mp3"}
        )
        
    except Exception as e:
        logger.error(f"TTS error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/speech/token")
async def get_speech_config():
    """Get speech configuration for client-side TTS."""
    tts_provider = os.getenv("TTS_PROVIDER", "openai")
    
    return {
        "provider": tts_provider,
        "voices": pulse_engine.get_voice_mapping(tts_provider),
        "defaultVoice": "alloy" if tts_provider == "openai" else "en-US-Neural2-F",
    }


# =============================================================================
# Admin Endpoints
# =============================================================================

@app.get("/api/admin/prompts")
async def get_prompts():
    """Get all prompts."""
    try:
        prompts = await db.get_prompts()
        return {"prompts": prompts}
    except Exception as e:
        logger.error(f"Get prompts error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/admin/prompts")
async def create_prompt(prompt: Dict[str, Any]):
    """Create or update a prompt."""
    admin_enabled = os.getenv("ADMIN_EDIT_ENABLED", "true").lower() == "true"
    if not admin_enabled:
        raise HTTPException(status_code=403, detail="Admin editing is disabled")
    
    try:
        result = await db.upsert_prompt(prompt)
        return result
    except Exception as e:
        logger.error(f"Create prompt error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/admin/sessions")
async def get_sessions(limit: int = 50, offset: int = 0):
    """Get recent sessions for admin dashboard."""
    try:
        sessions = await db.get_sessions(limit=limit, offset=offset)
        return {"sessions": sessions}
    except Exception as e:
        logger.error(f"Get sessions error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Readiness Endpoints
# =============================================================================

@app.get("/api/readiness/{user_id}")
async def get_readiness(user_id: str):
    """Get readiness data for a user."""
    try:
        if not readiness_service.validate_user_id(user_id):
            raise HTTPException(status_code=400, detail="Invalid user_id")
        
        readiness = await readiness_service.get_user_readiness(db.pool, user_id)
        
        if not readiness:
            # Return default readiness if none exists
            return {
                "user_id": user_id,
                "readiness_overall": None,
                "readiness_technical": None,
                "readiness_communication": None,
                "readiness_structure": None,
                "readiness_behavioral": None,
                "message": "No readiness data available yet",
            }
        
        return readiness
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get readiness error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/readiness/{user_id}/skills")
async def get_readiness_skills(user_id: str):
    """Get skill aggregates for a user."""
    try:
        if not readiness_service.validate_user_id(user_id):
            raise HTTPException(status_code=400, detail="Invalid user_id")
        
        skills = await readiness_service.get_user_skill_aggregates(db.pool, user_id)
        return {"skills": skills}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get readiness skills error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/readiness/{user_id}/compute")
async def compute_readiness(user_id: str):
    """Compute and store readiness for a user."""
    try:
        if not readiness_service.validate_user_id(user_id):
            raise HTTPException(status_code=400, detail="Invalid user_id")
        
        snapshot = await readiness_service.compute_and_store_user_readiness(db.pool, user_id)
        
        if not snapshot:
            return {"message": "No session data available to compute readiness"}
        
        return snapshot
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Compute readiness error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Avatar Token Endpoint
# =============================================================================

@app.post("/api/avatar/token")
async def get_avatar_token():
    """Get avatar/speech configuration."""
    tts_provider = os.getenv("TTS_PROVIDER", "openai")
    ai_provider = os.getenv("AI_PROVIDER", "openai")
    
    return {
        "provider": tts_provider,
        "aiProvider": ai_provider,
        "voices": pulse_engine.get_voice_mapping(tts_provider),
        "defaultVoice": "alloy" if tts_provider == "openai" else "en-US-Neural2-F",
        "avatarEnabled": False,  # No avatar in Docker version (audio only)
        "message": "Avatar not available in local Docker version. Using audio-only mode.",
    }


# =============================================================================
# Trainer PULSE Step Endpoint
# =============================================================================

class TrainerStepRequest(BaseModel):
    sessionId: str
    currentStep: int = 1
    userMessage: str = ""
    personaId: str = "director"


@app.post("/api/trainer/pulse/step")
async def trainer_pulse_step(request: TrainerStepRequest):
    """Get guidance for current PULSE step in training mode."""
    try:
        stage_info = pulse_engine.get_stage_info(request.currentStep)
        persona = pulse_engine.get_persona(request.personaId)
        
        # Generate coaching tips for current stage
        coaching_tips = {
            1: [
                "Start with open-ended questions",
                "Avoid talking about products yet",
                "Focus on understanding the customer's situation",
            ],
            2: [
                "Reflect back what you heard",
                "Use phrases like 'So what I'm hearing is...'",
                "Confirm you understand their needs",
            ],
            3: [
                "Connect features to their stated needs",
                "Use their words when describing benefits",
                "Reference what they told you earlier",
            ],
            4: [
                "Present a focused recommendation",
                "Simplify options - don't overwhelm",
                "Address any concerns proactively",
            ],
            5: [
                "Ask for a specific next step",
                "Be confident but not pushy",
                "Make it easy for them to say yes",
            ],
        }
        
        return {
            "sessionId": request.sessionId,
            "currentStep": request.currentStep,
            "stepName": stage_info["name"],
            "stepDescription": stage_info["description"],
            "coachingTips": coaching_tips.get(request.currentStep, []),
            "personaHint": f"Remember: {persona['name']} customers are {persona['description'].lower()}",
            "nextStep": min(request.currentStep + 1, 5),
            "nextStepName": pulse_engine.get_stage_info(min(request.currentStep + 1, 5))["name"],
        }
        
    except Exception as e:
        logger.error(f"Trainer step error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Admin Agents Endpoint
# =============================================================================

@app.get("/api/admin/agents")
async def get_agents():
    """Get AI agent configurations."""
    ai_provider = os.getenv("AI_PROVIDER", "openai")
    
    agents = [
        {
            "id": "persona-core-chat",
            "name": "Persona Core Chat",
            "description": "Main conversational AI for customer personas",
            "provider": ai_provider,
            "model": os.getenv(f"{ai_provider.upper()}_MODEL", "gpt-4o"),
            "status": "active",
        },
        {
            "id": "feedback-generator",
            "name": "Feedback Generator",
            "description": "Generates session feedback and coaching tips",
            "provider": ai_provider,
            "model": os.getenv(f"{ai_provider.upper()}_MODEL", "gpt-4o"),
            "status": "active",
        },
    ]
    
    return {"agents": agents}


# =============================================================================
# Admin Prompt Versions Endpoints
# =============================================================================

@app.get("/api/admin/prompts/{prompt_id}")
async def get_prompt_by_id(prompt_id: str):
    """Get a specific prompt by ID."""
    try:
        prompt = await db.get_prompt(prompt_id)
        if not prompt:
            raise HTTPException(status_code=404, detail="Prompt not found")
        return prompt
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get prompt error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/admin/prompts/{prompt_id}")
async def update_prompt_by_id(prompt_id: str, prompt: Dict[str, Any]):
    """Update a specific prompt."""
    admin_enabled = os.getenv("ADMIN_EDIT_ENABLED", "true").lower() == "true"
    if not admin_enabled:
        raise HTTPException(status_code=403, detail="Admin editing is disabled")
    
    try:
        prompt["id"] = prompt_id
        result = await db.upsert_prompt(prompt)
        return result
    except Exception as e:
        logger.error(f"Update prompt error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/admin/prompts/{prompt_id}/versions")
async def get_prompt_versions(prompt_id: str):
    """Get all versions of a prompt."""
    try:
        versions = storage.get_prompt_versions(prompt_id)
        return {"versions": versions}
    except Exception as e:
        logger.error(f"Get prompt versions error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/admin/prompts/{prompt_id}/versions/{version}")
async def get_prompt_version(prompt_id: str, version: int):
    """Get a specific version of a prompt."""
    try:
        versions = storage.get_prompt_versions(prompt_id)
        for v in versions:
            if v.get("version") == version:
                return v
        raise HTTPException(status_code=404, detail="Version not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get prompt version error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Audio Chunk Endpoint (for streaming audio)
# =============================================================================

class AudioChunkRequest(BaseModel):
    sessionId: str
    audioData: str  # Base64 encoded audio
    format: str = "webm"


@app.post("/api/audio/chunk")
async def process_audio_chunk(request: AudioChunkRequest):
    """Process an audio chunk (transcribe and respond)."""
    try:
        import base64
        
        # Decode audio
        audio_bytes = base64.b64decode(request.audioData)
        
        # For now, return a message that audio processing requires cloud STT
        # In a full implementation, you'd use Whisper API or local Whisper
        return {
            "sessionId": request.sessionId,
            "transcription": "",
            "message": "Audio transcription requires STT service. Use text chat endpoint instead.",
            "useTextChat": True,
        }
        
    except Exception as e:
        logger.error(f"Audio chunk error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Context Endpoint
# =============================================================================

@app.get("/api/context")
async def get_context():
    """Get application context and configuration."""
    return {
        "environment": os.getenv("ENVIRONMENT", "development"),
        "aiProvider": os.getenv("AI_PROVIDER", "openai"),
        "ttsProvider": os.getenv("TTS_PROVIDER", "openai"),
        "adminEnabled": os.getenv("ADMIN_EDIT_ENABLED", "true").lower() == "true",
        "readinessEnabled": readiness_service.readiness_enabled(),
        "avatarEnabled": False,
        "version": "1.0.0-docker",
        "features": {
            "chat": True,
            "tts": True,
            "stt": False,  # Requires additional setup
            "avatar": False,
            "readiness": readiness_service.readiness_enabled(),
            "admin": os.getenv("ADMIN_EDIT_ENABLED", "true").lower() == "true",
        },
    }


# =============================================================================
# Seed Test Data Endpoint (Development)
# =============================================================================

@app.post("/api/seed-test-session")
async def seed_test_session(data: Dict[str, Any]):
    """Seed test session data for development."""
    if os.getenv("ENVIRONMENT", "development") not in ("development", "dev", "local"):
        raise HTTPException(status_code=403, detail="Only available in development")
    
    try:
        session_id = data.get("sessionId", str(uuid.uuid4()))
        outcome = data.get("outcome", "won")
        
        # Create test scorecard
        scorecard = {
            "sessionId": session_id,
            "completedAt": datetime.utcnow().isoformat(),
            "overallScore": 85.0 if outcome == "won" else 45.0,
            "saleOutcome": outcome,
            "finalStage": 5 if outcome == "won" else 3,
            "finalStageName": "Earn" if outcome == "won" else "Link",
            "trustScore": 8 if outcome == "won" else 3,
            "stageScores": {
                "Probe": 90,
                "Understand": 85,
                "Link": 80,
                "Solve": 75 if outcome == "won" else 0,
                "Earn": 70 if outcome == "won" else 0,
            },
            "rubricCompliance": {
                "overallCompliance": 85,
                "totalExchanges": 10,
                "misstepCount": 1 if outcome == "won" else 3,
            },
            "aiFeedback": {
                "overallScore": 85 if outcome == "won" else 45,
                "strengths": ["Good discovery questions", "Built rapport effectively"],
                "areasToImprove": ["Close more confidently"],
                "coachingTips": ["Practice the Earn stage more"],
            },
            "personaId": "director",
            "isTestData": True,
        }
        
        storage.save_scorecard(session_id, scorecard)
        
        return {
            "message": "Test session created",
            "sessionId": session_id,
            "outcome": outcome,
        }
        
    except Exception as e:
        logger.error(f"Seed test session error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Error Handlers
# =============================================================================

# =============================================================================
# Avatar Management Endpoints
# =============================================================================

class AvatarDownloadRequest(BaseModel):
    """Request to download an avatar from ModelScope."""
    avatar_id: str
    name: Optional[str] = None
    gender: str = "unknown"
    style: str = "default"


@app.get("/api/avatars/catalog")
async def get_avatar_catalog():
    """Get the catalog of available avatars from ModelScope."""
    try:
        catalog = avatar_manager.get_avatar_catalog()
        return catalog
    except Exception as e:
        logger.error(f"Failed to get avatar catalog: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/avatars/local")
async def list_local_avatars():
    """List all locally downloaded avatars."""
    try:
        avatars = avatar_manager.list_local_avatars()
        return {"avatars": avatars}
    except Exception as e:
        logger.error(f"Failed to list local avatars: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/avatars/local/{avatar_id:path}")
async def get_local_avatar(avatar_id: str):
    """Get info about a specific local avatar."""
    try:
        avatar = avatar_manager.get_local_avatar(avatar_id)
        if not avatar:
            raise HTTPException(status_code=404, detail="Avatar not found")
        return avatar
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get avatar {avatar_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/avatars/download")
async def download_avatar(request: AvatarDownloadRequest):
    """Start downloading an avatar from ModelScope."""
    try:
        job_id = await avatar_manager.download_avatar(
            avatar_id=request.avatar_id,
            name=request.name,
            gender=request.gender,
            style=request.style
        )
        return {"status": "started", "job_id": job_id}
    except Exception as e:
        logger.error(f"Failed to start avatar download: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/avatars/download/{job_id}")
async def get_download_status(job_id: str):
    """Get the status of an avatar download job."""
    try:
        status = avatar_manager.get_download_status(job_id)
        if not status:
            raise HTTPException(status_code=404, detail="Download job not found")
        return status
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get download status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/avatars/local/{avatar_id:path}")
async def delete_local_avatar(avatar_id: str):
    """Delete a locally downloaded avatar."""
    try:
        success = avatar_manager.delete_avatar(avatar_id)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to delete avatar")
        return {"status": "deleted", "avatar_id": avatar_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete avatar {avatar_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/voices/local")
async def list_local_voices():
    """List available local Piper TTS voices."""
    try:
        voices = avatar_manager.get_available_voices()
        return {"voices": voices}
    except Exception as e:
        logger.error(f"Failed to list voices: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/voices/local/{gender}")
async def list_voices_by_gender(gender: str):
    """List local voices filtered by gender."""
    try:
        if gender not in ["male", "female"]:
            raise HTTPException(status_code=400, detail="Gender must be 'male' or 'female'")
        voices = avatar_manager.get_voices_by_gender(gender)
        return {"voices": voices}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to list voices: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class VoiceDownloadRequest(BaseModel):
    voice_id: str
    name: str
    gender: str
    onnx_url: str
    json_url: str


@app.post("/api/voices/download")
async def download_voice(request: VoiceDownloadRequest):
    """Download a Piper TTS voice from HuggingFace."""
    try:
        result = await avatar_manager.download_voice(
            voice_id=request.voice_id,
            name=request.name,
            gender=request.gender,
            onnx_url=request.onnx_url,
            json_url=request.json_url
        )
        if result.get("success"):
            return result
        else:
            raise HTTPException(status_code=500, detail=result.get("error", "Download failed"))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to download voice: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/voices/downloaded")
async def list_downloaded_voices():
    """List all downloaded Piper TTS voices."""
    try:
        voices = avatar_manager.get_downloaded_voices()
        return {"voices": voices}
    except Exception as e:
        logger.error(f"Failed to list downloaded voices: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/voices/{voice_id}")
async def delete_voice(voice_id: str):
    """Delete a downloaded voice."""
    try:
        success = avatar_manager.delete_voice(voice_id)
        if success:
            return {"success": True, "message": f"Voice {voice_id} deleted"}
        else:
            raise HTTPException(status_code=500, detail="Failed to delete voice")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete voice: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Persona Avatar/Voice Configuration Endpoints
# =============================================================================

class PersonaAvatarUpdateRequest(BaseModel):
    avatar_id: Optional[str] = None
    avatar_gender: Optional[str] = None
    avatar_style: Optional[str] = None
    avatar_randomize: Optional[bool] = None


class PersonaVoiceUpdateRequest(BaseModel):
    voice_id: Optional[str] = None
    voice_style: Optional[str] = None
    voice_openai: Optional[str] = None
    voice_google: Optional[str] = None
    voice_elevenlabs: Optional[str] = None


class PersonaUpdateRequest(BaseModel):
    name: Optional[str] = None
    difficulty: Optional[str] = None
    description: Optional[str] = None
    greeting: Optional[str] = None
    avatar_id: Optional[str] = None
    avatar_gender: Optional[str] = None
    avatar_style: Optional[str] = None
    avatar_randomize: Optional[bool] = None
    voice_id: Optional[str] = None
    voice_style: Optional[str] = None
    voice_openai: Optional[str] = None
    voice_google: Optional[str] = None
    voice_elevenlabs: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    is_active: Optional[bool] = None


@app.get("/api/personas")
async def get_personas(active_only: bool = True):
    """Get all personas with their avatar/voice configurations."""
    try:
        personas = await db.get_personas(active_only=active_only)
        return {"personas": personas}
    except Exception as e:
        logger.error(f"Failed to get personas: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/personas/{persona_key}")
async def get_persona(persona_key: str):
    """Get a specific persona by key."""
    try:
        persona = await db.get_persona_by_key(persona_key)
        if not persona:
            raise HTTPException(status_code=404, detail=f"Persona '{persona_key}' not found")
        return persona
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get persona {persona_key}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/personas/{persona_key}")
async def update_persona(persona_key: str, request: PersonaUpdateRequest):
    """Update a persona's configuration."""
    try:
        # Convert request to dict, excluding None values
        updates = {k: v for k, v in request.model_dump().items() if v is not None}
        
        if not updates:
            return await db.get_persona_by_key(persona_key)
        
        result = await db.update_persona(persona_key, updates)
        if not result:
            raise HTTPException(status_code=404, detail=f"Persona '{persona_key}' not found")
        
        logger.info(f"Updated persona {persona_key}: {list(updates.keys())}")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update persona {persona_key}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/personas/{persona_key}/avatar")
async def get_persona_avatar(persona_key: str):
    """Get a persona's avatar configuration."""
    try:
        persona = await db.get_persona_by_key(persona_key)
        if not persona:
            raise HTTPException(status_code=404, detail=f"Persona '{persona_key}' not found")
        
        return {
            "persona_key": persona_key,
            "avatar_id": persona.get("avatar_id"),
            "avatar_gender": persona.get("avatar_gender"),
            "avatar_style": persona.get("avatar_style"),
            "avatar_randomize": persona.get("avatar_randomize")
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get persona avatar {persona_key}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/personas/{persona_key}/avatar")
async def update_persona_avatar(persona_key: str, request: PersonaAvatarUpdateRequest):
    """Update a persona's avatar configuration."""
    try:
        result = await db.update_persona_avatar(
            persona_key=persona_key,
            avatar_id=request.avatar_id,
            avatar_gender=request.avatar_gender,
            avatar_style=request.avatar_style,
            avatar_randomize=request.avatar_randomize
        )
        
        if not result:
            raise HTTPException(status_code=404, detail=f"Persona '{persona_key}' not found")
        
        logger.info(f"Updated avatar for persona {persona_key}: {request.avatar_id}")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update persona avatar {persona_key}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/personas/{persona_key}/voice")
async def get_persona_voice(persona_key: str):
    """Get a persona's voice configuration."""
    try:
        persona = await db.get_persona_by_key(persona_key)
        if not persona:
            raise HTTPException(status_code=404, detail=f"Persona '{persona_key}' not found")
        
        return {
            "persona_key": persona_key,
            "voice_id": persona.get("voice_id"),
            "voice_style": persona.get("voice_style"),
            "voice_openai": persona.get("voice_openai"),
            "voice_google": persona.get("voice_google"),
            "voice_elevenlabs": persona.get("voice_elevenlabs")
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get persona voice {persona_key}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/personas/{persona_key}/voice")
async def update_persona_voice(persona_key: str, request: PersonaVoiceUpdateRequest):
    """Update a persona's voice configuration."""
    try:
        result = await db.update_persona_voice(
            persona_key=persona_key,
            voice_id=request.voice_id,
            voice_style=request.voice_style,
            voice_openai=request.voice_openai,
            voice_google=request.voice_google,
            voice_elevenlabs=request.voice_elevenlabs
        )
        
        if not result:
            raise HTTPException(status_code=404, detail=f"Persona '{persona_key}' not found")
        
        logger.info(f"Updated voice for persona {persona_key}: {request.voice_id}")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update persona voice {persona_key}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Error Handlers
# =============================================================================

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler."""
    logger.error(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "detail": str(exc)}
    )
