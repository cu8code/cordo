import bgimg from "data-base64:~bgimg.png"

import React, { useEffect, useRef, useState } from "react";
import {
    WebGLRenderer,
    VideoTexture,
    SRGBColorSpace,
    LinearFilter,
} from "three";
import { loadTexture, createBackgroundScene, createVideoScene, handleResize } from "~utils";

interface SessionData {
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

const Editor: React.FC = () => {
    const [session, setSession] = useState<SessionData | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

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
            setSession(parsedSession);
        }
    }, []);

    useEffect(() => {
        if (!session || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const container = canvas.parentElement;

        const { width, height } = calculateCanvasSize(container!);
        canvas.width = width;
        canvas.height = height;

        const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true  });
        renderer.autoClear = false
        renderer.setSize(width, height);
        renderer.outputColorSpace = SRGBColorSpace;

        const backgroundTexture = loadTexture(bgimg);
        backgroundTexture.colorSpace = SRGBColorSpace;

        const { scene: backgroundScene, camera: backgroundCamera } = createBackgroundScene(width, height, backgroundTexture);

        const video = document.createElement("video");
        video.src = session.videoUrl;
        video.crossOrigin = "anonymous";
        video.loop = true;
        video.muted = true;
        video.play();

        const videoTexture = new VideoTexture(video);
        videoTexture.minFilter = LinearFilter;
        videoTexture.magFilter = LinearFilter;
        videoTexture.colorSpace = SRGBColorSpace;

        const { scene: videoScene, camera: videoCamera } = createVideoScene(width, height, videoTexture);

        // Animation loop
        const animate = () => {
            requestAnimationFrame(animate);
            renderer.render(backgroundScene, backgroundCamera);
            renderer.clearDepth()
            renderer.render(videoScene, videoCamera);
        };
        animate();

        // Handle window resize
        const onResize = () => handleResize(canvas, renderer, backgroundCamera, videoCamera);
        window.addEventListener("resize", onResize);

        return () => {
            video.pause();
            video.removeAttribute("src");
            renderer.dispose();
            window.removeEventListener("resize", onResize);
        };
    }, [session]);

    if (!session) {
        return <div>No session data found.</div>;
    }

    return (
        <div style={{ width: "100%", height: "100%", display: "flex", justifyContent: "center", alignItems: "center" }}>
            <div style={{ width: "75vw", height: "75vh", position: "relative" }}>
                <h1>Recorded Session</h1>
                <p>
                    <strong>Start Time:</strong> {session.startTime.toLocaleString()}
                </p>
                <p>
                    <strong>End Time:</strong> {session.endTime.toLocaleString()}
                </p>
                <canvas
                    ref={canvasRef}
                    style={{
                        width: "100%",
                        height: "auto",
                        aspectRatio: "16/9",
                        display: "block",
                        margin: "0 auto",
                        border: "2px solid black"
                    }}
                />
            </div>
        </div>
    );
};

const calculateCanvasSize = (container: HTMLElement) => {
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    const targetRatio = 16 / 9;
    let width = containerWidth;
    let height = width / targetRatio;

    if (height > containerHeight) {
        height = containerHeight;
        width = height * targetRatio;
    }

    return { width, height };
};

export default Editor;
