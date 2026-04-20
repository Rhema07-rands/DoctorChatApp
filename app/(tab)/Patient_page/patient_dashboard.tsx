import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo } from 'react';
import {
    Alert,
    FlatList,
    Image,
    Linking,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppointments } from '../../_context/AppointmentContext';
import { useDoctorDirectory } from '../../_context/DoctorDirectoryContext';
import { useTheme } from '../../_context/ThemeContext';
import { useUser } from '../../_context/UserContext';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getGreeting(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
}

function appointmentTypeIcon(type: string): keyof typeof Ionicons.glyphMap {
    switch (type) {
        case 'Video': return 'videocam';
        case 'Audio': return 'call';
        case 'Chat': return 'chatbubble-ellipses';
        default: return 'calendar';
    }
}

function appointmentTypeColor(type: string) {
    switch (type) {
        case 'Video': return '#6366F1';
        case 'Audio': return '#0EA5E9';
        case 'Chat': return '#3B82F6';
        default: return '#64748B';
    }
}

import { IRegisteredDoctor } from '../../_context/DoctorDirectoryContext';

/** Open the user's native Maps app with a nearby-search query. */
function openNearbyInMaps(query: string) {
    const encoded = encodeURIComponent(query);
    const url = Platform.select({
        ios: `maps://maps.apple.com/?q=${encoded}`,
        default: `https://www.google.com/maps/search/${encoded}`,
    });
    Linking.openURL(url).catch(() =>
        Alert.alert('Unable to open Maps', 'Please make sure you have a maps application installed.')
    );
}

function showNearbyPicker() {
    Alert.alert(
        'Find Nearby',
        'What would you like to find near you?',
        [
            { text: 'Pharmacies', onPress: () => openNearbyInMaps('pharmacies near me') },
            { text: 'Hospitals', onPress: () => openNearbyInMaps('hospitals near me') },
            { text: 'Cancel', style: 'cancel' },
        ]
    );
}

const QUICK_ACTIONS = [
    { id: 'chat', label: 'Chat', icon: 'chatbubble-ellipses-outline' as const, bg: '#EFF6FF', iconColor: '#3B82F6', route: '/Patient_page/patient_chats' },
    { id: 'book', label: 'Book Visit', icon: 'calendar-outline' as const, bg: '#FFF7ED', iconColor: '#F59E0B', route: '/Patient_page/appointments' },
    { id: 'presc', label: 'Rx', icon: 'medical-outline' as const, bg: '#FDF2F8', iconColor: '#EC4899', route: '/Patient_page/prescriptions' },
    { id: 'bookings', label: 'My Bookings', icon: 'bookmarks-outline' as const, bg: '#F3E8FF', iconColor: '#9333EA', route: '/Patient_subpage/my_bookings' },
    { id: 'symptom', label: 'Symptoms', icon: 'body-outline' as const, bg: '#ECFDF5', iconColor: '#10B981', route: '/Patient_subpage/symptom_checker' },
    { id: 'nearby', label: 'Nearby', icon: 'location-outline' as const, bg: '#FFF1F2', iconColor: '#E11D48', action: 'nearby' },
];

const HEALTH_TIPS = [
    { id: '1', title: 'Stay Hydrated', body: 'Drink at least 8 glasses of water daily for better health.', icon: 'water-outline' as const, bg: '#E0F2FE', accent: '#0284C7' },
    { id: '2', title: 'Sleep Well', body: '7-9 hours of quality sleep boosts your immune system.', icon: 'moon-outline' as const, bg: '#EDE9FE', accent: '#7C3AED' },
    { id: '3', title: 'Stay Active', body: '30 min of daily exercise reduces chronic disease risk.', icon: 'fitness-outline' as const, bg: '#DCFCE7', accent: '#16A34A' },
];

// ─── Component ──────────────────────────────────────────────────────────────

export default function PatientDashboard() {
    const router = useRouter();
    const { appointments, updateAppointmentStatus, refreshAppointments } = useAppointments();
    const { doctors, getDoctorById } = useDoctorDirectory();
    const { patientName, patientAge, patientId, patientGender, patientBloodGroup, patientGenotype, profilePictureUrl } = useUser();
    const { colors, isDark } = useTheme();


    useFocusEffect(
        useCallback(() => {
            refreshAppointments();
        }, [])
    );

    const topDoctors = useMemo(() => doctors.slice(0, 4), [doctors]);

    const upcoming = useMemo(
        () =>
            appointments
                .filter((a) => a.patientId === patientId && (a.status === 'Confirmed' || a.status === 'Pending'))
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                .slice(0, 3),
        [appointments, patientId]
    );

    const handleMessage = (apptId: string, doctorId: string, doctorName: string, status: string) => {
        if (status !== 'Confirmed') {
            Alert.alert(
                "Cannot Send Message yet",
                "You can only message a doctor after they have accepted your appointment booking."
            );
            return;
        }

        const doctor = getDoctorById(doctorId);
        router.push({
            pathname: '/Patient_subpage/chat_conversation',
            params: {
                doctorId: doctorId,
                name: doctorName,
                initials: doctor ? doctor.initials : 'DR'
            }
        } as any);
    };

    // ── Render helpers ──────────────────────────────────────────────────

    const renderDoctorCard = ({ item: doc }: { item: IRegisteredDoctor }) => {
        const isNow = doc.availability === 'Available';
        return (
            <TouchableOpacity
                style={styles.docCard}
                activeOpacity={0.85}
                onPress={() => router.push({
                    pathname: '/Patient_subpage/doctor_profile',
                    params: { doctorId: doc.id }
                } as any)}
            >
                {/* Avatar */}
                <View style={[styles.docAvatarCircle, { backgroundColor: doc.profileColor }]}>
                    <Text style={styles.docAvatarText}>{doc.initials}</Text>
                </View>

                {/* Info */}
                <Text style={styles.docCardName} numberOfLines={1}>{doc.name}</Text>
                <Text style={styles.docCardSpec}>{doc.specialty}</Text>

                {/* Rating */}
                <View style={styles.ratingRow}>
                    <Ionicons name="star" size={12} color="#F59E0B" />
                    <Text style={styles.ratingText}>{doc.rating.toFixed(1)}</Text>
                </View>

                {/* Availability badge */}
                <View style={[styles.availBadge, { backgroundColor: isNow ? '#DCFCE7' : '#FEF3C7' }]}>
                    <View style={[styles.availDot, { backgroundColor: isNow ? '#22C55E' : '#F59E0B' }]} />
                    <Text style={[styles.availText, { color: isNow ? '#16A34A' : '#B45309' }]}>
                        {isNow ? 'Available now' : doc.availability}
                    </Text>
                </View>

                {/* Book button */}
                <TouchableOpacity
                    style={[styles.bookBtn, { backgroundColor: doc.profileColor }]}
                    activeOpacity={0.8}
                    onPress={() => router.push({
                        pathname: '/Patient_subpage/book_appointment',
                        params: { doctorId: doc.id }
                    } as any)}
                >
                    <Text style={styles.bookBtnText}>Book</Text>
                </TouchableOpacity>
            </TouchableOpacity>
        );
    };

    const renderHealthTip = ({ item }: { item: typeof HEALTH_TIPS[0] }) => (
        <View style={[styles.tipCard, { backgroundColor: item.bg }]}>
            <View style={[styles.tipIconBox, { backgroundColor: item.accent + '22' }]}>
                <Ionicons name={item.icon} size={22} color={item.accent} />
            </View>
            <Text style={[styles.tipTitle, { color: item.accent }]}>{item.title}</Text>
            <Text style={styles.tipBody}>{item.body}</Text>
        </View>
    );

    // ── Main render ─────────────────────────────────────────────────────

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

                {/* ── Header ─────────────────────────────────── */}
                <View style={styles.header}>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.greeting, { color: colors.text }]}>{getGreeting()}, {patientName.split(' ')[0]} 👋</Text>
                        <Text style={[styles.subtitle, { color: colors.textMuted }]}>How are you feeling today?</Text>
                    </View>
                </View>

                {/* ── Profile Card ────────────────────────────── */}
                <View style={[styles.profileCard, { backgroundColor: colors.card }]}>
                    {/* Blue accent bar */}
                    <View style={styles.accentBar} />

                    <View style={styles.profileInner}>
                        {/* Avatar + info */}
                        <View style={styles.profileRow}>
                            <View style={[styles.patientAvatar, { backgroundColor: isDark ? colors.primaryLight : '#DBEAFE' }]}>
                                {profilePictureUrl ? (
                                    <Image source={{ uri: profilePictureUrl }} style={{ width: 56, height: 56, borderRadius: 28 }} />
                                ) : (
                                    <Text style={[styles.patientAvatarText, { color: colors.primary }]}>{patientName.split(' ').map(n => n[0]).join('')}</Text>
                                )}
                            </View>
                            <View style={styles.patientInfo}>
                                <Text style={[styles.patientName, { color: colors.text }]}>{patientName}</Text>
                                <Text style={[styles.patientMeta, { color: colors.textMuted }]}>• Age: {patientAge} • Gender: {patientGender || 'Unknown'}</Text>
                                <View style={styles.verifiedRow}>
                                    <Ionicons name="checkmark-circle" size={14} color="#22C55E" />
                                    <Text style={styles.verifiedText}>Verified</Text>
                                </View>
                            </View>
                        </View>

                        {/* Health quick-stats */}
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.statsRow}
                            style={{ marginHorizontal: -16, paddingHorizontal: 16 }}
                        >
                            <View style={[styles.statChip, { backgroundColor: isDark ? colors.surfaceAlt : '#FEF2F2' }]}>
                                <Ionicons name="water-outline" size={14} color="#EF4444" />
                                <Text style={[styles.statChipText, { color: colors.text }]}>{patientBloodGroup}</Text>
                            </View>
                            <View style={[styles.statChip, { backgroundColor: isDark ? colors.surfaceAlt : '#F5F3FF' }]}>
                                <Ionicons name="people-outline" size={14} color="#8B5CF6" />
                                <Text style={[styles.statChipText, { color: colors.text }]}>{patientGenotype}</Text>
                            </View>
                        </ScrollView>
                    </View>
                </View>

                {/* ── Quick Actions ───────────────────────────── */}
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Actions</Text>
                <View style={styles.actionsGrid}>
                    {QUICK_ACTIONS.map((a) => (
                        <TouchableOpacity
                            key={a.id}
                            style={styles.actionItem}
                            activeOpacity={0.75}
                            onPress={() => (a as any).action === 'nearby' ? showNearbyPicker() : router.push((a as any).route)}
                        >
                            <View style={[styles.actionIconBox, { backgroundColor: isDark ? colors.surfaceAlt : a.bg }]}>
                                <Ionicons name={a.icon} size={24} color={a.iconColor} />
                            </View>
                            <Text style={[styles.actionLabel, { color: colors.text }]}>{a.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* ── Available Doctors (Horizontal) ─────────── */}
                <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Available Doctors</Text>
                    <TouchableOpacity activeOpacity={0.6} onPress={() => router.push('/Patient_page/appointments')}>
                        <Text style={[styles.seeAll, { color: colors.primary }]}>See All</Text>
                    </TouchableOpacity>
                </View>
                <FlatList
                    data={topDoctors}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyExtractor={(d) => d.id}
                    renderItem={renderDoctorCard}
                    contentContainerStyle={styles.docList}
                    ItemSeparatorComponent={() => <View style={{ width: 14 }} />}
                />

                {/* ── Upcoming Appointments ───────────────────── */}
                <View style={[styles.sectionHeader, { marginTop: 28 }]}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Upcoming Appointments</Text>
                    <TouchableOpacity activeOpacity={0.6} onPress={() => router.push('/Patient_subpage/my_bookings' as any)}>
                        <Text style={[styles.seeAll, { color: colors.primary }]}>See All</Text>
                    </TouchableOpacity>
                </View>

                {upcoming.length === 0 ? (
                    <View style={styles.emptyCard}>
                        <Ionicons name="calendar-outline" size={40} color="#CBD5E1" />
                        <Text style={styles.emptyTitle}>No upcoming appointments</Text>
                        <Text style={styles.emptyBody}>Book a visit with a doctor to get started.</Text>
                    </View>
                ) : (
                    upcoming.map((appt) => {
                        const isConfirmed = appt.status === 'Confirmed';
                        const accentColor = isConfirmed ? '#22C55E' : '#F59E0B';
                        const typeColor = appointmentTypeColor(appt.type);

                        const doc = appt.doctorId ? getDoctorById(appt.doctorId) : undefined;
                        const displayName = doc?.name || appt.doctorName || appt.patientName;

                        return (
                            <View key={appt.id} style={styles.apptCard}>
                                {/* Left accent */}
                                <View style={[styles.apptAccent, { backgroundColor: accentColor }]} />

                                <View style={styles.apptContent}>
                                    {/* Top row */}
                                    <View style={styles.apptTopRow}>
                                        <Text style={styles.apptDocName}>{displayName}</Text>
                                        <View style={[styles.apptStatusBadge, { backgroundColor: accentColor + '20' }]}>
                                            <Text style={[styles.apptStatusText, { color: accentColor }]}>
                                                {appt.status}
                                            </Text>
                                        </View>
                                    </View>

                                    {/* Details */}
                                    <View style={styles.apptDetailRow}>
                                        <Ionicons name="calendar-outline" size={13} color="#94A3B8" />
                                        <Text style={styles.apptDetailText}>{appt.date}</Text>
                                        <Ionicons name="time-outline" size={13} color="#94A3B8" style={{ marginLeft: 10 }} />
                                        <Text style={styles.apptDetailText}>{appt.time}</Text>
                                    </View>

                                    {/* Action Row */}
                                    <View style={styles.actionRow}>
                                        {/* Cancel Button */}
                                        <TouchableOpacity style={[styles.actionBtnOutline, { borderColor: '#FECACA' }]} activeOpacity={0.7} onPress={() => {
                                            Alert.alert(
                                                "Cancel Appointment",
                                                "Are you sure you want to cancel this appointment?",
                                                [
                                                    { text: "No", style: "cancel" },
                                                    { text: "Yes, Cancel", style: "destructive", onPress: () => updateAppointmentStatus(appt.id, 'Cancelled') }
                                                ]
                                            );
                                        }}>
                                            <Text style={[styles.actionBtnOutlineText, { color: '#DC2626' }]}>Cancel</Text>
                                        </TouchableOpacity>

                                        {/* Reschedule Button */}
                                        <TouchableOpacity
                                            style={styles.actionBtnOutline}
                                            activeOpacity={0.7}
                                            onPress={() => router.push({
                                                pathname: '/Patient_subpage/reschedule_appointment',
                                                params: { appointmentId: appt.id, doctorId: appt.doctorId }
                                            } as any)}
                                        >
                                            <Text style={styles.actionBtnOutlineText}>Reschedule</Text>
                                        </TouchableOpacity>

                                        {/* Message Button */}
                                        <TouchableOpacity
                                            style={[
                                                styles.actionBtnSolid,
                                                { backgroundColor: isConfirmed ? '#3B82F6' : '#94A3B8' }
                                            ]}
                                            activeOpacity={0.8}
                                            onPress={() => {
                                                handleMessage(appt.id, appt.doctorId || '', displayName, appt.status);
                                            }}
                                        >
                                            <Ionicons name="chatbubble-ellipses" size={14} color="#FFF" style={{ marginRight: 4 }} />
                                            <Text style={styles.actionBtnSolidText}>Message</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        );
                    })
                )}

                {/* ── Health Tips ─────────────────────────────── */}
                <View style={[styles.sectionHeader, { marginTop: 28 }]}>
                    <Text style={styles.sectionTitle}>Health Tips</Text>
                </View>
                <FlatList
                    data={HEALTH_TIPS}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyExtractor={(t) => t.id}
                    renderItem={renderHealthTip}
                    contentContainerStyle={styles.tipList}
                    ItemSeparatorComponent={() => <View style={{ width: 14 }} />}
                />

                {/* Bottom spacer */}
                <View style={{ height: 100 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    scroll: { paddingHorizontal: 20, paddingTop: 12 },

    // ── Header
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
    greeting: { fontSize: 24, fontWeight: '700', color: '#0F172A' },
    subtitle: { fontSize: 14, color: '#94A3B8', marginTop: 2 },
    bellBtn: {
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center',
        elevation: 3, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    },
    bellDot: {
        position: 'absolute', top: 10, right: 11,
        width: 8, height: 8, borderRadius: 4,
        backgroundColor: '#EF4444', borderWidth: 1.5, borderColor: '#FFF',
    },

    // ── Profile Card
    profileCard: {
        backgroundColor: '#FFF', borderRadius: 16,
        elevation: 4, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
        marginBottom: 28, overflow: 'hidden',
    },
    accentBar: { height: '100%', width: 5, backgroundColor: '#3B82F6', position: 'absolute', left: 0, top: 0, borderTopLeftRadius: 16, borderBottomLeftRadius: 16 },
    profileInner: { padding: 16, paddingLeft: 20 },
    profileRow: { flexDirection: 'row', alignItems: 'center' },
    patientAvatar: {
        width: 54, height: 54, borderRadius: 27,
        backgroundColor: '#DBEAFE', justifyContent: 'center', alignItems: 'center',
    },
    patientAvatarText: { color: '#3B82F6', fontWeight: '700', fontSize: 18 },
    patientInfo: { flex: 1, marginLeft: 14 },
    patientName: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
    patientMeta: { fontSize: 12, color: '#64748B', marginTop: 2 },
    verifiedRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 },
    verifiedText: { fontSize: 11, color: '#22C55E', fontWeight: '600' },
    statsRow: { flexDirection: 'row', marginTop: 14, gap: 10 },
    statChip: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        backgroundColor: '#F8FAFC', paddingHorizontal: 10, paddingVertical: 6,
        borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0',
    },
    statChipText: { fontSize: 11, fontWeight: '600', color: '#334155' },

    // ── Quick Actions
    sectionTitle: { fontSize: 17, fontWeight: '700', color: '#0F172A', marginBottom: 14 },
    actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 10 },
    actionItem: { width: '30%', alignItems: 'center', marginBottom: 20 },
    actionIconBox: {
        width: 56, height: 56, borderRadius: 18, justifyContent: 'center', alignItems: 'center',
        elevation: 4, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
    },
    actionLabel: { fontSize: 12, color: '#475569', fontWeight: '500', marginTop: 8 },

    // ── Section header
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    seeAll: { fontSize: 13, fontWeight: '600', color: '#3B82F6' },

    // ── Doctor cards (horizontal)
    docList: { paddingVertical: 6 },
    docCard: {
        width: 160, backgroundColor: '#FFF', borderRadius: 16, padding: 14,
        alignItems: 'center',
        elevation: 3, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
    },
    docAvatarCircle: {
        width: 52, height: 52, borderRadius: 26,
        justifyContent: 'center', alignItems: 'center', marginBottom: 10,
    },
    docAvatarText: { color: '#FFF', fontWeight: '700', fontSize: 17 },
    docCardName: { fontSize: 13, fontWeight: '700', color: '#0F172A', textAlign: 'center' },
    docCardSpec: { fontSize: 11, color: '#64748B', marginTop: 2 },
    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 6 },
    ratingText: { fontSize: 12, fontWeight: '600', color: '#0F172A' },
    availBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, marginTop: 8,
    },
    availDot: { width: 6, height: 6, borderRadius: 3 },
    availText: { fontSize: 10, fontWeight: '600' },
    bookBtn: {
        marginTop: 10, paddingHorizontal: 24, paddingVertical: 7, borderRadius: 20,
    },
    bookBtnText: { color: '#FFF', fontSize: 12, fontWeight: '700' },

    // ── Appointments
    emptyCard: {
        backgroundColor: '#FFF', borderRadius: 16, padding: 32, alignItems: 'center',
        elevation: 2, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, marginBottom: 6,
    },
    emptyTitle: { fontSize: 15, fontWeight: '600', color: '#475569', marginTop: 12 },
    emptyBody: { fontSize: 12, color: '#94A3B8', marginTop: 4, textAlign: 'center' },
    apptCard: {
        flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 14,
        marginBottom: 12, overflow: 'hidden',
        elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    },
    apptAccent: { width: 4 },
    apptContent: { flex: 1, padding: 14 },
    apptTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    apptDocName: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
    apptStatusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
    apptStatusText: { fontSize: 10, fontWeight: '700' },
    apptDetailRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10 },
    apptDetailText: { fontSize: 12, color: '#64748B' },
    actionRow: {
        flexDirection: 'row',
        marginTop: 16,
        gap: 8,
    },
    actionBtnOutline: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionBtnOutlineText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#475569',
    },
    actionBtnSolid: {
        flex: 1.2,
        flexDirection: 'row',
        paddingVertical: 10,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionBtnSolidText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#FFF',
    },

    // ── Health Tips
    tipList: { paddingVertical: 6 },
    tipCard: {
        width: 200, borderRadius: 16, padding: 16,
    },
    tipIconBox: {
        width: 40, height: 40, borderRadius: 12,
        justifyContent: 'center', alignItems: 'center', marginBottom: 10,
    },
    tipTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
    tipBody: { fontSize: 12, color: '#475569', lineHeight: 17 },
});