import Button from "@/components/Button";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { FurnitureInstanceProps } from "../3dView/DesignObjects";

export default function EditFurnitureInstanceMenu({object, onEditComplete, onDelete} : {
        object : FurnitureInstanceProps, 
        onEditComplete : (id: string, updates: { name: string, position: [number, number, number] }) => void,
        onDelete? : (id: string) => void,
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

    const handleDelete = () => {
        Alert.alert('Delete Object', 'Are you sure you want to delete this object?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => {
                if (onDelete) onDelete(object.id);
            }},
        ]);
    };

    return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
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
        <Pressable style={styles.deleteButton} onPress={handleDelete}>
            <Text style={styles.deleteButtonLabel}>Delete Object</Text>
        </Pressable>
      </ScrollView>
    </View>
    );
};

const styles = StyleSheet.create({
  container: {
    width: 300,
    maxHeight: '100%',
    backgroundColor: 'white',
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
    overflow: 'hidden',
  },
  scroll: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  label: {
    marginTop: 12,
    marginBottom: 6,
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    height: 44,
    borderColor: '#e5e7eb',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 10,
    backgroundColor: '#f9fafb',
    fontSize: 14,
    color: '#111827',
  },
  deleteButton: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    backgroundColor: '#dc2626',
  },
  deleteButtonLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  }
});