import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Linking,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../src/services/api';

export default function ERecordsScreen() {
    const { patientId } = useLocalSearchParams();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [patientInfo, setPatientInfo] = useState<any>(null);
    const [historicalRecords, setHistoricalRecords] = useState<any[]>([]);

    useEffect(() => {
        if (!patientId) {
            Alert.alert('Error', 'No patient specified.');
            router.back();
            return;
        }
        fetchRecords();
    }, [patientId]);

    const fetchRecords = async () => {
        try {
            setLoading(true);
            const response = await api.get(`/records/${patientId}`);
            setPatientInfo(response.data.patient);
            setHistoricalRecords(response.data.records);
        } catch (error) {
            console.error('Error fetching e-records:', error);
            Alert.alert('Error', 'Failed to retrieve patient medical history.');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenDocument = (url: string) => {
        if (url) {
            Linking.openURL(url).catch(err => {
                Alert.alert("Error", "Could not open document.");
            });
        }
    };

    const calculateAge = (dobString: string) => {
        if (!dobString) return 'N/A';
        const dob = new Date(dobString);
        const ageDifMs = Date.now() - dob.getTime();
        const ageDate = new Date(ageDifMs);
        return Math.abs(ageDate.getUTCFullYear() - 1970);
    };

    const renderHeader = () => {
        if (!patientInfo) return null;

        return (
            <View style={styles.profileHeader}>
                <View style={styles.headerTitleRow}>
                    <Text style={styles.patientName}>{patientInfo.name}</Text>
                    <Text style={styles.ageGender}>{calculateAge(patientInfo.dateOfBirth)} yrs • {patientInfo.gender || 'Not specified'}</Text>
                </View>

                <View style={styles.infoGrid}>
                    <View style={styles.infoBox}>
                        <Text style={styles.infoLabel}>Blood Group</Text>
                        <Text style={styles.infoValue}>{patientInfo.bloodGroup || '--'}</Text>
                    </View>
                    <View style={styles.infoBox}>
                        <Text style={styles.infoLabel}>Genotype</Text>
                        <Text style={styles.infoValue}>{patientInfo.genotype || '--'}</Text>
                    </View>
                </View>

                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Allergies:</Text>
                    <Text style={styles.detailValue}>{patientInfo.allergies || 'None recorded'}</Text>
                </View>

                {patientInfo.medicalRecordsUrl ? (
                    <TouchableOpacity
                        style={styles.registrationDocBtn}
                        onPress={() => handleOpenDocument(patientInfo.medicalRecordsUrl)}
                    >
                        <Ionicons name="document-text" size={20} color="#3B82F6" />
                        <Text style={styles.registrationDocText}>View Medical Record</Text>
                    </TouchableOpacity>
                ) : (
                    <View style={[styles.registrationDocBtn, { backgroundColor: '#F1F5F9', marginTop: 8 }]}>
                        <Ionicons name="document-text-outline" size={20} color="#94A3B8" />
                        <Text style={[styles.registrationDocText, { color: '#94A3B8' }]}>No registration record uploaded</Text>
                    </View>
                )}
            </View>
        );
    };

    const renderRecordItem = ({ item }: { item: any }) => (
        <View style={styles.recordCard}>
            <View style={styles.recordHeader}>
                <View style={styles.doctorBadge}>
                    <Ionicons name="medical" size={12} color="#475569" style={{ marginRight: 4 }} />
                    <Text style={styles.doctorName}>{item.doctorName}</Text>
                </View>
                <Text style={styles.recordDate}>
                    {new Date(item.dateCreated).toLocaleDateString()}
                </Text>
            </View>

            <View style={styles.diagnosisContainer}>
                <Text style={styles.sectionTitle}>Diagnosis</Text>
                <View style={styles.tagsContainer}>
                    {item.diagnosis && item.diagnosis.length > 0 ? (
                        item.diagnosis.map((d: string, i: number) => (
                            <View key={i} style={styles.tag}>
                                <Text style={styles.tagText}>{d}</Text>
                            </View>
                        ))
                    ) : (
                        <Text style={styles.noInfo}>Not specified</Text>
                    )}
                </View>
            </View>

            <View style={styles.notesContainer}>
                <Text style={styles.sectionTitle}>Clinical Notes</Text>
                <Text style={styles.notesText}>{item.notes || 'No notes provided'}</Text>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.appBar}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#1E293B" />
                </TouchableOpacity>
                <Text style={styles.appBarTitle}>Patient E-Records</Text>
                <View style={{ width: 40 }} />
            </View>

            {loading ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color="#3B82F6" />
                    <Text style={styles.loadingText}>Fetching medical history...</Text>
                </View>
            ) : (
                <FlatList
                    data={historicalRecords}
                    keyExtractor={(item) => item.id}
                    ListHeaderComponent={renderHeader}
                    renderItem={renderRecordItem}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="folder-open-outline" size={48} color="#94A3B8" />
                            <Text style={styles.emptyText}>No historical clinical records found.</Text>
                            <Text style={styles.emptySubtext}>Any previous diagnosis given to this patient will appear here.</Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    appBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9'
    },
    backBtn: { padding: 4 },
    appBarTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 12, color: '#64748B', fontSize: 14 },
    listContent: { padding: 16, paddingBottom: 40 },

    profileHeader: {
        backgroundColor: '#FFF',
        padding: 20,
        borderRadius: 16,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOpacity: 0.03,
        shadowRadius: 8,
        elevation: 2,
    },
    headerTitleRow: { marginBottom: 16 },
    patientName: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
    ageGender: { fontSize: 14, color: '#64748B', marginTop: 4 },
    infoGrid: { flexDirection: 'row', gap: 12, marginBottom: 16 },
    infoBox: { flex: 1, backgroundColor: '#F8FAFC', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#F1F5F9' },
    infoLabel: { fontSize: 12, color: '#64748B', marginBottom: 4 },
    infoValue: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
    detailRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
    detailLabel: { fontSize: 14, fontWeight: '600', color: '#475569', width: 80 },
    detailValue: { flex: 1, fontSize: 14, color: '#1E293B' },
    registrationDocBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#EFF6FF',
        paddingVertical: 12,
        borderRadius: 12,
        gap: 8,
    },
    registrationDocText: { color: '#3B82F6', fontWeight: '600', fontSize: 14 },

    recordCard: {
        backgroundColor: '#FFF',
        padding: 16,
        borderRadius: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOpacity: 0.03,
        shadowRadius: 8,
        elevation: 2,
    },
    recordHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    doctorBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    doctorName: { fontSize: 12, fontWeight: '600', color: '#475569' },
    recordDate: { fontSize: 12, color: '#94A3B8', fontWeight: '500' },
    sectionTitle: { fontSize: 13, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
    diagnosisContainer: { marginBottom: 16 },
    tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
    tag: { backgroundColor: '#FEE2E2', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    tagText: { color: '#DC2626', fontSize: 12, fontWeight: '600' },
    noInfo: { fontSize: 14, color: '#94A3B8', fontStyle: 'italic' },
    notesContainer: {},
    notesText: { fontSize: 14, color: '#334155', lineHeight: 22 },

    emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
    emptyText: { fontSize: 16, fontWeight: '600', color: '#1E293B', marginTop: 12, marginBottom: 4 },
    emptySubtext: { fontSize: 14, color: '#94A3B8', textAlign: 'center', paddingHorizontal: 20 },
});
