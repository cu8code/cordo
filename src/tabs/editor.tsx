import "~style.css";
import { useEffect, useRef, useState, useCallback } from "react";
import type { SessionData } from "~components/SessionLoader";
import SessionLoader from "~components/SessionLoader";
import { App } from "~utils/App";

let appInstance: App | null = null;

const useVideoPlayback = (session: SessionData | null) => {
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!session) {
      setVideo(null);
      return;
    }

    const videoElement = document.createElement("video");
    videoElement.src = session.videoUrl;
    videoElement.crossOrigin = "anonymous";
    videoElement.loop = true;
    videoElement.muted = true;
    videoElement.playsInline = true;
    setVideo(videoElement);

    return () => {
      videoElement.pause();
      videoElement.removeAttribute("src");
      setVideo(null);
    };
  }, [session]);

  return video;
};

const EffectTimeline = ({ currentTime, duration, app }) => {
  const [effects, setEffects] = useState([]);
  const timelineRef = useRef(null);

  useEffect(() => {
    if (!app?.timeline) return;
    const effectData = app.timeline.children.map((animation: any) => ({
      start: animation.startTime,
      end: animation.startTime + animation.duration
    }));
    setEffects(effectData);
  }, [app]);

  const handleTimelineClick = (e) => {
    if (!timelineRef.current || !duration) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const clickPosition = (e.clientX - rect.left) / rect.width;
    const seekTime = clickPosition * duration;
    app.seek(seekTime);
  };

  return (
    <div className="basis-1/5 bg-gray-50 rounded-xl shadow-sm p-4">
      <div
        ref={timelineRef}
        className="relative h-12 bg-gray-200 rounded-full mt-2 cursor-pointer"
        onClick={handleTimelineClick}
      >
        {effects.map((effect, i) => {
          const startPercent = (effect.start / duration) * 100;
          const widthPercent = ((effect.end - effect.start) / duration) * 100;
          return (
            <div
              key={i}
              className="absolute h-full bg-blue-400 rounded-full opacity-75"
              style={{
                width: `${widthPercent}%`,
                left: `${startPercent}%`
              }}
            />
          );
        })}
        <div
          className="absolute w-1 h-14 bg-red-500 -top-1 -ml-0.5 shadow-lg transition-all duration-100"
          style={{ left: `${(currentTime / duration) * 100}%` }}
        />
      </div>
      <div className="flex justify-between mt-2 text-sm">
        <span>{currentTime.toFixed(1)}s</span>
        <span className="text-gray-500">{duration.toFixed(1)}s</span>
      </div>
    </div>
  );
};

export default function Editor() {
  const [session, setSession] = useState<SessionData | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const video = useVideoPlayback(session);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  useEffect(() => {
    if (video && session && canvasRef.current && !appInstance) {
      appInstance = new App(video, session, canvasRef.current);
      appInstance.on("timeupdate", handleTimeUpdate);
    }

    return () => {
      if (appInstance) {
        appInstance.cleanup();
        appInstance = null;
      }
    };
  }, [video, session, handleTimeUpdate]);

  const isLoading = !session || !video || !canvasRef.current;

  return (
    <>
      <SessionLoader onSessionLoaded={setSession} />
      {isLoading && (
        <div className="flex items-center justify-center h-screen bg-gray-200">
          <p className="text-gray-700">Loading...</p>
        </div>
      )}
      <div className="flex flex-col flex-grow bg-gray-200 p-4 sm:p-6 h-screen space-y-4 sm:space-y-6">
        <div className="flex flex-col md:flex-row flex-grow space-y-4 md:space-y-0 md:space-x-6">
          <div className="basis-full md:basis-4/6 bg-gray-50 rounded-xl shadow-sm">
            <canvas
              ref={canvasRef}
              className="w-full"
              style={{
                height: "auto",
                aspectRatio: "16/9",
                display: "block",
                margin: "0 auto",
              }}
            ></canvas>
          </div>

          <div className="hidden md:flex basis-2/6 bg-gray-100 rounded-xl shadow-sm p-4">
            <p className="text-gray-700">Side Panel</p>
          </div>
        </div>

        <EffectTimeline
          currentTime={currentTime}
          duration={video?.duration || 0}
          app={appInstance}
        />
      </div>
    </>
  );
}
