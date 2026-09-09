import { Box, Gltf, useTexture } from '@react-three/drei/native';
import ObjectMeasurements3D from './ObjectMeasurements3D';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import * as THREE from 'three';
import { DesignObject } from './DesignObjects';
import { Room3dProps } from './Room3d';
import { MoveContext, computeDragMove } from './moveBehaviours';
import {
  buildSlotIndexMaps,
  collectSlots,
  MaterialSlotInfo,
  resolveMeshSlot,
  resolveSlotName,
  SlotIndexMaps,
} from '../../../services/materialSlots';
import { extractGlbParts, readGlbBytes } from '../../../services/glbParts';

let globalIsDragging = false;

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

            if (Platform.OS === 'web') {
                setAssetUri(remoteUrl);
                setIsLoading(false);
                return;
            }

            try {
                const filename = assetName + remoteUrl.substring(remoteUrl.lastIndexOf('.'));
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

export function DesignObject3D({
    obj, position, origin, dimensions, modelScale, rotation, onObjectInteraction, isSelected, onObjectEdited, onObjectDeleted, onEditObject, room3d, magnetEnabled, allObjects, onDragStateChange, onSlotsDiscovered, interactionDisabled
}: {
    obj: DesignObject,
    position: [number, number, number],
    origin: [number, number, number],
    dimensions: [number, number, number],
    modelScale?: number,
    rotation?: number,
    onObjectInteraction: (object: DesignObject) => void,
    isSelected?: boolean,
    onObjectEdited?: (id: string, updates: { name: string, position: [number, number, number], rotation?: number }) => void,
    onObjectDeleted?: (id: string) => void,
    onEditObject?: (object: DesignObject) => void,
    room3d: Room3dProps,
    magnetEnabled: boolean,
    allObjects: DesignObject[],
    onDragStateChange?: (isDragging: boolean) => void,
    onSlotsDiscovered?: (id: string, slots: MaterialSlotInfo[]) => void,
    interactionDisabled?: boolean
}) {
    const url = obj.modelUrl;
    const { localUri, isLoading, error } = useDownload3dModel(url, obj.id);
    const [isDesktop, setIsDesktop] = useState(false);

    const [isDragging, setIsDragging] = useState(false);
    const dragStartPoint = useRef<THREE.Vector3>(new THREE.Vector3());
    const initialPosition = useRef<[number, number, number]>([0, 0, 0]);

    const markerAsset = Asset.fromModule(require('../../../assets/images/move-marker.png'));
    const dragIconTexture = useTexture(markerAsset.uri);

    const deleteAsset = Asset.fromModule(require('../../../assets/images/delete-icon.png'));
    const deleteIconTexture = useTexture(deleteAsset.uri);

    const editAsset = Asset.fromModule(require('../../../assets/images/edit-icon.png'));
    const editIconTexture = useTexture(editAsset.uri);

    const gltfRef = useRef<THREE.Group | null>(null);
    const originalMaterialsRef = useRef<Map<number, THREE.Material>>(new Map());
    const slotMapsRef = useRef<SlotIndexMaps | null>(null);
    const overrideVersionRef = useRef(0);
    const textureLoaderRef = useRef<THREE.TextureLoader | null>(null);
    const slotsDiscoveredRef = useRef(false);
    const [groupReady, setGroupReady] = useState(false);
    const [slotMapsReady, setSlotMapsReady] = useState(false);
    const onSlotsDiscoveredRef = useRef(onSlotsDiscovered);
    onSlotsDiscoveredRef.current = onSlotsDiscovered;

    const handleGltfReady = useCallback((group: THREE.Group | null) => {
      gltfRef.current = group;
      if (!group) {
        setGroupReady(false);
        return;
      }

      group.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          (child as THREE.Mesh).material = child.material.clone();
        }
      });

      setGroupReady(true);
    }, []);

    useEffect(() => {
      if (!localUri) return;
      let cancelled = false;
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
      originalMaterialsRef.current = originalMaterials;
      if (slots.length > 0 && !slotsDiscoveredRef.current) {
        slotsDiscoveredRef.current = true;
        onSlotsDiscoveredRef.current?.(obj.id, slots);
      }
    }, [groupReady, slotMapsReady, obj.id]);

    useEffect(() => {
      const group = gltfRef.current;
      const maps = slotMapsRef.current;
      if (!group || !maps || !localUri || !slotMapsReady) return;

      overrideVersionRef.current++;
      const currentVersion = overrideVersionRef.current;

      const overrides = obj.textureOverrides || [];
      const combined = new Map<number, { fileURL: string; scaleU: number; scaleV: number }>();
      for (const ov of overrides) {
        let slot = typeof ov.slot === 'number' ? ov.slot : -1;
        if (slot < 0 && ov.legacyMeshName) {
          slot = resolveSlotName(ov.legacyMeshName, maps) ?? -1;
        }
        if (slot < 0) continue;
        combined.set(slot, { fileURL: ov.fileURL, scaleU: ov.scaleU, scaleV: ov.scaleV });
      }

      if (!textureLoaderRef.current) textureLoaderRef.current = new THREE.TextureLoader();

      if (combined.size === 0) {
        group.traverse((child) => {
          if (child instanceof THREE.Mesh && child.material) {
            const slot = resolveMeshSlot(child, maps);
            if (slot === null) return;
            const orig = originalMaterialsRef.current.get(slot);
            if (orig && child.material !== orig) {
              child.material = orig;
            }
          }
        });
        return;
      }

      group.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          const slot = resolveMeshSlot(child, maps);
          if (slot === null) return;
          const override = combined.get(slot);
          if (override && override.fileURL) {
            textureLoaderRef.current!.load(override.fileURL, (texture) => {
              if (currentVersion !== overrideVersionRef.current) return;
              const newMat = (child.material as THREE.MeshStandardMaterial).clone();

              const origMat = originalMaterialsRef.current.get(slot) as THREE.MeshStandardMaterial | undefined;
              const origMap = origMat?.map;
              if (origMap) {
                texture.wrapS = origMap.wrapS;
                texture.wrapT = origMap.wrapT;
              } else {
                texture.wrapS = THREE.RepeatWrapping;
                texture.wrapT = THREE.RepeatWrapping;
              }

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
            });
          } else {
            const orig = originalMaterialsRef.current.get(slot);
            if (orig && child.material !== orig) {
              child.material = orig;
            }
          }
        }
      });
    }, [obj.textureOverrides, localUri, dimensions, slotMapsReady, groupReady]);

    useEffect(() => {
        if (Platform.OS === 'web') {
            if (!/Mobi|Android/i.test(navigator.userAgent)) {
                setIsDesktop(true);
            }

            const handleGlobalMouseUp = () => {
                if (isDragging) {setIsDragging(false);globalIsDragging = false;}
            };
            window.addEventListener('pointerup', handleGlobalMouseUp);
            window.addEventListener('pointercancel', handleGlobalMouseUp);
            return () => {
                window.removeEventListener('pointerup', handleGlobalMouseUp);
                window.removeEventListener('pointercancel', handleGlobalMouseUp);
            };
        }
    }, [isDragging]);

    const longPressTimer = useRef<NodeJS.Timeout | null>(null);
    const pointerDownPosition = useRef<{ x: number, y: number } | null>(null);

    const handleInteraction = React.useCallback((e?: any) => {
        if (e) e.stopPropagation();
        console.log("Object interaction from remote3dModel");
        onObjectInteraction(obj);
    }, [obj, onObjectInteraction]);

    const boxPosition: [number, number, number] = [
        origin[0] + position[0] + dimensions[0] / 2,
        origin[1] + position[1] + dimensions[1] / 2,
        origin[2] + position[2] + dimensions[2] / 2
    ];

    const modelPosition: [number, number, number] = [
        origin[0] + position[0],
        origin[1] + position[1],
        origin[2] + position[2]
    ];

    const handlePointerDown = (e: any) => {
        e.stopPropagation();
        if (isDesktop) return;
        pointerDownPosition.current = { x: e.clientX, y: e.clientY };
        longPressTimer.current = setTimeout(() => {
            e.stopPropagation();
            handleInteraction(e);
            longPressTimer.current = null;
            pointerDownPosition.current = null;
        }, 500);
    };

    const handlePointerUp = (e: any) => {
        e.stopPropagation();
        if (isDesktop) return;
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
        pointerDownPosition.current = null;
    };

    const handlePointerMove = (e: any) => {
        e.stopPropagation();
        if (isDesktop || !pointerDownPosition.current) return;
        if (longPressTimer.current) {
            const deltaX = Math.abs(e.clientX - pointerDownPosition.current.x);
            const deltaY = Math.abs(e.clientY - pointerDownPosition.current.y);
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            if (distance > 10) {
                clearTimeout(longPressTimer.current);
                longPressTimer.current = null;
                pointerDownPosition.current = null;
            }
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
            objectRotation: rotation || 0,
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

        onObjectEdited(obj.id, {
            name: obj.name,
            position: [result.newX, result.newY, result.newZ],
            rotation: result.newRot,
        });
    };

    if (isLoading) {
        return (
            <Box key={obj.id} position={boxPosition} args={dimensions} >
                <meshStandardMaterial attach="material" color="black" />
            </Box>
        );
    }

    if (error || !localUri) {
        return (
            <Box key={obj.id} position={boxPosition} args={dimensions} >
                <meshStandardMaterial attach="material" color="red" />
            </Box>
        );
    }

    const currentAngle = rotation || 0;
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
 
     // Conditional event handlers: disable interaction when another object is selected
     const gltfHandlers = interactionDisabled ? {} : {
       onClick: (e) => {
         if (globalIsDragging) return;
         e.stopPropagation();
       },
       onDoubleClick: (e) => {
         if (globalIsDragging) return;
         e.stopPropagation();
         if (isDesktop) handleInteraction(e);
       },
       onPointerDown: (e) => {
         if (globalIsDragging) return;
         handlePointerDown(e);
       },
       onPointerUp: (e) => {
         if (globalIsDragging) return;
         handlePointerUp(e);
       },
       onPointerMove: (e) => {
         if (globalIsDragging) return;
         handlePointerMove(e);
       },
       onPointerLeave: (e) => {
         if (globalIsDragging) return;
         handlePointerLeave(e);
       }
     };
 
     return (
         <group>
             <group position={modelPosition} rotation={[0, rotation || 0, 0]}>
                 <Suspense fallback={null}>
                     <Gltf
                         ref={handleGltfReady}
                         src={localUri}
                         rotation={[0, -Math.PI / 2, 0]}
                         scale={modelScale || 1}
                         {...gltfHandlers}
                     />
                 </Suspense>

                 {(isSelected &&
                     <group>
                         <sprite
                             position={[dimensions[0] / 2, -0.2, dimensions[2] + 0.2]}
                             scale={[.75, .75, .75]}
                             onPointerDown={(e) => {
                                 e.stopPropagation();
                                 setIsDragging(true);
                                 globalIsDragging = true;
                                 dragStartPoint.current.copy(e.point);
                                 initialPosition.current = [...position];
                                 if (onDragStateChange) onDragStateChange(true);
                             }}
                         >
                             <spriteMaterial
                                 map={dragIconTexture}
                                 color="white"
                                 depthTest={false}
                                 transparent={true}
                             />
                         </sprite>
                         <sprite
                             position={[dimensions[0] - 0.1, dimensions[1] + 0.2, 0]}
                             scale={[0.2, 0.2, 0.2]}
                             onPointerDown={(e) => {
                                 e.stopPropagation();
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
                             }}
                         >
                             <spriteMaterial
                                 map={deleteIconTexture}
                                 color="#ffffffff"
                                 depthTest={false}
                                 transparent={true}
                             />
                         </sprite>
                         <sprite
                             position={[0.1, dimensions[1] + 0.2, 0]}
                             scale={[0.26, 0.26, 0.26]}
                             onPointerDown={(e) => {
                                 e.stopPropagation();
                                 if (onEditObject) onEditObject(obj);
                             }}
                         >
                             <spriteMaterial
                                 map={editIconTexture}
                                 color="#ffffffff"
                                 depthTest={false}
                                 transparent={true}
                             />
                         </sprite>
                         
                         {/* Measurements - show when object is selected */}
                         <ObjectMeasurements3D
                             object={obj}
                             allObjects={allObjects}
                             room3d={room3d}
                             origin={origin}
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
                        setIsDragging(false);
                        globalIsDragging = false;
                        if (onDragStateChange) onDragStateChange(false);
                    }}
                >
                    <planeGeometry args={[1000, 1000]} />
                </mesh>
            )}
        </group>
    );
}
