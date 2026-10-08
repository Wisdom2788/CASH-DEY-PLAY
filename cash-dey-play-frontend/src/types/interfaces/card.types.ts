import { WhotSuit, WhotSpecialEffect } from '../enums/whot.enums';

export interface WhotCard {
  id: string;
  suit: WhotSuit;
  number: number;
  isSpecial: boolean;
  specialEffect?: WhotSpecialEffect;
  colorHex: string;
}

export interface WhotDeckState {
  drawPile: WhotCard[];
  discardPile: WhotCard[];
  topCard: WhotCard;
  nominatedSuit?: WhotSuit | null;
}
