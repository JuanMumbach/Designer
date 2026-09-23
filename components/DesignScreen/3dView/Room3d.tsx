import { Box } from '@react-three/drei/native';
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export interface Room3dProps{
    width: number;
    height: number;
    depth: number;
    leftWall: boolean;
    rightWall: boolean;
}

const wallThickness = 0.2;
const floorThickness = 0.2;

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

function DesignRoom( _room3d : { room3d: Room3dProps, culledLeft?: boolean, culledRight?: boolean }) {
    const room3d = _room3d.room3d;
    const culledLeft = _room3d.culledLeft ?? false;
    const culledRight = _room3d.culledRight ?? false;
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

    return (
        <>
            {(room3d.leftWall && 
                (
                    <Box 
                        position=
                            {[-room3d.width/2-wallThickness/2, 
                            room3d.height/2, 
                            room3d.depth/2-wallThickness/2]} 
                        args=
                            {[wallThickness, 
                            room3d.height, 
                            room3d.depth+wallThickness]}>
                        <meshStandardMaterial ref={leftWallMat} attach="material" color={"#a9a58f"} />
                    </Box>
                )
            )}

            <Box position={[0, room3d.height/2, -.1]} args={[room3d.width, room3d.height, wallThickness]}>
                <meshStandardMaterial attach="material" color={"#a9a58f"} />
            </Box>

            {(room3d.leftWall && 
                (
                    <Box 
                        position=
                            {[-room3d.width/2-wallThickness/2, 
                            -floorThickness/2, 
                            room3d.depth/2-wallThickness/2]} 
                        args=
                            {[wallThickness, 
                            floorThickness, 
                            room3d.depth+wallThickness]}>
                        <meshStandardMaterial ref={leftFloorStripMat} attach="material" color={"#e0e3e3"} />
                    </Box>
                )
            )}

            <Box position={[0, -floorThickness/2, room3d.depth/2-wallThickness/2]} args={[room3d.width, floorThickness, room3d.depth+wallThickness]}>
                <meshStandardMaterial attach="material" color={"#e0e3e3"} />
            </Box>

            {(room3d.rightWall && 
                (
                    <Box 
                        position=
                            {[room3d.width/2+wallThickness/2, 
                            -floorThickness/2, 
                            room3d.depth/2-wallThickness/2]} 
                        args=
                            {[wallThickness, 
                            floorThickness, 
                            room3d.depth+wallThickness]}>
                        <meshStandardMaterial ref={rightFloorStripMat} attach="material" color={"#e0e3e3"} />
                    </Box>
                )
            )}

            {(room3d.rightWall && 
                (
                    <Box 
                        position=
                            {[room3d.width/2+wallThickness/2, 
                            room3d.height/2, 
                            room3d.depth/2-wallThickness/2]} 
                        args=
                            {[wallThickness, 
                            room3d.height, 
                            room3d.depth+wallThickness]}>
                        <meshStandardMaterial ref={rightWallMat} attach="material" color={"#a9a58f"} />
                    </Box>
                )
            )}
        </>
    )
}

export default function Room3d( props : Room3dProps & { culledLeft?: boolean, culledRight?: boolean }){
    return (
        <>
        <VoidSpaceFloor />
        <VoidSpaceWall />
        <DesignRoom room3d={props} culledLeft={props.culledLeft} culledRight={props.culledRight}/> 
        </>
    );
}