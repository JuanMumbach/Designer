import { useEffect, useState } from "react";
import { ScrollView, StyleProp, StyleSheet, Text, TextInput, ViewStyle } from "react-native";
import Button from "../../Button";
import { DesignObject, ObjectTemplate, createDesignObject } from "../3dView/DesignObjects";
import { GLASS, RADII } from "@/constants/theme";
import GlassSurface from "./GlassSurface";


export default function AddFurnitureInstanceMenu({
  newObjectType,
  onObjectAdded,
  closeMenu,
  containerStyle
}: {
  newObjectType: ObjectTemplate,
  onObjectAdded: (newObject: DesignObject) => void,
  closeMenu: () => void,
  containerStyle?: StyleProp<ViewStyle>
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
    const newObjectInstance = createDesignObject(newObjectType, position);

    newObjectInstance.name = name;

    onObjectAdded(newObjectInstance);

    closeMenu();
  };

  return (
    <GlassSurface style={[styles.container, containerStyle]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={styles.objectTypeText}>Object Type: {newObjectType.name}</Text>

        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          onChangeText={onChangeName}
          value={name}
          placeholder={newObjectType.name}
          placeholderTextColor={GLASS.textFaint}
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

        <Text style={styles.specText}>Width: {width}</Text>
        <Text style={styles.specText}>Height: {height}</Text>
        <Text style={styles.specText}>Depth: {depth}</Text>

        <Button label="Add Object" onPress={handleAddObject} />
      </ScrollView>
    </GlassSurface>
  )
}

const styles = StyleSheet.create({
  container: {
    width: 300,
    maxHeight: '70%',
    minHeight: 260,
    borderRadius: RADII.xl,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  scroll: {
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  objectTypeText: {
    fontSize: 14,
    fontWeight: '600',
    color: GLASS.text,
  },
  specText: {
    fontSize: 13,
    color: GLASS.textMuted,
    marginTop: 2,
  },
  label: {
    marginTop: 12,
    marginBottom: 6,
    fontSize: 12,
    fontWeight: '700',
    color: GLASS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    height: 44,
    borderColor: GLASS.border,
    borderWidth: 1,
    borderRadius: RADII.md,
    paddingHorizontal: 12,
    marginBottom: 10,
    backgroundColor: GLASS.bgInput,
    fontSize: 14,
    color: GLASS.text,
  }
});
