import Constants from 'expo-constants';

// Backend port
const PORT = 5050;

// Helper to get local IP dynamically from Expo's dev server hostname
const getLocalIp = () => {
    if (__DEV__) {
        const debuggerHost = Constants.expoConfig?.hostUri;
        if (debuggerHost) {
            // debuggerHost is usually something like "10.1.72.157:8081"
            return debuggerHost.split(':')[0];
        }
    }
    return 'localhost'; 
};

const LOCAL_IP = getLocalIp();

// ⚠️ We MUST use the explicit LOCAL_IP for Android here, 
// because Physical Android devices over LAN cannot resolve 10.0.2.2 (which is only for Emulators).
export const API_BASE_URL = __DEV__
    ? `http://${LOCAL_IP}:${PORT}`
    : 'https://doctorchatapi.onrender.com'; // Render.com deployment URL

// WEB RTC / TURN SERVER CONFIGURATION
export const METERED_TURN_URL = `${API_BASE_URL}/api/calls/turn-credentials`;
