import { useNavigate } from 'react-router-dom';
import routes from '../../config/routes.config';
import React, { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../../store/game.store';
import { useUIStore } from '../../store/ui.store';
import { useAuthStore } from '../../store/auth.store';
import { useRecordMatchResult } from '../../api/tasks.api';
import { useMatchMove, useMatchDraw, useMatchForfeit } from '../../api/match.api';
import { MatchTurn, WhotSuit, WhotSpecialEffect } from '../../types/enums/whot.enums';
import { WhotCard } from '../../types/interfaces/card.types';
import { WhotCardView } from '../../components/shared/WhotCardView';
import { soundEffects } from '../../helpers/audio.helpers';

export default function WhotGameBoard() {
  const {
    activeMatch,
    selectedCardId,
    selectCard,
    setSuitPickerOpen,
    showReaction,
    recentReaction,
    tickTurnTimer,
    isSuitPickerOpen,
    pendingWhotCard,
  } = useGameStore();

  const matchMoveMutation = useMatchMove();
  const matchDrawMutation = useMatchDraw();
  const matchForfeitMutation = useMatchForfeit();

  const { showToast } = useUIStore();
  const navigate = useNavigate();
  const { updateUserStats } = useAuthStore();
  const recordMatchMutation = useRecordMatchResult();

  // Stable ref so the useEffect doesn't re-fire when the mutation object changes
  const recordMatchRef = useRef(recordMatchMutation.mutate);
  recordMatchRef.current = recordMatchMutation.mutate;

  // Timer interval
  useEffect(() => {
    const timer = setInterval(() => {
      tickTurnTimer();
    }, 1000);
    return () => clearInterval(timer);
  }, [tickTurnTimer]);

  // Watch for match completion to transition to result view
  useEffect(() => {
    if (activeMatch && activeMatch.status === 'COMPLETED') {
      const isWin = activeMatch.winner === 'PLAYER';
      updateUserStats(activeMatch.xpEarned, activeMatch.pointsEarned, isWin);
      
      // Send match result to backend/API via stable ref
      recordMatchRef.current(isWin);

      const delay = setTimeout(() => {
        navigate(routes.result);
      }, 1600);
      return () => clearTimeout(delay);
    }
  }, [activeMatch, navigate, updateUserStats]);

  if (!activeMatch) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-white">
        <p className="text-sm text-[#9A9A9A] mb-4">No active match in progress</p>
        <button
          onClick={() => navigate(routes.lobby)}
          className="px-6 py-2.5 rounded-full bg-[#00B85F] text-[#111214] font-bold text-xs"
        >
          Return to Lobby
        </button>
      </div>
    );
  }

  const isPlayerTurn = activeMatch.currentTurn === MatchTurn.PLAYER;
  const opponentCardCount = activeMatch.opponent.cardCount;

  const playCard = (card: WhotCard, suit?: WhotSuit) => {
    if (!activeMatch) return;
    if (card.isSpecial && card.specialEffect === WhotSpecialEffect.WHOT_WILD && !suit) {
      setSuitPickerOpen(true, card);
      return;
    }
    matchMoveMutation.mutate({ matchId: activeMatch.matchId, cardId: card.id, nominatedSuit: suit });
    setSuitPickerOpen(false);
  };

  const handleCardClick = (card: WhotCard) => {
    if (!isPlayerTurn) {
      showToast("Wait for opponent's turn to complete", 'info');
      return;
    }
    if (selectedCardId === card.id) {
      // Play immediately
      playCard(card);
    } else {
      selectCard(card.id);
    }
  };

  const handleSuitChosen = (suit: WhotSuit) => {
    if (pendingWhotCard) {
      playCard(pendingWhotCard, suit);
    }
  };

  const playerDrawCard = () => {
    if (!activeMatch || !isPlayerTurn) return;
    matchDrawMutation.mutate({ matchId: activeMatch.matchId });
  };

  const forfeitMatch = () => {
    if (!activeMatch) return;
    matchForfeitMutation.mutate({ matchId: activeMatch.matchId });
  };

  const declareLastCard = () => {
    soundEffects.playButtonClick();
    showToast('You declared LAST CARD!', 'success');
  };

  return (
    <div className="flex-1 flex flex-col justify-between felt-surface inner-table-bevel relative overflow-hidden select-none text-white px-2 py-1">
      {/* BEGIN: Opponent Section */}
      <section className="relative px-3 pt-1 z-20 shrink-0" data-purpose="opponent-profile-and-cards">
        <div className="flex items-start justify-between">
          {/* Left: Opponent Avatar & Status */}
          <div className="flex items-center space-x-2.5">
            <div className="relative">
              <div className="w-12 h-12 rounded-full p-[2px] bg-gradient-to-tr from-blue-600 to-sky-400">
                <img
                  alt={`${activeMatch.opponent.username} Avatar`}
                  className="w-full h-full object-cover rounded-full"
                  src={activeMatch.opponent.avatarUrl}
                />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm leading-tight text-white tracking-wide">
                {activeMatch.opponent.username}
              </span>
              <div className="flex items-center space-x-1 mt-0.5">
                <span className="text-[11px] font-semibold text-emerald-400">Online</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block shadow-[0_0_6px_#34d399]" />
              </div>
              <span className="text-[11px] text-gray-400 font-medium">
                {opponentCardCount} Cards
              </span>
            </div>
          </div>

          {/* Center: Opponent's Face-Down Fanned Cards */}
          <div className="relative flex items-center justify-center h-16 w-32 -mt-1 select-none">
            {Array.from({ length: Math.min(opponentCardCount, 5) }).map((_, idx) => {
              const rot = (idx - 2) * 9;
              const transX = (idx - 2) * 7;
              return (
                <div
                  key={idx}
                  className="absolute w-10 h-14 rounded bg-[#16181b] border border-white/20 flex flex-col items-center justify-center p-1 shadow-md"
                  style={{
                    transform: `rotate(${rot}deg) translateX(${transX}px)`,
                  }}
                >
                  <svg
                    className="w-4 h-4 text-white/30"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    viewBox="0 0 24 24"
                  >
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                  <span className="text-[6px] font-black text-white/30 tracking-widest mt-0.5">
                    WHOT
                  </span>
                </div>
              );
            })}
          </div>

          {/* Right: Action Buttons (Chat & White Flag) */}
          <div className="flex flex-col space-y-2">
            <button
              onClick={() => showReaction('🔥')}
              aria-label="Game Chat Reaction"
              className="w-8 h-8 rounded-full bg-black/40 border border-white/10 flex items-center justify-center text-white/80 active:bg-white/10 transition cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to forfeit this match?')) {
                  forfeitMatch();
                }
              }}
              aria-label="Forfeit match"
              className="w-8 h-8 rounded-full bg-black/40 border border-white/10 flex items-center justify-center text-white/80 active:bg-white/10 transition cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path
                  d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Turn Status Banner with Circular Countdown Timer */}
        <div className="mt-3 flex items-center justify-center relative">
          <div className="relative flex items-center justify-center">
            <div
              className={`border rounded-full py-1.5 pl-6 pr-12 shadow-md flex items-center transition-colors ${
                isPlayerTurn
                  ? 'bg-[#00B85F]/20 border-[#00FF66] shadow-[0_0_15px_rgba(0,184,95,0.3)]'
                  : 'bg-[#0a110d]/90 border-emerald-500/50'
              }`}
            >
              <span className="font-black text-xs tracking-wider uppercase text-white font-sans">
                {isPlayerTurn ? 'YOUR TURN' : "OPPONENT'S TURN"}
              </span>
            </div>
            <div
              className={`-ml-6 flex items-center justify-center w-11 h-11 rounded-full bg-[#0d1410] border-2 timer-glow z-10 ${
                isPlayerTurn ? 'border-[#00FF66]' : 'border-emerald-400'
              }`}
            >
              <span className="text-white font-extrabold text-base tabular-nums tracking-tight">
                {activeMatch.turnTimeRemainingSeconds}
                <span className="text-[10px] font-semibold">s</span>
              </span>
            </div>
          </div>
        </div>

        {/* Action message ticker */}
        {activeMatch.actionMessage && (
          <p className="text-center text-[11px] text-[#A6ABB3] font-medium mt-1">
            {activeMatch.actionMessage}
          </p>
        )}
      </section>
      {/* END: Opponent Section */}

      {/* BEGIN: Game Table Center (Draw Pile & Discard Pile) */}
      <section className="relative px-3 py-1 flex items-center justify-center z-10" data-purpose="card-table-playfield">
        <div className="w-full max-w-[340px] flex items-center justify-between">
          {/* Draw Pile (Market) */}
          <div className="flex flex-col items-center">
            <div
              onClick={isPlayerTurn ? playerDrawCard : undefined}
              className={`relative w-22 h-34 rounded-xl bg-[#17191c] border-2 border-white/20 card-shadow flex flex-col items-center justify-center p-2 cursor-pointer active:scale-95 transition-transform ${
                isPlayerTurn ? 'hover:border-[#00FF66]' : ''
              }`}
            >
              <div className="w-full h-full rounded-lg border border-dashed border-white/10 flex flex-col items-center justify-center bg-[#131416]">
                <svg className="w-8 h-8 text-white/30 mb-1" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <polygon
                    points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="text-[11px] font-black tracking-widest text-white/40">WHOT</span>
                <span className="text-[9px] text-[#00E676] font-bold mt-1">
                  ({activeMatch.drawPile.length})
                </span>
              </div>
              <div className="absolute -bottom-1 w-[92%] h-1 bg-[#101113] rounded-b border-b border-white/10 -z-10" />
              <div className="absolute -bottom-2 w-[85%] h-1 bg-[#0a0a0c] rounded-b border-b border-white/5 -z-20" />
            </div>
            <span className="text-[10px] font-bold tracking-widest text-white/50 uppercase mt-1.5">
              Draw Pile
            </span>
          </div>

          {/* Discard Pile (Top Card) */}
          <div className="flex flex-col items-center">
            <div className="relative">
              <WhotCardView card={activeMatch.topCard} size="md" isPlayable={false} />
              {activeMatch.nominatedSuit && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#7A2BE2] text-white text-[9px] font-extrabold px-2 py-0.5 rounded-full shadow whitespace-nowrap">
                  WANTED: {activeMatch.nominatedSuit}
                </div>
              )}
            </div>
            <span className="text-[10px] font-bold tracking-widest text-white/50 uppercase mt-1.5">
              Discard Pile
            </span>
          </div>

          {/* LAST CARD! Action Pill Button */}
          <div className="flex items-center">
            <button
              onClick={declareLastCard}
              className={`border-2 font-black text-xs px-3.5 py-2.5 rounded-full uppercase tracking-wider transition-transform cursor-pointer ${
                activeMatch.playerHand.length === 1
                  ? 'bg-[#FF5A36] text-black border-[#FF5A36] animate-bounce shadow-[0_0_15px_rgba(255,90,54,0.6)]'
                  : 'bg-[#1b1414] border-[#FF5A36] text-[#FF5A36] last-card-glow active:scale-95'
              }`}
            >
              Last Card!
            </button>
          </div>
        </div>
      </section>
      {/* END: Game Table Center */}

      {/* BEGIN: Player Hand & Action Prompt */}
      <section className="relative px-2 z-20 shrink-0" data-purpose="player-hand-fanned">
        {/* Fanned Hand Deck Area */}
        <div className="relative h-40 w-full flex justify-center items-end" data-purpose="cards-fan-container">
          {activeMatch.playerHand.map((card, idx) => {
            const count = activeMatch.playerHand.length;
            const mid = (count - 1) / 2;
            const offset = idx - mid;
            const rot = offset * 6;
            const transX = offset * 24;
            const isSelected = selectedCardId === card.id;

            return (
              <div
                key={card.id}
                style={{
                  transform: `translateX(${transX}px) rotate(${rot}deg) ${
                    isSelected ? 'translateY(-24px) scale(1.08)' : ''
                  }`,
                  zIndex: isSelected ? 35 : 10 + idx,
                }}
                className="absolute transition-transform duration-150"
              >
                <WhotCardView
                  card={card}
                  isSelected={isSelected}
                  onClick={() => handleCardClick(card)}
                  size="md"
                />
              </div>
            );
          })}
        </div>

        {/* Floating Reaction Animation */}
        {recentReaction && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 text-4xl animate-bounce pointer-events-none z-40">
            {recentReaction}
          </div>
        )}

        {/* Helper text "Play a card" pill container */}
        <div className="flex justify-center items-center my-1">
          <div
            onClick={() => {
              const sel = activeMatch.playerHand.find((c) => c.id === selectedCardId);
              if (sel) playCard(sel);
            }}
            className={`border rounded-full px-4 py-1 flex items-center shadow-inner cursor-pointer transition ${
              selectedCardId
                ? 'bg-[#00B85F] text-[#111214] font-black border-[#00FF66]'
                : 'bg-black/60 border-white/10 text-gray-300'
            }`}
          >
            <span className="text-[11px] font-semibold">
              {selectedCardId ? 'Tap to Play Selected Card' : 'Select a card to play'}
            </span>
          </div>
        </div>
      </section>
      {/* END: Player Hand */}

      {/* BEGIN: Quick Reaction Emoji Bar */}
      <footer className="w-full px-3 pb-3 z-20 shrink-0" data-purpose="reactions-bar">
        <div className="w-full bg-[#16181b]/90 border border-white/10 rounded-full px-3 py-1.5 flex items-center justify-around backdrop-blur-md shadow-xl">
          {['😂', '😎', '🔥', '👏', '😮'].map((emoji) => (
            <button
              key={emoji}
              onClick={() => showReaction(emoji)}
              aria-label={`${emoji} reaction`}
              className="text-2xl hover:scale-125 active:scale-95 transition-transform leading-none cursor-pointer"
            >
              {emoji}
            </button>
          ))}
          <button
            onClick={() => showToast('Chat: "Well played, oya make your move!"', 'info')}
            className="w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-300 hover:text-white active:scale-95 transition cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z" />
              <circle cx="8" cy="10" r="1.25" />
              <circle cx="12" cy="10" r="1.25" />
              <circle cx="16" cy="10" r="1.25" />
            </svg>
          </button>
        </div>
      </footer>

      {/* BEGIN: 20 Whot Suit Nominator Modal */}
      {isSuitPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-[320px] bg-[#1A1B1E] border border-[#7A2BE2] rounded-2xl p-4 text-center shadow-2xl">
            <h3 className="font-bebas text-2xl text-white tracking-wider mb-1">
              WHOT 20! PICK A SUIT
            </h3>
            <p className="text-xs text-[#9A9A9A] mb-4">
              Choose the next suit required from your opponent:
            </p>
            <div className="grid grid-cols-5 gap-2">
              {[
                { suit: WhotSuit.CIRCLE, label: 'Circle', color: '#009951' },
                { suit: WhotSuit.TRIANGLE, label: 'Triangle', color: '#E8431E' },
                { suit: WhotSuit.CROSS, label: 'Cross', color: '#F2B705' },
                { suit: WhotSuit.SQUARE, label: 'Square', color: '#0047BA' },
                { suit: WhotSuit.STAR, label: 'Star', color: '#009951' },
              ].map(({ suit, label, color }) => (
                <button
                  key={suit}
                  onClick={() => handleSuitChosen(suit)}
                  className="flex flex-col items-center p-2 rounded-xl bg-[#111214] border border-[#303338] hover:border-white active:scale-95 transition"
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold"
                    style={{ backgroundColor: color }}
                  >
                    {label[0]}
                  </div>
                  <span className="text-[10px] text-white font-medium mt-1">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
