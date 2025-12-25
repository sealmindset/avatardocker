"""
Database Layer for PULSE

Uses asyncpg for async PostgreSQL operations.
"""

import json
import logging
import os
from datetime import datetime
from typing import Any, Dict, List, Optional

import asyncpg

logger = logging.getLogger(__name__)


class Database:
    """Async PostgreSQL database handler."""
    
    def __init__(self):
        self.pool: Optional[asyncpg.Pool] = None
        self.database_url = os.getenv(
            "DATABASE_URL", 
            "postgresql://pulse_admin:pulse_dev_password@localhost:5432/pulse_analytics"
        )
    
    async def connect(self):
        """Connect to the database."""
        try:
            self.pool = await asyncpg.create_pool(
                self.database_url,
                min_size=2,
                max_size=10
            )
            logger.info("Database connected successfully")
        except Exception as e:
            logger.error(f"Database connection error: {e}")
            raise
    
    async def disconnect(self):
        """Disconnect from the database."""
        if self.pool:
            await self.pool.close()
            logger.info("Database disconnected")
    
    # =========================================================================
    # Session Operations
    # =========================================================================
    
    async def create_session(
        self,
        session_id: str,
        user_id: str,
        persona_id: str,
        scenario: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Create a new training session."""
        query = """
            INSERT INTO sessions (id, user_id, persona_id, scenario)
            VALUES ($1::uuid, $2, $3, $4)
            RETURNING id, api_id, user_id, persona_id, current_stage, trust_score, created_at
        """
        
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                query,
                session_id,
                user_id,
                persona_id,
                json.dumps(scenario or {})
            )
            
            return dict(row) if row else None
    
    async def update_session(
        self,
        session_id: str,
        current_stage: int = None,
        trust_score: int = None,
        sale_outcome: str = None,
        overall_score: float = None,
        end_time: datetime = None
    ) -> bool:
        """Update session fields."""
        updates = []
        values = [session_id]
        param_idx = 2
        
        if current_stage is not None:
            updates.append(f"current_stage = ${param_idx}")
            values.append(current_stage)
            param_idx += 1
        
        if trust_score is not None:
            updates.append(f"trust_score = ${param_idx}")
            values.append(trust_score)
            param_idx += 1
        
        if sale_outcome is not None:
            updates.append(f"sale_outcome = ${param_idx}")
            values.append(sale_outcome)
            param_idx += 1
        
        if overall_score is not None:
            updates.append(f"overall_score = ${param_idx}")
            values.append(overall_score)
            param_idx += 1
        
        if end_time is not None:
            updates.append(f"end_time = ${param_idx}")
            values.append(end_time)
            param_idx += 1
        
        if not updates:
            return True
        
        query = f"""
            UPDATE sessions 
            SET {', '.join(updates)}, updated_at = NOW()
            WHERE id = $1::uuid
        """
        
        async with self.pool.acquire() as conn:
            await conn.execute(query, *values)
            return True
    
    async def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get session by ID."""
        query = """
            SELECT * FROM sessions WHERE id = $1::uuid
        """
        
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(query, session_id)
            return dict(row) if row else None
    
    async def get_sessions(
        self, 
        limit: int = 50, 
        offset: int = 0,
        user_id: str = None
    ) -> List[Dict[str, Any]]:
        """Get recent sessions."""
        if user_id:
            query = """
                SELECT * FROM sessions 
                WHERE user_id = $1
                ORDER BY created_at DESC 
                LIMIT $2 OFFSET $3
            """
            params = [user_id, limit, offset]
        else:
            query = """
                SELECT * FROM sessions 
                ORDER BY created_at DESC 
                LIMIT $1 OFFSET $2
            """
            params = [limit, offset]
        
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(query, *params)
            return [dict(row) for row in rows]
    
    # =========================================================================
    # Conversation Operations
    # =========================================================================
    
    async def add_conversation_turn(
        self,
        session_id: str,
        role: str,
        content: str,
        emotion: str = None,
        stage: int = None
    ) -> Dict[str, Any]:
        """Add a conversation turn."""
        query = """
            INSERT INTO conversation_history (session_id, role, content, emotion, stage)
            VALUES ($1::uuid, $2, $3, $4, $5)
            RETURNING id, api_id, role, content, timestamp
        """
        
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                query,
                session_id,
                role,
                content,
                emotion,
                stage
            )
            return dict(row) if row else None
    
    async def get_conversation_history(
        self, 
        session_id: str
    ) -> List[Dict[str, Any]]:
        """Get conversation history for a session."""
        query = """
            SELECT role, content, emotion, stage, timestamp
            FROM conversation_history
            WHERE session_id = $1::uuid
            ORDER BY timestamp ASC
        """
        
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(query, session_id)
            return [dict(row) for row in rows]
    
    # =========================================================================
    # Misstep Operations
    # =========================================================================
    
    async def add_misstep(
        self,
        session_id: str,
        misstep: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Add a misstep record."""
        query = """
            INSERT INTO missteps (session_id, misstep_id, trust_penalty, response_hint)
            VALUES ($1::uuid, $2, $3, $4)
            RETURNING id, api_id, misstep_id, detected_at
        """
        
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                query,
                session_id,
                misstep.get("id", "unknown"),
                misstep.get("trust_penalty", 0),
                misstep.get("response_hint", "")
            )
            return dict(row) if row else None
    
    async def get_missteps(self, session_id: str) -> List[Dict[str, Any]]:
        """Get missteps for a session."""
        query = """
            SELECT misstep_id, trust_penalty, response_hint, detected_at
            FROM missteps
            WHERE session_id = $1::uuid
            ORDER BY detected_at ASC
        """
        
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(query, session_id)
            return [dict(row) for row in rows]
    
    # =========================================================================
    # Scorecard Operations
    # =========================================================================
    
    async def create_scorecard(
        self,
        session_id: str,
        scorecard: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Create a scorecard for a completed session."""
        query = """
            INSERT INTO scorecards (
                session_id, overall_score, stage_scores,
                rubric_compliance, ai_feedback, transcript, end_reason
            )
            VALUES ($1::uuid, $2, $3, $4, $5, $6, $7)
            RETURNING id, api_id, completed_at
        """

        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                query,
                session_id,
                scorecard.get("overallScore", 0),
                json.dumps(scorecard.get("stageScores", {})),
                json.dumps(scorecard.get("rubricCompliance", {})),
                json.dumps(scorecard.get("aiFeedback", {})),
                json.dumps(scorecard.get("transcript", [])),
                scorecard.get("endReason", "completed")
            )
            return dict(row) if row else None
    
    async def get_scorecard(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get scorecard for a session."""
        query = """
            SELECT s.*, sc.overall_score, sc.stage_scores,
                   sc.rubric_compliance, sc.ai_feedback, sc.transcript,
                   sc.end_reason, sc.completed_at
            FROM sessions s
            LEFT JOIN scorecards sc ON s.id = sc.session_id
            WHERE s.id = $1::uuid
        """

        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(query, session_id)

            if not row:
                return None

            result = dict(row)

            # Parse JSON fields
            if result.get("stage_scores"):
                result["stageScores"] = json.loads(result["stage_scores"])
            if result.get("rubric_compliance"):
                result["rubricCompliance"] = json.loads(result["rubric_compliance"])
            if result.get("ai_feedback"):
                result["aiFeedback"] = json.loads(result["ai_feedback"])
            if result.get("transcript"):
                result["transcript"] = json.loads(result["transcript"])
            if result.get("end_reason"):
                result["endReason"] = result["end_reason"]

            return result
    
    # =========================================================================
    # Prompt Operations
    # =========================================================================
    
    async def get_prompts(self) -> List[Dict[str, Any]]:
        """Get all active prompts."""
        query = """
            SELECT id, api_id, prompt_key, title, content, category, 
                   version, created_at, updated_at
            FROM prompts
            WHERE is_active = true
            ORDER BY category, title
        """
        
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(query)
            return [dict(row) for row in rows]
    
    async def get_prompt(self, prompt_key: str) -> Optional[Dict[str, Any]]:
        """Get a specific prompt by key or ID."""
        # Try by prompt_key first
        query = """
            SELECT * FROM prompts WHERE prompt_key = $1 AND is_active = true
        """
        
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(query, prompt_key)
            if row:
                return dict(row)
            
            # Try by ID (UUID)
            try:
                query_by_id = """
                    SELECT * FROM prompts WHERE id = $1::uuid AND is_active = true
                """
                row = await conn.fetchrow(query_by_id, prompt_key)
                return dict(row) if row else None
            except:
                return None
    
    async def upsert_prompt(self, prompt: Dict[str, Any]) -> Dict[str, Any]:
        """Create or update a prompt."""
        query = """
            INSERT INTO prompts (prompt_key, title, content, category)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (prompt_key) DO UPDATE SET
                title = EXCLUDED.title,
                content = EXCLUDED.content,
                category = EXCLUDED.category,
                version = prompts.version + 1,
                updated_at = NOW()
            RETURNING id, api_id, prompt_key, title, version, updated_at
        """
        
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                query,
                prompt.get("key", prompt.get("prompt_key")),
                prompt.get("title"),
                prompt.get("content"),
                prompt.get("category", "general")
            )
            
            # Also save version history
            if row:
                await conn.execute(
                    """
                    INSERT INTO prompt_versions (prompt_id, content, version)
                    VALUES ($1, $2, $3)
                    """,
                    row["id"],
                    prompt.get("content"),
                    row["version"]
                )
            
            return dict(row) if row else None
    
    # =========================================================================
    # User Operations
    # =========================================================================
    
    async def get_user(self, username: str) -> Optional[Dict[str, Any]]:
        """Get user by username."""
        query = """
            SELECT * FROM users WHERE username = $1
        """
        
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(query, username)
            return dict(row) if row else None
    
    async def update_user_login(self, username: str) -> bool:
        """Update user's last login time."""
        query = """
            UPDATE users SET last_login = NOW() WHERE username = $1
        """
        
        async with self.pool.acquire() as conn:
            await conn.execute(query, username)
            return True
    
    # =========================================================================
    # Persona Operations (Avatar/Voice Configuration)
    # =========================================================================
    
    async def get_personas(self, active_only: bool = True) -> List[Dict[str, Any]]:
        """Get all personas with their avatar/voice configurations."""
        if active_only:
            query = """
                SELECT id, api_id, persona_key, name, difficulty, description, greeting,
                       avatar_id, avatar_gender, avatar_style, avatar_randomize,
                       voice_id, voice_style, voice_openai, voice_google, voice_elevenlabs,
                       color, icon, is_active, created_at, updated_at
                FROM personas
                WHERE is_active = true
                ORDER BY name
            """
        else:
            query = """
                SELECT id, api_id, persona_key, name, difficulty, description, greeting,
                       avatar_id, avatar_gender, avatar_style, avatar_randomize,
                       voice_id, voice_style, voice_openai, voice_google, voice_elevenlabs,
                       color, icon, is_active, created_at, updated_at
                FROM personas
                ORDER BY name
            """
        
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(query)
            return [dict(row) for row in rows]
    
    async def get_persona_by_key(self, persona_key: str) -> Optional[Dict[str, Any]]:
        """Get a persona by its key (e.g., 'director', 'relater')."""
        query = """
            SELECT id, api_id, persona_key, name, difficulty, description, greeting,
                   avatar_id, avatar_gender, avatar_style, avatar_randomize,
                   voice_id, voice_style, voice_openai, voice_google, voice_elevenlabs,
                   color, icon, is_active, created_at, updated_at
            FROM personas
            WHERE persona_key = $1
        """
        
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(query, persona_key)
            return dict(row) if row else None
    
    async def get_persona_by_id(self, persona_id: str) -> Optional[Dict[str, Any]]:
        """Get a persona by its UUID."""
        query = """
            SELECT id, api_id, persona_key, name, difficulty, description, greeting,
                   avatar_id, avatar_gender, avatar_style, avatar_randomize,
                   voice_id, voice_style, voice_openai, voice_google, voice_elevenlabs,
                   color, icon, is_active, created_at, updated_at
            FROM personas
            WHERE id = $1::uuid
        """
        
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(query, persona_id)
            return dict(row) if row else None
    
    async def update_persona_avatar(
        self,
        persona_key: str,
        avatar_id: Optional[str] = None,
        avatar_gender: Optional[str] = None,
        avatar_style: Optional[str] = None,
        avatar_randomize: Optional[bool] = None
    ) -> Optional[Dict[str, Any]]:
        """Update persona's avatar configuration."""
        updates = []
        values = [persona_key]
        param_idx = 2
        
        if avatar_id is not None:
            updates.append(f"avatar_id = ${param_idx}")
            values.append(avatar_id)
            param_idx += 1
        
        if avatar_gender is not None:
            updates.append(f"avatar_gender = ${param_idx}")
            values.append(avatar_gender)
            param_idx += 1
        
        if avatar_style is not None:
            updates.append(f"avatar_style = ${param_idx}")
            values.append(avatar_style)
            param_idx += 1
        
        if avatar_randomize is not None:
            updates.append(f"avatar_randomize = ${param_idx}")
            values.append(avatar_randomize)
            param_idx += 1
        
        if not updates:
            return await self.get_persona_by_key(persona_key)
        
        query = f"""
            UPDATE personas 
            SET {', '.join(updates)}, updated_at = NOW()
            WHERE persona_key = $1
            RETURNING id, api_id, persona_key, name, avatar_id, avatar_gender, 
                      avatar_style, avatar_randomize, updated_at
        """
        
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(query, *values)
            return dict(row) if row else None
    
    async def update_persona_voice(
        self,
        persona_key: str,
        voice_id: Optional[str] = None,
        voice_style: Optional[str] = None,
        voice_openai: Optional[str] = None,
        voice_google: Optional[str] = None,
        voice_elevenlabs: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Update persona's voice configuration."""
        updates = []
        values = [persona_key]
        param_idx = 2
        
        if voice_id is not None:
            updates.append(f"voice_id = ${param_idx}")
            values.append(voice_id)
            param_idx += 1
        
        if voice_style is not None:
            updates.append(f"voice_style = ${param_idx}")
            values.append(voice_style)
            param_idx += 1
        
        if voice_openai is not None:
            updates.append(f"voice_openai = ${param_idx}")
            values.append(voice_openai)
            param_idx += 1
        
        if voice_google is not None:
            updates.append(f"voice_google = ${param_idx}")
            values.append(voice_google)
            param_idx += 1
        
        if voice_elevenlabs is not None:
            updates.append(f"voice_elevenlabs = ${param_idx}")
            values.append(voice_elevenlabs)
            param_idx += 1
        
        if not updates:
            return await self.get_persona_by_key(persona_key)
        
        query = f"""
            UPDATE personas 
            SET {', '.join(updates)}, updated_at = NOW()
            WHERE persona_key = $1
            RETURNING id, api_id, persona_key, name, voice_id, voice_style,
                      voice_openai, voice_google, voice_elevenlabs, updated_at
        """
        
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(query, *values)
            return dict(row) if row else None
    
    async def update_persona(
        self,
        persona_key: str,
        updates: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Update persona with arbitrary fields."""
        allowed_fields = {
            'name', 'difficulty', 'description', 'greeting',
            'avatar_id', 'avatar_gender', 'avatar_style', 'avatar_randomize',
            'voice_id', 'voice_style', 'voice_openai', 'voice_google', 'voice_elevenlabs',
            'color', 'icon', 'is_active', 'system_prompt', 'system_prompt_summary'
        }
        
        set_clauses = []
        values = [persona_key]
        param_idx = 2
        
        for field, value in updates.items():
            if field in allowed_fields:
                set_clauses.append(f"{field} = ${param_idx}")
                values.append(value)
                param_idx += 1
        
        if not set_clauses:
            return await self.get_persona_by_key(persona_key)
        
        query = f"""
            UPDATE personas 
            SET {', '.join(set_clauses)}, updated_at = NOW()
            WHERE persona_key = $1
            RETURNING *
        """
        
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(query, *values)
            return dict(row) if row else None
    
    async def create_session_with_avatar(
        self,
        session_id: str,
        user_id: str,
        persona_id: str,
        avatar_id: Optional[str] = None,
        voice_id: Optional[str] = None,
        scenario: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Create a new training session with avatar and voice tracking."""
        query = """
            INSERT INTO sessions (id, user_id, persona_id, avatar_id, voice_id, scenario)
            VALUES ($1::uuid, $2, $3, $4, $5, $6)
            RETURNING id, api_id, user_id, persona_id, avatar_id, voice_id,
                      current_stage, trust_score, created_at
        """
        
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                query,
                session_id,
                user_id,
                persona_id,
                avatar_id,
                voice_id,
                json.dumps(scenario or {})
            )
            
            return dict(row) if row else None
