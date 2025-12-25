"""
AI Provider Abstraction Layer

Supports: OpenAI, Anthropic (Claude), Google (Gemini)
"""

import json
import logging
import os
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


# Inappropriate Remarks Detection System Prompt
INAPPROPRIATE_REMARKS_PROMPT = """You are an AI agent that detects inappropriate remarks from sales associates.

CRITICAL CONTEXT: This is a MATTRESS/SLEEP STORE training simulation. The following are COMPLETELY NORMAL and should NEVER be flagged:
- Discussing sleep positions (back sleeper, side sleeper, stomach sleeper)
- Asking about body movement during sleep ("do you roll around", "toss and turn")
- Discussing partner sleep habits ("does your partner move a lot")
- Asking about physical comfort ("back pain", "hip pain", "pressure points")
- Discussing body types for mattress firmness ("heavier build", "petite frame")
- Asking customers to try/test beds ("would you like to lie down and try it")
- Any legitimate sleep/mattress related question

BE CONSERVATIVE: Only flag content that is EXPLICITLY and UNMISTAKABLY inappropriate. When in doubt, do NOT flag.

SEVERITY TIERS:

TIER 1 - MINOR (-1 trust):
Casual profanity not directed at customer.
Examples: "damn, this is a good mattress", "heck yeah", "crap, let me check that"

TIER 2 - MODERATE (-3 trust):
Rude or dismissive behavior directed at the customer.
Examples:
- Dismissive: "yeah yeah whatever", "I don't care what you think", "just hurry up and decide"
- Insults: calling customer stupid, idiot, dumb, moron

TIER 3 - SEVERE (-4 trust):
Explicit profanity directed AT the customer or aggressive language.
Examples: "fuck you", "you're full of shit", "shut the hell up", explicit threats

TIER 4 - CRITICAL (Session ends immediately):
ONLY flag for EXPLICIT, UNMISTAKABLE sexual harassment or advances.
Must be BLATANTLY obvious - not ambiguous or interpretable as professional.
Examples that SHOULD be flagged:
- "You're really sexy/hot"
- "I want to fuck you" or similar explicit sexual propositions
- "What are you wearing under that?" (clearly sexual, not about sleep attire)
- "Can I get your number for a date?"
- "Want to come back to my place?"
- Explicit comments about body parts in a sexual way

Examples that should NOT be flagged (legitimate mattress sales):
- "As a back sleeper, do you roll around a lot?" (normal sleep question)
- "Would you like to try lying down on this bed?" (normal mattress demo)
- "Does your partner move around during sleep?" (normal partner compatibility question)
- "How's your body feeling on this firmness?" (normal comfort check)
- "Do you sleep hot?" (normal temperature preference question)

DETECTION RULES:
1. DEFAULT TO NOT FLAGGING - only flag when absolutely certain
2. Mattress/sleep/body comfort discussions are ALWAYS acceptable
3. Tier 4 requires EXPLICIT sexual content - no inference or interpretation
4. Ask yourself: "Would a reasonable person see this as sexual harassment?" If there's any doubt, don't flag.
5. Professional mattress sales language is NEVER inappropriate

Respond with ONLY a JSON object:
{
  "detected": true/false,
  "tier": 0-4 (0 if not detected),
  "severity": "none"|"minor"|"moderate"|"severe"|"critical",
  "category": "none"|"minor_language"|"dismissive_behavior"|"rude_insults"|"severe_profanity"|"aggressive_threats"|"sexual_harassment"|"pickup_lines"|"inappropriate_suggestions",
  "trust_penalty": 0 to -10,
  "ends_session": true/false,
  "response_hint": "suggested customer response or empty string",
  "reason": "brief explanation"
}

If no inappropriate content is detected, return:
{"detected": false, "tier": 0, "severity": "none", "category": "none", "trust_penalty": 0, "ends_session": false, "response_hint": "", "reason": "No inappropriate content detected"}
"""


class AIProvider(ABC):
    """Abstract base class for AI providers."""
    
    @abstractmethod
    async def generate_response(
        self, 
        messages: List[Dict[str, str]], 
        system_prompt: str
    ) -> str:
        """Generate a response from the AI model."""
        pass
    
    @abstractmethod
    async def generate_feedback(
        self,
        conversation_history: List[Dict[str, str]],
        final_stage: int,
        trust_score: int,
        sale_outcome: str,
        missteps: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Generate AI feedback for a completed session."""
        pass
    
    @abstractmethod
    async def detect_inappropriate_remarks(
        self,
        message: str
    ) -> Dict[str, Any]:
        """Detect inappropriate remarks in a trainee's message using LLM.
        
        Returns dict with:
        - detected: bool
        - tier: 0-4
        - severity: none/minor/moderate/severe/critical
        - category: specific category id
        - trust_penalty: 0 to -10
        - ends_session: bool
        - response_hint: suggested persona response
        - reason: explanation
        """
        pass
    
    def _parse_inappropriate_response(self, text: str) -> Dict[str, Any]:
        """Parse the LLM response for inappropriate remarks detection."""
        try:
            start = text.find('{')
            end = text.rfind('}') + 1
            if start >= 0 and end > start:
                result = json.loads(text[start:end])
                # Validate required fields
                if "detected" in result:
                    return result
        except Exception as e:
            logger.warning(f"Failed to parse inappropriate remarks response: {e}")
        
        # Return safe default
        return {
            "detected": False,
            "tier": 0,
            "severity": "none",
            "category": "none",
            "trust_penalty": 0,
            "ends_session": False,
            "response_hint": "",
            "reason": "Parse error - defaulting to safe"
        }


class OpenAIProvider(AIProvider):
    """OpenAI GPT provider."""
    
    def __init__(self):
        from openai import AsyncOpenAI
        self.client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        self.model = os.getenv("OPENAI_MODEL", "gpt-4o")
        logger.info(f"OpenAI provider initialized with model: {self.model}")
    
    async def generate_response(
        self, 
        messages: List[Dict[str, str]], 
        system_prompt: str
    ) -> str:
        try:
            formatted_messages = [{"role": "system", "content": system_prompt}]
            for msg in messages:
                formatted_messages.append({
                    "role": msg.get("role", "user"),
                    "content": msg.get("content", "")
                })
            
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=formatted_messages,
                max_tokens=500,
                temperature=0.7
            )
            
            return response.choices[0].message.content
            
        except Exception as e:
            logger.error(f"OpenAI error: {e}")
            return "I'm sorry, I'm having trouble processing that. Could you repeat?"
    
    async def generate_feedback(
        self,
        conversation_history: List[Dict[str, str]],
        final_stage: int,
        trust_score: int,
        sale_outcome: str,
        missteps: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        try:
            prompt = self._build_feedback_prompt(
                conversation_history, final_stage, trust_score, sale_outcome, missteps
            )
            
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=1000,
                temperature=0.5
            )
            
            return self._parse_feedback_response(response.choices[0].message.content)
            
        except Exception as e:
            logger.error(f"OpenAI feedback error: {e}")
            return self._default_feedback()
    
    def _build_feedback_prompt(self, history, stage, trust, outcome, missteps) -> str:
        return f"""Analyze this sales training session and provide feedback:

Session Summary:
- Final PULSE Stage: {stage}/5
- Trust Score: {trust}/10
- Sale Outcome: {outcome}
- Missteps: {len(missteps)}

Provide a JSON response with:
1. overallScore (0-100)
2. strengths (array of 2-3 items)
3. areasToImprove (array of 2-3 items)
4. coachingTips (array of 3 actionable tips)
5. stageAnalysis (object with score for each PULSE stage: Probe, Understand, Link, Solve, Earn)

Respond ONLY with valid JSON."""

    def _parse_feedback_response(self, text: str) -> Dict[str, Any]:
        try:
            start = text.find('{')
            end = text.rfind('}') + 1
            if start >= 0 and end > start:
                return json.loads(text[start:end])
        except:
            pass
        return self._default_feedback()
    
    def _default_feedback(self) -> Dict[str, Any]:
        return {
            "overallScore": 70,
            "strengths": ["Engaged with customer", "Maintained conversation flow"],
            "areasToImprove": ["Work on closing techniques", "Better objection handling"],
            "coachingTips": [
                "Practice the PULSE methodology stages",
                "Focus on understanding customer needs before presenting solutions",
                "Use open-ended questions to build rapport"
            ],
            "stageAnalysis": {
                "Probe": 75, "Understand": 70, "Link": 65, "Solve": 60, "Earn": 55
            }
        }
    
    async def detect_inappropriate_remarks(self, message: str) -> Dict[str, Any]:
        """Detect inappropriate remarks using OpenAI."""
        try:
            prompt = f"{INAPPROPRIATE_REMARKS_PROMPT}\n\nMessage to analyze:\n\"{message}\""
            
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=300,
                temperature=0.1  # Low temperature for consistent detection
            )
            
            return self._parse_inappropriate_response(response.choices[0].message.content)
            
        except Exception as e:
            logger.error(f"OpenAI inappropriate remarks detection error: {e}")
            return self._parse_inappropriate_response("")


class AnthropicProvider(AIProvider):
    """Anthropic Claude provider."""
    
    def __init__(self):
        from anthropic import AsyncAnthropic
        self.client = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        self.model = os.getenv("ANTHROPIC_MODEL", "claude-3-5-sonnet-20241022")
        logger.info(f"Anthropic provider initialized with model: {self.model}")
    
    async def generate_response(
        self, 
        messages: List[Dict[str, str]], 
        system_prompt: str
    ) -> str:
        try:
            formatted_messages = []
            for msg in messages:
                formatted_messages.append({
                    "role": msg.get("role", "user"),
                    "content": msg.get("content", "")
                })
            
            response = await self.client.messages.create(
                model=self.model,
                max_tokens=500,
                system=system_prompt,
                messages=formatted_messages
            )
            
            return response.content[0].text
            
        except Exception as e:
            logger.error(f"Anthropic error: {e}")
            return "I'm sorry, I'm having trouble processing that. Could you repeat?"
    
    async def generate_feedback(
        self,
        conversation_history: List[Dict[str, str]],
        final_stage: int,
        trust_score: int,
        sale_outcome: str,
        missteps: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        try:
            prompt = f"""Analyze this sales training session and provide feedback:

Session Summary:
- Final PULSE Stage: {final_stage}/5
- Trust Score: {trust_score}/10
- Sale Outcome: {sale_outcome}
- Missteps: {len(missteps)}

Provide a JSON response with:
1. overallScore (0-100)
2. strengths (array of 2-3 items)
3. areasToImprove (array of 2-3 items)
4. coachingTips (array of 3 actionable tips)
5. stageAnalysis (object with score for each PULSE stage)

Respond ONLY with valid JSON."""

            response = await self.client.messages.create(
                model=self.model,
                max_tokens=1000,
                messages=[{"role": "user", "content": prompt}]
            )
            
            text = response.content[0].text
            try:
                start = text.find('{')
                end = text.rfind('}') + 1
                if start >= 0 and end > start:
                    return json.loads(text[start:end])
            except:
                pass
            
            return self._default_feedback()
            
        except Exception as e:
            logger.error(f"Anthropic feedback error: {e}")
            return self._default_feedback()
    
    def _default_feedback(self) -> Dict[str, Any]:
        return {
            "overallScore": 70,
            "strengths": ["Engaged with customer", "Maintained conversation flow"],
            "areasToImprove": ["Work on closing techniques", "Better objection handling"],
            "coachingTips": [
                "Practice the PULSE methodology stages",
                "Focus on understanding customer needs",
                "Use open-ended questions"
            ],
            "stageAnalysis": {
                "Probe": 75, "Understand": 70, "Link": 65, "Solve": 60, "Earn": 55
            }
        }
    
    async def detect_inappropriate_remarks(self, message: str) -> Dict[str, Any]:
        """Detect inappropriate remarks using Anthropic Claude."""
        try:
            prompt = f"{INAPPROPRIATE_REMARKS_PROMPT}\n\nMessage to analyze:\n\"{message}\""
            
            response = await self.client.messages.create(
                model=self.model,
                max_tokens=300,
                messages=[{"role": "user", "content": prompt}]
            )
            
            return self._parse_inappropriate_response(response.content[0].text)
            
        except Exception as e:
            logger.error(f"Anthropic inappropriate remarks detection error: {e}")
            return self._parse_inappropriate_response("")


class GoogleProvider(AIProvider):
    """Google Gemini provider."""
    
    def __init__(self):
        import google.generativeai as genai
        genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
        self.model_name = os.getenv("GOOGLE_MODEL", "gemini-2.0-flash")
        self.model = genai.GenerativeModel(self.model_name)
        logger.info(f"Google provider initialized with model: {self.model_name}")
    
    async def generate_response(
        self, 
        messages: List[Dict[str, str]], 
        system_prompt: str
    ) -> str:
        try:
            # Build conversation with system prompt
            full_prompt = f"{system_prompt}\n\n"
            for msg in messages:
                role = "User" if msg.get("role") == "user" else "Assistant"
                full_prompt += f"{role}: {msg.get('content', '')}\n"
            full_prompt += "Assistant:"
            
            response = self.model.generate_content(full_prompt)
            
            return response.text
            
        except Exception as e:
            logger.error(f"Google error: {e}")
            return "I'm sorry, I'm having trouble processing that. Could you repeat?"
    
    async def generate_feedback(
        self,
        conversation_history: List[Dict[str, str]],
        final_stage: int,
        trust_score: int,
        sale_outcome: str,
        missteps: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        try:
            prompt = f"""Analyze this sales training session and provide feedback:

Session Summary:
- Final PULSE Stage: {final_stage}/5
- Trust Score: {trust_score}/10
- Sale Outcome: {sale_outcome}
- Missteps: {len(missteps)}

Provide a JSON response with:
1. overallScore (0-100)
2. strengths (array of 2-3 items)
3. areasToImprove (array of 2-3 items)
4. coachingTips (array of 3 actionable tips)
5. stageAnalysis (object with score for each PULSE stage)

Respond ONLY with valid JSON."""

            response = self.model.generate_content(prompt)
            text = response.text
            
            try:
                start = text.find('{')
                end = text.rfind('}') + 1
                if start >= 0 and end > start:
                    return json.loads(text[start:end])
            except:
                pass
            
            return self._default_feedback()
            
        except Exception as e:
            logger.error(f"Google feedback error: {e}")
            return self._default_feedback()
    
    def _default_feedback(self) -> Dict[str, Any]:
        return {
            "overallScore": 70,
            "strengths": ["Engaged with customer", "Maintained conversation flow"],
            "areasToImprove": ["Work on closing techniques", "Better objection handling"],
            "coachingTips": [
                "Practice the PULSE methodology stages",
                "Focus on understanding customer needs",
                "Use open-ended questions"
            ],
            "stageAnalysis": {
                "Probe": 75, "Understand": 70, "Link": 65, "Solve": 60, "Earn": 55
            }
        }
    
    async def detect_inappropriate_remarks(self, message: str) -> Dict[str, Any]:
        """Detect inappropriate remarks using Google Gemini."""
        try:
            prompt = f"{INAPPROPRIATE_REMARKS_PROMPT}\n\nMessage to analyze:\n\"{message}\""
            
            response = self.model.generate_content(prompt)
            
            return self._parse_inappropriate_response(response.text)
            
        except Exception as e:
            logger.error(f"Google inappropriate remarks detection error: {e}")
            return self._parse_inappropriate_response("")


# =============================================================================
# TTS Providers
# =============================================================================

class TTSProvider(ABC):
    """Abstract base class for TTS providers."""
    
    @abstractmethod
    async def synthesize(self, text: str, voice_id: Optional[str] = None) -> bytes:
        """Synthesize speech from text."""
        pass


class OpenAITTSProvider(TTSProvider):
    """OpenAI TTS provider."""
    
    def __init__(self):
        from openai import AsyncOpenAI
        self.client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        logger.info("OpenAI TTS provider initialized")
    
    async def synthesize(self, text: str, voice_id: Optional[str] = None) -> bytes:
        voice = voice_id or "alloy"
        
        response = await self.client.audio.speech.create(
            model="tts-1",
            voice=voice,
            input=text
        )
        
        return response.content


class ElevenLabsTTSProvider(TTSProvider):
    """ElevenLabs TTS provider."""
    
    def __init__(self):
        from elevenlabs import AsyncElevenLabs
        self.client = AsyncElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY"))
        logger.info("ElevenLabs TTS provider initialized")
    
    async def synthesize(self, text: str, voice_id: Optional[str] = None) -> bytes:
        voice = voice_id or "21m00Tcm4TlvDq8ikWAM"  # Rachel voice
        
        audio = await self.client.generate(
            text=text,
            voice=voice,
            model="eleven_monolingual_v1"
        )
        
        # Collect audio chunks
        chunks = []
        async for chunk in audio:
            chunks.append(chunk)
        
        return b"".join(chunks)


class EdgeTTSProvider(TTSProvider):
    """Microsoft Edge TTS provider (free, no API key required)."""
    
    def __init__(self):
        logger.info("Edge TTS provider initialized (free, no API key)")
    
    async def synthesize(self, text: str, voice: str = "alloy") -> bytes:
        import edge_tts
        import io
        
        # Map OpenAI voice names to Edge TTS voices
        voice_map = {
            "alloy": "en-US-AriaNeural",
            "echo": "en-US-GuyNeural",
            "fable": "en-GB-SoniaNeural",
            "onyx": "en-US-ChristopherNeural",
            "nova": "en-US-JennyNeural",
            "shimmer": "en-US-MichelleNeural"
        }
        edge_voice = voice_map.get(voice, "en-US-AriaNeural")
        
        # Generate audio using edge-tts
        communicate = edge_tts.Communicate(text, edge_voice)
        audio_data = io.BytesIO()
        
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_data.write(chunk["data"])
        
        logger.info(f"Edge TTS generated {audio_data.tell()} bytes with voice {edge_voice}")
        return audio_data.getvalue()


class LocalTTSProvider(TTSProvider):
    """Local Piper TTS provider using the piper-tts Docker container."""
    
    def __init__(self):
        import httpx
        # Connect to Piper TTS container (or host machine fallback)
        self.base_url = os.getenv("LOCAL_TTS_URL", "http://piper-tts:8000")
        self.client = httpx.AsyncClient(timeout=60.0)
        logger.info(f"Local TTS provider initialized at {self.base_url}")
    
    async def synthesize(self, text: str, voice: str = "alloy") -> bytes:
        try:
            response = await self.client.post(
                f"{self.base_url}/tts",
                json={
                    "input": text,
                    "voice": voice,
                    "speed": 1.0
                }
            )
            response.raise_for_status()
            
            data = response.json()
            audio_base64 = data.get("audio_base64", "")
            
            import base64
            audio_bytes = base64.b64decode(audio_base64)
            logger.info(f"Local TTS generated {len(audio_bytes)} bytes with voice {voice}")
            return audio_bytes
            
        except Exception as e:
            logger.error(f"Local TTS error: {e}")
            raise


class GoogleTTSProvider(TTSProvider):
    """Google Cloud TTS provider (using REST API with API key)."""
    
    def __init__(self):
        import httpx
        self.api_key = os.getenv("GOOGLE_API_KEY")
        self.client = httpx.AsyncClient()
        logger.info("Google TTS provider initialized")
    
    async def synthesize(self, text: str, voice_id: Optional[str] = None) -> bytes:
        voice_name = voice_id or "en-US-Neural2-F"
        
        url = f"https://texttospeech.googleapis.com/v1/text:synthesize?key={self.api_key}"
        
        payload = {
            "input": {"text": text},
            "voice": {
                "languageCode": "en-US",
                "name": voice_name
            },
            "audioConfig": {
                "audioEncoding": "MP3"
            }
        }
        
        response = await self.client.post(url, json=payload)
        response.raise_for_status()
        
        import base64
        audio_content = response.json().get("audioContent", "")
        return base64.b64decode(audio_content)


class MLXProvider(AIProvider):
    """MLX Omni Server provider for local LLM inference on Apple Silicon.
    
    Uses MLX framework for optimal performance on M1/M2/M3/M4 chips.
    Provides OpenAI-compatible API with MPS/Metal GPU acceleration.
    Recommended models: Qwen3-235B-A22B, Qwen2.5-72B, Qwen2.5-32B
    """
    
    def __init__(self):
        import httpx
        self.base_url = os.getenv("MLX_BASE_URL", "http://host.docker.internal:10240")
        self.model = os.getenv("MLX_MODEL", "mlx-community/Qwen2.5-32B-Instruct-4bit")
        self.client = httpx.AsyncClient(timeout=180.0)  # Longer timeout for large models
        self.fallback_provider = None
        logger.info(f"MLX provider initialized with model: {self.model} at {self.base_url}")
        
        # Check if MLX server is available, set up fallback if not
        self._setup_fallback()
    
    def _setup_fallback(self):
        """Set up fallback provider if MLX server is not available.
        
        Note: Fallback is disabled by default. Set MLX_FALLBACK_PROVIDER to enable.
        """
        fallback = os.getenv("MLX_FALLBACK_PROVIDER", "none").lower()
        if fallback == "none":
            logger.info("MLX fallback disabled - MLX server required")
            return
        try:
            if fallback == "openai":
                self.fallback_provider = OpenAIProvider()
            elif fallback == "anthropic":
                self.fallback_provider = AnthropicProvider()
            elif fallback == "google":
                self.fallback_provider = GoogleProvider()
            logger.info(f"MLX fallback provider configured: {fallback}")
        except Exception as e:
            logger.warning(f"Could not initialize fallback provider: {e}")
    
    async def _check_health(self) -> bool:
        """Check if MLX server is healthy."""
        try:
            response = await self.client.get(f"{self.base_url}/health", timeout=5.0)
            return response.status_code == 200
        except:
            return False
    
    async def generate_response(
        self, 
        messages: List[Dict[str, str]], 
        system_prompt: str
    ) -> str:
        try:
            formatted_messages = [{"role": "system", "content": system_prompt}]
            for msg in messages:
                formatted_messages.append({
                    "role": msg.get("role", "user"),
                    "content": msg.get("content", "")
                })
            
            url = f"{self.base_url}/v1/chat/completions"
            payload = {
                "model": self.model,
                "messages": formatted_messages,
                "max_tokens": 500,
                "temperature": 0.7
            }
            
            response = await self.client.post(url, json=payload)
            response.raise_for_status()
            
            data = response.json()
            return data["choices"][0]["message"]["content"]
            
        except Exception as e:
            logger.error(f"MLX AI error: {e}")
            
            # Try fallback provider
            if self.fallback_provider:
                logger.info("Using fallback provider due to MLX error")
                return await self.fallback_provider.generate_response(messages, system_prompt)
            
            return "I'm sorry, I'm having trouble processing that. Could you repeat?"
    
    async def generate_feedback(
        self,
        conversation_history: List[Dict[str, str]],
        final_stage: int,
        trust_score: int,
        sale_outcome: str,
        missteps: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        try:
            prompt = f"""Analyze this sales training session and provide feedback:

Session Summary:
- Final PULSE Stage: {final_stage}/5
- Trust Score: {trust_score}/10
- Sale Outcome: {sale_outcome}
- Missteps: {len(missteps)}

Provide a JSON response with:
1. overallScore (0-100)
2. strengths (array of 2-3 items)
3. areasToImprove (array of 2-3 items)
4. coachingTips (array of 3 actionable tips)
5. stageAnalysis (object with score for each PULSE stage)

Respond ONLY with valid JSON."""

            url = f"{self.base_url}/v1/chat/completions"
            payload = {
                "model": self.model,
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 1000,
                "temperature": 0.5
            }
            
            response = await self.client.post(url, json=payload)
            response.raise_for_status()
            
            data = response.json()
            text = data["choices"][0]["message"]["content"]
            
            try:
                start = text.find('{')
                end = text.rfind('}') + 1
                if start >= 0 and end > start:
                    return json.loads(text[start:end])
            except:
                pass
            
            return self._default_feedback()
            
        except Exception as e:
            logger.error(f"MLX feedback error: {e}")
            
            # Try fallback provider
            if self.fallback_provider:
                logger.info("Using fallback provider for feedback due to MLX error")
                return await self.fallback_provider.generate_feedback(
                    conversation_history, final_stage, trust_score, sale_outcome, missteps
                )
            
            return self._default_feedback()
    
    def _default_feedback(self) -> Dict[str, Any]:
        return {
            "overallScore": 70,
            "strengths": ["Engaged with customer", "Maintained conversation flow"],
            "areasToImprove": ["Work on closing techniques", "Better objection handling"],
            "coachingTips": [
                "Practice the PULSE methodology stages",
                "Focus on understanding customer needs",
                "Use open-ended questions"
            ],
            "stageAnalysis": {
                "Probe": 75, "Understand": 70, "Link": 65, "Solve": 60, "Earn": 55
            }
        }
    
    async def detect_inappropriate_remarks(self, message: str) -> Dict[str, Any]:
        """Detect inappropriate remarks using MLX local LLM."""
        try:
            prompt = f"{INAPPROPRIATE_REMARKS_PROMPT}\n\nMessage to analyze:\n\"{message}\""
            
            url = f"{self.base_url}/v1/chat/completions"
            payload = {
                "model": self.model,
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 300,
                "temperature": 0.1
            }
            
            response = await self.client.post(url, json=payload)
            response.raise_for_status()
            
            data = response.json()
            return self._parse_inappropriate_response(data["choices"][0]["message"]["content"])
            
        except Exception as e:
            logger.error(f"MLX inappropriate remarks detection error: {e}")
            
            # Try fallback provider
            if self.fallback_provider:
                logger.info("Using fallback provider for inappropriate remarks detection")
                return await self.fallback_provider.detect_inappropriate_remarks(message)
            
            return self._parse_inappropriate_response("")


class DockerAIProvider(AIProvider):
    """Docker AI (Ollama) provider for local LLM inference."""
    
    def __init__(self):
        import httpx
        self.base_url = os.getenv("DOCKER_BASE_URL", "http://host.docker.internal:12434")
        self.model = os.getenv("DOCKER_MODEL", "ai/qwen3")
        self.client = httpx.AsyncClient(timeout=120.0)
        logger.info(f"Docker AI provider initialized with model: {self.model} at {self.base_url}")
    
    async def generate_response(
        self, 
        messages: List[Dict[str, str]], 
        system_prompt: str
    ) -> str:
        try:
            # Build messages in OpenAI-compatible format
            formatted_messages = [{"role": "system", "content": system_prompt}]
            for msg in messages:
                formatted_messages.append({
                    "role": msg.get("role", "user"),
                    "content": msg.get("content", "")
                })
            
            # Ollama uses OpenAI-compatible API
            url = f"{self.base_url}/v1/chat/completions"
            payload = {
                "model": self.model,
                "messages": formatted_messages,
                "max_tokens": 500,
                "temperature": 0.7
            }
            
            response = await self.client.post(url, json=payload)
            response.raise_for_status()
            
            data = response.json()
            return data["choices"][0]["message"]["content"]
            
        except Exception as e:
            logger.error(f"Docker AI error: {e}")
            return "I'm sorry, I'm having trouble processing that. Could you repeat?"
    
    async def generate_feedback(
        self,
        conversation_history: List[Dict[str, str]],
        final_stage: int,
        trust_score: int,
        sale_outcome: str,
        missteps: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        try:
            prompt = f"""Analyze this sales training session and provide feedback:

Session Summary:
- Final PULSE Stage: {final_stage}/5
- Trust Score: {trust_score}/10
- Sale Outcome: {sale_outcome}
- Missteps: {len(missteps)}

Provide a JSON response with:
1. overallScore (0-100)
2. strengths (array of 2-3 items)
3. areasToImprove (array of 2-3 items)
4. coachingTips (array of 3 actionable tips)
5. stageAnalysis (object with score for each PULSE stage)

Respond ONLY with valid JSON."""

            url = f"{self.base_url}/v1/chat/completions"
            payload = {
                "model": self.model,
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 1000,
                "temperature": 0.5
            }
            
            response = await self.client.post(url, json=payload)
            response.raise_for_status()
            
            data = response.json()
            text = data["choices"][0]["message"]["content"]
            
            try:
                start = text.find('{')
                end = text.rfind('}') + 1
                if start >= 0 and end > start:
                    return json.loads(text[start:end])
            except:
                pass
            
            return self._default_feedback()
            
        except Exception as e:
            logger.error(f"Docker AI feedback error: {e}")
            return self._default_feedback()
    
    def _default_feedback(self) -> Dict[str, Any]:
        return {
            "overallScore": 70,
            "strengths": ["Engaged with customer", "Maintained conversation flow"],
            "areasToImprove": ["Work on closing techniques", "Better objection handling"],
            "coachingTips": [
                "Practice the PULSE methodology stages",
                "Focus on understanding customer needs",
                "Use open-ended questions"
            ],
            "stageAnalysis": {
                "Probe": 75, "Understand": 70, "Link": 65, "Solve": 60, "Earn": 55
            }
        }
    
    async def detect_inappropriate_remarks(self, message: str) -> Dict[str, Any]:
        """Detect inappropriate remarks using Docker AI (Ollama)."""
        try:
            prompt = f"{INAPPROPRIATE_REMARKS_PROMPT}\n\nMessage to analyze:\n\"{message}\""
            
            url = f"{self.base_url}/v1/chat/completions"
            payload = {
                "model": self.model,
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 300,
                "temperature": 0.1
            }
            
            response = await self.client.post(url, json=payload)
            response.raise_for_status()
            
            data = response.json()
            return self._parse_inappropriate_response(data["choices"][0]["message"]["content"])
            
        except Exception as e:
            logger.error(f"Docker AI inappropriate remarks detection error: {e}")
            return self._parse_inappropriate_response("")


# =============================================================================
# Provider Factory
# =============================================================================

_ai_provider: Optional[AIProvider] = None
_tts_provider: Optional[TTSProvider] = None


def get_ai_provider() -> AIProvider:
    """Get the configured AI provider.
    
    Supported providers:
    - openai: OpenAI GPT models (requires OPENAI_API_KEY)
    - anthropic: Anthropic Claude models (requires ANTHROPIC_API_KEY)
    - google: Google Gemini models (requires GOOGLE_API_KEY)
    - docker: Ollama via Docker (requires DOCKER_BASE_URL)
    - mlx: MLX Omni Server for Apple Silicon (requires MLX_BASE_URL)
    """
    global _ai_provider
    
    if _ai_provider is None:
        provider = os.getenv("AI_PROVIDER", "openai").lower()
        
        if provider == "openai":
            _ai_provider = OpenAIProvider()
        elif provider == "anthropic":
            _ai_provider = AnthropicProvider()
        elif provider == "google":
            _ai_provider = GoogleProvider()
        elif provider == "docker":
            _ai_provider = DockerAIProvider()
        elif provider == "mlx":
            _ai_provider = MLXProvider()
        else:
            logger.warning(f"Unknown AI provider: {provider}, defaulting to OpenAI")
            _ai_provider = OpenAIProvider()
    
    return _ai_provider


def get_tts_provider() -> TTSProvider:
    """Get the configured TTS provider."""
    global _tts_provider
    
    if _tts_provider is None:
        provider = os.getenv("TTS_PROVIDER", "local").lower()
        
        if provider == "openai":
            _tts_provider = OpenAITTSProvider()
        elif provider == "elevenlabs":
            _tts_provider = ElevenLabsTTSProvider()
        elif provider == "google":
            _tts_provider = GoogleTTSProvider()
        elif provider == "edge":
            _tts_provider = EdgeTTSProvider()
        elif provider == "local":
            _tts_provider = LocalTTSProvider()
        else:
            logger.warning(f"Unknown TTS provider: {provider}, defaulting to Local TTS")
            _tts_provider = LocalTTSProvider()
    
    return _tts_provider
