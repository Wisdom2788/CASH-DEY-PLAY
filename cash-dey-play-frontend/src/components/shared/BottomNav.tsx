import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import routes from '../../config/routes.config';
import { soundEffects } from '../../helpers/audio.helpers';

export const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  let activeNavTab = 'home';
  if (location.pathname === routes.home) activeNavTab = 'home';
  else if (location.pathname === routes.tasks) activeNavTab = 'tasks';
  else if (location.pathname === routes.lobby || location.pathname === routes.game || location.pathname === routes.result) activeNavTab = 'play';
  else if (location.pathname === routes.leaderboard) activeNavTab = 'leaderboard';
  else if (location.pathname === routes.profile || location.pathname === routes.wallet) activeNavTab = 'profile';

  const handleTabClick = (tab: 'home' | 'tasks' | 'play' | 'leaderboard' | 'profile') => {
    soundEffects.playButtonClick();
    if (tab === 'home') navigate(routes.home);
    else if (tab === 'tasks') navigate(routes.tasks);
    else if (tab === 'play') navigate(routes.lobby);
    else if (tab === 'leaderboard') navigate(routes.leaderboard);
    else if (tab === 'profile') navigate(routes.profile);
  };

  return (
    <nav
      className="w-full bg-[#111214] border-t border-[#303338]/80 select-none z-30 shrink-0"
      data-purpose="canonical-bottom-navigation"
    >
      <div className="h-[62px] px-2 flex items-center justify-around">
        {/* 1. Home */}
        <button
          onClick={() => handleTabClick('home')}
          className={`flex flex-col items-center justify-center w-14 h-full relative transition focus:outline-none ${
            activeNavTab === 'home' ? 'text-[#00B85F]' : 'text-[#9A9A9A] hover:text-[#F5F5F0]'
          }`}
          type="button"
        >
          <div className="relative flex items-center justify-center">
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
              <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
            </svg>
            {activeNavTab === 'home' && (
              <span className="absolute -inset-1 bg-[#00B85F]/20 blur-sm rounded-full -z-10" />
            )}
          </div>
          <span className="text-[10px] font-semibold mt-1 tracking-tight">Home</span>
        </button>

        {/* 2. Tasks */}
        <button
          onClick={() => handleTabClick('tasks')}
          className={`flex flex-col items-center justify-center w-14 h-full relative transition focus:outline-none ${
            activeNavTab === 'tasks' ? 'text-[#00B85F]' : 'text-[#9A9A9A] hover:text-[#F5F5F0]'
          }`}
          type="button"
        >
          <svg className="w-5 h-5 fill-none stroke-[2.2]" stroke="currentColor" viewBox="0 0 24 24">
            <path
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-[10px] font-medium mt-1 tracking-tight">Tasks</span>
        </button>

        {/* 3. Play (Hero Central Button with Orange Ring Glow) */}
        <button
          onClick={() => handleTabClick('play')}
          className="flex flex-col items-center justify-center relative -top-1 py-1 w-14 focus:outline-none group"
          type="button"
        >
          <div
            className={`w-11 h-11 rounded-full border-[2px] flex items-center justify-center bg-[#111214] transition-transform active:scale-95 ${
              activeNavTab === 'play'
                ? 'border-[#FF5A36] play-glow shadow-[0_0_12px_rgba(255,90,54,0.4)]'
                : 'border-[#303338] hover:border-[#FF5A36]/60'
            }`}
          >
            <svg
              className={`w-4 h-4 translate-x-0.5 ${
                activeNavTab === 'play'
                  ? 'fill-[#FF5A36] stroke-[#FF5A36]'
                  : 'fill-none stroke-[#9A9A9A] stroke-[2.2]'
              }`}
              viewBox="0 0 24 24"
            >
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </div>
          <span
            className={`text-[10px] font-bold tracking-tight mt-0.5 ${
              activeNavTab === 'play' ? 'text-[#FF5A36]' : 'text-[#9A9A9A]'
            }`}
          >
            Play
          </span>
        </button>

        {/* 4. Leaderboard / Ranks */}
        <button
          onClick={() => handleTabClick('leaderboard')}
          className={`flex flex-col items-center justify-center w-14 h-full relative transition focus:outline-none ${
            activeNavTab === 'leaderboard' ? 'text-[#00B85F]' : 'text-[#9A9A9A] hover:text-[#F5F5F0]'
          }`}
          type="button"
        >
          <svg className="w-5 h-5 fill-none stroke-[2.2]" stroke="currentColor" viewBox="0 0 24 24">
            <path
              d="M16 18v-8m-4 8V6m-4 12v-4m-2 4h12a2 2 0 002-2V4a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-[10px] font-medium mt-1 tracking-tight">Ranks</span>
        </button>

        {/* 5. Profile */}
        <button
          onClick={() => handleTabClick('profile')}
          className={`flex flex-col items-center justify-center w-14 h-full relative transition focus:outline-none ${
            activeNavTab === 'profile' ? 'text-[#00B85F]' : 'text-[#9A9A9A] hover:text-[#F5F5F0]'
          }`}
          type="button"
        >
          <svg className="w-5 h-5 fill-none stroke-[2.2]" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-[10px] font-medium mt-1 tracking-tight">Profile</span>
        </button>
      </div>

      {/* iOS Home Indicator Pill */}
      <div className="w-full pb-2 pt-0.5 flex justify-center items-center pointer-events-none">
        <div className="w-32 h-1 bg-white/30 rounded-full" />
      </div>
    </nav>
  );
};
