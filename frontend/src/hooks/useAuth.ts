'use client';

import { useAuthStore } from '@/stores/authStore';
import apiClient from '@/lib/api-client';

export function useAuth() {
  const { user, token, setAuth, logout, hydrate } = useAuthStore();

  const login = async (email: string, password: string) => {
    const response = await apiClient.post('/auth/login', { email, password });
    setAuth(response.data.user, response.data.token);
    return response.data;
  };

  const getMe = async () => {
    const response = await apiClient.get('/auth/me');
    return response.data;
  };

  return {
    user,
    token,
    login,
    logout,
    getMe,
    hydrate,
    isAuthenticated: !!token,
  };
}
