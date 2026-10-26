import { Box } from '@react-three/drei/native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { AppliedMaterial, DesignObject } from './DesignObjects';
import { resolveWallTileZones } from './wallTiles';

export type WallIdentifier = 'back' | 'left' | 'right';

export interface WallTileZone {
    id: string;
    source: 'manual' | 'counter';
    counterId?: string;
    materialId?: string;
    color?: string;
    start: number;
    width: number;
    bottom: number;
    height: number;
}

export interface WallConfig {
    materialId?: string;
    color?: string;
    autoBacksplash?: boolean;
    defaultTileMaterialId?: string;
    tiles?: WallTileZone[];
}

export interface Room3dProps{
    width: number;
    height: number;
    depth: number;
    leftWall: boolean;
    rightWall: boolean;
    walls?: {
        back?: WallConfig;
        left?: WallConfig;
        right?: WallConfig;
    };
}

export interface Room3dComponentProps extends Room3dProps {
    culledLeft?: boolean;
    culledRight?: boolean;
    materialDataById?: Record<string, AppliedMaterial>;
    designObjects?: DesignObject[];
    onWallContextMenu?: (wallId: WallIdentifier, event: any) => void;
}

const wallThickness = 0.2;
const floorThickness = 0.2;
const TILE_DEPTH = 0.01;

function VoidSpaceFloor() {
    return (
        <mesh position={[0, -3, 0]}>
            <boxGeometry args={[100, 1, 100]} />
            <meshStandardMaterial color="white" />
        </mesh>
    );
}

function VoidSpaceWall() {
    return (
        <mesh position={[0, 2.5, -5]} rotation={[0, 0, 0]}>
            <planeGeometry args={[100, 10]} />
            <meshStandardMaterial color="white"/>
        </mesh>
    );
}

export function RoomOrigin( {room3d} : { room3d: Room3dProps }) : [number, number, number] {
    return [-(room3d.width)/2, 0, 0];
}

function WallMaterial({
    color,
    materialId,
    materialDataById,
    width,
    height,
    materialRef,
    visible = true
}: {
    color?: string;
    materialId?: string;
    materialDataById?: Record<string, AppliedMaterial>;
    width: number;
    height: number;
    materialRef?: React.Ref<THREE.MeshStandardMaterial>;
    visible?: boolean;
}) {
    const applied = materialId && materialDataById ? materialDataById[materialId] : undefined;
    const [texture, setTexture] = useState<THREE.Texture | null>(null);

    useEffect(() => {
        if (!applied?.fileURL) {
            setTexture(null);
            return;
        }
        let cancelled = false;
        const loader = new THREE.TextureLoader();
        loader.load(applied.fileURL, (loaded) => {
            if (cancelled) return;
            loaded.wrapS = THREE.RepeatWrapping;
            loaded.wrapT = THREE.RepeatWrapping;
            const repeatX = Math.max(1, (applied.scaleU || 1) * width);
            const repeatY = Math.max(1, (applied.scaleV || 1) * height);
            loaded.repeat.set(repeatX, repeatY);
            loaded.needsUpdate = true;
            setTexture(loaded);
        });
        return () => {
            cancelled = true;
        };
    }, [applied?.fileURL, applied?.scaleU, applied?.scaleV, width, height]);

    return (
        <meshStandardMaterial
            ref={materialRef}
            attach="material"
            color={texture ? '#ffffff' : (color || '#a9a58f')}
            map={texture || undefined}
            roughness={0.8}
            visible={visible}
        />
    );
}

function TileZoneMesh({
    tile,
    wallId,
    room3d,
    materialDataById,
    visible = true
}: {
    tile: WallTileZone;
    wallId: WallIdentifier;
    room3d: Room3dProps;
    materialDataById?: Record<string, AppliedMaterial>;
    visible?: boolean;
}) {
    const applied = tile.materialId && materialDataById ? materialDataById[tile.materialId] : undefined;
    const [texture, setTexture] = useState<THREE.Texture | null>(null);

    useEffect(() => {
        if (!applied?.fileURL) {
            setTexture(null);
            return;
        }
        let cancelled = false;
        const loader = new THREE.TextureLoader();
        loader.load(applied.fileURL, (loaded) => {
            if (cancelled) return;
            loaded.wrapS = THREE.RepeatWrapping;
            loaded.wrapT = THREE.RepeatWrapping;
            const repeatX = Math.max(1, (applied.scaleU || 1) * tile.width);
            const repeatY = Math.max(1, (applied.scaleV || 1) * tile.height);
            loaded.repeat.set(repeatX, repeatY);
            loaded.needsUpdate = true;
            setTexture(loaded);
        });
        return () => {
            cancelled = true;
        };
    }, [applied?.fileURL, applied?.scaleU, applied?.scaleV, tile.width, tile.height]);

    const centerY = tile.bottom + tile.height / 2;
    let position: [number, number, number];
    let args: [number, number, number];

    if (wallId === 'back') {
        const centerX = -room3d.width / 2 + tile.start + tile.width / 2;
        position = [centerX, centerY, TILE_DEPTH / 2];
        args = [tile.width, tile.height, TILE_DEPTH];
    } else if (wallId === 'left') {
        const centerZ = tile.start + tile.width / 2;
        position = [-room3d.width / 2 + TILE_DEPTH / 2, centerY, centerZ];
        args = [TILE_DEPTH, tile.height, tile.width];
    } else {
        const centerZ = tile.start + tile.width / 2;
        position = [room3d.width / 2 - TILE_DEPTH / 2, centerY, centerZ];
        args = [TILE_DEPTH, tile.height, tile.width];
    }

    return (
        <Box position={position} args={args} visible={visible}>
            <meshStandardMaterial
                attach="material"
                color={texture ? '#ffffff' : (tile.color || '#e5e7eb')}
                map={texture || undefined}
                roughness={0.4}
            />
        </Box>
    );
}

function DesignRoom({
    room3d,
    culledLeft = false,
    culledRight = false,
    materialDataById,
    designObjects = [],
    onWallContextMenu
}: {
    room3d: Room3dProps;
    culledLeft?: boolean;
    culledRight?: boolean;
    materialDataById?: Record<string, AppliedMaterial>;
    designObjects?: DesignObject[];
    onWallContextMenu?: (wallId: WallIdentifier, event: any) => void;
}) {
    const leftWallMat = useRef<THREE.MeshStandardMaterial>(null);
    const rightWallMat = useRef<THREE.MeshStandardMaterial>(null);
    const leftFloorStripMat = useRef<THREE.MeshStandardMaterial>(null);
    const rightFloorStripMat = useRef<THREE.MeshStandardMaterial>(null);

    useEffect(() => {
        if (leftWallMat.current) leftWallMat.current.visible = !culledLeft;
        if (rightWallMat.current) rightWallMat.current.visible = !culledRight;
        if (leftFloorStripMat.current) leftFloorStripMat.current.visible = !culledLeft;
        if (rightFloorStripMat.current) rightFloorStripMat.current.visible = !culledRight;
    }, [culledLeft, culledRight]);

    const backTiles = useMemo(
        () => resolveWallTileZones('back', room3d, designObjects),
        [room3d, designObjects]
    );
    const leftTiles = useMemo(
        () => (room3d.leftWall ? resolveWallTileZones('left', room3d, designObjects) : []),
        [room3d, designObjects]
    );
    const rightTiles = useMemo(
        () => (room3d.rightWall ? resolveWallTileZones('right', room3d, designObjects) : []),
        [room3d, designObjects]
    );

    const handleContextMenu = (wallId: WallIdentifier, e: any) => {
        if (e.nativeEvent?.preventDefault) e.nativeEvent.preventDefault();
        if (e.preventDefault) e.preventDefault();
        e.stopPropagation();
        onWallContextMenu?.(wallId, e);
    };

    const backConfig = room3d.walls?.back;
    const leftConfig = room3d.walls?.left;
    const rightConfig = room3d.walls?.right;

    return (
        <>
            {room3d.leftWall && (
                <>
                    <Box
                        position={[-room3d.width / 2 - wallThickness / 2, room3d.height / 2, room3d.depth / 2 - wallThickness / 2]}
                        args={[wallThickness, room3d.height, room3d.depth + wallThickness]}
                        onContextMenu={(e) => handleContextMenu('left', e)}
                    >
                        <WallMaterial
                            materialRef={leftWallMat}
                            materialId={leftConfig?.materialId}
                            color={leftConfig?.color}
                            materialDataById={materialDataById}
                            width={room3d.depth}
                            height={room3d.height}
                            visible={!culledLeft}
                        />
                    </Box>
                    {leftTiles.map((tile) => (
                        <TileZoneMesh
                            key={tile.id}
                            tile={tile}
                            wallId="left"
                            room3d={room3d}
                            materialDataById={materialDataById}
                            visible={!culledLeft}
                        />
                    ))}
                    <Box
                        position={[-room3d.width / 2 - wallThickness / 2, -floorThickness / 2, room3d.depth / 2 - wallThickness / 2]}
                        args={[wallThickness, floorThickness, room3d.depth + wallThickness]}
                    >
                        <meshStandardMaterial ref={leftFloorStripMat} attach="material" color="#e0e3e3" />
                    </Box>
                </>
            )}

            <Box
                position={[0, room3d.height / 2, -0.1]}
                args={[room3d.width, room3d.height, wallThickness]}
                onContextMenu={(e) => handleContextMenu('back', e)}
            >
                <WallMaterial
                    materialId={backConfig?.materialId}
                    color={backConfig?.color}
                    materialDataById={materialDataById}
                    width={room3d.width}
                    height={room3d.height}
                />
            </Box>
            {backTiles.map((tile) => (
                <TileZoneMesh
                    key={tile.id}
                    tile={tile}
                    wallId="back"
                    room3d={room3d}
                    materialDataById={materialDataById}
                />
            ))}

            <Box position={[0, -floorThickness / 2, room3d.depth / 2 - wallThickness / 2]} args={[room3d.width, floorThickness, room3d.depth + wallThickness]}>
                <meshStandardMaterial attach="material" color="#e0e3e3" />
            </Box>

            {room3d.rightWall && (
                <>
                    <Box
                        position={[room3d.width / 2 + wallThickness / 2, -floorThickness / 2, room3d.depth / 2 - wallThickness / 2]}
                        args={[wallThickness, floorThickness, room3d.depth + wallThickness]}
                    >
                        <meshStandardMaterial ref={rightFloorStripMat} attach="material" color="#e0e3e3" />
                    </Box>
                    <Box
                        position={[room3d.width / 2 + wallThickness / 2, room3d.height / 2, room3d.depth / 2 - wallThickness / 2]}
                        args={[wallThickness, room3d.height, room3d.depth + wallThickness]}
                        onContextMenu={(e) => handleContextMenu('right', e)}
                    >
                        <WallMaterial
                            materialRef={rightWallMat}
                            materialId={rightConfig?.materialId}
                            color={rightConfig?.color}
                            materialDataById={materialDataById}
                            width={room3d.depth}
                            height={room3d.height}
                            visible={!culledRight}
                        />
                    </Box>
                    {rightTiles.map((tile) => (
                        <TileZoneMesh
                            key={tile.id}
                            tile={tile}
                            wallId="right"
                            room3d={room3d}
                            materialDataById={materialDataById}
                            visible={!culledRight}
                        />
                    ))}
                </>
            )}
        </>
    );
}

export default function Room3d(props: Room3dComponentProps) {
    return (
        <>
            <VoidSpaceFloor />
            <VoidSpaceWall />
            <DesignRoom
                room3d={props}
                culledLeft={props.culledLeft}
                culledRight={props.culledRight}
                materialDataById={props.materialDataById}
                designObjects={props.designObjects}
                onWallContextMenu={props.onWallContextMenu}
            />
        </>
    );
}
