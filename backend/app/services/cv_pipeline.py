import os
import cv2
import torch
from ultralytics import YOLO
from sqlalchemy.orm import Session
from app.models import models

# Set device to MPS (Metal Performance Shaders) for MacBook Air M4 hardware acceleration
DEVICE = "mps" if torch.backends.mps.is_available() else "cpu"
print(f"Using CV hardware acceleration device: {DEVICE.upper()}")

# Load YOLOv11 nano model
_model = None

def get_yolo_model():
    global _model
    if _model is None:
        # yolo11n.pt is the official YOLOv11 nano model, lightweight and fast
        _model = YOLO("yolo11n.pt")
    return _model

def run_cv_pipeline(match_id: int, db: Session):
    match_record = db.query(models.Match).filter(models.Match.id == match_id).first()
    if not match_record:
        print(f"Match {match_id} not found.")
        return

    match_record.status = "processing"
    db.commit()

    frames_dir = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 
        "temp_frames", 
        str(match_id)
    )

    if not os.path.exists(frames_dir):
        match_record.status = "failed"
        db.commit()
        print(f"Frames directory not found: {frames_dir}")
        return

    model = get_yolo_model()
    frame_files = sorted([f for f in os.listdir(frames_dir) if f.endswith(".jpg")])

    if not frame_files:
        match_record.status = "failed"
        db.commit()
        print("No sampled frames found to process.")
        return

    # Process each frame
    processed_count = 0
    for frame_file in frame_files:
        # Extract frame index from name: frame_000000.jpg -> 0
        try:
            frame_idx = int(frame_file.split("_")[1].split(".")[0])
        except Exception:
            frame_idx = processed_count

        frame_path = os.path.join(frames_dir, frame_file)
        
        # Calculate timestamp of the frame in seconds
        timestamp = frame_idx / (match_record.fps or 30.0)

        # Run YOLO with ByteTrack persistence
        # Class 0: person, Class 32: sports ball
        results = model.track(
            source=frame_path,
            persist=True,
            classes=[0, 32],  # detect only people and balls
            tracker="bytetrack.yaml",
            device=DEVICE,
            verbose=False
        )

        if not results or len(results) == 0:
            continue

        result = results[0]
        boxes = result.boxes

        if boxes is not None:
            for box in boxes:
                # Get coordinates, class, confidence, and tracker ID
                coords = box.xyxy[0].tolist()  # [x1, y1, x2, y2]
                cls_id = int(box.cls[0].item())
                conf = float(box.conf[0].item())
                
                # ByteTrack ID (defaults to None if not tracked)
                track_id = int(box.id[0].item()) if box.id is not None else None

                class_name = "player" if cls_id == 0 else "ball"

                # Calculate center X, Y
                cx = (coords[0] + coords[2]) / 2
                cy = (coords[1] + coords[3]) / 2

                # Save tracking data record
                tracking_record = models.TrackingData(
                    match_id=match_id,
                    frame_id=frame_idx,
                    timestamp=timestamp,
                    object_id=track_id if track_id is not None else -1,
                    class_name=class_name,
                    x=cx,
                    y=cy
                )
                db.add(tracking_record)

        processed_count += 1
        # Commit progress in chunks to keep db responsive
        if processed_count % 10 == 0:
            db.commit()

    db.commit()
    match_record.status = "completed"
    db.commit()
    
    print(f"CV pipeline completed for match {match_id}. Processed {processed_count} frames.")
    return processed_count
