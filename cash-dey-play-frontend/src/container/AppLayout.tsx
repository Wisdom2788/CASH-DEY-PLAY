import React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import routes from '../config/routes.config';
import { StatusBar } from '../components/shared/StatusBar';
import { TelegramHeader } from '../components/shared/TelegramHeader';
import { BottomNav } from '../components/shared/BottomNav';
import { RewardedAdModal } from '../components/shared/RewardedAdModal';
import { ErrorBoundary } from '../components/shared/ErrorBoundary';

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  const getHeaderTitle = () => {
    switch (location.pathname) {
      case routes.lobby: return 'Matchmaking Lobby';
      case routes.game: return 'Cash Dey Play';
      case routes.result: return 'Cash Dey Play';
      case routes.tasks: return 'Tasks & Streak';
      case routes.leaderboard: return 'Leaderboards';
      case routes.profile: return 'Player Profile';
      case routes.wallet: return 'Airtime Wallet';
      default: return 'Cash Dey Play';
    }
  };

  return (
    <div className="flex justify-center items-start min-h-screen p-0 sm:py-4 select-none bg-[#0b0c0e]">
      <main className="w-full max-w-[390px] h-screen sm:h-[844px] max-h-[844px] bg-[#111214] whot-pattern relative overflow-hidden flex flex-col justify-between shadow-2xl sm:rounded-[44px] border-0 sm:border-[8px] sm:border-[#222429]">
        <StatusBar />
        <TelegramHeader
          title={getHeaderTitle()}
          showBack={location.pathname !== routes.home}
          onBack={() => {
            if (location.pathname === routes.game) {
              if (window.confirm('Leave match and return to lobby?')) {
                navigate(routes.lobby);
              }
            } else if (location.pathname === routes.result || location.pathname === routes.lobby) {
              navigate(routes.home);
            } else {
              navigate(routes.home);
            }
          }}
        />
        <div className="flex-1 overflow-hidden flex flex-col relative">
          <ErrorBoundary>
            <React.Suspense fallback={
              <div className="h-full w-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#00B39E]"></div>
              </div>
            }>
              <Outlet />
            </React.Suspense>
          </ErrorBoundary>
        </div>
        <BottomNav />
        <RewardedAdModal />
        
        {/* Toast Container Wrapper to limit it inside the phone layout */}
        <div className="absolute inset-0 pointer-events-none z-[99999]">
          <ToastContainer
            position="top-center"
            autoClose={3000}
            hideProgressBar={false}
            newestOnTop
            closeOnClick
            pauseOnFocusLoss={false}
            draggable
            pauseOnHover
            theme="dark"
            toastStyle={{
              background: '#1A1B1E',
              border: '1px solid #303338',
              borderRadius: '12px',
              color: '#F5F5F0',
              fontSize: '13px',
              fontWeight: 500,
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              margin: '12px',
              pointerEvents: 'auto',
            }}
            className="!absolute !w-full !max-w-[390px] !left-1/2 !-translate-x-1/2 !top-0 !px-3"
          />
        </div>
      </main>
    </div>
  );
}
