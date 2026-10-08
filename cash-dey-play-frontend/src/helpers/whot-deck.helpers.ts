import { WhotCard } from '../types/interfaces/card.types';
import { WhotSpecialEffect, WhotSuit } from '../types/enums/whot.enums';

export const SUIT_COLORS: Record<WhotSuit, string> = {
  [WhotSuit.CIRCLE]: '#009951',
  [WhotSuit.TRIANGLE]: '#E8431E',
  [WhotSuit.CROSS]: '#F2B705',
  [WhotSuit.SQUARE]: '#0047BA',
  [WhotSuit.STAR]: '#009951',
  [WhotSuit.WHOT]: '#7A2BE2',
};

/**
 * Creates a standard Nigerian Whot deck (54 cards)
 */
export function generateWhotDeck(): WhotCard[] {
  const deck: WhotCard[] = [];
  let cardId = 1;

  const circles = [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14];
  const triangles = [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14];
  const crosses = [1, 2, 3, 5, 7, 10, 11, 13, 14];
  const squares = [1, 2, 3, 5, 7, 10, 11, 13, 14];
  const stars = [1, 2, 3, 4, 5, 7, 8];

  function getSpecialEffect(number: number): WhotSpecialEffect | undefined {
    switch (number) {
      case 1:
        return WhotSpecialEffect.HOLD_ON;
      case 2:
        return WhotSpecialEffect.PICK_TWO;
      case 5:
        return WhotSpecialEffect.PICK_THREE;
      case 8:
        return WhotSpecialEffect.SUSPENSION;
      case 14:
        return WhotSpecialEffect.GENERAL_MARKET;
      case 20:
        return WhotSpecialEffect.WHOT_WILD;
      default:
        return undefined;
    }
  }

  function addSuitCards(suit: WhotSuit, numbers: number[]) {
    numbers.forEach((num) => {
      const special = getSpecialEffect(num);
      deck.push({
        id: `card_${cardId++}`,
        suit,
        number: num,
        isSpecial: Boolean(special),
        specialEffect: special,
        colorHex: SUIT_COLORS[suit],
      });
    });
  }

  addSuitCards(WhotSuit.CIRCLE, circles);
  addSuitCards(WhotSuit.TRIANGLE, triangles);
  addSuitCards(WhotSuit.CROSS, crosses);
  addSuitCards(WhotSuit.SQUARE, squares);
  addSuitCards(WhotSuit.STAR, stars);

  // 4 Whot 20 wild cards in official deck
  for (let i = 0; i < 4; i++) {
    deck.push({
      id: `card_${cardId++}`,
      suit: WhotSuit.WHOT,
      number: 20,
      isSpecial: true,
      specialEffect: WhotSpecialEffect.WHOT_WILD,
      colorHex: SUIT_COLORS[WhotSuit.WHOT],
    });
  }

  return deck;
}

/**
 * Fisher-Yates array shuffle algorithm
 */
export function shuffleDeck(cards: WhotCard[]): WhotCard[] {
  const shuffled = [...cards];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Determines whether a player's card can legally be played on the current top card.
 */
export function isValidCardMove(
  cardToPlay: WhotCard,
  topCard: WhotCard,
  nominatedSuit?: WhotSuit | null
): boolean {
  // Whot (20) can be played onto anything!
  if (cardToPlay.number === 20 || cardToPlay.suit === WhotSuit.WHOT) {
    return true;
  }

  // If a previous 20 Whot established a nominated suit:
  if (nominatedSuit) {
    return cardToPlay.suit === nominatedSuit;
  }

  // Normal rule: Match number or match suit
  return cardToPlay.suit === topCard.suit || cardToPlay.number === topCard.number;
}

/**
 * Calculates penalty points in hand when game finishes.
 * Stars count double in official Whot rules!
 */
export function calculateHandPenaltyPoints(cards: WhotCard[]): number {
  return cards.reduce((sum, card) => {
    if (card.suit === WhotSuit.STAR) {
      return sum + card.number * 2;
    }
    return sum + card.number;
  }, 0);
}
