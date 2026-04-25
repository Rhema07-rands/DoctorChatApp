import axios from 'axios';

const API_BASE = import.meta.env.MODE === 'development' 
    ? 'http://localhost:5050/api' 
    : 'https://doctorchatappwebservice.onrender.com/api';

console.log("API_BASE configured as:", API_BASE);

const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('admin_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// New: Handle token expiration/errors globally
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            console.warn("Unauthorized! Clearing token...");
            localStorage.removeItem('admin_token');
            window.location.href = '/'; // Force redirect to login
        }
        return Promise.reject(error);
    }
);

export const login = (email, password) => {
    console.log("Attempting login for:", email);
    return api.post('/auth/login', { email, password });
};

export const getStats = () => {
    console.log("Fetching stats...");
    return api.get('/admin/stats');
};

export const getUsers = () => api.get('/admin/users');
export const getAppointments = () => api.get('/admin/appointments');
export const suspendUser = (id, isSuspended) =>
    api.patch(`/admin/user/${id}/suspend`, { isSuspended });

export default api;
