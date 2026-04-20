import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React, { useEffect, useState } from "react";
import { Keyboard, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAppointments } from "../_context/AppointmentContext";
import { useTheme } from "../_context/ThemeContext";
import { useUser } from "../_context/UserContext";

// ── Tab Configurations ──────────────────────────────────────────────────────

const DOCTOR_TABS = [
  { name: "Doctor_page/doctor_dashboard", title: "Home", iconFocused: "home", icon: "home-outline" },
  { name: "Doctor_page/doctor_chats", title: "Chats", iconFocused: "chatbubbles", icon: "chatbubbles-outline" },
  { name: "Doctor_page/appointments", title: "Schedule", iconFocused: "calendar", icon: "calendar-outline" },
  { name: "Doctor_page/consultations", title: "Consults", iconFocused: "medkit", icon: "medkit-outline" },
  { name: "Doctor_page/profile", title: "Account", iconFocused: "person", icon: "person-outline" },
];

const PATIENT_TABS = [
  { name: "Patient_page/patient_dashboard", title: "Home", iconFocused: "home", icon: "home-outline" },
  { name: "Patient_page/patient_chats", title: "Chats", iconFocused: "chatbubbles", icon: "chatbubbles-outline" },
  { name: "Patient_page/appointments", title: "Doctors", iconFocused: "calendar", icon: "calendar-outline" },
  { name: "Patient_page/prescriptions", title: "Rx", iconFocused: "medical", icon: "medical-outline" },
  { name: "Patient_page/profile", title: "Account", iconFocused: "person", icon: "person-outline" },
];

// ── Custom Tab Bar ──────────────────────────────────────────────────────────

function CustomTabBar({ state, navigation }: any) {
  const { userRole, unreadCount, refreshUnreadCount } = useUser();
  const { appointments, getActiveConsultations } = useAppointments();
  const { colors } = useTheme();
  // Safe filtering: fallback to empty array if context is briefly undefined
  const pendingCount = (appointments || []).filter(a => a.status === 'Pending').length;
  const activeConsultCount = getActiveConsultations().length;

  // Hide tab bar when keyboard is open
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  if (keyboardVisible) return null;

  // Deduce role from active route to survive hot-reloads where Context resets
  const activeRouteName = state.routes[state.index]?.name || "";
  const isPatientRoute = activeRouteName.startsWith("Patient_page");

  // Fallback to context if we somehow aren't sure
  const normalizedRole = userRole?.toLowerCase();
  const isPatient = isPatientRoute || normalizedRole === "patient";
  const tabs = isPatient ? PATIENT_TABS : DOCTOR_TABS;

  return (
    <View style={[barStyles.container, { backgroundColor: colors.tabBar, borderTopColor: colors.tabBorder }]}>
      {tabs.map((tab) => {
        const routeIndex = state.routes.findIndex((r: any) => r.name === tab.name);
        if (routeIndex === -1) return null;
        const isFocused = state.index === routeIndex;

        return (
          <TouchableOpacity
            key={tab.name}
            style={barStyles.tab}
            onPress={() => navigation.navigate(tab.name)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={(isFocused ? tab.iconFocused : tab.icon) as any}
              size={24}
              color={isFocused ? colors.tabIconActive : colors.tabIconInactive}
            />
            <Text style={[barStyles.label, { color: isFocused ? colors.tabIconActive : colors.tabIconInactive }]}>
              {tab.title}
            </Text>
            {tab.title === "Chats" && unreadCount > 0 && (
              <View style={barStyles.badge}>
                <Text style={barStyles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
            {tab.title === "Schedule" && !isPatient && pendingCount > 0 && (
              <View style={barStyles.badge}>
                <Text style={barStyles.badgeText}>{pendingCount > 9 ? '9+' : pendingCount}</Text>
              </View>
            )}
            {tab.title === "Consults" && !isPatient && activeConsultCount > 0 && (
              <View style={barStyles.badge}>
                <Text style={barStyles.badgeText}>{activeConsultCount > 9 ? '9+' : activeConsultCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Layout ──────────────────────────────────────────────────────────────────

export default function TabLayout() {
  const { userRole } = useUser();
  const isPatient = userRole?.toLowerCase() === 'patient';

  const patientScreens = [
    "Patient_page/patient_dashboard",
    "Patient_page/patient_chats",
    "Patient_page/appointments",
    "Patient_page/prescriptions",
    "Patient_page/profile"
  ];

  const doctorScreens = [
    "Doctor_page/doctor_dashboard",
    "Doctor_page/doctor_chats",
    "Doctor_page/appointments",
    "Doctor_page/consultations",
    "Doctor_page/profile"
  ];

  const orderedScreens = isPatient
    ? [...patientScreens, ...doctorScreens]
    : [...doctorScreens, ...patientScreens];

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
      backBehavior="history"
    >
      {orderedScreens.map((screenName) => (
        <Tabs.Screen key={screenName} name={screenName} />
      ))}
    </Tabs>
  );
}

const barStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    height: 75,
    paddingBottom: 20,
    paddingTop: 10,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    // Adding a slight shadow for a more modern look like your screenshot
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  label: {
    fontSize: 10,
    fontWeight: "600",
  },
  badge: {
    position: 'absolute',
    top: 5,
    right: '25%',
    backgroundColor: '#EF4444',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: 'white',
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
});