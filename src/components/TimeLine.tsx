import React from "react";

interface TimelineProps {
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
}

const Timeline: React.FC<TimelineProps> = ({ currentTime, duration, onSeek }) => {
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    onSeek(time);
  };

  return (
    <div className="flex items-center gap-4 p-4 bg-gray-100 rounded-lg">
      <span>{formatTime(currentTime)}</span>
      <input
        type="range"
        min="0"
        max={duration}
        value={currentTime}
        onChange={handleSeek}
        step="0.1"
        className="flex-1"
      />
      <span>{formatTime(duration)}</span>
    </div>
  );
};

// Helper function to format time (e.g., 65 -> "01:05")
const formatTime = (time: number) => {
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
};

export default Timeline;
