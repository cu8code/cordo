import "~style.css";
import React, { useState, useEffect, useRef, useCallback } from "react";

export interface MouseEventData {
  type: "mouseDown" | "mouseUp" | "mouseMove";
  time: Date;
  x: number;
  y: number;
  url: string;
  sessionId: string;
}

interface SessionData {
  sessionId: string;
  startTime: number;
  endTime?: number;
}

const generateSessionId = () => {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

const useMouseEvents = (sessionId: string) => {
  const mouseEvents = useRef<MouseEventData[]>([]);

  const lastEventTimes = useRef<{
    mouseDown: number;
    mouseMove: number;
    mouseUp: number;
  }>({
    mouseDown: 0,
    mouseMove: 0,
    mouseUp: 0,
  });

  const handleMessage = useCallback((request: MouseEventData) => {
    // Only process events from the current session
    if (request.sessionId !== sessionId) {
      return;
    }

    const now = Date.now();

    if ((now - lastEventTimes.current[request.type]) >= 500) {
      mouseEvents.current.push(request);
      lastEventTimes.current[request.type] = now;

      console.log("Mouse Event:", {
        type: request.type,
        time: request.time,
        x: request.x,
        y: request.y,
        url: request.url,
        sessionId: request.sessionId
      });
    }
  }, [sessionId]);

  useEffect(() => {
    chrome.runtime.onMessage.addListener(handleMessage);
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, [handleMessage]);

  return mouseEvents;
};

const useScreenRecording = (mouseEvents: React.MutableRefObject<MouseEventData[]>, sessionId: string) => {
  const [stream, setStream] = useState<MediaRecorder | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const recordedChunks = useRef<Blob[]>([]);
  const sessionStartTime = useRef<number | null>(null);
  const sessionEndTime = useRef<number | null>(null);
  const windowDimensions = useRef<{ width: number; height: number } | null>(null);
  const isRecordingStopped = useRef<boolean>(false);

  const handleRecordingStopped = useCallback(() => {
    if (isRecordingStopped.current) return;
    isRecordingStopped.current = true;

    sessionEndTime.current = Date.now();

    if (recordedChunks.current.length > 0) {
      const videoBlob = new Blob(recordedChunks.current, { type: "video/webm" });
      const videoUrl = URL.createObjectURL(videoBlob);

      const sessionData = {
        sessionId,
        startTime: sessionStartTime.current,
        endTime: sessionEndTime.current,
        videoUrl: videoUrl,
        mouseEvents: mouseEvents.current,
        windowDimensions: windowDimensions.current,
      };

      // Store session data with sessionId as key
      localStorage.setItem(`sessionData_${sessionId}`, JSON.stringify(sessionData));

      chrome.tabs.create({
        url: `${chrome.runtime.getURL("tabs/editor.html")}?sessionId=${sessionId}`,
      });
    } else {
      console.error("No valid chunks were recorded.");
    }
  }, [mouseEvents, sessionId]);

  const startRecording = useCallback(async () => {
    try {
      isRecordingStopped.current = false;
      recordedChunks.current = [];
      sessionStartTime.current = Date.now();

      // Store session start data
      const sessionData: SessionData = {
        sessionId,
        startTime: sessionStartTime.current
      };
      localStorage.setItem(`sessionData_${sessionId}`, JSON.stringify(sessionData));

      const streamId = await new Promise<string>((resolve, reject) => {
        chrome.desktopCapture.chooseDesktopMedia(["screen"], (streamId) => {
          if (streamId) {
            resolve(streamId);
          } else {
            reject(new Error("User canceled screen selection"));
          }
        });
      });

      const constraints: MediaStreamConstraints = {
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: "desktop",
            chromeMediaSourceId: streamId,
          },
        } as any,
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setMediaStream(mediaStream);

      const mediaRecorder = new MediaRecorder(mediaStream, {
        mimeType: "video/webm; codecs=vp9",
      });
      setStream(mediaRecorder);

      mediaStream.getTracks().forEach((track) => {
        track.onended = () => {
          mediaRecorder.stop();
          setStream(null);
          setMediaStream(null);
          handleRecordingStopped();
        };
      });

      mediaRecorder.onstop = () => {
        setStream(null);
        setMediaStream(null);
        handleRecordingStopped();
      };

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunks.current.push(event.data);
        }
      };

      mediaRecorder.start(1000);
      windowDimensions.current = { width: window.innerWidth, height: window.innerHeight };
    } catch (error) {
      console.error("Error accessing media devices:", error);
    }
  }, [handleRecordingStopped]);

  const stopRecording = useCallback(() => {
    if (stream) {
      stream.requestData();
      stream.stop();
      setStream(null);
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
        setMediaStream(null);
      }
    }
  }, [stream, mediaStream]);

  return { stream, startRecording, stopRecording };
};

const useScriptInjection = (sessionId: string) => {
  const injectedTabs = useRef<Set<number>>(new Set());

  const injectScript = useCallback((tabId: number) => {
    if (injectedTabs.current.has(tabId)) {
      console.log("Script already injected for tab:", tabId);
      return;
    }

    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError) {
        console.error("Error getting tab info:", chrome.runtime.lastError);
        return;
      }

      const tabUrl = tab.url;
      console.log(`Injecting script for tab: ${tabId}, URL: ${tabUrl}`);

      chrome.scripting.executeScript(
        {
          target: { tabId: tabId },
          func: (injectedSessionId) => {
            console.log("Script injected. Attaching event listeners...");

            // Store the session ID in the window object
            (window as any).currentSessionId = injectedSessionId;

            const handleMouseEvent = (eventType: string) => (event: MouseEvent) => {
              // Check if this is the current session
              if ((window as any).currentSessionId !== injectedSessionId) {
                return;
              }

              console.log(`${eventType} event:`, event);
              const eventTime = Date.now();
              const { clientX, clientY } = event;
              chrome.runtime.sendMessage({
                type: eventType,
                time: eventTime,
                x: clientX,
                y: clientY,
                url: window.location.href,
                sessionId: injectedSessionId
              });
            };

            const handleMouseDown = handleMouseEvent("mouseDown");
            const handleMouseUp = handleMouseEvent("mouseUp");
            const handleMouseMove = handleMouseEvent("mouseMove");

            window.addEventListener("mousedown", handleMouseDown);
            window.addEventListener("mouseup", handleMouseUp);
            window.addEventListener("mousemove", handleMouseMove);

            return () => {
              console.log("Cleaning up event listeners...");
              window.removeEventListener("mousedown", handleMouseDown);
              window.removeEventListener("mouseup", handleMouseUp);
              window.removeEventListener("mousemove", handleMouseMove);
            };
          },
          args: [sessionId]
        },
        (result) => {
          if (!chrome.runtime.lastError) {
            console.log(`Script successfully injected for tab: ${tabId}, URL: ${tabUrl}`);
            injectedTabs.current.add(tabId);
          } else {
            console.error("Error injecting script:", chrome.runtime.lastError);
          }
        }
      );
    });
  }, [sessionId]);

  useEffect(() => {
    const handleTabChange = (activeInfo: chrome.tabs.TabActiveInfo) => {
      const tabId = activeInfo.tabId;
      if (tabId) {
        injectScript(tabId);
      }
    };

    chrome.tabs.onActivated.addListener(handleTabChange);

    return () => {
      chrome.tabs.onActivated.removeListener(handleTabChange);
    };
  }, [injectScript]);

  useEffect(() => {
    const handleTabCreated = (tab: chrome.tabs.Tab) => {
      const tabId = tab.id;
      if (tabId) {
        injectScript(tabId);
      }
    };

    chrome.tabs.onCreated.addListener(handleTabCreated);

    return () => {
      chrome.tabs.onCreated.removeListener(handleTabCreated);
    };
  }, [injectScript]);

  useEffect(() => {
    const handleTabUpdated = (
      tabId: number,
      changeInfo: chrome.tabs.TabChangeInfo,
      tab: chrome.tabs.Tab
    ) => {
      if (changeInfo.status === "complete" && tab.active) {
        injectScript(tabId);
      }
    };

    chrome.tabs.onUpdated.addListener(handleTabUpdated);

    return () => {
      chrome.tabs.onUpdated.removeListener(handleTabUpdated);
    };
  }, [injectScript]);

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      if (tabId) {
        injectScript(tabId);
      }
    });
  }, [injectScript]);
};

export default function Page() {
  const [sessionId] = useState(() => generateSessionId());
  const mouseEvents = useMouseEvents(sessionId);
  const { stream, startRecording, stopRecording } = useScreenRecording(mouseEvents, sessionId);
  useScriptInjection(sessionId);

  const handleClick = () => {
    if (stream) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <div>
      <button className="cursor-pointer" onClick={handleClick}>
        {stream ? "Stop" : "Start"}
      </button>
      <div className="text-sm text-gray-500 mt-2">
        Session ID: {sessionId}
      </div>
    </div>
  );
}
