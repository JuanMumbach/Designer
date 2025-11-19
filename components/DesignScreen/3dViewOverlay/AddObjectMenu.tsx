import { useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import Button from "../../Button";
import { DesignObjectInstanceProps, DesignObjectProps, NewInstance } from "../3dView/DesignObjects";


export default function AddObjectMenu({
  newObjectType,
  onObjectAdded,
  closeMenu
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
  const [positionX, onChangePositionX] = useState("0");
  const [positionY, onChangePositionY] = useState("0");
  const [positionZ, onChangePositionZ] = useState("0");

  useEffect(() => {
    onChangeName(newObjectType.name);
    onChangeWidth(newObjectType.width);
    onChangeHeight(newObjectType.height);
    onChangeDepth(newObjectType.depth);
    onChangeColor("#ffffff");
    onChangePositionX("0");
    onChangePositionY("0");
    onChangePositionZ("0");
  }, [newObjectType]);


  const handleAddObject = () => {
    const position: [number, number, number] = [
      parseFloat(positionX || "0"),
      parseFloat(positionY || "0"),
      parseFloat(positionZ || "0")
    ];
    const newObjectInstance = NewInstance(newObjectType, position);

    // Apply form values
    newObjectInstance.name = name;

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

      <Text style={styles.label}>Position X</Text>
      <TextInput style={styles.input}
        onChangeText={onChangePositionX}
        value={positionX}
        keyboardType="numeric"
      />
      <Text style={styles.label}>Position Y</Text>
      <TextInput style={styles.input}
        onChangeText={onChangePositionY}
        value={positionY}
        keyboardType="numeric"
      />
      <Text style={styles.label}>Position Z</Text>
      <TextInput style={styles.input}
        onChangeText={onChangePositionZ}
        value={positionZ}
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