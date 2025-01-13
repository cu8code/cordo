import "~style.css";

import React, { useCallback, useState } from "react";

import SessionLoader, { type SessionData } from "~components/SessionLoader";
import VideoPlayer from "~components/VideoPlayer";

export function Editor() {
  const [session, setSession] = useState<SessionData | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const handleSessionLoaded = useCallback((session: SessionData) => {
    console.log("onResize called");
    setSession(session);

    // Ensure startTime and endTime are valid numbers
    if (typeof session.startTime === "number" && typeof session.endTime === "number") {
      const durationInSeconds = (session.endTime - session.startTime);
      setDuration(durationInSeconds);
    } else {
      console.error("Invalid session timestamps. Expected numbers.");
    }
  }, []);

  const handleSeek = useCallback((time: number) => {
    console.log("onTimeUpdate called with currentTime:", time);
    setCurrentTime(time);
  }, []);

  const handleDurationChange = useCallback((duration: number) => {
    console.log("onDurationChange called with duration:", duration);
    setDuration(duration);
  }, []);

  return (
    <div className="flex flex-row gap-4 p-4 bg-gray-50">
      <SessionLoader onSessionLoaded={handleSessionLoaded} />
      {session && (
        <>
          <div className="flex flex-col h-full w-full basis-3/4 gap-4">
            <VideoPlayer
              session={session}
              isPlaying={isPlaying}
              currentTime={currentTime}
              onDurationChange={handleDurationChange}
              onTimeUpdate={setCurrentTime}
              onSeek={handleSeek}
            />
          </div>
          <div className="flex bg-white rounded basis-1/4">
            <div className="space-y-4 flex m-2 border border-black/10 rounded w-full">
              <ExportButton />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const ExportButton = () => {
  return (
    <button className="m-2 text-white w-full h-10 bg-green-500 rounded">
      Export
    </button>
  );
};

export default Editor;
