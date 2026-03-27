import Constants from 'expo-constants';
import { isDevice } from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { api } from './api';

export const notificationService = {
    registerForPushNotificationsAsync: async () => {
        let token;

        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'default',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#FF231F7C',
            });
        }

        if (isDevice) {
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;
            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }
            if (finalStatus !== 'granted') {
                console.log('Failed to get push token for push notification!');
                return;
            }

            try {
                const projectId =
                    Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;

                if (!projectId) {
                    console.error("Project ID not found! Make sure you have 'eas.json' and 'app.json' configured.");
                    return;
                }

                token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
                console.log('Expo Push Token:', token);

                // FIX: Guard the backend registration call behind an auth check.
                // This function may be called at app startup (e.g. from a layout or
                // context) before the user has logged in. Without this guard, the
                // api.post fires with no Authorization header and the backend returns
                // 401 — even though the Expo token itself was fetched successfully.
                //
                // We only send the token to the backend if a JWT is already stored,
                // meaning the user is authenticated. If they aren't logged in yet,
                // the token will be registered when login.tsx calls this function
                // after SecureStore.setItemAsync('userToken', ...) succeeds.
                const authToken = await SecureStore.getItemAsync('userToken');
                if (!authToken) {
                    console.log('Push token obtained but user not logged in — skipping backend registration until login.');
                    return token;
                }

                await api.post('/notifications/register-token', { token });
                console.log('Push token registered with backend successfully.');
            } catch (error) {
                console.error('Error generating or registering push token:', error);
            }
        } else {
            console.log('Must use physical device for Push Notifications');
        }

        return token;
    },
};