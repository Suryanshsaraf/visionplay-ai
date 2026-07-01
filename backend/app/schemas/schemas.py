from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

# Match Schemas
class MatchBase(BaseModel):
    filename: str
    filepath: str
    status: str

class MatchCreate(MatchBase):
    pass

class MatchResponse(MatchBase):
    id: int
    duration: Optional[float] = None
    fps: Optional[float] = None
    frame_count: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True

# Match Event Schemas
class MatchEventBase(BaseModel):
    timestamp: float
    event_type: str
    description: str
    player_id: Optional[int] = None
    team_id: Optional[int] = None

class MatchEventResponse(MatchEventBase):
    id: int
    match_id: int

    class Config:
        from_attributes = True

# Match Statistics Schemas
class MatchStatsResponse(BaseModel):
    id: int
    match_id: int
    possession_team_1: float
    possession_team_2: float
    total_passes_team_1: int
    total_passes_team_2: int
    total_shots_team_1: int
    total_shots_team_2: int
    distance_team_1: float
    distance_team_2: float

    class Config:
        from_attributes = True

# Chat Schemas
class MessageBase(BaseModel):
    role: str
    content: str
    citations: Optional[List[float]] = None

class MessageCreate(MessageBase):
    pass

class MessageResponse(MessageBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class ChatSessionResponse(BaseModel):
    id: int
    match_id: int
    created_at: datetime
    messages: List[MessageResponse] = []

    class Config:
        from_attributes = True

class ChatRequest(BaseModel):
    query: str
