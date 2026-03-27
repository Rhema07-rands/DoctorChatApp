import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    FlatList,
    Image,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { signalRService } from '../../../src/services/signalrService';
import { useAppointments } from '../../_context/AppointmentContext';
import { useTheme } from '../../_context/ThemeContext';

import { useFocusEffect } from '@react-navigation/native';
import { api } from '../../../src/services/api';

export default function DoctorChats() {
    const [search, setSearch] = useState('');
    const router = useRouter();
    const { colors, isDark } = useTheme();

    const { appointments, getPatientById } = useAppointments();
    const [onlineUsers, setOnlineUsers] = useState<Record<string, boolean>>({});
    const [chats, setChats] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchChats = async () => {
        try {
            const response = await api.get('chat/summary');
            setChats(response.data);
        } catch (error) {
            console.error('Error fetching chats:', error);
        } finally {
            setLoading(false);
        }
    };

    // Refresh on focus
    useFocusEffect(
        React.useCallback(() => {
            fetchChats();
        }, [])
    );

    // Listen for presence changes and new messages
    React.useEffect(() => {
        const presenceUnsubscribe = signalRService.on('UserPresenceChanged', (data: { userId: string, isOnline: boolean }) => {
            setOnlineUsers(prev => ({ ...prev, [data.userId]: data.isOnline }));
            fetchChats(); // Update IsOnline in summary
        });

        const messageUnsubscribe = signalRService.on('ReceiveMessage', () => {
            fetchChats();
        });

        return () => {
            presenceUnsubscribe();
            messageUnsubscribe();
        };
    }, []);

    const filteredChats = React.useMemo(() => {
        if (!search.trim()) return chats;
        return chats.filter(c => c.otherUserName.toLowerCase().includes(search.toLowerCase()));
    }, [chats, search]);

    // Function to navigate to conversation
    const handleChatPress = (item: any) => {
        router.push({
            pathname: '/Doctor_subpage/chat_conversation',
            params: {
                id: item.otherUserId,
                name: item.otherUserName,
                initials: item.otherUserInitials,
                message: item.lastMessage,
                isOnline: item.isOnline.toString(),
                profilePictureUrl: item.profilePictureUrl
            }
        });
    };

    const renderItem = ({ item }: { item: any }) => (
        <TouchableOpacity
            style={[
                styles.chatItem,
                item.unreadCount > 0 ? styles.activeChatItem : null
            ]}
            onPress={() => handleChatPress(item)}
        >
            <View>
                {item.profilePictureUrl ? (
                    <Image source={{ uri: item.profilePictureUrl }} style={styles.avatar} />
                ) : (
                    <View style={[styles.avatar, { backgroundColor: item.profileColor }]}>
                        <Text style={styles.avatarText}>{item.otherUserInitials}</Text>
                    </View>
                )}
                {item.isOnline && <View style={styles.onlineDot} />}
            </View>

            <View style={styles.chatContent}>
                <View style={styles.chatHeader}>
                    <Text style={styles.name}>{item.otherUserName}</Text>
                    <Text style={styles.time}>
                        {new Date(item.lastMessageTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                </View>
                <View style={styles.chatFooter}>
                    <Text style={styles.message} numberOfLines={1}>
                        {item.messageType === 'call' ? '📞 Call Log' :
                            item.messageType === 'image' ? '📷 Image' :
                                item.messageType === 'file' ? '📄 File' :
                                    item.messageType === 'audio' ? '🎤 Voice Note' :
                                        item.lastMessage}
                    </Text>

                    {item.unreadCount > 0 && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{item.unreadCount} new</Text>
                        </View>
                    )}
                </View>
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.surface }]}>
            <View style={styles.header}>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Chats</Text>
                <TouchableOpacity
                    style={[styles.callLogButton, { backgroundColor: isDark ? colors.surfaceAlt : '#EFF6FF' }]}
                    onPress={() => router.push('/Doctor_subpage/call_logs' as any)}>
                    <Ionicons name="call-outline" size={24} color={colors.primary} />
                </TouchableOpacity>
            </View>

            <View style={[styles.headerContainer, { borderBottomColor: colors.separator }]}>
                <View style={[styles.searchBar, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
                    <Ionicons name="search-outline" size={20} color={colors.textSecondary || '#64748B'} style={{ marginRight: 8 }} />
                    <TextInput
                        style={[styles.searchInput, { color: colors.inputText }]}
                        placeholder="Search..."
                        value={search}
                        onChangeText={setSearch}
                        placeholderTextColor={colors.placeholder}
                    />
                </View>
            </View>

            {filteredChats.length === 0 ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
                    <Ionicons name="chatbubbles-outline" size={64} color={colors.textMuted} style={{ marginBottom: 16 }} />
                    <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text, marginBottom: 8 }}>No active conversations</Text>
                    <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center' }}>When you accept a patient's appointment, they will appear here.</Text>
                </View>
            ) : (
                <FlatList
                    data={filteredChats}
                    renderItem={renderItem}
                    keyExtractor={item => item.otherUserId}
                    contentContainerStyle={styles.listContent}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: 'white' },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 10,
    },
    headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#1E293B' },
    callLogButton: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#EFF6FF',
        borderRadius: 22,
    },
    headerContainer: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'white',
        borderRadius: 25,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        paddingHorizontal: 12,
        height: 45,
    },
    searchInput: { flex: 1, fontSize: 16, color: '#1E293B' },
    listContent: { paddingBottom: 20 },
    chatItem: {
        flexDirection: 'row',
        padding: 16,
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#F8FAFC',
    },
    activeChatItem: { backgroundColor: '#F0F9FF' }, // Highlight color
    onlineDot: {
        position: 'absolute',
        right: 12,
        bottom: 0,
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: '#22C55E',
        borderWidth: 2,
        borderColor: 'white',
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    avatarText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    chatContent: { flex: 1 },
    chatHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    name: { fontSize: 16, fontWeight: 'bold', color: '#1E293B' },
    time: { fontSize: 12, color: '#64748B' },
    chatFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    message: { fontSize: 14, color: '#64748B', flex: 1, marginRight: 8 },
    badge: { backgroundColor: '#3B82F6', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
    badgeText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
});