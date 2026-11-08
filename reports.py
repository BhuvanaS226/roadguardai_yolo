import os
import uuid
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPORT_FOLDER = os.path.join(PROJECT_ROOT, "static", "reports")


def generate_report(filename, detections, location, overall_severity):
    os.makedirs(REPORT_FOLDER, exist_ok=True)
    report_filename = f"report_{uuid.uuid4().hex[:12]}.pdf"
    styles = getSampleStyleSheet()

    story = [
        Paragraph("RoadGuard AI - Road Damage Report", styles["Title"]),
        Paragraph(f"Generated: {datetime.now():%Y-%m-%d %H:%M}", styles["Normal"]),
        Paragraph(f"Image: {filename}", styles["Normal"]),
        Paragraph(f"Location: {location or 'Not provided'}", styles["Normal"]),
        Paragraph(f"Overall severity: <b>{overall_severity}</b>", styles["Normal"]),
        Paragraph(f"Detections: {len(detections)}", styles["Normal"]),
        Spacer(1, 14),
    ]

    rows = [["#", "Type", "Confidence", "Severity", "Score", "Distance"]]
    for i, d in enumerate(detections, 1):
        sev = d.get("severity") or {}
        dist = d.get("distance") or {}
        rows.append([
            i,
            str(d.get("class", "pothole")).replace("_", " ").title(),
            f"{float(d.get('confidence', 0)) * 100:.1f}%",
            sev.get("severity", "-"),
            sev.get("score", "-"),
            f"{dist['distance_m']} m" if "distance_m" in dist else "-",
        ])
    table = Table(rows, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#333333")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
    ]))
    story.append(table)

    SimpleDocTemplate(os.path.join(REPORT_FOLDER, report_filename), pagesize=A4).build(story)
    return report_filename
