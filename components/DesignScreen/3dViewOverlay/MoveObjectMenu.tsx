import React, { useState } from 'react';
import { View, Button, StyleSheet, TextInput, Text } from 'react-native';
import { DesignObjectInstanceProps, DesignObjectType } from '../3dView/DesignObjects';

interface MoveObjectMenuProps {
    selectedObject: DesignObjectInstanceProps;
    onMove: (newPosition: [number, number, number]) => void;
    onClose: () => void;
}

export default function MoveObjectMenu({ selectedObject, onMove, onClose }: MoveObjectMenuProps) {
    const [direction, setDirection] = useState<'left' | 'right'>('left');
    const [distance, setDistance] = useState('10');

    const handleMove = () => {
        const { position, rotation, type } = selectedObject;
        if (type.type !== DesignObjectType.Counter && type.type !== DesignObjectType.Cupboard) {
            return;
        }

        const newPosition: [number, number, number] = [...position];
        const angle = rotation;
        const moveDistance = parseFloat(distance) / 100; // Convert cm to meters

        if (direction === 'left') {
            newPosition[0] -= moveDistance * Math.cos(angle);
            newPosition[2] -= moveDistance * Math.sin(angle);
        } else {
            newPosition[0] += moveDistance * Math.cos(angle);
            newPosition[2] += moveDistance * Math.sin(angle);
        }

        onMove(newPosition);
    };

    return (
        <View style={styles.container}>
            <View style={styles.radioContainer}>
                <Button title="Left" onPress={() => setDirection('left')} color={direction === 'left' ? 'blue' : 'gray'} />
                <Button title="Right" onPress={() => setDirection('right')} color={direction === 'right' ? 'blue' : 'gray'} />
            </View>
            <View style={styles.inputContainer}>
                <TextInput
                    style={styles.input}
                    onChangeText={setDistance}
                    value={distance}
                    keyboardType="numeric"
                />
                <Text>cm</Text>
            </View>
            <Button title="Mover" onPress={handleMove} />
            <Button title="Close" onPress={onClose} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: [{ translateX: -100 }, { translateY: -100 }],
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        padding: 20,
        borderRadius: 10,
        width: 200,
    },
    radioContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 10,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    input: {
        flex: 1,
        borderColor: 'gray',
        borderWidth: 1,
        padding: 5,
        marginRight: 5,
    },
});