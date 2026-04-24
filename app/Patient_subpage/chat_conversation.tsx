import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import * as Notifications from 'expo-notifications';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    Image,
    Linking,
    Modal,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    LogBox,
    DeviceEventEmitter
} from 'react-native';

// Ignore conflicting prop type warnings from GiftedChat internal components
LogBox.ignoreLogs([
    'Invalid prop `extraData` of type `object` supplied to `MessageContainer`, expected `array`',
    'Invalid prop `extraData` of type `array` supplied to `GiftedChat`, expected `object`',
    'Failed prop type: Invalid prop `extraData`'
]);
import {
    Actions,
    Bubble,
    Composer,
    GiftedChat,
    IMessage,
    InputToolbar,
    Send
} from 'react-native-gifted-chat';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../src/services/api';
import { mediaCacheService } from '../../src/services/mediaCacheService';
import { signalRService } from '../../src/services/signalrService';
import { uploadFile } from '../../src/services/uploadService';
import { useCall } from '../_context/CallContext';
import { useDoctorDirectory } from '../_context/DoctorDirectoryContext';
import { useUser } from '../_context/UserContext';

// Handle notifications when app is foregrounded
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

// Map string days to numbers for Expo weekly trigger (1 = Sunday, 7 = Saturday)
const DAY_TO_NUMBER: Record<string, number> = {
    Sunday: 1, Monday: 2, Tuesday: 3, Wednesday: 4, Thursday: 5, Friday: 6, Saturday: 7,
};

// Helper to parse "08:30 AM" back to Date
function parseTimeStringToDate(timeStr: string) {
    const defaultDate = new Date();
    const match = timeStr.trim().match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!match) return defaultDate;
    let hour = parseInt(match[1], 10);
    const minute = parseInt(match[2], 10);
    const period = match[3].toUpperCase();

    if (period === 'PM' && hour < 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;

    defaultDate.setHours(hour, minute, 0, 0);
    return defaultDate;
}

// ─── Standalone audio player bubble ─────────────────────────────────────────
type AudioPlayerBubbleProps = {
    messageId: string;
    audioUrl: string;
    isRight: boolean;
    initialIsPlaying: boolean;
    initialPosition: number;
    initialDuration: number;
    primaryColor: string;
    textColor: string;
    mutedColor: string;
    onPlayPause: (url: string, id: string) => void;
    onSeek: (id: string, ratio: number, currentDuration: number) => void;
};

const AudioPlayerBubble: React.FC<AudioPlayerBubbleProps> = ({
    messageId, audioUrl, isRight, initialIsPlaying,
    initialPosition, initialDuration, primaryColor, textColor, mutedColor,
    onPlayPause, onSeek,
}) => {
    const barWidthRef = React.useRef(1);
    const [isPlaying, setIsPlaying] = useState(initialIsPlaying);
    const [position, setPosition] = useState(initialPosition);
    const [duration, setDuration] = useState(initialDuration);

    useEffect(() => {
        if (initialDuration > 0 && duration === 0) {
            setDuration(initialDuration);
        }
    }, [initialDuration]);

    useEffect(() => {
        const sub = DeviceEventEmitter.addListener('audioUpdate', (data) => {
            if (data.messageId === messageId) {
                setPosition(data.position);
                if (data.duration > 0) setDuration(data.duration);
                setIsPlaying(data.isPlaying && !data.didJustFinish);
                if (data.didJustFinish) {
                    setPosition(0);
                    setIsPlaying(false);
                }
            } else if (data.isPlaying) {
                setIsPlaying(false);
            }
        });
        return () => sub.remove();
    }, [messageId]);

    let progress = 0;
    if (duration > 0 && position >= 0) {
        progress = position / duration;
        if (progress > 1) progress = 1;
        if (progress < 0) progress = 0;
    }

    const fmt = (ms: number) => {
        const s = Math.floor(ms / 1000);
        return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    };

    return (
        <View style={{ padding: 10, minWidth: 220 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TouchableOpacity onPress={() => onPlayPause(audioUrl, messageId)}>
                    <Ionicons
                        name={isPlaying ? 'pause-circle' : 'play-circle'}
                        size={36}
                        color={isRight ? '#FFF' : primaryColor}
                    />
                </TouchableOpacity>
                <View style={{ flex: 1, minWidth: 140 }}>
                    <Text style={{ color: isRight ? '#FFF' : textColor, fontSize: 13, marginBottom: 4 }}>

                    </Text>
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onLayout={(e) => { barWidthRef.current = e.nativeEvent.layout.width || 1; }}
                        onPress={(e) => {
                            if (duration === 0) return;
                            const ratio = Math.min(1, Math.max(0, e.nativeEvent.locationX / barWidthRef.current));
                            onSeek(messageId, ratio, duration);
                            setPosition(ratio * duration);
                        }}
                        style={{ height: 24, justifyContent: 'center', marginVertical: 2 }}
                    >
                        <View pointerEvents="none" style={{ width: '100%', height: 4, backgroundColor: isRight ? 'rgba(255,255,255,0.3)' : '#CBD5E1', borderRadius: 2 }}>
                            <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${progress * 100}%`, backgroundColor: isRight ? '#FFF' : primaryColor, borderRadius: 2 }} />
                            <View style={{ position: 'absolute', left: `${progress * 100}%`, top: -4, width: 12, height: 12, borderRadius: 6, backgroundColor: isRight ? '#FFF' : primaryColor, marginLeft: -6 }} />
                        </View>
                    </TouchableOpacity>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                        <Text style={{ color: isRight ? 'rgba(255,255,255,0.7)' : mutedColor, fontSize: 10 }}>{fmt(position)}</Text>
                        <Text style={{ color: isRight ? 'rgba(255,255,255,0.7)' : mutedColor, fontSize: 10 }}>{fmt(duration)}</Text>
                    </View>
                </View>
            </View>
        </View>
    );
};

// Helper to map DB message to GiftedChat message
const mapMessageToGiftedChat = (msg: any, currentUserObj: any, doctorObj: any): IMessage => {
    const msgSenderId = (msg.senderId || msg.SenderId || '').toLowerCase();
    const currentUserId = (currentUserObj._id || '').toLowerCase();

    let content = msg.content || msg.Content;
    const mType = msg.messageType || msg.MessageType;

    let callData = null;
    if (mType === 'call') {
        try {
            callData = JSON.parse(content);
        } catch (e) {
            // Fallback or non-JSON content
        }
    }

    return {
        _id: msg.id || msg.Id,
        text: (mType === 'call' || mType === 'audio' || mType === 'file' || mType === 'image') ? '' : content,
        createdAt: new Date(msg.timestamp || msg.Timestamp),
        user: msgSenderId === currentUserId && currentUserId !== '' ? currentUserObj : doctorObj,
        image: mType === 'image' ? (msg.attachmentUrl || msg.AttachmentUrl) : undefined,
        customType: mType,
        customUrl: msg.attachmentUrl || msg.AttachmentUrl,
        callData: callData
    } as any;
};

export default function PatientChatConversation() {
    const { id, doctorId, name, initials, isOnline: initialOnline } = useLocalSearchParams<{ id?: string, doctorId?: string, name?: string, initials?: string, isOnline?: string }>();
    const router = useRouter();

    // Ref to correlate uploaded URLs with local temp IDs for reliable deduplication
    const uploadCorrelation = useRef<Record<string, string>>({});

    const { startCall } = useCall();
    const [messages, setMessages] = useState<IMessage[]>([]);

    // Media State
    const [isRecording, setIsRecording] = useState(false);
    const [recording, setRecording] = useState<Audio.Recording | null>(null);

    const activeDoctorId = (id || doctorId || 'default').toLowerCase();
    const doctorName = (name as string) || 'Doctor';

    const {
        patientId,
        patientName: currentUserName,
        prescriptions,
        setPrescriptions,
        refreshUnreadCount,
        setActiveChatId
    } = useUser();
    const { getDoctorById } = useDoctorDirectory();

    // ── Active Chat Tracking for Notifications ──────────────────────────
    useEffect(() => {
        setActiveChatId(activeDoctorId);
        return () => setActiveChatId(null);
    }, [activeDoctorId, setActiveChatId]);

    // Real-time doctor availability and presence
    const doctor = getDoctorById(activeDoctorId);
    const [doctorAvailability, setDoctorAvailability] = useState(doctor?.availability || 'Offline');
    const [isOnline, setIsOnline] = useState(initialOnline === 'true');

    useEffect(() => {
        const unsubAvailability = signalRService.onAvailabilityChanged((data: any) => {
            const id = data.doctorId || data.DoctorId;
            if (id === activeDoctorId) {
                setDoctorAvailability(data.availability || data.Availability || 'Offline');
            }
        });

        const unsubPresence = signalRService.on('UserPresenceChanged', (data: { userId: string, isOnline: boolean }) => {
            if (data.userId.toLowerCase() === activeDoctorId.toLowerCase()) {
                setIsOnline(data.isOnline);
            }
        });

        return () => {
            unsubAvailability();
            unsubPresence();
        };
    }, [activeDoctorId]);

    // Memoize user objects to prevent stale closures in SignalR listeners
    const currentUserObj = useMemo(() => ({ _id: patientId, name: currentUserName }), [patientId, currentUserName]);
    const doctorObj = useMemo(() => ({ _id: activeDoctorId, name: doctorName }), [activeDoctorId, doctorName]);

    // Cleanup audio resources on unmount
    useEffect(() => {
        return () => {
            if (playingSoundRef.current) {
                playingSoundRef.current.unloadAsync().catch(() => {});
            }
            if (recording) {
                recording.stopAndUnloadAsync().catch(() => {});
            }
        };
    }, [recording]);

    useEffect(() => {
        let isMounted = true;

        const loadMessages = async () => {
            try {
                const response = await api.get(`/chat/${activeDoctorId}`);
                if (isMounted && response.data) {
                    const historyData = response.data || {};
                    const msgs = historyData.messages || historyData.Messages || [];
                    const onlineStatus = historyData.isOnline ?? historyData.IsOnline ?? false;

                    // DB returns oldest first, GiftedChat wants newest first, so we reverse
                    const formatted = msgs.map((m: any) => mapMessageToGiftedChat(m, currentUserObj, doctorObj)).reverse();
                    setMessages(formatted);
                    setIsOnline(onlineStatus);

                    // Refresh global unread count since GET /api/chat/id marks messages as read
                    refreshUnreadCount();
                }
            } catch (err) {
                console.log('Error fetching chat history', err);
            }
        };

        loadMessages();

        const handleNewMessage = (newMsg: any) => {
            const incomingSenderId = newMsg.senderId || newMsg.SenderId || '';
            const incomingReceiverId = newMsg.receiverId || newMsg.ReceiverId || '';

            // Only add if it belongs specifically to this conversation pair
            const isFromActiveDoctor = incomingSenderId.toLowerCase() === activeDoctorId.toLowerCase() && incomingReceiverId.toLowerCase() === patientId?.toLowerCase();
            const isFromMeToActiveDoctor = incomingSenderId.toLowerCase() === patientId?.toLowerCase() && incomingReceiverId.toLowerCase() === activeDoctorId.toLowerCase();

            if (isFromActiveDoctor || isFromMeToActiveDoctor) {
                // If message is from doctor, mark it as read immediately since we have the chat open
                if (isFromActiveDoctor) {
                    api.put(`chat/${activeDoctorId}/read`)
                        .then(() => refreshUnreadCount())
                        .catch(err => console.log('Error marking message as read', err));
                }

                if (isMounted) {
                    setMessages((prevs) => {
                        if (prevs.some(m => (m._id === newMsg.id || m._id === newMsg.Id))) return prevs;

                        // If we are the sender, check if we have a temporary optimistic message
                        if (incomingSenderId.toLowerCase() === patientId?.toLowerCase()) {
                            const incomingContent = newMsg.content || newMsg.Content;
                            const incomingUrl = newMsg.attachmentUrl || newMsg.AttachmentUrl;

                            // 1. Check correlation map first (most reliable)
                            let tempIdMatch = incomingUrl ? uploadCorrelation.current[incomingUrl] : null;

                            // 2. Fallback to existing logic if no correlation found
                            const tempMsgIndex = prevs.findIndex(m => {
                                if (!m._id.toString().startsWith('temp-')) return false;

                                if (tempIdMatch) return m._id === tempIdMatch;

                                return (
                                    (incomingUrl && (m as any).customUrl === incomingUrl) ||
                                    (incomingContent && m.text === incomingContent)
                                );
                            });

                            if (tempMsgIndex !== -1) {
                                // Clean up correlation entry if it was used
                                if (incomingUrl && uploadCorrelation.current[incomingUrl]) {
                                    delete uploadCorrelation.current[incomingUrl];
                                }
                                const updated = [...prevs];
                                updated[tempMsgIndex] = mapMessageToGiftedChat(newMsg, currentUserObj, doctorObj);
                                return updated;
                            }
                        }

                        return GiftedChat.append(prevs, [mapMessageToGiftedChat(newMsg, currentUserObj, doctorObj)]);
                    });
                }

                // Background-cache any attachment for instant playback later
                const attachUrl = newMsg.attachmentUrl || newMsg.AttachmentUrl;
                if (attachUrl) {
                    mediaCacheService.cacheMedia(attachUrl).catch(() => { });
                }
            }
        };

        // Subscribe to incoming SignalR messages
        const un1 = signalRService.onMessageReceived(handleNewMessage);
        const un2 = signalRService.on('MessageSentConfirmation', handleNewMessage);

        // Set up notification listener for Snooze
        const responseListener = Notifications.addNotificationResponseReceivedListener(async response => {
            if (response.actionIdentifier === 'snooze') {
                const data = response.notification.request.content.data;
                const drugName = data?.drugOrActivity || 'your medication';

                // Schedule for 5 minutes from now
                const snoozeTime = new Date();
                snoozeTime.setMinutes(snoozeTime.getMinutes() + 5);

                await Notifications.scheduleNotificationAsync({
                    content: {
                        title: "Snoozed Medication Reminder 💊",
                        body: `It is time to take your ${drugName}`,
                        sound: true,
                        categoryIdentifier: 'prescription_alarm',
                        data: data,
                        vibrate: [0, 1000, 500, 1000, 500, 1000, 500, 1000, 500, 1000],
                    },
                    trigger: {
                        date: snoozeTime,
                        channelId: 'alarms',
                    },
                });
                console.log(`Snoozed alarm for ${drugName} by 5 minutes.`);
            }
        });

        return () => {
            isMounted = false;
            un1();
            un2();
            Notifications.removeNotificationSubscription(responseListener);
        };
    }, [activeDoctorId, patientId, currentUserObj, doctorObj]);

    const handleSendMessage = useCallback(async (newMsgs: IMessage[] = [], msgType = 'text', attachUrl: string | null = null, extraText = '') => {
        if (!activeDoctorId) return;

        let optimisticMsg: IMessage | null = null;
        let sentMessageText = '';

        if (newMsgs.length > 0) {
            optimisticMsg = { ...newMsgs[0], _id: `temp-${newMsgs[0]._id}` };
            sentMessageText = newMsgs[0].text;
        } else {
            sentMessageText = extraText;
            optimisticMsg = {
                _id: `temp-${Math.random().toString(36).substring(7)}`,
                text: extraText,
                createdAt: new Date(),
                user: currentUserObj,
                image: msgType === 'image' ? (attachUrl || undefined) : undefined,
                audio: msgType === 'audio' ? (attachUrl || undefined) : undefined,
                customType: msgType,
                customUrl: attachUrl
            } as any;
        }

        // Optimistically update UI immediately
        if (optimisticMsg) {
            setMessages(prev => GiftedChat.append(prev, [optimisticMsg as IMessage]));
        }

        try {
            await signalRService.invoke('SendMessage', activeDoctorId, sentMessageText, msgType, attachUrl, null);
        } catch (error) {
            console.error('Send error:', error);
            // Revert message if it fails
            setMessages(prev => prev.filter(m => m._id !== optimisticMsg?._id));
            Alert.alert('Error', 'Failed to send message.');
        }
    }, [activeDoctorId, currentUserObj]);

    // --- Navigation Handlers (with TS fix) ---
    const handleAudioCallPress = () => {
        const doctorName = (name as string) || 'Doctor';
        startCall({ targetUserId: activeDoctorId, type: 'Audio', role: 'Patient', peerName: doctorName, peerProfilePicture: doctor?.profilePictureUrl });
    };

    const handleVideoCallPress = () => {
        const doctorName = (name as string) || 'Doctor';
        startCall({ targetUserId: activeDoctorId, type: 'Video', role: 'Patient', peerName: doctorName, peerProfilePicture: doctor?.profilePictureUrl });
    };



    const sendWithAttachment = async (localUri: string, mimeType: string, msgType: string, text: string) => {
        const optimisticMsg = {
            _id: `temp-${Math.random().toString(36).substring(7)}`,
            text: text,
            createdAt: new Date(),
            user: currentUserObj,
            image: msgType === 'image' ? localUri : undefined,
            customType: msgType,
            customUrl: localUri
        } as any;

        setMessages(prev => GiftedChat.append(prev, [optimisticMsg]));

        try {
            const uploadedUrl = await uploadFile(localUri, mimeType);
            if (uploadedUrl) {
                // Store correlation before sending so the listener can find it
                uploadCorrelation.current[uploadedUrl] = optimisticMsg._id;
                // Cache the uploaded file locally for instant playback
                mediaCacheService.cacheMedia(uploadedUrl).catch(() => { });
                await signalRService.invoke('SendMessage', activeDoctorId, text, msgType, uploadedUrl, null);
            } else {
                setMessages(prev => prev.filter(m => m._id !== optimisticMsg._id));
                Alert.alert('Error', 'Failed to upload file.');
            }
        } catch (error) {
            console.error('Send error:', error);
            setMessages(prev => prev.filter(m => m._id !== optimisticMsg._id));
            Alert.alert('Error', 'Failed to send message.');
        }
    };

    const handleSendImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 0.6,
            });
            if (!result.canceled && result.assets && result.assets.length > 0) {
                const asset = result.assets[0];
                sendWithAttachment(asset.uri, asset.mimeType || 'image/jpeg', 'image', '');
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to upload image.');
        }
    };

    const handleSendFile = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: '*/*',
                copyToCacheDirectory: true,
            });
            if (!result.canceled && result.assets && result.assets.length > 0) {
                const asset = result.assets[0];
                sendWithAttachment(asset.uri, asset.mimeType || 'application/pdf', 'file', asset.name || 'File');
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to upload document.');
        }
    };

    const toggleRecording = async () => {
        try {
            if (isRecording) {
                // Stop
                setIsRecording(false);
                if (recording) {
                    await recording.stopAndUnloadAsync();
                    await Audio.setAudioModeAsync({
                        allowsRecordingIOS: false,
                        playsInSilentModeIOS: true,
                        playThroughEarpieceAndroid: false,
                    });
                    const uri = recording.getURI();
                    setRecording(null);
                    if (uri) {
                        sendWithAttachment(uri, 'audio/m4a', 'audio', '');
                    }
                }
            } else {
                // Start
                await Audio.requestPermissionsAsync();
                await Audio.setAudioModeAsync({
                    allowsRecordingIOS: true,
                    playsInSilentModeIOS: true,
                });
                const { recording: newRecording } = await Audio.Recording.createAsync(
                    Audio.RecordingOptionsPresets.HIGH_QUALITY
                );
                setRecording(newRecording);
                setIsRecording(true);
            }
        } catch (err) {
            console.error('Failed to start/stop recording', err);
            Alert.alert('Error', 'Failed to use microphone.');
            setIsRecording(false);
        }
    };

    const [attachMenuVisible, setAttachMenuVisible] = useState(false);

    const handleAttachmentPress = () => {
        setAttachMenuVisible(true);
    };

    // --- Custom Renderers ---
    const renderBubble = useCallback((props: any) => (
        <Bubble
            {...props}
            wrapperStyle={{
                right: { backgroundColor: '#3B82F6', borderRadius: 15 },
                left: {
                    backgroundColor: '#1E293B',
                    borderRadius: 15,
                    borderWidth: 0
                },
            }}
            textStyle={{
                right: { color: '#FFFFFF' },
                left: { color: '#FFFFFF' },
            }}
        />
    ), []);

    const [acceptedPrescriptionIds, setAcceptedPrescriptionIds] = useState<Set<string>>(new Set());

    const handleAcceptPrescription = async (jsonString: string) => {
        try {
            if (!jsonString) return;
            const newPrescription = JSON.parse(jsonString);

            const exists = prescriptions.some(p => p.id === newPrescription.id);
            if (exists || acceptedPrescriptionIds.has(newPrescription.id)) {
                Alert.alert("Already Added", "This prescription has already been added.");
                return;
            }

            // Configure Alarm Category
            await Notifications.setNotificationCategoryAsync('prescription_alarm', [
                {
                    identifier: 'snooze',
                    buttonTitle: 'Snooze (5m)',
                    options: { opensAppToForeground: false, isDestructive: false, isAuthenticationRequired: false },
                },
                {
                    identifier: 'dismiss',
                    buttonTitle: 'Dismiss',
                    options: { opensAppToForeground: false, isDestructive: true, isAuthenticationRequired: false },
                },
            ]);

            // Schedule alarms locally for the patient
            const alarmDate = parseTimeStringToDate(newPrescription.alarmTime);
            const hour = alarmDate.getHours();
            const minute = alarmDate.getMinutes();

            try {
                for (const day of newPrescription.specificDays) {
                    const weekday = DAY_TO_NUMBER[day];
                    await Notifications.scheduleNotificationAsync({
                        content: {
                            title: "Medication Reminder 💊",
                            body: `It is time to take your ${newPrescription.drugOrActivity}`,
                            sound: true,
                            categoryIdentifier: 'prescription_alarm',
                            data: { prescriptionId: newPrescription.id, drugOrActivity: newPrescription.drugOrActivity },
                            vibrate: [0, 1000, 500, 1000, 500, 1000, 500, 1000, 500, 1000],
                        },
                        trigger: {
                            weekday,
                            hour,
                            minute,
                            repeats: true,
                            channelId: 'alarms',
                        },
                    });
                }
            } catch (e) {
                console.error("Failed to schedule prescription", e);
                Alert.alert("Scheduling Error", "We could not schedule your alarms. Please enable notifications.");
            }

            setPrescriptions(prev => [newPrescription, ...prev]);
            // Save to backend so it persists across logins
            try {
                const response = await api.post('/prescriptions', {
                    drugOrActivity: newPrescription.drugOrActivity,
                    medicationName: newPrescription.drugOrActivity,
                    alarmTime: newPrescription.alarmTime,
                    intervalType: newPrescription.intervalType || 'specific',
                    specificDays: newPrescription.specificDays || [],
                    doctorName: newPrescription.doctorName || '',
                    doctorId: newPrescription.doctorId || '',
                    condition: newPrescription.condition || '',
                });
                // Update local ID with backend ID
                if (response.data?.id) {
                    setPrescriptions(prev => prev.map(p => p.id === newPrescription.id ? { ...p, id: response.data.id } : p));
                }
            } catch (err) {
                console.error('Failed to save accepted prescription to API:', err);
            }

            setAcceptedPrescriptionIds(prev => new Set(prev).add(newPrescription.id));
            Alert.alert("Success", "Prescription saved and Alarms set successfully!");
        } catch (e) {
            Alert.alert("Error", "Could not read prescription data.");
        }
    };

    // --- Image modal state ---
    const [imageModalUrl, setImageModalUrl] = useState<string | null>(null);

    // --- Audio player state ---
    const [currentAudioId, setCurrentAudioId] = useState<string | null>(null);
    const currentAudioIdRef = useRef<string | null>(null);
    const [isAudioPlaying, setIsAudioPlaying] = useState<boolean>(false);
    const playingSoundRef = useRef<Audio.Sound | null>(null);
    const [audioDurations, setAudioDurations] = useState<Record<string, number>>({});
    const [audioPosition, setAudioPosition] = useState(0);
    const audioDebounceRef = useRef(false);

    const handleAudioPlayPause = async (audioUrl: string, messageId: string) => {
        if (audioDebounceRef.current) return;
        audioDebounceRef.current = true;
        try {
            if (currentAudioId === messageId && playingSoundRef.current) {
                const status = await playingSoundRef.current.getStatusAsync();
                if (status.isLoaded && status.isPlaying) {
                    await playingSoundRef.current.pauseAsync();
                    setIsAudioPlaying(false);
                    DeviceEventEmitter.emit('audioUpdate', {
                        messageId: messageId,
                        position: status.positionMillis || 0,
                        duration: status.durationMillis || 0,
                        isPlaying: false,
                        didJustFinish: false
                    });
                } else if (status.isLoaded && !status.isPlaying) {
                    let startPos = status.positionMillis || 0;
                    if (status.positionMillis >= (status.durationMillis || 0) - 50) {
                        await playingSoundRef.current.setPositionAsync(0);
                        startPos = 0;
                    }
                    await playingSoundRef.current.playAsync();
                    setIsAudioPlaying(true);
                    DeviceEventEmitter.emit('audioUpdate', {
                        messageId: messageId,
                        position: startPos,
                        duration: status.durationMillis || 0,
                        isPlaying: true,
                        didJustFinish: false
                    });
                }
                audioDebounceRef.current = false;
                return;
            }

            // If we are switching to a different audio file
            if (playingSoundRef.current) {
                try {
                    await playingSoundRef.current.setOnPlaybackStatusUpdate(null);
                    await playingSoundRef.current.pauseAsync();
                    await playingSoundRef.current.unloadAsync();
                } catch(e) {}
                playingSoundRef.current = null;
            }

            if (currentAudioId) {
                DeviceEventEmitter.emit('audioUpdate', {
                    messageId: currentAudioId,
                    position: audioPosition,
                    duration: audioDurations[currentAudioId] || 0,
                    isPlaying: false,
                    didJustFinish: false
                });
            }

            setCurrentAudioId(messageId);
            currentAudioIdRef.current = messageId;
            setIsAudioPlaying(true);
            setAudioPosition(0);

            DeviceEventEmitter.emit('audioUpdate', {
                messageId: messageId,
                position: 0,
                duration: audioDurations[messageId] || 0,
                isPlaying: true,
                didJustFinish: false
            });

            // Resolve from local cache for instant playback, skip cache for local optimistic URIs
            const resolvedUri = audioUrl.startsWith('file://') ? audioUrl : await mediaCacheService.getOrDownload(audioUrl);

            const { sound, status } = await Audio.Sound.createAsync(
                { uri: resolvedUri },
                { shouldPlay: true, progressUpdateIntervalMillis: 100 },
                (playbackStatus: any) => {
                    if (playbackStatus.isLoaded) {
                        DeviceEventEmitter.emit('audioUpdate', {
                            messageId: messageId,
                            position: playbackStatus.positionMillis || 0,
                            duration: playbackStatus.durationMillis || 0,
                            isPlaying: playbackStatus.isPlaying,
                            didJustFinish: playbackStatus.didJustFinish
                        });

                        if (playbackStatus.didJustFinish) {
                            setIsAudioPlaying(false);
                            setAudioPosition(0);
                        }
                    }
                }
            );
            playingSoundRef.current = sound;

            if (status.isLoaded && typeof status.durationMillis === 'number') {
                setAudioDurations(prev => ({ ...prev, [messageId]: status.durationMillis as number }));
            }
        } catch (e) {
            Alert.alert('Error', 'Could not play audio.');
        } finally {
            audioDebounceRef.current = false;
        }
    };

    const renderMessageImage = (props: any) => {
        const { currentMessage } = props;
        if (!currentMessage.image) return null;
        return (
            <TouchableOpacity
                onPress={() => setImageModalUrl(currentMessage.image)}
                style={{ borderRadius: 13, overflow: 'hidden', margin: 3 }}
            >
                <Image
                    source={{ uri: currentMessage.image }}
                    style={{ width: 200, height: 200, borderRadius: 13 }}
                    resizeMode="cover"
                />
            </TouchableOpacity>
        );
    };

    const renderCustomView = useCallback((props: any) => {
        const { currentMessage } = props;
        if (currentMessage.customType === 'audio' && currentMessage.customUrl) {
            const isRight = currentMessage.user._id === currentUserObj._id;
            const isThisAudio = currentAudioId === currentMessage._id;
            
            // Extract injected tracking state if available, fallback to closure state
            const isPlaying = currentMessage.isThisAudioPlaying || (isThisAudio && isAudioPlaying);
            const thisDuration = currentMessage.thisAudioDuration || audioDurations[currentMessage._id as string] || 0;
            const pos = currentMessage.thisAudioPosition || (isThisAudio ? audioPosition : 0);

            return (
                <AudioPlayerBubble
                    key={currentMessage._id as string}
                    messageId={currentMessage._id as string}
                    audioUrl={currentMessage.customUrl}
                    isRight={isRight}
                    initialIsPlaying={isPlaying}
                    initialPosition={pos}
                    initialDuration={thisDuration}
                    primaryColor="#3B82F6"
                    textColor="#1E293B"
                    mutedColor="#94A3B8"
                    onPlayPause={handleAudioPlayPause}
                    onSeek={async (id, ratio, currentDuration) => {
                        if (currentAudioIdRef.current !== id || currentDuration === 0) return;
                        const newPos = ratio * currentDuration;
                        if (playingSoundRef.current) {
                            const st = await playingSoundRef.current.getStatusAsync();
                            if (st.isLoaded) {
                                await playingSoundRef.current.setPositionAsync(newPos);
                                setAudioPosition(newPos);
                            }
                        }
                    }}
                />
            );
        } else if (currentMessage.customType === 'file' && currentMessage.customUrl) {
            const isRight = currentMessage.user._id === currentUserObj._id;
            return (
                <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', padding: 10, gap: 8 }}
                    onPress={() => Linking.openURL(currentMessage.customUrl).catch(() => Alert.alert('Error', 'Could not open file.'))}
                >
                    <Ionicons name="document-text" size={28} color={isRight ? '#EFF6FF' : '#3B82F6'} />
                    <Text style={{ color: isRight ? '#EFF6FF' : '#1E293B', fontSize: 13, textDecorationLine: 'underline' }}>Open Document</Text>
                </TouchableOpacity>
            );
        } else if (currentMessage.customType === 'prescription') {
            let prescriptionId = '';
            try { prescriptionId = JSON.parse(currentMessage.customUrl)?.id || ''; } catch (e) { }
            const isAccepted = acceptedPrescriptionIds.has(prescriptionId) || prescriptions.some((p: any) => p.id === prescriptionId);
            return (
                <View style={{ padding: 12, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                        <Ionicons name="medkit" size={24} color={currentMessage.user._id === currentUserObj._id ? "#FFF" : "#EF4444"} />
                        <Text style={{ marginLeft: 6, fontWeight: 'bold', color: currentMessage.user._id === currentUserObj._id ? '#FFF' : '#0F172A' }}>
                            New Prescription
                        </Text>
                    </View>
                    <TouchableOpacity
                        style={{ backgroundColor: isAccepted ? '#94A3B8' : '#10B981', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, marginTop: 4, alignItems: 'center' }}
                        onPress={() => isAccepted ? Alert.alert('Already Added', 'This prescription has already been added.') : handleAcceptPrescription(currentMessage.customUrl)}
                    >
                        <Text style={{ color: '#FFF', fontWeight: 'bold' }}>{isAccepted ? 'Added' : 'Accept & Add'}</Text>
                    </TouchableOpacity>
                </View>
            );
        } else if (currentMessage.customType === 'call') {
            const isRight = currentMessage.user._id === currentUserObj._id;
            const callData = currentMessage.callData || { type: 'Audio', status: 'Ended', duration: 0 };

            const isVideo = callData.type === 'Video';
            const iconName = isVideo ? 'videocam' : 'call';
            const callTitle = callData.label || (isVideo ? 'Video call' : 'Voice call');

            const isMissed = callData.status === 'Missed' || callData.status === 'Declined' || callData.status === 'No answer';

            const iconColor = isMissed ? '#EF4444' : (isRight ? '#FFF' : '#22C55E');
            const textColor = '#FFF';
            const subTextColor = isRight ? 'rgba(255,255,255,0.7)' : '#CBD5E1';

            return (
                <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 }}>
                    <View style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: isRight ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)',
                        justifyContent: 'center',
                        alignItems: 'center'
                    }}>
                        <Ionicons name={iconName} size={22} color={iconColor} />
                    </View>
                    <View>
                        <Text style={{ color: textColor, fontSize: 15, fontWeight: '600' }}>{callTitle}</Text>
                        <Text style={{ color: subTextColor, fontSize: 13, marginTop: 2 }}>{callData.status}</Text>
                    </View>
                </View>
            );
        }
        return null;
    }, [currentAudioId, isAudioPlaying, audioDurations, audioPosition, currentUserObj, handleAudioPlayPause, acceptedPrescriptionIds, prescriptions, handleAcceptPrescription]);

    const renderInputToolbar = (props: any) => (
        <InputToolbar
            {...props}
            containerStyle={styles.inputToolbar}
            primaryStyle={{ alignItems: 'center' }}
        />
    );

    const renderComposer = (props: any) => (
        <Composer
            {...props}
            textInputStyle={styles.composer}
            placeholderTextColor="#94A3B8"
        />
    );

    const renderSend = (props: any) => (
        <View style={styles.sendAndVoiceContainer}>
            <TouchableOpacity
                style={[styles.voiceButton, isRecording && { backgroundColor: '#FEE2E2' }]}
                onPress={toggleRecording}
            >
                <Ionicons name={isRecording ? "stop-circle" : "mic"} size={24} color={isRecording ? "#EF4444" : "#94A3B8"} />
            </TouchableOpacity>
            <Send {...props} containerStyle={styles.sendContainer}>
                <View style={styles.sendCircle}>
                    <Ionicons name="send" size={20} color="#FFFFFF" />
                </View>
            </Send>
        </View>
    );

    const renderActions = (props: any) => (
        <Actions
            {...props}
            containerStyle={styles.actionContainer}
            icon={() => (
                <Ionicons name="add-circle" size={28} color="#94A3B8" />
            )}
            onPressActionButton={handleAttachmentPress}
        />
    );

    const chatMessages = useMemo(() => {
        return messages.map(m => {
            const msg = m as any;
            if (msg.customType === 'audio') {
                return {
                    ...msg,
                    isThisAudioPlaying: msg._id === currentAudioId && isAudioPlaying,
                    thisAudioPosition: msg._id === currentAudioId ? audioPosition : 0,
                    thisAudioDuration: audioDurations[msg._id as string] || 0
                };
            }
            return m; // preserve reference equality for non-audio messages
        });
    }, [messages, currentAudioId, isAudioPlaying, audioPosition, audioDurations]);

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <StatusBar barStyle="dark-content" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={{ padding: 8, marginLeft: -8, flexShrink: 0 }}
                    hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                >
                    <Ionicons name="arrow-back" size={24} color="#1E293B" />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.headerContent, { flexShrink: 1 }]}
                    activeOpacity={0.7}
                    onPress={() => router.push({ pathname: '/Patient_subpage/doctor_profile', params: { doctorId: activeDoctorId } } as any)}
                >
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{initials || 'DR'}</Text>
                        {isOnline && <View style={styles.onlineHeaderBadge} />}
                    </View>
                    <View style={{ flexShrink: 1 }}>
                        <Text style={styles.headerTitle} numberOfLines={1}>{name || 'Dr. Assigned'}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: doctorAvailability === 'Available' ? '#22C55E' : doctorAvailability === 'Busy' ? '#F59E0B' : '#94A3B8' }} />
                            <Text style={[styles.headerSubtitle, { color: doctorAvailability === 'Available' ? '#22C55E' : doctorAvailability === 'Busy' ? '#F59E0B' : '#94A3B8' }]} numberOfLines={1}>{isOnline ? 'Online' : doctorAvailability}</Text>
                        </View>
                    </View>
                </TouchableOpacity>

                <View style={styles.headerActions}>

                    <TouchableOpacity style={styles.iconButton} onPress={handleAudioCallPress}>
                        <Ionicons name="call" size={22} color="#3B82F6" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconButton} onPress={handleVideoCallPress}>
                        <Ionicons name="videocam" size={22} color="#3B82F6" />
                    </TouchableOpacity>
                </View>
            </View>

            <GiftedChat
                messages={chatMessages}
                onSend={(newMsgs) => handleSendMessage(newMsgs)}
                user={currentUserObj}
                renderBubble={renderBubble}
                renderMessageImage={renderMessageImage}
                renderCustomView={renderCustomView}
                renderInputToolbar={renderInputToolbar}
                renderComposer={renderComposer}
                renderSend={renderSend}
                renderAvatar={null as any}
                showUserAvatar={false}
                showAvatarForEveryMessage={false}
                alwaysShowSend
                scrollToBottom
                wrapInSafeArea={false}
                extraData={{ currentAudioId, isAudioPlaying, audioDurations, audioPosition }}
                messagesContainerStyle={{
                    backgroundColor: '#F8FAFC',
                    paddingBottom: Platform.OS === 'ios' ? 20 : 10
                }}
            />

            {/* Fullscreen Image Modal with Zoom + Download */}
            <Modal visible={!!imageModalUrl} transparent animationType="fade" onRequestClose={() => setImageModalUrl(null)}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)' }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 50, paddingHorizontal: 20, zIndex: 10 }}>
                        <TouchableOpacity
                            style={{ padding: 10 }}
                            onPress={async () => {
                                if (!imageModalUrl) return;
                                try {
                                    const { status } = await MediaLibrary.requestPermissionsAsync();
                                    if (status !== 'granted') { Alert.alert('Permission required', 'Storage permission is needed to save images.'); return; }
                                    const fileUri = FileSystem.cacheDirectory + 'download_' + Date.now() + '.jpg';
                                    await FileSystem.downloadAsync(imageModalUrl, fileUri);
                                    await MediaLibrary.saveToLibraryAsync(fileUri);
                                    Alert.alert('Saved', 'Image saved to your gallery.');
                                } catch (e) { Alert.alert('Error', 'Could not save image.'); }
                            }}
                        >
                            <Ionicons name="download-outline" size={28} color="#FFF" />
                        </TouchableOpacity>
                        <TouchableOpacity style={{ padding: 10 }} onPress={() => setImageModalUrl(null)}>
                            <Ionicons name="close" size={28} color="#FFF" />
                        </TouchableOpacity>
                    </View>
                    <ScrollView
                        contentContainerStyle={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
                        maximumZoomScale={5}
                        minimumZoomScale={1}
                        bouncesZoom
                    >
                        {imageModalUrl && (
                            <Image
                                source={{ uri: imageModalUrl }}
                                style={{ width: '100%', height: '80%' }}
                                resizeMode="contain"
                            />
                        )}
                    </ScrollView>
                </View>
            </Modal>

            {/* Share Files Menu Modal */}
            <Modal visible={attachMenuVisible} transparent animationType="slide" onRequestClose={() => setAttachMenuVisible(false)}>
                <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setAttachMenuVisible(false)}>
                    <View style={{ flex: 1, justifyContent: 'flex-end' }}>
                        <View style={{ backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 16, paddingBottom: Platform.OS === 'ios' ? 40 : 24, paddingHorizontal: 20, shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 20 }}>
                            <View style={{ alignSelf: 'center', width: 40, height: 4, backgroundColor: '#CBD5E1', borderRadius: 2, marginBottom: 16 }} />
                            <Text style={{ fontSize: 17, fontWeight: '700', color: '#0F172A', marginBottom: 16 }}>Share Files</Text>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 }}>
                                <TouchableOpacity
                                    style={{ alignItems: 'center', gap: 8 }}
                                    onPress={() => { setAttachMenuVisible(false); handleSendFile(); }}
                                >
                                    <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFF7ED', justifyContent: 'center', alignItems: 'center' }}>
                                        <Ionicons name="document-attach-outline" size={26} color="#F97316" />
                                    </View>
                                    <Text style={{ fontSize: 12, color: '#334155', fontWeight: '500' }}>Document</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={{ alignItems: 'center', gap: 8 }}
                                    onPress={() => { setAttachMenuVisible(false); handleSendImage(); }}
                                >
                                    <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#ECFDF5', justifyContent: 'center', alignItems: 'center' }}>
                                        <Ionicons name="image-outline" size={26} color="#10B981" />
                                    </View>
                                    <Text style={{ fontSize: 12, color: '#334155', fontWeight: '500' }}>Image</Text>
                                </TouchableOpacity>
                            </View>
                            <TouchableOpacity
                                style={{ backgroundColor: '#F1F5F9', borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
                                onPress={() => setAttachMenuVisible(false)}
                            >
                                <Text style={{ fontSize: 15, fontWeight: '600', color: '#64748B' }}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
        gap: 12
    },
    headerContent: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
    avatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#EFF6FF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: { color: '#3B82F6', fontWeight: 'bold' },
    headerTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
    headerSubtitle: { fontSize: 11, color: '#22C55E' },
    onlineHeaderBadge: {
        position: 'absolute',
        right: -2,
        bottom: -2,
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#22C55E',
        borderWidth: 2,
        borderColor: '#FFF',
    },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    iconButton: { padding: 4 },
    inputToolbar: {
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#E2E8F0',
        paddingTop: 4,
    },
    composer: {
        color: '#0F172A',
        backgroundColor: '#F1F5F9',
        borderRadius: 20,
        paddingHorizontal: 12,
        marginTop: 6,
        marginBottom: 6,
    },
    sendContainer: { justifyContent: 'center', alignItems: 'center', height: 44, width: 44 },
    sendCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#3B82F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendAndVoiceContainer: { flexDirection: 'row', alignItems: 'center', marginRight: 8, gap: 8 },
    voiceButton: { justifyContent: 'center', alignItems: 'center', width: 44, height: 44 },
    actionContainer: { justifyContent: 'center', alignItems: 'center', height: 44, marginLeft: 8 }
});
