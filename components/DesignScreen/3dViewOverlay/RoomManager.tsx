import { ScrollView, StyleSheet, Text, TextInput } from "react-native";
import { Room3dProps } from "../3dView/Room3d";

interface RoomManagerProps {
    room3dProps: Room3dProps;
    setRoom3d: React.Dispatch<React.SetStateAction<Room3dProps>>;
}

export default function RoomManager({ room3dProps, setRoom3d }: RoomManagerProps) {
    
    // Función genérica para actualizar cualquier propiedad de la habitación
    const handleUpdateRoom = (key: keyof Room3dProps, value: string) => {
        // Convertir a número ya que los inputs son para ancho, alto y profundidad
        const numericValue = parseFloat(value);
        if (isNaN(numericValue) || numericValue <= 0) return; // Validación básica

        // Usar la función setter para actualizar SÓLO la propiedad cambiada
        setRoom3d(prevRoom => ({
            ...prevRoom, // Mantener el resto de las propiedades sin cambios
            [key]: numericValue, // Actualizar la propiedad específica
        }));
    };

    return (
        <ScrollView style={styles.container}>
            <Text> Room Width: </Text>
            {/* onChangeText es el evento en TextInput de React Native */}
            <TextInput 
                keyboardType="numeric" // Mostrar teclado numérico
                placeholder="Enter room width" 
                onChangeText={(text) => handleUpdateRoom('width', text)}
                defaultValue={room3dProps.width.toString()}
                style={styles.input} // Añadir un estilo para que se vea bien
            />
            
            <Text> Room Height: </Text>
            <TextInput 
                keyboardType="numeric" 
                placeholder="Enter room Height" 
                onChangeText={(text) => handleUpdateRoom('height', text)}
                defaultValue={room3dProps.height.toString()}
                style={styles.input} 
            />
            
            <Text> Room Depth: </Text>
            <TextInput 
                keyboardType="numeric" 
                placeholder="Enter room depth" 
                onChangeText={(text) => handleUpdateRoom('depth', text)}
                defaultValue={room3dProps.depth.toString()}
                style={styles.input} 
            />
        </ScrollView>
    );
}


const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#fff',
    },
    // Añadir estilo para TextInput
    input: { 
        height: 40, 
        borderColor: 'gray', 
        borderWidth: 1, 
        paddingHorizontal: 10,
        marginBottom: 10,
    },
    // ... (otros estilos)
});