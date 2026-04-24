import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../app/_context/ThemeContext';

const FIRST_AID_DATA = [
    {
        id: 'burns',
        title: 'Burns & Scalds',
        icon: 'flame',
        color: '#EF4444',
        steps: [
            'Cool the burn immediately with cool running water for at least 10 minutes.',
            'Remove jewelry or clothing near the burn, unless it is stuck to the skin.',
            'Cover the burn loosely with cling film (plastic wrap) or a clean, non-fluffy dressing.',
            'DO NOT apply ice, butter, or creams.',
            'Seek medical help if the burn is larger than your hand, on the face, or blistered.',
        ]
    },
    {
        id: 'cuts',
        title: 'Cuts & Bleeding',
        icon: 'water',
        color: '#EF4444',
        steps: [
            'Wash your hands, then apply direct pressure to the wound with a clean cloth or sterile dressing.',
            'Maintain pressure for at least 5-10 minutes to stop bleeding.',
            'If blood soaks through, add another pad on top. Do not remove the first one.',
            'Once bleeding stops, clean the wound with mild soap and water.',
            'Apply an antibiotic ointment and a sterile bandage.',
            'Seek medical help if the wound is deep, gaping, or wont stop bleeding.'
        ]
    },
    {
        id: 'cpr',
        title: 'CPR (Adults)',
        icon: 'heart',
        color: '#3B82F6',
        steps: [
            'Check for danger, then check for response. Tap the shoulders and ask "Are you okay?".',
            'If no response and not breathing normally, call emergency services immediately.',
            'Place the heel of your hand on the center of the chest, interlock fingers.',
            'Push hard and fast: 2 inches deep, at a rate of 100-120 beats per minute.',
            'If trained, give 2 rescue breaths after every 30 compressions.',
            'Continue until help arrives or the person recovers.'
        ]
    },
    {
        id: 'choking',
        title: 'Choking (Adults)',
        icon: 'restaurant',
        color: '#F59E0B',
        steps: [
            'Ask the person if they are choking. If they can cough or speak, encourage them to keep coughing.',
            'If they cannot breathe, give 5 back blows between the shoulder blades with the heel of your hand.',
            'If that fails, give 5 abdominal thrusts (Heimlich maneuver): stand behind them, make a fist above their navel, and pull inward and upward.',
            'Alternate 5 back blows and 5 abdominal thrusts until the object is dislodged.',
            'If the person becomes unconscious, begin CPR.'
        ]
    },
    {
        id: 'seizure',
        title: 'Seizures',
        icon: 'flash',
        color: '#8B5CF6',
        steps: [
            'Do not try to restrain the person or stop their movements.',
            'Clear the area of hard or sharp objects to prevent injury.',
            'Place something soft under their head.',
            'Do NOT put anything in their mouth.',
            'Time the seizure. If it lasts longer than 5 minutes, call emergency services.',
            'Once it stops, gently roll them onto their side (recovery position).'
        ]
    }
];

export default function FirstAidScreen() {
    const router = useRouter();
    const { colors, isDark } = useTheme();
    const [expandedId, setExpandedId] = useState<string | null>(null);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
            <View style={[styles.header, { borderBottomColor: isDark ? colors.cardBorder : '#E2E8F0' }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>First Aid Guide</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scroll}>
                <View style={styles.alertBox}>
                    <Ionicons name="warning" size={24} color="#B45309" />
                    <Text style={styles.alertText}>
                        This guide provides general information for basic emergencies. It is not a substitute for professional medical care. In a true emergency, call 112 or local emergency services immediately.
                    </Text>
                </View>

                {FIRST_AID_DATA.map((item) => {
                    const isExpanded = expandedId === item.id;
                    return (
                        <View key={item.id} style={[styles.card, { backgroundColor: colors.card, borderColor: isDark ? colors.cardBorder : '#E2E8F0' }]}>
                            <TouchableOpacity
                                style={styles.cardHeader}
                                onPress={() => setExpandedId(isExpanded ? null : item.id)}
                            >
                                <View style={[styles.iconBox, { backgroundColor: item.color + '22' }]}>
                                    <Ionicons name={item.icon as any} size={24} color={item.color} />
                                </View>
                                <Text style={[styles.cardTitle, { color: colors.text }]}>{item.title}</Text>
                                <Ionicons 
                                    name={isExpanded ? "chevron-up" : "chevron-down"} 
                                    size={24} 
                                    color={colors.textMuted} 
                                />
                            </TouchableOpacity>

                            {isExpanded && (
                                <View style={[styles.cardContent, { borderTopColor: isDark ? colors.cardBorder : '#E2E8F0' }]}>
                                    {item.steps.map((step, index) => (
                                        <View key={index} style={styles.stepRow}>
                                            <View style={[styles.stepNumber, { backgroundColor: item.color }]}>
                                                <Text style={styles.stepNumberText}>{index + 1}</Text>
                                            </View>
                                            <Text style={[styles.stepText, { color: colors.text }]}>{step}</Text>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>
                    );
                })}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
    },
    scroll: {
        padding: 16,
    },
    alertBox: {
        flexDirection: 'row',
        backgroundColor: '#FEF3C7',
        padding: 16,
        borderRadius: 12,
        marginBottom: 20,
        alignItems: 'center',
        gap: 12,
    },
    alertText: {
        flex: 1,
        color: '#92400E',
        fontSize: 13,
        lineHeight: 18,
    },
    card: {
        borderRadius: 16,
        borderWidth: 1,
        marginBottom: 12,
        overflow: 'hidden',
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 16,
    },
    iconBox: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardTitle: {
        flex: 1,
        fontSize: 16,
        fontWeight: '600',
    },
    cardContent: {
        padding: 16,
        borderTopWidth: 1,
        backgroundColor: 'rgba(0,0,0,0.02)',
    },
    stepRow: {
        flexDirection: 'row',
        marginBottom: 16,
        gap: 12,
    },
    stepNumber: {
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 2,
    },
    stepNumberText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '700',
    },
    stepText: {
        flex: 1,
        fontSize: 14,
        lineHeight: 22,
    }
});
