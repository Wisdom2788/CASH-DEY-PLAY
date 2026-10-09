import { useNavigate } from 'react-router-dom';
import routes from '../../config/routes.config';
import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/auth.store';
import { useGetWalletBalance } from '../../api/wallet.api';
import { useGetTasksState } from '../../api/tasks.api';
import { useUIStore } from '../../store/ui.store';
import { soundEffects } from '../../helpers/audio.helpers';
import Skeleton from 'react-loading-skeleton';
import { useCountdown } from '../../hooks/useCountdown';

export default function HomeDashboard() {
  const { user, loginStreak, claimStreakReward } = useAuthStore();
  const { data: balanceData, isLoading: isLoadingBalance } = useGetWalletBalance();
  const { data: tasksState } = useGetTasksState();
  const { openRewardedAd, showToast } = useUIStore();
  const navigate = useNavigate();
  
  const balanceNgn = balanceData?.balanceNgn ?? 0;
  const initialTimeRemaining = tasksState?.timeRemainingSeconds ?? 22704;
  
  const { secondsLeft: localTimeRemaining, reset: resetTimer } = useCountdown(initialTimeRemaining);

  // Sync when API data updates
  useEffect(() => {
    if (tasksState) {
      resetTimer(tasksState.timeRemainingSeconds);
    }
  }, [tasksState, resetTimer]);

  if (!user) return null;

  // Safe defaults if loginStreak hasn't been fetched/initialized yet
  const streak = loginStreak ?? {
    currentStreakDays: 0,
    hasUsedGraceDay: false,
    claimedMilestones: [] as number[],
    windowStartDate: new Date().toISOString().slice(0, 10),
    lastLoginDate: new Date().toISOString().slice(0, 10),
    totalWindowDays: 30,
    isWindowCompleted: false,
    graceDayDate: null,
    history: [] as string[],
  };

  const tasks = tasksState?.tasks ?? [];
  const completedTaskCount = tasks.filter((t) => t.isCompleted).length;

  const formatCountdown = (totalSec: number) => {
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const handlePlayNow = () => {
    soundEffects.playButtonClick();
    navigate(routes.lobby);
  };

  const handleStreakMilestoneClick = (day: number) => {
    soundEffects.playButtonClick();
    if (streak.claimedMilestones.includes(day)) {
      showToast(`Day ${day} milestone already claimed!`, 'info');
      return;
    }
    if (streak.currentStreakDays >= day) {
      const res = claimStreakReward(day);
      if (res.success) {
        showToast(
          res.rewardAirtimeNgn
            ? `🎉 Claimed ₦${res.rewardAirtimeNgn} Airtime bonus for Day ${day}!`
            : `🎉 Claimed Day ${day} milestone reward!`,
          'success'
        );
      }
    } else {
      showToast(`Reach Day ${day} to unlock this milestone reward!`, 'info');
    }
  };

  const handleBoostRewards = () => {
    soundEffects.playButtonClick();
    openRewardedAd({
      rewardType: 'BOOST_POINTS',
      title: 'BOOST REWARDS',
      subtitle: 'Watch a 5s rewarded video to earn 50 reward points',
      rewardAmount: '+50 Points',
    });
  };

  // Streak days strip around day 14 (Days 8 to 17)
  const streakStripDays = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar px-4 pt-1 pb-4 text-[#F5F5F0]">
      {/* BEGIN: GreetingRow */}
      <section className="flex items-center justify-between mt-1 mb-3.5 px-1" data-purpose="user-greeting">
        <div>
          <p className="text-[13px] text-[#9A9A9A] font-medium">Good evening,</p>
          <div className="flex items-center gap-1.5">
            <h2 className="text-[22px] font-bold text-[#F5F5F0] tracking-tight">{user.username}</h2>
            <span className="text-xl">👋</span>
          </div>
        </div>

        {/* User Profile Avatar with glowing purple accent ring */}
        <div
          onClick={() => navigate(routes.profile)}
          className="relative cursor-pointer active:scale-95 transition"
        >
          <div className="w-13 h-13 rounded-full p-[2px] glow-purple-ring bg-gradient-to-tr from-[#7A2BE2] via-[#b845ed] to-[#7A2BE2]">
            <img
              alt={`${user.username}'s profile avatar`}
              className="w-12 h-12 rounded-full object-cover border-2 border-[#111214]"
              src={user.avatarUrl}
            />
          </div>
        </div>
      </section>
      {/* END: GreetingRow */}

      {/* BEGIN: StreakCard */}
      <section
        className="bg-[#0D2D1E] border border-[#00B85F]/30 rounded-[18px] p-3.5 mb-3 text-[#F5F5F0] shadow-sm relative overflow-hidden"
        data-purpose="streak-tracker-card"
      >
        {/* Streak Header */}
        <div
          onClick={() => navigate(routes.tasks)}
          className="flex items-center justify-between mb-1 cursor-pointer"
        >
          <span className="text-[11px] font-bold tracking-wider text-[#F2B705] uppercase">
            YOUR STREAK
          </span>
          <svg className="w-4 h-4 text-[#9A9A9A]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path d="M8.25 4.5l7.5 7.5-7.5 7.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {/* Streak Current Day Title & Grace State */}
        <div className="flex items-baseline justify-between mb-3">
          <div className="text-[20px] font-bold">
            Day{' '}
            <span className="text-[#F2B705] text-[23px] font-extrabold ml-0.5">
              {streak.currentStreakDays}
            </span>
          </div>
          <span className="text-[11px] text-[#78a58f] font-medium">
            {streak.hasUsedGraceDay ? 'Grace day used' : 'Grace day available'}
          </span>
        </div>

        {/* Streak Days Horizontal Strip */}
        <div className="flex items-center justify-between pt-0.5">
          {streakStripDays.map((dayNum) => {
            const isCompleted = dayNum < streak.currentStreakDays;
            const isCurrent = dayNum === streak.currentStreakDays;
            const isNext = dayNum === streak.currentStreakDays + 1;
            const isMilestone = dayNum === 14;

            if (isMilestone) {
              return (
                <button
                  key={dayNum}
                  onClick={() => handleStreakMilestoneClick(dayNum)}
                  title="Day 14 Milestone Reward"
                  className="w-7 h-7 rounded-full bg-[#F2B705] text-[#111214] font-bold flex items-center justify-center shadow-md text-[11px] active:scale-90 transition cursor-pointer"
                >
                  <span>👑</span>
                </button>
              );
            }

            if (isNext) {
              return (
                <div
                  key={dayNum}
                  className="w-7 h-7 rounded-full bg-[#0a482e] border-2 border-[#00B85F] flex items-center justify-center shadow-sm"
                >
                  <span className="text-[10px] font-bold text-[#00B85F]">🌿</span>
                </div>
              );
            }

            if (isCompleted || isCurrent) {
              return (
                <div
                  key={dayNum}
                  className="w-7 h-7 rounded-full bg-[#113a28] border border-[#1b4e37] flex items-center justify-center text-[11px] font-medium text-[#c0dec9]"
                >
                  {dayNum}
                </div>
              );
            }

            return (
              <div
                key={dayNum}
                className="w-7 h-7 rounded-full bg-[#15231c] border border-[#23352c] flex items-center justify-center text-[11px] text-[#71847a]"
              >
                {dayNum}
              </div>
            );
          })}
        </div>
      </section>
      {/* END: StreakCard */}

      {/* BEGIN: StatsGrid */}
      <section className="grid grid-cols-2 gap-2.5 mb-2.5" data-purpose="primary-stats-grid">
        {/* Left: Wallet (Airtime & Data) */}
        <article
          onClick={() => navigate(routes.wallet)}
          className="bg-[#1A1B1E] border border-[#303338] rounded-[16px] p-3.5 flex flex-col justify-between h-[104px] cursor-pointer hover:border-[#00B85F]/50 transition active:scale-[0.99]"
        >
          <div>
            <h3 className="text-[10px] font-semibold text-[#9A9A9A] tracking-wider uppercase">
              WALLET (AIRTIME &amp; DATA)
            </h3>
          </div>
          <div className="flex items-end justify-between">
            <div>
              <div className="text-[22px] font-bold tracking-tight text-[#F5F5F0] leading-none mb-1">
                {isLoadingBalance ? <Skeleton width={50} height={22} baseColor="#1A1B1E" highlightColor="#2A2C31"/> : `₦${balanceNgn.toLocaleString()}`}
              </div>
              <p className="text-[10.5px] text-[#9A9A9A]">Airtime &amp; Data Balance</p>
            </div>
            {/* Telecom Stepped Signal Bars */}
            <div aria-label="Signal strong" className="flex items-end space-x-[2.5px] pb-1">
              <div className="w-1.5 h-2 bg-[#00B85F] rounded-[1px]" />
              <div className="w-1.5 h-3.5 bg-[#00B85F] rounded-[1px]" />
              <div className="w-1.5 h-5 bg-[#00B85F] rounded-[1px]" />
              <div className="w-1.5 h-6.5 bg-[#00B85F] rounded-[1px]" />
            </div>
          </div>
        </article>

        {/* Right: Daily Tasks */}
        <article
          onClick={() => navigate(routes.tasks)}
          className="bg-[#1A1B1E] border border-[#303338] rounded-[16px] p-3.5 flex flex-col justify-between h-[104px] cursor-pointer hover:border-[#00B85F]/50 transition active:scale-[0.99]"
        >
          <div>
            <h3 className="text-[10px] font-semibold text-[#9A9A9A] tracking-wider uppercase">
              DAILY TASKS
            </h3>
          </div>
          <div>
            <div className="flex items-baseline space-x-1 mb-1 leading-none">
              <span className="text-[21px] font-bold text-[#F5F5F0]">{completedTaskCount}</span>
              <span className="text-[17px] text-[#9A9A9A]">/</span>
              <span className="text-[21px] font-bold text-[#F5F5F0]">4</span>
              <span className="text-[11px] text-[#9A9A9A] font-medium ml-1">Completed</span>
            </div>
            <div className="flex items-center text-[10.5px] text-[#9A9A9A] whitespace-nowrap">
              <span>New tasks in</span>
              <div className="ml-1.5 inline-flex items-center bg-[#23252a] px-1.5 py-0.5 rounded border border-[#34373e]">
                <span className="text-[9px] mr-1">🕒</span>
                <span className="font-mono text-[#F2B705] font-semibold text-[10px] tracking-tight">
                  {formatCountdown(localTimeRemaining)}
                </span>
              </div>
            </div>
          </div>
        </article>
      </section>
      {/* END: StatsGrid */}

      {/* BEGIN: PerformanceGrid */}
      <section className="grid grid-cols-2 gap-2.5 mb-3" data-purpose="leaderboard-trend-grid">
        {/* Rank Card */}
        <article
          onClick={() => navigate(routes.leaderboard)}
          className="bg-[#1A1B1E] border border-[#303338] rounded-[16px] p-3.5 flex flex-col justify-between h-[86px] cursor-pointer hover:border-[#00B85F]/50 transition active:scale-[0.99]"
        >
          <h3 className="text-[10.5px] font-semibold text-[#9A9A9A] tracking-wider uppercase">
            RANK THIS MONTH
          </h3>
          <div className="flex items-center justify-between">
            <div className="leading-tight">
              <div className="text-[22px] font-bold text-[#F5F5F0]">#{user.monthlyRank}</div>
              <span className="text-[11px] text-[#9A9A9A]">Top 100</span>
            </div>
            {/* Green Rank Arrow Up */}
            <div className="text-[#00B85F]">
              <svg className="w-6 h-6 stroke-[3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M12 19V5m0 0l-5 5m5-5l5 5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </article>

        {/* Trend Card */}
        <article className="bg-[#1A1B1E] border border-[#303338] rounded-[16px] p-3.5 flex flex-col justify-between h-[86px]">
          <h3 className="text-[10.5px] font-semibold text-[#9A9A9A] tracking-wider uppercase">
            TREND
          </h3>
          <div>
            <div className="text-[21px] font-bold text-[#F5F5F0] leading-tight flex items-center space-x-1">
              <span className="text-white text-[18px]">↑</span>
              <span>{user.monthlyTrend}</span>
            </div>
            <span className="text-[11px] text-[#9A9A9A]">From last week</span>
          </div>
        </article>
      </section>
      {/* END: PerformanceGrid */}

      {/* BEGIN: PrimaryCTA */}
      <section className="mb-3" data-purpose="primary-action-button">
        <button
          onClick={handlePlayNow}
          className="w-full h-[50px] bg-[#FF5A36] hover:bg-[#ff6947] active:scale-[0.98] transition-transform duration-100 rounded-full flex items-center justify-center font-extrabold text-[15px] tracking-wider text-[#111214] glow-orange shadow-lg cursor-pointer font-bebas text-lg"
          type="button"
        >
          PLAY NOW
        </button>
      </section>
      {/* END: PrimaryCTA */}

      {/* BEGIN: BoostRewardsCard */}
      <section
        onClick={handleBoostRewards}
        className="bg-[#151824] border border-[#2b3044] rounded-[16px] p-3 flex items-center justify-between shadow-sm cursor-pointer hover:border-[#F2B705]/50 transition active:scale-[0.99]"
        data-purpose="reward-boost-container"
      >
        <div className="flex items-center space-x-3">
          {/* Game Boost Emblem Badge */}
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#203666] to-[#121c33] border border-[#3b5998] flex items-center justify-center text-lg shadow-inner">
            <span className="font-black text-[15px] bg-clip-text text-transparent bg-gradient-to-r from-[#ff9f43] to-[#ff5252]">
              S
            </span>
          </div>
          {/* Description */}
          <div className="leading-tight">
            <h4 className="text-[12.5px] font-bold text-[#F5F5F0] tracking-wide">BOOST REWARDS</h4>
            <p className="text-[11px] text-[#9A9A9A]">Watch video &amp; earn rewards</p>
          </div>
        </div>
        {/* Reward Claim Pill */}
        <div className="flex items-center space-x-1 px-3 py-1.5 rounded-full border border-[#f2b705]/50 bg-[#292212] text-[#F2B705]">
          <span className="text-xs">⚡</span>
          <span className="text-[12.5px] font-bold tracking-tight">+50</span>
        </div>
      </section>
      {/* END: BoostRewardsCard */}
    </div>
  );
};
