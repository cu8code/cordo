import React, { useState, useEffect } from "react";

export interface SessionData {
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

interface SessionLoaderProps {
  onSessionLoaded: (session: SessionData) => void;
}

const SessionLoader: React.FC<SessionLoaderProps> = ({ onSessionLoaded }) => {
  const [loading, setLoading] = useState(true);

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
