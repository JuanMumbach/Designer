import Button from "@/components/Button";
import { useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { FurnitureInstanceProps } from "../3dView/DesignObjects";

export default function EditFurnitureInstanceMenu({object, onEditComplete} : {
        object : FurnitureInstanceProps, 
        onEditComplete : (id: string, updates: { name: string, position: [number, number, number] }) => void,
    }){

    const [name, onChangeName] = useState(object.name);
    const [positionX, onChangePositionX] = useState(object.position?.[0] ?? 0);
    const [positionY, onChangePositionY] = useState(object.position?.[1] ?? 0);
    const [positionZ, onChangePositionZ] = useState(object.position?.[2] ?? 0);
    
    const handleSave = () => {
        onEditComplete(object.id, { 
            name: name, 
            position: [positionX, positionY, positionZ]
        });
    };

    useEffect(() => {
        onChangeName(object.name);
        onChangePositionX(object.position?.[0] ?? 0);
        onChangePositionY(object.position?.[1] ?? 0);
        onChangePositionZ(object.position?.[2] ?? 0);
      }, [object]);
    
    const handlePositionXChange = (text: string) => {
        var aNumber : number = parseFloat(text);
        if (!isNaN(aNumber)) onChangePositionX(aNumber);
    };

    const handlePositionYChange = (text: string) => {
        var aNumber : number = parseFloat(text);
        if (!isNaN(aNumber)) onChangePositionY(aNumber);
    };

    const handlePositionZChange = (text: string) => {
        var aNumber : number = parseFloat(text);
        if (!isNaN(aNumber)) onChangePositionZ(aNumber);
    };

    return (
    <View style={styles.container}>
        <TextInput style={styles.input} onChangeText={onChangeName} value={name} placeholder={object.name} />
        <Text>Type: {object.type.name}</Text>
        <Text style={styles.label}>Position X</Text>
              <TextInput style={styles.input}
                onChangeText={handlePositionXChange}
                value={positionX.toString()}
                keyboardType="numeric"
              />
        <Text style={styles.label}>Position Y</Text>
                <TextInput style={styles.input}
                    onChangeText={handlePositionYChange}
                    value={positionY.toString()}
                    keyboardType="numeric"
                />
        <Text style={styles.label}>Position Z</Text>
                <TextInput style={styles.input}
                    onChangeText={handlePositionZChange}
                    value={positionZ.toString()}
                    keyboardType="numeric"
                />
        <Button label="Save Changes" onPress={handleSave} />
    </View>
    );
};

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