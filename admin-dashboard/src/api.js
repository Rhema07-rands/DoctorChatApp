import axios from 'axios';

const API_BASE = 'http://localhost:5050/api';

const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('admin_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

export const login = (email, password) =>
    api.post('/auth/login', { email, password });

export const getStats = () => api.get('/admin/stats');
export const getUsers = () => api.get('/admin/users');
export const getAppointments = () => api.get('/admin/appointments');
export const suspendUser = (id, isSuspended) =>
    api.patch(`/admin/user/${id}/suspend`, { isSuspended });

export default api;
