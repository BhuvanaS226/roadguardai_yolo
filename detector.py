import os
import uuid

import cv2
from ultralytics import YOLO

from services.buzzer import beep
from services.distance import (
    DEFAULT_CAMERA_HEIGHT_M,
    DEFAULT_CAMERA_PITCH_DEG,
    DEFAULT_FOV_V_DEG,
    estimate_distance,
)

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RESULT_FOLDER = os.path.join(PROJECT_ROOT, "static", "results")
MODEL_PATH = os.path.join(PROJECT_ROOT, "best.pt")
CONF_THRESHOLD = 0.05

_model = None


def _get_model():
    global _model
    if _model is None:
        path = MODEL_PATH if os.path.exists(MODEL_PATH) else "yolo11n.pt"
        _model = YOLO(path)
    return _model


def detect_potholes(image_path,
                    camera_height=DEFAULT_CAMERA_HEIGHT_M,
                    camera_pitch_deg=DEFAULT_CAMERA_PITCH_DEG,
                    fov_v_deg=DEFAULT_FOV_V_DEG,
                    vehicle_speed_kmh=40.0):
    model = _get_model()
    image = cv2.imread(image_path)
    if image is None:
        raise ValueError(f"Could not read image: {image_path}")
    h, w = image.shape[:2]

    result = model.predict(image, conf=CONF_THRESHOLD, verbose=False)[0]

    detections = []
    for b in result.boxes:
        x1, y1, x2, y2 = [float(v) for v in b.xyxy[0].tolist()]
        box = {"x1": x1, "y1": y1, "x2": x2, "y2": y2}
        detections.append({
            "class": str(result.names[int(b.cls[0])]),
            "confidence": float(b.conf[0]),
            "box": box,
            "distance": estimate_distance(
                box, w, h, camera_height, camera_pitch_deg, fov_v_deg, vehicle_speed_kmh
            ),
        })

    if any(d["class"] == "pothole" for d in detections):
        beep()

    os.makedirs(RESULT_FOLDER, exist_ok=True)
    result_filename = f"result_{uuid.uuid4().hex}.jpg"
    cv2.imwrite(os.path.join(RESULT_FOLDER, result_filename), result.plot())

    return {
        "detections": detections,
        "result_filename": result_filename,
        "advance_warning": _advance_warning(detections),
    }


def _advance_warning(detections):
    if not detections:
        return {"has_hazard": False, "alert_level": "SAFE", "alert_title": "Road clear",
                "alert_message": "No road damage detected ahead."}
    order = {"SAFE": 0, "CAUTION": 1, "CRITICAL": 2}
    worst = max(detections, key=lambda d: (order[d["distance"]["warning_level"]],
                                           -d["distance"]["distance_m"]))
    dist = worst["distance"]
    level = dist["warning_level"]
    title = {"CRITICAL": "Hazard ahead!", "CAUTION": "Road damage approaching"}.get(level, "Road damage detected")
    return {
        "has_hazard": level != "SAFE",
        "alert_level": level,
        "alert_title": title,
        "alert_message": f"{worst['class'].replace('_', ' ').title()} {dist['distance_m']} m ahead. {dist['recommended_action']}.",
        "closest_distance_m": dist["distance_m"],
        "lane_position": dist["lane_position"],
        "time_to_impact_s": dist["time_to_impact_s"],
    }
