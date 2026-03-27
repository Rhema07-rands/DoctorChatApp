import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
    FlatList,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../src/services/api';

export default function PatientCallLogsScreen() {
    const router = useRouter();
    const [history, setHistory] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        let isMounted = true;
        const fetchHistory = async () => {
            try {
                const res = await api.get('/calls/history');
                if (isMounted) setHistory(res.data);
            } catch (err) {
                console.log('Error fetching call history:', err);
            } finally {
                if (isMounted) setLoading(false);
            }
        };
        fetchHistory();
        return () => { isMounted = false; };
    }, []);

    const formatDate = (dateStr: string) => {
        if (!dateStr) return 'Unknown Date';
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            return 'Invalid Date';
        }
    };

    const renderItem = ({ item }: { item: any }) => {
        const isVideo = item.callType === 2 || item.callType === 'Video';
        const isMissed = item.status === 5 || item.status === 'Missed' || item.status === 4 || item.status === 'Rejected' || item.status === 'Declined';
        const isIncoming = item.isIncoming;

        let iconName: any = 'call';
        if (isVideo) iconName = 'videocam';

        let iconColor = isMissed ? '#EF4444' : '#10B981';
        let arrowIconName: any = isIncoming ? 'arrow-down-outline' : 'arrow-up-outline';
        let arrowColor = isMissed ? '#EF4444' : (isIncoming ? '#3B82F6' : '#22C55E');

        let durationText = isMissed ? 'Missed' : `${item.duration || 0}s`;
        if (!isMissed && item.duration > 60) {
            durationText = `${Math.floor(item.duration / 60)}m ${item.duration % 60}s`;
        }

        return (
            <View style={styles.logItem}>
                <View style={[styles.iconContainer, { backgroundColor: isMissed ? '#FEF2F2' : '#F0FDF4' }]}>
                    <Ionicons name={iconName} size={24} color={iconColor} />
                </View>
                <View style={styles.logContent}>
                    <Text style={styles.doctorName}>{item.otherUserName || 'Unknown Doctor'}</Text>
                    <View style={styles.detailRow}>
                        <Ionicons name={arrowIconName} size={14} color={arrowColor} style={{ marginRight: 4 }} />
                        <Text style={styles.typeText}>{isVideo ? 'Video' : 'Audio'} Call</Text>
                        <Text style={styles.separator}>•</Text>
                        <Text style={styles.durationText}>{durationText}</Text>
                    </View>
                </View>
                <View style={styles.timeContainer}>
                    <Text style={styles.timeText}>{formatDate(item.startedAt)}</Text>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#1E293B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>My Call Logs</Text>
                <View style={{ width: 40 }} />
            </View>

            {history.length === 0 ? (
                <View style={styles.emptyState}>
                    <View style={styles.emptyIconContainer}>
                        <Ionicons name="call-outline" size={64} color="#CBD5E1" />
                    </View>
                    <Text style={styles.emptyTitle}>No Call Logs</Text>
                    <Text style={styles.emptySubtitle}>History of your video and audio calls with doctors will appear here.</Text>
                </View>
            ) : (
                <FlatList
                    data={history}
                    renderItem={renderItem}
                    keyExtractor={item => item.id.toString()}
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
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    backButton: { width: 40, height: 40, justifyContent: 'center' },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1E293B' },
    listContent: { padding: 16 },
    logItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F8FAFC',
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#F8FAFC',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    logContent: { flex: 1 },
    doctorName: { fontSize: 16, fontWeight: '600', color: '#1E293B', marginBottom: 2 },
    detailRow: { flexDirection: 'row', alignItems: 'center' },
    typeText: { fontSize: 13, color: '#64748B' },
    separator: { marginHorizontal: 4, color: '#CBD5E1' },
    durationText: { fontSize: 13, color: '#64748B' },
    timeContainer: { alignItems: 'flex-end' },
    timeText: { fontSize: 12, color: '#94A3B8', textAlign: 'right' },
    emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
    emptyIconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#F8FAFC',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    emptyTitle: { fontSize: 20, fontWeight: 'bold', color: '#1E293B', marginBottom: 8 },
    emptySubtitle: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20 },
});
