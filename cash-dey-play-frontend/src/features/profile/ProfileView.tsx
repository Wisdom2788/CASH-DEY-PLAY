import { useNavigate } from 'react-router-dom';
import routes from '../../config/routes.config';
import React from 'react';
import { useAuthStore } from '../../store/auth.store';
import { useGetWalletBalance } from '../../api/wallet.api';
import { useSubscribePremium } from '../../api/premium.api';
import { useUIStore } from '../../store/ui.store';
import { soundEffects } from '../../helpers/audio.helpers';
import Skeleton from 'react-loading-skeleton';

export default function ProfileView() {
  const { user, loginStreak } = useAuthStore();
  const { data: balanceData, isLoading: isLoadingBalance } = useGetWalletBalance();
  const balanceNgn = balanceData?.balanceNgn ?? 0;
  
  const subscribePremiumMutation = useSubscribePremium();
  const { showToast } = useUIStore();
  const navigate = useNavigate();

  const handleUpgradePremium = () => {
    soundEffects.playButtonClick();
    subscribePremiumMutation.mutate(undefined, {
      onSuccess: () => {
        soundEffects.playVictoryChime();
        showToast('👑 Upgraded to Premium! Enjoy ad-free and exclusive cosmetics.', 'success');
        // A real app would then invalidate the user query or update the store here,
        // which the api client setup typically handles via onSuccess invalidation.
      },
      onError: () => {
        showToast('Failed to upgrade to Premium. Please try again.', 'error');
      }
    });
  };

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
          <div className="w-16 h-16 rounded-full p-[2px] glow-purple-ring bg-gradient-to-tr from-[#7A2BE2] via-[#b845ed] to-[#7A2BE2]">
            <img
              alt={`${user.username} Avatar`}
              className="w-full h-full rounded-full object-cover border-2 border-[#111214]"
              src={user.avatarUrl}
            />
          </div>
          {user.isPremium && (
            <div className="absolute -bottom-1 -right-1 bg-[#F2B705] text-[#111214] text-[9px] font-black px-1.5 py-0.5 rounded-full shadow">
              PRO
            </div>
          )}
        </div>

        <div className="flex-1">
          <div className="flex items-center space-x-2">
            <h3 className="font-bold text-base text-white">{user.username}</h3>
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
            AIRTIME &amp; DATA WALLET
          </span>
          <div className="text-2xl font-black text-white">
            {isLoadingBalance ? <Skeleton width={80} baseColor="#1A1B1E" highlightColor="#2A2C31" /> : `₦${balanceNgn.toLocaleString()}`}
          </div>
          <p className="text-[11px] text-[#00E676] mt-0.5">Instant top-up to MTN, Airtel, Glo, 9mobile</p>
        </div>
        <div className="px-3.5 py-2 rounded-full bg-[#00B85F] text-[#111214] font-extrabold text-xs">
          Cashout →
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
          Ad-free experience, unlimited unranked practice matches, exclusive card backs &amp; titles.
        </p>

        {/* Legal design constraint guarantee */}
        <div className="bg-[#111214]/80 p-2.5 rounded-xl border border-[#303338] text-[10px] text-gray-400 space-y-1">
          <span className="font-bold text-[#00E676] block">✓ STRICT LEGAL COMPLIANCE GUARANTEE</span>
          <p>
            Premium never touches card RNG, match odds, or leaderboard eligibility. Convenience and cosmetics only.
          </p>
        </div>

        {!user.isPremium ? (
          <button
            onClick={handleUpgradePremium}
            disabled={subscribePremiumMutation.isPending}
            className="w-full py-2.5 rounded-full bg-gradient-to-r from-[#7A2BE2] to-[#5A1BB8] text-white font-bold text-xs uppercase tracking-wider active:scale-95 transition cursor-pointer disabled:opacity-50"
          >
            {subscribePremiumMutation.isPending ? 'Upgrading...' : 'Upgrade to Premium (₦1,000)'}
          </button>
        ) : (
          <div className="py-2 text-center text-xs font-bold text-[#00E676] bg-[#00B85F]/10 rounded-full border border-[#00B85F]/30">
            Active Premium Member ✓
          </div>
        )}
      </section>

      {/* Section 4: Non-Gambling Legal Guardrails */}
      <section className="bg-[#111214] border border-[#2A2C31] rounded-2xl p-3.5 space-y-2 text-xs">
        <h4 className="font-bold text-white text-[11px] uppercase tracking-wider text-[#A6ABB3]">
          ⚖️ REGULATORY COMPLIANCE ARCHITECTURE
        </h4>
        <div className="space-y-1.5 text-[11px] text-[#A6ABB3]">
          <p>
            • <strong>No Consideration + Chance + Prize:</strong> No cash entry fees. Free-to-play with rewarded ad margin.
          </p>
          <p>
            • <strong>Airtime / Data Top-up Only:</strong> No bank cash withdrawals or withdrawal KYC.
          </p>
          <p>
            • <strong>Server-Authoritative Match Logic:</strong> Every Whot move validated server-side.
          </p>
          <p>
            • <strong>Skill-Ranked Leaderboard:</strong> Ranked by weighted win rate and sustained consistency.
          </p>
        </div>
      </section>
    </div>
  );
};
