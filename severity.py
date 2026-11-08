def calculate_severity(box, image_width, image_height, confidence, total_detections=1):
    w = max(float(box["x2"]) - float(box["x1"]), 0)
    h = max(float(box["y2"]) - float(box["y1"]), 0)
    area_pct = (w * h) / max(image_width * image_height, 1) * 100

    score = min(area_pct * 4, 70) + float(confidence) * 20 + min(max(total_detections - 1, 0) * 2, 10)
    score = int(round(min(score, 100)))

    if score >= 60:
        level = "High"
    elif score >= 30:
        level = "Medium"
    else:
        level = "Low"

    return {
        "severity": level,
        "score": score,
        "area_percentage": round(area_pct, 2),
        "reason": f"Covers {area_pct:.2f}% of the image with {float(confidence) * 100:.0f}% confidence.",
    }
