import React from 'react';
import Skeleton from 'react-loading-skeleton';
import { useGetTasksState, useCompleteTask, useWatchOptionalVideo, useSkipCooldown } from '../../api/tasks.api';
import { useAuthStore } from '../../store/auth.store';
import { useUIStore } from '../../store/ui.store';
import { soundEffects } from '../../helpers/audio.helpers';
import { MILESTONE_REWARDS_FREE, MILESTONE_REWARDS_PREMIUM } from '../../qualification/login-streak/login-streak-engine';
import { useCountdown } from '../../hooks/useCountdown';

export default function TasksView() {
  const { data: tasksState, isLoading } = useGetTasksState();
  const completeTaskMutation = useCompleteTask();
  const watchOptionalVideoMutation = useWatchOptionalVideo();
  const skipCooldownMutation = useSkipCooldown();

  const tasks = tasksState?.tasks ?? [];
  const optionalVideosWatchedToday = tasksState?.optionalVideosWatchedToday ?? 0;
  const practiceMatchesUnlocked = tasksState?.practiceMatchesUnlocked ?? 0;
  const freeMatchesRemaining = tasksState?.freeMatchesRemaining ?? 0;
  const cooldownActive = tasksState?.cooldownActive ?? false;
  const cooldownSecondsLeft = tasksState?.cooldownSecondsLeft ?? 0;
  
  const cooldownTimer = useCountdown(cooldownSecondsLeft);

  const { loginStreak, user, claimStreakReward, updateUserStats } = useAuthStore();
  const { openRewardedAd, showToast } = useUIStore();

  const milestones = user?.isPremium ? MILESTONE_REWARDS_PREMIUM : MILESTONE_REWARDS_FREE;

  const handleTaskAction = (task: typeof tasks[0]) => {
    soundEffects.playButtonClick();
    if (task.isCompleted) return;

    if (task.type === 'MANDATORY_VIDEO_LOGIN' || task.type === 'MANDATORY_VIDEO_UNLOCK') {
      openRewardedAd({
        rewardType: 'TASK_UNLOCK',
        title: 'MANDATORY TASK VIDEO',
        subtitle: 'Watch video to complete daily task and earn points',
        rewardAmount: '+50 Points',
        onRewardGranted: () => {
          completeTaskMutation.mutate(task.id, {
            onSuccess: (data) => {
              updateUserStats(0, data.pointsEarned, false);
              showToast(`Completed task! +${data.pointsEarned} Points awarded`, 'success');
            }
          });
        },
      });
    } else if (task.type === 'WIN_MATCH') {
      showToast('Play a match in the Lobby to complete this task!', 'info');
    }
  };

  const handleWatchOptionalVideo = () => {
    soundEffects.playButtonClick();
    if (optionalVideosWatchedToday >= 5) {
      showToast('Daily optional video cap (5/5) reached for today', 'info');
      return;
    }

    openRewardedAd({
      rewardType: 'PRACTICE_MATCH',
      title: 'UNLOCK PRACTICE MATCH',
      subtitle: 'Watch 1 rewarded video to unlock 1 free practice match',
      rewardAmount: '+1 Practice Match',
      onRewardGranted: () => {
        watchOptionalVideoMutation.mutate(undefined, {
          onSuccess: () => showToast('Practice match unlocked!', 'success'),
        });
      },
    });
  };

  const handleCooldownSkip = () => {
    soundEffects.playButtonClick();
    openRewardedAd({
      rewardType: 'COOLDOWN_SKIP',
      title: 'SKIP 1-HOUR COOLDOWN',
      subtitle: 'Watch 1 rewarded video to unlock match instantly',
      rewardAmount: 'Instant Access',
      onRewardGranted: () => {
        skipCooldownMutation.mutate(undefined, {
          onSuccess: () => showToast('Match cooldown skipped!', 'success'),
        });
      },
    });
  };

  const handleClaimMilestone = (day: number) => {
    soundEffects.playButtonClick();
    const res = claimStreakReward(day);
    if (res.success) {
      showToast(
        res.rewardAirtimeNgn
          ? `🎉 Claimed ₦${res.rewardAirtimeNgn} Airtime bonus for Day ${day}!`
          : `🎉 Claimed Day ${day} milestone reward!`,
        'success'
      );
    } else {
      showToast(`Milestone for Day ${day} cannot be claimed yet`, 'info');
    }
  };

  if (isLoading || !loginStreak || !user) {
    return (
      <div className="flex-1 px-4 pt-2 pb-6 space-y-4">
        <div className="flex justify-between items-center">
          <div><Skeleton width={150} height={24} /><Skeleton width={100} height={12} /></div>
          <div className="text-right"><Skeleton width={60} height={12} /><Skeleton width={40} height={20} /></div>
        </div>
        <Skeleton height={140} className="rounded-2xl" />
        <Skeleton height={100} className="rounded-2xl" />
        <Skeleton height={180} className="rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar px-4 pt-2 pb-6 space-y-4 text-[#F5F5F0]">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bebas text-2xl tracking-wider text-white">DAILY TASKS &amp; STREAK</h2>
          <p className="text-xs text-[#9A9A9A]">Complete daily tasks to maintain qualification</p>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-[#9A9A9A] uppercase tracking-wider block">Points Balance</span>
          <span className="font-bebas text-xl text-[#00E676]">{user.points} PTS</span>
        </div>
      </div>

      {/* Cooldown Alert Banner (If Active) */}
      {cooldownActive && (
        <div className="bg-[#2D1A10] border border-[#FF5A36] rounded-xl p-3 flex items-center justify-between">
          <div>
            <span className="font-bold text-xs text-[#FF5A36] block">Match Cooldown: {cooldownTimer.formatted}</span>
            <span className="text-[11px] text-gray-300">Wait or watch 1 video to skip instantly</span>
          </div>
          <button
            onClick={handleCooldownSkip}
            disabled={skipCooldownMutation.isPending}
            className={`px-3 py-1.5 rounded-full text-black font-extrabold text-[11px] glow-orange cursor-pointer ${
               skipCooldownMutation.isPending ? 'bg-gray-500' : 'bg-[#FF5A36]'
            }`}
          >
            {skipCooldownMutation.isPending ? 'SKIPPING...' : 'SKIP COOLDOWN ⚡'}
          </button>
        </div>
      )}

      {/* Section 1: Daily Tasks List */}
      <section className="bg-[#1A1B1E] border border-[#303338] rounded-2xl p-3.5 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-[#2A2C31]">
          <span className="text-xs font-bold tracking-wider text-[#F2B705] uppercase">
            TODAY'S 4 TASKS (MAX 200 PTS)
          </span>
          <span className="text-xs text-[#9A9A9A] font-medium">
            {tasks.filter((t) => t.isCompleted).length} / 4 Done
          </span>
        </div>

        <div className="space-y-2">
          {tasks.map((task) => (
            <div
              key={task.id}
              className={`p-3 rounded-xl border flex items-center justify-between transition ${
                task.isCompleted
                  ? 'bg-[#0D2D1E]/40 border-[#00B85F]/40 text-gray-300'
                  : 'bg-[#111214] border-[#2A2C31] text-white hover:border-[#3a3e47]'
              }`}
            >
              <div className="flex items-center space-x-3">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    task.isCompleted
                      ? 'bg-[#00B85F] text-[#111214]'
                      : 'bg-[#23252a] text-[#9A9A9A] border border-[#34373e]'
                  }`}
                >
                  {task.isCompleted ? '✓' : task.progress}
                </div>
                <div>
                  <h4 className="text-xs font-semibold leading-snug">{task.title}</h4>
                  <span className="text-[10px] text-[#00E676] font-bold">+{task.points} Points</span>
                </div>
              </div>

              <button
                disabled={task.isCompleted || completeTaskMutation.isPending}
                onClick={() => handleTaskAction(task)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition cursor-pointer ${
                  task.isCompleted
                    ? 'bg-transparent text-[#00E676] cursor-default'
                    : 'bg-[#00B85F] hover:bg-[#009951] text-[#111214]'
                }`}
              >
                {task.isCompleted ? 'Claimed' : 'Start'}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Section 2: Rewarded Video Practice Match Slots (Daily Earn) */}
      <section className="bg-[#151824] border border-[#2b3044] rounded-2xl p-3.5 space-y-3">
        <div className="flex items-center justify-between pb-1 border-b border-[#2b3044]">
          <div>
            <h3 className="font-bebas text-lg text-white">REWARDED VIDEO (DAILY EARN)</h3>
            <p className="text-[11px] text-[#9A9A9A]">Up to 5 optional videos/day · Unlocks practice matches</p>
          </div>
          <div className="text-right">
            <span className="text-xs font-bold text-[#F2B705]">
              {optionalVideosWatchedToday} / 5
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <div className="text-xs text-gray-300">
            <p className="font-semibold">Practice Matches Available: {practiceMatchesUnlocked}</p>
            <p className="text-[10px] text-[#9A9A9A]">Feeds Day 30 qualification progress</p>
          </div>
          <button
            onClick={handleWatchOptionalVideo}
            disabled={optionalVideosWatchedToday >= 5 || watchOptionalVideoMutation.isPending}
            className={`px-3.5 py-2 rounded-full font-bold text-xs flex items-center space-x-1.5 cursor-pointer ${
              optionalVideosWatchedToday >= 5 || watchOptionalVideoMutation.isPending
                ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                : 'bg-[#FF5A36] text-[#111214] glow-orange'
            }`}
          >
            <span>▶ {watchOptionalVideoMutation.isPending ? 'Loading...' : 'Watch Video'}</span>
          </button>
        </div>
      </section>

      {/* Section 3: 20-Active-Day Rolling Window & Stepping Stones */}
      <section className="bg-[#1A1B1E] border border-[#00B85F]/30 rounded-2xl p-3.5 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-[#2A2C31]">
          <div>
            <span className="text-xs font-bold tracking-wider text-[#00E676] uppercase block">
              30-DAY ROLLING WINDOW PROGRESS
            </span>
            <span className="text-[11px] text-[#9A9A9A]">
              Personal window · 1 forgiven grace day · 20 days needed
            </span>
          </div>
          <span className="text-xs font-bold text-[#F2B705]">
            Day {loginStreak.currentStreakDays} / 30
          </span>
        </div>

        {/* Progress Bar */}
        <div>
          <div className="w-full bg-[#111214] h-2.5 rounded-full overflow-hidden border border-[#2A2C31]">
            <div
              className="bg-gradient-to-r from-[#009951] to-[#00E676] h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.min(100, (loginStreak.currentStreakDays / 30) * 100)}%`,
              }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-[#9A9A9A] mt-1">
            <span>Day 1</span>
            <span>Day 14 (₦30 Airtime)</span>
            <span>Day 20 (Qualified)</span>
            <span>Day 30</span>
          </div>
        </div>

        {/* Grace Day Notice */}
        <div className="bg-[#111214] p-2.5 rounded-xl border border-[#2A2C31] text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-base">{loginStreak.hasUsedGraceDay ? '⚠️' : '🛡️'}</span>
            <div>
              <span className="font-semibold text-white block">
                {loginStreak.hasUsedGraceDay ? 'Grace Day Consumed' : '1 Grace Day Available'}
              </span>
              <span className="text-[10px] text-[#9A9A9A]">
                {loginStreak.hasUsedGraceDay
                  ? 'A 2nd missed day will reset forward progress (earned rewards kept)'
                  : 'Miss 1 calendar day without resetting your streak progress'}
              </span>
            </div>
          </div>
        </div>

        {/* Milestone Cards */}
        <div className="space-y-2 pt-1">
          <span className="text-[11px] font-bold text-[#8E9297] tracking-wider uppercase block">
            STEPPING-STONE REWARDS
          </span>
          {milestones.map((m) => {
            const isUnlocked = loginStreak.currentStreakDays >= m.day;
            const isClaimed = loginStreak.claimedMilestones.includes(m.day);

            return (
              <div
                key={m.day}
                className="p-2.5 rounded-xl bg-[#111214] border border-[#2A2C31] flex items-center justify-between text-xs"
              >
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-[#F2B705]">Day {m.day} Milestone</span>
                    {m.amountNgn && (
                      <span className="text-[10px] bg-[#0D2D1E] text-[#00E676] px-1.5 py-0.2 rounded font-bold">
                        ₦{m.amountNgn} Airtime
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#9A9A9A] mt-0.5">{m.description}</p>
                </div>

                <button
                  disabled={!isUnlocked || isClaimed}
                  onClick={() => handleClaimMilestone(m.day)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition cursor-pointer ${
                    isClaimed
                      ? 'bg-transparent text-gray-500 cursor-default'
                      : isUnlocked
                      ? 'bg-[#F2B705] text-[#111214] shadow'
                      : 'bg-[#23252a] text-[#6F7278] cursor-not-allowed'
                  }`}
                >
                  {isClaimed ? 'Claimed ✓' : isUnlocked ? 'Claim' : 'Locked'}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
