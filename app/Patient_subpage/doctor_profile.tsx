import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../src/services/api';
import { useAppointments } from '../_context/AppointmentContext';
import { useDoctorDirectory } from '../_context/DoctorDirectoryContext';
import { useUser } from '../_context/UserContext';

// ── Stars helper ────────────────────────────────────────────────────────────

function Stars({ rating, size = 16 }: { rating: number; size?: number }) {
    return (
        <View style={{ flexDirection: 'row', gap: 2 }}>
            {[1, 2, 3, 4, 5].map((i) => (
                <Ionicons
                    key={i}
                    name={i <= Math.round(rating) ? 'star' : 'star-outline'}
                    size={size}
                    color="#F59E0B"
                />
            ))}
        </View>
    );
}

function TappableStars({ value, onChange, size = 28 }: { value: number; onChange: (v: number) => void; size?: number }) {
    return (
        <View style={{ flexDirection: 'row', gap: 6 }}>
            {[1, 2, 3, 4, 5].map((i) => (
                <TouchableOpacity key={i} onPress={() => onChange(i)} activeOpacity={0.7}>
                    <Ionicons
                        name={i <= value ? 'star' : 'star-outline'}
                        size={size}
                        color="#F59E0B"
                    />
                </TouchableOpacity>
            ))}
        </View>
    );
}

// ── Component ───────────────────────────────────────────────────────────────

export default function DoctorProfile() {
    const router = useRouter();
    const { doctorId } = useLocalSearchParams<{ doctorId: string }>();
    const { getDoctorById, getReviewsForDoctor, addReview, addActivePatientChat } = useDoctorDirectory();
    const { patientName, patientId: loggedInPatientId } = useUser();
    const { appointments } = useAppointments();

    const doctor = getDoctorById(doctorId!);
    const contextReviews = getReviewsForDoctor(doctorId!);

    // Fetch reviews from backend API
    const [apiReviews, setApiReviews] = useState<any[]>([]);

    useEffect(() => {
        if (!doctorId) return;
        const fetchReviews = async () => {
            try {
                const response = await api.get(`/reviews/${doctorId}`);
                if (Array.isArray(response.data)) {
                    const mapped = response.data.map((r: any) => ({
                        id: r.id,
                        doctorId: doctorId,
                        patientId: r.patientId,
                        patientName: r.patientName,
                        rating: r.rating,
                        comment: r.comment,
                        createdAt: r.dateSubmitted || new Date().toISOString()
                    }));
                    setApiReviews(mapped);
                }
            } catch (err) {
                console.log('Could not fetch reviews from API, using local only.');
            }
        };
        fetchReviews();
    }, [doctorId]);

    // Merge context + API reviews, deduplicate by id
    const allReviews = React.useMemo(() => {
        const map = new Map();
        [...contextReviews, ...apiReviews].forEach(r => map.set(r.id, r));
        return Array.from(map.values()).sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    }, [contextReviews, apiReviews]);

    // Check if patient has (or had) an accepted appointment with this doctor
    const hasAcceptedAppointment = appointments.some(
        a => a.doctorId === doctor?.id && (a.status === 'Confirmed' || a.status === 'Completed')
    );

    // Review form state
    const [showReviewForm, setShowReviewForm] = useState(false);
    const [reviewRating, setReviewRating] = useState(5);
    const [reviewComment, setReviewComment] = useState('');
    const [editingReviewId, setEditingReviewId] = useState<string | null>(null);

    // Review filter state
    const [selectedStarFilter, setSelectedStarFilter] = useState<number | null>(null);

    const filteredReviews = selectedStarFilter
        ? allReviews.filter(r => Math.round(r.rating) === selectedStarFilter)
        : allReviews;

    if (!doctor) {
        return (
            <SafeAreaView style={styles.container}>
                <Text style={{ textAlign: 'center', marginTop: 60, color: '#94A3B8' }}>Doctor not found.</Text>
            </SafeAreaView>
        );
    }

    const handleSubmitReview = async () => {
        if (!reviewComment.trim()) {
            Alert.alert('Missing Comment', 'Please write a comment for your review.');
            return;
        }
        try {
            if (editingReviewId) {
                // Edit existing review
                await api.put(`/reviews/${editingReviewId}`, {
                    doctorId: doctor.id,
                    rating: reviewRating,
                    comment: reviewComment.trim()
                });
                // Update local state
                setApiReviews(prev => prev.map(r => r.id === editingReviewId
                    ? { ...r, rating: reviewRating, comment: reviewComment.trim(), createdAt: new Date().toISOString() }
                    : r
                ));
            } else {
                // Create new review
                await api.post('/reviews', {
                    doctorId: doctor.id,
                    rating: reviewRating,
                    comment: reviewComment.trim()
                });
                // Refetch to get the new review with proper ID
                const response = await api.get(`/reviews/${doctorId}`);
                if (Array.isArray(response.data)) {
                    setApiReviews(response.data.map((r: any) => ({
                        id: r.id, doctorId, patientId: r.patientId, patientName: r.patientName,
                        rating: r.rating, comment: r.comment, createdAt: r.dateSubmitted || new Date().toISOString()
                    })));
                }
            }
        } catch (err) {
            console.error('Failed to submit review:', err);
            // Fallback to local-only add
            if (!editingReviewId) {
                addReview({ doctorId: doctor.id, patientName, rating: reviewRating, comment: reviewComment.trim() });
            }
        }
        setShowReviewForm(false);
        setReviewComment('');
        setReviewRating(5);
        setEditingReviewId(null);
    };

    const handleEditReview = (review: any) => {
        setEditingReviewId(review.id);
        setReviewRating(review.rating);
        setReviewComment(review.comment);
        setShowReviewForm(true);
    };

    const handleDeleteReview = (reviewId: string) => {
        Alert.alert(
            'Delete Review',
            'Are you sure you want to delete this review?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete', style: 'destructive',
                    onPress: async () => {
                        try {
                            await api.delete(`/reviews/${reviewId}`);
                            setApiReviews(prev => prev.filter(r => r.id !== reviewId));
                        } catch (err) {
                            console.error('Failed to delete review:', err);
                            Alert.alert('Error', 'Could not delete the review. Please try again.');
                        }
                    }
                }
            ]
        );
    };

    const handleReport = () => {
        Alert.alert(
            'Report Doctor',
            `Are you sure you want to report ${doctor.name}? Our team will review this report.`,
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Report', style: 'destructive', onPress: () => Alert.alert('Reported', 'Your report has been submitted. Thank you.') },
            ],
        );
    };

    const handleMessagePress = () => {
        if (!hasAcceptedAppointment) {
            Alert.alert(
                "Cannot Send Message",
                "You can only message a doctor if you have a confirmed appointment with them."
            );
            return;
        }

        // Add to active chats
        addActivePatientChat(doctor.id);

        router.push({
            pathname: '/Patient_subpage/chat_conversation',
            params: {
                doctorId: doctor.id,
                name: doctor.name,
                initials: doctor.initials
            }
        } as any);
    };

    const handleCallPress = () => {
        if (!hasAcceptedAppointment) {
            Alert.alert(
                "Cannot Make Call",
                "You can only call a doctor if you have a confirmed appointment with them."
            );
            return;
        }
        router.push('/Patient_subpage/call_logs' as any);
    };

    // ── Rating distribution ─────────────────────────────────────────────
    const ratingDist = [5, 4, 3, 2, 1].map((star) => {
        const count = allReviews.filter((r) => Math.round(r.rating) === star).length;
        const pct = allReviews.length > 0 ? count / allReviews.length : 0;
        return { star, count, pct };
    });

    // ── Availability color ──────────────────────────────────────────────
    const availColor = doctor.availability === 'Available' ? '#22C55E' : doctor.availability === 'Busy' ? '#F59E0B' : '#94A3B8';
    const availBg = doctor.availability === 'Available' ? '#DCFCE7' : doctor.availability === 'Busy' ? '#FEF3C7' : '#F1F5F9';

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={24} color="#0F172A" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Doctor Profile</Text>
                <TouchableOpacity onPress={handleReport} style={styles.reportBtn}>
                    <Ionicons name="flag-outline" size={20} color="#EF4444" />
                </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                {/* ── Profile Header ─────────────────────────── */}
                <View style={styles.profileHeader}>
                    {doctor.profilePictureUrl ? (
                        <Image source={{ uri: doctor.profilePictureUrl }} style={styles.avatarLg} />
                    ) : (
                        <View style={[styles.avatarLg, { backgroundColor: doctor.profileColor }]}>
                            <Text style={styles.avatarLgText}>{doctor.initials}</Text>
                        </View>
                    )}
                    <View style={styles.nameSection}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={styles.doctorName}>{doctor.name}</Text>
                            {doctor.verified && <Ionicons name="checkmark-circle" size={18} color="#3B82F6" style={{ marginLeft: 6 }} />}
                        </View>
                        <Text style={styles.specialty}>{doctor.specialty}</Text>
                        <View style={[styles.availBadge, { backgroundColor: availBg }]}>
                            <View style={[styles.availDot, { backgroundColor: availColor }]} />
                            <Text style={[styles.availText, { color: availColor }]}>{doctor.availability}</Text>
                            <Text style={styles.activeAgo}> • {doctor.lastActive}</Text>
                        </View>
                    </View>
                </View>

                {/* Overall rating bar */}
                <View style={styles.ratingCard}>
                    <View style={styles.ratingBig}>
                        <Text style={styles.ratingBigNum}>{doctor.rating.toFixed(1)}</Text>
                        <Stars rating={doctor.rating} size={18} />
                        <Text style={styles.reviewTotal}>{allReviews.length} reviews</Text>
                    </View>
                    <View style={styles.ratingBars}>
                        {ratingDist.map((d) => (
                            <View key={d.star} style={styles.barRow}>
                                <Text style={styles.barLabel}>{d.star}★</Text>
                                <View style={styles.barTrack}>
                                    <View style={[styles.barFill, { width: `${Math.max(d.pct * 100, 2)}%` }]} />
                                </View>
                                <Text style={styles.barCount}>{d.count}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* ── Action Buttons ──────────────────────────── */}
                <View style={styles.actionsRow}>
                    <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: '#6366F1' }]}
                        onPress={() => router.push({ pathname: '/Patient_subpage/book_appointment', params: { doctorId: doctor.id } } as any)}
                    >
                        <Ionicons name="calendar-outline" size={20} color="#FFF" />
                        <Text style={styles.actionBtnText}>Book</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: hasAcceptedAppointment ? '#3B82F6' : '#94A3B8' }]}
                        onPress={handleMessagePress}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="chatbubble-outline" size={20} color="#FFF" />
                        <Text style={styles.actionBtnText}>Message</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: hasAcceptedAppointment ? '#10B981' : '#94A3B8' }]}
                        onPress={handleCallPress}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="call-outline" size={20} color="#FFF" />
                        <Text style={styles.actionBtnText}>Call</Text>
                    </TouchableOpacity>
                </View>

                {/* ── Info Section ────────────────────────────── */}
                <View style={styles.infoCard}>
                    <Text style={styles.infoTitle}>About</Text>
                    <Text style={styles.infoBody}>{doctor.bio}</Text>

                    <View style={styles.infoRow}>
                        <Ionicons name="school-outline" size={16} color="#6366F1" />
                        <Text style={styles.infoLabel}>Education</Text>
                    </View>
                    <Text style={styles.infoBody}>{doctor.education}</Text>

                    <View style={styles.infoRow}>
                        <Ionicons name="briefcase-outline" size={16} color="#6366F1" />
                        <Text style={styles.infoLabel}>Experience: {doctor.experience}</Text>
                    </View>

                    <View style={styles.infoRow}>
                        <Ionicons name="language-outline" size={16} color="#6366F1" />
                        <Text style={styles.infoLabel}>Languages: {doctor.languages}</Text>
                    </View>

                    <View style={styles.infoRow}>
                        <Ionicons name="business-outline" size={16} color="#6366F1" />
                        <Text style={styles.infoLabel}>{doctor.clinicName}</Text>
                    </View>

                    <View style={styles.infoRow}>
                        <Ionicons name="time-outline" size={16} color="#6366F1" />
                        <Text style={styles.infoLabel}>{doctor.workingHours}</Text>
                    </View>

                    <View style={styles.infoRow}>
                        <Ionicons name="videocam-outline" size={16} color="#6366F1" />
                        <Text style={styles.infoLabel}>Consultation: {doctor.consultationType}</Text>
                    </View>

                    <View style={styles.infoRow}>
                        <Ionicons name="mail-outline" size={16} color="#6366F1" />
                        <Text style={styles.infoLabel}>{doctor.email}</Text>
                    </View>

                    <View style={styles.infoRow}>
                        <Ionicons name="call-outline" size={16} color="#6366F1" />
                        <Text style={styles.infoLabel}>{doctor.phone}</Text>
                    </View>
                </View>

                {/* ── Reviews Section ─────────────────────────── */}
                <View style={styles.reviewsHeader}>
                    <Text style={styles.reviewsTitle}>Reviews</Text>
                    <TouchableOpacity onPress={() => {
                        if (showReviewForm) {
                            setShowReviewForm(false);
                            setEditingReviewId(null);
                            setReviewComment('');
                            setReviewRating(5);
                        } else {
                            setShowReviewForm(true);
                        }
                    }}>
                        <Text style={styles.writeReviewBtn}>{showReviewForm ? 'Cancel' : '+ Write Review'}</Text>
                    </TouchableOpacity>
                </View>

                {/* Write review form */}
                {showReviewForm && (
                    <View style={styles.reviewForm}>
                        <Text style={styles.formLabel}>{editingReviewId ? 'Edit Your Rating' : 'Your Rating'}</Text>
                        <TappableStars value={reviewRating} onChange={setReviewRating} />

                        <Text style={[styles.formLabel, { marginTop: 14 }]}>Comment</Text>
                        <TextInput
                            style={styles.reviewInput}
                            placeholder="Share your experience…"
                            placeholderTextColor="#94A3B8"
                            value={reviewComment}
                            onChangeText={setReviewComment}
                            multiline
                        />
                        <TouchableOpacity style={[styles.submitBtn, editingReviewId ? { backgroundColor: '#F59E0B' } : null]} onPress={handleSubmitReview}>
                            <Text style={styles.submitBtnText}>{editingReviewId ? 'Update Review' : 'Submit Review'}</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Review Filters */}
                {allReviews.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                        <TouchableOpacity
                            style={[styles.filterChip, selectedStarFilter === null && styles.filterChipActive]}
                            onPress={() => setSelectedStarFilter(null)}
                        >
                            <Text style={[styles.filterChipText, selectedStarFilter === null && styles.filterChipTextActive]}>All</Text>
                        </TouchableOpacity>
                        {[5, 4, 3, 2, 1].map(star => (
                            <TouchableOpacity
                                key={star}
                                style={[styles.filterChip, selectedStarFilter === star && styles.filterChipActive]}
                                onPress={() => setSelectedStarFilter(star)}
                            >
                                <Ionicons name="star" size={14} color={selectedStarFilter === star ? '#FFF' : '#F59E0B'} style={{ marginRight: 4 }} />
                                <Text style={[styles.filterChipText, selectedStarFilter === star && styles.filterChipTextActive]}>{star}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                )}

                {/* Reviews list */}
                {filteredReviews.length === 0 ? (
                    <Text style={styles.noReviews}>
                        {selectedStarFilter ? `No ${selectedStarFilter}-star reviews yet.` : 'No reviews yet. Be the first!'}
                    </Text>
                ) : (
                    filteredReviews.map((rev) => {
                        const isOwn = rev.patientId === loggedInPatientId;
                        return (
                            <View key={rev.id} style={styles.reviewCard}>
                                <View style={styles.reviewTop}>
                                    <Text style={styles.reviewAuthor}>{rev.patientName}</Text>
                                    <Stars rating={rev.rating} size={13} />
                                </View>
                                <Text style={styles.reviewComment}>{rev.comment}</Text>
                                <View style={styles.reviewBottom}>
                                    <Text style={styles.reviewDate}>
                                        {new Date(rev.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </Text>
                                    {isOwn && (
                                        <View style={styles.reviewActions}>
                                            <TouchableOpacity onPress={() => handleEditReview(rev)} style={styles.reviewActionBtn}>
                                                <Ionicons name="pencil-outline" size={16} color="#6366F1" />
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => handleDeleteReview(rev.id)} style={styles.reviewActionBtn}>
                                                <Ionicons name="trash-outline" size={16} color="#EF4444" />
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>
                            </View>
                        );
                    })
                )}

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },

    /* Header */
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
    backBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
    reportBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center' },

    /* Profile header */
    profileHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 8, marginBottom: 20 },
    avatarLg: { width: 72, height: 72, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
    avatarLgText: { color: '#FFF', fontSize: 26, fontWeight: '700' },
    nameSection: { flex: 1, marginLeft: 16 },
    doctorName: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
    specialty: { fontSize: 14, color: '#64748B', marginTop: 2 },
    availBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginTop: 8, alignSelf: 'flex-start' },
    availDot: { width: 7, height: 7, borderRadius: 4 },
    availText: { fontSize: 12, fontWeight: '600' },
    activeAgo: { fontSize: 11, color: '#94A3B8' },

    /* Rating card */
    ratingCard: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
    ratingBig: { alignItems: 'center', justifyContent: 'center', paddingRight: 20, borderRightWidth: 1, borderRightColor: '#F1F5F9' },
    ratingBigNum: { fontSize: 36, fontWeight: '800', color: '#0F172A' },
    reviewTotal: { fontSize: 11, color: '#94A3B8', marginTop: 4 },
    ratingBars: { flex: 1, paddingLeft: 16, justifyContent: 'center', gap: 4 },
    barRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    barLabel: { fontSize: 11, color: '#64748B', width: 22 },
    barTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#F1F5F9' },
    barFill: { height: 6, borderRadius: 3, backgroundColor: '#F59E0B' },
    barCount: { fontSize: 11, color: '#94A3B8', width: 18, textAlign: 'right' },

    /* Actions */
    actionsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
    actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 14, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6, elevation: 3 },
    actionBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },

    /* Info card */
    infoCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 18, marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
    infoTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 8 },
    infoBody: { fontSize: 14, color: '#475569', lineHeight: 20, marginBottom: 14 },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    infoLabel: { fontSize: 14, color: '#334155', flex: 1 },

    /* Reviews */
    reviewsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    reviewsTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
    writeReviewBtn: { fontSize: 14, fontWeight: '600', color: '#6366F1' },

    /* Review form */
    reviewForm: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0' },
    formLabel: { fontSize: 13, fontWeight: '600', color: '#64748B', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
    reviewInput: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 14, fontSize: 14, color: '#1E293B', height: 80, textAlignVertical: 'top', borderWidth: 1, borderColor: '#E2E8F0' },
    submitBtn: { marginTop: 14, backgroundColor: '#6366F1', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
    submitBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },

    /* Review card */
    reviewCard: { backgroundColor: '#FFF', borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 6, elevation: 1 },
    reviewTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    reviewAuthor: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
    reviewComment: { fontSize: 13, color: '#475569', lineHeight: 19 },
    reviewBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
    reviewDate: { fontSize: 11, color: '#94A3B8' },
    reviewActions: { flexDirection: 'row', gap: 8 },
    reviewActionBtn: { padding: 4 },
    noReviews: { fontSize: 14, color: '#94A3B8', textAlign: 'center', paddingVertical: 24 },

    /* Review filters */
    filterRow: { flexDirection: 'row', gap: 8, paddingBottom: 16 },
    filterChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
    filterChipActive: { backgroundColor: '#6366F1', borderColor: '#6366F1' },
    filterChipText: { fontSize: 13, fontWeight: '600', color: '#475569' },
    filterChipTextActive: { color: '#FFF' },
});
