import { Box } from '@react-three/drei/native';
import React from 'react';

export interface Room3dProps{
    width: number;
    height: number;
    depth: number;
    leftWall: boolean;
    rightWall: boolean;
}

var myRoom3d : Room3dProps = {
    width: 5,
    height: 3,
    depth: 4,
    leftWall: true,
    rightWall: true
};
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

export function RoomOrigin() : [number, number, number] {
    return [-myRoom3d.width/2, 0, 0];
}

function DesignRoom() {
    return (
        <>
            {(myRoom3d.leftWall && 
                (
                    <Box 
                        position=
                            {[-myRoom3d.width/2-wallThickness/2, 
                            myRoom3d.height/2, 
                            myRoom3d.depth/2-wallThickness/2]} 
                        args=
                            {[wallThickness, 
                            myRoom3d.height, 
                            myRoom3d.depth+wallThickness]}>
                        <meshStandardMaterial attach="material" color={"#914646"} />
                    </Box>
                )
            )}

            <Box position={[0, myRoom3d.height/2, -.1]} args={[myRoom3d.width, myRoom3d.height, wallThickness]}>
                <meshStandardMaterial attach="material" color={"#ffffff"} />
            </Box>

            <Box position={[0, -floorThickness/2, myRoom3d.depth/2-wallThickness/2]} args={[myRoom3d.width+wallThickness*2, floorThickness, myRoom3d.depth+wallThickness]}>
                <meshStandardMaterial attach="material" color={"#ffffff"} />
            </Box>

            {(myRoom3d.rightWall && 
                (
                    <Box 
                        position=
                            {[myRoom3d.width/2+wallThickness/2, 
                            myRoom3d.height/2, 
                            myRoom3d.depth/2-wallThickness/2]} 
                        args=
                            {[wallThickness, 
                            myRoom3d.height, 
                            myRoom3d.depth+wallThickness]}>
                        <meshStandardMaterial attach="material" color={"#ff7777"} />
                    </Box>
                )
            )}
        </>
    )
}

export default function Room3d(){
    return (
        <>
        <VoidSpaceFloor />
        <VoidSpaceWall />
        <DesignRoom/>
        </>
    );
}