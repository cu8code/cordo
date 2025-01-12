import bgimg from "data-base64:~bgimg.png";
import React, { useEffect, useRef, useState } from "react";
import {
  WebGLRenderer,
  VideoTexture,
  SRGBColorSpace,
  LinearFilter,
  PerspectiveCamera,
} from "three";
import { loadTexture, createBackgroundScene, createVideoScene, handleResize, createCroppedVideoScene, easeInOutQuad } from "~utils";

interface SessionData {
  startTime: Date;
  endTime: Date;
  videoUrl: string;
  mouseEvents: Array<{
    type: "mouseDown" | "mouseUp" | "mouseMove";
    time: Date;
    x: number;
    y: number;
  }>;
  windowDimensions: { width: number; height: number };
}

const Editor: React.FC = () => {
  const [session, setSession] = useState<SessionData | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoCameraRef = useRef<PerspectiveCamera | null>(null);
  const zoomAnimationRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const sessionData = localStorage.getItem("sessionData");
    if (sessionData) {
      const parsedSession = JSON.parse(sessionData);
      parsedSession.startTime = new Date(parsedSession.startTime);
      parsedSession.endTime = new Date(parsedSession.endTime);
      parsedSession.mouseEvents = parsedSession.mouseEvents.map((event: any) => ({
        ...event,
        time: new Date(event.time),
      }));
      setSession(parsedSession);
    }
  }, []);

  useEffect(() => {
    if (!session || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const container = canvas.parentElement;

    const { width, height } = calculateCanvasSize(container!);
    canvas.width = width;
    canvas.height = height;

    const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.autoClear = false;
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.outputColorSpace = SRGBColorSpace;

    const backgroundTexture = loadTexture(bgimg);
    backgroundTexture.colorSpace = SRGBColorSpace;

    const { scene: backgroundScene, camera: backgroundCamera } = createBackgroundScene(width, height, backgroundTexture);

    const video = document.createElement("video");
    video.src = session.videoUrl;
    video.crossOrigin = "anonymous";
    video.loop = true;
    video.muted = true;
    video.play();
    videoRef.current = video;

    const videoTexture = new VideoTexture(video);
    videoTexture.minFilter = LinearFilter;
    videoTexture.magFilter = LinearFilter;
    videoTexture.colorSpace = SRGBColorSpace;

    video.addEventListener("loadedmetadata", () => {
      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;
      const videoAspectRatio = videoWidth / videoHeight;

      const cropWidth = session.windowDimensions.width;
      const cropHeight = session.windowDimensions.height;
      const cropY = 0;

      const { scene: videoScene, camera: videoCamera } = createCroppedVideoScene({
        videoTexture,
        videoWidth,
        videoHeight,
        cropWidth,
        cropHeight,
        cropY,
      });

      videoScene.add(videoScene)
      videoCamera.aspect = videoAspectRatio;
      videoCamera.updateProjectionMatrix();

      const animate = () => {
        requestAnimationFrame(animate);
        renderer.render(backgroundScene, backgroundCamera);
        renderer.clearDepth();
        renderer.render(videoScene, videoCamera);
      };
      animate();
    });

    const onResize = () => {
      const { width, height } = calculateCanvasSize(container!);
      renderer.setSize(width, height);
      renderer.setPixelRatio(window.devicePixelRatio);
      backgroundCamera.updateProjectionMatrix();

      if (videoCameraRef.current) {
        const video = videoRef.current!;
        const videoAspectRatio = video.videoWidth / video.videoHeight;
        videoCameraRef.current.aspect = videoAspectRatio;
        videoCameraRef.current.updateProjectionMatrix();
      }
    };
    window.addEventListener("resize", onResize);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "k" && videoCameraRef.current) {
        if (zoomAnimationRef.current) {
          cancelAnimationFrame(zoomAnimationRef.current);
        }

        const startFOV = videoCameraRef.current.fov;
        const targetFOV = startFOV - 10;
        const duration = 1000;
        const startTime = performance.now();

        const animateZoom = (currentTime: number) => {
          const elapsedTime = currentTime - startTime;
          const progress = Math.min(elapsedTime / duration, 1);

          const easedProgress = easeInOutQuad(progress);

          videoCameraRef.current!.fov = startFOV + (targetFOV - startFOV) * easedProgress;
          videoCameraRef.current!.updateProjectionMatrix();

          if (progress < 1) {
            zoomAnimationRef.current = requestAnimationFrame(animateZoom);
          } else {
            zoomAnimationRef.current = null;
          }
        };

        zoomAnimationRef.current = requestAnimationFrame(animateZoom);
      }
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      video.pause();
      video.removeAttribute("src");
      renderer.dispose();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKeyDown);
      if (zoomAnimationRef.current) {
        cancelAnimationFrame(zoomAnimationRef.current);
      }
    };
  }, [session]);

  if (!session) {
    return <div>No session data found.</div>;
  }

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", justifyContent: "center", alignItems: "center" }}>
      <div style={{ width: "75vw", height: "75vh", position: "relative" }}>
        <h1>Recorded Session</h1>
        <p>
          <strong>Start Time:</strong> {session.startTime.toLocaleString()}
        </p>
        <p>
          <strong>End Time:</strong> {session.endTime.toLocaleString()}
        </p>
        <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: "auto",
          aspectRatio: "16/9",
          display: "block",
          margin: "0 auto",
          border: "2px solid black"
        }}
        />
      </div>
    </div>
  );
};

const calculateCanvasSize = (container: HTMLElement) => {
  const containerWidth = container.clientWidth;
  const containerHeight = container.clientHeight;

  const targetRatio = 16 / 9;
  let width = containerWidth;
  let height = width / targetRatio;

  if (height > containerHeight) {
    height = containerHeight;
    width = height * targetRatio;
  }

  return { width, height };
};

export default Editor;
