import "~style.css";
import React, { useCallback, useState } from "react";
import SessionLoader, { type SessionData } from "~components/SessionLoader";
import VideoPlayer from "~components/VideoPlayer";
import TimeLine from "~components/TimeLine";
import OptionMenu from "~components/OptionMenu";

export function Editor() {
  const [session, setSession] = useState<SessionData | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const handleSessionLoaded = useCallback((session: SessionData) => {
    console.log("onResize called");
    setSession(session);

    if (session.startTime instanceof Date && session.endTime instanceof Date) {
      const durationInSeconds = (session.endTime.getTime() - session.startTime.getTime()) / 1000;
      setDuration(durationInSeconds);
    }
  }, []);

  const handleSeek = useCallback((time: number) => {
    console.log("onTimeUpdate called with currentTime:", currentTime);
    setCurrentTime(time);
  }, []);

  const handleDurationChange = useCallback((duration: number) => {
    console.log("onDurationChange called with duration:", duration);
    setDuration(duration);
  }, []);

  return (
    <div className="h-screen w-full flex flex-row gap-4 p-4 bg-gray-50">
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
            <TimeLine
            currentTime={currentTime}
            duration={duration}
            onSeek={handleSeek}
            />
          </div>
          <div className="p-4 border border-gray-200 rounded-lg shadow-sm bg-white h-full basis-1/4">
            <OptionMenu />
          </div>
        </>
      )}
    </div>
  );
}

export default Editor;
