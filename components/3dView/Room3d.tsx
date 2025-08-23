import { Box } from '@react-three/drei/native';
import React from 'react';

export interface Room3dProps{
    width: number;
    height: number;
    depth: number;
    leftWall: boolean;
    rightWall: boolean;
}

function VoidSpaceFloor() {
    return (
        <mesh position={[0, -3, 0]}>
            <boxGeometry args={[100, 1, 30]} />
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

function DesignRoom(props: Room3dProps) {
const wallThickness = 0.2;
const floorThickness = 0.2;
return (
    <>
        {(props.leftWall && 
            (
                <Box 
                    position=
                        {[-props.width/2-wallThickness/2, 
                        props.height/2, 
                        props.depth/2-wallThickness/2]} 
                    args=
                        {[wallThickness, 
                        props.height, 
                        props.depth+wallThickness]}>
                    <meshStandardMaterial attach="material" color={"#914646ff"} />
                </Box>
            )
        )}

        <Box position={[0, props.height/2, -.1]} args={[props.width, props.height, wallThickness]}>
            <meshStandardMaterial attach="material" color={"#ffffffff"} />
        </Box>

        <Box position={[0, -floorThickness/2, props.depth/2-wallThickness/2]} args={[props.width+wallThickness*2, floorThickness, props.depth+wallThickness]}>
            <meshStandardMaterial attach="material" color={"#ffffffff"} />
        </Box>

        {(props.rightWall && 
            (
                <Box 
                    position=
                        {[props.width/2+wallThickness/2, 
                        props.height/2, 
                        props.depth/2-wallThickness/2]} 
                    args=
                        {[wallThickness, 
                        props.height, 
                        props.depth+wallThickness]}>
                    <meshStandardMaterial attach="material" color={"#ff7777ff"} />
                </Box>
            )
        )}
    </>
)
}

export default function Room3d(props: Room3dProps){
    return (
        <>
        <VoidSpaceFloor />
        <VoidSpaceWall />
        <DesignRoom 
            width={props.width} 
            height={props.height} 
            leftWall={props.leftWall} 
            rightWall={props.rightWall} 
            depth={props.depth}
        />
        </>
    );
}