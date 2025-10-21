import { useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import Button from "../../Button";
import { DesignObjectInstanceProps, DesignObjectProps, NewInstance } from "../3dView/DesignObjects";


export default function AddObjectMenu({
  newObjectType,
  onObjectAdded, // <-- New prop
  closeMenu // <-- New prop
}: {
  newObjectType: DesignObjectProps,
  onObjectAdded: (newObject: DesignObjectInstanceProps) => void,
  closeMenu: () => void
}) {

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
    const newObjectInstance = NewInstance(newObjectType);

    // Apply form values
    newObjectInstance.name = name;
    newObjectInstance.xdistance = parseFloat(xdistance || "0");

    // 1. ADD OBJECT: Call the function passed from DesignScreen to update the state
    onObjectAdded(newObjectInstance);

    // 2. CLOSE MENU: Call the function passed from View3dOverlay
    closeMenu();
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