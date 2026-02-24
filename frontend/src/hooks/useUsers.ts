'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { User } from '@/types/user';

export function useUsers() {
  return useQuery<User[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const { data } = await apiClient.get('/users');
      return data;
    },
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dto: {
      name: string;
      email: string;
      password: string;
      role?: string;
    }) => {
      const { data } = await apiClient.post('/users', dto);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      dto,
    }: {
      id: string;
      dto: { name?: string; role?: string; isActive?: boolean; password?: string };
    }) => {
      const { data } = await apiClient.patch(`/users/${id}`, dto);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.delete(`/users/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}
export function usePendingPasswordResets() { return useQuery<any[]>({ queryKey: ['password-resets', 'pending'], queryFn: async () => { const { data } = await apiClient.get('/users/password-resets/pending'); return data; }, }); } export function useResolvePasswordReset() { const queryClient = useQueryClient(); return useMutation({ mutationFn: async (requestId: string) => { const { data } = await apiClient.post(`/users/password-resets/${requestId}/resolve`); return data; }, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['password-resets', 'pending'] }); }, }); }
