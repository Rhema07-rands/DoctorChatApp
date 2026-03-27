import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { FlatList, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { signalRService } from '../../../src/services/signalrService';
import { useAppointments } from '../../_context/AppointmentContext';
import { useDoctorDirectory } from '../../_context/DoctorDirectoryContext';
import { useTheme } from '../../_context/ThemeContext';

import { useFocusEffect } from '@react-navigation/native';
import { api } from '../../../src/services/api';

export default function PatientChats() {
    const router = useRouter();
    const { getDoctorById } = useDoctorDirectory();
    const { colors, isDark } = useTheme();

    const { appointments } = useAppointments();
    const [searchQuery, setSearchQuery] = useState('');
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
            // Also refresh chats because summaries have IsOnline
            fetchChats();
        });

        const messageUnsubscribe = signalRService.on('ReceiveMessage', () => {
            fetchChats();
        });

        return () => {
            presenceUnsubscribe();
            messageUnsubscribe();
        };
    }, []);

    const filteredChats = useMemo(() => {
        if (!searchQuery.trim()) return chats;
        return chats.filter(c => c.otherUserName.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [chats, searchQuery]);

    const renderEmptyState = () => (
        <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
                <Ionicons name="chatbubbles-outline" size={64} color="#94A3B8" />
            </View>
            <Text style={styles.emptyTitle}>No conversations yet</Text>
            <Text style={styles.emptySubtitle}>
                Connect with a doctor to start messaging and manage your health.
            </Text>
            <TouchableOpacity
                style={styles.bookButton}
                onPress={() => router.push('/Patient_page/appointments')}
            >
                <Text style={styles.bookButtonText}>Find a Doctor</Text>
            </TouchableOpacity>
        </View>
    );

    const renderChatItem = ({ item }: { item: any }) => (
        <TouchableOpacity
            style={styles.chatItem}
            onPress={() => router.push({
                pathname: '/Patient_subpage/chat_conversation',
                params: {
                    doctorId: item.otherUserId,
                    name: item.otherUserName,
                    initials: item.otherUserInitials,
                    isOnline: item.isOnline.toString()
                }
            } as any)}
        >
            <View style={styles.avatarContainer}>
                {item.profilePictureUrl ? (
                    <Image source={{ uri: item.profilePictureUrl }} style={styles.avatar} />
                ) : (
                    <View style={[styles.avatar, { backgroundColor: item.profileColor }]}>
                        <Text style={styles.avatarText}>{item.otherUserInitials}</Text>
                    </View>
                )}
                {item.isOnline && <View style={styles.onlineBadge} />}
            </View>

            <View style={styles.chatInfo}>
                <View style={styles.chatHeader}>
                    <Text style={styles.doctorName}>{item.otherUserName}</Text>
                    <Text style={item.unreadCount > 0 ? styles.timestampUnread : styles.timestamp}>
                        {new Date(item.lastMessageTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                </View>
                <View style={styles.chatFooter}>
                    <Text
                        style={item.unreadCount > 0 ? styles.lastMessageUnread : styles.lastMessage}
                        numberOfLines={1}
                    >
                        {item.messageType === 'call' ? '📞 Call Log' :
                            item.messageType === 'image' ? '📷 Image' :
                                item.messageType === 'file' ? '📄 File' :
                                    item.messageType === 'audio' ? '🎤 Voice Note' :
                                        item.lastMessage}
                    </Text>
                    {item.unreadCount > 0 && (
                        <View style={styles.unreadBadge}>
                            <Text style={styles.unreadText}>{item.unreadCount}</Text>
                        </View>
                    )}
                </View>
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <View style={[styles.header, { backgroundColor: colors.surface }]}>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Chats</Text>
                <TouchableOpacity
                    style={[styles.callLogsBtn, { backgroundColor: isDark ? colors.surfaceAlt : '#F1F5F9' }]}
                    activeOpacity={0.7}
                    onPress={() => router.push('/Patient_subpage/call_logs')}
                >
                    <Ionicons name="call-outline" size={22} color={colors.text} />
                </TouchableOpacity>
            </View>

            <View style={[styles.searchContainer, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
                <Ionicons name="search" size={20} color={colors.placeholder} style={styles.searchIcon} />
                <TextInput
                    style={[styles.searchInput, { color: colors.inputText }]}
                    placeholder="Search conversations..."
                    placeholderTextColor={colors.placeholder}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
            </View>

            <FlatList
                data={filteredChats}
                keyExtractor={(item) => item.otherUserId}
                renderItem={renderChatItem}
                ListEmptyComponent={renderEmptyState}
                contentContainerStyle={chats.length === 0 ? styles.emptyListContent : styles.listContent}
                showsVerticalScrollIndicator={false}
            />

            {/* Action FAB to find new doctors to chat with */}
            {chats.length > 0 && (
                <TouchableOpacity
                    style={styles.fab}
                    onPress={() => router.push('/Patient_page/appointments')}
                >
                    <Ionicons name="chatbubble-ellipses" size={24} color="#FFF" />
                </TouchableOpacity>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC'
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 15,
        backgroundColor: '#FFFFFF',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        marginHorizontal: 20,
        marginBottom: 10,
        paddingHorizontal: 16,
        height: 48,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    searchIcon: {
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#1E293B',
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#0F172A'
    },
    callLogsBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        paddingTop: 10,
        paddingBottom: 80, // Space for FAB
    },
    emptyListContent: {
        flexGrow: 1,
        justifyContent: 'center',
    },
    chatItem: {
        flexDirection: 'row',
        padding: 16,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    avatarContainer: {
        marginRight: 16,
        position: 'relative',
    },
    avatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: '#FFFFFF',
        fontSize: 20,
        fontWeight: 'bold',
    },
    onlineBadge: {
        position: 'absolute',
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: '#10B981',
        bottom: 2,
        right: 2,
        borderWidth: 2,
        borderColor: '#FFFFFF',
    },
    chatInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    chatHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    doctorName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1E293B',
    },
    timestamp: {
        fontSize: 12,
        color: '#94A3B8',
    },
    timestampUnread: {
        fontSize: 12,
        color: '#3B82F6',
        fontWeight: '600',
    },
    chatFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    lastMessage: {
        fontSize: 14,
        color: '#64748B',
        flex: 1,
        paddingRight: 10,
    },
    lastMessageUnread: {
        fontSize: 14,
        color: '#0F172A',
        fontWeight: '600',
        flex: 1,
        paddingRight: 10,
    },
    unreadBadge: {
        backgroundColor: '#3B82F6',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
        minWidth: 24,
        alignItems: 'center',
    },
    unreadText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: 'bold',
    },
    emptyContainer: {
        alignItems: 'center',
        padding: 40,
    },
    emptyIconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1E293B',
        marginBottom: 12,
    },
    emptySubtitle: {
        fontSize: 15,
        color: '#64748B',
        textAlign: 'center',
        marginBottom: 32,
        lineHeight: 22,
    },
    bookButton: {
        backgroundColor: '#3B82F6',
        paddingHorizontal: 32,
        paddingVertical: 14,
        borderRadius: 12,
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    bookButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    fab: {
        position: 'absolute',
        bottom: 16,
        right: 16,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#3B82F6',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    }
});
