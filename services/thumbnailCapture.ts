import { useFrame, useThree } from '@react-three/fiber';
import * as FileSystem from 'expo-file-system';
import { encode } from 'fast-png';
import React, { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as THREE from 'three';
import { uploadFileToFirebase } from './firebaseSetup';

const RGBA = 0x1908;
const UNSIGNED_BYTE = 0x1401;

export interface ThumbnailCaptureApi {
  requestCapture: (folder?: string) => Promise<string | null>;
}

export function createThumbnailCaptureApi(): ThumbnailCaptureApi {
  return { requestCapture: () => Promise.resolve(null) };
}

function uint8ArrayToBase64(buffer: Uint8Array): string {
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
): Promise<{ uri: string } | null> {
  try {
    if (Platform.OS === 'web') {
      const canvas = gl.domElement as unknown as HTMLCanvasElement;
      const dataUrl = canvas.toDataURL('image/png');
      return dataUrl ? { uri: dataUrl } : null;
    }
    return await captureNativeFrame(gl);
  } catch (err) {
    console.warn('Frame capture failed:', err);
    return null;
  }
}

async function captureNativeFrame(
  gl: THREE.WebGLRenderer
): Promise<{ uri: string } | null> {
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
  const base64 = uint8ArrayToBase64(png);
  const fileUri = `${FileSystem.cacheDirectory}thumbnail_capture.png`;
  await FileSystem.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return { uri: fileUri };
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

export function ThumbnailCaptureHost({
  captureApi,
}: {
  captureApi: ThumbnailCaptureApi;
}) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const pendingRef = useRef<((value: string | null) => void) | null>(null);
  const folderRef = useRef<string>('thumbnails');

  useFrame(() => {
    gl.render(scene, camera);
    const resolve = pendingRef.current;
    if (!resolve) return;
    pendingRef.current = null;
    const folder = folderRef.current;
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
        pendingRef.current = resolve;
      });
    return () => {
      captureApi.requestCapture = () => Promise.resolve(null);
    };
  }, [captureApi]);

  return null;
}