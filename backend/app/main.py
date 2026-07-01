import os
import shutil
from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List

from app.database import engine, Base, get_db
from app.models import models
from app.schemas import schemas
from app.services.video_service import parse_and_sample_video

# Create tables in the database (SQLite for local, Postgres for prod)
Base.metadata.create_all(bind=engine)

app = FastAPI(title="VisionPlay AI API", description="AI-Powered Sports Intelligence Platform Backend")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Base directory setup
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.get("/")
def read_root():
    return {"message": "Welcome to the VisionPlay AI API. Run /docs for interactive API documentation."}

@app.post("/upload-video", response_model=schemas.MatchResponse)
def upload_video(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    # Validate extension
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in [".mp4", ".mov", ".avi", ".mkv"]:
        raise HTTPException(status_code=400, detail="Invalid video format. Supported types: .mp4, .mov, .avi, .mkv")

    # Generate unique filename to prevent collision
    import uuid
    unique_filename = f"{uuid.uuid4()}{ext}"
    filepath = os.path.join(UPLOAD_DIR, unique_filename)

    # Save file locally
    try:
        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save video: {str(e)}")

    # Add match to DB
    match_record = models.Match(
        filename=file.filename,
        filepath=filepath,
        status="uploaded"
    )
    db.add(match_record)
    db.commit()
    db.refresh(match_record)

    # Queue background task to process metadata and sample frames
    background_tasks.add_task(parse_and_sample_video, match_record.id, db)

    return match_record

@app.get("/matches", response_model=List[schemas.MatchResponse])
def get_matches(db: Session = Depends(get_db)):
    return db.query(models.Match).order_ok(models.Match.created_at.desc()).all() if hasattr(db.query(models.Match), 'order_ok') else db.query(models.Match).order_by(models.Match.created_at.desc()).all()

@app.get("/match/{match_id}", response_model=schemas.MatchResponse)
def get_match(match_id: int, db: Session = Depends(get_db)):
    match_record = db.query(models.Match).filter(models.Match.id == match_id).first()
    if not match_record:
        raise HTTPException(status_code=404, detail="Match not found")
    return match_record
