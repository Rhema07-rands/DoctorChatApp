import { Ionicons } from '@expo/vector-icons';
import { usePathname } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCall } from '../app/_context/CallContext';

export default function FloatingCallWidget() {
    const { callState, returnToCall } = useCall();
    const pathname = usePathname();
    const insets = useSafeAreaInsets();

    const isCallScreen = pathname.includes('/audio_call') || pathname.includes('/video_call');

    // Only show if call is active and we are NOT on a call screen
    if (!callState.isActive || isCallScreen) {
        return null;
    }

    const formatTime = (totalSeconds: number) => {
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <TouchableOpacity
            style={[styles.container, { top: insets.top + 10 }]}
            onPress={returnToCall}
            activeOpacity={0.8}
        >
            <View style={styles.iconContainer}>
                <Ionicons
                    name={callState.type === 'Video' ? 'videocam' : 'call'}
                    size={20}
                    color="#FFF"
                />
            </View>
            <View style={styles.infoContainer}>
                <Text style={styles.statusText} numberOfLines={1}>
                    {callState.isConnecting ? "Connecting..." : `Call with ${callState.peerName}`}
                </Text>
                <Text style={styles.timerText}>
                    {callState.isConnecting ? "Wait..." : formatTime(callState.durationSeconds)}
                </Text>
            </View>
            <View style={styles.pulseIndicator} />
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        right: 16,
        left: 16,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#10B981',
        borderRadius: 16,
        paddingVertical: 12,
        paddingHorizontal: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 10,
        zIndex: 9999, // Ensure it's on top of everything
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    infoContainer: {
        flex: 1,
    },
    statusText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    timerText: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 12,
        fontVariant: ['tabular-nums'],
    },
    pulseIndicator: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#FFF',
        opacity: 0.8,
        // Typically we would animate this to pulse
    }
});
