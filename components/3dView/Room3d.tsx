function Floor() {
    return (
        <mesh receiveShadow position={[0, -.5, 0]}>
            <boxGeometry args={[50, 1, 10]} />
            <meshStandardMaterial color="white" />
        </mesh>
    );
}

function Wall() {
    return (
        <mesh receiveShadow position={[0, 5, -5]} rotation={[0, 0, 0]}>
            <planeGeometry args={[50, 10]} />
            <meshStandardMaterial color="white"/>
        </mesh>
    );
}

export default function Design3dView(){
    return (
        <>
        <Floor />
        <Wall />
        </>
    );
}