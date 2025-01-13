import React, { useState, useEffect, useRef, useCallback } from "react";

interface MouseEventData {
	type: "mouseDown" | "mouseUp" | "mouseMove";
	time: Date;
	x: number;
	y: number;
}

const useMouseEvents = () => {
	const mouseEvents = useRef<MouseEventData[]>([]);

	// Track the last recorded time for each event type
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
		const now = Date.now();

		// Check if 500ms have passed since the last recorded event of this type
		if ((now - lastEventTimes.current[request.type]) >= 500) {
			mouseEvents.current.push(request);
			lastEventTimes.current[request.type] = now; // Update the last recorded time for this event type
		}
	}, []);

	useEffect(() => {
		chrome.runtime.onMessage.addListener(handleMessage);
		return () => {
			chrome.runtime.onMessage.removeListener(handleMessage);
		};
	}, [handleMessage]);

	return mouseEvents;
};

const useScreenRecording = (mouseEvents: React.MutableRefObject<MouseEventData[]>) => {
	const [stream, setStream] = useState<MediaRecorder | null>(null);
	const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
	const recordedChunks = useRef<Blob[]>([]);
	const sessionStartTime = useRef<number | null>(null);
	const sessionEndTime = useRef<number | null>(null);
	const windowDimensions = useRef<{ width: number; height: number } | null>(null);

	const handleRecordingStopped = useCallback(() => {
		sessionEndTime.current = Date.now();

		const videoBlob = new Blob(recordedChunks.current, { type: "video/webm" });
		const videoUrl = URL.createObjectURL(videoBlob);

		const sessionData = {
			startTime: sessionStartTime.current,
			endTime: sessionEndTime.current,
			videoUrl: videoUrl,
			mouseEvents: mouseEvents.current,
			windowDimensions: windowDimensions.current,
		};

		localStorage.removeItem("sessionData");
		localStorage.setItem("sessionData", JSON.stringify(sessionData));

		chrome.tabs.create({
			url: chrome.runtime.getURL("tabs/editor.html"),
		});
	}, [mouseEvents]);

	const startRecording = useCallback(async () => {
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

			sessionStartTime.current = Date.now();
			recordedChunks.current = [];
			windowDimensions.current = { width: window.innerWidth, height: window.innerHeight };
			mediaRecorder.start();
		} catch (error) {
			console.error("Error accessing media devices:", error);
		}
	}, [handleRecordingStopped]);

	const stopRecording = useCallback(() => {
		if (stream) {
			stream.stop();
			setStream(null);
			if (mediaStream) {
				mediaStream.getTracks().forEach((track) => track.stop());
				setMediaStream(null);
			}
			handleRecordingStopped();
		}
	}, [stream, mediaStream, handleRecordingStopped]);

	return { stream, startRecording, stopRecording };
};

const useScriptInjection = () => {
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
					func: () => {
						console.log("Script injected. Attaching event listeners...");

						const handleMouseDown = (event: MouseEvent) => {
							console.log("Mouse down event:", event);
							const clickTime = Date.now(); // Use Date.now()
							const { clientX, clientY } = event;
							chrome.runtime.sendMessage({
								type: "mouseDown",
								time: clickTime, // Send Date.now() value
								x: clientX,
								y: clientY,
							});
						};

						const handleMouseUp = (event: MouseEvent) => {
							console.log("Mouse up event:", event);
							const clickTime = Date.now(); // Use Date.now()
							const { clientX, clientY } = event;
							chrome.runtime.sendMessage({
								type: "mouseUp",
								time: clickTime, // Send Date.now() value
								x: clientX,
								y: clientY,
							});
						};

						const handleMouseMove = (event: MouseEvent) => {
							console.log("Mouse move event:", event);
							const moveTime = Date.now(); // Use Date.now()
							const { clientX, clientY } = event;
							chrome.runtime.sendMessage({
								type: "mouseMove",
								time: moveTime, // Send Date.now() value
								x: clientX,
								y: clientY,
							});
						};

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
	}, []);

	// Inject script when the active tab changes
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

	// Inject script when a new tab is created
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

	// Inject script when the page in the current tab is updated
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

	// Inject script initially for the active tab in the main browser window
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
	const mouseEvents = useMouseEvents(); // Get mouseEvents from the hook
	const { stream, startRecording, stopRecording } = useScreenRecording(mouseEvents); // Pass mouseEvents here
	useScriptInjection();

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
		</div>
	);
}
