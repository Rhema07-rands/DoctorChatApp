import * as SecureStore from 'expo-secure-store';
import { api } from './api';

export const login = async (email: string, password: string) => {
    try {
        const response = await api.post('/auth/login', { email, password });

        // FIX: Backend may return `Token` (capital T) or `token` (lowercase).
        // Always check both casings before saving to SecureStore.
        const token = response.data.token || response.data.Token;
        const user = response.data.user || response.data.User;

        if (token) {
            await SecureStore.setItemAsync('userToken', token);
        }
        if (user) {
            await SecureStore.setItemAsync('userProfile', JSON.stringify(user));
        }

        // Return a normalised shape so callers don't need to check both casings
        return {
            ...response.data,
            token,
            user,
        };
    } catch (error: any) {
        console.log('Login raw error:', JSON.stringify(error.response?.data));
        console.log('Login status:', error.response?.status);
        console.log('Login message:', error.message);
        throw new Error(error.response?.data?.title || error.response?.data?.message || 'Login failed');
    }
};

export const logout = async () => {
    await SecureStore.deleteItemAsync('userToken');
};