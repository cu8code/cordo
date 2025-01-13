import {
    Scene,
    PerspectiveCamera,
    OrthographicCamera,
    WebGLRenderer,
    VideoTexture,
    TextureLoader,
    PlaneGeometry,
    MeshBasicMaterial,
    Mesh,
    DoubleSide,
    Vector3,
    MathUtils,
} from "three";
import type { SessionData } from "~components/SessionLoader";

export const loadTexture = (url: string) => {
    const textureLoader = new TextureLoader();
    return textureLoader.load(url);
};

export const createBackgroundScene = (width: number, height: number, texture: any) => {
    const scene = new Scene();
    const camera = new OrthographicCamera(
        -width / 2, // Left
        width / 2,  // Right
        height / 2, // Top
        -height / 2, // Bottom
        0.1,        // Near
        2000        // Far
    );
    camera.position.z = 10;

    const planeGeometry = new PlaneGeometry(width, height);
    const planeMaterial = new MeshBasicMaterial({
        map: texture,
        side: DoubleSide,
        toneMapped: false,
    });
    const plane = new Mesh(planeGeometry, planeMaterial);
    scene.add(plane);

    return { scene, camera };
};

export const createVideoScene = (width: number, height: number, videoTexture: VideoTexture) => {
    const scene = new Scene();
    const camera = new PerspectiveCamera(65, width / height, 0.1, 1000);
    camera.position.z = 10;

    const planeWidth = 16;
    const planeHeight = (planeWidth * height) / width;

    const planeGeometry = new PlaneGeometry(planeWidth, planeHeight);
    const planeMaterial = new MeshBasicMaterial({
        map: videoTexture,
        side: DoubleSide,
        toneMapped: false,
        transparent: true,
    });
    const plane = new Mesh(planeGeometry, planeMaterial);
    scene.add(plane);

    return { scene, camera };
};

export const handleResize = (
    canvas: HTMLCanvasElement,
    renderer: WebGLRenderer,
    backgroundCamera: OrthographicCamera,
    videoCamera: PerspectiveCamera
) => {
    const container = canvas.parentElement;
    if (!container) return;

    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    const targetRatio = 16 / 9;
    let width = containerWidth;
    let height = width / targetRatio;

    if (height > containerHeight) {
        height = containerHeight;
        width = height * targetRatio;
    }

    canvas.width = width;
    canvas.height = height;
    renderer.setSize(width, height);

    backgroundCamera.left = -width / 2;
    backgroundCamera.right = width / 2;
    backgroundCamera.top = height / 2;
    backgroundCamera.bottom = -height / 2;
    backgroundCamera.updateProjectionMatrix();

    videoCamera.aspect = width / height;
    videoCamera.updateProjectionMatrix();
};

interface CreateCroppedVideoSceneOptions {
    videoTexture: VideoTexture;
    videoWidth: number;
    videoHeight: number;
    cropWidth: number;
    cropHeight: number;
    cropY: number; // Crop from the top (Y offset)
}

export const createCroppedVideoScene = ({
    videoTexture,
    videoWidth,
    videoHeight,
    cropWidth,
    cropHeight,
    cropY, // Crop from the top (Y offset)
}: CreateCroppedVideoSceneOptions) => {
    const scene = new Scene();
    
    // Calculate the aspect ratio of the cropped area
    const cropAspectRatio = cropWidth / cropHeight;

    // Create a camera with a default FOV (will be updated dynamically)
    const camera = new PerspectiveCamera(60, cropAspectRatio, 0.1, 1000);

    // Create a plane geometry for the cropped section
    const planeWidth = 16; // Base width for the plane
    const planeHeight = (planeWidth * cropHeight) / cropWidth; // Adjust height based on crop aspect ratio

    const planeGeometry = new PlaneGeometry(planeWidth, planeHeight);
    const planeMaterial = new MeshBasicMaterial({
        map: videoTexture,
        side: DoubleSide,
        toneMapped: false,
    });
    const plane = new Mesh(planeGeometry, planeMaterial);
    scene.add(plane);

    // Adjust texture coordinates to crop the video from the top
    const uvAttribute = planeGeometry.attributes.uv;
    for (let i = 0; i < uvAttribute.count; i++) {
        const u = uvAttribute.getX(i);
        const v = uvAttribute.getY(i);
        uvAttribute.setXY(
            i,
            u, // Keep the horizontal UV coordinate unchanged
            (v * cropHeight) / videoHeight + cropY / videoHeight // Crop from the top
        );
    }
    uvAttribute.needsUpdate = true;

    // Calculate dynamic FOV based on the video's height and crop area
    const fovHeight = 2 * Math.atan((cropHeight / 2) / 1000) * (180 / Math.PI); // Adjust FOV based on crop height
    camera.fov = fovHeight; // Set the calculated FOV
    camera.updateProjectionMatrix();

    // Adjust camera position to fit the cropped video
    const distance = (planeHeight / 2) / Math.tan((camera.fov / 2) * (Math.PI / 180)); // Distance to fit the plane height
    camera.position.z = distance + 1;

    // Store the default camera position and FOV
    const defaultPosition = { x: 0, y: 0, z: camera.position.z };
    const defaultFOV = camera.fov; // Store the calculated FOV

    return { scene, camera, defaultPosition, defaultFOV };
};

export const easeInOutQuad = (t: number): number => {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
};

export const applyEffectToCamera = (
  effects: Effect[],
  currentTime: number,
  videoCamera: PerspectiveCamera,
  defaultPosition: { x: number; y: number; z: number },
  defaultFOV: number,
  windowWidth: number,
  windowHeight: number
) => {
  if (!effects.length || !videoCamera) return;

const activeEffect = effects.find((effect) => {
  const isActive =
    currentTime * 1000 >= effect.startTime && currentTime * 1000 <= effect.endTime;
  return isActive;
});
	
  if (activeEffect) {
    const { startTime, endTime, points } = activeEffect;
    const progress = (currentTime * 1000 - startTime) / (endTime - startTime);

    const totalPoints = points.length;
    const exactPointIndex = progress * (totalPoints - 1);
    const pointIndex = Math.floor(exactPointIndex);
    const nextPointIndex = Math.min(pointIndex + 1, totalPoints - 1);
    const interpolationFactor = exactPointIndex - pointIndex;

    const currentPoint = points[pointIndex];
    const nextPoint = points[nextPointIndex];

    let x = currentPoint.x + (nextPoint.x - currentPoint.x) * interpolationFactor;
    let y = currentPoint.y + (nextPoint.y - currentPoint.y) * interpolationFactor;

    x = (x / windowWidth) * 2 - 1;
    y = -((y / windowHeight) * 2 - 1);

    const scaleFactor = 10;
    x *= scaleFactor;
    y *= scaleFactor;

    // Only zoom in (no zoom out beyond defaultFOV)
    const minFOV = defaultFOV; // Start from defaultFOV
    const maxFOV = defaultFOV - 20; // Zoom in by reducing FOV (smaller FOV = more zoom)
    const fov = minFOV + (maxFOV - minFOV) * progress;

    // Smoothly interpolate camera position and FOV
    videoCamera.position.lerp(new Vector3(x / 10, y / 10, videoCamera.position.z), 0.1);
    videoCamera.fov = MathUtils.lerp(videoCamera.fov, fov, 0.1);
    videoCamera.updateProjectionMatrix();
  } else {
    // Reset camera position and FOV to default values when no effect is active
    videoCamera.position.lerp(new Vector3(defaultPosition.x, defaultPosition.y, defaultPosition.z), 0.1);
    videoCamera.fov = MathUtils.lerp(videoCamera.fov, defaultFOV, 0.1);
    videoCamera.updateProjectionMatrix();
  }
};

export interface Effect {
	startTime: number;
	endTime: number;
	points?: Array<{ x: number; y: number }>;
	fov?: number;
}

export const buildEffect = (session: SessionData): Effect[] => {
	const { mouseEvents, startTime } = session;
	

	// Ensure startTime is a valid number (timestamp in milliseconds)
	if (typeof startTime !== "number" || isNaN(startTime)) {
		throw new Error("startTime must be a valid timestamp (number)");
	}

	const tracks: Effect[] = [];
	let currentTrack: Effect | null = null;

	for (const event of mouseEvents) {
		// Ensure event.time is a valid number (timestamp in milliseconds)
		if (typeof event.time !== "number" || isNaN(event.time)) {
			throw new Error("Event timestamp must be a valid timestamp (number)");
		}

		// Calculate the time in seconds relative to the session start time
		const timeInMs = (event.time - startTime);

		// Ensure the time is non-negative and within the session duration
		if (timeInMs < 0) {
			continue; // Skip events that occur before the session start time
		}

		switch (event.type) {
			case "mouseDown": {
				// Start a new track
				currentTrack = {
					startTime: timeInMs,
					endTime: timeInMs, // Initially, endTime is the same as startTime
					points: [{ x: event.x, y: event.y }],
				};
				break;
			}

			case "mouseMove": {
				// Add the current point to the active track
				if (currentTrack) {
					currentTrack.points.push({ x: event.x, y: event.y });
				}
				break;
			}

			case "mouseUp": {
				// Finalize the current track and add it to the tracks array
				if (currentTrack) {
					currentTrack.endTime = timeInMs;
					tracks.push(currentTrack);
					currentTrack = null;
				}
				break;
			}
		}
	}

	return tracks;
};
