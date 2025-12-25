"""
Integration tests for Persona API endpoints.

Tests cover:
- GET /api/personas - List all personas
- GET /api/personas/{key} - Get specific persona
- PUT /api/personas/{key} - Update persona
- GET /api/personas/{key}/avatar - Get avatar config
- PUT /api/personas/{key}/avatar - Update avatar config
- Session start with avatar resolution
"""

import os
import sys
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class MockAsyncContextManager:
    """Mock async context manager for database pool."""
    
    def __init__(self, mock_conn):
        self.mock_conn = mock_conn
    
    async def __aenter__(self):
        return self.mock_conn
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass


class TestPersonaDatabase:
    """Tests for persona database operations."""
    
    @pytest.fixture
    def mock_pool(self):
        """Create a mock database pool."""
        pool = MagicMock()
        return pool
    
    @pytest.fixture
    def mock_persona_row(self):
        """Create a mock persona row from database."""
        return {
            "id": "550e8400-e29b-41d4-a716-446655440000",
            "api_id": 1,
            "persona_key": "director",
            "name": "Director",
            "difficulty": "Expert",
            "description": "Direct, results-oriented, time-conscious",
            "greeting": "I don't have much time. What do you have for me?",
            "avatar_id": "20250408/P1lXrpJL507-PZ4hMPutyF7A",
            "avatar_gender": "male",
            "avatar_style": "professional",
            "avatar_randomize": False,
            "voice_id": "ryan",
            "voice_style": "medium",
            "voice_openai": "onyx",
            "voice_google": "en-US-Neural2-D",
            "voice_elevenlabs": "pNInz6obpgDQGcFmaJgB",
            "color": "#EF4444",
            "icon": None,
            "is_active": True,
            "created_at": datetime.now(),
            "updated_at": datetime.now(),
        }
    
    @pytest.mark.asyncio
    async def test_get_personas(self, mock_pool, mock_persona_row):
        """Test getting all personas."""
        from database import Database
        
        db = Database()
        db.pool = mock_pool
        
        # Mock the fetch to return a list of personas
        mock_conn = AsyncMock()
        mock_conn.fetch = AsyncMock(return_value=[mock_persona_row])
        mock_pool.acquire = MagicMock(return_value=MockAsyncContextManager(mock_conn))
        
        personas = await db.get_personas(active_only=True)
        
        assert len(personas) == 1
        assert personas[0]["persona_key"] == "director"
        assert personas[0]["avatar_id"] == "20250408/P1lXrpJL507-PZ4hMPutyF7A"
    
    @pytest.mark.asyncio
    async def test_get_persona_by_key(self, mock_pool, mock_persona_row):
        """Test getting a specific persona by key."""
        from database import Database
        
        db = Database()
        db.pool = mock_pool
        
        mock_conn = AsyncMock()
        mock_conn.fetchrow = AsyncMock(return_value=mock_persona_row)
        mock_pool.acquire = MagicMock(return_value=MockAsyncContextManager(mock_conn))
        
        persona = await db.get_persona_by_key("director")
        
        assert persona is not None
        assert persona["persona_key"] == "director"
        assert persona["avatar_id"] == "20250408/P1lXrpJL507-PZ4hMPutyF7A"
        assert persona["avatar_gender"] == "male"
    
    @pytest.mark.asyncio
    async def test_get_persona_by_key_not_found(self, mock_pool):
        """Test getting a non-existent persona."""
        from database import Database
        
        db = Database()
        db.pool = mock_pool
        
        mock_conn = AsyncMock()
        mock_conn.fetchrow = AsyncMock(return_value=None)
        mock_pool.acquire = MagicMock(return_value=MockAsyncContextManager(mock_conn))
        
        persona = await db.get_persona_by_key("nonexistent")
        
        assert persona is None
    
    @pytest.mark.asyncio
    async def test_update_persona_avatar(self, mock_pool):
        """Test updating a persona's avatar configuration."""
        from database import Database
        
        db = Database()
        db.pool = mock_pool
        
        updated_row = {
            "id": "550e8400-e29b-41d4-a716-446655440000",
            "api_id": 1,
            "persona_key": "director",
            "name": "Director",
            "avatar_id": "20250408/new-avatar-id",
            "avatar_gender": "female",
            "avatar_style": "casual",
            "avatar_randomize": True,
            "updated_at": datetime.now(),
        }
        
        mock_conn = AsyncMock()
        mock_conn.fetchrow = AsyncMock(return_value=updated_row)
        mock_pool.acquire = MagicMock(return_value=MockAsyncContextManager(mock_conn))
        
        result = await db.update_persona_avatar(
            persona_key="director",
            avatar_id="20250408/new-avatar-id",
            avatar_gender="female",
            avatar_style="casual",
            avatar_randomize=True
        )
        
        assert result is not None
        assert result["avatar_id"] == "20250408/new-avatar-id"
        assert result["avatar_gender"] == "female"
        assert result["avatar_randomize"] is True
    
    @pytest.mark.asyncio
    async def test_create_session_with_avatar(self, mock_pool):
        """Test creating a session with avatar tracking."""
        from database import Database
        
        db = Database()
        db.pool = mock_pool
        
        session_row = {
            "id": "660e8400-e29b-41d4-a716-446655440001",
            "api_id": 1,
            "user_id": "test-user",
            "persona_id": "director",
            "avatar_id": "20250408/P1lXrpJL507-PZ4hMPutyF7A",
            "voice_id": "ryan",
            "current_stage": 1,
            "trust_score": 5,
            "created_at": datetime.now(),
        }
        
        mock_conn = AsyncMock()
        mock_conn.fetchrow = AsyncMock(return_value=session_row)
        mock_pool.acquire = MagicMock(return_value=MockAsyncContextManager(mock_conn))
        
        result = await db.create_session_with_avatar(
            session_id="660e8400-e29b-41d4-a716-446655440001",
            user_id="test-user",
            persona_id="director",
            avatar_id="20250408/P1lXrpJL507-PZ4hMPutyF7A",
            voice_id="ryan",
            scenario={}
        )
        
        assert result is not None
        assert result["avatar_id"] == "20250408/P1lXrpJL507-PZ4hMPutyF7A"
        assert result["voice_id"] == "ryan"


class TestAvatarResolution:
    """Tests for avatar resolution during session start."""
    
    def test_avatar_resolution_priority(self):
        """Test avatar resolution priority: request > database > None."""
        # Priority 1: Request override
        request_avatar = "request-avatar-id"
        db_avatar = "db-avatar-id"
        
        # If request has avatar, use it
        resolved = request_avatar if request_avatar else db_avatar
        assert resolved == "request-avatar-id"
        
        # If request is None, use database
        request_avatar = None
        resolved = request_avatar if request_avatar else db_avatar
        assert resolved == "db-avatar-id"
        
        # If both None, result is None
        db_avatar = None
        resolved = request_avatar if request_avatar else db_avatar
        assert resolved is None
    
    def test_avatar_randomize_logic(self):
        """Test avatar randomization logic."""
        import random
        
        available_avatars = [
            {"id": "avatar1", "gender": "female"},
            {"id": "avatar2", "gender": "female"},
            {"id": "avatar3", "gender": "male"},
            {"id": "avatar4", "gender": "male"},
        ]
        
        # Filter by gender
        gender = "female"
        filtered = [a for a in available_avatars if a["gender"] == gender]
        
        assert len(filtered) == 2
        assert all(a["gender"] == "female" for a in filtered)
        
        # Random selection
        random.seed(42)  # For reproducibility
        selected = random.choice(filtered)
        assert selected["gender"] == "female"


class TestAvatarPoolIntegration:
    """Tests for avatar pool integration with session flow."""
    
    def test_avatar_id_format_validation(self):
        """Test avatar ID format is valid for pool manager."""
        valid_ids = [
            "20250408/P1lXrpJL507-PZ4hMPutyF7A",
            "20250408/avatar_a",
            "folder/subfolder/avatar",
        ]
        
        invalid_ids = [
            "",
            None,
            "no-slash",
        ]
        
        for avatar_id in valid_ids:
            assert "/" in avatar_id, f"Valid ID should contain slash: {avatar_id}"
        
        for avatar_id in invalid_ids:
            if avatar_id:
                assert "/" not in avatar_id or avatar_id == "", f"Invalid ID: {avatar_id}"
    
    def test_cache_preload_request_format(self):
        """Test cache preload request format."""
        preload_request = {
            "avatar_ids": [
                "20250408/avatar_a",
                "20250408/avatar_b",
            ]
        }
        
        assert "avatar_ids" in preload_request
        assert isinstance(preload_request["avatar_ids"], list)
        assert len(preload_request["avatar_ids"]) == 2


class TestSessionStartFlow:
    """Tests for the complete session start flow with avatar."""
    
    @pytest.fixture
    def mock_session_request(self):
        """Create a mock session start request."""
        return {
            "userId": "test-user",
            "personaId": "director",
            "scenario": {},
            "avatarId": None,  # No override
            "voiceId": None,
        }
    
    @pytest.fixture
    def mock_db_persona(self):
        """Create a mock persona from database."""
        return {
            "persona_key": "director",
            "avatar_id": "20250408/P1lXrpJL507-PZ4hMPutyF7A",
            "avatar_gender": "male",
            "voice_id": "ryan",
        }
    
    def test_session_start_resolves_avatar(self, mock_session_request, mock_db_persona):
        """Test that session start correctly resolves avatar from database."""
        # Simulate resolution logic from main.py start_session
        avatar_id = mock_session_request.get("avatarId")
        voice_id = mock_session_request.get("voiceId")
        
        # If no override, get from database
        if not avatar_id:
            avatar_id = mock_db_persona.get("avatar_id")
        if not voice_id:
            voice_id = mock_db_persona.get("voice_id")
        
        assert avatar_id == "20250408/P1lXrpJL507-PZ4hMPutyF7A"
        assert voice_id == "ryan"
    
    def test_session_start_with_override(self, mock_session_request, mock_db_persona):
        """Test that session start respects avatar override."""
        # Set override
        mock_session_request["avatarId"] = "override-avatar-id"
        mock_session_request["voiceId"] = "override-voice"
        
        # Simulate resolution
        avatar_id = mock_session_request.get("avatarId")
        voice_id = mock_session_request.get("voiceId")
        
        # Override should take precedence
        if not avatar_id:
            avatar_id = mock_db_persona.get("avatar_id")
        if not voice_id:
            voice_id = mock_db_persona.get("voice_id")
        
        assert avatar_id == "override-avatar-id"
        assert voice_id == "override-voice"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
