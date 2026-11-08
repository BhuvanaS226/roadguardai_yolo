import math

DEFAULT_CAMERA_HEIGHT_M = 1.2
DEFAULT_CAMERA_PITCH_DEG = 10.0
DEFAULT_FOV_V_DEG = 50.0


def estimate_distance(box, image_width, image_height,
                      camera_height=DEFAULT_CAMERA_HEIGHT_M,
                      camera_pitch_deg=DEFAULT_CAMERA_PITCH_DEG,
                      fov_v_deg=DEFAULT_FOV_V_DEG,
                      vehicle_speed_kmh=40.0):
    """Ground-plane distance from the bottom-centre of the box (pinhole model)."""
    y_bottom = float(box["y2"])
    cx = (float(box["x1"]) + float(box["x2"])) / 2.0

    focal_px = (image_height / 2.0) / math.tan(math.radians(fov_v_deg / 2.0))
    ray_angle = math.degrees(math.atan((y_bottom - image_height / 2.0) / focal_px))
    depression = camera_pitch_deg + ray_angle

    if depression <= 0.5:
        distance_m = 100.0
    else:
        distance_m = min(camera_height / math.tan(math.radians(depression)), 100.0)
    distance_m = round(distance_m, 1)

    offset = (cx - image_width / 2.0) / image_width
    if offset < -0.17:
        lane = "Left"
    elif offset > 0.17:
        lane = "Right"
    else:
        lane = "Path"

    speed_ms = max(vehicle_speed_kmh, 1.0) / 3.6
    tti = round(distance_m / speed_ms, 1)

    if lane == "Path" and (distance_m <= 10 or tti <= 2.0):
        level, action = "CRITICAL", "Slow down immediately and prepare to steer around"
    elif distance_m <= 25 or tti <= 4.0:
        level, action = "CAUTION", "Reduce speed and stay alert"
    else:
        level, action = "SAFE", "No action needed"

    return {
        "distance_m": distance_m,
        "distance_ft": round(distance_m * 3.28084, 1),
        "lane_position": lane,
        "warning_level": level,
        "recommended_action": action,
        "time_to_impact_s": tti,
    }
