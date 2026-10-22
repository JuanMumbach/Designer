import { Billboard, Box, Gltf, ScreenSizer } from '@react-three/drei/native';
import { Canvas, useFrame } from '@react-three/fiber';
import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import * as THREE from 'three';
import PreviewEnvironment from '../PreviewScene';
import {
  ThumbnailCaptureApi,
  ThumbnailCaptureHost,
} from '../../../services/thumbnailCapture';
import {
  buildSlotIndexMaps,
  collectSlots,
  resolveMeshSlot,
  SlotIndexMaps,
} from '../../../services/materialSlots';
import { extractGlbParts, readGlbBytes } from '../../../services/glbParts';
import { AppliedMaterial } from '@/components/DesignScreen/3dView/DesignObjects';

const RED = new THREE.Color('#ff2a2a');
const uiPixelScale = 10;

function createWhitePlaceholderMaterial(baseMaterial: THREE.Material): THREE.Material {
  const mat = baseMaterial.clone() as THREE.MeshStandardMaterial;
  if ('map' in mat) {
    mat.map = null;
  }
  if (mat.color instanceof THREE.Color) {
    mat.color.set('#ffffff');
  }
  mat.needsUpdate = true;
  return mat;
}

function LoadingSpinner3D({ position }: { position: [number, number, number] }) {
  const spinnerRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (spinnerRef.current) {
      spinnerRef.current.rotation.z -= delta * 5;
    }
  });

  return (
    <ScreenSizer position={position} scale={0.45 * uiPixelScale}>
      <Billboard>
        <mesh renderOrder={998}>
          <ringGeometry args={[0.32, 0.48, 32]} />
          <meshBasicMaterial
            color="#e5e7eb"
            transparent
            opacity={0.75}
            depthTest={false}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh ref={spinnerRef} renderOrder={999}>
          <ringGeometry args={[0.32, 0.48, 24, 1, 0, Math.PI * 1.35]} />
          <meshBasicMaterial
            color="#2563eb"
            transparent
            opacity={0.95}
            depthTest={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      </Billboard>
    </ScreenSizer>
  );
}

function restoreMaterials(anim: {
  materials: THREE.MeshStandardMaterial[];
} | null, originals: Map<THREE.MeshStandardMaterial, THREE.Color>) {
  if (!anim) return;
  for (const mat of anim.materials) {
    const orig = originals.get(mat);
    if (orig) mat.color.copy(orig);
  }
}

function SlotFlash({
  groupRef,
  maps,
  highlightSlot,
  resetRef,
}: {
  groupRef: React.RefObject<THREE.Group | null>;
  maps: SlotIndexMaps | null;
  highlightSlot: number | null;
  resetRef?: { current: (() => void) | null };
}) {
  const originalsRef = useRef<Map<THREE.MeshStandardMaterial, THREE.Color>>(new Map());
  const animRef = useRef<{
    start: number;
    materials: THREE.MeshStandardMaterial[];
  } | null>(null);

  useEffect(() => {
    if (!resetRef) return;
    resetRef.current = () => {
      restoreMaterials(animRef.current, originalsRef.current);
      animRef.current = null;
    };
    return () => {
      if (resetRef) resetRef.current = null;
    };
  }, [resetRef]);

  useEffect(() => {
    if (highlightSlot === null || highlightSlot === undefined) {
      restoreMaterials(animRef.current, originalsRef.current);
      animRef.current = null;
      return;
    }
    const group = groupRef.current;
    if (!group || !maps) return;

    const meshes: THREE.Mesh[] = [];
    group.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        if (resolveMeshSlot(child, maps) === highlightSlot) {
          meshes.push(child);
        }
      }
    });
    if (meshes.length === 0) return;

    const materials = meshes.map((m) => m.material) as THREE.MeshStandardMaterial[];
    for (const mat of materials) {
      if (!originalsRef.current.has(mat)) {
        originalsRef.current.set(mat, mat.color.clone());
      }
    }
    restoreMaterials(animRef.current, originalsRef.current);
    animRef.current = { start: performance.now(), materials };
  }, [highlightSlot, groupRef, maps]);

  useFrame(() => {
    const anim = animRef.current;
    if (!anim) return;

    const pulseDuration = 0.7;
    const pulses = 3;
    const total = pulseDuration * pulses;
    const elapsed = (performance.now() - anim.start) / 1000;

    if (elapsed >= total) {
      restoreMaterials(anim, originalsRef.current);
      animRef.current = null;
      return;
    }

    const t = elapsed / total;
    const wave = Math.sin(t * Math.PI * pulses);
    for (const mat of anim.materials) {
      const orig = originalsRef.current.get(mat);
      if (orig) {
        mat.color.lerpColors(orig, RED, wave);
      }
    }
  });

  return null;
}

export default function ObjectPreview({
  uri,
  highlightSlot,
  captureApi,
  slotTextures,
  onReadyChange,
}: {
  uri: string | null;
  highlightSlot?: number | null;
  captureApi?: ThumbnailCaptureApi;
  slotTextures?: Record<number, AppliedMaterial>;
  onReadyChange?: (ready: boolean) => void;
}) {
  const [processedUri, setProcessedUri] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const gltfGroupRef = useRef<THREE.Group | null>(null);
  const [gltfLoaded, setGltfLoaded] = useState(false);
  const [mapsReady, setMapsReady] = useState(false);
  const [maps, setMaps] = useState<SlotIndexMaps | null>(null);
  const [texturesReady, setTexturesReady] = useState(false);
  const [modelCenter, setModelCenter] = useState<[number, number, number]>([0, 0.25, 0]);

  const meshOriginalMaterialsRef = useRef<WeakMap<THREE.Mesh, THREE.Material>>(new WeakMap());
  const originalMaterialsRef = useRef<Map<number, THREE.Material>>(new Map());
  const overrideVersionRef = useRef(0);
  const textureLoaderRef = useRef<THREE.TextureLoader | null>(null);
  const modelDimensionsRef = useRef<[number, number, number]>([1, 1, 1]);
  const flashResetRef = useRef<(() => void) | null>(null);
  const onReadyChangeRef = useRef(onReadyChange);
  onReadyChangeRef.current = onReadyChange;

  useEffect(() => {
    if (!uri) {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      setProcessedUri(null);
      return;
    }

    let cancelled = false;

    const prepare = async () => {
      let result = uri;
      if (Platform.OS === 'web' && uri.startsWith('file://')) {
        const resp = await fetch(uri);
        const blob = await resp.blob();
        result = URL.createObjectURL(blob);
      }
      if (!cancelled) {
        if (objectUrlRef.current && objectUrlRef.current !== result) {
          URL.revokeObjectURL(objectUrlRef.current);
        }
        objectUrlRef.current = result.startsWith('blob:') ? result : null;
        setProcessedUri(result);
      }
    };

    prepare();

    return () => {
      cancelled = true;
    };
  }, [uri]);

  useEffect(() => {
    setGltfLoaded(false);
    setMapsReady(false);
    setTexturesReady(false);
    gltfGroupRef.current = null;
    setMaps(null);
    originalMaterialsRef.current.clear();
  }, [uri]);

  useEffect(() => {
    if (!processedUri) return;
    let cancelled = false;
    (async () => {
      try {
        const bytes = await readGlbBytes(processedUri);
        const parts = extractGlbParts(bytes);
        const built = buildSlotIndexMaps(parts);
        if (!cancelled) setMaps(built);
      } catch (err) {
        console.warn('Failed to parse GLB material slots:', err);
        if (!cancelled) setMaps(null);
      } finally {
        if (!cancelled) setMapsReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [processedUri]);

  const handleGltfReady = useCallback((group: THREE.Group | null) => {
    gltfGroupRef.current = group;
    if (!group) return;

    group.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material && !Array.isArray(child.material)) {
        const origMat = child.material.clone();
        meshOriginalMaterialsRef.current.set(child, origMat);
        child.material = createWhitePlaceholderMaterial(origMat);
      }
    });

    group.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(group);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    modelDimensionsRef.current = [size.x || 1, size.y || 1, size.z || 1];
    if (!box.isEmpty()) {
      setModelCenter([center.x, center.y, center.z]);
    }

    setGltfLoaded(true);
  }, []);

  useEffect(() => {
    const group = gltfGroupRef.current;
    if (!group || !maps || !gltfLoaded || !mapsReady) return;

    const { originalMaterials } = collectSlots(group, maps);
    const preservedMaterials = new Map<number, THREE.Material>(originalMaterials);
    group.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        const slot = resolveMeshSlot(child, maps);
        const orig = meshOriginalMaterialsRef.current.get(child);
        if (slot !== null && orig) {
          preservedMaterials.set(slot, orig.clone());
        }
      }
    });
    originalMaterialsRef.current = preservedMaterials;
  }, [gltfLoaded, mapsReady, maps, processedUri]);

  useEffect(() => {
    const group = gltfGroupRef.current;
    if (!group || !gltfLoaded || !mapsReady) return;

    if (!maps) {
      group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const orig = meshOriginalMaterialsRef.current.get(child);
          if (orig && child.material !== orig) {
            child.material = orig;
          }
        }
      });
      setTexturesReady(true);
      return;
    }

    overrideVersionRef.current++;
    const currentVersion = overrideVersionRef.current;

    if (!textureLoaderRef.current) {
      textureLoaderRef.current = new THREE.TextureLoader();
    }

    const overrides = new Map<number, AppliedMaterial>();
    if (slotTextures) {
      for (const slotKey of Object.keys(slotTextures)) {
        const slot = Number(slotKey);
        const override = slotTextures[slot];
        if (override && override.fileURL) overrides.set(slot, override);
      }
    }

    let pendingCount = 0;
    setTexturesReady(false);

    const resolveLoad = () => {
      pendingCount--;
      if (pendingCount <= 0 && currentVersion === overrideVersionRef.current) {
        setTexturesReady(true);
      }
    };

    group.traverse((child) => {
      if (!(child instanceof THREE.Mesh) || !child.material) return;
      const orig = meshOriginalMaterialsRef.current.get(child);
      const slot = resolveMeshSlot(child, maps);
      if (slot === null) {
        if (orig && child.material !== orig) {
          child.material = orig;
        }
        return;
      }

      const override = overrides.get(slot);
      const origMat = originalMaterialsRef.current.get(slot) ?? orig;
      const baseMat = (origMat ?? child.material) as THREE.MeshStandardMaterial;

      if (override) {
        child.material = createWhitePlaceholderMaterial(baseMat);
        pendingCount++;
        textureLoaderRef.current!.load(
          override.fileURL,
          (texture) => {
            if (currentVersion !== overrideVersionRef.current) return;
            const newMat = baseMat.clone();
            if (baseMat.map) {
              texture.wrapS = baseMat.map.wrapS;
              texture.wrapT = baseMat.map.wrapT;
            } else {
              texture.wrapS = THREE.RepeatWrapping;
              texture.wrapT = THREE.RepeatWrapping;
            }
            const dim = modelDimensionsRef.current;
            if (
              override.scaleU > 0 &&
              override.scaleV > 0 &&
              texture.image?.width &&
              texture.image?.height
            ) {
              texture.repeat.set(
                (override.scaleU * dim[0]) / texture.image.width,
                (override.scaleV * dim[1]) / texture.image.height
              );
            }
            newMat.map = texture;
            newMat.needsUpdate = true;
            child.material = newMat;
            resolveLoad();
          },
          undefined,
          () => {
            if (currentVersion !== overrideVersionRef.current) return;
            if (origMat && child.material !== origMat) {
              child.material = origMat;
            }
            resolveLoad();
          }
        );
      } else {
        if (origMat && child.material !== origMat) {
          child.material = origMat;
        }
      }
    });

    if (pendingCount === 0) setTexturesReady(true);
  }, [gltfLoaded, mapsReady, maps, processedUri, slotTextures]);

  const captureReady = gltfLoaded && mapsReady && texturesReady;
  const canCapture = useCallback(() => captureReady, [captureReady]);

  useEffect(() => {
    onReadyChangeRef.current?.(captureReady);
  }, [captureReady]);

  const beforeCapture = useCallback((camera: THREE.Camera) => {
    flashResetRef.current?.();
    const group = gltfGroupRef.current;
    const persp = camera as THREE.PerspectiveCamera;
    if (!group || !persp) return;

    group.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(group);
    if (box.isEmpty()) return;

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const fitSpan = Math.max(size.x, size.y, size.z, 0.001);
    const halfFov = THREE.MathUtils.degToRad(persp.fov * 0.5);
    const distance = fitSpan / (0.7 * 2 * Math.tan(halfFov)) * 1.05;

    const direction = new THREE.Vector3(1, 1, 1).normalize();
    persp.position.copy(center).add(direction.multiplyScalar(distance));
    persp.up.set(0, 1, 0);
    persp.near = Math.max(distance / 100, 0.001);
    persp.far = distance * 100;
    persp.lookAt(center);
    persp.updateProjectionMatrix();
  }, []);

  const highlightMaps = (maps && gltfLoaded) ? maps : null;

  return (
    <View style={styles.container}>
      <Canvas
        camera={{ position: [1.4, 1.4, 1.4], fov: 40 }}
        style={{ background: '#e5e7eb' }}
        gl={{
          alpha: true,
          antialias: true,
          preserveDrawingBuffer: Platform.OS === 'web',
        }}
      >
        <PreviewEnvironment>
          {processedUri && (
            <Suspense
              fallback={
                <group>
                  <Box args={[0.5, 0.5, 0.5]}>
                    <meshStandardMaterial color="#ffffff" />
                  </Box>
                  <LoadingSpinner3D position={[0, 0, 0]} />
                </group>
              }
            >
              <Gltf
                src={processedUri}
                scale={0.01}
                ref={handleGltfReady}
              />
            </Suspense>
          )}
          {processedUri && !captureReady && (
            <LoadingSpinner3D position={modelCenter} />
          )}
          <SlotFlash
            groupRef={gltfGroupRef}
            maps={highlightMaps}
            highlightSlot={highlightSlot ?? null}
            resetRef={flashResetRef}
          />
          {captureApi && (
            <ThumbnailCaptureHost
              captureApi={captureApi}
              modelRef={gltfGroupRef}
              canCapture={canCapture}
              beforeCapture={beforeCapture}
            />
          )}
        </PreviewEnvironment>
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 300,
    borderRadius: 12,
    overflow: 'hidden',
  },
});