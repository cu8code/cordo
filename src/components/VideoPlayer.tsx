import React from "react";
import Canvas from "~components/canvas";
import type { SessionData } from "./SessionLoader";

interface VideoPlayerProps {
  session: SessionData;
  isPlaying: boolean;
  currentTime: number;
  onDurationChange: (duration: number) => void;
  onTimeUpdate: (currentTime: number) => void;
  onSeek: (time: number) => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  session,
  isPlaying,
  currentTime,
  onDurationChange,
  onTimeUpdate,
}) => {
  return (
    <div className="p-4 border border-gray-200 rounded-lg shadow-sm bg-white h-full">
      <Canvas
        session={session}
        isPlaying={isPlaying}
        currentTime={currentTime}
        onDurationChange={onDurationChange}
        onTimeUpdate={onTimeUpdate}
      />
    </div>
  );
};

export default VideoPlayer;
