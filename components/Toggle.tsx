import { Pressable, StyleSheet, Text, View } from 'react-native';

interface ToggleProps {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}

export default function Toggle({
  label,
  value,
  onValueChange,
  disabled,
}: ToggleProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        style={[styles.track, value && styles.trackActive, disabled && styles.trackDisabled]}
        onPress={() => onValueChange(!value)}
        disabled={disabled}
      >
        <View style={[styles.thumb, value && styles.thumbActive]} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },
  track: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#d1d5db',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  trackActive: {
    backgroundColor: '#2563eb',
  },
  trackDisabled: {
    opacity: 0.4,
  },
  thumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  thumbActive: {
    alignSelf: 'flex-end',
  },
});