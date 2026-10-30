import React, { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Canvas, useThree } from '@react-three/fiber';
import * as FileSystem from 'expo-file-system';
import { encode } from 'fast-png';
import * as THREE from 'three';
import { uint8ArrayToBase64, uploadCapturedThumbnail } from './thumbnailCapture';

export const SWATCH_SIZE_METERS = 0.25;
const SWATCH_PIXELS = 512;

export interface MaterialSwatchApi {
  renderer: THREE.WebGLRenderer | null;
}

export function createMaterialSwatchApi(): MaterialSwatchApi {
  return { renderer: null };
}

async function resolveTextureUri(uri: string): Promise<{ uri: string; revoke: boolean }> {
  if (Platform.OS === 'web' && uri.startsWith('file://')) {
    const resp = await fetch(uri);
    const blob = await resp.blob();
    return { uri: URL.createObjectURL(blob), revoke: true };
  }
  return { uri, revoke: false };
}

function loadTexture(uri: string): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    loader.load(uri, resolve, undefined, reject);
  });
}

function buildSwatchGeometry(repeatU: number, repeatV: number): THREE.BufferGeometry {
  const geometry = new THREE.PlaneGeometry(1, 1, 1, 1);
  const uv = geometry.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * repeatU, uv.getY(i) * repeatV);
  }
  uv.needsUpdate = true;
  return geometry;
}

export function computeSwatchRepeat(
  imageWidth: number,
  imageHeight: number,
  scaleU: number,
  scaleV: number
): [number, number] {
  const su = scaleU > 0 ? scaleU : imageWidth;
  const sv = scaleV > 0 ? scaleV : imageHeight;
  return [
    Math.max(0.001, (su * SWATCH_SIZE_METERS) / imageWidth),
    Math.max(0.001, (sv * SWATCH_SIZE_METERS) / imageHeight),
  ];
}

async function encodeSwatch(pixels: Uint8Array, size: number): Promise<string> {
  const png = encode({ width: size, height: size, data: pixels });
  const base64 = uint8ArrayToBase64(png);
  if (Platform.OS === 'web') {
    return `data:image/png;base64,${base64}`;
  }
  const fileUri = `${FileSystem.cacheDirectory}material_swatch_${Date.now()}.png`;
  await FileSystem.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return fileUri;
}

export async function renderMaterialSwatch(
  api: MaterialSwatchApi,
  textureUri: string,
  scaleU: number,
  scaleV: number
): Promise<string | null> {
  const renderer = api.renderer;
  if (!renderer || !textureUri) return null;

  const resolved = await resolveTextureUri(textureUri);
  let texture: THREE.Texture | null = null;
  let geometry: THREE.BufferGeometry | null = null;
  let material: THREE.MeshBasicMaterial | null = null;
  const target = new THREE.WebGLRenderTarget(SWATCH_PIXELS, SWATCH_PIXELS, {
    type: THREE.UnsignedByteType,
    format: THREE.RGBAFormat,
  });

  try {
    texture = await loadTexture(resolved.uri);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.NoColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    texture.needsUpdate = true;

    const image = texture.image as { width?: number; height?: number } | undefined;
    const imageWidth = image?.width || 1024;
    const imageHeight = image?.height || 1024;
    const [repeatU, repeatV] = computeSwatchRepeat(imageWidth, imageHeight, scaleU, scaleV);

    geometry = buildSwatchGeometry(repeatU, repeatV);
    material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
    const scene = new THREE.Scene();
    scene.add(new THREE.Mesh(geometry, material));
    const camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.1, 10);
    camera.position.set(0, 0, 1);
    camera.lookAt(0, 0, 0);

    const previousTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(target);
    renderer.setClearColor(0xffffff, 1);
    renderer.clear();
    renderer.render(scene, camera);
    const raw = new Uint8Array(SWATCH_PIXELS * SWATCH_PIXELS * 4);
    renderer.readRenderTargetPixels(target, 0, 0, SWATCH_PIXELS, SWATCH_PIXELS, raw);
    renderer.setRenderTarget(previousTarget);

    const rowBytes = SWATCH_PIXELS * 4;
    const flipped = new Uint8Array(raw.length);
    for (let row = 0; row < SWATCH_PIXELS; row++) {
      const src = (SWATCH_PIXELS - 1 - row) * rowBytes;
      flipped.set(raw.subarray(src, src + rowBytes), row * rowBytes);
    }

    return await encodeSwatch(flipped, SWATCH_PIXELS);
  } catch (err) {
    console.warn('Material swatch render failed:', err);
    return null;
  } finally {
    target.dispose();
    geometry?.dispose();
    material?.dispose();
    texture?.dispose();
    if (resolved.revoke) URL.revokeObjectURL(resolved.uri);
  }
}

export async function generateMaterialThumbnail(
  api: MaterialSwatchApi,
  textureUri: string | null | undefined,
  scaleU: number,
  scaleV: number,
  folder: string = 'thumbnails/materials'
): Promise<string | null> {
  if (!textureUri) return null;
  const uri = await renderMaterialSwatch(api, textureUri, scaleU, scaleV);
  if (!uri) return null;
  return uploadCapturedThumbnail(uri, folder);
}

function RendererBridge({ api }: { api: MaterialSwatchApi }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    api.renderer = gl;
    return () => {
      if (api.renderer === gl) api.renderer = null;
    };
  }, [api, gl]);
  return null;
}

export function MaterialSwatchRenderer({ api }: { api: MaterialSwatchApi }) {
  return (
    <View style={styles.hidden} pointerEvents="none">
      <Canvas frameloop="never" gl={{ preserveDrawingBuffer: true }}>
        <RendererBridge api={api} />
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: {
    position: 'absolute',
    width: 8,
    height: 8,
    left: 0,
    top: 0,
    opacity: 0,
  },
});
