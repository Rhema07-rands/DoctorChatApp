import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../config';
import { authEvents } from './authEvents';

// Create a configured axios instance
export const api = axios.create({
    baseURL: `${API_BASE_URL}/api/`,
    headers: {
        'Content-Type': 'application/json',
    },
});

// INTERCEPTOR: Add the JWT Token to the Authorization header of every request
api.interceptors.request.use(
    async (config) => {
        try {
            const token = await SecureStore.getItemAsync('userToken');
            if (token && config.headers) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        } catch (error) {
            console.error('Error fetching token from SecureStore', error);
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// INTERCEPTOR: Handle Token Expiration (401 Unauthorized)
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (error.response?.status === 401) {
            console.warn('API 401 Unauthorized detected. Emitting auth event.');
            // The token has expired or is invalid.
            // We emit the event so UserContext can handle centralized logout/redirect
            authEvents.emitUnauthorized();
        }
        return Promise.reject(error);
    }
);
