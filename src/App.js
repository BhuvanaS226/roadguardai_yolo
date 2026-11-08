import React, {
  useState,
  useRef,
  useEffect
} from "react";

import axios from "axios";

import "./App.css";


const API_URL = "http://127.0.0.1:5000";


function App() {

  // =========================================================
  // IMAGE STATES
  // =========================================================

  const [selectedImage, setSelectedImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [showDetection, setShowDetection] = useState(false);


  // =========================================================
  // LOCATION STATES
  // =========================================================

  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState("");


  // =========================================================
  // CAMERA STATES
  // =========================================================

  const [cameraActive, setCameraActive] = useState(false);
  const [liveDetection, setLiveDetection] = useState(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [aiDetectionActive, setAiDetectionActive] = useState(false);
  const [liveResultImage, setLiveResultImage] = useState(null);


  // =========================================================
  // VIDEO STATES
  // =========================================================

  const [selectedVideo, setSelectedVideo] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoResult, setVideoResult] = useState(null);
  const [videoError, setVideoError] = useState("");


  // =========================================================
  // ADAS DISTANCE & ADVANCE WARNING STATES
  // =========================================================

  // Controller-side warning logic should decide whether to trigger alerts.
  // This app only measures distance and exposes the classification.
  const [cameraHeight, setCameraHeight] = useState(1.3);     // meters
  const [cameraPitch, setCameraPitch] = useState(7.5);       // degrees
  const [cameraFov, setCameraFov] = useState(38);            // vertical FOV in degrees
  const [vehicleSpeed, setVehicleSpeed] = useState(40);      // km/h
  const [showCalibration, setShowCalibration] = useState(false);

  // =========================================================
  // CAMERA REFS
  // =========================================================

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const liveIntervalRef = useRef(null);
  const liveRequestRunningRef = useRef(false);


  // =========================================================
  // IMAGE SELECTION
  // =========================================================

  const handleImageChange = (event) => {

    const file = event.target.files[0];

    if (!file) {
      return;
    }

    setSelectedImage(file);

    setPreview(
      URL.createObjectURL(file)
    );

    setResult(null);
    setError("");
    setLocation(null);
    setLocationError("");
  };


  // =========================================================
  // VIDEO SELECTION
  // =========================================================

  const handleVideoChange = (event) => {

    const file = event.target.files[0];

    if (!file) {
      return;
    }

    setSelectedVideo(file);

    setVideoPreview(
      URL.createObjectURL(file)
    );

    setVideoResult(null);
    setVideoError("");
  };


  // =========================================================
  // GET USER LOCATION
  // =========================================================

  const getUserLocation = () => {

    return new Promise(
      (resolve, reject) => {

        if (!navigator.geolocation) {

          const message =
            "Geolocation is not supported by this browser.";

          setLocationError(message);

          reject(
            new Error(message)
          );

          return;
        }


        navigator.geolocation.getCurrentPosition(

          (position) => {

            const locationData = {

              latitude:
                position.coords.latitude,

              longitude:
                position.coords.longitude,

              accuracy:
                position.coords.accuracy

            };


            setLocation(locationData);
            setLocationError("");

            resolve(locationData);

          },


          (geoError) => {

            let message =
              "Unable to get your location.";


            if (geoError.code === 1) {

              message =
                "Location permission was denied.";

            }

            else if (geoError.code === 2) {

              message =
                "Your location could not be determined.";

            }

            else if (geoError.code === 3) {

              message =
                "Location request timed out.";

            }


            setLocationError(message);

            reject(
              new Error(message)
            );

          },


          {

            enableHighAccuracy: true,

            timeout: 10000,

            maximumAge: 0

          }

        );

      }
    );

  };


  // =========================================================
  // IMAGE DETECTION
  // =========================================================

  const detectPotholes = async () => {

    if (!selectedImage) {

      setError(
        "Please select a road image first."
      );

      return;
    }


    setLoading(true);
    setError("");
    setResult(null);


    const formData = new FormData();

    formData.append(
      "image",
      selectedImage
    );

    formData.append("camera_height", cameraHeight);
    formData.append("camera_pitch", cameraPitch);
    formData.append("camera_fov", cameraFov);
    formData.append("vehicle_speed", vehicleSpeed);


    try {

      const response =
        await axios.post(

          `${API_URL}/api/detect`,

          formData

        );


      console.log(
        "Backend response:",
        response.data
      );


      setResult(
        response.data
      );

      // Controller / hardware layer should handle alerting decisions.
      // This UI only reports the measured distance and hazard level.

      try {

        await getUserLocation();

      }

      catch (locationError) {

        console.log(
          "Location unavailable:",
          locationError.message
        );

      }

    }

    catch (err) {

      console.error(
        "Detection error:",
        err
      );


      if (err.response) {

        setError(

          err.response.data?.error ||

          err.response.data?.message ||

          "Detection failed on the server."

        );

      }

      else {

        setError(
          "Unable to connect to the RoadGuard AI server. Make sure Flask is running."
        );

      }

    }

    finally {

      setLoading(false);

    }

  };


  // =========================================================
  // ROAD VIDEO DETECTION
  // =========================================================

  const detectRoadVideo = async () => {

    if (!selectedVideo) {

      setVideoError(
        "Please select a road video first."
      );

      return;
    }


    setVideoLoading(true);
    setVideoError("");
    setVideoResult(null);


    const formData = new FormData();

    formData.append(
      "video",
      selectedVideo
    );


    try {

      console.log(
        "Uploading video..."
      );


      const response =
        await axios.post(

          `${API_URL}/api/detect-video`,

          formData

        );


      console.log(
        "Video detection response:",
        response.data
      );


      if (
        response.data.success &&
        response.data.result_video
      ) {

        setVideoResult(
          response.data
        );

      }

      else {

        setVideoError(

          response.data.error ||

          "Video processing completed but no result video was returned."

        );

      }

    }

    catch (err) {

      console.error(
        "Video detection error:",
        err
      );


      if (err.response) {

        setVideoError(

          err.response.data?.error ||

          err.response.data?.message ||

          "Video detection failed on the server."

        );

      }

      else {

        setVideoError(

          "Unable to connect to the RoadGuard AI server. Make sure Flask is running."

        );

      }

    }

    finally {

      setVideoLoading(false);

    }

  };


  // =========================================================
  // START CAMERA
  // =========================================================

  const startCamera = async () => {

    try {

      setCameraError("");
      setLiveDetection(null);
      setLiveResultImage(null);


      if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {

        setCameraError(
          "Camera access is not supported by this browser."
        );

        return;

      }


      if (streamRef.current) {

        streamRef.current
          .getTracks()
          .forEach(
            (track) => track.stop()
          );

        streamRef.current = null;

      }


      const stream =
        await navigator.mediaDevices.getUserMedia({

          video: {

            facingMode: {
              ideal: "environment"
            },

            width: {
              ideal: 1280
            },

            height: {
              ideal: 720
            }

          },

          audio: false

        });


      console.log(
        "Camera stream obtained:",
        stream
      );


      streamRef.current = stream;

      setCameraActive(true);

    }

    catch (err) {

      console.error(
        "Camera error:",
        err
      );


      if (
        err.name === "NotAllowedError"
      ) {

        setCameraError(
          "Camera permission was denied. Please allow camera access for localhost:3000."
        );

      }

      else if (
        err.name === "NotFoundError"
      ) {

        setCameraError(
          "No camera was found on this device."
        );

      }

      else if (
        err.name === "NotReadableError"
      ) {

        setCameraError(
          "The camera is being used by another application. Close apps such as Camera, Teams or Zoom and try again."
        );

      }

      else {

        setCameraError(
          "Unable to access the camera: " +
          err.message
        );

      }

    }

  };


  // =========================================================
  // ATTACH CAMERA STREAM
  // =========================================================

  useEffect(() => {

    if (
      cameraActive &&
      videoRef.current &&
      streamRef.current
    ) {

      const video =
        videoRef.current;

      const stream =
        streamRef.current;


      video.srcObject = stream;

      video.muted = true;

      video.playsInline = true;

      video.autoplay = true;


      const playVideo = async () => {

        try {

          await video.play();

          console.log(
            "Camera video started successfully."
          );

        }

        catch (err) {

          console.error(
            "Video play error:",
            err
          );

          setCameraError(
            "Camera started, but the video could not be played."
          );

        }

      };


      playVideo();

    }

  }, [cameraActive]);


  // =========================================================
  // STOP CAMERA
  // =========================================================

  const stopCamera = () => {

    stopLiveDetection();


    if (streamRef.current) {

      streamRef.current
        .getTracks()
        .forEach(
          (track) => track.stop()
        );

      streamRef.current = null;

    }


    if (videoRef.current) {

      videoRef.current.srcObject = null;

    }


    setCameraActive(false);
    setLiveDetection(null);
    setLiveResultImage(null);
    setLiveLoading(false);
    setCameraError("");

  };


  // =========================================================
  // CAPTURE CAMERA FRAME
  // =========================================================

  const captureFrame = () => {

    if (
      !videoRef.current ||
      !canvasRef.current
    ) {

      return null;

    }


    const video =
      videoRef.current;

    const canvas =
      canvasRef.current;


    if (
      video.readyState < 2 ||
      video.videoWidth === 0 ||
      video.videoHeight === 0
    ) {

      return null;

    }


    canvas.width =
      video.videoWidth;

    canvas.height =
      video.videoHeight;


    const context =
      canvas.getContext("2d");


    context.drawImage(

      video,

      0,

      0,

      canvas.width,

      canvas.height

    );


    return canvas;

  };


  // =========================================================
  // DETECT LIVE CAMERA FRAME
  // =========================================================

  const detectLiveFrame = async () => {

    if (
      liveRequestRunningRef.current
    ) {

      return;

    }


    if (!cameraActive) {

      return;

    }


    const canvas =
      captureFrame();


    if (!canvas) {

      return;

    }


    liveRequestRunningRef.current = true;

    setLiveLoading(true);


    try {

      const blob =
        await new Promise(
          (resolve) => {

            canvas.toBlob(

              resolve,

              "image/jpeg",

              0.75

            );

          }
        );


      if (!blob) {

        throw new Error(
          "Could not capture camera frame."
        );

      }


      const formData =
        new FormData();


      formData.append(

        "image",

        blob,

        "camera_frame.jpg"

      );

      formData.append("camera_height", cameraHeight);
      formData.append("camera_pitch", cameraPitch);
      formData.append("camera_fov", cameraFov);
      formData.append("vehicle_speed", vehicleSpeed);


      const response =
        await axios.post(

          `${API_URL}/api/detect`,

          formData

        );


      console.log(
        "Live detection result:",
        response.data
      );


      setLiveDetection(
        response.data
      );

      // Controller / hardware layer should handle alerting decisions.
      // This live view only logs and displays the distance-based classification.

      if (
        response.data.result_image
      ) {

        setLiveResultImage(
       `${API_URL}${response.data.result_image}?t=${Date.now()}`
     );

      }

    }

    catch (err) {

      console.error(
        "Live detection error:",
        err
      );


      if (err.response) {

        setCameraError(

          err.response.data?.error ||

          err.response.data?.message ||

          "Live detection failed."

        );

      }

      else {

        setCameraError(
          "Unable to connect to the RoadGuard AI server."
        );

      }

    }

    finally {

      setLiveLoading(false);

      liveRequestRunningRef.current = false;

    }

  };


  // =========================================================
  // START LIVE AI DETECTION
  // =========================================================

  const startLiveDetection = async () => {

    if (!cameraActive) {

      setCameraError(
        "Please start the camera first."
      );

      return;

    }


    if (
      liveIntervalRef.current
    ) {

      return;

    }


    setCameraError("");
    setAiDetectionActive(true);
    setLiveDetection(null);
    setLiveResultImage(null);


    try {

      await getUserLocation();

    }

    catch (locationError) {

      console.log(
        "Live location unavailable:",
        locationError.message
      );

    }


    await detectLiveFrame();


    liveIntervalRef.current =
      setInterval(

        () => {

          detectLiveFrame();

        },

        2500

      );

  };


  // =========================================================
  // STOP LIVE AI DETECTION
  // =========================================================

  const stopLiveDetection = () => {

    if (
      liveIntervalRef.current
    ) {

      clearInterval(
        liveIntervalRef.current
      );

      liveIntervalRef.current = null;

    }


    setAiDetectionActive(false);
    setLiveLoading(false);

  };


  // =========================================================
  // CLEAN CAMERA
  // =========================================================

  useEffect(() => {

    return () => {

      if (
        liveIntervalRef.current
      ) {

        clearInterval(
          liveIntervalRef.current
        );

      }


      if (
        streamRef.current
      ) {

        streamRef.current
          .getTracks()
          .forEach(
            (track) => track.stop()
          );

      }

    };

  }, []);


  // =========================================================
  // MAP URL
  // =========================================================

  const getMapUrl = () => {

    if (!location) {

      return "";

    }


    const latitude =
      location.latitude;

    const longitude =
      location.longitude;


    const offset = 0.01;


    const left =
      longitude - offset;

    const right =
      longitude + offset;

    const bottom =
      latitude - offset;

    const top =
      latitude + offset;


    return (

      "https://www.openstreetmap.org/export/embed.html"

      +

      `?bbox=${left},${bottom},${right},${top}`

      +

      "&layer=mapnik"

      +

      `&marker=${latitude},${longitude}`

    );

  };


  // =========================================================
  // GENERATE PDF REPORT
  // =========================================================

  const generatePDFReport = async () => {

    if (!result) {

      setError(
        "Please detect a road image before generating the report."
      );

      return;

    }


    try {

      setError("");


      const reportData = {

        filename:
          result.original_filename ||
          result.filename ||
          selectedImage?.name ||
          "road_image.jpg",


        count:
          result.count || 0,


        overall_severity:
          result.overall_severity ||
          "Low",


        detections:
          result.detections ||
          [],


        location:
          location
            ? {

                latitude:
                  location.latitude,

                longitude:
                  location.longitude,

                accuracy:
                  location.accuracy

              }

            : null

      };


      console.log(
        "Sending report data:",
        reportData
      );


      const response =
        await axios.post(

          `${API_URL}/api/report`,

          reportData

        );


      console.log(
        "PDF response:",
        response.data
      );


      if (
        response.data.success &&
        response.data.report_url
      ) {

        const reportUrl =
          `${API_URL}${response.data.report_url}`;


        window.open(
          reportUrl,
          "_blank"
        );

      }

      else {

        setError(
          response.data.error ||
          "Unable to generate PDF report."
        );

      }

    }

    catch (err) {

      console.error(
        "PDF error:",
        err
      );


      setError(

        err.response?.data?.error ||

        "Unable to generate PDF report."

      );

    }

  };


  // =========================================================
  // HELPER - VIDEO METRIC
  // =========================================================

  // eslint-disable-next-line no-unused-vars
  const VideoMetric = ({
    icon,
    title,
    value,
    description
  }) => {

    return (

      <div className="video-metric-card">

        <div className="video-metric-icon">
          {icon}
        </div>

        <div className="video-metric-content">

          <span className="video-metric-title">
            {title}
          </span>

          <strong className="video-metric-value">
            {value}
          </strong>

          <small className="video-metric-description">
            {description}
          </small>

        </div>

      </div>

    );

  };


  // =========================================================
  // UI
  // =========================================================

  return (

    <div className="app">


     {/* =====================================================
    NAVBAR
===================================================== */}

<nav className="navbar">

  <div className="logo">

    <span className="logo-icon">
      🛣️
    </span>

    RoadGuard{" "}

    <span>
      AI
    </span>

  </div>


  <div className="nav-links">

    <button
      className="nav-button"
      onClick={() => setShowDetection(false)}
    >
      Dashboard
    </button>

    <button
      className="nav-button"
      onClick={() => setShowDetection(true)}
    >
      Detection
    </button>

  </div>

</nav>

      {/* =====================================================
          HERO
      ===================================================== */}
      {!showDetection && (
      <section
        className="hero"
        id="home"
      >

        <div className="hero-content">

          <div className="badge">
            AI-POWERED ROAD MONITORING
          </div>


          <h1>

            Smarter Roads.

            <br />

            <span>
              Safer Journeys.
            </span>

          </h1>


          <p>

            RoadGuard AI uses computer vision
            and deep learning to detect potholes
            and road damage from images, videos
            and live camera frames.

          </p>


          <button

  className="hero-button"

  onClick={() => setShowDetection(true)}

>

  Start Detection →

</button>

        </div>


        <div className="hero-card">

          <div className="road-animation">

            <div className="road-line"></div>

            <div className="road-line second"></div>

          </div>


          <div className="scan-text">
            AI ROAD SCAN
          </div>


          <div className="scan-status">
            ● SYSTEM READY
          </div>

        </div>

      </section>

)}
      {/* =====================================================
          IMAGE DETECTION
      ===================================================== */}
      {showDetection && (
      <section
        className="detect-section"
        id="detect"
      >

        <div className="section-heading">

          <div className="badge">
            DETECTION CENTER
          </div>


          <h2>

            Analyze a{" "}

            <span>
              Road Image
            </span>

          </h2>


          <p>

            Upload a road image and let our
            YOLO-based AI model identify
            potential potholes.

          </p>

        </div>


        <div className="detector-container">


          {/* UPLOAD CARD */}

          <div className="upload-card">

            <div className="upload-icon">
              📷
            </div>


            <h3>
              Upload Road Image
            </h3>


            <p>
              Select a JPG, JPEG or PNG image
            </p>


            <label
              className="upload-button"
            >

              Choose Image

              <input

                type="file"

                accept="image/*"

                onChange={
                  handleImageChange
                }

              />

            </label>


            {selectedImage && (

              <p className="file-name">

                Selected:{" "}

                {selectedImage.name}

              </p>

            )}


            <button

              className="detect-button"

              onClick={
                detectPotholes
              }

              disabled={
                loading
              }

            >

              {loading
                ? "Analyzing..."
                : "🔍 Detect Potholes"}

            </button>


            {error && (

              <div className="error">

                {error}

              </div>

            )}

          </div>


          {/* PREVIEW CARD */}

          <div className="preview-card">

            <h3>

              {result &&
              result.result_image

                ? "AI Detection Result"

                : "Image Preview"}

            </h3>


            {result &&
            result.result_image ? (

              <img

                src={
                  `${API_URL}${result.result_image}`
                }

                alt="AI detection result"

                className="preview-image"

              />

            ) : preview ? (

              <img

                src={preview}

                alt="Road preview"

                className="preview-image"

              />

            ) : (

              <div className="empty-preview">

                <span>
                  🖼️
                </span>

                <p>
                  Your uploaded image
                  will appear here
                </p>

              </div>

            )}

          </div>

        </div>


        {/* =================================================
            IMAGE RESULTS
        ================================================= */}

        {result && (

          <div className="result-card">


            <div className="result-header">

              <div>

                <div className="badge">
                  AI ANALYSIS
                </div>


                <h2>
                  Detection Results
                </h2>

              </div>


              <div className="count-box">

                <strong>
                  {result.count}
                </strong>

                <span>
                  Potholes
                </span>

              </div>

            </div>


            {result.overall_severity &&
            result.overall_severity !== "None" && (

              <div className="severity-box">

                <span>
                  Overall Severity
                </span>


                <strong>
                  {result.overall_severity}
                </strong>

              </div>

            )}

            {/* ADVANCE COLLISION WARNING BANNER */}
            {result.advance_warning && result.advance_warning.has_hazard && (
              <div className={`advance-warning-card ${result.advance_warning.alert_level ? result.advance_warning.alert_level.toLowerCase() : 'info'}`}>
                <div className="warning-card-header">
                  <span className="warning-card-icon">
                    {result.advance_warning.alert_level === 'CRITICAL' ? '🚨' : '⚠️'}
                  </span>
                  <div>
                    <h4>{result.advance_warning.alert_title}</h4>
                    <p>{result.advance_warning.alert_message}</p>
                  </div>
                </div>
                <div className="warning-card-pills">
                  {result.advance_warning.closest_distance_m && (
                    <span className="pill distance-pill">
                      📍 Closest: <strong>{result.advance_warning.closest_distance_m}m</strong>
                    </span>
                  )}
                  {result.advance_warning.lane_position && (
                    <span className="pill lane-pill">
                      🛣️ Lane: <strong>{result.advance_warning.lane_position}</strong>
                    </span>
                  )}
                  {result.advance_warning.time_to_impact_s && (
                    <span className="pill tti-pill">
                      ⏱️ TTI: <strong>{result.advance_warning.time_to_impact_s}s</strong>
                    </span>
                  )}
                </div>
              </div>
            )}


            {location && (

              <div className="location-box">

                <div className="location-title">

                  📍 Detection Location

                </div>


                <div className="location-details">

                  <p>

                    <strong>
                      Latitude:
                    </strong>{" "}

                    {location.latitude.toFixed(6)}

                  </p>


                  <p>

                    <strong>
                      Longitude:
                    </strong>{" "}

                    {location.longitude.toFixed(6)}

                  </p>


                  <p>

                    <strong>
                      Accuracy:
                    </strong>{" "}

                    {location.accuracy.toFixed(1)}
                    {" "}meters

                  </p>

                </div>


                <div className="map-container">

                  <iframe

                    title="RoadGuard AI Detection Location"

                    src={
                      getMapUrl()
                    }

                    className="location-map"

                    loading="lazy"

                  ></iframe>

                </div>


                <a

                  href={
                    `https://www.google.com/maps?q=${location.latitude},${location.longitude}`
                  }

                  target="_blank"

                  rel="noopener noreferrer"

                  className="map-button"

                >

                  🌐 Open in Google Maps

                </a>

              </div>

            )}


            {locationError && (

              <div className="location-error">

                📍 {locationError}

              </div>

            )}


            {result.count === 0 ? (

              <div className="no-detection">

                <span>
                  ✓
                </span>


                <h3>
                  No potholes detected
                </h3>


                <p>

                  The AI model did not detect
                  a pothole in this image.

                </p>

              </div>

            ) : (

              <div className="detections">

                {result.detections.map(

                  (detection, index) => (

                    <div

                      className="detection-item"

                      key={index}

                    >

                      <div>

                        <strong>

                          Pothole{" "}
                          {index + 1}

                        </strong>


                        <p>

                          Confidence:{" "}

                          {(
                            detection.confidence *
                            100
                          ).toFixed(1)}

                          %

                        </p>


                        {detection.severity && (

                          <>

                            <p>

                              Severity:{" "}

                              <strong>

                                {
                                  detection
                                    .severity
                                    .severity
                                }

                              </strong>

                            </p>


                            <p>

                              Severity Score:{" "}

                              <strong>

                                {
                                  detection
                                    .severity
                                    .score
                                }

                                {" "} / 100

                              </strong>

                            </p>


                            <p>

                              Detected Area:{" "}

                              <strong>

                                {
                                  detection
                                    .severity
                                    .area_percentage
                                }%

                              </strong>

                            </p>


                            {detection.severity.reason && (

                              <p>

                                {
                                  detection
                                    .severity
                                    .reason
                                }

                              </p>

                            )}

                          </>

                        )}

                        {detection.distance && (
                          <div className="detection-distance-box">
                            <p>
                              Estimated Distance:{" "}
                              <strong className={`dist-highlight ${detection.distance.warning_level?.toLowerCase()}`}>
                                📏 {detection.distance.distance_m} m ({detection.distance.distance_ft} ft)
                              </strong>
                            </p>
                            <p>
                              Lane Position:{" "}
                              <strong>{detection.distance.lane_position}</strong>
                            </p>
                            <p>
                              Warning Status:{" "}
                              <span className={`status-tag ${detection.distance.warning_level?.toLowerCase()}`}>
                                {detection.distance.warning_level}
                              </span>
                            </p>
                            <p className="dist-action">
                              👉 {detection.distance.recommended_action}
                            </p>
                          </div>
                        )}

                      </div>


                      <div className="confidence">

                        {(
                          detection.confidence *
                          100
                        ).toFixed(1)}

                        %

                      </div>

                    </div>

                  )

                )}

              </div>

            )}


            <div className="report-section">

              <button

                className="report-button"

                onClick={
                  generatePDFReport
                }

              >

                📄 Generate PDF Report

              </button>

            </div>

          </div>

        )}

      </section>
      )}

      {/* =====================================================
   {/* =====================================================
    DASHBOARD
===================================================== */}

<section id="dashboard" className="dashboard-section">

  <div className="dashboard-container">

    <div className="dashboard-header">

      <p className="dashboard-label">
        ROADGUARD AI ANALYTICS
      </p>

      <h2>
        Detection Dashboard
      </h2>

      <p>
        Monitor your latest pothole detection and
        road-analysis results.
      </p>

    </div>


    <div className="dashboard-cards">

      {/* TOTAL POTHOLES */}

      <div className="dashboard-card">

        <div className="dashboard-card-icon">
          🕳️
        </div>

        <div>

          <h3>
            Total Potholes
          </h3>

          <strong>
            {
              result &&
              result.detections
                ? result.detections.length
                : 0
            }
          </strong>

          <span>
            Latest detection
          </span>

        </div>

      </div>


      {/* HIGH SEVERITY */}

      <div className="dashboard-card">

        <div className="dashboard-card-icon">
          ⚠️
        </div>

        <div>

          <h3>
            High Severity
          </h3>

          <strong>
            {
              result &&
              result.detections
                ? result.detections.filter(
                    (item) =>
                      item.severity === "High"
                  ).length
                : 0
            }
          </strong>

          <span>
            Detected cases
          </span>

        </div>

      </div>


      {/* AVERAGE CONFIDENCE */}

      <div className="dashboard-card">

        <div className="dashboard-card-icon">
          📊
        </div>

        <div>

          <h3>
            Average Confidence
          </h3>

          <strong>

            {
              result &&
              result.detections &&
              result.detections.length > 0

                ? (

                    result.detections.reduce(
                      (sum, item) =>
                        sum +
                        Number(
                          item.confidence || 0
                        ),
                      0
                    )

                    /

                    result.detections.length

                  ).toFixed(1)

                : "0.0"
            }%

          </strong>

          <span>
            AI confidence
          </span>

        </div>

      </div>


      {/* GPS */}

      <div className="dashboard-card">

        <div className="dashboard-card-icon">
          📍
        </div>

        <div>

          <h3>
            GPS Status
          </h3>

          <strong>
            {location ? "Active" : "Waiting"}
          </strong>

          <span>
            Location tracking
          </span>

        </div>

      </div>

    </div>


    {/* =================================================
        SEVERITY OVERVIEW
    ================================================= */}

    <div className="dashboard-analysis">

      <div className="analysis-box">

        <h3>
          Severity Overview
        </h3>


        <div className="severity-row">

          <span>
            🟢 Low
          </span>

          <strong>

            {
              result &&
              result.detections

                ? result.detections.filter(
                    (item) =>
                      item.severity === "Low"
                  ).length

                : 0
            }

          </strong>

        </div>


        <div className="severity-row">

          <span>
            🟡 Medium
          </span>

          <strong>

            {
              result &&
              result.detections

                ? result.detections.filter(
                    (item) =>
                      item.severity === "Medium"
                  ).length

                : 0
            }

          </strong>

        </div>


        <div className="severity-row">

          <span>
            🔴 High
          </span>

          <strong>

            {
              result &&
              result.detections

                ? result.detections.filter(
                    (item) =>
                      item.severity === "High"
                  ).length

                : 0
            }

          </strong>

        </div>

      </div>


      {/* =================================================
          CURRENT ANALYSIS
      ================================================= */}

      <div className="analysis-box">

        <h3>
          Current Analysis
        </h3>


        <p>

          {
            result &&
            result.detections &&
            result.detections.length > 0

              ? `RoadGuard AI detected ${
                  result.detections.length
                } pothole${
                  result.detections.length > 1
                    ? "s"
                    : ""
                } in the latest image analysis.`

              : "No pothole detection is available yet."
          }

        </p>


        <p>

          {
            location

              ? "GPS location is available for this analysis."

              : "GPS location is not currently available."
          }

        </p>

      </div>

    </div>

  </div>

</section>
      {/* =====================================================
          ROAD VIDEO DETECTION
      ===================================================== */}
    {showDetection && (
      <section
        className="detect-section"
        id="video"
      >

        <div className="section-heading">

          <div className="badge">
            VIDEO ANALYSIS
          </div>


          <h2>

            Analyze a{" "}

            <span>
              Road Video
            </span>

          </h2>


          <p>

            Upload a road video and let RoadGuard AI
            analyze selected video frames for potholes.

          </p>

        </div>


        <div className="detector-container">


          {/* VIDEO UPLOAD */}

          <div className="upload-card">

            <div className="upload-icon">
              🎥
            </div>


            <h3>
              Upload Road Video
            </h3>


            <p>
              MP4, AVI, MOV or MKV
            </p>


            <label
              className="upload-button"
            >

              Choose Video

              <input

                type="file"

                accept="video/mp4,video/avi,video/quicktime,video/x-matroska"

                onChange={
                  handleVideoChange
                }

              />

            </label>


            {selectedVideo && (

              <p className="file-name">

                Selected:{" "}

                {selectedVideo.name}

              </p>

            )}


            <button

              className="detect-button"

              onClick={
                detectRoadVideo
              }

              disabled={
                videoLoading
              }

            >

              {videoLoading
                ? "Analyzing Video..."
                : "🎥 Analyze Road Video"}

            </button>


            {videoError && (

              <div className="error">

                {videoError}

              </div>

            )}

          </div>


          {/* VIDEO PREVIEW */}

          <div className="preview-card">

            <h3>

              {videoResult
                ? "AI Processed Video"
                : "Video Preview"}

            </h3>


            {videoResult && videoResult.result_video ? (

  <div className="processed-video-container">

    <video
      key={videoResult.result_video}
      controls
      playsInline
      preload="metadata"
      className="preview-image"
      src={`${API_URL}${videoResult.result_video}`}
      onLoadedMetadata={(e) => {
        console.log(
          "Processed video loaded:",
          e.currentTarget.videoWidth,
          "x",
          e.currentTarget.videoHeight
        );
      }}
      onError={(e) => {
        console.error(
          "Processed video playback error:",
          e
        );
      }}
    >
      Your browser does not support video playback.
    </video>

    <div className="video-actions">

      <a
        href={`${API_URL}${videoResult.result_video}`}
        target="_blank"
        rel="noopener noreferrer"
        className="map-button"
      >
        ▶ Open Processed Video
      </a>

      <a
        href={`${API_URL}${videoResult.result_video}`}
        download
        className="map-button"
      >
        ⬇ Download Processed Video
      </a>

    </div>

  </div>

) : videoPreview ? (

  <video
    controls
    playsInline
    preload="metadata"
    className="preview-image"
    src={videoPreview}
  >
    Your browser does not support video playback.
  </video>

) : (

              <div className="empty-preview">

                <span>
                  🎥
                </span>

                <p>
                  Your road video
                  will appear here
                </p>

              </div>

            )}

          </div>

        </div>

{/* =================================================
    IMPROVED VIDEO RESULTS
================================================= */}

{videoResult && videoResult.success && (
  <div className="video-result-card">

    {/* =================================================
        VIDEO RESULT HEADER
    ================================================= */}

    <div className="video-result-header">

      <div className="video-result-title">

        <span className="result-badge">
          AI VIDEO ANALYSIS
        </span>

        <h2>Road Damage Detection Results</h2>

        <p>
          RoadGuard AI analyzed your uploaded road video
          using the YOLO pothole detection model.
        </p>

      </div>

      <div className="video-detection-count">

        <strong>
          {videoResult.total_detections}
        </strong>

        <span>
          Potholes
        </span>

      </div>

    </div>


    {/* =================================================
        PROCESSED VIDEO
    ================================================= */}

    {videoResult.result_video && (

      <div className="processed-video-section">

        <div className="processed-video-title">

          <span>🎬</span>

          <div>

            <h3>Processed Video</h3>

            <p>
              Detected potholes are highlighted in the
              analyzed video.
            </p>

          </div>

        </div>


        <div className="processed-video-container">

          <video
            key={videoResult.result_video}
            controls
            playsInline
            preload="metadata"
            src={`${API_URL}${videoResult.result_video}`}
          >
            Your browser does not support video playback.
          </video>

        </div>


        <div className="video-actions">

          <a
            href={`${API_URL}${videoResult.result_video}`}
            target="_blank"
            rel="noreferrer"
            className="video-action-button"
          >
            ▶ Open Processed Video
          </a>


          <a
            href={`${API_URL}${videoResult.result_video}`}
            download
            className="video-action-button secondary"
          >
            ⬇ Download Result
          </a>

        </div>

      </div>

    )}


    {/* =================================================
        VIDEO METRICS
    ================================================= */}

    <div className="video-statistics">

      <div className="statistics-heading">

        <span>📊</span>

        <div>

          <h3>Video Analysis Summary</h3>

          <p>
            Detailed information about the AI analysis.
          </p>

        </div>

      </div>


      <div className="statistics-grid">


        {/* TOTAL FRAMES */}

        <div className="stat-card">

          <div className="stat-icon">
            🎞️
          </div>

          <div className="stat-content">

            <span>
              Total Video Frames
            </span>

            <strong>
              {videoResult.total_frames}
            </strong>

            <small>
              Frames present in uploaded video
            </small>

          </div>

        </div>


        {/* FRAMES ANALYZED */}

        <div className="stat-card">

          <div className="stat-icon">
            🔍
          </div>

          <div className="stat-content">

            <span>
              Frames Analyzed
            </span>

            <strong>
              {videoResult.processed_frames}
            </strong>

            <small>
              {videoResult.analysis_percentage}% of video analyzed
            </small>

          </div>

        </div>


        {/* FRAMES WITH POTHOLES */}

        <div className="stat-card">

          <div className="stat-icon">
            🕳️
          </div>

          <div className="stat-content">

            <span>
              Frames With Potholes
            </span>

            <strong>
              {videoResult.frames_with_potholes}
            </strong>

            <small>
              Frames where potholes were detected
            </small>

          </div>

        </div>


        {/* TOTAL DETECTIONS */}

        <div className="stat-card">

          <div className="stat-icon">
            🎯
          </div>

          <div className="stat-content">

            <span>
              Total Detections
            </span>

            <strong>
              {videoResult.total_detections}
            </strong>

            <small>
              Total potholes detected
            </small>

          </div>

        </div>


        {/* DETECTION RATE */}

        <div className="stat-card">

          <div className="stat-icon">
            📊
          </div>

          <div className="stat-content">

            <span>
              Detection Rate
            </span>

            <strong>
              {videoResult.detection_rate}%
            </strong>

            <small>
              Analyzed frames containing potholes
            </small>

          </div>

        </div>


        {/* ANALYSIS COVERAGE */}

        <div className="stat-card">

          <div className="stat-icon">
            📈
          </div>

          <div className="stat-content">

            <span>
              Analysis Coverage
            </span>

            <strong>
              {videoResult.analysis_percentage}%
            </strong>

            <small>
              Percentage of total video analyzed
            </small>

          </div>

        </div>


        {/* AVERAGE CONFIDENCE */}

        <div className="stat-card">

          <div className="stat-icon">
            🤖
          </div>

          <div className="stat-content">

            <span>
              Average Confidence
            </span>

            <strong>
              {videoResult.average_confidence_percentage}%
            </strong>

            <small>
              Average YOLO detection confidence
            </small>

          </div>

        </div>


        {/* HIGHEST CONFIDENCE */}

        <div className="stat-card">

          <div className="stat-icon">
            ⭐
          </div>

          <div className="stat-content">

            <span>
              Highest Confidence
            </span>

            <strong>
              {videoResult.highest_confidence_percentage}%
            </strong>

            <small>
              Highest confidence among detections
            </small>

          </div>

        </div>


        {/* FPS */}

        <div className="stat-card">

          <div className="stat-icon">
            🎬
          </div>

          <div className="stat-content">

            <span>
              Video FPS
            </span>

            <strong>
              {videoResult.fps}
            </strong>

            <small>
              Original video frame rate
            </small>

          </div>

        </div>


        {/* DURATION */}

        <div className="stat-card">

          <div className="stat-icon">
            ⏱️
          </div>

          <div className="stat-content">

            <span>
              Video Duration
            </span>

            <strong>
              {videoResult.video_duration} sec
            </strong>

            <small>
              Duration of uploaded video
            </small>

          </div>

        </div>


        {/* FRAME INTERVAL */}

        <div className="stat-card">

          <div className="stat-icon">
            🔄
          </div>

          <div className="stat-content">

            <span>
              Frame Interval
            </span>

            <strong>
              1 / {videoResult.frame_interval}
            </strong>

            <small>
              One frame analyzed at this interval
            </small>

          </div>

        </div>


        {/* MODEL */}

        <div className="stat-card">

          <div className="stat-icon">
            🧠
          </div>

          <div className="stat-content">

            <span>
              Detection Model
            </span>

            <strong>
              YOLO
            </strong>

            <small>
              AI object detection model
            </small>

          </div>

        </div>

      </div>

    </div>


    {/* =================================================
        SEVERITY
    ================================================= */}

    <div className="video-severity-section">

      <div className="severity-heading">

        <span>⚠️</span>

        <div>

          <h3>
            Highest Visual Severity
          </h3>

          <p>
            Based on detected pothole regions in
            analyzed video frames.
          </p>

        </div>

      </div>


      <div className="severity-result">

        <div className="severity-main">

          <span className="severity-icon">
            ⚠️
          </span>

          <div>

            <small>
              Overall Severity
            </small>

            <strong>
              {videoResult.highest_severity || "Low"}
            </strong>

          </div>

        </div>

      </div>


      <div className="severity-breakdown">

        <h4>
          Severity Breakdown
        </h4>


        <div className="severity-grid">


          <div className="severity-item low">

            <span>
              Low
            </span>

            <strong>
              {videoResult.severity_counts?.Low || 0}
            </strong>

          </div>


          <div className="severity-item medium">

            <span>
              Medium
            </span>

            <strong>
              {videoResult.severity_counts?.Medium || 0}
            </strong>

          </div>


          <div className="severity-item high">

            <span>
              High
            </span>

            <strong>
              {videoResult.severity_counts?.High || 0}
            </strong>

          </div>

        </div>

      </div>

    </div>


    {/* =================================================
        SUCCESS MESSAGE
    ================================================= */}

    <div className="video-success-message">

      <div className="success-icon">
        ✓
      </div>

      <div>

        <h3>
          Pothole Detection Completed
        </h3>

        <p>

          RoadGuard AI detected{" "}

          <strong>
            {videoResult.total_detections}
          </strong>{" "}

          pothole detection
          {videoResult.total_detections !== 1
            ? "s"
            : ""}{" "}

          across{" "}

          <strong>
            {videoResult.frames_with_potholes}
          </strong>{" "}

          analyzed frame
          {videoResult.frames_with_potholes !== 1
            ? "s"
            : ""}.

        </p>

      </div>

    </div>

  </div>
)}


  </section>
    )}


           



              
        {/* =====================================================
          LIVE CAMERA
        ===================================================== */}
      {showDetection && (
      <section
        className="live-section"
        id="live"
      >

        
        <div className="section-heading">

          <div className="badge">
            REAL-TIME MONITORING
          </div>


          <h2>

            Live{" "}

            <span>
              Road Detection
            </span>

          </h2>


          <p>

            Use your device camera to analyze
            road conditions in near real-time.

          </p>

        </div>


        <div className="live-container">


          {/* CAMERA CARD */}

          <div className="camera-card">

            <h3>
              📷 Road Camera
            </h3>


            <div className="camera-wrapper">

              <video

                ref={videoRef}

                autoPlay

                playsInline

                muted

                className="camera-video"

                style={{
                  display:
                    cameraActive
                      ? "block"
                      : "none"
                }}

              ></video>


              {!cameraActive && (

                <div className="camera-placeholder">

                  <span>
                    📷
                  </span>

                  <p>
                    Camera is not active
                  </p>

                </div>

              )}

            </div>


            <canvas

              ref={canvasRef}

              style={{
                display: "none"
              }}

            ></canvas>


            <div className="camera-controls">


              {!cameraActive ? (

                <button

                  className="camera-button"

                  onClick={
                    startCamera
                  }

                >

                  📷 Start Camera

                </button>

              ) : (

                <button

                  className="camera-button stop"

                  onClick={
                    stopCamera
                  }

                >

                  ⛔ Stop Camera

                </button>

              )}


              {cameraActive && (

                <>

                  {!aiDetectionActive ? (

                    <button

                      className="camera-button"

                      onClick={
                        startLiveDetection
                      }

                    >

                      🤖 Start AI Detection

                    </button>

                  ) : (

                    <button

                      className="camera-button stop"

                      onClick={
                        stopLiveDetection
                      }

                    >

                      ⏹ Stop AI Detection

                    </button>

                  )}

                </>

              )}

            </div>


            {cameraActive && (

              <div className="live-status">

                🟢 Camera is active

              </div>

            )}


            {aiDetectionActive && (

              <div className="live-status">

                🤖 AI detection is running

                {liveLoading &&
                  " — analyzing frame..."}

              </div>

            )}

            {/* ADAS CONTROLS & CALIBRATION */}
            <div className="adas-control-bar">
              <button
                type="button"
                className={`adas-toggle-btn calibration ${showCalibration ? 'active' : ''}`}
                onClick={() => setShowCalibration(!showCalibration)}
                title="Adjust Dashcam Mount Height & Angle"
              >
                ⚙️ ADAS Calibration
              </button>
            </div>

            {showCalibration && (
              <div className="calibration-panel">
                <h4>📐 Dashcam Calibration</h4>
                <div className="calib-item">
                  <div className="calib-label">
                    <span>Mount Height:</span>
                    <strong>{cameraHeight.toFixed(1)} m</strong>
                  </div>
                  <input
                    type="range"
                    min="0.8"
                    max="2.5"
                    step="0.1"
                    value={cameraHeight}
                    onChange={(e) => setCameraHeight(parseFloat(e.target.value))}
                  />
                </div>
                <div className="calib-item">
                  <div className="calib-label">
                    <span>Pitch Angle (Down):</span>
                    <strong>{cameraPitch.toFixed(1)}°</strong>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="20"
                    step="0.5"
                    value={cameraPitch}
                    onChange={(e) => setCameraPitch(parseFloat(e.target.value))}
                  />
                </div>
                <div className="calib-item">
                  <div className="calib-label">
                    <span>Vehicle Speed:</span>
                    <strong>{vehicleSpeed} km/h</strong>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="120"
                    step="5"
                    value={vehicleSpeed}
                    onChange={(e) => setVehicleSpeed(parseInt(e.target.value, 10))}
                  />
                </div>
              </div>
            )}


            {cameraError && (

              <div className="error">

                {cameraError}

              </div>

            )}

          </div>


          {/* LIVE AI RESULT */}

          <div className="live-result-card">

            <h3>
              🤖 Live AI Analysis
            </h3>


            {liveResultImage && (

              <div className="live-result-image-container">

                <img

                  src={liveResultImage}

                  alt="Latest live AI detection"

                  className="live-result-image"

                />

              </div>

            )}


            {!liveDetection ? (

              <div className="live-empty">

                <span>
                  🔍
                </span>

                <p>

                  Start AI Detection to
                  analyze camera frames.

                </p>

              </div>

            ) : (

              <>

                {/* LIVE ADVANCE WARNING BANNER */}
                {liveDetection.advance_warning && liveDetection.advance_warning.has_hazard && (
                  <div className={`advance-warning-card ${liveDetection.advance_warning.alert_level ? liveDetection.advance_warning.alert_level.toLowerCase() : 'info'}`}>
                    <div className="warning-card-header">
                      <span className="warning-card-icon">
                        {liveDetection.advance_warning.alert_level === 'CRITICAL' ? '🚨' : '⚠️'}
                      </span>
                      <div>
                        <h4>{liveDetection.advance_warning.alert_title}</h4>
                        <p>{liveDetection.advance_warning.alert_message}</p>
                      </div>
                    </div>
                    <div className="warning-card-pills">
                      {liveDetection.advance_warning.closest_distance_m && (
                        <span className="pill distance-pill">
                          📍 {liveDetection.advance_warning.closest_distance_m}m
                        </span>
                      )}
                      {liveDetection.advance_warning.lane_position && (
                        <span className="pill lane-pill">
                          🛣️ {liveDetection.advance_warning.lane_position}
                        </span>
                      )}
                      {liveDetection.advance_warning.time_to_impact_s && (
                        <span className="pill tti-pill">
                          ⏱️ TTI: {liveDetection.advance_warning.time_to_impact_s}s
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div className="live-count">

                  <strong>

                    {liveDetection.count}

                  </strong>

                  <span>
                    Potholes Detected
                  </span>

                </div>


                {liveDetection.overall_severity &&
                liveDetection.overall_severity !== "None" && (

                  <div className="severity-box">

                    <span>
                      Current Severity
                    </span>

                    <strong>

                      {
                        liveDetection
                          .overall_severity
                      }

                    </strong>

                  </div>

                )}


                {liveDetection.count === 0 ? (

                  <div className="no-detection">

                    <span>
                      ✓
                    </span>

                    <h3>
                      No pothole detected
                    </h3>

                    <p>

                      The latest camera frame
                      did not contain a detected pothole.

                    </p>

                  </div>

                ) : (

                  <div className="detections">

                    {liveDetection.detections.map(

                      (detection, index) => (

                        <div

                          className="detection-item"

                          key={index}

                        >

                          <div>

                            <strong>

                              Pothole{" "}
                              {index + 1}

                            </strong>


                            <p>

                              Confidence:{" "}

                              {(
                                detection.confidence *
                                100
                              ).toFixed(1)}

                              %

                            </p>


                            {detection.severity && (

                              <p>

                                Severity:{" "}

                                <strong>

                                  {
                                    detection
                                      .severity
                                      .severity
                                  }

                                </strong>

                              </p>

                            )}

                            {detection.distance && (
                              <div className="live-dist-info">
                                <span className={`dist-badge ${detection.distance.warning_level?.toLowerCase()}`}>
                                  📏 {detection.distance.distance_m}m • {detection.distance.lane_position}
                                </span>
                              </div>
                            )}

                          </div>


                          <div className="confidence">

                            {(
                              detection.confidence *
                              100
                            ).toFixed(1)}

                            %

                          </div>

                        </div>

                      )

                    )}

                  </div>

                )}

              </>

            )}

          </div>

        </div>

        

      </section>
      )}


      {/* =====================================================
          ABOUT
      ===================================================== */}

      <section
        className="about"
        id="about"
      >

        <div className="badge">
          ABOUT ROADGUARD AI
        </div>


        <h2>

          AI for{" "}

          <span>
            Safer Roads
          </span>

        </h2>


        <p>

          RoadGuard AI is designed to assist
          in identifying road damage using
          computer vision and deep learning.
          The system analyzes road images,
          road videos and camera frames to
          identify potential potholes automatically.

        </p>


        <div className="features">


          <div className="feature">

            <span>
              🤖
            </span>

            <h3>
              AI Detection
            </h3>

            <p>
              YOLO-based object detection.
            </p>

          </div>


          <div className="feature">

            <span>
              ⚡
            </span>

            <h3>
              Fast Analysis
            </h3>

            <p>
              Automatic image and video processing.
            </p>

          </div>


          <div className="feature">

            <span>
              📊
            </span>

            <h3>
              Severity Analysis
            </h3>

            <p>
              Visual severity estimation.
            </p>

          </div>


          <div className="feature">

            <span>
              📍
            </span>

            <h3>
              Location Detection
            </h3>

            <p>
              GPS coordinates for road damage.
            </p>

          </div>


          <div className="feature">

            <span>
              📷
            </span>

            <h3>
              Live Monitoring
            </h3>

            <p>
              Camera-based road monitoring.
            </p>

          </div>


          <div className="feature">

            <span>
              🎥
            </span>

            <h3>
              Road Video Analysis
            </h3>

            <p>
              YOLO analysis of road video frames.
            </p>

          </div>


        </div>

      </section>


      {/* =====================================================
          FOOTER
      ===================================================== */}

      <footer>

        <p>

          © 2026 RoadGuard AI •
          AI-Powered Road Damage Detection

        </p>

      </footer>


    </div>

  );

}


export default App;