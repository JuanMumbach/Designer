import { StyleSheet, Text, TextInput, View } from "react-native";
import Button from "../../Button"; // Importamos tu botón personalizado
import { Room3dProps } from "../3dView/Room3d";

interface RoomManagerProps {
    room3dProps: Room3dProps;
    setRoom3d: React.Dispatch<React.SetStateAction<Room3dProps>>;
    onClose: () => void; // <--- Agregamos esta prop para poder cerrar el menú
}

export default function RoomManager({ room3dProps, setRoom3d, onClose }: RoomManagerProps) {
    
    const handleUpdateRoom = (key: keyof Room3dProps, value: string) => {
        const numericValue = parseFloat(value);
        if (isNaN(numericValue) || numericValue <= 0) return;

        setRoom3d(prevRoom => ({
            ...prevRoom,
            [key]: numericValue,
        }));
    };

    return (
        <View style={styles.container}>
            <Text style={styles.headerTitle}>Room Settings</Text>
            
            <View style={styles.inputGroup}>
                <Text style={styles.label}>Width (m)</Text>
                <TextInput 
                    keyboardType="numeric" 
                    placeholder="e.g. 5" 
                    onChangeText={(text) => handleUpdateRoom('width', text)}
                    defaultValue={room3dProps.width.toString()}
                    style={styles.input} 
                />
            </View>
            
            <View style={styles.inputGroup}>
                <Text style={styles.label}>Height (m)</Text>
                <TextInput 
                    keyboardType="numeric" 
                    placeholder="e.g. 2.5" 
                    onChangeText={(text) => handleUpdateRoom('height', text)}
                    defaultValue={room3dProps.height.toString()}
                    style={styles.input} 
                />
            </View>
            
            <View style={styles.inputGroup}>
                <Text style={styles.label}>Depth (m)</Text>
                <TextInput 
                    keyboardType="numeric" 
                    placeholder="e.g. 4" 
                    onChangeText={(text) => handleUpdateRoom('depth', text)}
                    defaultValue={room3dProps.depth.toString()}
                    style={styles.input} 
                />
            </View>

            {/* Botón para confirmar/cerrar */}
            <View style={styles.footer}>
                <Button label="Done" onPress={onClose} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: 300, // Ancho fijo para que parezca una tarjeta
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 24,
        // Sombra elegante
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 10,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 20,
        textAlign: 'center',
    },
    inputGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 12,
        fontWeight: '700',
        color: '#374151',
        marginBottom: 6,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    input: { 
        height: 44, 
        backgroundColor: '#f9fafb',
        borderColor: '#e5e7eb', 
        borderWidth: 1, 
        borderRadius: 8,
        paddingHorizontal: 12,
        fontSize: 14,
        color: '#1f2937',
    },
    footer: {
        marginTop: 10,
        alignItems: 'center', // Centramos el botón
    }
});