export const API_ROUTES = {
  // User/Auth
  USER_ME: 'users/me',

  // Wallet
  WALLET_BALANCE: 'wallet/balance',
  WALLET_TRANSACTIONS: 'wallet/transactions',
  WALLET_REDEEM: 'wallet/redeem',

  // Tasks
  TASKS_STATE: 'tasks/state',
  TASK_COMPLETE: 'tasks/complete',
  TASK_OPTIONAL_VIDEO: 'tasks/optional-video',
  TASK_SKIP_COOLDOWN: 'tasks/skip-cooldown',
  RECORD_MATCH: 'tasks/record-match',

  // Leaderboard
  LEADERBOARD_GAME: 'leaderboards/game',
  LEADERBOARD_COMMUNITY: 'leaderboards/community',

  // Matches
  MATCH_START: 'matches/start',
  MATCH_MOVE: 'matches/move',
  MATCH_DRAW: 'matches/draw',
  MATCH_FORFEIT: 'matches/forfeit',
  MATCH_RECENT: 'matches/recent-opponents',

  // Premium
  PREMIUM_SUBSCRIBE: 'premium/subscribe',
  PREMIUM_STATUS: 'premium/status',
};
