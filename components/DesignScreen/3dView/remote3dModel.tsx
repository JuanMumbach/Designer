import { Box, Gltf, useTexture } from '@react-three/drei/native';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import React, { Suspense, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as THREE from 'three';
import { FurnitureInstanceProps } from './DesignObjects';

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
    obj, position, origin, dimensions, modelScale, rotation, onObjectInteraction, isSelected, onObjectEdited
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
    onObjectEdited?: (id: string, updates: { name: string, position: [number, number, number] }) => void
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
        }
    }, []);

    useEffect(() => {
        console.log(`Object: ${obj.name} | isSelected: ${isSelected} | isDragging: ${isDragging}`);
    }, [isSelected, isDragging, obj.name]);

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

    const spritePosition: [number, number, number] = [
        boxPosition[0], 
        origin[1] - dimensions[2] / 2 - 0.1, 
        boxPosition[2] + dimensions[2] / 2 + 0.1
    ];

    return (
        <group>
            <Suspense key={obj.id} fallback={null}>
                <Gltf 
                    src={localUri}
                    position={modelPosition}
                    rotation={[0, -Math.PI / 2 + (rotation || 0), 0]}
                    scale={modelScale || 1}
                    onClick={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => {
                        e.stopPropagation();
                        if (isDesktop) handleInteraction(e);
                    }}
                    onPointerDown={handlePointerDown}
                    onPointerUp={handlePointerUp}
                    onPointerMove={handlePointerMove}
                    onPointerLeave={handlePointerLeave}
                ></Gltf>
            </Suspense>

            {(isSelected &&
                <sprite 
                    position={spritePosition} 
                    scale={[.75, .75, .75]}
                    onPointerDown={(e) => {
                        e.stopPropagation();
                        setIsDragging(true);
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

            {isDragging && onObjectEdited && (
                <mesh
                    rotation={[-Math.PI / 2, 0, 0]}
                    position={[0, origin[1], 0]}
                    visible={false}
                    onPointerMove={(e) => {
                        e.stopPropagation();
                        const delta = e.point.clone().sub(dragStartPoint.current);
                        
                        const angle = obj.rotation || 0;
                        const moveAxis = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
                        const moveAmount = delta.dot(moveAxis);
                        
                        const newPosition: [number, number, number] = [
                            initialPosition.current[0] + moveAxis.x * moveAmount,
                            initialPosition.current[1],
                            initialPosition.current[2] + moveAxis.z * moveAmount,
                        ];
                        
                        onObjectEdited(obj.id, { name: obj.name, position: newPosition });
                    }}
                    onPointerUp={(e) => {
                        e.stopPropagation();
                        setIsDragging(false);
                    }}
                    onPointerOut={(e) => {
                        e.stopPropagation();
                        setIsDragging(false);
                    }}
                >
                    <planeGeometry args={[100, 100]} />
                </mesh>
            )}
        </group>
    );
}