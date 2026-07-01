import os
import cv2
from sqlalchemy.orm import Session
from app.models import models

TEMP_FRAMES_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "temp_frames")

def parse_and_sample_video(match_id: int, db: Session, target_fps: float = 2.0):
    match_record = db.query(models.Match).filter(models.Match.id == match_id).first()
    if not match_record:
        print(f"Match {match_id} not found in database.")
        return

    # Update status to processing
    match_record.status = "processing"
    db.commit()

    video_path = match_record.filepath
    if not os.path.exists(video_path):
        match_record.status = "failed"
        db.commit()
        print(f"Video file not found at: {video_path}")
        return

    # Open video
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        match_record.status = "failed"
        db.commit()
        print(f"Failed to open video: {video_path}")
        return

    # Read properties
    original_fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    
    if original_fps <= 0 or total_frames <= 0:
        match_record.status = "failed"
        db.commit()
        cap.release()
        return

    duration = total_frames / original_fps

    # Update match metadata
    match_record.fps = original_fps
    match_record.frame_count = total_frames
    match_record.duration = duration
    db.commit()

    # Setup frames output folder
    match_frames_dir = os.path.join(TEMP_FRAMES_DIR, str(match_id))
    os.makedirs(match_frames_dir, exist_ok=True)

    # Frame sampling calculation
    # e.g., if original_fps = 30 and target_fps = 2, we take every 15th frame (30 / 2)
    step = max(1, int(round(original_fps / target_fps)))

    frame_idx = 0
    sampled_count = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        # Check if this frame should be sampled
        if frame_idx % step == 0:
            timestamp = frame_idx / original_fps
            frame_filename = f"frame_{frame_idx:06d}.jpg"
            frame_filepath = os.path.join(match_frames_dir, frame_filename)
            
            # Save frame image locally
            cv2.imwrite(frame_filepath, frame)
            sampled_count += 1

        frame_idx += 1

    cap.release()

    # Update status to completed for Chunk 2 validation
    match_record.status = "completed"
    db.commit()

    print(f"Successfully processed match {match_id}. Sampled {sampled_count} frames at {target_fps} FPS.")
    return {
        "sampled_count": sampled_count,
        "duration": duration,
        "original_fps": original_fps,
        "total_frames": total_frames
    }
