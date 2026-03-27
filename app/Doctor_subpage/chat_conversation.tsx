import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
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
    View
} from 'react-native';
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
import { signalRService } from '../../src/services/signalrService';
import { uploadFile } from '../../src/services/uploadService';
import { useCall } from '../_context/CallContext';
import { useTheme } from '../_context/ThemeContext';
import { useUser } from '../_context/UserContext';

// Helper to map DB message to GiftedChat message
const mapMessageToGiftedChat = (msg: any, currentUserObj: any, patientObj: any): IMessage => {
    const msgSenderId = (msg.senderId || msg.SenderId || '').toLowerCase();
    const currentUserId = (currentUserObj._id || '').toLowerCase();
    const mType = msg.messageType || msg.MessageType;
    const content = msg.content || msg.Content;

    let callData = null;
    if (mType === 'call') {
        try {
            callData = JSON.parse(content);
        } catch (e) {
            console.log('Error parsing call JSON', e);
        }
    }

    return {
        _id: msg.id || msg.Id,
        text: (mType === 'call' || mType === 'audio' || mType === 'file' || mType === 'image') ? '' : content,
        createdAt: new Date(msg.timestamp || msg.Timestamp),
        user: msgSenderId === currentUserId && currentUserId !== '' ? currentUserObj : patientObj,
        image: mType === 'image' ? (msg.attachmentUrl || msg.AttachmentUrl) : undefined,
        customType: mType,
        customUrl: msg.attachmentUrl || msg.AttachmentUrl,
        callData: callData
    } as any;
};

export default function ChatConversation() {
    const { id, name, initials, isOnline: initialOnline, profilePictureUrl } = useLocalSearchParams();
    const router = useRouter();
    const { startCall } = useCall();

    const activePatientId = (id as string) || 'default';
    const patientName = (name as string) || 'Patient';

    const { patientId: doctorId, firstName, lastName, refreshUnreadCount, setActiveChatId } = useUser();
    const { colors: themeColors, isDark } = useTheme();
    const currentUserName = `${firstName} ${lastName}`;

    const [messages, setMessages] = useState<IMessage[]>([]);
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [isOnline, setIsOnline] = useState(initialOnline === 'true');

    // ── Active Chat Tracking for Notifications ──────────────────────────
    useEffect(() => {
        setActiveChatId(activePatientId);
        return () => setActiveChatId(null);
    }, [activePatientId]);

    // Ref to correlate uploaded URLs with local temp IDs for reliable deduplication
    const uploadCorrelation = useRef<Record<string, string>>({});

    // Memoize user objects to prevent stale closures in SignalR listeners
    const currentUserObj = useMemo(() => ({ _id: doctorId, name: currentUserName }), [doctorId, currentUserName]);
    const patientObj = useMemo(() => ({ _id: activePatientId, name: patientName }), [activePatientId, patientName]);

    useEffect(() => {
        const unsubPresence = signalRService.on('UserPresenceChanged', (data: { userId: string, isOnline: boolean }) => {
            if (data.userId.toLowerCase() === activePatientId.toLowerCase()) {
                setIsOnline(data.isOnline);
            }
        });
        return () => unsubPresence();
    }, [activePatientId]);

    useEffect(() => {
        let isMounted = true;

        const loadMessages = async () => {
            try {
                const response = await api.get(`/chat/${activePatientId}`);
                if (isMounted && response.data) {
                    const historyData = response.data || {};
                    const msgs = historyData.messages || historyData.Messages || [];
                    const onlineStatus = historyData.isOnline ?? historyData.IsOnline ?? false;

                    // DB returns oldest first, GiftedChat wants newest first, so we reverse
                    const formatted = msgs.map((m: any) => mapMessageToGiftedChat(m, currentUserObj, patientObj)).reverse();
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
            const isFromActivePatient = incomingSenderId.toLowerCase() === activePatientId.toLowerCase() && incomingReceiverId.toLowerCase() === doctorId?.toLowerCase();
            const isFromMeToActivePatient = incomingSenderId.toLowerCase() === doctorId?.toLowerCase() && incomingReceiverId.toLowerCase() === activePatientId.toLowerCase();

            if (isFromActivePatient || isFromMeToActivePatient) {
                // If message is from patient, mark it as read immediately since we have the chat open
                if (isFromActivePatient) {
                    api.put(`chat/${activePatientId}/read`)
                        .then(() => refreshUnreadCount())
                        .catch(err => console.log('Error marking message as read', err));
                }

                if (isMounted) {
                    setMessages((prevs) => {
                        if (prevs.some(m => (m._id === newMsg.id || m._id === newMsg.Id))) return prevs;

                        // If we are the sender, check if we have a temporary optimistic message
                        if (incomingSenderId.toLowerCase() === doctorId?.toLowerCase()) {
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
                                updated[tempMsgIndex] = mapMessageToGiftedChat(newMsg, currentUserObj, patientObj);
                                return updated;
                            }
                        }

                        return GiftedChat.append(prevs, [mapMessageToGiftedChat(newMsg, currentUserObj, patientObj)]);
                    });
                }
            }
        };

        // Subscribe to incoming SignalR messages
        const un1 = signalRService.onMessageReceived(handleNewMessage);
        const un2 = signalRService.on('MessageSentConfirmation', handleNewMessage);

        return () => {
            isMounted = false;
            un1();
            un2();
        };
    }, [activePatientId, doctorId, currentUserObj, patientObj]);

    const handleSendMessage = useCallback(async (newMsgs: IMessage[] = [], msgType = 'text', attachUrl: string | null = null, extraText = '') => {
        if (!activePatientId) return;

        let sentMessageText = '';
        let optimisticMsg: IMessage | null = null;

        if (newMsgs.length > 0) {
            optimisticMsg = { ...newMsgs[0], _id: `temp-${newMsgs[0]._id}` };
            sentMessageText = newMsgs[0].text;
        } else {
            sentMessageText = extraText;
            optimisticMsg = {
                _id: `temp-${Math.random().toString(36).substring(7)}`, // temporary local ID
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
            await signalRService.invoke('SendMessage', activePatientId, sentMessageText, msgType, attachUrl, null);
        } catch (error) {
            console.error('Send error:', error);
            // Revert message if it fails
            setMessages(prev => prev.filter(m => m._id !== optimisticMsg?._id));
            Alert.alert('Error', 'Failed to send message.');
        }
    }, [activePatientId, currentUserObj]);

    // --- Navigation Handlers (with TS fix) ---
    const handleAudioCallPress = () => {
        startCall({ targetUserId: activePatientId, type: 'Audio', role: 'Doctor', peerName: patientName, peerProfilePicture: profilePictureUrl as string | undefined });
    };

    const handleVideoCallPress = () => {
        startCall({ targetUserId: activePatientId, type: 'Video', role: 'Doctor', peerName: patientName, peerProfilePicture: profilePictureUrl as string | undefined });
    };

    const handleERecordsPress = () => {
        router.push({
            pathname: '/Doctor_subpage/erecords',
            params: { patientId: activePatientId }
        } as any);
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
                await signalRService.invoke('SendMessage', activePatientId, text, msgType, uploadedUrl, null);
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
                quality: 0.8,
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

    const handleCreatePrescription = () => {
        setAttachMenuVisible(false);
        router.push({
            pathname: '/Patient_subpage/create_prescription' as any,
            params: { patientId: activePatientId }
        });
    };

    const [attachMenuVisible, setAttachMenuVisible] = useState(false);

    const handleAttachmentPress = () => {
        setAttachMenuVisible(true);
    };

    const toggleRecording = async () => {
        try {
            if (isRecording) {
                // Stop
                setIsRecording(false);
                if (recording) {
                    await recording.stopAndUnloadAsync();
                    const uri = recording.getURI();
                    setRecording(null);
                    if (uri) {
                        sendWithAttachment(uri, 'audio/m4a', 'audio', 'Voice Note');
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

    // --- Custom Renderers ---
    const renderBubble = (props: any) => (
        <Bubble
            {...props}
            wrapperStyle={{
                right: { backgroundColor: themeColors.primary, borderRadius: 15 },
                left: {
                    backgroundColor: isDark ? themeColors.surfaceAlt : '#E2E8F0',
                    borderRadius: 15,
                    borderWidth: 0
                },
            }}
            textStyle={{
                right: { color: '#FFFFFF' },
                left: { color: isDark ? themeColors.text : '#0F172A' },
            }}
        />
    );

    // --- Image modal state ---
    const [imageModalUrl, setImageModalUrl] = useState<string | null>(null);

    // --- Audio player state ---
    const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
    const playingSoundRef = useRef<Audio.Sound | null>(null);
    const [audioDurations, setAudioDurations] = useState<Record<string, number>>({});
    const [audioPosition, setAudioPosition] = useState(0);

    const formatTime = (ms: number) => {
        const totalSec = Math.floor(ms / 1000);
        const min = Math.floor(totalSec / 60);
        const sec = totalSec % 60;
        return `${min}:${sec.toString().padStart(2, '0')}`;
    };

    const handleAudioPlayPause = async (audioUrl: string, messageId: string) => {
        try {
            if (playingAudioId === messageId && playingSoundRef.current) {
                const status = await playingSoundRef.current.getStatusAsync();
                if (status.isLoaded && status.isPlaying) {
                    await playingSoundRef.current.pauseAsync();
                    setPlayingAudioId(null); // Just for UI state, ref stays
                } else if (status.isLoaded && !status.isPlaying) {
                    await playingSoundRef.current.playAsync();
                    setPlayingAudioId(messageId);
                }
                return;
            }

            // If we are switching to a different audio file
            if (playingSoundRef.current) {
                await playingSoundRef.current.unloadAsync();
                playingSoundRef.current = null;
            }

            const { sound, status } = await Audio.Sound.createAsync(
                { uri: audioUrl },
                { shouldPlay: true }
            );
            playingSoundRef.current = sound;
            setPlayingAudioId(messageId);
            
            if (status.isLoaded && typeof status.durationMillis === 'number') {
                setAudioDurations(prev => ({ ...prev, [messageId]: status.durationMillis as number }));
            }

            sound.setOnPlaybackStatusUpdate((playbackStatus: any) => {
                if (playbackStatus.isLoaded) {
                    setAudioPosition(playbackStatus.positionMillis || 0);
                    if (playbackStatus.didJustFinish) {
                        setPlayingAudioId(null);
                        setAudioPosition(0);
                        sound.unloadAsync();
                        playingSoundRef.current = null;
                    }
                }
            });
        } catch (e) {
            Alert.alert('Error', 'Could not play audio.');
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

    const renderCustomView = (props: any) => {
        const { currentMessage } = props;
        if (currentMessage.customType === 'audio' && currentMessage.customUrl) {
            const isRight = currentMessage.user._id === currentUserObj._id;
            const isPlaying = playingAudioId === currentMessage._id;
            const thisDuration = audioDurations[currentMessage._id as string] || 0;
            return (
                <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', padding: 10, gap: 8 }}
                    onPress={() => handleAudioPlayPause(currentMessage.customUrl, currentMessage._id as string)}
                >
                    <Ionicons name={isPlaying ? 'pause-circle' : 'play-circle'} size={32} color={isRight ? '#FFF' : themeColors.primary} />
                    <View>
                        <Text style={{ color: isRight ? '#FFF' : isDark ? themeColors.text : '#1E293B', fontSize: 13 }}>Voice Note</Text>
                        <Text style={{ color: isRight ? 'rgba(255,255,255,0.7)' : themeColors.textMuted, fontSize: 11 }}>
                            {isPlaying ? `${formatTime(audioPosition)} / ${formatTime(thisDuration)}` : formatTime(thisDuration || 0)}
                        </Text>
                    </View>
                </TouchableOpacity>
            );
        } else if (currentMessage.customType === 'file' && currentMessage.customUrl) {
            const isRight = currentMessage.user._id === currentUserObj._id;
            return (
                <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', padding: 10, gap: 8 }}
                    onPress={() => Linking.openURL(currentMessage.customUrl).catch(() => Alert.alert('Error', 'Could not open file.'))}
                >
                    <Ionicons name="document-text" size={28} color={isRight ? '#EFF6FF' : themeColors.primary} />
                    <Text style={{ color: isRight ? '#EFF6FF' : (isDark ? themeColors.text : '#1E293B'), fontSize: 13, textDecorationLine: 'underline' }}>Open Document</Text>
                </TouchableOpacity>
            );
        } else if (currentMessage.customType === 'prescription') {
            let prescriptionData = { drugOrActivity: 'Unknown Medication', alarmTime: '', intervalType: '' };
            try { if (currentMessage.customUrl) prescriptionData = JSON.parse(currentMessage.customUrl); } catch (e) { }
            return (
                <View style={{ padding: 12, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                        <Ionicons name="medkit" size={24} color="#FFF" />
                        <Text style={{ marginLeft: 6, fontWeight: 'bold', color: '#FFF' }}>
                            New Prescription
                        </Text>
                    </View>
                    <Text style={{ color: '#E2E8F0', fontSize: 13, marginTop: 2 }}>{prescriptionData.drugOrActivity}</Text>
                    {prescriptionData.alarmTime ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 4 }}>
                            <Ionicons name="time-outline" size={14} color="#E2E8F0" />
                            <Text style={{ color: '#E2E8F0', fontSize: 12 }}>{prescriptionData.alarmTime}</Text>
                        </View>
                    ) : null}
                </View>
            );
        } else if (currentMessage.customType === 'call') {
            const isRight = currentMessage.user._id === currentUserObj._id;
            const callData = currentMessage.callData || { type: 'Audio', status: 'Ended', duration: 0 };

            const isVideo = callData.type === 'Video';
            const iconName = isVideo ? 'videocam' : 'call';
            const callTitle = callData.label || (isVideo ? 'Video call' : 'Voice call');

            const isMissed = callData.status === 'Missed' || callData.status === 'Declined' || callData.status === 'No answer';

            const iconColor = isMissed ? themeColors.danger : (isRight ? '#FFF' : themeColors.success);
            const textColor = isRight ? '#FFF' : (isDark ? themeColors.text : '#0F172A');
            const subTextColor = isRight ? 'rgba(255,255,255,0.7)' : themeColors.textMuted;

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
    };

    const renderInputToolbar = (props: any) => (
        <InputToolbar
            {...props}
            containerStyle={[{ backgroundColor: themeColors.surface, borderTopColor: themeColors.cardBorder, borderTopWidth: 1, paddingTop: 4 }]}
            primaryStyle={{ alignItems: 'center' }}
        />
    );

    const renderComposer = (props: any) => (
        <Composer
            {...props}
            textInputStyle={[styles.composer, { color: themeColors.text, backgroundColor: themeColors.background }]}
            placeholderTextColor={themeColors.textMuted}
        />
    );

    const renderSend = (props: any) => (
        <View style={styles.sendAndVoiceContainer}>
            <TouchableOpacity
                style={[styles.voiceButton, isRecording && { backgroundColor: isDark ? 'rgba(239,68,68,0.2)' : '#FEE2E2' }]}
                onPress={toggleRecording}
            >
                <Ionicons name="mic" size={24} color={isRecording ? themeColors.danger : themeColors.textMuted} />
            </TouchableOpacity>
            <Send {...props} containerStyle={styles.sendContainer}>
                <View style={[styles.sendCircle, { backgroundColor: themeColors.primary }]}>
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
                <Ionicons name="add-circle" size={28} color={themeColors.textMuted} />
            )}
            onPressActionButton={handleAttachmentPress}
        />
    );

    return (
        // We use edges top/left/right only to prevent the bottom safe area from 
        // creating a massive white gap under the keyboard.
        <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top', 'left', 'right']}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

            {/* Header */}
            <View style={[styles.header, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.cardBorder }]}>
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={{ padding: 8, marginLeft: -8, flexShrink: 0 }}
                    hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                >
                    <Ionicons name="arrow-back" size={24} color={themeColors.text} />
                </TouchableOpacity>

                <View style={[styles.headerContent, { flexShrink: 1 }]}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{initials}</Text>
                        {isOnline && <View style={styles.onlineHeaderBadge} />}
                    </View>
                    <View style={{ flexShrink: 1 }}>
                        <Text style={[styles.headerTitle, { color: themeColors.text }]} numberOfLines={1}>{name}</Text>
                        <Text style={[styles.headerSubtitle, !isOnline && { color: themeColors.textMuted }]} numberOfLines={1}>
                            {isOnline ? 'Online' : 'Offline'}
                        </Text>
                    </View>
                </View>

                <View style={styles.headerActions}>

                    <TouchableOpacity style={[styles.headerActionButton, { backgroundColor: themeColors.surfaceAlt }]} onPress={handleERecordsPress}>
                        <Ionicons name="document-text" size={20} color={themeColors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconButton} onPress={handleAudioCallPress}>
                        <Ionicons name="call" size={22} color={themeColors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconButton} onPress={handleVideoCallPress}>
                        <Ionicons name="videocam" size={22} color={themeColors.primary} />
                    </TouchableOpacity>
                </View>
            </View>

            <GiftedChat
                messages={messages}
                onSend={(newMsgs) => handleSendMessage(newMsgs)}
                user={currentUserObj}
                renderBubble={renderBubble}
                renderMessageImage={renderMessageImage}
                renderCustomView={renderCustomView}
                renderInputToolbar={renderInputToolbar}
                renderComposer={renderComposer}
                renderSend={renderSend}
                renderActions={renderActions}
                renderAvatar={null as any}
                showUserAvatar={false}
                showAvatarForEveryMessage={false}
                alwaysShowSend
                scrollToBottom
                wrapInSafeArea={false}
                messagesContainerStyle={{
                    backgroundColor: themeColors.background,
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

            {/* Medical Tools Menu Modal */}
            <Modal visible={attachMenuVisible} transparent animationType="slide" onRequestClose={() => setAttachMenuVisible(false)}>
                <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setAttachMenuVisible(false)}>
                    <View style={{ flex: 1, justifyContent: 'flex-end' }}>
                        <View style={{ backgroundColor: themeColors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 16, paddingBottom: Platform.OS === 'ios' ? 40 : 24, paddingHorizontal: 20, shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 20 }}>
                            <View style={{ alignSelf: 'center', width: 40, height: 4, backgroundColor: themeColors.cardBorder, borderRadius: 2, marginBottom: 16 }} />
                            <Text style={{ fontSize: 17, fontWeight: '700', color: themeColors.text, marginBottom: 16 }}>Medical Tools</Text>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 }}>
                                <TouchableOpacity
                                    style={{ alignItems: 'center', gap: 8 }}
                                    onPress={() => { setAttachMenuVisible(false); handleCreatePrescription(); }}
                                >
                                    <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: isDark ? 'rgba(99,102,241,0.2)' : '#EEF2FF', justifyContent: 'center', alignItems: 'center' }}>
                                        <Ionicons name="medkit-outline" size={26} color={themeColors.secondary} />
                                    </View>
                                    <Text style={{ fontSize: 12, color: themeColors.textSecondary, fontWeight: '500' }}>Prescription</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={{ alignItems: 'center', gap: 8 }}
                                    onPress={() => { setAttachMenuVisible(false); handleSendFile(); }}
                                >
                                    <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: isDark ? 'rgba(249,115,22,0.2)' : '#FFF7ED', justifyContent: 'center', alignItems: 'center' }}>
                                        <Ionicons name="document-attach-outline" size={26} color={themeColors.warning} />
                                    </View>
                                    <Text style={{ fontSize: 12, color: themeColors.textSecondary, fontWeight: '500' }}>Send File</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={{ alignItems: 'center', gap: 8 }}
                                    onPress={() => { setAttachMenuVisible(false); handleSendImage(); }}
                                >
                                    <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: isDark ? 'rgba(16,185,129,0.2)' : '#ECFDF5', justifyContent: 'center', alignItems: 'center' }}>
                                        <Ionicons name="image-outline" size={26} color={themeColors.accent} />
                                    </View>
                                    <Text style={{ fontSize: 12, color: themeColors.textSecondary, fontWeight: '500' }}>Send Image</Text>
                                </TouchableOpacity>
                            </View>
                            <TouchableOpacity
                                style={{ backgroundColor: themeColors.surfaceAlt, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
                                onPress={() => setAttachMenuVisible(false)}
                            >
                                <Text style={{ fontSize: 15, fontWeight: '600', color: themeColors.textMuted }}>Cancel</Text>
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
    headerActionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 8,
        paddingVertical: 6,
        borderRadius: 8,
        gap: 4,
    },
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