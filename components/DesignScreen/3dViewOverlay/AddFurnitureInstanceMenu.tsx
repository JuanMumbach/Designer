import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Button from "../../Button";
import { FurnitureInstanceProps, FurnitureProps, NewFurnitureInstance } from "../3dView/DesignObjects";


export default function AddFurnitureInstanceMenu({
  newObjectType,
  onObjectAdded,
  closeMenu
}: {
  newObjectType: FurnitureProps,
  onObjectAdded: (newObject: FurnitureInstanceProps) => void,
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
    const newObjectInstance = NewFurnitureInstance(newObjectType, position);

    // Apply form values
    newObjectInstance.name = name;

    // 1. ADD OBJECT: Call the function passed from DesignScreen to update the state
    onObjectAdded(newObjectInstance);

    // 2. CLOSE MENU: Call the function passed from View3dOverlay
    closeMenu();
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        <Text>Object Type: {newObjectType.name}</Text>

        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          onChangeText={onChangeName}
          value={name}
          placeholder={newObjectType.name}
        />

        <Text style={styles.label}>Position X</Text>
        <TextInput
          style={styles.input}
          onChangeText={onChangePositionX}
          value={positionX}
          keyboardType="numeric"
        />
        <Text style={styles.label}>Position Y</Text>
        <TextInput
          style={styles.input}
          onChangeText={onChangePositionY}
          value={positionY}
          keyboardType="numeric"
        />
        <Text style={styles.label}>Position Z</Text>
        <TextInput
          style={styles.input}
          onChangeText={onChangePositionZ}
          value={positionZ}
          keyboardType="numeric"
        />

        <Text>Width: {width}</Text>
        <Text>Height: {height}</Text>
        <Text>Depth: {depth}</Text>

        <Button label="Add Object" onPress={handleAddObject} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: 300, // Match RoomManager card sizing
    maxHeight: '70%', // Limit overall card height; inner content scrolls
    minHeight: 260,   // Give the card a comfortable minimum height to reduce empty space above
    backgroundColor: 'white', // Fondo blanco puro
    borderRadius: 16,
    // Sombra fuerte para que se note que está sobre el 3D
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
    overflow: 'hidden', // Mantiene esquinas redondeadas mientras se hace scroll interno
    // Sin margen extra; el posicionamiento lo maneja View3dOverlay.middleColumn
    // El espacio inferior para la barra principal se maneja en View3dOverlay.middleColumn
  },
  scroll: {
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
  }
});