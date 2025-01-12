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

// Utility to load a texture from a Base64 data URL or image URL
export const loadTexture = (url: string) => {
    const textureLoader = new TextureLoader();
    return textureLoader.load(url);
};

// Utility to create a background scene with a fixed camera
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

// Utility to create a video scene with a perspective camera
export const createVideoScene = (width: number, height: number, videoTexture: VideoTexture) => {
    const scene = new Scene();
    const camera = new PerspectiveCamera(75, width / height, 0.1, 1000);
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

// Utility to handle canvas resizing
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

    // Update background camera
    backgroundCamera.left = -width / 2;
    backgroundCamera.right = width / 2;
    backgroundCamera.top = height / 2;
    backgroundCamera.bottom = -height / 2;
    backgroundCamera.updateProjectionMatrix();

    // Update video camera
    videoCamera.aspect = width / height;
    videoCamera.updateProjectionMatrix();
};
