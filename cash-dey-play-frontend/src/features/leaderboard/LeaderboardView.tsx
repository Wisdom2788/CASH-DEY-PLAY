import React, { useState } from 'react';
import Skeleton from 'react-loading-skeleton';
import { PlayerLeaderboardStanding } from '../../qualification/monthly-leaderboard/monthly-leaderboard-eligibility';
import { CommunityLeaderboardEntry } from '../../types/interfaces/leaderboard.types';
import { useAuthStore } from '../../store/auth.store';
import { soundEffects } from '../../helpers/audio.helpers';
import { useGetMonthlyGameLeaderboard } from '@/src/api/leaderboard.api';
import { useGetCommunityLeaderboard } from '@/src/api/leaderboard.api';

export default function LeaderboardView() {
  const [activeTab, setActiveTab] = useState<'GAME' | 'COMMUNITY'>('GAME');

  const { user } = useAuthStore();

  const { data: gameLeaderboard = [], isLoading: isGameLoading } = useGetMonthlyGameLeaderboard();

  const { data: communityLeaderboard = [], isLoading: isCommunityLoading } = useGetCommunityLeaderboard();

  const isLoading = activeTab === 'GAME' ? isGameLoading : isCommunityLoading;

  const handleTabChange = (tab: 'GAME' | 'COMMUNITY') => {
    soundEffects.playButtonClick();
    setActiveTab(tab);
  };

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar px-4 pt-2 pb-6 space-y-3.5 text-[#F5F5F0]">
      {/* Header */}
      <div>
        <h2 className="font-bebas text-2xl tracking-wider text-white">LEADERBOARDS &amp; PRIZES</h2>
        <p className="text-xs text-[#9A9A9A]">
          Skill-ranked monthly competition &amp; community builder track
        </p>
      </div>

      {/* Segmented Control Filter Tabs */}
      <div className="flex items-center p-1 bg-[#1A1B1E] border border-[#303338] rounded-xl">
        <button
          onClick={() => handleTabChange('GAME')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
            activeTab === 'GAME'
              ? 'bg-[#00B85F] text-[#111214] shadow'
              : 'text-[#9A9A9A] hover:text-white'
          }`}
        >
          🏆 Monthly Game (Top 100)
        </button>
        <button
          onClick={() => handleTabChange('COMMUNITY')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
            activeTab === 'COMMUNITY'
              ? 'bg-[#00B85F] text-[#111214] shadow'
              : 'text-[#9A9A9A] hover:text-white'
          }`}
        >
          👥 Community Builder
        </button>
      </div>

      {/* Tab 1: Monthly Game Leaderboard */}
      {activeTab === 'GAME' && (
        <div className="space-y-3">
          {/* Rules Banner */}
          <div className="bg-[#111214] border border-[#2A2C31] rounded-xl p-3 text-xs space-y-1">
            <div className="flex items-center justify-between text-[#F2B705] font-bold">
              <span>QUALIFICATION REQUIREMENTS</span>
              <span className="text-[10px] text-gray-400">Calendar Month Anchored</span>
            </div>
            <p className="text-[11px] text-[#A6ABB3]">
              Must complete daily tasks on <strong className="text-white">20 days</strong> AND win at least{' '}
              <strong className="text-white">15 matches</strong> in the month. Hard count: no grace day on this track!
            </p>
            <div className="text-[10px] text-gray-400 pt-1 border-t border-[#222428] flex justify-between">
              <span>Formula: win_rate × (matches ÷ 50)</span>
              <span className="text-[#00E676] font-semibold">Airtime Top-up Payouts</span>
            </div>
          </div>

          {/* User's Current Standing */}
          <div className="bg-[#0D2D1E] border border-[#00B85F] rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="font-bebas text-2xl text-[#F2B705]">#{user?.monthlyRank}</span>
              <div className="w-10 h-10 rounded-full border border-[#00B85F] overflow-hidden">
                <img alt="User" className="w-full h-full object-cover" src={user?.avatarUrl} />
              </div>
              <div>
                <span className="font-bold text-xs text-white block">{user?.username} (You)</span>
                <span className="text-[10px] text-[#00E676]">
                  {user?.matchesWonMonth} Wins · {user?.activeTaskDaysCount}/20 Task Days
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-[#A6ABB3] block">Status</span>
              <span className="text-xs font-bold text-[#00E676]">QUALIFIED ✓</span>
            </div>
          </div>

          {/* Leaderboard Table List */}
          <div className="bg-[#1A1B1E] border border-[#303338] rounded-2xl overflow-hidden">
            <div className="px-3 py-2.5 bg-[#141517] border-b border-[#2A2C31] grid grid-cols-12 text-[10px] font-bold text-[#8E9297] uppercase">
              <span className="col-span-2">RANK</span>
              <span className="col-span-5">PLAYER</span>
              <span className="col-span-2 text-center">WINS</span>
              <span className="col-span-3 text-right">SCORE</span>
            </div>

            {isLoading ? (
              <div className="divide-y divide-[#2A2C31]">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="px-3 py-2.5 grid grid-cols-12 items-center">
                    <div className="col-span-2"><Skeleton width={20} /></div>
                    <div className="col-span-5 flex items-center space-x-2">
                      <Skeleton circle width={24} height={24} />
                      <Skeleton width={80} />
                    </div>
                    <div className="col-span-2 text-center"><Skeleton width={20} /></div>
                    <div className="col-span-3 text-right">
                      <Skeleton width={40} /><br/><Skeleton width={30} height={8} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="divide-y divide-[#2A2C31]">
                {gameLeaderboard.map((player) => {
                  const isTop3 = (player.rank || 0) <= 3;
                  return (
                    <div
                      key={player.userId}
                      className="px-3 py-2.5 grid grid-cols-12 items-center text-xs hover:bg-[#202227] transition"
                    >
                      <div className="col-span-2 flex items-center space-x-1">
                        <span
                          className={`font-bebas text-base ${
                            player.rank === 1
                              ? 'text-[#F2B705]'
                              : player.rank === 2
                              ? 'text-gray-300'
                              : player.rank === 3
                              ? 'text-[#CD7F32]'
                              : 'text-[#9A9A9A]'
                          }`}
                        >
                          #{player.rank}
                        </span>
                        {isTop3 && <span>👑</span>}
                      </div>

                      <div className="col-span-5 flex items-center space-x-2 truncate">
                        <div className="w-6 h-6 rounded-full overflow-hidden bg-[#24272D] flex-shrink-0">
                          <img
                            alt="Avatar"
                            className="w-full h-full object-cover"
                            src={
                              player.avatarUrl ||
                              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=60&auto=format&fit=crop&q=80'
                            }
                          />
                        </div>
                        <span className="font-semibold text-white truncate text-xs">
                          {player.username}
                        </span>
                      </div>

                      <div className="col-span-2 text-center font-mono text-[11px] text-[#A6ABB3]">
                        {player.matchesWon}
                      </div>

                      <div className="col-span-3 text-right">
                        <span className="font-mono font-bold text-[#00E676] text-xs">
                          {player.weightedScore}
                        </span>
                        <span className="text-[9px] text-[#9A9A9A] block">
                          {(player.winRate * 100).toFixed(0)}% WR
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Community Builder Leaderboard */}
      {activeTab === 'COMMUNITY' && (
        <div className="space-y-3">
          <div className="bg-[#111214] border border-[#2A2C31] rounded-xl p-3 text-xs space-y-1">
            <div className="flex items-center justify-between text-[#7A2BE2] font-bold">
              <span>COMMUNITY BUILDER (REFERRAL) RULES</span>
              <span className="text-[10px] text-gray-400">Ordinary Users Only</span>
            </div>
            <p className="text-[11px] text-[#A6ABB3]">
              Ranked purely by qualifying invites. Zero chance, zero RNG.
              A referral qualifies once your friend completes all 3 daily tasks on{' '}
              <strong className="text-white">3 separate calendar days</strong> within 30 days.
            </p>
            <div className="text-[10px] text-[#00E676] pt-1 border-t border-[#222428]">
              Prize share: 1st Place (50%), 2nd Place (30%), 3rd Place (20%) of pool!
            </div>
          </div>

          {/* Community Leaderboard List */}
          <div className="bg-[#1A1B1E] border border-[#303338] rounded-2xl overflow-hidden">
            <div className="px-3 py-2.5 bg-[#141517] border-b border-[#2A2C31] grid grid-cols-12 text-[10px] font-bold text-[#8E9297] uppercase">
              <span className="col-span-2">RANK</span>
              <span className="col-span-5">MEMBER</span>
              <span className="col-span-2 text-center">INVITES</span>
              <span className="col-span-3 text-right">PRIZE SHARE</span>
            </div>

            <div className="divide-y divide-[#2A2C31]">
              {communityLeaderboard.map((item) => (
                <div
                  key={item.userId}
                  className="px-3 py-2.5 grid grid-cols-12 items-center text-xs hover:bg-[#202227] transition"
                >
                  <div className="col-span-2 font-bebas text-base text-[#F2B705]">
                    #{item.rank}
                  </div>
                  <div className="col-span-5 flex items-center space-x-2 truncate">
                    <div className="w-6 h-6 rounded-full overflow-hidden bg-[#24272D] flex-shrink-0">
                      <img alt="Avatar" className="w-full h-full object-cover" src={item.avatarUrl} />
                    </div>
                    <span className="font-semibold text-white truncate text-xs">
                      {item.username}
                    </span>
                  </div>
                  <div className="col-span-2 text-center font-mono font-bold text-white">
                    {item.qualifyingInviteCount}
                  </div>
                  <div className="col-span-3 text-right font-bold text-[#00E676] text-xs">
                    {item.prizePercent > 0 ? `${item.prizePercent}% Pool` : 'Top 20'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
