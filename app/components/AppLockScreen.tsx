import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppLock } from '../_context/AppLockContext';

const PIN_LENGTH = 4;

export default function AppLockScreen() {
    const { verifyPin, unlockApp } = useAppLock();
    const [pin, setPin] = useState('');
    const [error, setError] = useState(false);

    const handlePress = (digit: string) => {
        if (pin.length < PIN_LENGTH) {
            const newPin = pin + digit;
            setPin(newPin);
            setError(false);

            if (newPin.length === PIN_LENGTH) {
                // Verify automatically
                const isValid = verifyPin(newPin);
                if (isValid) {
                    setPin('');
                    unlockApp();
                } else {
                    setError(true);
                    // Clear after a brief delay
                    setTimeout(() => {
                        setPin('');
                        setError(false);
                    }, 500);
                }
            }
        }
    };

    const handleDelete = () => {
        if (pin.length > 0) {
            setPin(pin.slice(0, -1));
            setError(false);
        }
    };

    const renderDialButtons = () => {
        const rows = [
            ['1', '2', '3'],
            ['4', '5', '6'],
            ['7', '8', '9'],
        ];

        return (
            <View style={styles.dialPad}>
                {rows.map((row, rowIndex) => (
                    <View key={rowIndex} style={styles.dialRow}>
                        {row.map((digit) => (
                            <TouchableOpacity
                                key={digit}
                                style={styles.dialButton}
                                onPress={() => handlePress(digit)}
                            >
                                <Text style={styles.dialText}>{digit}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                ))}
                <View style={styles.dialRow}>
                    <View style={styles.dialButtonPlaceholder} />
                    <TouchableOpacity
                        style={styles.dialButton}
                        onPress={() => handlePress('0')}
                    >
                        <Text style={styles.dialText}>0</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.dialButton}
                        onPress={handleDelete}
                    >
                        <Ionicons name="backspace-outline" size={28} color="#1E293B" />
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    const renderDots = () => {
        const dots = [];
        for (let i = 0; i < PIN_LENGTH; i++) {
            const isActive = i < pin.length;
            dots.push(
                <View
                    key={i}
                    style={[
                        styles.dot,
                        isActive ? styles.dotActive : null,
                        error ? styles.dotError : null,
                    ]}
                />
            );
        }
        return <View style={styles.dotsContainer}>{dots}</View>;
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <Ionicons name="lock-closed-outline" size={56} color="#3B82F6" style={styles.icon} />
                <Text style={styles.title}>App Locked</Text>
                <Text style={styles.subtitle}>Enter your 4-digit PIN to access the app</Text>

                {renderDots()}

                {error && <Text style={styles.errorText}>Incorrect PIN. Try again.</Text>}

                {renderDialButtons()}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        // Make this view absolutely cover the entire screen, over everything
        position: 'absolute',
        top: 0, bottom: 0, left: 0, right: 0,
        zIndex: 99999,
        elevation: 99999,
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    icon: {
        marginBottom: 16,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1E293B',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 15,
        color: '#64748B',
        marginBottom: 32,
        textAlign: 'center',
    },
    dotsContainer: {
        flexDirection: 'row',
        gap: 20,
        marginBottom: 40,
        height: 24, // Fix height so error message doesn't jump
    },
    dot: {
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#E2E8F0',
    },
    dotActive: {
        backgroundColor: '#3B82F6',
    },
    dotError: {
        backgroundColor: '#EF4444',
    },
    errorText: {
        color: '#EF4444',
        fontSize: 14,
        marginBottom: 16,
        position: 'absolute',
        top: '40%', // Approximate absolute to avoid shifting UI
    },
    dialPad: {
        width: '100%',
        maxWidth: 320,
        gap: 16,
    },
    dialRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    dialButton: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#F8FAFC',
        alignItems: 'center',
        justifyContent: 'center',
    },
    dialButtonPlaceholder: {
        width: 72,
        height: 72,
    },
    dialText: {
        fontSize: 28,
        fontWeight: '600',
        color: '#1E293B',
    },
});
