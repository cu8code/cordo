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
    LinearFilter,
    DoubleSide,
    SRGBColorSpace,
    Color,
} from "three";

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
    const camera = new PerspectiveCamera(60, cropWidth / cropHeight, 0.1, 1000);

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

    // Position the camera
    camera.position.z = 10;

    return { scene, camera };
};

export const replayMouseEvents = (
  mouseEvents: Array<{
    type: "mouseDown" | "mouseUp" | "mouseMove";
    time: Date;
    x: number;
    y: number;
  }>,
  startTime: Date,
  onMouseDown: (x: number, y: number) => void,
  onMouseUp: () => void,
  onMouseMove: (x: number, y: number) => void
) => {
  if (!mouseEvents.length) return;

  let currentEventIndex = 0;

  const processNextEvent = () => {
    if (currentEventIndex >= mouseEvents.length) return;

    const event = mouseEvents[currentEventIndex];
    const eventTime = event.time.getTime() - startTime.getTime();

    setTimeout(() => {
      if (event.type === "mouseDown") {
        onMouseDown(event.x, event.y);
      } else if (event.type === "mouseUp") {
        onMouseUp();
      } else if (event.type === "mouseMove") {
        onMouseMove(event.x, event.y);
      }

      currentEventIndex++;
      processNextEvent();
    }, eventTime);
  };

  processNextEvent();
};

export const easeInOutQuad = (t: number): number => {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
};
