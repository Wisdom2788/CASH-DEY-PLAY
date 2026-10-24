import { useNavigate } from 'react-router-dom';
import routes from '../../config/routes.config';
import React from 'react';
import { useAuthStore } from '../../store/auth.store';
import { useGetWalletBalance } from '../../api/wallet.api';
import Skeleton from 'react-loading-skeleton';

export default function ProfileView() {
  const { user, loginStreak } = useAuthStore();
  const { data: balanceData, isLoading: isLoadingBalance } = useGetWalletBalance();
  const balanceNgn = balanceData?.balanceNgn ?? 0;
  
  const navigate = useNavigate();

  if (!user || !loginStreak) return null;

  const winRatePercent =
    user.matchesPlayedMonth > 0
      ? ((user.matchesWonMonth / user.matchesPlayedMonth) * 100).toFixed(0)
      : '0';

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar px-4 pt-2 pb-6 space-y-4 text-[#F5F5F0]">
      {/* Header Profile Card */}
      <section className="bg-[#1A1B1E] border border-[#303338] rounded-2xl p-4 flex items-center space-x-3.5">
        <div className="relative">
          <div className="w-16 h-16 rounded-full p-[2px] glow-purple-ring bg-gradient-to-tr from-[#7A2BE2] via-[#b845ed] to-[#7A2BE2] flex items-center justify-center">
            {user.avatarUrl ? (
              <img
                alt={`${user.username || user.firstName || 'Player'} Avatar`}
                className="w-full h-full rounded-full object-cover border-2 border-[#111214]"
                src={user.avatarUrl}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <div className="w-full h-full rounded-full bg-[#1A1B1E] border-2 border-[#111214] flex items-center justify-center text-white font-bold text-xl">
                {(user.username || user.firstName || 'P').charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          {user.isPremium && (
            <div className="absolute -bottom-1 -right-1 bg-[#F2B705] text-[#111214] text-[9px] font-black px-1.5 py-0.5 rounded-full shadow">
              PRO
            </div>
          )}
        </div>

        <div className="flex-1">
          <div className="flex items-center space-x-2">
            <h3 className="font-bold text-base text-white">{user.username || user.firstName || 'Player'}</h3>
            {user.isPhoneVerified && (
              <span className="text-[10px] bg-[#0D2D1E] text-[#00E676] px-1.5 py-0.5 rounded border border-[#00B85F]/40 font-semibold">
                Verified ✓
              </span>
            )}
          </div>
          <p className="text-xs text-[#9A9A9A]">Telegram ID: {user.telegramId}</p>
          <div className="flex items-center space-x-3 mt-1 text-[11px] text-gray-300">
            <span>XP: <strong className="text-white">{user.xp}</strong></span>
            <span>·</span>
            <span>Points: <strong className="text-[#00E676]">{user.points}</strong></span>
          </div>
        </div>
      </section>

      {/* Wallet Shortcut Banner */}
      <section
        onClick={() => navigate(routes.wallet)}
        className="bg-[#0D2D1E] border border-[#00B85F] rounded-2xl p-3.5 flex items-center justify-between cursor-pointer hover:border-[#00FF66] transition active:scale-[0.99]"
      >
        <div>
          <span className="text-[10px] font-bold text-[#A6ABB3] uppercase tracking-wider block">
            AIRTIME WALLET
          </span>
          <div className="text-2xl font-black text-white">
            {isLoadingBalance ? <Skeleton width={80} baseColor="#1A1B1E" highlightColor="#2A2C31" /> : `₦${balanceNgn.toLocaleString()}`}
          </div>
          <p className="text-[11px] text-[#00E676] mt-0.5">Airtime redemption coming soon</p>
        </div>
        <div className="px-3.5 py-2 rounded-full bg-[#00B85F] text-[#111214] font-extrabold text-xs">
          Redeem Reward →
        </div>
      </section>

      {/* Match Stats Grid */}
      <section className="grid grid-cols-3 gap-2">
        <div className="bg-[#1A1B1E] border border-[#2A2C31] p-3 rounded-xl text-center">
          <span className="text-[10px] text-[#9A9A9A] uppercase tracking-wider block">Win Rate</span>
          <span className="font-bebas text-xl text-white">{winRatePercent}%</span>
        </div>
        <div className="bg-[#1A1B1E] border border-[#2A2C31] p-3 rounded-xl text-center">
          <span className="text-[10px] text-[#9A9A9A] uppercase tracking-wider block">Wins / Total</span>
          <span className="font-bebas text-xl text-[#00E676]">
            {user.matchesWonMonth}/{user.matchesPlayedMonth}
          </span>
        </div>
        <div className="bg-[#1A1B1E] border border-[#2A2C31] p-3 rounded-xl text-center">
          <span className="text-[10px] text-[#9A9A9A] uppercase tracking-wider block">Login Streak</span>
          <span className="font-bebas text-xl text-[#F2B705]">
            Day {loginStreak.currentStreakDays}
          </span>
        </div>
      </section>

      {/* Premium Subscription Card */}
      <section className="bg-gradient-to-br from-[#1C1A2E] to-[#12111E] border border-[#7A2BE2]/40 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-xl">👑</span>
            <h4 className="font-bebas text-lg text-white">CASH DEY PLAY PREMIUM</h4>
          </div>
          <span className="text-xs font-bold text-[#F2B705]">₦1,000 / month</span>
        </div>

        <p className="text-xs text-gray-300">
          No video ads, unlimited practice and premium cosmetics. Purchases are not available yet.
        </p>

        {!user.isPremium ? (
          <button
            disabled
            className="w-full py-2.5 rounded-full bg-gradient-to-r from-[#7A2BE2] to-[#5A1BB8] text-white font-bold text-xs uppercase tracking-wider opacity-50 cursor-not-allowed"
          >
            Premium coming soon
          </button>
        ) : (
          <div className="py-2 text-center text-xs font-bold text-[#00E676] bg-[#00B85F]/10 rounded-full border border-[#00B85F]/30">
            Active Premium Member ✓
          </div>
        )}
      </section>


    </div>
  );
};
