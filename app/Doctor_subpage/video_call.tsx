import { Ionicons } from '@expo/vector-icons';
import { useCameraPermissions } from 'expo-camera';
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

export default function VideoCallScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ consultationId: string; patientName: string; initialNotes: string; peerProfilePicture?: string }>();
    const { completeConsultation, updateConsultationNotes } = useAppointments();
    const { callState, endCall, minimizeCall, toggleMute, toggleVideo, updateDocFields, acceptCall, toggleCameraFacing, setAudioRoute } = useCall();

    const { isConnecting, durationSeconds: seconds, isMuted, isVideoOff, localStream, remoteStream, notes, diagnosis, prescription, audioRoute, availableAudioDevices } = callState;
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

    const [permission, requestPermission] = useCameraPermissions();

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

    if (!permission) {
        return <View style={styles.container} />;
    }

    if (callState.isIncoming && isConnecting) {
        return (
            <SafeAreaView style={styles.incomingContainer} edges={['top', 'bottom']}>
                <View style={styles.incomingHeader}>
                    <Text style={styles.incomingCallerName}>{params.patientName || callState.peerName || "Patient"}</Text>
                    <Text style={styles.incomingCallType}>Incoming Video Call</Text>
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
                            acceptCall(callState.callId, 'Video', callState.peerName);
                        }
                    }}>
                        <Ionicons name="videocam" size={32} color="#FFF" />
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    if (!permission.granted) {
        return (
            <SafeAreaView style={styles.permissionContainer} edges={['top', 'bottom']}>
                <Ionicons name="camera-outline" size={64} color="white" />
                <Text style={styles.permissionText}>Telehealth requires camera access to continue.</Text>
                <TouchableOpacity style={styles.grantBtn} onPress={requestPermission}>
                    <Text style={styles.grantBtnText}>Grant Permission</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
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
                    <View style={styles.videoStream}>
                        {isConnecting ? (
                            <View style={styles.connectingState}>
                                <ActivityIndicator size="large" color="#3B82F6" />
                                <Text style={styles.connectingText}>Connecting to {params.patientName || "Patient"}...</Text>
                            </View>
                        ) : (
                            <View style={{ flex: 1, width: '100%', height: '100%' }}>
                                {remoteStream ? (
                                    <RTCView
                                        style={[StyleSheet.absoluteFillObject, { backgroundColor: 'black' }]}
                                        objectFit="cover"
                                        streamURL={remoteStream.toURL()}
                                        zOrder={0}
                                    />
                                ) : (
                                    <View style={styles.patientPlaceholder}>
                                        {params.peerProfilePicture ? (
                                            <Image source={{ uri: params.peerProfilePicture }} style={{ width: 160, height: 160, borderRadius: 80 }} />
                                        ) : (
                                            <Ionicons name="person" size={80} color="#94A3B8" />
                                        )}
                                    </View>
                                )}

                                <View style={styles.callOverlay}>
                                    <View style={styles.callHeader}>
                                        <TouchableOpacity style={styles.backBtn} onPress={minimizeCall}>
                                            <Ionicons name="chevron-down" size={24} color="#FFF" />
                                        </TouchableOpacity>
                                        <View style={styles.timerBadge}>
                                            <View style={styles.redDot} />
                                            <Text style={styles.timerText}>{formatTime(seconds)}</Text>
                                        </View>
                                        <View style={{ width: 44 }} />
                                    </View>

                                    <Text style={styles.patientNameOverlay}>{params.patientName || "Patient"}</Text>

                                    <View style={styles.pipContainer}>
                                        {localStream && !isVideoOff ? (
                                            <RTCView
                                                style={[styles.cameraFeed, { backgroundColor: 'black' }]}
                                                objectFit="cover"
                                                streamURL={localStream.toURL()}
                                                mirror={true}
                                                zOrder={1}
                                            />
                                        ) : (
                                            <View style={[styles.pipPlaceholder, { backgroundColor: '#1E293B' }]}>
                                                <Ionicons name="videocam-off" size={20} color="#94A3B8" />
                                            </View>
                                        )}
                                        <Text style={styles.youText}>You</Text>
                                    </View>
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
                            style={[styles.controlBtn, isVideoOff && styles.controlBtnActive]}
                            onPress={toggleVideo}
                        >
                            <Ionicons name={isVideoOff ? "videocam-off" : "videocam"} size={22} color={isVideoOff ? "#FFF" : "#1E293B"} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.controlBtn, audioRoute !== 'EARPIECE' && styles.controlBtnActive]}
                            onPress={() => setShowAudioPicker(true)}
                        >
                            <Ionicons name={getAudioRouteIcon(audioRoute)} size={22} color={audioRoute !== 'EARPIECE' ? "#FFF" : "#1E293B"} />
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.controlBtn} onPress={toggleCameraFacing}>
                            <Ionicons name="camera-reverse" size={22} color="#1E293B" />
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
                            placeholder="Add notes during the call..."
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
    callSection: { flex: 0.45, backgroundColor: '#0F172A', position: 'relative' },
    videoStream: { flex: 1, backgroundColor: '#1E293B', justifyContent: 'center', alignItems: 'center' },
    connectingState: { alignItems: 'center', gap: 12 },
    connectingText: { color: '#94A3B8', fontSize: 16, fontWeight: '500' },
    patientPlaceholder: { width: 140, height: 140, borderRadius: 70, backgroundColor: '#334155', justifyContent: 'center', alignItems: 'center' },
    callOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between', padding: 16 },
    callHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    timerBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, gap: 6 },
    redDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' },
    timerText: { color: '#FFF', fontWeight: 'bold', fontSize: 14, fontVariant: ['tabular-nums'] },
    patientNameOverlay: { color: '#FFF', fontSize: 20, fontWeight: 'bold', textShadowColor: 'rgba(0,0,0,0.7)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
    pipContainer: { position: 'absolute', bottom: 24, right: 16, width: 100, height: 140, borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: '#FFF', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 8 },
    pipPlaceholder: { flex: 1, backgroundColor: '#475569', justifyContent: 'center', alignItems: 'center' },
    cameraFeed: { flex: 1 },
    youText: { position: 'absolute', bottom: 5, right: 8, color: 'white', fontSize: 10, fontWeight: 'bold', backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    controlsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 16, gap: 20, backgroundColor: '#0F172A' },
    controlBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center' },
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
    permissionContainer: { flex: 1, backgroundColor: '#1E293B', justifyContent: 'center', alignItems: 'center', padding: 20 },
    permissionText: { color: 'white', fontSize: 16, textAlign: 'center', marginTop: 20, marginBottom: 30 },
    grantBtn: { backgroundColor: '#3B82F6', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8, width: '100%', alignItems: 'center', marginBottom: 12 },
    grantBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    cancelBtn: { paddingHorizontal: 24, paddingVertical: 12, width: '100%', alignItems: 'center' },
    cancelBtnText: { color: '#94A3B8', fontSize: 16 },
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