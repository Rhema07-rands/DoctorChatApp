import FontAwesome from '@expo/vector-icons/build/FontAwesome';
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useUser } from "./_context/UserContext";

import { login } from "../src/services/authService";
import { notificationService } from "../src/services/notificationService";
import { useAuthStore } from "../src/stores/authStore";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { setUserRole, refreshProfile } = useUser();
  const signIn = useAuthStore((s) => s.signIn);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }
    if (isLoading) return;

    setIsLoading(true);
    try {
      // authService.ts handles saving the token to SecureStore internally.
      // Do NOT call SecureStore.setItemAsync here — data.token may be undefined
      // if the backend returns Token (capital T), causing an immediate throw
      // before any navigation or profile refresh occurs.
      const data = await login(email, password);

      console.log("Login Success");

      // Token is now in SecureStore (saved by authService).
      // refreshProfile and push registration will both find it via interceptor.
      await refreshProfile();

      try {
        await notificationService.registerForPushNotificationsAsync();
      } catch (pushError) {
        console.error("Failed to register for push notifications during login:", pushError);
      }

      Alert.alert("Success", "Logged in successfully");

      const userRole = data.user?.role || data.User?.role || data.role;
      const normalizedRole = userRole === 'Doctor' ? 'doctor' : 'patient';
      setUserRole(normalizedRole);
      signIn(normalizedRole);

      if (userRole === 'Doctor') {
        router.replace('/(tab)/Doctor_page/doctor_dashboard');
      } else {
        router.replace('/(tab)/Patient_page/patient_dashboard');
      }

    } catch (error: any) {
      Alert.alert("Login Failed", error.message || "Invalid email or password");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <FontAwesome name="medkit" size={60} color="#1E3A8A" style={{ marginBottom: 10 }} />
          <Text style={styles.logoText}>Doctor Chat</Text>
          <Text style={styles.title}>Welcome Back</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!isLoading}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!isLoading}
          />

          <TouchableOpacity 
             style={[styles.loginBtn, isLoading && { opacity: 0.7 }]} 
             onPress={handleLogin}
             disabled={isLoading}
          >
            <Text style={styles.loginBtnText}>{isLoading ? "Logging in..." : "Log In"}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.footer} onPress={() => router.push('/register')}>
          <Text style={styles.footerText}>
            Don't have an account? <Text style={styles.linkText}>Sign up</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EFF6FF' },
  content: { flex: 1, padding: 24, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 32 },
  logoText: { fontSize: 22, fontWeight: 'bold', color: '#1E3A8A' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#1E3A8A' },
  card: { backgroundColor: 'white', borderRadius: 16, padding: 24, elevation: 4 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 12 },
  loginBtn: { backgroundColor: '#1E3A8A', paddingVertical: 14, borderRadius: 8, marginTop: 24, alignItems: 'center' },
  loginBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  footer: { marginTop: 32, alignItems: 'center' },
  footerText: { color: '#6B7280' },
  linkText: { color: '#1E3A8A', fontWeight: 'bold' }
});