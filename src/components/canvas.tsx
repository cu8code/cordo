import "~style.css";
import bgimg from "data-base64:~bgimg.png";
import React, { useEffect, useRef, useCallback } from "react";
import {
  WebGLRenderer,
  VideoTexture,
  SRGBColorSpace,
  LinearFilter,
  PerspectiveCamera,
} from "three";
import {
  loadTexture,
  createBackgroundScene,
  createVideoScene,
  handleResize,
  createCroppedVideoScene,
  easeInOutQuad,
} from "~utils";

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

interface CanvasProps {
  session: SessionData | null;
  isPlaying: boolean;
  currentTime: number;
  onDurationChange: (duration: number) => void;
  onTimeUpdate: (currentTime: number) => void;
  onSeek: (time: number) => void;
}

const Canvas: React.FC<CanvasProps> = ({
  session,
  isPlaying,
  currentTime,
  onDurationChange,
  onTimeUpdate,
  onSeek,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoCameraRef = useRef<PerspectiveCamera | null>(null);
  const zoomAnimationRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const videoCurrentTimeRef = useRef(0); // Track the video's current time

  // Memoize the resize handler to avoid recreating it on every render
  const onResize = useCallback(() => {
    console.log("onResize triggered");
    if (!canvasRef.current || !rendererRef.current) return;

    const container = canvasRef.current.parentElement;
    if (!container) return;

    const { width, height } = calculateCanvasSize(container);
    rendererRef.current.setSize(width, height);
    rendererRef.current.setPixelRatio(window.devicePixelRatio);

    if (videoCameraRef.current) {
      const video = videoRef.current!;
      const videoAspectRatio = video.videoWidth / video.videoHeight;
      videoCameraRef.current.aspect = videoAspectRatio;
      videoCameraRef.current.updateProjectionMatrix();
    }
  }, []);

  useEffect(() => {
    console.log("useEffect triggered for session and canvas setup");
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
    rendererRef.current = renderer;

    const backgroundTexture = loadTexture(bgimg);
    backgroundTexture.colorSpace = SRGBColorSpace;

    const { scene: backgroundScene, camera: backgroundCamera } = createBackgroundScene(width, height, backgroundTexture);

    const video = document.createElement("video");
    video.src = session.videoUrl;
    video.crossOrigin = "anonymous";
    video.loop = true;
    video.muted = true;
    videoRef.current = video;

    const videoTexture = new VideoTexture(video);
    videoTexture.minFilter = LinearFilter;
    videoTexture.magFilter = LinearFilter;
    videoTexture.colorSpace = SRGBColorSpace;

    video.addEventListener("loadedmetadata", () => {
      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;

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

      videoCameraRef.current = videoCamera;
      videoCamera.updateProjectionMatrix();

      onDurationChange(video.duration);

      const animate = () => {
        requestAnimationFrame(animate);
        renderer.render(backgroundScene, backgroundCamera);
        renderer.clearDepth();
        renderer.render(videoScene, videoCamera);
      };
      animate();
    });

    video.addEventListener("timeupdate", () => {
      const currentVideoTime = video.currentTime;
      if (currentVideoTime !== videoCurrentTimeRef.current) {
        videoCurrentTimeRef.current = currentVideoTime; // Update the ref
        console.log(`Video time updated: ${currentVideoTime}`);
        onTimeUpdate(currentVideoTime); // Call onTimeUpdate only if the time changed naturally
      }
    });

    // Add resize event listener
    window.addEventListener("resize", onResize);

    return () => {
      video.pause();
      video.removeAttribute("src");
      renderer.dispose();
      window.removeEventListener("resize", onResize);
      if (zoomAnimationRef.current) {
        cancelAnimationFrame(zoomAnimationRef.current);
      }
    };
  }, [session, onDurationChange, onTimeUpdate, onResize]);

  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.play();
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying]);

  useEffect(() => {
    if (videoRef.current && Math.abs(videoRef.current.currentTime - currentTime) > 0.1) {
      console.log(`Setting video currentTime to: ${currentTime}`);
      videoRef.current.currentTime = currentTime; // Set the video's current time
      videoCurrentTimeRef.current = currentTime; // Update the ref to match
    }
  }, [currentTime]);

  if (!session) {
    return <div>No session data found.</div>;
  }

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: "100%",
        height: "auto",
        aspectRatio: "16/9",
        display: "block",
        margin: "0 auto",
        border: "2px solid black",
      }}
    />
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

  console.log(`Calculated canvas size: width: ${width}, height: ${height}`);
  return { width, height };
};

export default Canvas;
