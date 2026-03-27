import { usePathname, useRouter } from 'expo-router';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Alert, DeviceEventEmitter, Platform, PermissionsAndroid } from 'react-native';
import InCallManager from 'react-native-incall-manager';
import { MediaStream } from 'react-native-webrtc';
import { api } from '../../src/services/api';
import { signalRService } from '../../src/services/signalrService';
import { WebRtcService } from '../../src/services/webRtcService';
import { useUser } from './UserContext';

export type CallType = 'Audio' | 'Video';
export type CallRole = 'Doctor' | 'Patient';
export type AudioRoute = 'EARPIECE' | 'SPEAKER_PHONE' | 'BLUETOOTH';

export interface CallState {
    isActive: boolean;
    isConnecting: boolean;
    type: CallType | null;
    role: CallRole | null;
    peerName: string;
    peerProfilePicture?: string;
    consultationId?: string;
    durationSeconds: number;
    isMuted: boolean;
    isSpeakerOn: boolean;
    isVideoOff: boolean;
    notes: string;
    diagnosis: string;
    prescription: string;
    localStream: MediaStream | null;
    remoteStream: MediaStream | null;
    callId: string | null;
    targetUserId: string | null;
    isIncoming: boolean;
    remoteStreamVersion: number;
    audioRoute: AudioRoute;
    availableAudioDevices: string[];
}

interface CallContextType {
    callState: CallState;
    startCall: (params: { targetUserId: string; type: CallType; role: CallRole; peerName: string; peerProfilePicture?: string; consultationId?: string; initialNotes?: string }) => void;
    acceptCall: (callId: string, type: CallType, peerName: string) => void;
    declineCall: (callId: string) => void;
    endCall: () => void;
    minimizeCall: () => void;
    returnToCall: () => void;

    // Controls
    toggleMute: () => void;
    setAudioRoute: (route: AudioRoute) => void;
    toggleVideo: () => void;
    toggleCameraFacing: () => void;

    // Doc Actions
    updateDocFields: (fields: Partial<Pick<CallState, 'notes' | 'diagnosis' | 'prescription'>>) => void;
}

const defaultState: CallState = {
    isActive: false,
    isConnecting: false,
    type: null,
    role: null,
    peerName: '',
    peerProfilePicture: undefined,
    durationSeconds: 0,
    isMuted: false,
    isSpeakerOn: false,
    isVideoOff: false,
    notes: '',
    diagnosis: '',
    prescription: '',
    localStream: null,
    remoteStream: null,
    remoteStreamVersion: 0,
    callId: null,
    targetUserId: null,
    isIncoming: false,
    audioRoute: 'EARPIECE',
    availableAudioDevices: [],
};

const CallContext = createContext<CallContextType | undefined>(undefined);

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [callState, setCallState] = useState<CallState>(defaultState);
    const router = useRouter();
    const pathname = usePathname();

    const { firstName, lastName, patientName, userRole, patientId: userId } = useUser();
    const currentUserName = userRole === 'doctor' ? `${firstName} ${lastName}` : patientName;

    const rtcService = useRef<WebRtcService | null>(null);
    const callStateRef = useRef<CallState>(callState);
    const pathnameRef = useRef<string>(pathname);
    const userIdRef = useRef<string>(userId);
    const isEndingRef = useRef<boolean>(false);
    const lastCallIdRef = useRef<string | null>(null);
    const lastCallTimeRef = useRef<number>(0);

    useEffect(() => {
        callStateRef.current = callState;
    }, [callState]);

    useEffect(() => {
        pathnameRef.current = pathname;
    }, [pathname]);

    useEffect(() => {
        userIdRef.current = userId;
    }, [userId]);

    const handleEndCallInternal = async (currentCallState: CallState, skipApi: boolean = false) => {
        console.log('⚡ handleEndCallInternal — isActive:', currentCallState.isActive, 'isEndingRef:', isEndingRef.current, 'callId:', currentCallState.callId);

        if (!currentCallState.isActive) {
            console.log('⚡ handleEndCallInternal: Already inactive, returning early.');
            return;
        }

        // Set as inactive immediately to prevent duplicate UI executions
        setCallState(prev => ({ ...prev, isActive: false }));

        // RINGTONE / RINGBACK: Stop in all termination paths
        try { InCallManager.stopRingtone(); } catch (e) { console.log('InCallManager stopRingtone ignored'); }
        try { InCallManager.stopRingback(); } catch (e) { console.log('InCallManager stopRingback ignored'); }
        try { InCallManager.stop(); } catch (e) { console.log('InCallManager stop ignored'); }

        // Force state reset IMMEDIATELY to ensure UI dismisses without blocking on API
        setCallState(defaultState);

        rtcService.current?.closeConnection();
        if (currentCallState.callId && !skipApi) {
            try {
                if (currentCallState.isActive && !currentCallState.isConnecting) {
                    await api.put(`calls/${currentCallState.callId}/end`);
                } else if (currentCallState.isConnecting && currentCallState.role === 'Patient') {
                    await api.put(`calls/${currentCallState.callId}/missed`);
                } else if (currentCallState.isConnecting && currentCallState.role === 'Doctor') {
                    await api.put(`calls/${currentCallState.callId}/end`);
                }
            } catch (error) {
                console.error("Failed to end call API:", error);
                if (currentCallState.targetUserId) {
                    signalRService.invokeSignaling('EndCall', currentCallState.targetUserId, currentCallState.callId);
                }
            }
        }
    };

    // Initialize WebRTC and SignalR Listeners once
    useEffect(() => {
        rtcService.current = new WebRtcService();
        rtcService.current.setOnRemoteStreamAdd((stream: MediaStream) => {
            setCallState(prev => ({
                ...prev,
                remoteStream: stream,
                isConnecting: false,
                remoteStreamVersion: prev.remoteStreamVersion + 1
            }));
        });

        const setupSignalR = () => {
            const unsubIncoming = signalRService.onIncomingCall((data: any) => {
                console.log('Incoming call received:', data);

                const cId = data.callId || data.CallId || data.id || data.Id;

                // Deduplication logic for identical call signals within 5 seconds
                const now = Date.now();
                if (cId === lastCallIdRef.current && (now - lastCallTimeRef.current < 5000)) {
                    console.log('Duplicate incoming call signal ignored:', cId);
                    return;
                }

                // CRITICAL: If we are currently active, ignore new signals
                if (callStateRef.current.isActive) {
                    console.log('Call already active, ignoring incoming call signal');
                    return;
                }

                lastCallIdRef.current = cId;
                lastCallTimeRef.current = now;

                const cType = data.callType || data.CallType;
                const callerId = data.callerId || data.CallerId;
                const callerName = data.callerName || data.CallerName;
                const callerProfilePicture = data.callerProfilePicture || data.CallerProfilePicture;

                // CRITICAL: If the caller is me, ignore (prevents ringtone on outgoing calls)
                if (callerId && userIdRef.current && callerId.toLowerCase() === userIdRef.current.toLowerCase()) {
                    console.log('Incoming call is from myself, ignoring signal.');
                    return;
                }

                const isVideo = cType === 'Video' || cType === 2;
                const currentRole: CallRole = pathnameRef.current.includes('Doctor') ? 'Doctor' : 'Patient';

                setCallState(prev => ({
                    ...defaultState,
                    isActive: true,
                    isConnecting: true,
                    isIncoming: true,
                    type: isVideo ? 'Video' : 'Audio',
                    role: currentRole,
                    peerName: callerName,
                    peerProfilePicture: callerProfilePicture,
                    callId: cId,
                    targetUserId: callerId,
                    // Preserve already-detected audio devices
                    availableAudioDevices: prev.availableAudioDevices,
                }));

                // RINGTONE: Play the device's system ringtone while the user
                // decides to accept or decline. '_DEFAULT_' uses whatever
                // ringtone the user has configured on their device.
                try { InCallManager.startRingtone('_DEFAULT_', [0, 500, 1000], 'ringtone', 300); } catch (e) { console.log('InCallManager startRingtone ignored'); }

                navigateToCallScreen(currentRole, isVideo ? 'Video' : 'Audio', callerName, undefined, callerProfilePicture, true);
            });

            const unsubAnswered = signalRService.onCallAnswered(async (data: any) => {
                const callId = data.callId || data.CallId;
                const answererId = data.answererId || data.AnswererId || callStateRef.current.targetUserId;

                // FIX: Check isAccepted — if false the receiver rejected the
                // call so we must end on the caller's side too, not create an offer.
                const isAccepted = data.isAccepted ?? data.IsAccepted ?? data.accepted ?? data.Accepted;

                console.log('SignalR: CallAnswered received:', { callId, isAccepted });

                // Stop any ringback that might be playing on the caller side
                try { InCallManager.stopRingback(); } catch (e) { /* ignore */ }

                if (isAccepted === false) {
                    handleEndCallInternal(callStateRef.current, true);
                    return;
                }

                if (rtcService.current && answererId) {
                    const isVideo = callStateRef.current.type === 'Video';
                    await rtcService.current.createOffer(answererId, callId, isVideo);
                } else {
                    handleEndCallInternal(callStateRef.current, true);
                }
            });

            const unsubRejected = signalRService.onCallRejected((data: any) => {
                console.log('SignalR: CallRejected event received');
                handleEndCallInternal(callStateRef.current, true);
            });

            const unsubMissed = signalRService.onMissedCall((data: any) => {
                console.log('SignalR: MissedCall event received');
                handleEndCallInternal(callStateRef.current, true);
            });

            const unsubEnded = signalRService.onCallEnded((data: any) => {
                console.log('SignalR: CallEnded event received');
                handleEndCallInternal(callStateRef.current, true);
            });

            const unsubFailed = signalRService.onCallFailed((data: { reason: string }) => {
                console.log('SignalR: CallFailed received:', data.reason);
                Alert.alert('Call Failed', data.reason);
                handleEndCallInternal(callStateRef.current, true);
            });

            const unsubOffer = signalRService.onReceiveOffer(async (from, callId, sdp) => {
                console.log('SignalR: ReceiveOffer received:', { from, callId, sdpLength: sdp?.length });
                const targetId = callStateRef.current.targetUserId || from;
                await rtcService.current?.handleOffer(targetId, callId, sdp);
            });

            const unsubAnswer = signalRService.onReceiveAnswer(async (from, callId, sdp) => {
                console.log('SignalR: ReceiveAnswer received:', { from, callId, sdpLength: sdp?.length });
                await rtcService.current?.handleAnswer(sdp);
            });

            const unsubCandidate = signalRService.onReceiveCandidate(async (from, callId, candidate) => {
                console.log('SignalR: ReceiveCandidate received from:', from);
                await rtcService.current?.handleCandidate(candidate);
            });

            return () => {
                unsubIncoming();
                unsubAnswered();
                unsubRejected();
                unsubMissed();
                unsubEnded();
                unsubFailed();
                unsubOffer();
                unsubAnswer();
                unsubCandidate();
            };
        };

        const cleanupSignalR = setupSignalR();

        return () => {
            cleanupSignalR();
        };
    }, []);

    // Timer logic
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (callState.isActive && !callState.isConnecting) {
            interval = setInterval(() => {
                setCallState(prev => ({ ...prev, durationSeconds: prev.durationSeconds + 1 }));
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [callState.isActive, callState.isConnecting]);

    // Audio device change listener — always active so we never miss events from InCallManager.start()
    useEffect(() => {
        // Request BLUETOOTH_CONNECT at runtime for Android 12+ (API 31+)
        if (Platform.OS === 'android' && Platform.Version >= 31) {
            PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
                {
                    title: 'Bluetooth Permission',
                    message: 'This app needs access to Bluetooth to use your wireless headphones or speakers during calls.',
                    buttonPositive: 'Allow',
                    buttonNegative: 'Deny',
                }
            ).then(granted => {
                console.log('BLUETOOTH_CONNECT permission:', granted);
            }).catch(e => {
                console.log('Bluetooth permission request error:', e);
            });
        }

        const parseDeviceList = (raw: string | undefined): string[] => {
            if (!raw) return [];
            try {
                // InCallManager returns a JSON array string like '["EARPIECE","SPEAKER_PHONE"]'
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) return parsed.map((d: string) => d.trim()).filter(Boolean);
            } catch {
                // Fallback: try comma-separated
            }
            return raw.split(',').map(d => d.trim()).filter(Boolean);
        };

        const subscription = DeviceEventEmitter.addListener(
            'onAudioDeviceChanged',
            (data: { availableAudioDeviceList?: string; selectedAudioDevice?: string }) => {
                console.log('Audio device changed:', JSON.stringify(data));
                try {
                    const devices = parseDeviceList(data.availableAudioDeviceList);
                    const selected = (data.selectedAudioDevice || '').trim();

                    setCallState(prev => {
                        // Only do auto-routing if a call is active
                        if (!prev.isActive) {
                            return { ...prev, availableAudioDevices: devices };
                        }

                        const wasBluetoothAvailable = prev.availableAudioDevices.includes('BLUETOOTH');
                        const isBluetoothNowAvailable = devices.includes('BLUETOOTH');

                        // Auto-switch to Bluetooth when it newly becomes available
                        let newRoute = prev.audioRoute;
                        if (!wasBluetoothAvailable && isBluetoothNowAvailable) {
                            try {
                                InCallManager.chooseAudioRoute('BLUETOOTH');
                                newRoute = 'BLUETOOTH';
                            } catch (e) { /* ignore */ }
                        }
                        // If current route was Bluetooth and it disconnected, fall back
                        if (prev.audioRoute === 'BLUETOOTH' && !isBluetoothNowAvailable) {
                            const fallback: AudioRoute = prev.type === 'Video' ? 'SPEAKER_PHONE' : 'EARPIECE';
                            try {
                                InCallManager.chooseAudioRoute(fallback);
                                newRoute = fallback;
                            } catch (e) { /* ignore */ }
                        }

                        return {
                            ...prev,
                            availableAudioDevices: devices,
                            audioRoute: newRoute,
                            isSpeakerOn: newRoute === 'SPEAKER_PHONE',
                        };
                    });
                } catch (e) {
                    console.log('Error parsing audio device change:', e);
                }
            }
        );

        return () => {
            subscription.remove();
        };
    }, []);

    const startCall = async (params: { targetUserId: string; type: CallType; role: CallRole; peerName: string; peerProfilePicture?: string; consultationId?: string; initialNotes?: string }) => {
        if (!rtcService.current) return;
        
        if (callState.isActive) {
            console.log('Call already active, suppressing startCall');
            return;
        }

        const newCallId = params.consultationId || new Date().getTime().toString();
        const stream = await rtcService.current?.setupMedia(params.type === 'Video');

        setCallState(prev => ({
            ...defaultState,
            isActive: true,
            isConnecting: true,
            type: params.type,
            role: params.role,
            peerName: params.peerName,
            peerProfilePicture: params.peerProfilePicture,
            targetUserId: params.targetUserId,
            isIncoming: false,
            consultationId: params.consultationId,
            notes: params.initialNotes || '',
            localStream: stream || null,
            // Preserve already-detected audio devices from the listener
            availableAudioDevices: prev.availableAudioDevices,
        }));

        // Start InCallManager for audio routing — no ringback/ringtone on caller side
        try {
            InCallManager.start({ media: 'audio' });
            // Request initial audio device list after a short delay to let the system settle
            setTimeout(() => {
                try {
                    // Auto-select speaker for video calls, earpiece for audio
                    const defaultRoute: AudioRoute = params.type === 'Video' ? 'SPEAKER_PHONE' : 'EARPIECE';
                    InCallManager.chooseAudioRoute(defaultRoute);
                    setCallState(prev => ({ ...prev, audioRoute: defaultRoute }));
                } catch (e) {
                    console.log('Initial audio route selection ignored', e);
                }
            }, 300);
        } catch (e) {
            console.log('InCallManager start ignored', e);
        }

        navigateToCallScreen(params.role, params.type, params.peerName, undefined, params.peerProfilePicture, false);

        try {
            // Check if backend provides a CallId via Initiate (so it's properly logged in DB)
            const initiateResponse = await api.post('calls/initiate', {
                receiverId: params.targetUserId,
                callType: params.type === 'Video' ? 2 : 1
            });
            const dbCallId = initiateResponse.data.id || initiateResponse.data.Id;
            const finalCallId = dbCallId || newCallId;

            setCallState(prev => ({ ...prev, callId: finalCallId }));

            // 1. Establish peer connection object locally
            await rtcService.current?.createPeerConnection(params.targetUserId, finalCallId);

            // NOTE: The REST /calls/initiate endpoint internally sends IncomingCall 
            // to the receiver via the SignalingHub. We do NOT need to call 
            // signalRService.invokeSignaling('CallUser') here unless the REST call fails.
        } catch (error) {
            console.error('Failed to initiate call via REST API:', error);
            // Fallback: REST failed so manually notify receiver via SignalR hub
            await rtcService.current?.createPeerConnection(params.targetUserId, newCallId);
            signalRService.invokeSignaling(
                'CallUser',
                params.targetUserId,
                newCallId,
                params.type,
                params.role === 'Doctor' ? `Dr. ${currentUserName}` : currentUserName
            );
        }

        // Navigate internally (ensure we only navigate once)
        if (callStateRef.current.isActive) {
            navigateToCallScreen(params.role, params.type, params.peerName, params.consultationId, params.peerProfilePicture);
        }
    };

    const acceptCall = async (callId: string, type: CallType, peerName: string) => {
        // RINGTONE: Stop as soon as the user taps Accept
        try { InCallManager.stopRingtone(); } catch (e) { console.log('InCallManager stopRingtone ignored'); }

        // Start InCallManager for audio routing on the receiver side
        try {
            InCallManager.start({ media: 'audio' });
            // Set default route after InCallManager initializes
            setTimeout(() => {
                try {
                    const defaultRoute: AudioRoute = type === 'Video' ? 'SPEAKER_PHONE' : 'EARPIECE';
                    InCallManager.chooseAudioRoute(defaultRoute);
                    setCallState(prev => ({ ...prev, audioRoute: defaultRoute }));
                } catch (e) {
                    console.log('Initial audio route selection ignored', e);
                }
            }, 300);
        } catch (e) {
            console.log('InCallManager start on accept ignored', e);
        }

        const stream = await rtcService.current?.setupMedia(type === 'Video');
        setCallState(prev => ({ ...prev, localStream: stream || null, isIncoming: false }));

        if (callStateRef.current.targetUserId) {
            await rtcService.current?.createPeerConnection(callStateRef.current.targetUserId, callId);
        }

        // We reply via REST API so DB tracks it's answered
        if (callId) {
            try {
                await api.put(`calls/${callId}/answer`);
            } catch (error) {
                console.error("Failed to answer call API:", error);
                // Fallback to Hub
                signalRService.invokeSignaling('AnswerCall', callStateRef.current.targetUserId, callId, true);
            }
        }
    };

    const declineCall = async (callId: string) => {
        // RINGTONE: Stop as soon as the user taps Decline
        try { InCallManager.stopRingtone(); } catch (e) { console.log('InCallManager stopRingtone ignored'); }

        const targetUserId = callStateRef.current.targetUserId;

        try {
            await api.put(`calls/${callId}/reject`);
        } catch (error) {
            console.error("Failed to reject call via REST:", error);
        }

        // FIX: Always notify the caller via SignalR regardless of whether REST
        // succeeded. This guarantees the caller's screen ends immediately even
        // if the backend doesn't fire CallRejected/CallAnswered on its own.
        if (targetUserId) {
            signalRService.invokeSignaling('AnswerCall', targetUserId, callId, false);
        }

        await handleEndCallInternal(callStateRef.current, true);
    };

    const navigateToCallScreen = (role: CallRole, type: CallType, peerName: string, id?: string, peerProfilePicture?: string, isIncoming: boolean = false) => {
        const root = role === 'Doctor' ? '/Doctor_subpage' : '/Patient_subpage';
        const page = type === 'Audio' ? '/audio_call' : '/video_call';
        const path = `${root}${page}` as any;

        const params: any = {};
        if (role === 'Doctor') {
            params.patientName = peerName;
        } else {
            params.doctorName = peerName;
        }
        if (id) params.consultationId = id;
        if (peerProfilePicture) params.peerProfilePicture = peerProfilePicture;
        if (isIncoming) params.isIncoming = 'true';

        router.push({ pathname: path, params });
    };

    const returnToCall = () => {
        if (!callState.isActive || !callState.role || !callState.type) return;
        navigateToCallScreen(callState.role, callState.type, callState.peerName, callState.consultationId, callState.peerProfilePicture);
    };

    const endCall = async () => {
        await handleEndCallInternal(callStateRef.current, false);
    };

    const minimizeCall = () => {
        if (router.canGoBack()) {
            router.back();
        }
    };

    const toggleMute = () => {
        setCallState(p => {
            rtcService.current?.toggleMute(!p.isMuted);
            return { ...p, isMuted: !p.isMuted };
        });
    };

    const setAudioRoute = (route: AudioRoute) => {
        try {
            InCallManager.chooseAudioRoute(route);
            setCallState(p => ({
                ...p,
                audioRoute: route,
                isSpeakerOn: route === 'SPEAKER_PHONE',
            }));
        } catch (e) {
            console.log('chooseAudioRoute failed:', e);
        }
    };

    const toggleVideo = () => {
        setCallState(p => {
            rtcService.current?.toggleVideo(!p.isVideoOff);
            return { ...p, isVideoOff: !p.isVideoOff };
        });
    };

    const toggleCameraFacing = () => {
        rtcService.current?.switchCamera();
    };

    const updateDocFields = (fields: Partial<Pick<CallState, 'notes' | 'diagnosis' | 'prescription'>>) => {
        setCallState(p => ({ ...p, ...fields }));
    };

    return (
        <CallContext.Provider value={{
            callState,
            startCall,
            acceptCall,
            declineCall,
            endCall,
            minimizeCall,
            returnToCall,
            toggleMute,
            setAudioRoute,
            toggleVideo,
            toggleCameraFacing,
            updateDocFields
        }}>
            {children}
        </CallContext.Provider>
    );
};

export const useCall = () => {
    const context = useContext(CallContext);
    if (!context) throw new Error('useCall must be used within a CallProvider');
    return context;
};