import { Billboard, Box, Gltf, ScreenSizer, Text, useTexture } from '@react-three/drei/native';
import { ThreeEvent, useFrame } from '@react-three/fiber';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import * as THREE from 'three';
import { ObjectMaterialType } from '../../../services/api';
import { normalizeTypeName, resolveMaterialValue } from '../../../services/designMaterialDefaults';
import { extractGlbParts, readGlbBytes, sanitizeNodeName } from '../../../services/glbParts';
import { fitScaleFromSize, measureModelSizeInParent } from '../../../services/modelFit';
import {
    buildSlotIndexMaps,
    collectSlots,
    MaterialSlotInfo,
    resolveMeshSlot,
    SlotIndexMaps,
} from '../../../services/materialSlots';
import { AppliedMaterial, DesignObject, GlobalMaterials, resolveGlobalMaterials } from './DesignObjects';
import ObjectMeasurements3D from './ObjectMeasurements3D';
import { Room3dProps } from './Room3d';
import { computeDragMove, MoveContext } from './moveBehaviours';
import { ObjectVariant, resolveActiveVariants, resolveVariantMeshes } from '../../../services/variants';

let globalIsDragging = false;

export function hashString(value: string): string {
    let hash = 5381;
    for (let i = 0; i < value.length; i++) {
        hash = ((hash << 5) + hash + value.charCodeAt(i)) | 0;
    }
    return (hash >>> 0).toString(36);
}

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

export function useDownload3dModel(remoteUrl: string, assetName: string = 'asset') {
    const [assetUri, setAssetUri] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!remoteUrl) {
            setIsLoading(false);
            return;
        }

        const loadAsset = async () => {
            setIsLoading(true);
            setError(null);

            if (Platform.OS === 'web' || remoteUrl.startsWith('file://') || remoteUrl.startsWith('blob:')) {
                setAssetUri(remoteUrl);
                setIsLoading(false);
                return;
            }

            try {
                const safeAssetName = assetName.replace(/[^a-zA-Z0-9._-]/g, '_');
                const cleanUrl = remoteUrl.split('?')[0];
                const dotIndex = cleanUrl.lastIndexOf('.');
                const ext = dotIndex !== -1 ? cleanUrl.substring(dotIndex) : '.glb';
                const filename = safeAssetName + ext;
                const localPath = FileSystem.documentDirectory + filename;

                const fileInfo = await FileSystem.getInfoAsync(localPath);
                if (fileInfo.exists) {
                    setAssetUri(localPath);
                    return;
                }

                const { uri } = await FileSystem.downloadAsync(remoteUrl, localPath);
                setAssetUri(uri);

            } catch (err) {
                setError(err as Error);
            } finally {
                setIsLoading(false);
            }
        };

        loadAsset();
    }, [remoteUrl, assetName]);

    return { localUri: assetUri, isLoading, error };
}

export function resolveSlotMaterial({
    slot,
    slotName,
    materialOverrides,
    instanceOverrides,
    globalMaterials,
    globalMaterialsRaw,
    resolvedGlobalIds,
    materialDataById,
    objectSlotTypes,
    typeToDesignSlot,
}: {
    slot: number;
    slotName: string;
    materialOverrides?: Record<number, string>;
    instanceOverrides?: Record<number, AppliedMaterial>;
    globalMaterials?: Record<string, AppliedMaterial>;
    globalMaterialsRaw?: GlobalMaterials;
    resolvedGlobalIds: Record<string, string>;
    materialDataById?: Record<string, AppliedMaterial>;
    objectSlotTypes?: ObjectMaterialType[] | null;
    typeToDesignSlot?: Record<string, string>;
}): { targetMaterialId?: string; override?: AppliedMaterial } {
    const slotType = objectSlotTypes?.find(t => t.slot === slot);
    const typeName = slotType?.materialTypeName || slotType?.materialTypeId || '';
    const designKey = typeName && typeToDesignSlot ? typeToDesignSlot[normalizeTypeName(typeName)] : undefined;

    let targetMaterialId: string | undefined;
    const rawOverride = materialOverrides?.[slot];
    if (rawOverride) {
        targetMaterialId = resolveMaterialValue(rawOverride, globalMaterialsRaw ?? {});
    }
    if (!targetMaterialId) {
        if (designKey && resolvedGlobalIds[designKey]) {
            targetMaterialId = resolvedGlobalIds[designKey];
        } else if (resolvedGlobalIds[slotName]) {
            targetMaterialId = resolvedGlobalIds[slotName];
        }
    }

    let override: AppliedMaterial | undefined = instanceOverrides?.[slot];
    if (!override && globalMaterials) {
        if (designKey && globalMaterials[designKey]) {
            override = globalMaterials[designKey];
        } else if (globalMaterials[slotName]) {
            override = globalMaterials[slotName];
        }
    }
    if (!override && targetMaterialId && materialDataById?.[targetMaterialId]) {
        override = materialDataById[targetMaterialId];
    }
    return { targetMaterialId, override };
}

function AdditiveVariantMesh({
    variant,
    modelScale,
    gltfHandlers,
    hideObject,
    isSelected,
    dimensions,
    materialOverrides,
    instanceOverrides,
    globalMaterials,
    globalMaterialsRaw,
    materialDataById,
    objectSlotTypes,
    typeToDesignSlot,
}: {
    variant: ObjectVariant;
    modelScale?: number;
    gltfHandlers: Record<string, any>;
    hideObject?: boolean;
    isSelected?: boolean;
    dimensions: [number, number, number];
    materialOverrides?: Record<number, string>;
    instanceOverrides?: Record<number, AppliedMaterial>;
    globalMaterials?: Record<string, AppliedMaterial>;
    globalMaterialsRaw?: GlobalMaterials;
    materialDataById?: Record<string, AppliedMaterial>;
    objectSlotTypes?: ObjectMaterialType[] | null;
    typeToDesignSlot?: Record<string, string>;
}) {
    const { localUri, isLoading, error } = useDownload3dModel(variant.fileURL, `${variant.id}:${hashString(variant.fileURL)}`);
    const groupRef = useRef<THREE.Group | null>(null);
    const edgeLinesRef = useRef<THREE.LineSegments[]>([]);
    const meshOriginalsRef = useRef<WeakMap<THREE.Mesh, THREE.Material>>(new WeakMap());
    const [groupVersion, setGroupVersion] = useState(0);
    const [slotMaps, setSlotMaps] = useState<SlotIndexMaps | null>(null);
    const [slotMapsReady, setSlotMapsReady] = useState(false);
    const applyVersionRef = useRef(0);

    const handleGltfReady = useCallback((group: THREE.Group | null) => {
        groupRef.current = group;
        if (!group) return;
        group.traverse((child) => {
            if (child instanceof THREE.Mesh && child.material && !Array.isArray(child.material)) {
                if (!meshOriginalsRef.current.has(child)) {
                    meshOriginalsRef.current.set(child, child.material.clone());
                }
            }
        });
        setGroupVersion(v => v + 1);
    }, []);

    useEffect(() => {
        if (!localUri) return;
        let cancelled = false;
        setSlotMapsReady(false);
        (async () => {
            try {
                const bytes = await readGlbBytes(localUri);
                const maps = buildSlotIndexMaps(extractGlbParts(bytes));
                if (!cancelled) setSlotMaps(maps);
            } catch (err) {
                console.warn('Failed to parse additive variant material slots:', err);
                if (!cancelled) setSlotMaps(null);
            } finally {
                if (!cancelled) setSlotMapsReady(true);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [localUri]);

    useEffect(() => {
        const group = groupRef.current;
        if (!group || !slotMapsReady) return;
        applyVersionRef.current++;
        const currentVersion = applyVersionRef.current;

        const restore = (mesh: THREE.Mesh) => {
            const orig = meshOriginalsRef.current.get(mesh);
            if (orig && mesh.material !== orig) mesh.material = orig;
        };

        if (!slotMaps) {
            group.traverse((child) => {
                if (child instanceof THREE.Mesh) restore(child);
            });
            return;
        }

        const resolvedGlobalIds = globalMaterialsRaw ? resolveGlobalMaterials(globalMaterialsRaw) : {};
        const loader = new THREE.TextureLoader();

        group.traverse((child) => {
            if (!(child instanceof THREE.Mesh) || !child.material) return;
            const orig = meshOriginalsRef.current.get(child);
            if (!orig) return;
            const slot = resolveMeshSlot(child, slotMaps);
            if (slot === null) {
                restore(child);
                return;
            }
            const slotName = orig.name || sanitizeNodeName(child.name);
            const { override } = resolveSlotMaterial({
                slot,
                slotName,
                materialOverrides,
                instanceOverrides,
                globalMaterials,
                globalMaterialsRaw,
                resolvedGlobalIds,
                materialDataById,
                objectSlotTypes,
                typeToDesignSlot,
            });
            if (!override || !override.fileURL) {
                restore(child);
                return;
            }
            const fileURL = override.fileURL;
            loader.load(
                fileURL,
                (texture) => {
                    if (currentVersion !== applyVersionRef.current) return;
                    texture.wrapS = THREE.RepeatWrapping;
                    texture.wrapT = THREE.RepeatWrapping;
                    if (override.scaleU > 0 && override.scaleV > 0 && texture.image?.width && texture.image?.height) {
                        texture.repeat.set(
                            (override.scaleU * dimensions[0]) / texture.image.width,
                            (override.scaleV * dimensions[1]) / texture.image.height
                        );
                    }
                    const newMat = orig.clone() as THREE.MeshStandardMaterial;
                    newMat.map = texture;
                    newMat.needsUpdate = true;
                    child.material = newMat;
                },
                undefined,
                () => {
                    if (currentVersion !== applyVersionRef.current) return;
                    restore(child);
                }
            );
        });
    }, [groupVersion, slotMaps, slotMapsReady, materialOverrides, instanceOverrides, globalMaterials, globalMaterialsRaw, materialDataById, objectSlotTypes, typeToDesignSlot, dimensions[0], dimensions[1], dimensions[2]]);

    useEffect(() => {
        const group = groupRef.current;
        if (!group) return;

        const lines: THREE.LineSegments[] = [];
        group.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                const edgeGeometry = new THREE.EdgesGeometry(child.geometry, 30);
                const line = new THREE.LineSegments(edgeGeometry, new THREE.LineBasicMaterial({ color: 'black' }));
                line.position.copy(child.position);
                line.rotation.copy(child.rotation);
                line.scale.copy(child.scale);
                line.visible = false;
                child.parent?.add(line);
                lines.push(line);
            }
        });
        edgeLinesRef.current = lines;

        return () => {
            lines.forEach((line) => {
                line.parent?.remove(line);
                line.geometry.dispose();
                (line.material as THREE.Material).dispose();
            });
            edgeLinesRef.current = [];
        };
    }, [localUri, groupVersion]);

    useEffect(() => {
        const group = groupRef.current;
        if (!group) return;
        group.traverse((child) => {
            if (child instanceof THREE.Mesh) child.visible = !hideObject;
        });
        edgeLinesRef.current.forEach((line) => {
            line.visible = !!hideObject || !!isSelected;
            const material = line.material as THREE.LineBasicMaterial;
            material.depthTest = !isSelected;
            line.renderOrder = isSelected ? 999 : 0;
        });
    }, [hideObject, isSelected, groupVersion]);

    if (isLoading || error || !localUri) return null;

    return (
        <Suspense fallback={null}>
            <Gltf
                key={localUri}
                ref={handleGltfReady}
                src={localUri}
                rotation={[0, -Math.PI / 2, 0]}
                scale={modelScale || 1}
                {...gltfHandlers}
            />
        </Suspense>
    );
}

export function DesignObject3D({
    obj, position, origin, dimensions, modelScale, rotation, onObjectInteraction, onDeselect, isSelected, onObjectEdited, onObjectDeleted, onEditObject, onObjectDuplicate, room3d, magnetEnabled, allObjects, onDragStateChange, onSlotsDiscovered, interactionDisabled, instanceOverrides, globalMaterials, globalMaterialsRaw, materialDataById, slotTypesByModel, typeToDesignSlot, forcedHidden, activeMeasurementSide, onSelectMeasurement, defaultHandleType
}: {
    obj: DesignObject,
    position: [number, number, number],
    origin: [number, number, number],
    dimensions: [number, number, number],
    modelScale?: number,
    rotation?: number,
    onObjectInteraction: (object: DesignObject) => void,
    onDeselect?: () => void,
    isSelected?: boolean,
    onObjectEdited?: (id: string, updates: { name: string, position: [number, number, number], rotation?: number, hidden?: boolean }) => void,
    onObjectDeleted?: (id: string) => void,
    onEditObject?: (object: DesignObject) => void,
    onObjectDuplicate?: (object: DesignObject) => void,
    room3d: Room3dProps,
    magnetEnabled: boolean,
    allObjects: DesignObject[],
    onDragStateChange?: (isDragging: boolean) => void,
    onSlotsDiscovered?: (id: string, slots: MaterialSlotInfo[]) => void,
    interactionDisabled?: boolean,
    instanceOverrides?: Record<number, AppliedMaterial>,
    globalMaterials?: Record<string, AppliedMaterial>,
    globalMaterialsRaw?: GlobalMaterials,
    materialDataById?: Record<string, AppliedMaterial>,
    slotTypesByModel?: Record<string, ObjectMaterialType[]>,
    typeToDesignSlot?: Record<string, string>,
    forcedHidden?: boolean,
    activeMeasurementSide?: import('../3dViewOverlay/EditMeasurementModal').MeasurementSide,
    onSelectMeasurement?: (side: import('../3dViewOverlay/EditMeasurementModal').MeasurementSide, currentValue: number) => void,
    defaultHandleType?: string | null
}) {
    const activeVariants = React.useMemo(
        () => resolveActiveVariants(obj.variants ?? [], obj.objectProperties?.defaultVariants, obj.selectedVariants, defaultHandleType),
        [obj.variants, obj.objectProperties?.defaultVariants, obj.selectedVariants, defaultHandleType]
    );
    const { primaryModelUrl, additiveMeshes } = React.useMemo(
        () => resolveVariantMeshes(obj.modelUrl, activeVariants),
        [obj.modelUrl, activeVariants]
    );
    const primaryVariantKey = React.useMemo(() => {
        const replaceVariant = [...activeVariants].reverse().find(v => v.mode === 'replace' && v.fileURL);
        return replaceVariant
            ? `${obj.id}:replace:${replaceVariant.id}:${hashString(primaryModelUrl)}`
            : `${obj.id}:primary:${hashString(primaryModelUrl)}`;
    }, [activeVariants, obj.id, primaryModelUrl]);
    const { localUri, isLoading, error } = useDownload3dModel(primaryModelUrl, primaryVariantKey);
    const [isDesktop, setIsDesktop] = useState(false);

    const [isDragging, setIsDragging] = useState(false);
    const [optionsOpen, setOptionsOpen] = useState(false);
    const dragStartPoint = useRef<THREE.Vector3>(new THREE.Vector3());
    const initialPosition = useRef<[number, number, number]>([0, 0, 0]);
    const prevIsSelectedRef = useRef(isSelected);

    const markerAsset = Asset.fromModule(require('../../../assets/images/move-marker.png'));
    const dragIconTexture = useTexture(markerAsset.uri);

    const deleteAsset = Asset.fromModule(require('../../../assets/images/delete-icon.png'));
    const deleteIconTexture = useTexture(deleteAsset.uri);

    const editAsset = Asset.fromModule(require('../../../assets/images/edit-icon.png'));
    const editIconTexture = useTexture(editAsset.uri);

    const duplicateAsset = Asset.fromModule(require('../../../assets/images/duplicate-icon.png'));
    const duplicateIconTexture = useTexture(duplicateAsset.uri);

    const eyeAsset = Asset.fromModule(require('../../../assets/images/eye-icon.png'));
    const eyeIconTexture = useTexture(eyeAsset.uri);

    const menuAsset = Asset.fromModule(require('../../../assets/images/menu-icon.png'));
    const menuIconTexture = useTexture(menuAsset.uri);

    const menuPanelAsset = Asset.fromModule(require('../../../assets/images/menu-panel.png'));
    const menuPanelTexture = useTexture(menuPanelAsset.uri);

    const gltfRef = useRef<THREE.Group | null>(null);
    const edgeLinesRef = useRef<THREE.LineSegments[]>([]);
    const meshOriginalMaterialsRef = useRef<WeakMap<THREE.Mesh, THREE.Material>>(new WeakMap());
    const originalMaterialsRef = useRef<Map<number, THREE.Material>>(new Map());
    const slotMapsRef = useRef<SlotIndexMaps | null>(null);
    const overrideVersionRef = useRef(0);
    const textureLoaderRef = useRef<THREE.TextureLoader | null>(null);
    const slotsDiscoveredRef = useRef(false);
    const [groupReady, setGroupReady] = useState(false);
    const [slotMapsReady, setSlotMapsReady] = useState(false);
    const [texturesResolved, setTexturesResolved] = useState(false);
    const [gltfVersion, setGltfVersion] = useState(0);
    const [modelFitSize, setModelFitSize] = useState<THREE.Vector3 | null>(null);
    const onSlotsDiscoveredRef = useRef(onSlotsDiscovered);
    onSlotsDiscoveredRef.current = onSlotsDiscovered;

    const handleGltfReady = useCallback((group: THREE.Group | null) => {
      gltfRef.current = group;
      if (!group) {
        setGroupReady(false);
        setTexturesResolved(false);
        setModelFitSize(null);
        return;
      }

      group.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material && !Array.isArray(child.material)) {
          const origMat = child.material.clone();
          meshOriginalMaterialsRef.current.set(child, origMat);
          child.material = createWhitePlaceholderMaterial(origMat);
        }
      });

      setTexturesResolved(false);
      setGroupReady(true);
      setGltfVersion(version => version + 1);
    }, []);

    useEffect(() => {
      const group = gltfRef.current;
      if (!group || !groupReady) {
        setModelFitSize(null);
        return;
      }
      setModelFitSize(measureModelSizeInParent(group));
    }, [gltfVersion, groupReady]);

    useEffect(() => {
      const group = gltfRef.current;
      if (!group || !groupReady) return;

      const lines: THREE.LineSegments[] = [];
      group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const edgeGeometry = new THREE.EdgesGeometry(child.geometry, 30);
          const line = new THREE.LineSegments(edgeGeometry, new THREE.LineBasicMaterial({ color: 'black' }));
          line.position.copy(child.position);
          line.rotation.copy(child.rotation);
          line.scale.copy(child.scale);
          line.visible = false;
          child.parent?.add(line);
          lines.push(line);
        }
      });
      edgeLinesRef.current = lines;

      return () => {
        lines.forEach((line) => {
          line.parent?.remove(line);
          line.geometry.dispose();
          (line.material as THREE.Material).dispose();
        });
        edgeLinesRef.current = [];
      };
    }, [groupReady, gltfVersion]);

    useEffect(() => {
      if (prevIsSelectedRef.current && !isSelected) {
        setOptionsOpen(false);
      }
      prevIsSelectedRef.current = isSelected;
    }, [isSelected]);

    useEffect(() => {
      const group = gltfRef.current;
      if (!group) return;
      const hide = !!obj.hidden || !!forcedHidden;
      group.traverse((child) => {
        if (child instanceof THREE.Mesh) child.visible = !hide;
      });
      edgeLinesRef.current.forEach((line) => {
        line.visible = hide || !!isSelected;
        const material = line.material as THREE.LineBasicMaterial;
        material.depthTest = !isSelected;
        line.renderOrder = isSelected ? 999 : 0;
      });
    }, [obj.hidden, groupReady, gltfVersion, forcedHidden, isSelected]);

    useEffect(() => {
      if (!localUri) return;
      let cancelled = false;
      setSlotMapsReady(false);
      (async () => {
        try {
          const bytes = await readGlbBytes(localUri);
          const parts = extractGlbParts(bytes);
          const maps = buildSlotIndexMaps(parts);
          if (cancelled) return;
          slotMapsRef.current = maps;
        } catch (err) {
          console.warn('Failed to parse GLB material slots:', err);
          if (cancelled) return;
          slotMapsRef.current = null;
        } finally {
          if (!cancelled) setSlotMapsReady(true);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [localUri]);

    useEffect(() => {
      const group = gltfRef.current;
      const maps = slotMapsRef.current;
      if (!group || !maps || !slotMapsReady) return;

      const { slots, originalMaterials } = collectSlots(group, maps);
      const preservedMaterials = new Map<number, THREE.Material>(originalMaterials);
      group.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          const slot = resolveMeshSlot(child, maps);
          const orig = meshOriginalMaterialsRef.current.get(child);
          if (slot !== null && orig && !preservedMaterials.has(slot)) {
            preservedMaterials.set(slot, orig.clone());
          } else if (slot !== null && orig) {
            preservedMaterials.set(slot, orig.clone());
          }
        }
      });
      originalMaterialsRef.current = preservedMaterials;
      if (slots.length > 0 && !slotsDiscoveredRef.current) {
        slotsDiscoveredRef.current = true;
        onSlotsDiscoveredRef.current?.(obj.id, slots);
      }
    }, [groupReady, gltfVersion, slotMapsReady, obj.id]);

    const modelKey = `${obj.modelId}:${obj.version}`;
    const objectSlotTypes = slotTypesByModel ? slotTypesByModel[modelKey] ?? null : undefined;

    useEffect(() => {
      const group = gltfRef.current;
      const maps = slotMapsRef.current;
      if (!group || !localUri || !groupReady) return;

      if (!slotMapsReady || (obj.modelId && slotTypesByModel && objectSlotTypes === undefined)) {
        setTexturesResolved(false);
        return;
      }

      if (!maps) {
        group.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const orig = meshOriginalMaterialsRef.current.get(child);
            if (orig && child.material !== orig) {
              child.material = orig;
            }
          }
        });
        setTexturesResolved(true);
        return;
      }

      overrideVersionRef.current++;
      const currentVersion = overrideVersionRef.current;

      if (!textureLoaderRef.current) textureLoaderRef.current = new THREE.TextureLoader();

      const resolvedGlobalIds = globalMaterialsRaw ? resolveGlobalMaterials(globalMaterialsRaw) : {};
      let pendingCount = 0;
      let waitingForMaterialData = false;

      const resolveOne = () => {
        pendingCount--;
        if (pendingCount <= 0 && !waitingForMaterialData && currentVersion === overrideVersionRef.current) {
          setTexturesResolved(true);
        }
      };

      group.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          const orig = meshOriginalMaterialsRef.current.get(child) ?? originalMaterialsRef.current.get(resolveMeshSlot(child, maps) ?? -1);
          const baseMat = (orig ?? child.material) as THREE.MeshStandardMaterial;
          const slotName = baseMat.name || sanitizeNodeName(child.name);
          const slot = resolveMeshSlot(child, maps);
          if (slot === null) {
            if (orig && child.material !== orig) {
              child.material = orig;
            }
            return;
          }

          const { targetMaterialId, override } = resolveSlotMaterial({
            slot,
            slotName,
            materialOverrides: obj.materialOverrides,
            instanceOverrides,
            globalMaterials,
            globalMaterialsRaw,
            resolvedGlobalIds,
            materialDataById,
            objectSlotTypes,
            typeToDesignSlot,
          });

          if (targetMaterialId && (!override || !override.fileURL)) {
            waitingForMaterialData = true;
            child.material = createWhitePlaceholderMaterial(baseMat);
            return;
          }

          if (override && override.fileURL) {
            const placeholderMat = createWhitePlaceholderMaterial(baseMat) as THREE.MeshStandardMaterial;
            child.material = placeholderMat;
            pendingCount++;

            textureLoaderRef.current!.load(
              override.fileURL,
              (texture) => {
                if (currentVersion !== overrideVersionRef.current) return;

                const newMat = baseMat.clone();
                texture.wrapS = THREE.RepeatWrapping;
                texture.wrapT = THREE.RepeatWrapping;

                if (
                  override.scaleU > 0 &&
                  override.scaleV > 0 &&
                  texture.image?.width &&
                  texture.image?.height
                ) {
                  texture.repeat.set(
                    (override.scaleU * dimensions[0]) / texture.image.width,
                    (override.scaleV * dimensions[1]) / texture.image.height
                  );
                }

                newMat.map = texture;
                newMat.needsUpdate = true;
                child.material = newMat;
                resolveOne();
              },
              undefined,
              () => {
                if (currentVersion !== overrideVersionRef.current) return;
                if (orig && child.material !== orig) {
                  child.material = orig;
                }
                resolveOne();
              }
            );
          } else {
            const slotOrig = originalMaterialsRef.current.get(slot) ?? orig;
            if (slotOrig && child.material !== slotOrig) {
              child.material = slotOrig;
            }
          }
        }
      });

      if (pendingCount === 0 && !waitingForMaterialData) {
        setTexturesResolved(true);
      } else {
        setTexturesResolved(false);
      }
    }, [instanceOverrides, globalMaterials, globalMaterialsRaw, materialDataById, obj.materialOverrides, obj.modelId, localUri, dimensions[0], dimensions[1], dimensions[2], slotMapsReady, groupReady, gltfVersion, objectSlotTypes, slotTypesByModel, typeToDesignSlot]);

    const isDraggingRef = useRef(false);
    const onDragStateChangeRef = useRef(onDragStateChange);
    onDragStateChangeRef.current = onDragStateChange;

    const [dragPreview, setDragPreview] = useState<{
        position: [number, number, number];
        rotation: number;
    } | null>(null);
    const dragPreviewRef = useRef<{
        position: [number, number, number];
        rotation: number;
    } | null>(null);

    const commitDragMove = useCallback(() => {
        if (!isDraggingRef.current) return;
        isDraggingRef.current = false;
        const finalMove = dragPreviewRef.current;
        dragPreviewRef.current = null;
        setDragPreview(null);
        setIsDragging(false);
        globalIsDragging = false;
        onDragStateChangeRef.current?.(false);
        if (finalMove && onObjectEdited) {
            onObjectEdited(obj.id, {
                name: obj.name,
                position: finalMove.position,
                rotation: finalMove.rotation,
            });
        }
    }, [obj.id, obj.name, onObjectEdited]);

    useEffect(() => {
        if (Platform.OS === 'web') {
            if (!/Mobi|Android/i.test(navigator.userAgent)) {
                setIsDesktop(true);
            }

            const handleGlobalMouseUp = () => {
                if (isDraggingRef.current) {
                    commitDragMove();
                }
            };
            window.addEventListener('pointerup', handleGlobalMouseUp);
            window.addEventListener('pointercancel', handleGlobalMouseUp);
            return () => {
                window.removeEventListener('pointerup', handleGlobalMouseUp);
                window.removeEventListener('pointercancel', handleGlobalMouseUp);
            };
        }
    }, [commitDragMove]);

    const longPressTimer = useRef<any>(null);
    const longPressTriggered = useRef(false);
    const pointerDownPosition = useRef<{ x: number, y: number } | null>(null);
    const pointerMovedRef = useRef(false);

    const handleInteraction = React.useCallback((e?: any) => {
        if (e) e.stopPropagation();
        console.log("Object interaction from remote3dModel");
        onObjectInteraction(obj);
    }, [obj, onObjectInteraction]);

    const handleContextMenu = React.useCallback((e: ThreeEvent<MouseEvent>) => {
        if (globalIsDragging) return;
        if (e.nativeEvent?.preventDefault) {
            e.nativeEvent.preventDefault();
        }
        if ((e as any).preventDefault) {
            (e as any).preventDefault();
        }
        e.stopPropagation();
        handleInteraction(e);
        setOptionsOpen(true);
    }, [handleInteraction]);

    const effectivePosition = dragPreview ? dragPreview.position : position;
    const effectiveRotation = dragPreview ? dragPreview.rotation : (rotation || 0);
    const effectiveObj = React.useMemo(
        () => (dragPreview ? { ...obj, position: dragPreview.position, rotation: dragPreview.rotation } : obj),
        [obj, dragPreview]
    );

    const boxPosition: [number, number, number] = [
        origin[0] + effectivePosition[0] + dimensions[0] / 2,
        origin[1] + effectivePosition[1] + dimensions[1] / 2,
        origin[2] + effectivePosition[2] + dimensions[2] / 2
    ];

    const modelPosition: [number, number, number] = [
        origin[0] + effectivePosition[0],
        origin[1] + effectivePosition[1],
        origin[2] + effectivePosition[2]
    ];

    const handlePointerDown = (e: any) => {
        e.stopPropagation();
        pointerMovedRef.current = false;
        pointerDownPosition.current = { x: e.clientX, y: e.clientY };
        if (isDesktop) return;
        longPressTriggered.current = false;
        longPressTimer.current = setTimeout(() => {
            e.stopPropagation();
            longPressTriggered.current = true;
            handleInteraction(e);
            longPressTimer.current = null;
            pointerDownPosition.current = null;
        }, 500);
    };

    const handlePointerUp = (e: any) => {
        e.stopPropagation();
        pointerDownPosition.current = null;
        if (isDesktop) return;
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    };

    const handlePointerMove = (e: any) => {
        e.stopPropagation();
        if (!pointerDownPosition.current) return;
        const deltaX = Math.abs(e.clientX - pointerDownPosition.current.x);
        const deltaY = Math.abs(e.clientY - pointerDownPosition.current.y);
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        if (distance > 5) {
            pointerMovedRef.current = true;
        }
        if (isDesktop) return;
        if (longPressTimer.current && distance > 10) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
            pointerDownPosition.current = null;
        }
    };

    const handlePointerLeave = (e: any) => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
            pointerDownPosition.current = null;
        }
    };

    const handleDragMove = (e: any) => {
        e.stopPropagation();
        if (!onObjectEdited) return;

        const delta = e.point.clone().sub(dragStartPoint.current);
        const mouseX = e.point.x - origin[0];
        const mouseZ = e.point.z - origin[2];

        const ctx: MoveContext = {
            objectId: obj.id,
            origin,
            initialPosition: [...initialPosition.current],
            objectRotation: effectiveRotation,
            objectDimensions: dimensions,
            objectProperties: obj.objectProperties,
            room3d,
            magnetEnabled,
            allObjects,
        };

        const result = computeDragMove(ctx, delta.x, delta.z, mouseX, mouseZ);

        if (result.resetDragPoint) {
            dragStartPoint.current.copy(e.point);
            initialPosition.current = [result.newX, result.newY, result.newZ];
        }

        const nextMove = {
            position: [result.newX, result.newY, result.newZ] as [number, number, number],
            rotation: result.newRot,
        };
        dragPreviewRef.current = nextMove;
        setDragPreview(nextMove);
    };

    const handleCardPress = (e: any) => {
        e.stopPropagation();
        const local = e.object.worldToLocal(e.point.clone());
        const rows: [number, (ev: any) => void][] = [
            [-0.75, handleEditRowClick],
            [-0.25, handleDuplicateRowClick],
            [0.25, handleHideRowClick],
            [0.75, handleDeleteRowClick],
        ];
        const hit = rows.find(([y]) => Math.abs(local.y - y) <= 0.24);
        if (hit) hit[1](e);
    };

    const handleEditRowClick = (e: any) => {
        e.stopPropagation();
        setOptionsOpen(false);
        if (onEditObject) onEditObject(obj);
    };

    const handleDuplicateRowClick = (e: any) => {
        e.stopPropagation();
        setOptionsOpen(false);
        if (onObjectDuplicate) onObjectDuplicate(obj);
    };

    const handleHideRowClick = (e: any) => {
        e.stopPropagation();
        setOptionsOpen(false);
        if (onObjectEdited) onObjectEdited(obj.id, {
            name: obj.name,
            position: obj.position,
            hidden: !obj.hidden,
        });
    };

    const handleDeleteRowClick = (e: any) => {
        e.stopPropagation();
        setOptionsOpen(false);
        if (Platform.OS === 'web') {
            if (window.confirm('Are you sure you want to delete this object?')) {
                if (onObjectDeleted) onObjectDeleted(obj.id);
            }
        } else {
            Alert.alert('Delete Object', 'Are you sure you want to delete this object?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => {
                    if (onObjectDeleted) onObjectDeleted(obj.id);
                }},
            ]);
        }
    };

    const hideObject = !!obj.hidden || !!forcedHidden;

    const gltfHandlers = {
      onContextMenu: handleContextMenu,
      onClick: (e: any) => {
        if (globalIsDragging) return;
        e.stopPropagation();
        if (pointerMovedRef.current) {
          pointerMovedRef.current = false;
          return;
        }
        if (longPressTriggered.current) {
          longPressTriggered.current = false;
          return;
        }
        if (isSelected) {
          if (optionsOpen) {
            setOptionsOpen(false);
          }
        } else {
          onDeselect?.();
        }
      },
      onDoubleClick: (e: any) => {
        if (globalIsDragging) return;
        e.stopPropagation();
        if (isDesktop) handleInteraction(e);
      },
      onPointerDown: (e: any) => {
        if (globalIsDragging) return;
        handlePointerDown(e);
      },
      onPointerUp: (e: any) => {
        if (globalIsDragging) return;
        handlePointerUp(e);
      },
      onPointerMove: (e: any) => {
        if (globalIsDragging) return;
        handlePointerMove(e);
      },
      onPointerLeave: (e: any) => {
        if (globalIsDragging) return;
        handlePointerLeave(e);
      }
    };

    if (isLoading) {
        return (
            <group>
                <Box key={obj.id} position={boxPosition} args={dimensions} visible={!hideObject} {...gltfHandlers}>
                    <meshStandardMaterial attach="material" color="#ffffff" />
                </Box>
                {!hideObject && <LoadingSpinner3D position={boxPosition} />}
            </group>
        );
    }

    if (error || !localUri) {
        return (
            <Box key={obj.id} position={boxPosition} args={dimensions} {...gltfHandlers}>
                <meshStandardMaterial attach="material" color="red" />
            </Box>
        );
    }

    const currentAngle = effectiveRotation;
    const movingBehaviour = obj.objectProperties?.movingBehaviour;
    const isFreeMode = movingBehaviour !== 'counter' && movingBehaviour !== 'cupboard';

    const planeOffsetX = (dimensions[0] / 2) * Math.cos(currentAngle) + (dimensions[2] / 2) * Math.sin(currentAngle);
    const planeOffsetZ = -(dimensions[0] / 2) * Math.sin(currentAngle) + (dimensions[2] / 2) * Math.cos(currentAngle);

     const meshRotation: [number, number, number] = isFreeMode
         ? [-Math.PI / 2, 0, 0]
         : [0, currentAngle, 0];
 
     const meshPosition: [number, number, number] = isFreeMode
         ? [
               origin[0] + initialPosition.current[0] + dimensions[0] / 2,
               origin[1],
               origin[2] + initialPosition.current[2] + dimensions[2] / 2
           ]
         : [
               origin[0] + initialPosition.current[0] + planeOffsetX,
               origin[1],
               origin[2] + initialPosition.current[2] + planeOffsetZ
           ];
 


     const fitScale: [number, number, number] = fitScaleFromSize(modelFitSize, dimensions) ?? [1, 1, 1];
     const isTextureLoading = !groupReady || !slotMapsReady || !texturesResolved;
 
     return (
         <group>
             <group position={modelPosition} rotation={[0, effectiveRotation, 0]}>
                 <group scale={fitScale}>
                     <Suspense fallback={null}>
                         <Gltf
                             key={localUri}
                             ref={handleGltfReady}
                             src={localUri}
                             rotation={[0, -Math.PI / 2, 0]}
                             scale={modelScale || 1}
                             {...gltfHandlers}
                         />
                     </Suspense>
                     {additiveMeshes.map((variant) => (
                         <AdditiveVariantMesh
                             key={variant.id}
                             variant={variant}
                             modelScale={modelScale}
                             gltfHandlers={gltfHandlers}
                             hideObject={hideObject}
                             isSelected={isSelected}
                             dimensions={dimensions}
                             materialOverrides={obj.materialOverrides}
                             instanceOverrides={instanceOverrides}
                             globalMaterials={globalMaterials}
                             globalMaterialsRaw={globalMaterialsRaw}
                             materialDataById={materialDataById}
                             objectSlotTypes={objectSlotTypes}
                             typeToDesignSlot={typeToDesignSlot}
                         />
                     ))}
                 </group>

                 {isTextureLoading && !hideObject && (
                     <LoadingSpinner3D position={[dimensions[0] / 2, dimensions[1] / 2, dimensions[2] / 2]} />
                 )}

                 {(isSelected &&
                     <group>
                         <ScreenSizer
                             position={[dimensions[0] / 2, -0.2, dimensions[2] + 0.2]}
                             scale={0.75 * uiPixelScale}
                             onPointerDown={(e) => {
                                 e.stopPropagation();
                                 if (isDraggingRef.current) return;
                                 const startMove = {
                                     position: [...position] as [number, number, number],
                                     rotation: rotation || 0,
                                 };
                                 isDraggingRef.current = true;
                                 dragPreviewRef.current = startMove;
                                 setDragPreview(startMove);
                                 setIsDragging(true);
                                 globalIsDragging = true;
                                 dragStartPoint.current.copy(e.point);
                                 initialPosition.current = [...position];
                                 if (onDragStateChange) onDragStateChange(true);
                             }}
                         >
                             <sprite scale={[1, 1, 1]} renderOrder={995}>
                                 <spriteMaterial
                                     map={dragIconTexture}
                                     color="white"
                                     depthTest={false}
                                     transparent={true}
                                 />
                             </sprite>
                         </ScreenSizer>
                         {!optionsOpen && (
                            <ScreenSizer
                                position={[dimensions[0] / 2, dimensions[1] + 0.2, 0]}
                                scale={0.66 * uiPixelScale}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setOptionsOpen(true);
                                }}
                                onPointerDown={(e) => {
                                    e.stopPropagation();
                                }}
                                onContextMenu={(e: any) => {
                                    if (e.nativeEvent?.preventDefault) e.nativeEvent.preventDefault();
                                    if (e.preventDefault) e.preventDefault();
                                    e.stopPropagation();
                                    setOptionsOpen(true);
                                }}
                            >
                                <sprite scale={[1, 1, 1]} renderOrder={995}>
                                    <spriteMaterial
                                        map={menuIconTexture}
                                        color="#111827"
                                        depthTest={false}
                                        transparent={true}
                                    />
                                </sprite>
                            </ScreenSizer>
                        )}
                        {optionsOpen && (
                            <ScreenSizer
                                position={[dimensions[0] / 2, dimensions[1] + 1.2, 0]}
                                scale={uiPixelScale}
                            >
                                <Billboard>
                                    <sprite
                                        position={[0, 0, 0]}
                                        scale={[2.2, 2.6, 1]}
                                        renderOrder={996}
                                    >
                                        <spriteMaterial
                                            map={menuPanelTexture}
                                            depthTest={false}
                                            transparent={true}
                                            opacity={1}
                                        />
                                    </sprite>
                                    <mesh
                                        position={[0, 0, 0.05]}
                                        renderOrder={997}
                                        onClick={handleCardPress}
                                        onPointerDown={(e) => {
                                            e.stopPropagation();
                                        }}
                                        onContextMenu={(e: any) => {
                                            if (e.nativeEvent?.preventDefault) e.nativeEvent.preventDefault();
                                            if (e.preventDefault) e.preventDefault();
                                            e.stopPropagation();
                                        }}
                                    >
                                        <planeGeometry args={[2.2, 2.6]} />
                                        <meshBasicMaterial transparent opacity={0} depthTest={false} side={2} />
                                    </mesh>
                                    <group position={[-0.55, -0.75, 0]}>
                                        <sprite
                                            scale={[0.28, 0.28, 0.28]}
                                            renderOrder={997}
                                        >
                                            <spriteMaterial
                                                map={editIconTexture}
                                                color="#111827"
                                                depthTest={false}
                                                transparent={true}
                                            />
                                        </sprite>
                                        <Text
                                            position={[0.32, 0, 0]}
                                            fontSize={0.2}
                                            color="#111827"
                                            anchorX="left"
                                            anchorY="middle"
                                            renderOrder={998}
                                            material-depthTest={false}
                                            material-transparent={true}
                                        >
                                            Edit
                                        </Text>
                                    </group>
                                    <group position={[-0.55, -0.25, 0]}>
                                        <sprite
                                            scale={[0.28, 0.28, 0.28]}
                                            renderOrder={997}
                                        >
                                            <spriteMaterial
                                                map={duplicateIconTexture}
                                                color="#111827"
                                                depthTest={false}
                                                transparent={true}
                                            />
                                        </sprite>
                                        <Text
                                            position={[0.32, 0, 0]}
                                            fontSize={0.2}
                                            color="#111827"
                                            anchorX="left"
                                            anchorY="middle"
                                            renderOrder={998}
                                            material-depthTest={false}
                                            material-transparent={true}
                                        >
                                            Duplicate
                                        </Text>
                                    </group>
                                    <group position={[-0.55, 0.25, 0]}>
                                        <sprite
                                            scale={[0.28, 0.28, 0.28]}
                                            renderOrder={997}
                                        >
                                            <spriteMaterial
                                                map={eyeIconTexture}
                                                color="#111827"
                                                depthTest={false}
                                                transparent={true}
                                            />
                                        </sprite>
                                        <Text
                                            position={[0.32, 0, 0]}
                                            fontSize={0.2}
                                            color="#111827"
                                            anchorX="left"
                                            anchorY="middle"
                                            renderOrder={998}
                                            material-depthTest={false}
                                            material-transparent={true}
                                        >
                                            {obj.hidden ? 'Show' : 'Hide'}
                                        </Text>
                                    </group>
                                    <group position={[-0.55, 0.75, 0]}>
                                        <sprite
                                            scale={[0.28, 0.28, 0.28]}
                                            renderOrder={997}
                                        >
                                            <spriteMaterial
                                                map={deleteIconTexture}
                                                color="#dc2626"
                                                depthTest={false}
                                                transparent={true}
                                            />
                                        </sprite>
                                        <Text
                                            position={[0.32, 0, 0]}
                                            fontSize={0.2}
                                            color="#dc2626"
                                            anchorX="left"
                                            anchorY="middle"
                                            renderOrder={998}
                                            material-depthTest={false}
                                            material-transparent={true}
                                        >
                                            Delete
                                        </Text>
                                    </group>
                                </Billboard>
                            </ScreenSizer>
                        )}
                        
                        {/* Measurements - show when object is selected */}
                         <ObjectMeasurements3D
                             object={effectiveObj}
                             allObjects={allObjects}
                             room3d={room3d}
                             origin={origin}
                             activeSide={activeMeasurementSide}
                             onSelectMeasurement={onSelectMeasurement}
                         />
                     </group>
                 )}
            </group>

            {isDragging && onObjectEdited && (
                <mesh
                    rotation={meshRotation}
                    position={meshPosition}
                    visible={false}
                    onPointerMove={handleDragMove}
                    onPointerUp={(e) => {
                        e.stopPropagation();
                        commitDragMove();
                    }}
                >
                    <planeGeometry args={[1000, 1000]} />
                </mesh>
            )}
        </group>
    );
}
