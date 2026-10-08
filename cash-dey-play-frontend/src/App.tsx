import React, { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AppRoute from './container/AppRoute';
import { LoadingScreen } from './components/shared/LoadingScreen';
import { useAuthStore } from './store/auth.store';
import { postService } from './api/client';
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
  const { setAuthData, token, clearAuth } = useAuthStore();
  const [isAppReady, setIsAppReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  // Initialize App and Auth
  useEffect(() => {
    // Check if Telegram WebApp SDK is available
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
        const response = await postService<
          { initData: string },
          { token: string; user: import('./types/interfaces/user.types').UserProfile }
        >('/auth/telegram/login', { initData }, { silent: true });

        setAuthData(response.user, response.token);
      } catch (err) {
        console.error('[App] Authentication failed:', err);
        setInitError("Authentication failed. Please reopen the app in Telegram.");
        clearAuth();
      }
    };

    authenticateUser();
  }, [setAuthData, clearAuth]);

  // Initialize Socket when authenticated
  useEffect(() => {
    if (token) {
      // Initialize socket connection using the auth token
      const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      initSocket(token, backendUrl);

      return () => {
        disconnectSocket();
      };
    }
  }, [token]);

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