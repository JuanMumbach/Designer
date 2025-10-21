import { useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import Button from "../../Button";
import { DesignObjectProps, NewInstance } from "../3dView/DesignObjects";
import { counterLineObjects } from "../Design3dViewer";


export default function AddObjectMenu({ newObjectType }: { newObjectType: DesignObjectProps }) {
    
    const [name, onChangeName] = useState(newObjectType.name);
    const [width, onChangeWidth] = useState(newObjectType.width);
    const [height, onChangeHeight] = useState(newObjectType.height);
    const [depth, onChangeDepth] = useState(newObjectType.depth);
    const [color, onChangeColor] = useState("#ffffff");
    const [xdistance, onChangeXDistance] = useState("0");

    useEffect(() => {
        onChangeName(newObjectType.name);
        onChangeWidth(newObjectType.width);
        onChangeHeight(newObjectType.height);
        onChangeDepth(newObjectType.depth);
        onChangeColor("#ffffff");
        onChangeXDistance("0");
    }, [newObjectType]);

    const handleAddObject = () => {
        counterLineObjects.push(NewInstance(newObjectType));
        console.log("Added object:", newObjectType.name);

        for (let i = 0; i < counterLineObjects.length; i++) {
            console.log(`Object ${i}:`, counterLineObjects[i]);
        }
    };

    return (
        <View style={styles.container}>
            <Text>Object Type: {newObjectType.name}</Text>
            
            <Text style={styles.label}>Name</Text>
            <TextInput style={styles.input} onChangeText={onChangeName} value={name} placeholder={newObjectType.name} />

            <Text style={styles.label}>X Distance (pos)</Text>
            <TextInput style={styles.input} 
                onChangeText={onChangeXDistance} 
                value={xdistance} 
                keyboardType="numeric"
            />
            

            <Text>Width: {width}</Text>
            <Text>Height: {height}</Text>
            <Text>Depth: {depth}</Text>

            <Button label="Add Object" onPress={handleAddObject} />
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        padding: 20,
        backgroundColor: '#f0f0f0',
        borderRadius: 8,
    },
    label: {
        marginTop: 10,
        fontWeight: 'bold',
    },
    input: {
        height: 40,
        borderColor: 'gray',
        borderWidth: 1,
        padding: 10,
        marginTop: 5,
        marginBottom: 10,
        backgroundColor: '#fff',
    }
});