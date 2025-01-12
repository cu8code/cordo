import React, { useState, useEffect, useRef } from "react";

interface MouseEventData {
    type: "mouseDown" | "mouseUp" | "mouseMove";
    time: Date;
    x: number;
    y: number;
}

export default function Page() {
    const [stream, setStream] = useState<MediaRecorder | null>(null);
    const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
    const mouseEvents = useRef<MouseEventData[]>([]);
    const injectedTabs = useRef<Set<number>>(new Set());
    const recordedChunks = useRef<Blob[]>([]);
    const sessionStartTime = useRef<Date | null>(null);
    const sessionEndTime = useRef<Date | null>(null);
    const lastEventTime = useRef<number>(0);
    const windowDimensions = useRef<{ width: number; height: number } | null>(null);

    const injectScript = (tabId: number) => {
        if (injectedTabs.current.has(tabId)) return;

        chrome.scripting.executeScript(
            {
                target: { tabId: tabId },
                func: () => {
                    const handleMouseDown = (event: MouseEvent) => {
                        const clickTime = new Date();
                        const { clientX, clientY } = event;
                        chrome.runtime.sendMessage({
                            type: "mouseDown",
                            time: clickTime,
                            x: clientX,
                            y: clientY,
                        });
                    };

                    const handleMouseUp = (event: MouseEvent) => {
                        const clickTime = new Date();
                        const { clientX, clientY } = event;
                        chrome.runtime.sendMessage({
                            type: "mouseUp",
                            time: clickTime,
                            x: clientX,
                            y: clientY,
                        });
                    };

                    const handleMouseMove = (event: MouseEvent) => {
                        const moveTime = new Date();
                        const { clientX, clientY } = event;
                        chrome.runtime.sendMessage({
                            type: "mouseMove",
                            time: moveTime,
                            x: clientX,
                            y: clientY,
                        });
                    };

                    window.addEventListener("mousedown", handleMouseDown);
                    window.addEventListener("mouseup", handleMouseUp);
                    window.addEventListener("mousemove", handleMouseMove);

                    return () => {
                        window.removeEventListener("mousedown", handleMouseDown);
                        window.removeEventListener("mouseup", handleMouseUp);
                        window.removeEventListener("mousemove", handleMouseMove);
                    };
                },
            },
            (result) => {
                if (!chrome.runtime.lastError) {
                    injectedTabs.current.add(tabId);
                }
            }
        );
    };

    useEffect(() => {
        const handleTabUpdate = (tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => {
            if (tab.active) {
                injectScript(tabId);
            }
        };

        const handleTabActivated = (activeInfo: chrome.tabs.TabActiveInfo) => {
            injectScript(activeInfo.tabId);
        };

        chrome.tabs.onUpdated.addListener(handleTabUpdate);
        chrome.tabs.onActivated.addListener(handleTabActivated);

        return () => {
            chrome.tabs.onUpdated.removeListener(handleTabUpdate);
            chrome.tabs.onActivated.removeListener(handleTabActivated);
        };
    }, []);

    useEffect(() => {
        const handleMessage = (request: MouseEventData) => {
            const now = Date.now();
            if (now - lastEventTime.current >= 300) {
                if (request.type === "mouseDown" || request.type === "mouseUp" || request.type === "mouseMove") {
                    mouseEvents.current.push(request);
                    lastEventTime.current = now;
                }
            }
        };
        chrome.runtime.onMessage.addListener(handleMessage);
        return () => {
            chrome.runtime.onMessage.removeListener(handleMessage);
        };
    }, []);

    useEffect(() => {
        return () => {
            if (stream) {
                stream.stop();
                setStream(null);
            }
            if (mediaStream) {
                mediaStream.getTracks().forEach((track) => track.stop());
                setMediaStream(null);
            }
        };
    }, [stream, mediaStream]);

    const handleRecordingStopped = () => {
        sessionEndTime.current = new Date();

        const videoBlob = new Blob(recordedChunks.current, { type: "video/webm" });
        const videoUrl = URL.createObjectURL(videoBlob);

        const sessionData = {
            startTime: sessionStartTime.current,
            endTime: sessionEndTime.current,
            videoUrl: videoUrl,
            mouseEvents: mouseEvents.current,
            windowDimensions: windowDimensions.current
        };

        localStorage.removeItem("sessionData");
        localStorage.setItem("sessionData", JSON.stringify(sessionData));

        chrome.tabs.create({
            url: chrome.runtime.getURL("tabs/editor.html"),
        });
    };

    const handleClick = async () => {
        if (stream) {
            stream.stop();
            setStream(null);
            if (mediaStream) {
                mediaStream.getTracks().forEach((track) => track.stop());
                setMediaStream(null);
            }
            handleRecordingStopped();
            return;
        }

        try {
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

            const mediaRecorder = new MediaRecorder(mediaStream);
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

            sessionStartTime.current = new Date();
            recordedChunks.current = [];
            windowDimensions.current = { width: window.innerWidth, height: window.innerHeight };
            mediaRecorder.start();
        } catch (error) {
            console.error("Error accessing media devices:", error);
        }
    };

    return (
        <div>
            <button className="cursor-pointer" onClick={handleClick}>
                {stream ? "Stop" : "Start"}
            </button>
        </div>
    );
}