import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import { AudioRoute } from '../app/_context/CallContext';

interface AudioOutputPickerProps {
    visible: boolean;
    onClose: () => void;
    currentRoute: AudioRoute;
    availableDevices: string[];
    onSelectRoute: (route: AudioRoute) => void;
}

interface RouteOption {
    route: AudioRoute;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    description: string;
}

const ALL_ROUTES: RouteOption[] = [
    {
        route: 'BLUETOOTH',
        label: 'Bluetooth',
        icon: 'bluetooth',
        description: 'Connected headphones / speaker',
    },
    {
        route: 'EARPIECE',
        label: 'Earpiece',
        icon: 'ear-outline',
        description: 'Phone earpiece',
    },
    {
        route: 'SPEAKER_PHONE',
        label: 'Speaker',
        icon: 'volume-high',
        description: 'Phone loudspeaker',
    },
];

export default function AudioOutputPicker({
    visible,
    onClose,
    currentRoute,
    availableDevices,
    onSelectRoute,
}: AudioOutputPickerProps) {
    // Earpiece and Speaker are always available; Bluetooth only if detected
    const routes = ALL_ROUTES.filter(r => {
        if (r.route === 'BLUETOOTH') {
            return availableDevices.includes('BLUETOOTH');
        }
        return true;
    });

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.overlay}>
                    <TouchableWithoutFeedback>
                        <View style={styles.sheet}>
                            <View style={styles.handle} />
                            <Text style={styles.title}>Audio Output</Text>

                            {routes.map(({ route, label, icon, description }) => {
                                const isSelected = route === currentRoute;
                                return (
                                    <TouchableOpacity
                                        key={route}
                                        style={[
                                            styles.option,
                                            isSelected && styles.optionSelected,
                                        ]}
                                        onPress={() => {
                                            onSelectRoute(route);
                                            onClose();
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        <View style={[
                                            styles.iconCircle,
                                            isSelected && styles.iconCircleSelected,
                                        ]}>
                                            <Ionicons
                                                name={icon}
                                                size={22}
                                                color={isSelected ? '#FFF' : '#94A3B8'}
                                            />
                                        </View>

                                        <View style={styles.optionText}>
                                            <Text style={[
                                                styles.optionLabel,
                                                isSelected && styles.optionLabelSelected,
                                            ]}>
                                                {label}
                                            </Text>
                                            <Text style={styles.optionDesc}>{description}</Text>
                                        </View>

                                        {isSelected && (
                                            <Ionicons name="checkmark-circle" size={24} color="#3B82F6" />
                                        )}
                                    </TouchableOpacity>
                                );
                            })}

                            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                                <Text style={styles.cancelText}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: '#1E293B',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingBottom: 40,
        paddingTop: 12,
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#475569',
        alignSelf: 'center',
        marginBottom: 16,
    },
    title: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
    },
    option: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderRadius: 14,
        marginBottom: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
    },
    optionSelected: {
        backgroundColor: 'rgba(59, 130, 246, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(59, 130, 246, 0.3)',
    },
    iconCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#334155',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    iconCircleSelected: {
        backgroundColor: '#3B82F6',
    },
    optionText: {
        flex: 1,
    },
    optionLabel: {
        color: '#CBD5E1',
        fontSize: 16,
        fontWeight: '600',
    },
    optionLabelSelected: {
        color: '#FFF',
    },
    optionDesc: {
        color: '#64748B',
        fontSize: 13,
        marginTop: 2,
    },
    cancelBtn: {
        marginTop: 12,
        paddingVertical: 14,
        alignItems: 'center',
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
    },
    cancelText: {
        color: '#94A3B8',
        fontSize: 16,
        fontWeight: '600',
    },
});
