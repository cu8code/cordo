import React, { useState, useEffect } from "react";

export interface SessionData {
  startTime: number;
  endTime: number;
  videoUrl: string;
  mouseEvents: Array<{
    type: "mouseDown" | "mouseUp" | "mouseMove";
    time: number;
    x: number;
    y: number;
  }>;
  windowDimensions: { width: number; height: number };
}

interface SessionLoaderProps {
  onSessionLoaded: (session: SessionData) => void;
}

const SessionLoader: React.FC<SessionLoaderProps> = ({ onSessionLoaded }) => {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sessionData = localStorage.getItem("sessionData");
    if (sessionData) {
      const parsedSession = JSON.parse(sessionData);
			console.log(parsedSession)
      onSessionLoaded(parsedSession);
    }
    setLoading(false);
  }, [onSessionLoaded]);

  if (loading) {
    return <div>Loading session data...</div>;
  }

  return null;
};

export default SessionLoader;
