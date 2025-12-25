import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  label: string;
  theme?: "primary";
  onPress?: () => void;
};

export default function Button({ label, onPress }: Props) {
  return (
    <View style={styles.buttonContainer}>
      <Pressable style={styles.button} onPress={onPress}>
        <Text style={styles.buttonLabel}>{label}</Text>
      </Pressable>
    </View>
  );
}


const w_width = Dimensions.get('window').width;
const w_height = Dimensions.get('window').height;

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
    backgroundColor: "#2563eb", // Un azul más moderno (puedes usar tu #3db8ffff si prefieres)
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
});
