import os
import numpy as np
import cv2
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns
from sqlalchemy.orm import Session
from app.models import models

# standard pitch dimensions in meters
PITCH_LENGTH = 105.0
PITCH_WIDTH = 68.0

# Output folder for generated visual analytics
ANALYTICS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads", "analytics")
os.makedirs(ANALYTICS_DIR, exist_ok=True)

def get_homography_matrix(video_width: float, video_height: float):
    # Map broadcast view perspective to 2D bird's-eye view of a soccer pitch
    # Source points (simulated perspective of pitch corners in broadcast feed)
    src_pts = np.float32([
        [video_width * 0.15, video_height * 0.25],  # Top Left
        [video_width * 0.85, video_height * 0.25],  # Top Right
        [video_width * 0.98, video_height * 0.95],  # Bottom Right
        [video_width * 0.02, video_height * 0.95]   # Bottom Left
    ])
    
    # Destination points (actual 2D pitch dimensions in meters)
    dst_pts = np.float32([
        [0, 0],                        # Top Left
        [PITCH_LENGTH, 0],              # Top Right
        [PITCH_LENGTH, PITCH_WIDTH],     # Bottom Right
        [0, PITCH_WIDTH]                # Bottom Left
    ])
    
    return cv2.getPerspectiveTransform(src_pts, dst_pts)

def transform_coordinates(x: float, y: float, matrix) -> tuple:
    point = np.array([[[x, y]]], dtype=np.float32)
    transformed = cv2.perspectiveTransform(point, matrix)
    tx = float(transformed[0][0][0])
    ty = float(transformed[0][0][1])
    
    # Clip coordinates to pitch boundary to keep metrics realistic
    tx = max(0.0, min(tx, PITCH_LENGTH))
    ty = max(0.0, min(ty, PITCH_WIDTH))
    return tx, ty

def calculate_match_analytics(match_id: int, db: Session):
    match_record = db.query(models.Match).filter(models.Match.id == match_id).first()
    if not match_record:
        print(f"Match {match_id} not found.")
        return

    # Fetch tracking data
    tracking_pts = db.query(models.TrackingData).filter(
        models.TrackingData.match_id == match_id
    ).order_by(models.TrackingData.frame_id, models.TrackingData.timestamp).all()

    if not tracking_pts:
        print(f"No tracking data found for match {match_id}")
        return

    # Use video dimensions or defaults
    video_width = 1920
    video_height = 1080
    
    # Build homography matrix
    H = get_homography_matrix(video_width, video_height)

    # 1. Group coordinates by object_id
    player_tracks = {}
    ball_positions = []
    
    for pt in tracking_pts:
        # Transform coords to meters
        tx, ty = transform_coordinates(pt.x, pt.y, H)
        pt.x = tx
        pt.y = ty
        
        if pt.class_name == "player" and pt.object_id != -1:
            if pt.object_id not in player_tracks:
                player_tracks[pt.object_id] = []
            player_tracks[pt.object_id].append(pt)
        elif pt.class_name == "ball":
            ball_positions.append(pt)

    db.commit() # Save transformed coordinates

    # 2. Calculate Distance, Speed & Team Assignment
    # Group players into teams based on average position (Team A stays mostly on left, Team B on right)
    # Or simple clustering: players with average X < PITCH_LENGTH/2 are Team 1, else Team 2
    player_avg_x = {}
    for obj_id, pts in player_tracks.items():
        xs = [p.x for p in pts]
        player_avg_x[obj_id] = sum(xs) / len(xs)

    # Simple split of teams (normally done via Jersey color clustering in YOLO)
    sorted_players = sorted(player_avg_x.keys(), key=lambda k: player_avg_x[k])
    mid_index = len(sorted_players) // 2
    team_1_ids = set(sorted_players[:mid_index])
    team_2_ids = set(sorted_players[mid_index:])

    # Update database tracking with team assignment
    for pt in tracking_pts:
        if pt.class_name == "player" and pt.object_id != -1:
            pt.team_id = 0 if pt.object_id in team_1_ids else 1
    db.commit()

    # Calculate metrics
    player_stats = {}
    team_distances = {0: 0.0, 1: 0.0}

    for obj_id, pts in player_tracks.items():
        team = 0 if obj_id in team_1_ids else 1
        total_dist = 0.0
        speeds = []
        
        for i in range(1, len(pts)):
            p1 = pts[i-1]
            p2 = pts[i]
            
            # Euclidean distance in meters
            d = np.sqrt((p2.x - p1.x)**2 + (p2.y - p1.y)**2)
            dt = p2.timestamp - p1.timestamp
            
            # Prevent unreal jumps (e.g. from occlusions/re-identification glitches)
            if d < 15.0 and dt > 0:
                total_dist += d
                speed = (d / dt) * 3.6  # convert to km/h
                speeds.append(speed)

        # Record metrics
        max_speed = max(speeds) if speeds else 0.0
        player_stats[obj_id] = {
            "distance": total_dist / 1000.0,  # convert to km
            "max_speed": max_speed,
            "team": team
        }
        team_distances[team] += total_dist / 1000.0

    # 3. Calculate Possession %
    possession_frames = {0: 0, 1: 0}
    possession_threshold = 3.0  # meters

    # Group ball positions by frame_id
    ball_by_frame = {b.frame_id: b for b in ball_positions}

    # Group players by frame_id
    players_by_frame = {}
    for pt in tracking_pts:
        if pt.class_name == "player" and pt.object_id != -1:
            if pt.frame_id not in players_by_frame:
                players_by_frame[pt.frame_id] = []
            players_by_frame[pt.frame_id].append(pt)

    for frame_id, ball in ball_by_frame.items():
        if frame_id not in players_by_frame:
            continue
            
        frame_players = players_by_frame[frame_id]
        
        # Find player closest to the ball
        closest_player = min(
            frame_players, 
            key=lambda p: np.sqrt((p.x - ball.x)**2 + (p.y - ball.y)**2)
        )
        
        dist = np.sqrt((closest_player.x - ball.x)**2 + (closest_player.y - ball.y)**2)
        
        if dist <= possession_threshold:
            team = closest_player.team_id
            if team is not None:
                possession_frames[team] += 1

    total_poss = sum(possession_frames.values())
    poss_1 = (possession_frames[0] / total_poss * 100) if total_poss > 0 else 50.0
    poss_2 = (possession_frames[1] / total_poss * 100) if total_poss > 0 else 50.0

    # Save to MatchStats table
    stats_record = db.query(models.MatchStats).filter(
        models.MatchStats.match_id == match_id
    ).first()
    
    if not stats_record:
        stats_record = models.MatchStats(match_id=match_id)
        db.add(stats_record)
        
    stats_record.possession_team_1 = poss_1
    stats_record.possession_team_2 = poss_2
    stats_record.distance_team_1 = team_distances[0]
    stats_record.distance_team_2 = team_distances[1]
    db.commit()

    # 4. Generate Heatmaps
    generate_match_heatmap(match_id, tracking_pts)

    print(f"Calculated stats for match {match_id}. Team 1 Poss: {poss_1:.1f}%, Team 2 Poss: {poss_2:.1f}%.")
    return player_stats

def generate_match_heatmap(match_id: int, tracking_pts: list):
    # Separate player coordinates by team
    t1_x, t1_y = [], []
    t2_x, t2_y = [], []
    
    for pt in tracking_pts:
        if pt.class_name == "player" and pt.team_id is not None:
            if pt.team_id == 0:
                t1_x.append(pt.x)
                t1_y.append(pt.y)
            else:
                t2_x.append(pt.x)
                t2_y.append(pt.y)

    # Plot Team 1 Heatmap
    if t1_x:
        plot_and_save_heatmap(t1_x, t1_y, match_id, "team_1")
    # Plot Team 2 Heatmap
    if t2_x:
        plot_and_save_heatmap(t2_x, t2_y, match_id, "team_2")

def plot_and_save_heatmap(x, y, match_id: int, name: str):
    plt.figure(figsize=(10, 6.5))
    
    # Draw soccer pitch lines
    pitch = plt.Rectangle((0, 0), PITCH_LENGTH, PITCH_WIDTH, fill=False, color="white", linewidth=2)
    plt.gca().add_patch(pitch)
    
    # Center circle
    center_circle = plt.Circle((PITCH_LENGTH/2, PITCH_WIDTH/2), 9.15, fill=False, color="white", linewidth=2)
    plt.gca().add_patch(center_circle)
    # Center spot
    plt.plot(PITCH_LENGTH/2, PITCH_WIDTH/2, "o", color="white")
    # Halfway line
    plt.axvline(PITCH_LENGTH/2, color="white", linewidth=2)

    # Penalty areas
    box_1 = plt.Rectangle((0, (PITCH_WIDTH-40.32)/2), 16.5, 40.32, fill=False, color="white", linewidth=2)
    box_2 = plt.Rectangle((PITCH_LENGTH-16.5, (PITCH_WIDTH-40.32)/2), 16.5, 40.32, fill=False, color="white", linewidth=2)
    plt.gca().add_patch(box_1)
    plt.gca().add_patch(box_2)

    # Background color
    plt.gca().set_facecolor("#1B2A1C") # Grass Green
    
    # Plot Seaborn KDE (heatmap)
    try:
        sns.kdeplot(
            x=x, y=y, 
            fill=True, 
            cmap="crest", 
            alpha=0.6, 
            levels=50, 
            thresh=0.05
        )
    except Exception as e:
        print(f"KDE plot error: {e}")
        # Fallback to simple hexbin if KDE fails
        plt.hexbin(x, y, gridsize=15, cmap="crest", mincnt=1, alpha=0.6)

    plt.xlim(0, PITCH_LENGTH)
    plt.ylim(0, PITCH_WIDTH)
    plt.axis("off")
    
    output_path = os.path.join(ANALYTICS_DIR, f"heatmap_{match_id}_{name}.png")
    plt.savefig(output_path, bbox_inches="tight", dpi=150, facecolor="#1B2A1C")
    plt.close()
    print(f"Saved heatmap visual to: {output_path}")
