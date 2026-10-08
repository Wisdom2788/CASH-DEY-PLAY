import { useNavigate } from 'react-router-dom';
import routes from '../../config/routes.config';
import React, { useEffect, useState } from 'react';
import { useGameStore } from '../../store/game.store';
import { useGetRecentOpponents, useStartMatch } from '../../api/match.api';
import { useUIStore } from '../../store/ui.store';
import { useAuthStore } from '../../store/auth.store';
import { MatchMode } from '../../types/enums/whot.enums';
import { soundEffects } from '../../helpers/audio.helpers';
import Skeleton from 'react-loading-skeleton';

export default function MatchmakingLobby() {
  const { isSearching, setSearching, syncMatchState } = useGameStore();
  const { showToast } = useUIStore();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  const { data: recentOpponents = [], isLoading: isLoadingOpponents } = useGetRecentOpponents();
  const startMatchMutation = useStartMatch();

  const handleSelectMode = (mode: MatchMode) => {
    soundEffects.playButtonClick();
    setSearching(true);
    
    startMatchMutation.mutate(
      { mode },
      {
        onSuccess: (matchState) => {
          syncMatchState(matchState);
          setSearching(false);
          navigate(routes.game);
        },
        onError: () => {
          setSearching(false);
          showToast('Failed to find a match. Please try again.', 'error');
        }
      }
    );
  };

  const handleRematch = (opponentId: string) => {
    soundEffects.playButtonClick();
    setSearching(true);

    startMatchMutation.mutate(
      { mode: MatchMode.QUICK, opponentId },
      {
        onSuccess: (matchState) => {
          syncMatchState(matchState);
          setSearching(false);
          navigate(routes.game);
        },
        onError: () => {
          setSearching(false);
          showToast('Failed to start rematch.', 'error');
        }
      }
    );
  };

  const handleInviteFriends = () => {
    soundEffects.playButtonClick();
    navigator.clipboard?.writeText(
      `Join me on Cash Dey Play! Play Whot and earn airtime: https://t.me/CashDeyPlayBot?start=${user?.referralCode}`
    );
    showToast('Telegram invite link copied! Share with friends.', 'success');
  };

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar px-4 pt-1 pb-6 space-y-3.5 flex flex-col text-[#F5F5F0]">
      {/* Screen Main Heading */}
      <div className="text-center pt-1 pb-1">
        <h2 className="font-bebas text-[29px] leading-tight text-[#F5F5F0] tracking-wider uppercase">
          CHOOSE HOW TO PLAY
        </h2>
      </div>

      {/* BEGIN: MatchModeCards */}
      {/* Mode 1: Quick Match */}
      <button
        onClick={() => handleSelectMode(MatchMode.QUICK)}
        disabled={isSearching}
        className="w-full h-[66px] rounded-[18px] bg-gradient-to-r from-[#FF5A36] to-[#FF3D12] p-4 flex items-center justify-between shadow-md active:scale-[0.985] transition-transform text-left cursor-pointer glow-orange disabled:opacity-75 disabled:cursor-not-allowed"
        type="button"
      >
        <div className="flex items-center space-x-3.5">
          <div className="w-9 h-9 flex items-center justify-center flex-shrink-0">
            <svg className="w-8 h-8 fill-white" viewBox="0 0 24 24">
              <path d="M13 2L4 14h6v8l9-12h-6l2-8z" />
            </svg>
          </div>
          <div>
            <h3 className="font-bebas text-[21px] text-white tracking-wide leading-none">QUICK MATCH</h3>
            <p className="text-[12px] text-white/90 font-medium leading-normal mt-0.5">
              Find an opponent instantly
            </p>
          </div>
        </div>
        <svg
          className="w-5 h-5 stroke-white stroke-[2.5] fill-none mr-1"
          strokeLinecap="round"
          strokeLinejoin="round"
          viewBox="0 0 24 24"
        >
          <path d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Mode 2: Ranked Match */}
      <button
        onClick={() => handleSelectMode(MatchMode.RANKED)}
        disabled={isSearching}
        className="w-full h-[66px] rounded-[18px] bg-gradient-to-r from-[#009951] to-[#007A3E] p-4 flex items-center justify-between shadow-md active:scale-[0.985] transition-transform text-left cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
        type="button"
      >
        <div className="flex items-center space-x-3.5">
          <div className="w-9 h-9 flex items-center justify-center flex-shrink-0">
            <svg className="w-7 h-7 fill-white" viewBox="0 0 24 24">
              <path d="M19 4h-2V3a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v1H5a3 3 0 0 0-3 3v2a4 4 0 0 0 4 4h.5c.74 1.54 2.1 2.67 3.75 2.93V18h-2a2 2 0 0 0-2 2v2h12v-2a2 2 0 0 0-2-2h-2v-2.07c1.65-.26 3.01-1.39 3.75-2.93H18a4 4 0 0 0 4-4V7a3 3 0 0 0-3-3zM4 9V7a1 1 0 0 1 1-1h2v4.44A2.01 2.01 0 0 1 4 9zm16 0a2.01 2.01 0 0 1-3 1.44V6h2a1 1 0 0 1 1 1v2z" />
            </svg>
          </div>
          <div>
            <h3 className="font-bebas text-[21px] text-white tracking-wide leading-none">RANKED MATCH</h3>
            <p className="text-[12px] text-white/90 font-medium leading-normal mt-0.5">
              Compete for the leaderboard
            </p>
          </div>
        </div>
        <svg
          className="w-5 h-5 stroke-white stroke-[2.5] fill-none mr-1"
          strokeLinecap="round"
          strokeLinejoin="round"
          viewBox="0 0 24 24"
        >
          <path d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Mode 3: Play With Friends */}
      <button
        onClick={() => handleSelectMode(MatchMode.FRIENDS)}
        disabled={isSearching}
        className="w-full h-[66px] rounded-[18px] bg-gradient-to-r from-[#7A2BE2] to-[#5A1BB8] p-4 flex items-center justify-between shadow-md active:scale-[0.985] transition-transform text-left cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
        type="button"
      >
        <div className="flex items-center space-x-3.5">
          <div className="w-9 h-9 flex items-center justify-center flex-shrink-0">
            <svg className="w-7 h-7 fill-white" viewBox="0 0 24 24">
              <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
            </svg>
          </div>
          <div>
            <h3 className="font-bebas text-[21px] text-white tracking-wide leading-none">
              PLAY WITH FRIENDS
            </h3>
            <p className="text-[12px] text-white/90 font-medium leading-normal mt-0.5">
              Invite a friend to play
            </p>
          </div>
        </div>
        <svg
          className="w-5 h-5 stroke-white stroke-[2.5] fill-none mr-1"
          strokeLinecap="round"
          strokeLinejoin="round"
          viewBox="0 0 24 24"
        >
          <path d="M9 5l7 7-7 7" />
        </svg>
      </button>
      {/* END: MatchModeCards */}

      {/* BEGIN: MatchSearchPanel */}
      <section
        className={`w-full bg-[#1A1B1E] border rounded-[16px] p-4 flex items-center justify-between transition-all duration-300 ${
          isSearching
            ? 'border-[#00E676] shadow-[0_0_20px_rgba(0,230,118,0.3)] animate-pulse'
            : 'border-[#00B85F]/60 shadow-[0_0_15px_rgba(0,184,95,0.15)]'
        }`}
        data-purpose="match-search-panel"
      >
        <div className="space-y-1">
          <h4 className="font-bold text-[15px] text-white leading-tight">
            {isSearching ? 'Connecting to player...' : 'Searching for opponent...'}
          </h4>
          <p className="text-[13px] text-[#9A9A9A] font-medium">Estimated wait: &lt; 10s</p>
        </div>

        {/* Glowing Radar Search Mask Icon */}
        <div className="relative flex items-center justify-center w-12 h-12 flex-shrink-0">
          <svg
            className={`w-11 h-11 text-[#00E676] glow-radar ${isSearching ? 'animate-spin' : ''}`}
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.5"
            viewBox="0 0 48 48"
          >
            <circle cx="21" cy="21" r="14" />
            <line strokeWidth="3" x1="31.5" x2="43" y1="31.5" y2="43" />
            {/* Mask inside magnifier glass */}
            <path
              d="M15 19c1.5 2 3.5 2 5 0s3.5-2 5 0c0 3.5-3 5-5 5s-5-1.5-5-5z"
              fill="currentColor"
              fillOpacity="0.3"
              stroke="currentColor"
              strokeWidth="1.8"
            />
            <circle cx="17.5" cy="18.5" fill="#00E676" r="1.2" />
            <circle cx="24.5" cy="18.5" fill="#00E676" r="1.2" />
          </svg>
        </div>
      </section>
      {/* END: MatchSearchPanel */}

      {/* BEGIN: RecentOpponentsCard */}
      <section
        className="w-full bg-[#1A1B1E] border border-[#2a2c31] rounded-[18px] pt-3.5 pb-4 px-4"
        data-purpose="recent-opponents"
      >
        <span className="text-[12px] font-bold text-[#8E9297] tracking-wider uppercase">
          RECENT OPPONENTS
        </span>
        <div className="grid grid-cols-3 gap-2 mt-3 text-center">
          {isLoadingOpponents ? (
            <>
              <div className="flex flex-col items-center"><Skeleton circle width={58} height={58} /></div>
              <div className="flex flex-col items-center"><Skeleton circle width={58} height={58} /></div>
              <div className="flex flex-col items-center"><Skeleton circle width={58} height={58} /></div>
            </>
          ) : recentOpponents.length === 0 ? (
            <div className="col-span-3 text-[#9A9A9A] text-sm py-2">No recent opponents</div>
          ) : (
            recentOpponents.map((opp) => (
              <div key={opp.id} className="flex flex-col items-center">
                <div className="w-[58px] h-[58px] rounded-full avatar-glow overflow-hidden bg-[#24272D] flex items-center justify-center mb-2">
                  <img
                    alt={`${opp.username} avatar`}
                    className="w-full h-full object-cover"
                    src={opp.avatarUrl}
                  />
                </div>
                <span className="text-[13px] font-semibold text-white truncate max-w-[85px]">
                  {opp.username}
                </span>
                <button
                  onClick={() => handleRematch(opp.id)}
                  disabled={isSearching}
                  className="text-[12px] font-semibold text-[#00E676] hover:underline mt-0.5 active:opacity-80 cursor-pointer disabled:text-gray-500"
                  type="button"
                >
                  Rematch
                </button>
              </div>
            ))
          )}
        </div>
      </section>
      {/* END: RecentOpponentsCard */}

      {/* BEGIN: InviteFriendsButton */}
      <button
        onClick={handleInviteFriends}
        className="w-full h-[52px] rounded-full bg-[#111214] border-2 border-[#00B85F] flex items-center justify-center space-x-3 active:scale-[0.985] transition-transform hover:bg-[#00B85F]/10 cursor-pointer"
        type="button"
      >
        <svg className="w-5 h-5 fill-white rotate-[-20deg] mb-0.5" viewBox="0 0 24 24">
          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
        </svg>
        <span className="font-bebas text-[20px] text-white tracking-wider uppercase">
          INVITE FRIENDS
        </span>
      </button>
      {/* END: InviteFriendsButton */}
    </div>
  );
};
