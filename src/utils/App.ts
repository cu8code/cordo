import bgimg from "data-base64:~bgimg.png";
import { WebGLRenderer, PerspectiveCamera, Scene, VideoTexture, LinearFilter, SRGBColorSpace, OrthographicCamera } from "three";
import { calculateCanvasSize, createBackgroundScene, createCroppedVideoScene, loadTexture } from "~utils/renderingUtils";
import { buildEffect } from "./effects";
import type { SessionData } from "~components/SessionLoader";
import type { AnimeTimelineInstance } from "animejs";

export interface CustomTimeline extends AnimeTimelineInstance {
  app?: App;
}

export class App {
  currentTime: number;
  primary: {
    camera: PerspectiveCamera;
    scene: Scene;
    defaultFov: number;
    defaultPosition: { x: number; y: number };
  } | null;
  background: { camera: OrthographicCamera; scene: Scene };
  private session: SessionData;
  private video: HTMLVideoElement;
  private timeline: CustomTimeline;
  private isPlaying: boolean;
  private listeners: Map<string, Function[]>;
  private width: number;
  private height: number;
  private renderer: WebGLRenderer;
  private animationFrameId: number | null;

  constructor(video: HTMLVideoElement, session: SessionData, canvas: HTMLCanvasElement) {
    this.video = video;
    this.isPlaying = false;
    this.currentTime = 0;
    this.session = session;
    this.listeners = new Map();
    this.animationFrameId = null;
    this.primary = null;

    this.renderer = this.setupRenderer(canvas);
    this.background = this.setupBackgroundScene();
    this.setupVideoScene();
    this.attachEventListeners();
    console.log(this.session)

    // Chrome bug: https://bugs.chromium.org/p/chromium/issues/detail?id=642012
    this.video.currentTime = Number.MAX_SAFE_INTEGER
    this.video.addEventListener("durationchange", () => {
      if (this.video.duration === Infinity){
        return
      }
      this.video.currentTime = 0
      this.timeline = buildEffect(session, this.primary.defaultFov, this.video.duration * 1000);
      console.log(this.timeline)
      this.timeline.app = this;
      this.video.loop = false
      this.play()
    })
    this.video.addEventListener("ended", this.handleVideoEnd.bind(this));
  }

  private handleVideoEnd(): void {
    this.restartTimeline();
    this.emit("ended");
  }

  restartTimeline(): void {
      if (this.timeline) {
        this.timeline.restart();
        this.timeline.pause();
        this.play()
      }
    }

  private setupRenderer(canvas: HTMLCanvasElement): WebGLRenderer {
    const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.autoClear = false;
    const size = calculateCanvasSize(canvas);
    this.width = size.width;
    this.height = size.height;
    renderer.setSize(this.width, this.height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.outputColorSpace = SRGBColorSpace;
    return renderer;
  }

  private setupBackgroundScene(): { camera: OrthographicCamera; scene: Scene } {
    const backgroundTexture = loadTexture(bgimg);
    return createBackgroundScene(this.width, this.height, backgroundTexture);
  }

  private attachEventListeners(): void {
    this.video.addEventListener("timeupdate", this.onTimeUpdate.bind(this));
    window.addEventListener("resize", this.onResize.bind(this));
  }

  private setupVideoScene(): void {
    const { videoWidth, videoHeight } = this.video;
    const { width: cropWidth, height: cropHeight } = this.session.windowDimensions;
    const videoTexture = new VideoTexture(this.video);
    videoTexture.minFilter = LinearFilter;
    videoTexture.magFilter = LinearFilter;
    videoTexture.colorSpace = SRGBColorSpace;

    const { scene: videoScene, camera: videoCamera, defaultFOV, defaultPosition } = createCroppedVideoScene({
      videoTexture,
      videoWidth,
      videoHeight,
      cropWidth,
      cropHeight,
      cropY: 0,
    });

    this.primary = { camera: videoCamera, scene: videoScene, defaultFov: defaultFOV, defaultPosition };
    this.renderLoop();
  }

  private onTimeUpdate(): void {
    this.currentTime = this.video.currentTime;
    const timelineTime = this.timeline.currentTime;
    const timeDiff = Math.abs(this.currentTime * 1000 - timelineTime);

    if (timeDiff > 50) {
      this.timeline.seek(this.currentTime * 1000);
    }

    this.emit("timeupdate", this.currentTime);
  }

  private onResize(): void {
    const size = calculateCanvasSize(this.renderer.domElement);
    this.width = size.width;
    this.height = size.height;
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(window.devicePixelRatio);

    if (this.primary) {
      this.primary.camera.aspect = this.width / this.height;
      this.primary.camera.updateProjectionMatrix();
    }
  }

  private renderLoop(): void {
    const animate = () => {
      if (!this.isPlaying) return;

      this.renderer.render(this.background.scene, this.background.camera);
      this.renderer.clearDepth();
      if (this.primary) {
        this.renderer.render(this.primary.scene, this.primary.camera);
      }

      this.animationFrameId = requestAnimationFrame(animate);
    };
    animate();
  }

  play(): void {
    this.isPlaying = true;
    this.video.play();
    this.timeline.play()
    this.renderLoop();
    this.emit("play");
  }

  pause(): void {
    this.isPlaying = false;
    this.video.pause();
    this.timeline.pause();
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.emit("pause");
  }

  seek(time: number): void {
    this.currentTime = time;
    this.video.currentTime = time;
    this.timeline.restart()
    this.timeline.seek(time * 1000);
    this.emit("seek", time);
  }

  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event: string, callback: Function): void {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event).filter((cb) => cb !== callback);
      this.listeners.set(event, callbacks);
    }
  }

  private emit(event: string, ...args: any[]): void {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach((callback) => callback(...args));
    }
  }

  cleanup(): void {
    this.video.pause();
    this.video.removeAttribute("src");
    this.renderer.dispose();
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    window.removeEventListener("resize", this.onResize);
  }
}
