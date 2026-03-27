import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    FlatList,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IRegisteredDoctor, useDoctorDirectory } from '../_context/DoctorDirectoryContext';

export default function SmartSearch() {
    const router = useRouter();
    const { initialQuery } = useLocalSearchParams<{ initialQuery?: string }>();
    const { searchDoctorsByCondition } = useDoctorDirectory();

    const [query, setQuery] = useState(initialQuery || '');
    const [results, setResults] = useState<IRegisteredDoctor[]>([]);
    const [searched, setSearched] = useState(false);

    const handleSearch = () => {
        if (!query.trim()) return;
        const matched = searchDoctorsByCondition(query);
        setResults(matched);
        setSearched(true);
    };

    // Auto-search when opened with initialQuery from Symptom Checker
    useEffect(() => {
        if (initialQuery) {
            setQuery(initialQuery);
            const matched = searchDoctorsByCondition(initialQuery);
            setResults(matched);
            setSearched(true);
        }
    }, [initialQuery]);

    const renderDoctor = ({ item }: { item: IRegisteredDoctor }) => (
        <TouchableOpacity
            style={styles.card}
            activeOpacity={0.8}
            onPress={() =>
                router.push({ pathname: '/Patient_subpage/doctor_profile', params: { doctorId: item.id } } as any)
            }
        >
            <View style={[styles.avatar, { backgroundColor: item.profileColor }]}>
                <Text style={styles.avatarText}>{item.initials}</Text>
            </View>
            <View style={styles.cardInfo}>
                <View style={styles.nameRow}>
                    <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
                    {item.verified && <Ionicons name="checkmark-circle" size={14} color="#3B82F6" style={{ marginLeft: 4 }} />}
                </View>
                <Text style={styles.cardSpec}>{item.specialty}</Text>
                <View style={styles.ratingRow}>
                    <Ionicons name="star" size={12} color="#F59E0B" />
                    <Text style={styles.ratingNum}>{item.rating.toFixed(1)}</Text>
                    <Text style={styles.reviewCount}>({item.reviewCount})</Text>
                </View>
            </View>
            <TouchableOpacity
                style={[styles.bookBtn, { backgroundColor: item.profileColor }]}
                onPress={() =>
                    router.push({ pathname: '/Patient_subpage/book_appointment', params: { doctorId: item.id } } as any)
                }
            >
                <Text style={styles.bookBtnText}>Book</Text>
            </TouchableOpacity>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={24} color="#0F172A" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Smart Search</Text>
                <View style={{ width: 36 }} />
            </View>

            <View style={styles.content}>
                {/* Illustration area */}
                <View style={styles.heroArea}>
                    <View style={styles.heroIcon}>
                        <Ionicons name="sparkles" size={36} color="#6366F1" />
                    </View>
                    <Text style={styles.heroTitle}>Describe Your Problem</Text>
                    <Text style={styles.heroSubtitle}>
                        Tell us what you're experiencing and we'll find the right specialist for you.
                    </Text>
                </View>

                {/* Search box */}
                <View style={styles.searchBox}>
                    <TextInput
                        style={styles.searchInput}
                        placeholder="e.g. I have chest pain and shortness of breath…"
                        placeholderTextColor="#94A3B8"
                        value={query}
                        onChangeText={setQuery}
                        multiline
                        onSubmitEditing={handleSearch}
                    />
                    <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} activeOpacity={0.85}>
                        <Ionicons name="search" size={20} color="#FFF" />
                        <Text style={styles.searchBtnText}>Find Doctor</Text>
                    </TouchableOpacity>
                </View>

                {/* Results */}
                {searched && (
                    <Text style={styles.resultLabel}>
                        {results.length > 0
                            ? `${results.length} specialist${results.length > 1 ? 's' : ''} matched`
                            : 'No matching specialists found. Try different keywords.'}
                    </Text>
                )}

                <FlatList
                    data={results}
                    keyExtractor={(d) => d.id}
                    renderItem={renderDoctor}
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    content: { flex: 1, paddingHorizontal: 20 },

    /* Header */
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
    backBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },

    /* Hero */
    heroArea: { alignItems: 'center', marginTop: 12, marginBottom: 24 },
    heroIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
    heroTitle: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
    heroSubtitle: { fontSize: 14, color: '#64748B', textAlign: 'center', marginTop: 6, lineHeight: 20, paddingHorizontal: 20 },

    /* Search */
    searchBox: { backgroundColor: '#FFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 20 },
    searchInput: { fontSize: 15, color: '#1E293B', minHeight: 60, textAlignVertical: 'top', marginBottom: 10 },
    searchBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#6366F1', borderRadius: 12, paddingVertical: 13 },
    searchBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },

    /* Results */
    resultLabel: { fontSize: 13, color: '#64748B', fontWeight: '600', marginBottom: 12 },
    list: { paddingBottom: 40 },

    /* Doctor card */
    card: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#FFF', borderRadius: 16, padding: 14, marginBottom: 10,
        shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
    },
    avatar: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    avatarText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
    cardInfo: { flex: 1, marginLeft: 12 },
    nameRow: { flexDirection: 'row', alignItems: 'center' },
    cardName: { fontSize: 15, fontWeight: '700', color: '#0F172A', flexShrink: 1 },
    cardSpec: { fontSize: 12, color: '#64748B', marginTop: 2 },
    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
    ratingNum: { fontSize: 12, fontWeight: '700', color: '#0F172A' },
    reviewCount: { fontSize: 11, color: '#94A3B8' },
    bookBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, marginLeft: 8 },
    bookBtnText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
});
