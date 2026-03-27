import { Stack } from 'expo-router';
import React from 'react';
import { Keyboard } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import FloatingCallWidget from '../components/FloatingCallWidget';
import { AppointmentProvider } from './_context/AppointmentContext';
import { CallProvider } from './_context/CallContext';
import { DoctorDirectoryProvider } from './_context/DoctorDirectoryContext';
import { NotificationProvider } from './_context/NotificationContext';
import { ThemeProvider } from './_context/ThemeContext';
import { UserProvider } from './_context/UserContext';

if (!(Keyboard as any).removeListener) {
    (Keyboard as any).removeListener = () => {
        console.log('Legacy removeListener polyfill triggered safely.');
    };
}

export default function RootLayout() {
    const UP = UserProvider as any;
    const AP = AppointmentProvider as any;
    const DP = DoctorDirectoryProvider as any;

    return (
        <SafeAreaProvider>
            <ThemeProvider>
                <UP>
                    <AP>
                        <DP>
                            <NotificationProvider>
                                <CallProvider>
                                    <Stack screenOptions={{ headerShown: false }}>
                                        {/* Base Entry Screens */}
                                        <Stack.Screen name="index" />
                                        <Stack.Screen name="login" />
                                        <Stack.Screen name="register" />

                                        {/* Tab Entry Point */}
                                        <Stack.Screen name="(tab)" />

                                        {/* Doctor Subpage Screens */}
                                        <Stack.Screen name="Doctor_subpage/erecords" />
                                        <Stack.Screen name="Doctor_subpage/call_logs" />
                                        <Stack.Screen name="Doctor_subpage/professional_info" />
                                        <Stack.Screen name="Doctor_subpage/fees_practice" />
                                        <Stack.Screen name="Doctor_subpage/privacy_settings" />
                                        <Stack.Screen name="Doctor_subpage/reviews" />
                                        <Stack.Screen name="Doctor_subpage/chat_conversation" />
                                        <Stack.Screen name="Doctor_subpage/video_call" />
                                        <Stack.Screen name="Doctor_subpage/audio_call" />

                                        {/* Patient Subpage Screens */}
                                        <Stack.Screen name="Patient_subpage/chat_conversation" />
                                        <Stack.Screen name="Patient_subpage/call_logs" />
                                        <Stack.Screen name="Patient_subpage/privacy_settings" />
                                        <Stack.Screen name="Patient_subpage/personal_info" />
                                        <Stack.Screen name="Patient_subpage/create_prescription" />
                                        <Stack.Screen name="Patient_subpage/doctor_profile" />
                                        <Stack.Screen name="Patient_subpage/book_appointment" />
                                        <Stack.Screen name="Patient_subpage/smart_search" />
                                        <Stack.Screen name="Patient_subpage/my_bookings" />
                                        <Stack.Screen name="Patient_subpage/video_call" />
                                        <Stack.Screen name="Patient_subpage/audio_call" />
                                        <Stack.Screen name="Patient_subpage/symptom_checker" />
                                    </Stack>
                                    <FloatingCallWidget />
                                </CallProvider>
                            </NotificationProvider>
                        </DP>
                    </AP>
                </UP>
            </ThemeProvider>
        </SafeAreaProvider>
    );
}
