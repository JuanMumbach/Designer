import { useFrame, useThree } from '@react-three/fiber';
import * as FileSystem from 'expo-file-system';
import { encode } from 'fast-png';
import React, { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as THREE from 'three';
import { uploadFileToFirebase } from './firebaseSetup';
import { base64ToUint8Array } from './imageExport';

const RGBA = 0x1908;
const UNSIGNED_BYTE = 0x1401;

export interface CameraStateSnapshot {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
  zoom: number;
}

export interface ImageCaptureRequest {
  width: number;
  height: number;
  cameraPosition?: [number, number, number];
  cameraTarget?: [number, number, number];
  fov?: number;
  zoom?: number;
  backgroundColor?: string | null;
}

export interface CapturedImageResult {
  uri: string;
  base64: string;
  bytes: Uint8Array;
  width: number;
  height: number;
}

export interface ThumbnailCaptureApi {
  requestCapture: (folder?: string) => Promise<string | null>;
  captureImage: (options: ImageCaptureRequest) => Promise<CapturedImageResult | null>;
  getCameraState: () => CameraStateSnapshot;
  setCameraState: (state: Partial<CameraStateSnapshot>) => void;
}

export function createThumbnailCaptureApi(): ThumbnailCaptureApi {
  return {
    requestCapture: () => Promise.resolve(null),
    captureImage: () => Promise.resolve(null),
    getCameraState: () => ({
      position: [0, 3, 3],
      target: [0, 1.5, 1.5],
      fov: 75,
      zoom: 1,
    }),
    setCameraState: () => {},
  };
}

export function uint8ArrayToBase64(buffer: Uint8Array): string {
  let binary = '';
  const len = buffer.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary);
}

async function captureCanvasFrame(
  gl: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera
): Promise<{ uri: string; base64: string; bytes: Uint8Array } | null> {
  try {
    if (Platform.OS === 'web') {
      const canvas = gl.domElement as unknown as HTMLCanvasElement;
      const dataUrl = canvas.toDataURL('image/png');
      if (!dataUrl) return null;
      const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
      const bytes = base64ToUint8Array(base64);
      return { uri: dataUrl, base64, bytes };
    }
    return await captureNativeFrame(gl);
  } catch (err) {
    console.warn('Frame capture failed:', err);
    return null;
  }
}

async function captureNativeFrame(
  gl: THREE.WebGLRenderer
): Promise<{ uri: string; base64: string; bytes: Uint8Array } | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const context = (gl as any).getContext() as any;
  if (!context || typeof context.readPixels !== 'function') {
    return null;
  }
  const width = context.drawingBufferWidth as number;
  const height = context.drawingBufferHeight as number;
  if (!width || !height) {
    return null;
  }

  const pixels = new Uint8Array(width * height * 4);
  context.readPixels(0, 0, width, height, RGBA, UNSIGNED_BYTE, pixels);

  const flipped = new Uint8Array(width * height * 4);
  const rowBytes = width * 4;
  for (let row = 0; row < height; row++) {
    const srcStart = (height - 1 - row) * rowBytes;
    flipped.set(pixels.subarray(srcStart, srcStart + rowBytes), row * rowBytes);
  }

  const png = encode({ width, height, data: flipped });
  const bytes = new Uint8Array(png);
  const base64 = uint8ArrayToBase64(bytes);
  const fileUri = `${FileSystem.cacheDirectory}thumbnail_capture_${Date.now()}.png`;
  await FileSystem.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return { uri: fileUri, base64, bytes };
}

export async function uploadCapturedThumbnail(
  uri: string,
  folder: string
): Promise<string | null> {
  try {
    const fileName = `thumb_${Date.now()}.png`;
    return await uploadFileToFirebase(uri, folder, fileName);
  } catch (err) {
    console.warn('Thumbnail upload failed:', err);
    return null;
  }
}

const CAPTURE_TIMEOUT_MS = 5000;

function hideSceneUIHelpers(scene: THREE.Scene): { object: THREE.Object3D; visible: boolean }[] {
  const hidden: { object: THREE.Object3D; visible: boolean }[] = [];
  scene.traverse((object) => {
    const shouldHide =
      object.userData?.isUIHelper === true ||
      object instanceof THREE.Sprite ||
      object instanceof THREE.LineSegments ||
      object instanceof THREE.Line ||
      object.name === 'selection_gizmo_group';
    if (shouldHide && object.visible) {
      hidden.push({ object, visible: true });
      object.visible = false;
    }
  });
  return hidden;
}

export function ThumbnailCaptureHost({
  captureApi,
  modelRef,
  canCapture,
  beforeCapture,
  defaultTarget,
  controlsRef,
  onWallCullingOverride,
  roomWidth,
}: {
  captureApi: ThumbnailCaptureApi;
  modelRef?: React.RefObject<THREE.Object3D | null>;
  canCapture?: () => boolean;
  beforeCapture?: (camera: THREE.Camera, scene: THREE.Scene) => void;
  defaultTarget?: [number, number, number];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  controlsRef?: React.RefObject<any>;
  onWallCullingOverride?: (culling: { left: boolean; right: boolean } | null) => void;
  roomWidth?: number;
}) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const pendingRef = useRef<((value: string | null) => void) | null>(null);
  const pendingImageRef = useRef<{
    options: ImageCaptureRequest;
    resolve: (value: CapturedImageResult | null) => void;
  } | null>(null);
  const pendingSinceRef = useRef(0);
  const folderRef = useRef<string>('thumbnails');
  const canCaptureRef = useRef(canCapture);
  canCaptureRef.current = canCapture;
  const beforeCaptureRef = useRef(beforeCapture);
  beforeCaptureRef.current = beforeCapture;
  const defaultTargetRef = useRef<[number, number, number]>(defaultTarget ?? [0, 1.5, 1.5]);
  defaultTargetRef.current = defaultTarget ?? [0, 1.5, 1.5];

  useFrame(() => {
    const imageJob = pendingImageRef.current;
    if (imageJob) {
      pendingImageRef.current = null;
      const { options, resolve } = imageJob;
      const targetWidth = Math.max(64, Math.min(8192, Math.round(options.width || 1920)));
      const targetHeight = Math.max(64, Math.min(8192, Math.round(options.height || 1080)));

      const prevPos = camera.position.clone();
      const prevQuat = camera.quaternion.clone();
      const isPersp = camera instanceof THREE.PerspectiveCamera;
      const prevFov = isPersp ? camera.fov : 75;
      const prevAspect = isPersp ? camera.aspect : 1;
      const prevZoom = (camera as THREE.PerspectiveCamera).zoom ?? 1;

      const prevSize = gl.getSize(new THREE.Vector2());
      const prevPixelRatio = gl.getPixelRatio();
      const clearColor = gl.getClearColor(new THREE.Color());
      const clearAlpha = gl.getClearAlpha();
      const previousBackground = scene.background;

      const hiddenHelpers = hideSceneUIHelpers(scene);

      const camPos = options.cameraPosition ?? [prevPos.x, prevPos.y, prevPos.z];
      const camTarget = options.cameraTarget ?? defaultTargetRef.current;

      if (typeof roomWidth === 'number' && onWallCullingOverride) {
        onWallCullingOverride({
          left: camPos[0] < -roomWidth / 2,
          right: camPos[0] > roomWidth / 2,
        });
      }

      camera.position.set(camPos[0], camPos[1], camPos[2]);
      if (isPersp) {
        if (options.fov !== undefined && Number.isFinite(options.fov)) {
          camera.fov = options.fov;
        }
        if (options.zoom !== undefined && Number.isFinite(options.zoom)) {
          camera.zoom = options.zoom;
        }
        camera.aspect = targetWidth / targetHeight;
      }
      camera.lookAt(camTarget[0], camTarget[1], camTarget[2]);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld(true);

      gl.setPixelRatio(1);
      gl.setSize(targetWidth, targetHeight, false);

      if (options.backgroundColor !== undefined) {
        if (options.backgroundColor === null) {
          scene.background = null;
          gl.setClearColor(0x000000, 0);
        } else {
          scene.background = new THREE.Color(options.backgroundColor);
          gl.setClearColor(new THREE.Color(options.backgroundColor), 1);
        }
      } else if (!scene.background) {
        scene.background = new THREE.Color('#a2a2a2');
        gl.setClearColor(new THREE.Color('#a2a2a2'), 1);
      }

      beforeCaptureRef.current?.(camera, scene);
      gl.render(scene, camera);

      captureCanvasFrame(gl, scene, camera)
        .then((captured) => {
          scene.background = previousBackground;
          gl.setClearColor(clearColor, clearAlpha);
          gl.setPixelRatio(prevPixelRatio);
          gl.setSize(prevSize.x, prevSize.y, false);

          camera.position.copy(prevPos);
          camera.quaternion.copy(prevQuat);
          if (isPersp) {
            camera.fov = prevFov;
            camera.aspect = prevAspect;
            camera.zoom = prevZoom;
          }
          camera.updateProjectionMatrix();
          camera.updateMatrixWorld(true);

          for (const item of hiddenHelpers) {
            item.object.visible = item.visible;
          }
          if (onWallCullingOverride) {
            onWallCullingOverride(null);
          }

          gl.render(scene, camera);

          if (!captured) {
            resolve(null);
            return;
          }
          resolve({
            uri: captured.uri,
            base64: captured.base64,
            bytes: captured.bytes,
            width: targetWidth,
            height: targetHeight,
          });
        })
        .catch((err) => {
          console.warn('Deterministic image capture failed:', err);
          scene.background = previousBackground;
          gl.setClearColor(clearColor, clearAlpha);
          gl.setPixelRatio(prevPixelRatio);
          gl.setSize(prevSize.x, prevSize.y, false);
          camera.position.copy(prevPos);
          camera.quaternion.copy(prevQuat);
          if (isPersp) {
            camera.fov = prevFov;
            camera.aspect = prevAspect;
            camera.zoom = prevZoom;
          }
          camera.updateProjectionMatrix();
          camera.updateMatrixWorld(true);
          for (const item of hiddenHelpers) {
            item.object.visible = item.visible;
          }
          if (onWallCullingOverride) {
            onWallCullingOverride(null);
          }
          resolve(null);
        });
      return;
    }

    const resolve = pendingRef.current;
    if (!resolve) {
      gl.render(scene, camera);
      return;
    }

    if (canCaptureRef.current && !canCaptureRef.current()) {
      gl.render(scene, camera);
      if (performance.now() - pendingSinceRef.current > CAPTURE_TIMEOUT_MS) {
        pendingRef.current = null;
        resolve(null);
      }
      return;
    }

    pendingRef.current = null;
    const folder = folderRef.current;

    const model = modelRef?.current ?? null;
    const hidden: { object: THREE.Object3D; visible: boolean }[] = [];
    const clearColor = gl.getClearColor(new THREE.Color());
    const clearAlpha = gl.getClearAlpha();
    const previousBackground = scene.background;

    if (model) {
      const modelAncestors = new Set<THREE.Object3D>();
      let ancestor: THREE.Object3D | null = model.parent;
      while (ancestor) {
        modelAncestors.add(ancestor);
        ancestor = ancestor.parent;
      }

      scene.traverse((object) => {
        if (object === model) return;
        if (object instanceof THREE.Camera || object instanceof THREE.Light) {
          return;
        }
        if (modelAncestors.has(object)) return;

        let underModel = false;
        let current: THREE.Object3D | null = object.parent;
        while (current) {
          if (current === model) {
            underModel = true;
            break;
          }
          current = current.parent;
        }
        if (underModel) return;

        if (object.visible) {
          object.visible = false;
          hidden.push({ object, visible: true });
        }
      });
    } else {
      hidden.push(...hideSceneUIHelpers(scene));
    }

    scene.background = null;
    gl.setClearColor(0x000000, 0);

    beforeCaptureRef.current?.(camera, scene);

    gl.render(scene, camera);

    scene.background = previousBackground;
    gl.setClearColor(clearColor, clearAlpha);
    for (const hiddenObject of hidden) {
      hiddenObject.object.visible = hiddenObject.visible;
    }

    captureCanvasFrame(gl, scene, camera)
      .then(async (captured) => {
        if (!captured) return null;
        return uploadCapturedThumbnail(captured.uri, folder);
      })
      .then(resolve)
      .catch((err) => {
        console.warn('Thumbnail capture flow failed:', err);
        resolve(null);
      });
  }, 1);

  useEffect(() => {
    captureApi.requestCapture = (folder: string = 'thumbnails') =>
      new Promise<string | null>((resolve) => {
        folderRef.current = folder;
        pendingSinceRef.current = performance.now();
        pendingRef.current = resolve;
      });

    captureApi.captureImage = (options: ImageCaptureRequest) =>
      new Promise<CapturedImageResult | null>((resolve) => {
        pendingImageRef.current = { options, resolve };
      });

    captureApi.getCameraState = () => {
      const isPersp = camera instanceof THREE.PerspectiveCamera;
      const targetVec = controlsRef?.current?.target
        ? [
            Number(controlsRef.current.target.x.toFixed(4)),
            Number(controlsRef.current.target.y.toFixed(4)),
            Number(controlsRef.current.target.z.toFixed(4)),
          ] as [number, number, number]
        : defaultTargetRef.current;

      return {
        position: [
          Number(camera.position.x.toFixed(4)),
          Number(camera.position.y.toFixed(4)),
          Number(camera.position.z.toFixed(4)),
        ],
        target: targetVec,
        fov: isPersp ? Number(camera.fov.toFixed(2)) : 75,
        zoom: Number(((camera as THREE.PerspectiveCamera).zoom ?? 1).toFixed(2)),
      };
    };

    captureApi.setCameraState = (state: Partial<CameraStateSnapshot>) => {
      if (state.position) {
        camera.position.set(state.position[0], state.position[1], state.position[2]);
      }
      if (camera instanceof THREE.PerspectiveCamera) {
        if (state.fov !== undefined && Number.isFinite(state.fov)) {
          camera.fov = state.fov;
        }
        if (state.zoom !== undefined && Number.isFinite(state.zoom)) {
          camera.zoom = state.zoom;
        }
      }
      const target = state.target ?? defaultTargetRef.current;
      if (controlsRef?.current?.target) {
        controlsRef.current.target.set(target[0], target[1], target[2]);
        controlsRef.current.update?.();
      }
      camera.lookAt(target[0], target[1], target[2]);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld(true);
      controlsRef?.current?.update?.();
    };

    return () => {
      captureApi.requestCapture = () => Promise.resolve(null);
      captureApi.captureImage = () => Promise.resolve(null);
    };
  }, [captureApi, camera, controlsRef]);

  return null;
}
