import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RTCView } from 'react-native-webrtc';
import { useAppointments } from '../../app/_context/AppointmentContext';
import { useCall, AudioRoute } from '../_context/CallContext';
import AudioOutputPicker from '../../components/AudioOutputPicker';

export default function AudioCallScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ consultationId: string; patientName: string; initialNotes: string; peerProfilePicture?: string }>();
    const { completeConsultation, updateConsultationNotes } = useAppointments();
    const { callState, endCall, minimizeCall, toggleMute, setAudioRoute, updateDocFields, acceptCall } = useCall();

    const { isConnecting, durationSeconds: seconds, isMuted, isSpeakerOn, notes, diagnosis, prescription, remoteStream, audioRoute, availableAudioDevices } = callState;
    const [showAudioPicker, setShowAudioPicker] = React.useState(false);
    const setNotes = (text: string) => updateDocFields({ notes: text });
    const setDiagnosis = (text: string) => updateDocFields({ diagnosis: text });
    const setPrescription = (text: string) => updateDocFields({ prescription: text });

    const getAudioRouteIcon = (route: AudioRoute): 'bluetooth' | 'ear-outline' | 'volume-high' => {
        switch (route) {
            case 'BLUETOOTH': return 'bluetooth';
            case 'SPEAKER_PHONE': return 'volume-high';
            default: return 'ear-outline';
        }
    };

    // Screen dismisses itself when call ends for any reason
    useEffect(() => {
        if (!callState.isActive) {
            console.log(`[${callState.type}CallScreen] Call inactive, dismissing...`);
            if (router.canGoBack()) {
                router.back();
            } else {
                // Fallback: the doctor should go to their chat dashboard
                router.replace('/(tab)/Doctor_page/doctor_chats' as any);
            }
        }
    }, [callState.isActive]);

    const formatTime = (totalSeconds: number) => {
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const handleSaveNotes = () => {
        if (params.consultationId) {
            updateConsultationNotes(params.consultationId, notes);
            Alert.alert("Saved", "Notes saved successfully!");
        }
    };

    const handleEndCall = () => {
        endCall();
    };

    const handleCompleteConsultation = () => {
        if (!params.consultationId) {
            endCall();
            return;
        }
        completeConsultation(params.consultationId, notes, diagnosis, prescription);
        endCall();
    };

    if (callState.isIncoming && isConnecting) {
        return (
            <SafeAreaView style={styles.incomingContainer} edges={['top', 'bottom']}>
                <View style={styles.incomingHeader}>
                    <Text style={styles.incomingCallerName}>{params.patientName || callState.peerName || "Patient"}</Text>
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
            <KeyboardAvoidingView
                style={styles.keyboardAvoid}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <View style={styles.callSection}>
                    <View style={styles.callHeader}>
                        <TouchableOpacity style={styles.backBtn} onPress={minimizeCall}>
                            <Ionicons name="chevron-down" size={24} color="#FFF" />
                        </TouchableOpacity>

                        {/* Hidden RTCView to route WebRTC Audio output */}
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
                                <Text style={styles.connectingText}>Calling {params.patientName || "Patient"}...</Text>
                            </View>
                        ) : (
                            <View style={{ alignItems: 'center' }}>
                                <View style={styles.timerBadge}>
                                    <View style={styles.greenDot} />
                                    <Text style={styles.timerText}>{formatTime(seconds)}</Text>
                                </View>
                                <View style={styles.patientAvatarOuter}>
                                    <View style={styles.patientAvatarInner}>
                                        {params.peerProfilePicture ? (
                                            <Image source={{ uri: params.peerProfilePicture }} style={{ width: 110, height: 110, borderRadius: 55 }} />
                                        ) : (
                                            <Ionicons name="person" size={60} color="#94A3B8" />
                                        )}
                                    </View>
                                </View>
                                <Text style={styles.patientNameOverlay}>{params.patientName || "Patient"}</Text>
                                <Text style={styles.audioStatus}>Audio Call - Secure</Text>
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
                            <Ionicons name="call" size={22} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.docSection}>
                    <View style={styles.docHeader}>
                        <Text style={styles.docTitle}>Consultation Workspace</Text>
                        <TouchableOpacity onPress={handleSaveNotes}>
                            <Text style={styles.saveLink}>Save Draft</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                        <Text style={styles.sectionLabel}>Clinical Notes</Text>
                        <TextInput
                            style={styles.textArea}
                            placeholder="Type notes while you listen..."
                            value={notes}
                            onChangeText={setNotes}
                            multiline
                            textAlignVertical="top"
                        />

                        <Text style={styles.sectionLabel}>Diagnosis</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Final diagnosis..."
                            value={diagnosis}
                            onChangeText={setDiagnosis}
                        />

                        <Text style={styles.sectionLabel}>Prescription Details</Text>
                        <TextInput
                            style={styles.textArea}
                            placeholder="Dosage, frequency, duration..."
                            value={prescription}
                            onChangeText={setPrescription}
                            multiline
                            textAlignVertical="top"
                        />

                        <View style={{ height: 24 }} />

                        <TouchableOpacity style={styles.completeBtn} onPress={handleCompleteConsultation}>
                            <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                            <Text style={styles.completeBtnText}>Complete Consultation</Text>
                        </TouchableOpacity>

                        <View style={{ height: 40 }} />
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>

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
    container: { flex: 1, backgroundColor: '#0F172A' },
    keyboardAvoid: { flex: 1 },
    callSection: { flex: 0.45, backgroundColor: '#1E293B', position: 'relative', justifyContent: 'space-between', paddingTop: 16 },
    callHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20 },
    backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
    timerBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, gap: 6, marginBottom: 16 },
    greenDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' },
    timerText: { color: '#FFF', fontWeight: 'bold', fontSize: 14, fontVariant: ['tabular-nums'] },
    audioStream: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    patientAvatarOuter: { width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(59, 130, 246, 0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
    patientAvatarInner: { width: 110, height: 110, borderRadius: 55, backgroundColor: '#334155', justifyContent: 'center', alignItems: 'center' },
    patientNameOverlay: { color: '#FFF', fontSize: 22, fontWeight: 'bold', marginBottom: 4 },
    audioStatus: { color: '#94A3B8', fontSize: 14 },
    connectingState: { alignItems: 'center', gap: 12 },
    connectingText: { color: '#94A3B8', fontSize: 16, fontWeight: '500' },
    controlsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 20, gap: 24 },
    controlBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
    controlBtnActive: { backgroundColor: '#475569' },
    docSection: { flex: 0.55, backgroundColor: '#F8FAFC', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 20 },
    docHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 16 },
    docTitle: { fontSize: 18, fontWeight: 'bold', color: '#0F172A' },
    saveLink: { fontSize: 14, fontWeight: '600', color: '#3B82F6' },
    scrollContent: { paddingHorizontal: 20 },
    sectionLabel: { fontSize: 13, fontWeight: '600', color: '#64748B', marginTop: 16, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
    input: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 14, fontSize: 15, color: '#1E293B' },
    textArea: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 14, fontSize: 15, color: '#1E293B', minHeight: 100 },
    completeBtn: { flexDirection: 'row', backgroundColor: '#10B981', paddingVertical: 16, borderRadius: 12, justifyContent: 'center', alignItems: 'center', gap: 8, shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
    completeBtnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
    incomingContainer: { flex: 1, backgroundColor: '#0F172A', justifyContent: 'space-between', paddingVertical: 40 },
    incomingHeader: { alignItems: 'center', marginTop: 20 },
    incomingCallerName: { color: '#FFF', fontSize: 32, fontWeight: 'bold', marginBottom: 8 },
    incomingCallType: { color: '#94A3B8', fontSize: 18 },
    incomingAvatarContainer: { alignItems: 'center', justifyContent: 'center', flex: 1 },
    incomingAvatarOuter: { width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255, 255, 255, 0.05)', justifyContent: 'center', alignItems: 'center' },
    incomingAvatarInner: { width: 170, height: 170, borderRadius: 85, backgroundColor: '#334155', justifyContent: 'center', alignItems: 'center' },
    incomingControls: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingHorizontal: 30, paddingBottom: 40 },
    incomingDeclineBtn: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center', shadowColor: '#EF4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8 },
    incomingMessageBtn: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#334155', justifyContent: 'center', alignItems: 'center' },
    incomingAcceptBtn: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#22C55E', justifyContent: 'center', alignItems: 'center', shadowColor: '#22C55E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8 },
});