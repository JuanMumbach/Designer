import { useGLTF } from '@react-three/drei/native';
import React from 'react';

export default function CounterModel(props) {
  const { scene } = useGLTF(require('./model.glb')); // asegúrate de tener el modelo en assets

  return <primitive object={scene} {...props} />;
}