import { useNavigate } from 'react-router-dom';
import routes from '../../config/routes.config';
import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { useGameStore } from '../../store/game.store';
import { useUIStore } from '../../store/ui.store';
import { useAuthStore } from '../../store/auth.store';
import { MatchMode } from '../../types/enums/whot.enums';
import { soundEffects } from '../../helpers/audio.helpers';

export default function MatchResultView() {
  const { activeMatch } = useGameStore();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const isPlayerWinner = activeMatch?.winner === 'PLAYER';

  useEffect(() => {
    if (isPlayerWinner) {
      soundEffects.playVictoryChime();
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.3 },
          colors: ['#00E676', '#F2B705', '#FF5A36', '#FFFFFF'],
        });
      } catch {
        // Fallback gracefully
      }
    }
  }, [isPlayerWinner]);

  const handlePlayAgain = () => {
    soundEffects.playButtonClick();
    navigate(routes.lobby); // Matchmaking is now handled in the lobby
  };

  const handleBackToLobby = () => {
    soundEffects.playButtonClick();
    navigate(routes.lobby);
  };

  return (
    <div className="flex-1 flex flex-col justify-between relative overflow-y-auto no-scrollbar px-5 pt-2 pb-4 text-[#F5F5F0]">
      {/* Background radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_25%,rgba(0,153,81,0.35)_0%,transparent_70%)] pointer-events-none -z-10" />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col" data-purpose="match-result-view">
        {/* BEGIN: Hero Celebration Area */}
        <section className="flex flex-col items-center mt-1 relative" data-purpose="hero-celebration">
          {/* Confetti SVG Fallback / Ambient Overlay */}
          <div className="absolute -top-3 w-full h-32 pointer-events-none flex justify-center items-center">
            <svg className="w-72 h-32" fill="none" viewBox="0 0 300 150">
              <rect fill="#00E676" height="4" opacity="0.9" rx="2" transform="rotate(35 50 25)" width="10" x="50" y="25" />
              <rect fill="#00E676" height="4" opacity="0.9" rx="2" transform="rotate(-30 250 30)" width="11" x="250" y="30" />
              <rect fill="#F2B705" height="4" opacity="0.95" rx="2" transform="rotate(-15 100 15)" width="8" x="100" y="15" />
              <rect fill="#F2B705" height="4" opacity="0.95" rx="2" transform="rotate(25 195 18)" width="9" x="195" y="18" />
              <rect fill="#FF5A36" height="3" opacity="0.85" rx="1.5" transform="rotate(15 70 60)" width="6" x="70" y="60" />
              <circle cx="95" cy="45" fill="#FFFFFF" opacity="0.7" r="2" />
              <circle cx="210" cy="40" fill="#FFFFFF" opacity="0.8" r="2.5" />
            </svg>
          </div>

          {/* Floating Golden Crown Icon */}
          <div className="relative mb-0.5 z-10 transform hover:scale-105 transition-transform duration-300">
            <svg className="w-16 h-12 gold-badge-glow" fill="none" viewBox="0 0 64 48">
              <path
                d="M6 38L12 16L24 28L32 10L40 28L52 16L58 38H6Z"
                fill="url(#crownGradientResult)"
                stroke="#FFE885"
                strokeLinejoin="round"
                strokeWidth="1.5"
              />
              <circle cx="12" cy="14" fill="#FFF2A3" r="3" />
              <circle cx="32" cy="8" fill="#FFF2A3" r="3.5" />
              <circle cx="52" cy="14" fill="#FFF2A3" r="3" />
              <path d="M6 38C6 40.2 7.8 42 10 42H54C56.2 42 58 40.2 58 38V37H6V38Z" fill="#D49300" />
              <defs>
                <linearGradient id="crownGradientResult" x1="32" x2="32" y1="8" y2="42" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#FFDD55" />
                  <stop offset="0.6" stopColor="#F2B705" />
                  <stop offset="1" stopColor="#B87700" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {/* Celebration Title & Subtitle */}
          <h2 className="font-bebas text-[52px] leading-none tracking-wider text-white win-glow text-center italic font-bold">
            {isPlayerWinner ? 'YOU WIN!' : 'GOOD TRY!'}
          </h2>
          <p className="text-[13.5px] text-[#A6ABB3] font-medium tracking-wide mt-1">
            {isPlayerWinner ? 'Great game! Keep it up!' : 'Keep practicing, your streak continues!'}
          </p>
        </section>
        {/* END: Hero Celebration Area */}

        {/* BEGIN: Versus Face-off Section */}
        <section className="mt-4 flex items-center justify-between px-2" data-purpose="player-vs-opponent">
          {/* Player: Winner */}
          <div className="flex flex-col items-center w-28">
            <div className="relative">
              {/* Mini Crown Badge for Winner */}
              {isPlayerWinner && (
                <div className="absolute -top-3 -left-1.5 z-20 transform -rotate-12">
                  <svg className="w-6 h-5 fill-[#F2B705] drop-shadow-sm" viewBox="0 0 24 24">
                    <path d="M2 18h20v2H2v-2zm1-8l4.5 4 4.5-7 4.5 7 4.5-4v7H3v-7z" />
                  </svg>
                </div>
              )}
              {/* Winner Avatar with Neon Ring */}
              <div className="w-18 h-18 rounded-full p-[2.5px] bg-[#00E676] avatar-glow">
                <img
                  alt={`${user?.username || 'Player'} Avatar`}
                  className="w-16 h-16 rounded-full object-cover border-2 border-[#111214]"
                  src={user?.avatarUrl || ''}
                />
              </div>
            </div>
            {/* Player Name & Online Status */}
            <span className="text-[14px] font-bold text-white mt-1.5">{user?.username || 'Player'}</span>
            <div className="flex items-center space-x-1 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-[#00E676] inline-block animate-pulse" />
              <span className="text-[11px] text-[#9A9A9A] font-medium">Online</span>
            </div>
            {/* Player Score Card */}
            <div className="w-full mt-2.5 py-1 px-3 bg-[#1A1B1E] border border-[#2A2C31] rounded-xl flex flex-col items-center shadow-inner">
              <span className="text-[20px] font-extrabold text-white leading-tight tracking-tight">
                {activeMatch?.playerFinalScore || 152}
              </span>
              <span className="text-[9px] font-bold text-[#6F7278] tracking-widest uppercase">
                SCORE
              </span>
            </div>
          </div>

          {/* Stylized "VS" Graphic Badge */}
          <div className="flex flex-col items-center justify-center px-1">
            <svg className="w-13 h-14" fill="none" viewBox="0 0 60 60">
              <path d="M12 18L22 42H28L38 18H31L25 34L19 18H12Z" fill="#00E676" />
              <path
                d="M42 22C38 22 35 24 35 27C35 32 46 30 46 36C46 39 42 41 38 41C34 41 31 39 30 37L28 41C31 43.5 35 44.5 38.5 44.5C45 44.5 49 41.5 49 35.5C49 30 38 31.5 38 26.5C38 24.5 40 23.5 42 23.5C45 23.5 47 24.5 48 26L51 22.5C49 20.5 46 19.5 42 19.5V22Z"
                fill="#00E676"
              />
            </svg>
          </div>

          {/* Opponent */}
          <div className="flex flex-col items-center w-28">
            <div className="relative">
              <div className="w-18 h-18 rounded-full p-[2.5px] bg-[#3A3D44]">
                <img
                  alt={`${activeMatch?.opponent.username || 'Opponent'} Avatar`}
                  className="w-16 h-16 rounded-full object-cover border-2 border-[#111214] grayscale-[20%]"
                  src={
                    activeMatch?.opponent.avatarUrl ||
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
                  }
                />
              </div>
            </div>
            <span className="text-[14px] font-bold text-white mt-1.5">
              {activeMatch?.opponent.username || 'ZainabX'}
            </span>
            <div className="flex items-center space-x-1 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-[#6F7278] inline-block" />
              <span className="text-[11px] text-[#9A9A9A] font-medium">Offline</span>
            </div>
            <div className="w-full mt-2.5 py-1 px-3 bg-[#1A1B1E] border border-[#2A2C31] rounded-xl flex flex-col items-center">
              <span className="text-[20px] font-extrabold text-[#D1D5DB] leading-tight tracking-tight">
                {activeMatch?.opponentFinalScore || 98}
              </span>
              <span className="text-[9px] font-bold text-[#6F7278] tracking-widest uppercase">
                SCORE
              </span>
            </div>
          </div>
        </section>
        {/* END: Versus Face-off Section */}

        {/* BEGIN: Match Rewards Card */}
        <section
          className="mt-4 bg-[#1A1B1E] border border-[#009951]/40 rounded-2xl p-3.5 shadow-lg relative overflow-hidden"
          data-purpose="match-rewards-card"
        >
          <div className="flex items-center space-x-2 pb-2.5">
            <svg className="w-5 h-5 text-[#F2B705] fill-current" viewBox="0 0 24 24">
              <path d="M19 4h-2V3a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v1H5a3 3 0 0 0-3 3v2a5 5 0 0 0 4.3 4.93A6 6 0 0 0 11 16.9V19H8a1 1 0 0 0 0 2h8a1 1 0 0 0 0-2h-3v-2.1a6 6 0 0 0 4.7-3.07A5 5 0 0 0 22 9V7a3 3 0 0 0-3-3zM4 9V7a1 1 0 0 1 1-1h2v4.1A3 3 0 0 1 4 9zm16 0a3 3 0 0 1-3 1.1V6h2a1 1 0 0 1 1 1v2z" />
            </svg>
            <span className="text-[12px] font-extrabold tracking-wider uppercase text-white">
              MATCH REWARDS
            </span>
          </div>

          <div className="grid grid-cols-2 divide-x divide-[#2D3036] items-center pt-1">
            {/* Left: XP Progression */}
            <div className="flex items-center space-x-3 pr-2">
              <div className="relative w-10 h-10 flex-shrink-0 flex items-center justify-center">
                <svg className="w-10 h-10" fill="none" viewBox="0 0 40 40">
                  <path d="M20 2L35 11V29L20 38L5 29V11L20 2Z" fill="#202226" stroke="#F2B705" strokeWidth="2" />
                </svg>
                <span className="absolute font-extrabold text-[10px] text-[#F2B705] tracking-tighter">XP</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[16px] font-black text-white leading-tight">
                  +{activeMatch?.xpEarned || 50} XP
                </span>
                <span className="text-[11px] text-[#9A9A9A] font-medium">Match Win</span>
              </div>
            </div>

            {/* Right: Star Points */}
            <div className="flex items-center space-x-3 pl-4">
              <div className="w-9 h-9 rounded-full bg-[#00B85F]/20 border border-[#00E676] flex items-center justify-center green-badge-glow flex-shrink-0">
                <svg className="w-5 h-5 text-[#00E676] fill-current" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </div>
              <div className="flex flex-col">
                <span className="text-[16px] font-black text-white leading-tight">
                  +{activeMatch?.pointsEarned || 20}
                </span>
                <span className="text-[11px] text-[#9A9A9A] font-medium">Points</span>
              </div>
            </div>
          </div>
        </section>
        {/* END: Match Rewards Card */}

        {/* BEGIN: Daily Task Progression Row */}
        <section
          onClick={() => navigate(routes.tasks)}
          className="mt-3 bg-[#1A1B1E] border border-[#2D3036] rounded-2xl p-3 flex items-center justify-between cursor-pointer hover:border-[#00B85F]/50 transition"
          data-purpose="daily-task-progression"
        >
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 flex items-center justify-center text-[#00E676]">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="6" />
                <circle cx="12" cy="12" r="2" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="text-[13px] font-bold text-white leading-snug">Daily Task Progress</span>
              <span className="text-[11px] text-[#8C9098]">1/2 matches completed</span>
            </div>
          </div>
          <svg className="w-5 h-5 text-[#6F7278]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" viewBox="0 0 24 24">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </section>
        {/* END: Daily Task Progression Row */}

        {/* BEGIN: Action CTA Buttons */}
        <div className="mt-4 flex flex-col space-y-2.5" data-purpose="action-buttons">
          <button
            onClick={handlePlayAgain}
            className="w-full py-3.5 px-6 rounded-full bg-[#00B85F] hover:bg-[#009951] text-[#111214] font-black text-[15px] tracking-wider uppercase transition shadow-lg flex items-center justify-center active:scale-[0.98] cursor-pointer"
            type="button"
          >
            PLAY AGAIN
          </button>
          <button
            onClick={handleBackToLobby}
            className="w-full py-3 px-6 rounded-full bg-[#111214] border border-[#00B85F] hover:bg-[#1A1B1E] text-white font-bold text-[14px] tracking-wide uppercase transition flex items-center justify-center active:scale-[0.98] cursor-pointer"
            type="button"
          >
            BACK TO LOBBY
          </button>
        </div>
        {/* END: Action CTA Buttons */}
      </main>
    </div>
  );
};
