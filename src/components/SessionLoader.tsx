import React, { useState, useEffect } from "react";

export interface MouseEventData {
  type: "mouseDown" | "mouseUp" | "mouseMove";
  time: number;
  x: number;
  y: number;
  url: string;
  sessionId: string;
}

export interface SessionData {
  sessionId: string;
  startTime: number;
  endTime: number;
  videoUrl: string;
  mouseEvents: MouseEventData[];
  windowDimensions: {
    width: number;
    height: number;
  };
}

interface SessionLoaderProps {
  onSessionLoaded: (session: SessionData) => void;
  sessionId?: string; // Optional - can be provided via props or URL
}

const SessionLoader: React.FC<SessionLoaderProps> = ({ onSessionLoaded, sessionId: providedSessionId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSession = () => {
      try {
        // First try to get sessionId from URL params
        const urlParams = new URLSearchParams(window.location.search);
        const urlSessionId = urlParams.get('sessionId');

        // Use provided sessionId, URL sessionId, or try to find the latest session
        const sessionId = providedSessionId || urlSessionId;

        if (sessionId) {
          // Load specific session
          const sessionData = localStorage.getItem(`sessionData_${sessionId}`);
          if (sessionData) {
            const parsedSession = JSON.parse(sessionData);
            onSessionLoaded(parsedSession);
            setLoading(false);
            return;
          }
          throw new Error(`Session ${sessionId} not found`);
        } else {
          // Find the latest session if no specific session requested
          const sessions = Object.keys(localStorage)
            .filter(key => key.startsWith('sessionData_'))
            .map(key => {
              const data = JSON.parse(localStorage.getItem(key) || '{}');
              return {
                key,
                startTime: data.startTime || 0
              };
            })
            .sort((a, b) => b.startTime - a.startTime);

          if (sessions.length > 0) {
            const latestSessionData = localStorage.getItem(sessions[0].key);
            if (latestSessionData) {
              const parsedSession = JSON.parse(latestSessionData);
              onSessionLoaded(parsedSession);
              setLoading(false);
              return;
            }
          }
          throw new Error('No sessions found');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load session data');
        setLoading(false);
      }
    };

    loadSession();
  }, [onSessionLoaded, providedSessionId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2">Loading session data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-md">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return null;
};

export default SessionLoader;
