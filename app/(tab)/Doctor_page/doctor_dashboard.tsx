import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../../src/services/api';
import { useAppointments } from '../../_context/AppointmentContext';
import { useTheme } from '../../_context/ThemeContext';
import { useUser } from '../../_context/UserContext';



export default function DoctorDashboard() {
  const router = useRouter();
  const {
    consultationType,
    status,
    firstName,
    lastName,
    specialization,
    startTime,
    endTime,
    license,
    profilePictureUrl
  } = useUser();
  const {
    getUpcomingAppointments,
    getActiveConsultations,
    getConsultationHistory,
    getPatientById,
    startConsultation,
    appointments,
    refreshAppointments,
    isLoading: isApptsLoading
  } = useAppointments();

  // Get real data
  const upcomingAppointments = useMemo(() => getUpcomingAppointments().slice(0, 3), [getUpcomingAppointments]);
  const todayAppointments = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return appointments.filter(a => a.date === today && (a.status === 'Confirmed' || a.status === 'Pending'));
  }, [appointments]);
  const activeConsultations = useMemo(() => getActiveConsultations(), [getActiveConsultations]);
  const totalConsultations = getConsultationHistory().length + activeConsultations.length;

  const [reviewCount, setReviewCount] = useState(0);
  const [avgRating, setAvgRating] = useState(0);

  useFocusEffect(
    useCallback(() => {
      const fetchReviewStats = async () => {
        try {
          const res = await api.get('/reviews');
          if (res.data && res.data.length > 0) {
            setReviewCount(res.data.length);
            const avg = res.data.reduce((sum: number, r: any) => sum + r.rating, 0) / res.data.length;
            setAvgRating(avg);
          }
        } catch (e) {
          console.log('Error fetching review stats:', e);
        }
      };

      fetchReviewStats();
      refreshAppointments(); // Auto-refresh all appointments/stats when focusing dashboard
    }, [])
  );

  const OVERVIEW_STATS = [
    { id: '1', label: 'Appointments', value: String(todayAppointments.length), lightBg: '#E0F2FE', lightText: '#0284C7', darkIconBg: '#1E3A8A', darkIconText: '#60A5FA', icon: 'calendar-outline' },
    { id: '2', label: 'Consultations', value: String(totalConsultations), lightBg: '#DCFCE7', lightText: '#16A34A', darkIconBg: '#14532D', darkIconText: '#4ADE80', icon: 'medkit' },
    { id: '3', label: 'Active Now', value: String(activeConsultations.length), lightBg: '#F3E8FF', lightText: '#9333EA', darkIconBg: '#4C1D95', darkIconText: '#A78BFA', icon: 'pulse-outline' },
    { id: '4', label: 'Upcoming', value: String(upcomingAppointments.length), lightBg: '#FFEDD5', lightText: '#EA580C', darkIconBg: '#7C2D12', darkIconText: '#FB923C', icon: 'time-outline' },
  ];

  const getStatusBadgeColors = (status: string) => {
    switch (status) {
      case 'Confirmed':
        return { badgeColor: '#DCFCE7', badgeText: '#16A34A' };
      case 'Pending':
        return { badgeColor: '#FFEDD5', badgeText: '#EA580C' };
      case 'Completed':
        return { badgeColor: '#DBEAFE', badgeText: '#3B82F6' };
      default:
        return { badgeColor: '#F1F5F9', badgeText: '#64748B' };
    }
  };

  const handleStartConsultation = (appointmentId: string, type: string, patientId: string, patientName: string) => {
    startConsultation(appointmentId);
    if (type === 'Chat') {
      const patient = getPatientById(patientId);
      router.push({
        pathname: '/Doctor_subpage/chat_conversation',
        params: { id: patientId, name: patientName, initials: patient?.initials || 'PT' }
      } as any);
    } else {
      alert(`Starting ${type} consultation with ${patientName}`);
    }
  };

  const recentActiveChats = React.useMemo(() => {
    const validStatuses = ['Confirmed', 'Completed'];
    const validAppts = appointments.filter(a => validStatuses.includes(a.status));

    const uniquePatients = new Map<string, any>();
    validAppts.forEach(a => {
      if (!uniquePatients.has(a.patientId)) {
        const patient = getPatientById(a.patientId);
        uniquePatients.set(a.patientId, {
          id: a.patientId,
          name: a.patientName,
          initials: patient?.initials || 'PT',
          message: "Active conversation",
          time: "Now",
          color: patient?.avatarColor || '#3B82F6',
          profilePicture: a.patientProfilePictureUrl || patient?.profilePictureUrl
        });
      }
    });

    return Array.from(uniquePatients.values()).slice(0, 3);
  }, [appointments, getPatientById]);

  const getStatusColor = (s: string) => {
    switch (s) {
      case 'Available': return '#16A34A'; // Green
      case 'Busy': return '#EAB308'; // Yellow/Orange
      default: return '#64748B';
    }
  };

  const { colors: themeColors, isDark } = useTheme();

  const isWakingUp = isApptsLoading && appointments.length === 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      {isWakingUp && (
        <View style={[styles.wakingUpOverlay, { backgroundColor: isDark ? 'rgba(15,23,42,0.85)' : 'rgba(255, 255, 255, 0.85)' }]}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={[styles.wakingUpTitle, { color: themeColors.text }]}>Establishing a secure connection...</Text>
          <Text style={styles.wakingUpSub}>Please wait while we encrypt and load your dashboard (up to 30s).</Text>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Profile Card */}
        <View style={[styles.card, { backgroundColor: themeColors.card }]}>
          <View style={styles.profileHeader}>
            <View style={styles.avatar}>
              {profilePictureUrl ? (
                <Image source={{ uri: profilePictureUrl }} style={{ width: 60, height: 60, borderRadius: 30 }} />
              ) : (
                <Text style={styles.avatarText}>{(firstName?.[0] || '').toUpperCase()}{(lastName?.[0] || '').toUpperCase()}</Text>
              )}
            </View>
            <View style={styles.profileInfo}>
              <View style={styles.nameRow}>
                <Text style={[styles.doctorName, { color: themeColors.text }]}>Dr. {firstName} {lastName}</Text>
                <TouchableOpacity
                  style={styles.reviewIconBtn}
                  onPress={() => router.push('/Doctor_subpage/reviews')}
                >
                  <Ionicons name="star-outline" size={20} color="#F59E0B" />
                </TouchableOpacity>
              </View>
              <Text style={[styles.specialty, { color: themeColors.primary }]}>{specialization}</Text>
              <TouchableOpacity onPress={() => router.push('/Doctor_subpage/reviews')}>
                <Text style={styles.rating}>⭐ {avgRating.toFixed(1)} ({reviewCount} reviews)</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.profileDetails}>
            <Text style={[styles.detailText, { color: themeColors.textSecondary }]}>Consultation Type: <Text style={{ fontWeight: 'bold', color: themeColors.text }}>{consultationType}</Text></Text>
            <Text style={[styles.detailText, { color: themeColors.textSecondary }]}>License: <Text style={{ fontWeight: 'bold', color: themeColors.text }}>{license || '—'}</Text></Text>
            <Text style={[styles.detailText, { color: themeColors.textSecondary }]}>Status: <Text style={{ color: getStatusColor(status), fontWeight: 'bold' }}>{status}</Text></Text>
            <Text style={[styles.detailText, { color: themeColors.textSecondary }]}>Working Hours: <Text style={{ color: themeColors.text, fontWeight: 'bold' }}>{startTime} - {endTime}</Text></Text>
          </View>
        </View>

        {/* Today's Overview (Grid) */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { marginTop: 0, color: themeColors.text }]}>Today's Overview</Text>
        </View>
        <View style={styles.statsGrid}>
          {OVERVIEW_STATS.map((stat) => {
            const KeyedView = View as any;
            return (
              <KeyedView
                key={stat.id}
                style={[
                  styles.statCard as any,
                  isDark ? { backgroundColor: themeColors.card, borderWidth: 1, borderColor: themeColors.cardBorder } : { backgroundColor: stat.lightBg }
                ]}
              >
                <View style={[styles.statIconContainer, { backgroundColor: isDark ? stat.darkIconBg : 'transparent' }]}>
                  <Ionicons name={stat.icon as any} size={24} color={isDark ? stat.darkIconText : stat.lightText} />
                </View>
                <Text style={[styles.statValue, { color: isDark ? themeColors.text : stat.lightText, marginTop: 12 }]}>{stat.value}</Text>
                <Text style={[styles.statLabel, { color: isDark ? themeColors.textSecondary : stat.lightText }]}>{stat.label}</Text>
              </KeyedView>
            );
          })}
        </View>

        {/* Upcoming Appointments */}
        <View style={styles.messageHeaderRow}>
          <Text style={[styles.sectionTitle, { marginBottom: 0, color: themeColors.text }]}>Upcoming Appointments</Text>
          <TouchableOpacity onPress={() => router.push('/Doctor_page/appointments')}>
            <Text style={[styles.viewAllText, { color: themeColors.primary }]}>See all</Text>
          </TouchableOpacity>
        </View>
        {upcomingAppointments.length === 0 ? (
          <View style={[styles.card, { backgroundColor: themeColors.card, borderWidth: isDark ? 1 : 0, borderColor: themeColors.cardBorder }]}>
            <Text style={[styles.emptyText, { color: themeColors.textMuted }]}>No upcoming appointments</Text>
          </View>
        ) : (
          upcomingAppointments.map((appt) => {
            const colors = getStatusBadgeColors(appt.status);
            const isToday = appt.date === new Date().toISOString().split('T')[0];
            const patient = getPatientById(appt.patientId);

            const ApptView = View as any;
            return (
              <ApptView key={appt.id} style={[styles.card as any, { backgroundColor: themeColors.card, borderWidth: isDark ? 1 : 0, borderColor: themeColors.cardBorder }]}>
                <View style={styles.apptHeader}>
                  <Text style={styles.apptTime}>{appt.time}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: colors.badgeColor }]}>
                    <Text style={[styles.statusTextBadge, { color: colors.badgeText }]}>{appt.status}</Text>
                  </View>
                </View>
                <Text style={[styles.apptName, { color: themeColors.text }]}>{appt.patientName}</Text>
                <Text style={[styles.apptDetail, { color: themeColors.textSecondary }]}>{appt.type} • {appt.reason}</Text>

                <View style={styles.actionRow}>
                  {appt.status === 'Confirmed' && isToday ? (
                    <>
                      <TouchableOpacity
                        style={styles.primaryBtn}
                        onPress={() => handleStartConsultation(appt.id, appt.type, appt.patientId, appt.patientName)}
                      >
                        <Text style={styles.btnTextWhite}>Start {appt.type}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.secondaryBtn}
                        onPress={() => router.push({
                          pathname: '/Doctor_subpage/chat_conversation',
                          params: { id: appt.patientId, name: appt.patientName, initials: patient?.initials || 'PT', profilePictureUrl: appt.patientProfilePictureUrl || patient?.profilePictureUrl }
                        } as any)}
                      >
                        <Text style={styles.btnTextBlue}>Message</Text>
                      </TouchableOpacity>
                    </>
                  ) : appt.status === 'Pending' ? (
                    <View style={styles.infoBox}>
                      <Text style={styles.infoBoxText}>Waiting Confirmation</Text>
                    </View>
                  ) : (
                    <View style={styles.infoBox}>
                      <Text style={styles.infoBoxText}>Scheduled for {appt.date}</Text>
                    </View>
                  )}
                </View>
              </ApptView>
            );
          })
        )}

        {/* Recent Messages */}
        <View style={[styles.messageHeaderRow, { marginTop: 20 }]}>
          <Text style={[styles.sectionTitle, { marginBottom: 0, color: themeColors.text }]}>Recent Messages</Text>
          <TouchableOpacity onPress={() => router.push('/(tab)/Doctor_page/doctor_chats')}>
            <Text style={[styles.viewAllText, { color: themeColors.primary }]}>View All</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.card, { backgroundColor: themeColors.card, borderWidth: isDark ? 1 : 0, borderColor: themeColors.cardBorder }]}>
          {recentActiveChats.length === 0 ? (
            <Text style={styles.emptyText}>No messages yet</Text>
          ) : (
            recentActiveChats.map((chat, idx) => {
              const ChatView = View as any;
              return (
                <TouchableOpacity
                  key={chat.id}
                  style={[styles.messageRow, idx !== recentActiveChats.length - 1 && [styles.messageBorder, { borderBottomColor: themeColors.separator }]]}
                  onPress={() => router.push({
                    pathname: '/Doctor_subpage/chat_conversation',
                    params: { id: chat.id, name: chat.name, initials: chat.initials, profilePictureUrl: chat.profilePicture }
                  } as any)}
                >
                  {chat.profilePicture ? (
                    <Image source={{ uri: chat.profilePicture }} style={styles.msgAvatar} />
                  ) : (
                    <View style={[styles.msgAvatar, { backgroundColor: chat.color }]}>
                      <Text style={styles.avatarText}>{chat.initials}</Text>
                    </View>
                  )}
                  <View style={styles.msgContent}>
                    <View style={styles.msgHeader}>
                      <Text style={[styles.msgName, { color: themeColors.text }]}>{chat.name}</Text>
                      <Text style={[styles.msgTime, { color: themeColors.textMuted }]}>{chat.time}</Text>
                    </View>
                    <Text style={[styles.msgText, { color: themeColors.textSecondary }]} numberOfLines={1}>{chat.message}</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scroll: {
    paddingBottom: 40,
    padding: 16,
    paddingTop: 40
  },
  wakingUpOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 9999,
    justifyContent: 'center', alignItems: 'center',
  },
  wakingUpTitle: {
    marginTop: 16, fontSize: 16, fontWeight: 'bold', color: '#1E293B', textAlign: 'center', paddingHorizontal: 20
  },
  wakingUpSub: {
    marginTop: 6, fontSize: 13, color: '#64748B', textAlign: 'center', paddingHorizontal: 20, lineHeight: 18
  },

  header: { marginBottom: 20, paddingTop: 10 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#1E293B' },
  headerSubtitle: { fontSize: 14, color: '#64748B' },

  card: { backgroundColor: 'white', borderRadius: 12, padding: 16, marginBottom: 16, elevation: 1 },
  sectionBorder: {
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 16,
  },

  // Profile
  profileHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  avatarText: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  profileInfo: { flex: 1 },
  doctorName: { fontSize: 18, fontWeight: 'bold', color: '#1E293B' },
  specialty: { color: '#3B82F6', fontSize: 14 },
  rating: { color: '#F59E0B', fontSize: 12, marginTop: 4 },
  profileDetails: { marginBottom: 16 },
  detailText: { color: '#64748B', marginBottom: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reviewIconBtn: { padding: 4 },

  // Overview
  sectionHeaderRow: { marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1E293B', marginBottom: 12 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 16 },
  statCard: { width: '48%', padding: 16, borderRadius: 12, marginBottom: 16, alignItems: 'flex-start' },
  statIconContainer: { width: 40, height: 40, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: 'bold', marginBottom: 4 },
  statLabel: { fontSize: 12 },

  // Appointments
  apptHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  apptTime: { fontWeight: 'bold', color: '#1E293B' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  statusTextBadge: { fontSize: 12, fontWeight: 'bold' },
  apptName: { fontSize: 16, fontWeight: 'bold', color: '#1E293B' },
  apptDetail: { color: '#64748B', marginBottom: 12 },
  actionRow: { flexDirection: 'row', gap: 10 },
  primaryBtn: { backgroundColor: '#3B82F6', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  secondaryBtn: { backgroundColor: '#F1F5F9', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  successBtn: { backgroundColor: '#22C55E', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  dangerBtn: { borderColor: '#EF4444', borderWidth: 1, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  viewBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, alignItems: 'center' },
  btnTextWhite: { color: 'white', fontWeight: '600', fontSize: 12 },
  btnTextBlue: { color: '#3B82F6', fontWeight: '600', fontSize: 12 },
  btnTextRed: { color: '#EF4444', fontWeight: '600', fontSize: 12 },
  emptyText: { textAlign: 'center', color: '#64748B', fontSize: 14, paddingVertical: 20 },
  infoBox: { backgroundColor: '#F0F9FF', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, alignItems: 'center' },
  infoBoxText: { fontSize: 12, color: '#0284C7' },

  // Messages
  messageHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  viewAllText: { color: '#3B82F6', fontWeight: 'bold' },
  messageRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  messageBorder: { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  msgAvatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  msgContent: { flex: 1 },
  msgHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  msgName: { fontWeight: 'bold', color: '#1E293B' },
  msgTime: { fontSize: 10, color: '#94A3B8' },
  msgText: { color: '#64748B', fontSize: 12 },
});
