import { MatchMode, MatchTurn, WhotSuit } from '../enums/whot.enums';
import { WhotCard } from './card.types';

export interface OpponentProfile {
  id: string;
  username: string;
  avatarUrl: string;
  cardCount: number;
  isOnline: boolean;
  score: number;
}

export interface MatchState {
  matchId: string;
  mode: MatchMode;
  currentTurn: MatchTurn;
  playerHand: WhotCard[];
  opponent: OpponentProfile;
  drawPile: WhotCard[];
  discardPile: WhotCard[];
  topCard: WhotCard;
  nominatedSuit?: WhotSuit | null;
  turnTimeRemainingSeconds: number;
  lastCardWarning: {
    player: boolean;
    opponent: boolean;
  };
  winner: 'PLAYER' | 'OPPONENT' | null;
  status: 'WAITING' | 'PLAYING' | 'COMPLETED' | 'FORFEITED';
  playerFinalScore: number;
  opponentFinalScore: number;
  xpEarned: number;
  pointsEarned: number;
  actionMessage?: string;
}
