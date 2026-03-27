import { Box, Gltf, useTexture } from '@react-three/drei/native';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import React, { Suspense, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as THREE from 'three';
import { FurnitureInstanceProps } from './DesignObjects';
import { Room3dProps } from './Room3d';

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

export function FurnitureInstance({
    obj, position, origin, dimensions, modelScale, rotation, onObjectInteraction, isSelected, onObjectEdited, room3d, magnetEnabled, allObjects
}: {
    obj: FurnitureInstanceProps,
    position: [number, number, number],
    origin: [number, number, number],
    dimensions: [number, number, number],
    modelScale?: number,
    modelUrl: string,
    rotation?: number,
    onObjectInteraction: (object: FurnitureInstanceProps) => void,
    isSelected?: boolean,
    onObjectEdited?: (id: string, updates: { name: string, position: [number, number, number], rotation?: number }) => void,
    room3d: Room3dProps,
    magnetEnabled: boolean,
    allObjects: FurnitureInstanceProps[]
}) {
    const url = obj.type.modelUrl;
    const { localUri, isLoading, error } = useDownload3dModel(url, obj.id);
    const [isDesktop, setIsDesktop] = useState(false);

    const [isDragging, setIsDragging] = useState(false);
    const dragStartPoint = useRef<THREE.Vector3>(new THREE.Vector3());
    const initialPosition = useRef<[number, number, number]>([0, 0, 0]);

    const markerAsset = Asset.fromModule(require('../../../assets/images/move-marker.png'));
    const dragIconTexture = useTexture(markerAsset.uri);

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

        const MARGIN = 1;
        const EPSILON = 0.1;
        let angle = obj.rotation || 0;

        let targetX = initialPosition.current[0] + delta.x;
        let targetZ = initialPosition.current[2] + delta.z;

        // Se usa la posición absoluta para el chequeo de colisiones con los márgenes
        let mouseX = e.point.x - origin[0];
        let mouseZ = e.point.z - origin[2];

        let newX = position[0];
        let newZ = position[2];
        let newRot = rotation || 0;

        let halfWidth = dimensions[0] / 2;

        // Si está en la pared principal
        if (Math.abs(angle) < EPSILON) {
            if (room3d.leftWall && targetX < -MARGIN) {
                newRot = Math.PI / 2;
                newX = 0; // CORREGIDO: Mantiene el mueble pegado a la pared sin atravesarla
                newZ = Math.max(dimensions[0], Math.min(room3d.depth, mouseZ + halfWidth));

                dragStartPoint.current.copy(e.point);
                initialPosition.current = [newX, initialPosition.current[1], newZ];
            }
            else if (room3d.rightWall && targetX > room3d.width - dimensions[0] + MARGIN) {
                newRot = -Math.PI / 2;
                newX = room3d.width;
                newZ = Math.max(0, Math.min(room3d.depth - dimensions[0], mouseZ - halfWidth));

                dragStartPoint.current.copy(e.point);
                initialPosition.current = [newX, initialPosition.current[1], newZ];
            } else {
                newX = Math.max(0, Math.min(room3d.width - dimensions[0], targetX));
                newZ = 0;
            }

        // Si está en la pared izquierda
        } else if (Math.abs(angle - Math.PI / 2) < EPSILON) {
            // CORREGIDO: La transición vuelve a la pared central cuando Z se acerca a la esquina
            if (targetZ < dimensions[0] - MARGIN) {
                newRot = 0;
                newX = 0;
                newZ = 0;

                dragStartPoint.current.copy(e.point);
                initialPosition.current = [newX, initialPosition.current[1], newZ];
            } else {
                // CORREGIDO: El límite mínimo de Z ahora es el ancho del mueble para que no sobresalga del origen
                newZ = Math.max(dimensions[0], Math.min(room3d.depth, targetZ));
                newX = 0; 
            }
            
        // Si está en la pared derecha
        } else if (Math.abs(angle + Math.PI / 2) < EPSILON) {
            if (targetZ < -MARGIN) {
                newRot = 0;
                newX = room3d.width - dimensions[0];
                newZ = 0;

                dragStartPoint.current.copy(e.point);
                initialPosition.current = [newX, initialPosition.current[1], newZ];
            } else {
                newZ = Math.max(0, Math.min(room3d.depth - dimensions[0], targetZ));
                newX = room3d.width; 
            }
        }

        // Magnet snap logic
        if (magnetEnabled && allObjects.length > 1) {
            const MAGNET_THRESHOLD = 0.10; // 10cm snap distance
            const currentAngle = newRot;
            const EPSILON_MAG = 0.1;

            // Filter other objects with the same rotation (same wall)
            const candidates = allObjects.filter(other => {
                if (other.id === obj.id) return false;
                const otherAngle = other.rotation || 0;
                return Math.abs(otherAngle - currentAngle) < EPSILON_MAG;
            });

            if (candidates.length > 0) {
                // Front wall: snap on X axis
                if (Math.abs(currentAngle) < EPSILON_MAG) {
                    const draggedLeft = newX;
                    const draggedRight = newX + dimensions[0];

                    let bestSnap: number | null = null;
                    let bestDist = MAGNET_THRESHOLD;

                    for (const other of candidates) {
                        const otherLeft = other.position[0];
                        const otherRight = other.position[0] + other.dimensions[0];

                        // Dragged right edge near other's left edge
                        let dist = Math.abs(draggedRight - otherLeft);
                        if (dist < bestDist) {
                            bestDist = dist;
                            bestSnap = otherLeft - dimensions[0];
                        }

                        // Dragged left edge near other's right edge
                        dist = Math.abs(draggedLeft - otherRight);
                        if (dist < bestDist) {
                            bestDist = dist;
                            bestSnap = otherRight;
                        }
                    }

                    if (bestSnap !== null) {
                        newX = Math.max(0, Math.min(room3d.width - dimensions[0], bestSnap));
                    }
                }
                // Left wall (rotation ≈ π/2): snap on Z axis
                else if (Math.abs(currentAngle - Math.PI / 2) < EPSILON_MAG) {
                    const draggedFront = newZ;
                    const draggedBack = newZ + dimensions[0];

                    let bestSnap: number | null = null;
                    let bestDist = MAGNET_THRESHOLD;

                    for (const other of candidates) {
                        const otherFront = other.position[2];
                        const otherBack = other.position[2] + other.dimensions[0];

                        // Dragged back edge near other's front edge
                        let dist = Math.abs(draggedBack - otherFront);
                        if (dist < bestDist) {
                            bestDist = dist;
                            bestSnap = otherFront - dimensions[0];
                        }

                        // Dragged front edge near other's back edge
                        dist = Math.abs(draggedFront - otherBack);
                        if (dist < bestDist) {
                            bestDist = dist;
                            bestSnap = otherBack;
                        }
                    }

                    if (bestSnap !== null) {
                        newZ = Math.max(dimensions[0], Math.min(room3d.depth, bestSnap));
                    }
                }
                // Right wall (rotation ≈ -π/2): snap on Z axis
                else if (Math.abs(currentAngle + Math.PI / 2) < EPSILON_MAG) {
                    const draggedFront = newZ;
                    const draggedBack = newZ + dimensions[0];

                    let bestSnap: number | null = null;
                    let bestDist = MAGNET_THRESHOLD;

                    for (const other of candidates) {
                        const otherFront = other.position[2];
                        const otherBack = other.position[2] + other.dimensions[0];

                        // Dragged back edge near other's front edge
                        let dist = Math.abs(draggedBack - otherFront);
                        if (dist < bestDist) {
                            bestDist = dist;
                            bestSnap = otherFront - dimensions[0];
                        }

                        // Dragged front edge near other's back edge
                        dist = Math.abs(draggedFront - otherBack);
                        if (dist < bestDist) {
                            bestDist = dist;
                            bestSnap = otherBack;
                        }
                    }

                    if (bestSnap !== null) {
                        newZ = Math.max(0, Math.min(room3d.depth - dimensions[0], bestSnap));
                    }
                }
            }
        }

        onObjectEdited(obj.id, { name: obj.name, position: [newX, initialPosition.current[1], newZ], rotation: newRot });
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

    const spritePosition: [number, number, number] = [
        boxPosition[0],
        origin[1] - dimensions[2] / 2 - 0.1,
        boxPosition[2] + dimensions[2] / 2 + 0.1
    ];

    const currentAngle = rotation || 0;

    // Matemática para rotar el desplazamiento del centro del plano invisible
    const planeOffsetX = (dimensions[0] / 2) * Math.cos(currentAngle) + (dimensions[2] / 2) * Math.sin(currentAngle);
    const planeOffsetZ = -(dimensions[0] / 2) * Math.sin(currentAngle) + (dimensions[2] / 2) * Math.cos(currentAngle);

    return (
        <group>
            <group position={modelPosition} rotation={[0, rotation || 0, 0]}>
                <Suspense fallback={null}>
                    <Gltf
                        src={localUri}
                        rotation={[0, -Math.PI / 2, 0]}
                        scale={modelScale || 1}
                        // Si CUALQUIER objeto se está moviendo, este objeto deja pasar el evento
                        onClick={(e) => {
                            if (globalIsDragging) return;
                            e.stopPropagation();
                        }}
                        onDoubleClick={(e) => {
                            if (globalIsDragging) return;
                            e.stopPropagation();
                            if (isDesktop) handleInteraction(e);
                        }}
                        onPointerDown={(e) => {
                            if (globalIsDragging) return;
                            handlePointerDown(e);
                        }}
                        onPointerUp={(e) => {
                            if (globalIsDragging) return;
                            handlePointerUp(e);
                        }}
                        onPointerMove={(e) => {
                            if (globalIsDragging) return;
                            handlePointerMove(e);
                        }}
                        onPointerLeave={(e) => {
                            if (globalIsDragging) return;
                            handlePointerLeave(e);
                        }}
                    />
                </Suspense>

                {(isSelected &&
                    <sprite
                        position={[dimensions[0] / 2, -0.2, dimensions[2] + 0.2]}
                        scale={[.75, .75, .75]}
                        // Mantenemos el sprite tal como lo tenías originalmente para evitar bugs visuales
                        onPointerDown={(e) => {
                            e.stopPropagation();
                            setIsDragging(true);
                            globalIsDragging = true;
                            dragStartPoint.current.copy(e.point);
                            initialPosition.current = [...position];
                        }}
                    >
                        <spriteMaterial
                            map={dragIconTexture}
                            color="white"
                            depthTest={false}
                            transparent={true}
                        />
                    </sprite>
                )}
            </group>

            {isDragging && onObjectEdited && (
                <mesh
                    rotation={[0, currentAngle, 0]}
                    position={[
                        origin[0] + initialPosition.current[0] + planeOffsetX,
                        origin[1],
                        origin[2] + initialPosition.current[2] + planeOffsetZ
                    ]}
                    visible={false} 
                    onPointerMove={handleDragMove}
                    onPointerUp={(e) => {
                        e.stopPropagation();
                        setIsDragging(false);
                    }}
                >
                    <planeGeometry args={[1000, 1000]} />
                </mesh>
            )}
        </group>
    );
}