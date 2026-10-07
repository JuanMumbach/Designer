import { Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS, GLASS, RADII } from "@/constants/theme";
import GlassSurface from "./DesignScreen/3dViewOverlay/GlassSurface";

type Props = {
  label: string;
  theme?: "primary";
  variant?: "primary" | "glass";
  onPress?: () => void;
};

export default function Button({ label, onPress, variant = "primary" }: Props) {
  if (variant === "glass") {
    return (
      <View style={styles.buttonContainer}>
        <Pressable onPress={onPress}>
          {({ pressed }) => (
            <GlassSurface
              style={[styles.glassButton, pressed && styles.glassButtonPressed]}
            >
              <Text style={styles.glassButtonLabel}>{label}</Text>
            </GlassSurface>
          )}
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.buttonContainer}>
      <Pressable style={styles.button} onPress={onPress}>
        <Text style={styles.buttonLabel}>{label}</Text>
      </Pressable>
    </View>
  );
}


const styles = StyleSheet.create({
  buttonContainer: {
    // Quitamos el ancho fijo gigante. Dejamos que el botón decida su tamaño.
    marginHorizontal: 8,
    marginVertical: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  button: {
    borderRadius: 30, // Bordes muy redondos
    paddingVertical: 12, // Relleno vertical
    paddingHorizontal: 24, // Relleno horizontal
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    backgroundColor: COLORS.primary, // Un azul más moderno (puedes usar tu #3db8ffff si prefieres)
    // Sombras suaves para dar profundidad
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5, // Sombra para Android
  },
  buttonLabel: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600", // Texto un poco más grueso
    letterSpacing: 0.5,
  },
  glassButton: {
    borderRadius: RADII.full,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  glassButtonPressed: {
    backgroundColor: GLASS.bgPressed,
    borderColor: GLASS.borderStrong,
  },
  glassButtonLabel: {
    color: GLASS.text,
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
});
