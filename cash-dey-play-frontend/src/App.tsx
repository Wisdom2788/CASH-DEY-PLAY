import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AppRoute from './container/AppRoute';
import { LoadingScreen } from './components/shared/LoadingScreen';
import { useAuthStore } from './store/auth.store';
import { loginWithTelegram,recordServerLogin,fetchCapabilities } from './api/auth.api';
import { initSocket, disconnectSocket } from './config/socket.config';

import { SkeletonTheme } from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes cache
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  const { setAuthData, syncStreakState, token, clearAuth } = useAuthStore();
  const [isAppReady, setIsAppReady] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  const [realtimeAvailable,setRealtimeAvailable] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  // Initialize App and Auth
  useEffect(() => {
    // Check if Telegram WebApp SDK is available
    let cancelled = false;
    let initData = '';
    
    if (typeof window !== 'undefined' && (window as unknown as { Telegram?: { WebApp?: { initData: string, ready: () => void; expand: () => void } } }).Telegram?.WebApp) {
      try {
        const tg = (window as unknown as { Telegram: { WebApp: { initData: string, ready: () => void; expand: () => void } } }).Telegram.WebApp;
        tg.ready();
        tg.expand();
        initData = tg.initData;
      } catch (e) {
        console.error("Failed to initialize Telegram WebApp", e);
      }
    }



    const authenticateUser = async () => {
      try {
        setIsAuthenticating(true);
        const response = await loginWithTelegram(initData);
        if (cancelled) return;
        setAuthData(response.user, response.token);
        const streak = await recordServerLogin();
        if (cancelled) return;
        syncStreakState(streak);
        // Missing/old rules endpoint must not open sockets against an unbuilt server.
        try {
          const capabilities=await fetchCapabilities();
          if (!cancelled) setRealtimeAvailable(capabilities.features.realtime);
        } catch (error) { if (!axios.isAxiosError(error) || error.response?.status !== 404) throw error; }
      } catch {
        if (cancelled) return;
        setInitError('Could not load your account and login progress. Reopen the app in Telegram to retry.');
        clearAuth();
      } finally {
        if (!cancelled) setIsAuthenticating(false);
      }
    };

    void authenticateUser();
    return () => { cancelled = true; };
  }, [setAuthData, syncStreakState, clearAuth]);

  // Initialize Socket when authenticated — only if the backend has Socket.io set up
  useEffect(() => {
    if (token && realtimeAvailable) {
      const backendUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/api$/, '');
      try {
        initSocket(token, backendUrl);
      } catch (e) {
        // Socket.io server may not exist yet — not a fatal error
        console.warn('[App] Socket initialization skipped:', e);
      }

      return () => {
        disconnectSocket();
      };
    }
  }, [token,realtimeAvailable]);

  // Show loading while authenticating
  if (isAuthenticating) {
    return (
      <div className="flex justify-center items-start min-h-screen p-0 sm:py-4 select-none bg-[#0b0c0e]">
        <main className="w-full max-w-[390px] h-screen sm:h-[844px] max-h-[844px] bg-[#111214] whot-pattern relative overflow-hidden shadow-2xl sm:rounded-[44px] border-0 sm:border-[8px] sm:border-[#222429] flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#00B39E]"></div>
        </main>
      </div>
    );
  }

  if (initError) {
    return (
      <div className="flex justify-center items-center h-screen bg-[#0b0c0e] text-white">
        <p>{initError}</p>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SkeletonTheme baseColor="#1A1B1E" highlightColor="#2A2C31">
        {!isAppReady ? (
          <div className="flex justify-center items-start min-h-screen p-0 sm:py-4 select-none bg-[#0b0c0e]">
            <main className="w-full max-w-[390px] h-screen sm:h-[844px] max-h-[844px] bg-[#111214] whot-pattern relative overflow-hidden shadow-2xl sm:rounded-[44px] border-0 sm:border-[8px] sm:border-[#222429]">
              <LoadingScreen onComplete={() => setIsAppReady(true)} />
            </main>
          </div>
        ) : (
          <AppRoute />
        )}
      </SkeletonTheme>

    </QueryClientProvider>
  );
}