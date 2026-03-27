import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import {
    ActivityIndicator,
    TouchableOpacity,
    View,
    Image,
    Text,
    StyleSheet
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RTCView } from 'react-native-webrtc';
import { useCall, AudioRoute } from '../_context/CallContext';
import AudioOutputPicker from '../../components/AudioOutputPicker';

export default function PatientAudioCallScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ doctorName: string; initialNotes?: string; peerProfilePicture?: string }>();
    const { callState, endCall, minimizeCall, toggleMute, setAudioRoute, acceptCall } = useCall();

    const { isConnecting, durationSeconds: seconds, isMuted, isSpeakerOn, remoteStream, audioRoute, availableAudioDevices } = callState;
    const [showAudioPicker, setShowAudioPicker] = React.useState(false);

    const getAudioRouteIcon = (route: AudioRoute): 'bluetooth' | 'ear-outline' | 'volume-high' => {
        switch (route) {
            case 'BLUETOOTH': return 'bluetooth';
            case 'SPEAKER_PHONE': return 'volume-high';
            default: return 'ear-outline';
        }
    };

    // Screen dismisses itself when call ends for any reason
    React.useEffect(() => {
        if (!callState.isActive) {
            console.log(`[PatientAudioCallScreen] Call inactive, dismissing...`);
            if (router.canGoBack()) {
                router.back();
            } else {
                // Fallback
                router.replace('/(tab)/Patient_page/patient_chats' as any);
            }
        }
    }, [callState.isActive]);

    const formatTime = (totalSeconds: number) => {
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const handleEndCall = () => {
        endCall();
    };

    if (callState.isIncoming && isConnecting) {
        return (
            <SafeAreaView style={styles.incomingContainer} edges={['top', 'bottom']}>
                <View style={styles.incomingHeader}>
                    <Text style={styles.incomingCallerName}>{params.doctorName || callState.peerName || "Doctor"}</Text>
                    <Text style={styles.incomingCallType}>Incoming Audio Call</Text>
                </View>

                <View style={styles.incomingAvatarContainer}>
                    <View style={styles.incomingAvatarOuter}>
                        <View style={styles.incomingAvatarInner}>
                            {params.peerProfilePicture ? (
                                <Image source={{ uri: params.peerProfilePicture }} style={{ width: 140, height: 140, borderRadius: 70 }} />
                            ) : (
                                <Ionicons name="person" size={70} color="#94A3B8" />
                            )}
                        </View>
                    </View>
                </View>

                <View style={styles.incomingControls}>
                    <TouchableOpacity style={styles.incomingDeclineBtn} onPress={() => endCall()}>
                        <Ionicons name="call" size={32} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.incomingMessageBtn} onPress={() => { endCall(); minimizeCall(); }}>
                        <Ionicons name="chatbubble" size={24} color="#FFF" />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.incomingAcceptBtn} onPress={() => {
                        if (callState.callId) {
                            acceptCall(callState.callId, 'Audio', callState.peerName);
                        }
                    }}>
                        <Ionicons name="call" size={32} color="#FFF" />
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <View style={styles.callSection}>

                <View style={styles.callHeader}>
                    <TouchableOpacity style={styles.backBtn} onPress={minimizeCall}>
                        <Ionicons name="chevron-down" size={24} color="#FFF" />
                    </TouchableOpacity>

                    {/* Hidden RTCView to route WebRTC Audio output with stream fix */}
                    {remoteStream && (
                        <View style={{ width: 1, height: 1, opacity: 0 }}>
                            <RTCView streamURL={remoteStream.toURL()} style={{ width: 1, height: 1 }} />
                        </View>
                    )}
                </View>

                <View style={styles.audioStream}>
                    {isConnecting ? (
                        <View style={styles.connectingState}>
                            <ActivityIndicator size="large" color="#3B82F6" />
                            <Text style={styles.connectingText}>Calling {params.doctorName || "Doctor"}...</Text>
                        </View>
                    ) : (
                        <View style={{ alignItems: 'center' }}>
                            <View style={styles.doctorAvatarOuter}>
                                <View style={styles.doctorAvatarInner}>
                                    {params.peerProfilePicture ? (
                                        <Image source={{ uri: params.peerProfilePicture }} style={{ width: 110, height: 110, borderRadius: 55 }} />
                                    ) : (
                                        <Ionicons name="person" size={60} color="#94A3B8" />
                                    )}
                                </View>
                            </View>
                            <Text style={styles.doctorNameOverlay}>{params.doctorName || "Dr. Sarah Johnson"}</Text>
                            <Text style={styles.audioStatus}>Audio Call - Secure</Text>
                            <View style={styles.timerBadge}>
                                <View style={styles.greenDot} />
                                <Text style={styles.timerText}>{formatTime(seconds)}</Text>
                            </View>
                        </View>
                    )}
                </View>

                <View style={styles.controlsRow}>
                    <TouchableOpacity
                        style={[styles.controlBtn, isMuted && styles.controlBtnActive]}
                        onPress={toggleMute}
                    >
                        <Ionicons name={isMuted ? "mic-off" : "mic"} size={22} color={isMuted ? "#FFF" : "#1E293B"} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.controlBtn, audioRoute !== 'EARPIECE' && styles.controlBtnActive]}
                        onPress={() => setShowAudioPicker(true)}
                    >
                        <Ionicons name={getAudioRouteIcon(audioRoute)} size={22} color={audioRoute !== 'EARPIECE' ? "#FFF" : "#1E293B"} />
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.controlBtn, { backgroundColor: '#EF4444' }]} onPress={handleEndCall}>
                        <Ionicons name="call" size={30} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
                    </TouchableOpacity>
                </View>
            </View>

            <AudioOutputPicker
                visible={showAudioPicker}
                onClose={() => setShowAudioPicker(false)}
                currentRoute={audioRoute}
                availableDevices={availableAudioDevices}
                onSelectRoute={setAudioRoute}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0F172A',
    },
    /* CALL SECTION (FULL SCREEN) */
    callSection: {
        flex: 1,
        backgroundColor: '#1E293B',
        position: 'relative',
        justifyContent: 'space-between',
        paddingTop: 16,
        paddingBottom: 40,
    },
    callHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    backBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    timerBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        gap: 6,
        marginTop: 12,
    },
    greenDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#10B981',
    },
    timerText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 14,
        fontVariant: ['tabular-nums'],
    },

    /* Center Audio Animation */
    audioStream: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    doctorAvatarOuter: {
        width: 180,
        height: 180,
        borderRadius: 90,
        backgroundColor: 'rgba(59, 130, 246, 0.2)', // gentle blue pulse ring
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    doctorAvatarInner: {
        width: 140,
        height: 140,
        borderRadius: 70,
        backgroundColor: '#334155',
        justifyContent: 'center',
        alignItems: 'center',
    },
    doctorNameOverlay: {
        color: '#FFF',
        fontSize: 26,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    audioStatus: {
        color: '#94A3B8',
        fontSize: 16,
    },
    connectingState: {
        alignItems: 'center',
        gap: 16,
    },
    connectingText: {
        color: '#94A3B8',
        fontSize: 18,
        fontWeight: '500',
    },

    controlsRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 20,
        gap: 32,
    },
    controlBtn: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#FFF',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    controlBtnActive: {
        backgroundColor: '#475569',
    },

    /* INCOMING CALL UI (WhatsApp Style) */
    incomingContainer: {
        flex: 1,
        backgroundColor: '#0F172A',
        justifyContent: 'space-between',
        paddingVertical: 40,
    },
    incomingHeader: {
        alignItems: 'center',
        marginTop: 20,
    },
    incomingCallerName: {
        color: '#FFF',
        fontSize: 32,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    incomingCallType: {
        color: '#94A3B8',
        fontSize: 18,
    },
    incomingAvatarContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
    },
    incomingAvatarOuter: {
        width: 220,
        height: 220,
        borderRadius: 110,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    incomingAvatarInner: {
        width: 170,
        height: 170,
        borderRadius: 85,
        backgroundColor: '#334155',
        justifyContent: 'center',
        alignItems: 'center',
    },
    incomingControls: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingHorizontal: 30,
        paddingBottom: 40,
    },
    incomingDeclineBtn: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: '#EF4444',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#EF4444',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
    },
    incomingMessageBtn: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#334155',
        justifyContent: 'center',
        alignItems: 'center',
    },
    incomingAcceptBtn: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: '#22C55E',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#22C55E',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
    },
});