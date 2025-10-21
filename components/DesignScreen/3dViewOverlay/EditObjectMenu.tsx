import Button from "@/components/Button";
import { useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { DesignObjectInstanceProps } from "../3dView/DesignObjects";

export default function EditObjectMenu({object, onEditComplete} : {
        object : DesignObjectInstanceProps, 
        onEditComplete : (id: string, updates: { name: string, xdistance: number }) => void
    }){

    const [name, onChangeName] = useState(object.name);
    const [xdistance, onChangeXDistance] = useState(object.xdistance);
    
    const handleSave = () => {
        onEditComplete(object.id, { 
            name: name, 
            xdistance: xdistance
        });
        // Aquí llamar a una función para cerrar el menú.
    };

    useEffect(() => {
        onChangeName(object.name);
        onChangeXDistance(object.xdistance);
      }, [object]);
    
    const handleXDistanceChange = (text: string) => {
        var aNumber : number = parseFloat(text);
        if (!isNaN(aNumber)) onChangeXDistance(aNumber);
    };

    return (
    <View style={styles.container}>
        <TextInput style={styles.input} onChangeText={onChangeName} value={name} placeholder={object.name} />
        <Text>Type: {object.type.name}</Text>
        <Text style={styles.label}>X Distance (pos)</Text>
              <TextInput style={styles.input}
                onChangeText={handleXDistanceChange}
                value={xdistance.toString()}
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