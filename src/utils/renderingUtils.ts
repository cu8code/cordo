import { DoubleSide, Mesh, MeshBasicMaterial, OrthographicCamera, PerspectiveCamera, PlaneGeometry, Scene, TextureLoader, VideoTexture } from "three";

export const loadTexture = (url: string) => {
    const textureLoader = new TextureLoader();
    return textureLoader.load(url);
};

export const calculateCanvasSize = (container: HTMLElement) => {
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

    const cropAspectRatio = cropWidth / cropHeight;

    const camera = new PerspectiveCamera(60, cropAspectRatio, 0.1, 1000);

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

    const fovHeight = 2 * Math.atan((cropHeight / 2) / 1000) * (180 / Math.PI); // Adjust FOV based on crop height
    camera.fov = fovHeight; // Set the calculated FOV
    camera.updateProjectionMatrix();

    const distance = (planeHeight / 2) / Math.tan((camera.fov / 2) * (Math.PI / 180)); // Distance to fit the plane height
    camera.position.z = distance + 1;

    const defaultPosition = { x: 0, y: 0, z: camera.position.z };
    const defaultFOV = camera.fov; // Store the calculated FOV

    return { scene, camera, defaultPosition, defaultFOV };
};
