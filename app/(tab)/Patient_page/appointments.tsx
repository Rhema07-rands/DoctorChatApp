import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
    FlatList,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IRegisteredDoctor, useDoctorDirectory } from '../../_context/DoctorDirectoryContext';

// ── Filter helpers ──────────────────────────────────────────────────────────

const SPECIALTIES = [
    'All', 'Cardiology', 'Dermatology', 'General Practice', 'Neurology',
    'Pediatrics', 'Orthopedics', 'Psychiatry', 'Gastroenterology',
    'Ophthalmology', 'Endocrinology',
];
const GENDERS = ['All', 'Male', 'Female'];
const AVAILABILITIES = ['All', 'Available', 'Busy', 'Offline'];
const SORT_OPTIONS = [
    { label: 'Default', value: 'default' },
    { label: 'Rating ↓', value: 'rating_desc' },
    { label: 'Rating ↑', value: 'rating_asc' },
    { label: 'Most Reviews', value: 'reviews' },
];
const MIN_RATINGS = [0, 3, 3.5, 4, 4.5];

function availabilityColor(a: string) {
    switch (a) {
        case 'Available': return '#22C55E';
        case 'Busy': return '#F59E0B';
        default: return '#94A3B8';
    }
}
function availabilityBg(a: string) {
    switch (a) {
        case 'Available': return '#DCFCE7';
        case 'Busy': return '#FEF3C7';
        default: return '#F1F5F9';
    }
}

// ── Component ───────────────────────────────────────────────────────────────

export default function PatientAppointments() {
    const router = useRouter();
    const { doctors, refreshDoctors } = useDoctorDirectory();

    // Search & filter state
    const [search, setSearch] = useState('');
    const [filterOpen, setFilterOpen] = useState(false);
    const [selSpecialty, setSelSpecialty] = useState('All');
    const [selGender, setSelGender] = useState('All');
    const [selAvailability, setSelAvailability] = useState('All');
    const [selSort, setSelSort] = useState('default');
    const [selMinRating, setSelMinRating] = useState(0);

    useFocusEffect(
        useCallback(() => {
            refreshDoctors();
        }, [])
    );

    const filtered = useMemo(() => {
        let list = doctors;
        // Text search
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(
                (d) =>
                    d.name.toLowerCase().includes(q) ||
                    d.specialty.toLowerCase().includes(q),
            );
        }
        if (selSpecialty !== 'All') list = list.filter((d) => d.specialty === selSpecialty);
        if (selGender !== 'All') list = list.filter((d) => d.gender === selGender);
        if (selAvailability !== 'All') list = list.filter((d) => d.availability === selAvailability);
        if (selMinRating > 0) list = list.filter((d) => d.rating >= selMinRating);
        // Sort
        if (selSort === 'rating_desc') list = [...list].sort((a, b) => b.rating - a.rating);
        else if (selSort === 'rating_asc') list = [...list].sort((a, b) => a.rating - b.rating);
        else if (selSort === 'reviews') list = [...list].sort((a, b) => b.reviewCount - a.reviewCount);
        return list;
    }, [doctors, search, selSpecialty, selGender, selAvailability, selMinRating, selSort]);

    const activeFilters =
        (selSpecialty !== 'All' ? 1 : 0) +
        (selGender !== 'All' ? 1 : 0) +
        (selAvailability !== 'All' ? 1 : 0) +
        (selSort !== 'default' ? 1 : 0) +
        (selMinRating > 0 ? 1 : 0);

    // ── Doctor card ─────────────────────────────────────────────────────

    const renderDoctor = ({ item }: { item: IRegisteredDoctor }) => (
        <TouchableOpacity
            style={styles.card}
            activeOpacity={0.8}
            onPress={() =>
                router.push({ pathname: '/Patient_subpage/doctor_profile', params: { doctorId: item.id } } as any)
            }
        >
            {/* Avatar */}
            <View style={[styles.avatar, { backgroundColor: item.profileColor }]}>
                <Text style={styles.avatarText}>{item.initials}</Text>
            </View>

            {/* Info */}
            <View style={styles.cardInfo}>
                <View style={styles.nameRow}>
                    <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
                    {item.verified && (
                        <Ionicons name="checkmark-circle" size={15} color="#3B82F6" style={{ marginLeft: 4 }} />
                    )}
                </View>
                <Text style={styles.cardSpecialty}>{item.specialty}</Text>

                {/* Rating + reviews */}
                <View style={styles.ratingRow}>
                    <Ionicons name="star" size={13} color="#F59E0B" />
                    <Text style={styles.ratingNum}>{item.rating.toFixed(1)}</Text>
                    <Text style={styles.reviewCount}>({item.reviewCount})</Text>
                </View>

                {/* Last active */}
                <Text style={styles.lastActive}>Active {item.lastActive}</Text>
            </View>

            {/* Right section */}
            <View style={styles.cardRight}>
                {/* Availability badge */}
                <View style={[styles.availBadge, { backgroundColor: availabilityBg(item.availability) }]}>
                    <View style={[styles.availDot, { backgroundColor: availabilityColor(item.availability) }]} />
                    <Text style={[styles.availText, { color: availabilityColor(item.availability) }]}>
                        {item.availability}
                    </Text>
                </View>

                {/* Book button */}
                <TouchableOpacity
                    style={[styles.bookBtn, { backgroundColor: item.profileColor }]}
                    activeOpacity={0.8}
                    onPress={() =>
                        router.push({ pathname: '/Patient_subpage/book_appointment', params: { doctorId: item.id } } as any)
                    }
                >
                    <Text style={styles.bookBtnText}>Book</Text>
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
    );

    // ── Filter Modal ────────────────────────────────────────────────────

    const renderFilterModal = () => (
        <Modal visible={filterOpen} transparent animationType="slide" onRequestClose={() => setFilterOpen(false)}>
            <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setFilterOpen(false)}>
                <TouchableOpacity style={styles.modalSheet} activeOpacity={1} onPress={() => { }}>
                    <View style={styles.modalHandle} />
                    <View style={styles.modalHeaderRow}>
                        <Text style={styles.modalTitle}>Filter Doctors</Text>
                        <TouchableOpacity onPress={() => setFilterOpen(false)} style={styles.modalCloseBtn}>
                            <Ionicons name="close" size={22} color="#64748B" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false}>
                        {/* Specialty */}
                        <Text style={styles.filterLabel}>Specialty</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                            {SPECIALTIES.map((s) => (
                                <TouchableOpacity
                                    key={s}
                                    style={[styles.chip, selSpecialty === s && styles.chipActive]}
                                    onPress={() => setSelSpecialty(s)}
                                >
                                    <Text style={[styles.chipText, selSpecialty === s && styles.chipTextActive]}>{s}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        {/* Gender */}
                        <Text style={styles.filterLabel}>Gender</Text>
                        <View style={styles.chipRow}>
                            {GENDERS.map((g) => (
                                <TouchableOpacity
                                    key={g}
                                    style={[styles.chip, selGender === g && styles.chipActive]}
                                    onPress={() => setSelGender(g)}
                                >
                                    <Text style={[styles.chipText, selGender === g && styles.chipTextActive]}>{g}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Min rating */}
                        <Text style={styles.filterLabel}>Minimum Rating</Text>
                        <View style={styles.chipRow}>
                            {MIN_RATINGS.map((r) => (
                                <TouchableOpacity
                                    key={r}
                                    style={[styles.chip, selMinRating === r && styles.chipActive]}
                                    onPress={() => setSelMinRating(r)}
                                >
                                    <Text style={[styles.chipText, selMinRating === r && styles.chipTextActive]}>
                                        {r === 0 ? 'Any' : `${r}★+`}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Availability */}
                        <Text style={styles.filterLabel}>Availability</Text>
                        <View style={styles.chipRow}>
                            {AVAILABILITIES.map((a) => (
                                <TouchableOpacity
                                    key={a}
                                    style={[styles.chip, selAvailability === a && styles.chipActive]}
                                    onPress={() => setSelAvailability(a)}
                                >
                                    <Text style={[styles.chipText, selAvailability === a && styles.chipTextActive]}>{a}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Sort by */}
                        <Text style={styles.filterLabel}>Sort By</Text>
                        <View style={styles.chipRow}>
                            {SORT_OPTIONS.map((s) => (
                                <TouchableOpacity
                                    key={s.value}
                                    style={[styles.chip, selSort === s.value && styles.chipActive]}
                                    onPress={() => setSelSort(s.value)}
                                >
                                    <Text style={[styles.chipText, selSort === s.value && styles.chipTextActive]}>{s.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </ScrollView>

                    {/* Actions — pinned at bottom */}
                    <View style={styles.modalActions}>
                        <TouchableOpacity
                            style={styles.resetBtn}
                            onPress={() => { setSelSpecialty('All'); setSelGender('All'); setSelAvailability('All'); setSelSort('default'); setSelMinRating(0); }}
                        >
                            <Text style={styles.resetBtnText}>Reset</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.applyBtn} onPress={() => setFilterOpen(false)}>
                            <Text style={styles.applyBtnText}>Apply</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>
    );

    // ── Main ────────────────────────────────────────────────────────────

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.headerRow}>
                <Text style={styles.pageTitle}>Find a Doctor</Text>
                <TouchableOpacity
                    style={styles.bookingsBtn}
                    activeOpacity={0.7}
                    onPress={() => router.push('/Patient_subpage/my_bookings' as any)}
                >
                    <Ionicons name="calendar-outline" size={18} color="#FFF" />
                    <Text style={styles.bookingsBtnText}>My Bookings</Text>
                </TouchableOpacity>
            </View>

            {/* Search bar + filter */}
            <View style={styles.searchRow}>
                <View style={styles.searchBox}>
                    <Ionicons name="search-outline" size={18} color="#94A3B8" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search by name or specialty…"
                        placeholderTextColor="#94A3B8"
                        value={search}
                        onChangeText={setSearch}
                    />
                    {search.length > 0 && (
                        <TouchableOpacity onPress={() => setSearch('')}>
                            <Ionicons name="close-circle" size={18} color="#CBD5E1" />
                        </TouchableOpacity>
                    )}
                </View>
                <TouchableOpacity style={styles.filterBtn} onPress={() => setFilterOpen(true)}>
                    <Ionicons name="options-outline" size={20} color="#1E293B" />
                    {activeFilters > 0 && (
                        <View style={styles.filterBadge}>
                            <Text style={styles.filterBadgeText}>{activeFilters}</Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>

            {/* Results count */}
            <Text style={styles.resultCount}>{filtered.length} doctor{filtered.length !== 1 ? 's' : ''} found</Text>

            {/* Doctor list */}
            {filtered.length === 0 ? (
                <View style={styles.emptyState}>
                    <Ionicons name="search" size={56} color="#CBD5E1" />
                    <Text style={styles.emptyTitle}>No Doctors Found</Text>
                    <Text style={styles.emptySubtitle}>Try adjusting your search or filters.</Text>
                </View>
            ) : (
                <FlatList
                    data={filtered}
                    keyExtractor={(d) => d.id}
                    renderItem={renderDoctor}
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                />
            )}

            {/* Smart Search FAB */}
            <TouchableOpacity
                style={styles.fab}
                activeOpacity={0.85}
                onPress={() => router.push('/Patient_subpage/smart_search' as any)}
            >
                <Ionicons name="sparkles" size={24} color="#fff" />
            </TouchableOpacity>

            {renderFilterModal()}
        </SafeAreaView>
    );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 },
    pageTitle: { fontSize: 26, fontWeight: '800', color: '#0F172A' },
    bookingsBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#3B82F6', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, gap: 6 },
    bookingsBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
    resultCount: { fontSize: 13, color: '#94A3B8', paddingHorizontal: 20, marginBottom: 8 },

    /* Search */
    searchRow: { flexDirection: 'row', paddingHorizontal: 20, marginTop: 12, marginBottom: 10, gap: 10 },
    searchBox: {
        flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF',
        borderRadius: 14, paddingHorizontal: 14, height: 48,
        borderWidth: 1, borderColor: '#E2E8F0',
    },
    searchInput: { flex: 1, marginLeft: 8, fontSize: 15, color: '#1E293B' },
    filterBtn: {
        width: 48, height: 48, borderRadius: 14, backgroundColor: '#FFF',
        justifyContent: 'center', alignItems: 'center',
        borderWidth: 1, borderColor: '#E2E8F0',
    },
    filterBadge: {
        position: 'absolute', top: 6, right: 6,
        width: 16, height: 16, borderRadius: 8,
        backgroundColor: '#6366F1', justifyContent: 'center', alignItems: 'center',
    },
    filterBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '700' },

    /* Doctor card */
    list: { paddingHorizontal: 20, paddingBottom: 100 },
    card: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#FFF', borderRadius: 16, padding: 14, marginBottom: 12,
        shadowColor: '#6366F1', shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
    },
    avatar: {
        width: 52, height: 52, borderRadius: 16,
        justifyContent: 'center', alignItems: 'center',
    },
    avatarText: { color: '#FFF', fontWeight: '700', fontSize: 17 },
    cardInfo: { flex: 1, marginLeft: 12 },
    nameRow: { flexDirection: 'row', alignItems: 'center' },
    cardName: { fontSize: 15, fontWeight: '700', color: '#0F172A', flexShrink: 1 },
    cardSpecialty: { fontSize: 12, color: '#64748B', marginTop: 2 },
    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
    ratingNum: { fontSize: 12, fontWeight: '700', color: '#0F172A' },
    reviewCount: { fontSize: 11, color: '#94A3B8' },
    lastActive: { fontSize: 10, color: '#94A3B8', marginTop: 3 },
    cardRight: { alignItems: 'flex-end', marginLeft: 8, gap: 8 },
    availBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
    },
    availDot: { width: 6, height: 6, borderRadius: 3 },
    availText: { fontSize: 10, fontWeight: '600' },
    bookBtn: { paddingHorizontal: 18, paddingVertical: 7, borderRadius: 20 },
    bookBtnText: { color: '#FFF', fontSize: 12, fontWeight: '700' },

    /* Empty */
    emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: '#334155', marginTop: 14 },
    emptySubtitle: { fontSize: 14, color: '#94A3B8', textAlign: 'center', marginTop: 6 },

    /* FAB */
    fab: {
        position: 'absolute', bottom: 30, right: 24,
        width: 58, height: 58, borderRadius: 29,
        backgroundColor: '#6366F1', justifyContent: 'center', alignItems: 'center',
        shadowColor: '#6366F1', shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35, shadowRadius: 10, elevation: 6,
    },

    /* Filter Modal */
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    modalSheet: {
        backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
        padding: 24, paddingBottom: 40, maxHeight: '75%',
    },
    modalHandle: {
        width: 40, height: 4, borderRadius: 2, backgroundColor: '#E2E8F0',
        alignSelf: 'center', marginBottom: 16,
    },
    modalTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A', flex: 1 },
    modalHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    modalCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
    filterLabel: { fontSize: 13, fontWeight: '600', color: '#64748B', marginTop: 16, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 },
    chipScroll: { flexGrow: 0, marginBottom: 4 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
        paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
        backgroundColor: '#F1F5F9', marginRight: 8,
    },
    chipActive: { backgroundColor: '#6366F1' },
    chipText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
    chipTextActive: { color: '#FFF' },
    modalActions: { flexDirection: 'row', marginTop: 28, gap: 12 },
    resetBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: '#F1F5F9', alignItems: 'center' },
    resetBtnText: { fontSize: 15, fontWeight: '700', color: '#64748B' },
    applyBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: '#6366F1', alignItems: 'center' },
    applyBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
});
