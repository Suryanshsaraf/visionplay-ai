from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
import datetime
from app.database import Base

class Match(Base):
    __tablename__ = "matches"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    filepath = Column(String, nullable=False)
    status = Column(String, default="uploaded")  # uploaded, processing, completed, failed
    duration = Column(Float, nullable=True)  # in seconds
    fps = Column(Float, nullable=True)
    frame_count = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    tracking_data = relationship("TrackingData", back_populates="match", cascade="all, delete-orphan")
    events = relationship("MatchEvent", back_populates="match", cascade="all, delete-orphan")
    stats = relationship("MatchStats", back_populates="match", uselist=False, cascade="all, delete-orphan")
    chat_sessions = relationship("ChatSession", back_populates="match", cascade="all, delete-orphan")

class TrackingData(Base):
    __tablename__ = "tracking_data"

    id = Column(Integer, primary_key=True, index=True)
    match_id = Column(Integer, ForeignKey("matches.id"), nullable=False)
    frame_id = Column(Integer, index=True)
    timestamp = Column(Float)  # timestamp in seconds
    object_id = Column(Integer, index=True)  # unique tracker ID for players/ball/ref
    class_name = Column(String)  # player, ball, referee
    team_id = Column(Integer, nullable=True)  # 0 = Team A, 1 = Team B, None = ball/referee
    x = Column(Float)  # raw or homography X coordinate
    y = Column(Float)  # raw or homography Y coordinate

    match = relationship("Match", back_populates="tracking_data")

class MatchEvent(Base):
    __tablename__ = "match_events"

    id = Column(Integer, primary_key=True, index=True)
    match_id = Column(Integer, ForeignKey("matches.id"), nullable=False)
    timestamp = Column(Float, nullable=False)  # seconds into match
    event_type = Column(String, nullable=False)  # pass, shot, goal, foul, card, corner, throw-in
    description = Column(String, nullable=False)
    player_id = Column(Integer, nullable=True)
    team_id = Column(Integer, nullable=True)

    match = relationship("Match", back_populates="events")

class MatchStats(Base):
    __tablename__ = "match_stats"

    id = Column(Integer, primary_key=True, index=True)
    match_id = Column(Integer, ForeignKey("matches.id"), nullable=False)
    possession_team_1 = Column(Float, default=0.0)  # percentage
    possession_team_2 = Column(Float, default=0.0)
    total_passes_team_1 = Column(Integer, default=0)
    total_passes_team_2 = Column(Integer, default=0)
    total_shots_team_1 = Column(Integer, default=0)
    total_shots_team_2 = Column(Integer, default=0)
    distance_team_1 = Column(Float, default=0.0)  # km
    distance_team_2 = Column(Float, default=0.0)

    match = relationship("Match", back_populates="stats")

class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(Integer, primary_key=True, index=True)
    match_id = Column(Integer, ForeignKey("matches.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    match = relationship("Match", back_populates="chat_sessions")
    messages = relationship("Message", back_populates="session", cascade="all, delete-orphan")

class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("chat_sessions.id"), nullable=False)
    role = Column(String, nullable=False)  # user, assistant
    content = Column(String, nullable=False)
    citations = Column(JSON, nullable=True)  # List of float timestamps
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    session = relationship("ChatSession", back_populates="messages")
