import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../src/services/api';

export default function ReviewsScreen() {
    const router = useRouter();
    const [reviews, setReviews] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useFocusEffect(
        useCallback(() => {
            const fetchReviews = async () => {
                setLoading(true); // Show loading initially
                try {
                    const response = await api.get('/reviews');
                    if (response.data) {
                        const mapped = response.data.map((r: any) => ({
                            id: r.id,
                            patientName: r.patientName || 'Anonymous',
                            rating: r.rating,
                            comment: r.comment,
                            date: r.dateSubmitted
                                ? new Date(r.dateSubmitted).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                })
                                : '',
                        }));
                        setReviews(mapped);
                    }
                } catch (err) {
                    console.log('Error fetching reviews:', err);
                } finally {
                    setLoading(false);
                }
            };
            fetchReviews();
        }, [])
    );

    const renderStars = (rating: number) => {
        const KeyedIonicons = Ionicons as any;
        return (
            <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                    <KeyedIonicons
                        key={star}
                        name={star <= rating ? 'star' : 'star-outline'}
                        size={16}
                        color="#F59E0B"
                        style={{ marginRight: 2 }}
                    />
                ))}
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#1E293B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Patient Reviews</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                {loading ? (
                    <View style={{ alignItems: 'center', justifyContent: 'center', padding: 60 }}>
                        <ActivityIndicator size="large" color="#3B82F6" />
                        <Text style={{ marginTop: 12, color: '#64748B' }}>Loading reviews...</Text>
                    </View>
                ) : (
                    <>
                        <View style={styles.summarySection}>
                            <Text style={styles.averageRating}>{reviews.length > 0 ? (reviews.reduce((acc, curr) => acc + curr.rating, 0) / reviews.length).toFixed(1) : '0.0'}</Text>
                            {renderStars(reviews.length > 0 ? Math.round(reviews.reduce((acc, curr) => acc + curr.rating, 0) / reviews.length) : 0)}
                            <Text style={styles.totalReviews}>Based on {reviews.length} reviews</Text>
                        </View>

                        {reviews.length === 0 ? (
                            <View style={{ alignItems: 'center', justifyContent: 'center', padding: 40, marginTop: 20 }}>
                                <Ionicons name="star-outline" size={64} color="#CBD5E1" style={{ marginBottom: 16 }} />
                                <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1E293B', marginBottom: 8 }}>No reviews yet</Text>
                                <Text style={{ fontSize: 14, color: '#64748B', textAlign: 'center' }}>When patients leave reviews after consultations, they will appear here.</Text>
                            </View>
                        ) : (
                            <View style={styles.reviewsList}>
                                {reviews.map((review) => {
                                    const KeyedView = View as any;
                                    return (
                                        <KeyedView key={review.id} style={styles.reviewCard}>
                                            <View style={styles.reviewHeader}>
                                                <View>
                                                    <Text style={styles.patientName}>{review.patientName}</Text>
                                                    <Text style={styles.reviewDate}>{review.date}</Text>
                                                </View>
                                                {renderStars(review.rating)}
                                            </View>
                                            <Text style={styles.reviewComment}>{review.comment}</Text>
                                        </KeyedView>
                                    );
                                })}
                            </View>
                        )}
                    </>
                )}
            </ScrollView>
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
    backButton: { padding: 4 },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1E293B' },
    scrollContent: { padding: 20 },
    summarySection: {
        alignItems: 'center',
        marginBottom: 30,
        padding: 20,
        backgroundColor: '#F8FAFC',
        borderRadius: 16,
    },
    averageRating: { fontSize: 48, fontWeight: 'bold', color: '#1E293B', marginBottom: 8 },
    starsRow: { flexDirection: 'row', marginBottom: 8 },
    totalReviews: { fontSize: 14, color: '#64748B' },
    reviewsList: { gap: 16 },
    reviewCard: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    reviewHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    patientName: { fontSize: 16, fontWeight: 'bold', color: '#1E293B' },
    reviewDate: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
    reviewComment: { fontSize: 14, color: '#475569', lineHeight: 20 },
});
