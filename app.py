from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename

from services.detector import detect_potholes
from services.distance import (
    DEFAULT_CAMERA_HEIGHT_M,
    DEFAULT_CAMERA_PITCH_DEG,
    DEFAULT_FOV_V_DEG,
)
from services.severity import calculate_severity
from services.reports import generate_report

from PIL import Image

import os
import uuid
import cv2
import subprocess
try:
    import imageio_ffmpeg
except ImportError:
    imageio_ffmpeg = None


# ============================================================
# ROADGUARD AI - FLASK APPLICATION
# ============================================================

app = Flask(__name__)
CORS(app)


# ============================================================
# PROJECT ROOT
# ============================================================

PROJECT_ROOT = os.path.dirname(
    os.path.abspath(__file__)
)


# ============================================================
# PROJECT PATHS
# ============================================================

UPLOAD_FOLDER = os.path.join(
    PROJECT_ROOT,
    "static",
    "uploads"
)

RESULT_FOLDER = os.path.join(
    PROJECT_ROOT,
    "static",
    "results"
)

REPORT_FOLDER = os.path.join(
    PROJECT_ROOT,
    "static",
    "reports"
)

VIDEO_UPLOAD_FOLDER = os.path.join(
    PROJECT_ROOT,
    "static",
    "videos"
)

VIDEO_RESULT_FOLDER = os.path.join(
    PROJECT_ROOT,
    "static",
    "video_results"
)


# ============================================================
# CREATE REQUIRED FOLDERS
# ============================================================

os.makedirs(
    UPLOAD_FOLDER,
    exist_ok=True
)

os.makedirs(
    RESULT_FOLDER,
    exist_ok=True
)

os.makedirs(
    REPORT_FOLDER,
    exist_ok=True
)

os.makedirs(
    VIDEO_UPLOAD_FOLDER,
    exist_ok=True
)

os.makedirs(
    VIDEO_RESULT_FOLDER,
    exist_ok=True
)


# ============================================================
# FILE EXTENSIONS
# ============================================================

ALLOWED_EXTENSIONS = {
    "jpg",
    "jpeg",
    "png"
}


ALLOWED_VIDEO_EXTENSIONS = {
    "mp4",
    "avi",
    "mov",
    "mkv"
}


# ============================================================
# VIDEO PROCESSING SETTINGS
# ============================================================

# Analyze one frame for every 10 video frames.
#
# Example:
#
# 30 FPS video
# 10 frame interval
#
# Approximately 3 analyzed frames per second.
#
# This is much more detailed than the previous
# 1-frame-per-second approach while still being
# reasonably CPU friendly.

FRAME_INTERVAL = 10


# ============================================================
# SEVERITY ORDER
# ============================================================

SEVERITY_ORDER = {
    "Low": 1,
    "Medium": 2,
    "High": 3
}


# ============================================================
# CONVERT VIDEO TO BROWSER FORMAT
# ============================================================

def convert_video_to_browser_format(
    input_path,
    output_path
):
    """
    Convert an OpenCV generated MP4 into
    browser-compatible H.264 MP4.
    """

    import shutil
    ffmpeg_path = None
    if imageio_ffmpeg is not None:
        try:
            ffmpeg_path = imageio_ffmpeg.get_ffmpeg_exe()
        except Exception:
            ffmpeg_path = None

    if ffmpeg_path is None:
        ffmpeg_path = shutil.which("ffmpeg")

    if ffmpeg_path is None:
        print("[Video] FFmpeg not found. Directly copying raw video to browser target.")
        shutil.copyfile(input_path, output_path)
        return

    command = [
        ffmpeg_path,

        "-y",

        "-i",
        input_path,

        "-vf",
        "scale='min(1080,iw)':-2",

        "-c:v",
        "libx264",

        "-preset",
        "veryfast",

        "-crf",
        "23",

        "-pix_fmt",
        "yuv420p",

        "-movflags",
        "+faststart",

        "-an",

        output_path
    ]

    result = subprocess.run(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )

    if result.returncode != 0:

        print(
            "FFmpeg conversion failed:"
        )

        print(
            result.stderr
        )

        raise RuntimeError(
            "Unable to convert processed video "
            "to browser-compatible H.264 MP4."
        )

    print(
        "Browser-compatible H.264 video created:",
        output_path
    )


# ============================================================
# IMAGE FILE VALIDATION
# ============================================================

def allowed_file(filename):

    return (
        "." in filename
        and
        filename.rsplit(
            ".",
            1
        )[1].lower()
        in ALLOWED_EXTENSIONS
    )


# ============================================================
# VIDEO FILE VALIDATION
# ============================================================

def allowed_video_file(filename):

    return (
        "." in filename
        and
        filename.rsplit(
            ".",
            1
        )[1].lower()
        in ALLOWED_VIDEO_EXTENSIONS
    )


# ============================================================
# HOME / SERVER STATUS
# ============================================================

@app.route(
    "/",
    methods=["GET"]
)
def home():

    return jsonify({

        "success": True,

        "message":
            "RoadGuard AI API is running",

        "status":
            "online"

    })


# ============================================================
# IMAGE DETECTION API
# ============================================================

@app.route(
    "/api/detect",
    methods=["POST"]
)
def detect():

    try:

        # ----------------------------------------------------
        # CHECK FILE
        # ----------------------------------------------------

        if "image" not in request.files:

            return jsonify({

                "success": False,

                "error":
                    "No image file provided"

            }), 400


        file = request.files["image"]


        if file.filename == "":

            return jsonify({

                "success": False,

                "error":
                    "No image selected"

            }), 400


        if not allowed_file(
            file.filename
        ):

            return jsonify({

                "success": False,

                "error":
                    "Only JPG, JPEG and PNG images are supported"

            }), 400


        # ----------------------------------------------------
        # SECURE FILENAME
        # ----------------------------------------------------

        original_filename = secure_filename(
            file.filename
        )


        extension = os.path.splitext(
            original_filename
        )[1].lower()


        unique_filename = (
            str(uuid.uuid4())
            + extension
        )


        image_path = os.path.join(
            UPLOAD_FOLDER,
            unique_filename
        )


        # ----------------------------------------------------
        # SAVE IMAGE
        # ----------------------------------------------------

        file.save(
            image_path
        )


        # ----------------------------------------------------
        # IMAGE DIMENSIONS
        # ----------------------------------------------------

        with Image.open(
            image_path
        ) as image:

            image_width, image_height = (
                image.size
            )


        # ----------------------------------------------------
        # YOLO DETECTION & DISTANCE ESTIMATION
        # ----------------------------------------------------

        try:
            cam_h = float(request.form.get("camera_height", DEFAULT_CAMERA_HEIGHT_M))
        except (ValueError, TypeError):
            cam_h = DEFAULT_CAMERA_HEIGHT_M

        try:
            cam_pitch = float(request.form.get("camera_pitch", DEFAULT_CAMERA_PITCH_DEG))
        except (ValueError, TypeError):
            cam_pitch = DEFAULT_CAMERA_PITCH_DEG

        try:
            cam_fov = float(request.form.get("camera_fov", DEFAULT_FOV_V_DEG))
        except (ValueError, TypeError):
            cam_fov = DEFAULT_FOV_V_DEG

        try:
            veh_speed = float(request.form.get("vehicle_speed", 40.0))
        except (ValueError, TypeError):
            veh_speed = 40.0

        detection_result = detect_potholes(
            image_path,
            camera_height=cam_h,
            camera_pitch_deg=cam_pitch,
            fov_v_deg=cam_fov,
            vehicle_speed_kmh=veh_speed
        )

        detections = detection_result.get(
            "detections",
            []
        )

        result_filename = detection_result.get(
            "result_filename"
        )

        advance_warning = detection_result.get(
            "advance_warning",
            {}
        )


        # ----------------------------------------------------
        # CALCULATE SEVERITY
        # ----------------------------------------------------

        for detection in detections:

            severity_result = calculate_severity(

                box=detection["box"],

                image_width=image_width,

                image_height=image_height,

                confidence=detection["confidence"],

                total_detections=len(
                    detections
                )

            )

            detection["severity"] = (
                severity_result
            )


        # ----------------------------------------------------
        # OVERALL SEVERITY
        # ----------------------------------------------------

        overall_severity = "Low"


        if detections:

            highest_detection = max(

                detections,

                key=lambda item:
                    SEVERITY_ORDER.get(

                        item[
                            "severity"
                        ].get(
                            "severity",
                            "Low"
                        ),

                        1
                    )
            )


            overall_severity = (
                highest_detection[
                    "severity"
                ].get(
                    "severity",
                    "Low"
                )
            )


        # ----------------------------------------------------
        # RESULT IMAGE URL
        # ----------------------------------------------------

        result_image = None


        if result_filename:

            result_image = (
                "/static/results/"
                + result_filename
            )


        # ----------------------------------------------------
        # RESPONSE
        # ----------------------------------------------------

        response = {

            "success":
                True,

            "filename":
                unique_filename,

            "original_filename":
                original_filename,

            "result_image":
                result_image,

            "detections":
                detections,

            "count":
                len(detections),

            "overall_severity":
                overall_severity,

            "advance_warning":
                advance_warning,

            "image_width":
                image_width,

            "image_height":
                image_height

        }


        return jsonify(
            response
        ), 200


    except Exception as e:

        print(
            "DETECTION ERROR:",
            str(e)
        )


        return jsonify({

            "success":
                False,

            "error":
                str(e)

        }), 500


# ============================================================
# ROAD VIDEO DETECTION API
# ============================================================

@app.route(
    "/api/detect-video",
    methods=["POST"]
)
def detect_video():

    video_path = None

    cap = None

    writer = None

    total_frames = 0

    try:

        # ====================================================
        # CHECK VIDEO FILE
        # ====================================================

        if "video" not in request.files:

            return jsonify({

                "success":
                    False,

                "error":
                    "No video file provided"

            }), 400


        file = request.files["video"]


        if file.filename == "":

            return jsonify({

                "success":
                    False,

                "error":
                    "No video selected"

            }), 400


        if not allowed_video_file(
            file.filename
        ):

            return jsonify({

                "success":
                    False,

                "error":
                    "Only MP4, AVI, MOV and MKV videos are supported"

            }), 400


        # ====================================================
        # SAVE UPLOADED VIDEO
        # ====================================================

        original_filename = secure_filename(
            file.filename
        )


        extension = os.path.splitext(
            original_filename
        )[1].lower()


        unique_filename = (
            str(uuid.uuid4())
            + extension
        )


        video_path = os.path.join(
            VIDEO_UPLOAD_FOLDER,
            unique_filename
        )


        file.save(
            video_path
        )


        print()
        print(
            "=" * 60
        )
        print(
            "VIDEO UPLOADED:",
            original_filename
        )
        print(
            "=" * 60
        )


        # ====================================================
        # OPEN VIDEO
        # ====================================================

        cap = cv2.VideoCapture(
            video_path
        )


        if not cap.isOpened():

            return jsonify({

                "success":
                    False,

                "error":
                    "Unable to open the uploaded video"

            }), 400


        # ====================================================
        # VIDEO INFORMATION
        # ====================================================

        fps = cap.get(
            cv2.CAP_PROP_FPS
        )


        total_frames = int(
            cap.get(
                cv2.CAP_PROP_FRAME_COUNT
            )
        )


        frame_width = int(
            cap.get(
                cv2.CAP_PROP_FRAME_WIDTH
            )
        )


        frame_height = int(
            cap.get(
                cv2.CAP_PROP_FRAME_HEIGHT
            )
        )


        if fps <= 0:

            fps = 25


        if frame_width <= 0:

            cap.release()

            return jsonify({

                "success":
                    False,

                "error":
                    "Could not read video width"

            }), 400


        if frame_height <= 0:

            cap.release()

            return jsonify({

                "success":
                    False,

                "error":
                    "Could not read video height"

            }), 400


        # ====================================================
        # VIDEO DURATION
        # ====================================================

        video_duration = 0

        if fps > 0:

            video_duration = (
                total_frames / fps
            )


        # ====================================================
        # CREATE INTERMEDIATE RESULT
        # ====================================================

        result_filename = (

            os.path.splitext(
                unique_filename
            )[0]

            + "_result.mp4"

        )


        result_path = os.path.join(

            VIDEO_RESULT_FOLDER,

            result_filename

        )


        # ====================================================
        # CREATE VIDEO WRITER
        # ====================================================

        fourcc = cv2.VideoWriter_fourcc(
            *"mp4v"
        )


        writer = cv2.VideoWriter(

            result_path,

            fourcc,

            fps,

            (
                frame_width,
                frame_height
            )

        )


        if not writer.isOpened():

            cap.release()

            return jsonify({

                "success":
                    False,

                "error":
                    "Unable to create output video"

            }), 500


        # ====================================================
        # VIDEO STATISTICS
        # ====================================================

        frame_number = 0

        processed_frames = 0

        frames_with_damage = 0

        total_detections = 0


        highest_severity = "Low"


        confidence_values = []


        severity_counts = {

            "Low": 0,

            "Medium": 0,

            "High": 0

        }


        # ====================================================
        # FRAME INTERVAL
        # ====================================================

        # We use every 10th frame.
        #
        # Example:
        #
        # 996 total frames
        # approximately 100 analyzed frames
        #
        # This is considerably more detailed than
        # the previous one-frame-per-second method.

        frame_interval = FRAME_INTERVAL


        print()
        print(
            "Starting video detection..."
        )

        print(
            "Video FPS:",
            round(fps, 2)
        )

        print(
            "Total frames:",
            total_frames
        )

        print(
            "Frame interval:",
            frame_interval
        )

        print(
            "Approximately analyzed frames:",
            (
                total_frames // frame_interval
            ) + 1
        )

        print()


        # ====================================================
        # PROCESS VIDEO FRAME BY FRAME
        # ====================================================

        while True:

            success, frame = cap.read()


            if not success:

                break


            frame_number += 1


            # =================================================
            # DETECT ON SELECTED FRAMES
            # =================================================

            # Analyze the first frame and then every
            # FRAME_INTERVAL frames.

            should_analyze = (

                frame_number == 1

                or

                (
                    (frame_number - 1)
                    % frame_interval
                    == 0
                )

            )


            if should_analyze:

                processed_frames += 1


                # ---------------------------------------------
                # TEMPORARY FRAME FILE
                # ---------------------------------------------

                temp_filename = (

                    "video_frame_"

                    + str(uuid.uuid4())

                    + ".jpg"

                )


                temp_frame_path = os.path.join(

                    UPLOAD_FOLDER,

                    temp_filename

                )


                cv2.imwrite(

                    temp_frame_path,

                    frame

                )


                try:

                    # =========================================
                    # YOLO DETECTION
                    # =========================================

                    detection_result = (
                        detect_potholes(
                            temp_frame_path
                        )
                    )


                    detections = (
                        detection_result.get(
                            "detections",
                            []
                        )
                    )


                    # =========================================
                    # CALCULATE SEVERITY
                    # =========================================

                    for detection in detections:

                        severity_result = (
                            calculate_severity(

                                box=
                                    detection["box"],

                                image_width=
                                    frame_width,

                                image_height=
                                    frame_height,

                                confidence=
                                    detection[
                                        "confidence"
                                    ],

                                total_detections=
                                    len(
                                        detections
                                    )

                            )
                        )


                        detection["severity"] = (
                            severity_result
                        )


                    # =========================================
                    # COUNT DETECTIONS
                    # =========================================

                    if detections:

                        frames_with_damage += 1


                    total_detections += (
                        len(detections)
                    )


                    # =========================================
                    # CONFIDENCE STATISTICS
                    # =========================================

                    for detection in detections:

                        confidence = float(

                            detection.get(
                                "confidence",
                                0
                            )

                        )


                        confidence_values.append(
                            confidence
                        )


                    # =========================================
                    # SEVERITY STATISTICS
                    # =========================================

                    for detection in detections:

                        current_severity = (

                            detection

                            .get(
                                "severity",
                                {}
                            )

                            .get(
                                "severity",
                                "Low"
                            )

                        )


                        if current_severity not in (
                            severity_counts
                        ):

                            severity_counts[
                                current_severity
                            ] = 0


                        severity_counts[
                            current_severity
                        ] += 1


                        # -------------------------------------
                        # Highest severity
                        # -------------------------------------

                        if (

                            SEVERITY_ORDER.get(
                                current_severity,
                                1
                            )

                            >

                            SEVERITY_ORDER.get(
                                highest_severity,
                                1
                            )

                        ):

                            highest_severity = (
                                current_severity
                            )


                    # =========================================
                    # DRAW BOUNDING BOXES WITH DISTANCE & WARNINGS
                    # =========================================

                    has_critical_in_frame = False
                    critical_warning_msg = ""

                    for detection in detections:

                        box = detection["box"]

                        confidence = float(
                            detection["confidence"]
                        )

                        x1 = int(box["x1"])
                        y1 = int(box["y1"])
                        x2 = int(box["x2"])
                        y2 = int(box["y2"])

                        # Distance information
                        dist_data = detection.get("distance", {})
                        dist_m = dist_data.get("distance_m", 15.0)
                        lane_pos = dist_data.get("lane_position", "Path")
                        warn_level = dist_data.get("warning_level", "SAFE")

                        # Color coding based on distance hazard
                        if warn_level == "CRITICAL":
                            box_color = (0, 0, 235)      # Red
                            bg_color = (0, 0, 180)
                            has_critical_in_frame = True
                            critical_warning_msg = f"POTHOLE IN {dist_m}m - SLOW DOWN"
                        elif warn_level == "CAUTION":
                            box_color = (0, 190, 255)    # Amber
                            bg_color = (0, 140, 200)
                            if not has_critical_in_frame:
                                critical_warning_msg = f"POTHOLE APPROACHING ({dist_m}m)"
                        else:
                            box_color = (50, 205, 50)    # Green
                            bg_color = (34, 139, 34)

                        # Bounding box
                        cv2.rectangle(
                            frame,
                            (x1, y1),
                            (x2, y2),
                            box_color,
                            3
                        )

                        damage_class = detection.get(
                            "class",
                            "Pothole"
                        )

                        label = (
                            damage_class.replace("_", " ").title()
                            + f" {dist_m}m [{warn_level}]"
                        )

                        sub_label = f"{lane_pos} | {round(confidence * 100, 1)}%"

                        text_size = cv2.getTextSize(
                            label,
                            cv2.FONT_HERSHEY_SIMPLEX,
                            0.65,
                            2
                        )[0]

                        text_width = text_size[0]
                        text_height = text_size[1]
                        label_x = x1
                        label_y = max(y1 - 10, text_height + 15)

                        cv2.rectangle(
                            frame,
                            (label_x, label_y - text_height - 12),
                            (label_x + text_width + 12, label_y + 6),
                            bg_color,
                            -1
                        )

                        cv2.putText(
                            frame,
                            label,
                            (label_x + 6, label_y),
                            cv2.FONT_HERSHEY_SIMPLEX,
                            0.65,
                            (255, 255, 255),
                            2
                        )

                    # Top HUD Warning Banner on video frame if critical hazard detected
                    if has_critical_in_frame and critical_warning_msg:
                        hud_h = int(frame_height * 0.07)
                        overlay = frame.copy()
                        cv2.rectangle(overlay, (0, 0), (frame_width, hud_h), (0, 0, 180), -1)
                        cv2.addWeighted(overlay, 0.85, frame, 0.15, 0, frame)
                        cv2.putText(
                            frame,
                            f"[!] ADVANCE WARNING: {critical_warning_msg}",
                            (20, int(hud_h * 0.68)),
                            cv2.FONT_HERSHEY_SIMPLEX,
                            max(0.6, frame_width / 1500.0),
                            (255, 255, 255),
                            2
                        )

                finally:
                    # -----------------------------------------
                    # DELETE TEMPORARY FRAME
                    # -----------------------------------------

                    if os.path.exists(temp_frame_path):
                        os.remove(temp_frame_path)


            # =================================================
            # WRITE FRAME TO OUTPUT VIDEO
            # =================================================

            writer.write(
                frame
            )


            # =================================================
            # PROGRESS
            # =================================================

            if frame_number % 50 == 0:

                percentage = 0

                if total_frames > 0:

                    percentage = (

                        frame_number
                        /
                        total_frames
                    ) * 100


                print(

                    f"Processed video frame "
                    f"{frame_number}/"
                    f"{total_frames} "
                    f"({percentage:.1f}%)"

                )


        # ====================================================
        # RELEASE VIDEO RESOURCES
        # ====================================================

        cap.release()

        cap = None


        writer.release()

        writer = None


        # ====================================================
        # CHECK RESULT FILE
        # ====================================================

        if not os.path.exists(
            result_path
        ):

            return jsonify({

                "success":
                    False,

                "error":
                    "Processed video was not created"

            }), 500


        # ====================================================
        # CONFIDENCE STATISTICS
        # ====================================================

        average_confidence = 0

        highest_confidence = 0


        if confidence_values:

            average_confidence = (

                sum(
                    confidence_values
                )

                /

                len(
                    confidence_values
                )

            )


            highest_confidence = max(
                confidence_values
            )


        # ====================================================
        # DETECTION RATE
        # ====================================================

        detection_rate = 0


        if processed_frames > 0:

            detection_rate = (

                frames_with_damage
                /
                processed_frames

            ) * 100


        # ====================================================
        # ANALYSIS PERCENTAGE
        # ====================================================

        analysis_percentage = 0


        if total_frames > 0:

            analysis_percentage = (

                processed_frames
                /
                total_frames

            ) * 100


        # ====================================================
        # CONVERT TO H.264
        # ====================================================

        browser_result_filename = (

            os.path.splitext(
                result_filename
            )[0]

            + "_h264.mp4"

        )


        browser_result_path = os.path.join(

            VIDEO_RESULT_FOLDER,

            browser_result_filename

        )


        print()

        print(
            "Converting processed video "
            "to browser-compatible format..."
        )


        convert_video_to_browser_format(

            result_path,

            browser_result_path

        )


        # ====================================================
        # DELETE INTERMEDIATE VIDEO
        # ====================================================

        try:

            os.remove(
                result_path
            )

        except OSError:

            pass


        # ====================================================
        # RESULT URL
        # ====================================================

        result_video_url = (

            "/static/video_results/"

            + browser_result_filename

        )


        # ====================================================
        # FINAL RESPONSE
        # ====================================================

        response = {

            "success":
                True,

            "original_filename":
                original_filename,

            "result_video":
                result_video_url,


            # -----------------------------------------------
            # Basic video information
            # -----------------------------------------------

            "fps":
                round(
                    fps,
                    2
                ),

            "video_duration":
                round(
                    video_duration,
                    2
                ),

            "total_frames":
                total_frames,


            # -----------------------------------------------
            # Analysis information
            # -----------------------------------------------

            "processed_frames":
                processed_frames,

            "frame_interval":
                frame_interval,

            "analysis_percentage":
                round(
                    analysis_percentage,
                    2
                ),


            # -----------------------------------------------
            # Detection information
            # -----------------------------------------------

            "frames_with_damage":
                frames_with_damage,

            "total_detections":
                total_detections,

            "detection_rate":
                round(
                    detection_rate,
                    2
                ),


            # -----------------------------------------------
            # Confidence information
            # -----------------------------------------------

            "average_confidence":
                round(
                    average_confidence,
                    4
                ),

            "average_confidence_percentage":
                round(
                    average_confidence * 100,
                    2
                ),

            "highest_confidence":
                round(
                    highest_confidence,
                    4
                ),

            "highest_confidence_percentage":
                round(
                    highest_confidence * 100,
                    2
                ),


            # -----------------------------------------------
            # Severity information
            # -----------------------------------------------

            "highest_severity":
                highest_severity,

            "severity_counts":
                severity_counts,


            # -----------------------------------------------
            # Message
            # -----------------------------------------------

            "message":
                "Video detection completed successfully."

        }


        # ====================================================
        # PRINT FINAL STATISTICS
        # ====================================================

        print()

        print(
            "=" * 60
        )

        print(
            "VIDEO DETECTION COMPLETED"
        )

        print(
            "=" * 60
        )

        print(
            "Total frames:",
            total_frames
        )

        print(
            "Processed frames:",
            response["processed_frames"]
        )

        print(
            "Analysis percentage:",
            round(
                analysis_percentage,
                2
            ),
            "%"
        )

        print(
            "Frames with damage:",
            response["frames_with_damage"]
        )

        print(
            "Total detections:",
            total_detections
        )

        print(
            "Average confidence:",
            round(
                average_confidence * 100,
                2
            ),
            "%"
        )

        print(
            "Highest confidence:",
            round(
                highest_confidence * 100,
                2
            ),
            "%"
        )

        print(
            "Detection rate:",
            round(
                detection_rate,
                2
            ),
            "%"
        )

        print(
            "Highest severity:",
            highest_severity
        )

        print(
            "Severity counts:",
            severity_counts
        )

        print(
            "Video duration:",
            round(
                video_duration,
                2
            ),
            "seconds"
        )

        print(
            "=" * 60
        )

        print()


        return jsonify(
            response
        ), 200


    # ========================================================
    # VIDEO ERROR
    # ========================================================

    except Exception as e:

        print()

        print(
            "VIDEO DETECTION ERROR:",
            str(e)
        )


        # ----------------------------------------------------
        # Release resources
        # ----------------------------------------------------

        if cap is not None:

            cap.release()


        if writer is not None:

            writer.release()


        return jsonify({

            "success":
                False,

            "error":
                str(e)

        }), 500

# ============================================================
# PDF REPORT GENERATION
# ============================================================

@app.route(
    "/api/report",
    methods=["POST"]
)
def create_report():

    try:

        # ----------------------------------------------------
        # GET JSON
        # ----------------------------------------------------

        data = request.get_json()


        if not data:

            return jsonify({

                "success":
                    False,

                "error":
                    "No report data received"

            }), 400


        # ----------------------------------------------------
        # REPORT DATA
        # ----------------------------------------------------

        filename = data.get(
            "filename",
            "road_image.jpg"
        )


        detections = data.get(
            "detections",
            []
        )


        location = data.get(
            "location"
        )


        overall_severity = data.get(
            "overall_severity",
            "Low"
        )


        # ----------------------------------------------------
        # GENERATE PDF
        # ----------------------------------------------------

        report_filename = generate_report(

            filename=filename,

            detections=detections,

            location=location,

            overall_severity=overall_severity

        )


        # ----------------------------------------------------
        # REPORT URL
        # ----------------------------------------------------

        report_url = (

            "/static/reports/"

            + report_filename

        )


        print(
            "REPORT CREATED:",
            report_filename
        )


        return jsonify({

            "success":
                True,

            "report":
                report_filename,

            "report_filename":
                report_filename,

            "report_url":
                report_url

        }), 200


    except Exception as e:

        print(
            "REPORT ERROR:",
            str(e)
        )


        return jsonify({

            "success":
                False,

            "error":
                str(e)

        }), 500


# ============================================================
# STATIC REPORT FILES
# ============================================================

@app.route(
    "/static/reports/<path:filename>",
    methods=["GET"]
)
def download_report(filename):

    return send_from_directory(

        REPORT_FOLDER,

        filename

    )


# ============================================================
# STATIC VIDEO RESULT FILES
# ============================================================

@app.route(
    "/static/video_results/<path:filename>",
    methods=["GET"]
)
def download_video_result(filename):

    return send_from_directory(

        VIDEO_RESULT_FOLDER,

        filename

    )


# ============================================================
# START SERVER
# ============================================================

if __name__ == "__main__":

    print()

    print(
        "=" * 60
    )

    print(
        "ROADGUARD AI"
    )

    print(
        "=" * 60
    )

    print(
        "Starting Flask server..."
    )

    print(
        "URL: http://127.0.0.1:5000"
    )

    print(
        "Video frame interval:",
        FRAME_INTERVAL
    )

    print(
        "Approximately 1 out of every",
        FRAME_INTERVAL,
        "frames will be analyzed."
    )

    print(
        "=" * 60
    )

    print()


    app.run(

        host="0.0.0.0",

        port=5000,

        debug=False,

        use_reloader=False

    )