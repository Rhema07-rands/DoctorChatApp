import FontAwesome from '@expo/vector-icons/build/FontAwesome';
import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../src/stores/authStore';

export default function LandingPage() {
  const router = useRouter();
  const { isHydrated, isAuthenticated, userRole, hydrate } = useAuthStore();

  // On mount, read SecureStore to check if user is already logged in
  useEffect(() => {
    hydrate();
  }, []);

  // Once hydration is done, redirect if logged in
  useEffect(() => {
    if (!isHydrated) return; // still checking SecureStore

    if (isAuthenticated && userRole) {
      if (userRole === 'doctor') {
        router.replace('/(tab)/Doctor_page/doctor_dashboard');
      } else {
        router.replace('/(tab)/Patient_page/patient_dashboard');
      }
    }
  }, [isHydrated, isAuthenticated, userRole]);

  // While checking SecureStore, show a loading spinner
  if (!isHydrated) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <FontAwesome name="medkit" size={60} color="#1E3A8A" style={{ marginBottom: 10 }} />
          <Text style={styles.logoText}>Doctor Chat</Text>
          <ActivityIndicator size="large" color="#1E3A8A" style={{ marginTop: 30 }} />
        </View>
      </SafeAreaView>
    );
  }

  // If not authenticated, show normal landing page
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <FontAwesome name="medkit" size={60} color="#1E3A8A" style={styles.logoIcon} />
          <Text style={styles.logoText}>Doctor Chat</Text>
        </View>

        <View style={styles.welcomeSection}>
          <Text style={styles.title}>Your Health, Our Priority</Text>
          <Text style={styles.subtitle}>
            Connect with certified medical professionals instantly or manage your patients with ease.
          </Text>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.loginButton]}
            onPress={() => router.push('/login')}
          >
            <Text style={styles.loginButtonText}>Log In</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.registerButton]}
            onPress={() => router.push('/register')}
          >
            <Text style={styles.registerButtonText}>Create Account</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EFF6FF' },
  content: { flex: 1, padding: 30, justifyContent: 'center', alignItems: 'center' },
  logoContainer: { alignItems: 'center', marginBottom: 40 },
  logoIcon: { marginBottom: 10 },
  logoText: { fontSize: 32, fontWeight: 'bold', color: '#1E3A8A' },
  welcomeSection: { alignItems: 'center', marginBottom: 60 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1F2937', textAlign: 'center', marginBottom: 15 },
  subtitle: { fontSize: 16, color: '#6B7280', textAlign: 'center', lineHeight: 24 },
  buttonContainer: { width: '100%', gap: 15 },
  button: { width: '100%', paddingVertical: 15, borderRadius: 12, alignItems: 'center', elevation: 2 },
  loginButton: { backgroundColor: '#1E3A8A' },
  loginButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  registerButton: { backgroundColor: 'white', borderWidth: 2, borderColor: '#1E3A8A' },
  registerButtonText: { color: '#1E3A8A', fontSize: 18, fontWeight: 'bold' },
});