import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from './router';
import { ToastProvider } from './components/ToastProvider';
import './index.css';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import { authApi } from './api/auth.api';
import { useAuthStore } from './stores/auth.store';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

axios.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url?.includes('/auth/')) {
      originalRequest._retry = true;
      try {
        const res = await authApi.refresh();
        const accessToken = res.data.data.accessToken;
        const decoded: any = jwtDecode(accessToken);
        useAuthStore.getState().setTokens(accessToken, { id: decoded.sub, email: decoded.email });
        originalRequest.headers['Authorization'] = `Bearer ${accessToken}`;
        return axios(originalRequest);
      } catch {
        useAuthStore.getState().clearAuth();
        window.location.replace('/login');
      }
    }
    return Promise.reject(error);
  }
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <ToastProvider />
    </QueryClientProvider>
  </React.StrictMode>
);
