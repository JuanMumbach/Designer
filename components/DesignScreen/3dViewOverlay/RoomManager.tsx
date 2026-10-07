import { StyleProp, StyleSheet, Text, TextInput, View, ViewStyle } from "react-native";
import Button from "../../Button"; // Importamos tu botón personalizado
import { Room3dProps } from "../3dView/Room3d";
import { GLASS, RADII } from "@/constants/theme";
import GlassSurface from "./GlassSurface";

interface RoomManagerProps {
    room3dProps: Room3dProps;
    setRoom3d: React.Dispatch<React.SetStateAction<Room3dProps>>;
    onClose: () => void; // <--- Agregamos esta prop para poder cerrar el menú
    containerStyle?: StyleProp<ViewStyle>;
}

export default function RoomManager({ room3dProps, setRoom3d, onClose, containerStyle }: RoomManagerProps) {
    
    const handleUpdateRoom = (key: keyof Room3dProps, value: string) => {
        const numericValue = parseFloat(value);
        if (isNaN(numericValue) || numericValue <= 0) return;

        setRoom3d(prevRoom => ({
            ...prevRoom,
            [key]: numericValue,
        }));
    };

    return (
        <GlassSurface style={[styles.container, containerStyle]}>
            <Text style={styles.headerTitle}>Room Settings</Text>
            
            <View style={styles.inputGroup}>
                <Text style={styles.label}>Width (m)</Text>
                <TextInput 
                    keyboardType="numeric" 
                    placeholder="e.g. 5" 
                    placeholderTextColor={GLASS.textFaint}
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
                    placeholderTextColor={GLASS.textFaint}
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
                    placeholderTextColor={GLASS.textFaint}
                    onChangeText={(text) => handleUpdateRoom('depth', text)}
                    defaultValue={room3dProps.depth.toString()}
                    style={styles.input} 
                />
            </View>

            {/* Botón para confirmar/cerrar */}
            <View style={styles.footer}>
                <Button label="Done" onPress={onClose} />
            </View>
        </GlassSurface>
    );
}

const styles = StyleSheet.create({
    container: {
        width: 300, // Ancho fijo para que parezca una tarjeta
        borderRadius: RADII.xl,
        padding: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 10,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: GLASS.text,
        marginBottom: 20,
        textAlign: 'center',
    },
    inputGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 12,
        fontWeight: '700',
        color: GLASS.textMuted,
        marginBottom: 6,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    input: { 
        height: 44, 
        backgroundColor: GLASS.bgInput,
        borderColor: GLASS.border, 
        borderWidth: 1, 
        borderRadius: RADII.md,
        paddingHorizontal: 12,
        fontSize: 14,
        color: GLASS.text,
    },
    footer: {
        marginTop: 10,
        alignItems: 'center', // Centramos el botón
    }
});