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
	createCroppedVideoScene,
    applyEffectToCamera,
    type Effect,
    buildEffect,
} from "~utils";
import type { SessionData } from "./SessionLoader";


interface CanvasProps {
	session: SessionData | null;
	isPlaying: boolean;
	currentTime: number;
	onDurationChange: (duration: number) => void;
	onTimeUpdate: (currentTime: number) => void;
}


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



const useVideoPlayback = (
  session: SessionData,
  isPlaying: boolean,
  onTimeUpdate: (time: number) => void
) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoCurrentTimeRef = useRef(0); // Track the current time internally

  // Initialize video element
  useEffect(() => {
    if (session) {
      const video = document.createElement("video");
      video.src = session.videoUrl;
      video.crossOrigin = "anonymous";
      video.loop = true;
      video.muted = true;
      videoRef.current = video;

      // Cleanup
      return () => {
        video.pause();
        video.removeAttribute("src");
      };
    }
  }, [session]);

  // Handle play/pause
  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.play();
        console.log("Video playback started.");
      } else {
        videoRef.current.pause();
        console.log("Video playback paused.");
      }
    }
  }, [isPlaying]);

  // Handle timeupdate event
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      const currentVideoTime = video.currentTime; // Use video.currentTime
      if (currentVideoTime !== videoCurrentTimeRef.current) {
        videoCurrentTimeRef.current = currentVideoTime;
        onTimeUpdate(currentVideoTime); // Notify parent component
      }
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
    };
  }, [onTimeUpdate]);

  return videoRef;
};




const useCameraEffects = (
  session: SessionData,
  currentTime: number,
  videoCamera: PerspectiveCamera | null,
  defaultPosition: { x: number; y: number; z: number } | null,
  defaultFOV: number | null,
  croppedDimensions: { width: number; height: number } | null
) => {
  const effectsRef = useRef<Effect[] | null>(null);

  // Load effects when session changes
  useEffect(() => {
    if (session) {
      effectsRef.current = buildEffect(session);
      console.log("Effects loaded:", effectsRef.current);
    }
  }, [session]);

  // Apply effects to the camera
  useEffect(() => {
    if (videoCamera && effectsRef.current?.length && croppedDimensions) {
      applyEffectToCamera(
        effectsRef.current,
        currentTime,
        videoCamera,
        defaultPosition,
        defaultFOV,
        croppedDimensions.width,
        croppedDimensions.height
      );
    }
  }, [currentTime, videoCamera, defaultPosition, defaultFOV, croppedDimensions]);
};


const useRendering = (
  canvasRef: React.RefObject<HTMLCanvasElement>,
  session: SessionData,
  videoRef: React.RefObject<HTMLVideoElement>,
  onDurationChange: (duration: number) => void
) => {
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const videoCameraRef = useRef<PerspectiveCamera | null>(null);
  const defaultPositionRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const defaultFOVRef = useRef<number | null>(null);
  const croppedDimensionsRef = useRef<{ width: number; height: number } | null>(null);
  const animationFrameId = useRef<number | null>(null);

  // Initialize the scene
  useEffect(() => {
    if (!session || !canvasRef.current || !videoRef.current) return;

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

    const video = videoRef.current;
    const videoTexture = new VideoTexture(video);
    videoTexture.minFilter = LinearFilter;
    videoTexture.magFilter = LinearFilter;
    videoTexture.colorSpace = SRGBColorSpace;

    const handleLoadedMetadata = () => {
      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;

      const cropWidth = session.windowDimensions.width;
      const cropHeight = session.windowDimensions.height;
      const cropY = 0;

      // Store cropped dimensions
      croppedDimensionsRef.current = { width: cropWidth, height: cropHeight };

      const { scene: videoScene, camera: videoCamera, defaultPosition, defaultFOV } = createCroppedVideoScene({
        videoTexture,
        videoWidth,
        videoHeight,
        cropWidth,
        cropHeight,
        cropY,
      });

      videoCameraRef.current = videoCamera;
      defaultPositionRef.current = defaultPosition;
      defaultFOVRef.current = defaultFOV;

      const durationInSeconds = (session.endTime - session.startTime) / 1000;

      if (typeof durationInSeconds === "number" && !isNaN(durationInSeconds) && durationInSeconds >= 0) {
        onDurationChange(durationInSeconds);
        console.log("Video metadata loaded. Duration:", durationInSeconds);
      } else {
        console.error("Invalid session duration calculated:", durationInSeconds);
      }

      const animate = () => {
        requestAnimationFrame(animate);
        renderer.render(backgroundScene, backgroundCamera);
        renderer.clearDepth();
        renderer.render(videoScene, videoCamera);
      };
      animate();

      console.log("Video camera initialized:", videoCamera);
      console.log("Default camera position:", defaultPosition);
      console.log("Default FOV:", defaultFOV);
      console.log("Cropped video dimensions:", croppedDimensionsRef.current);
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);

    // Cleanup
    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.pause();
      video.removeAttribute("src");
      renderer.dispose();
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }

      console.log("Rendering cleanup complete.");
    };
  }, [session, onDurationChange, canvasRef, videoRef]);

  const onResize = useCallback(() => {
    if (!canvasRef.current || !rendererRef.current) return;

    const container = canvasRef.current.parentElement;
    if (!container) return;

    const { width, height } = calculateCanvasSize(container);
    rendererRef.current.setSize(width, height);
    rendererRef.current.setPixelRatio(window.devicePixelRatio);

    if (videoCameraRef.current) {
      videoCameraRef.current.aspect = width / height;
      videoCameraRef.current.updateProjectionMatrix();
      console.log("Canvas resized. New camera projection matrix:", videoCameraRef.current.projectionMatrix);
    }
  }, []);

  // Handle window resize
  useEffect(() => {
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, [onResize]);

  return { videoCameraRef, defaultPositionRef, defaultFOVRef, croppedDimensionsRef };
};

const Canvas: React.FC<CanvasProps> = ({
  session,
  isPlaying,
  currentTime,
  onDurationChange,
  onTimeUpdate,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Handle video playback
  const videoRef = useVideoPlayback(session, isPlaying, onTimeUpdate);

  // Handle rendering
  const { videoCameraRef, defaultPositionRef, defaultFOVRef, croppedDimensionsRef } = useRendering(
    canvasRef,
    session,
    videoRef,
    onDurationChange
  );

  // Handle camera effects
  useCameraEffects(
    session,
    currentTime,
    videoCameraRef.current,
    defaultPositionRef.current,
    defaultFOVRef.current,
    croppedDimensionsRef.current
  );

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

export default Canvas;
