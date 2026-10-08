/**
 * Whot Game Enums
 */

export enum WhotSuit {
  CIRCLE = 'CIRCLE',
  TRIANGLE = 'TRIANGLE',
  CROSS = 'CROSS',
  SQUARE = 'SQUARE',
  STAR = 'STAR',
  WHOT = 'WHOT',
}

export enum WhotSpecialEffect {
  HOLD_ON = 'HOLD_ON', // 1: Next player's turn skipped (current player plays again)
  PICK_TWO = 'PICK_TWO', // 2: Next player draws 2 cards
  PICK_THREE = 'PICK_THREE', // 5: Next player draws 3 cards
  SUSPENSION = 'SUSPENSION', // 8: Next player is suspended (skipped)
  GENERAL_MARKET = 'GENERAL_MARKET', // 14: Everyone except player draws 1 card
  WHOT_WILD = 'WHOT_WILD', // 20: Wild card, player nominates new suit
}

export enum MatchMode {
  QUICK = 'QUICK',
  RANKED = 'RANKED',
  FRIENDS = 'FRIENDS',
}

export enum MatchTurn {
  PLAYER = 'PLAYER',
  OPPONENT = 'OPPONENT',
}

export enum TelecomProvider {
  MTN = 'MTN Nigeria',
  AIRTEL = 'Airtel Nigeria',
  GLO = 'Glo Mobile',
  NINE_MOBILE = '9mobile',
}

export enum AdNetwork {
  ADSGRAM = 'Adsgram (Telegram Native)',
  MONETAG = 'Monetag (Rewarded Video)',
  TADS = 'Tads.me (High Fill)',
}
