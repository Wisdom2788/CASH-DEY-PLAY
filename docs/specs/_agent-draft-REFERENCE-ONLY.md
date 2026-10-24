> Historical reference. Current ordered implementation contracts and status: [delivery specifications](delivery/README.md). Conflicting instructions in this document are superseded there.

# Cash Dey Play — Master Implementation Specification & System Architecture

*Prepared 21 October 2026. This document is the comprehensive, authoritative implementation specification covering every section, system, domain, and step outlined in the **Cash Dey Play — Build Order and Implementation Plan (v1.0)** and **Project Audit**. It resolves all omissions, architectural gaps, and security exploits with production-grade, highly efficient technical specifications.*

---

## Table of Contents

1. [Executive Summary & Target Architecture](#1-executive-summary--target-architecture)
2. [Module 1: Authentication, Telegram Login & Identity Consolidation](#2-module-1-authentication-telegram-login--identity-consolidation)
3. [Module 2: Ranked Matchmaking, Lobby States & Match Flow (Deep Dive)](#3-module-2-ranked-matchmaking-lobby-states--match-flow-deep-dive)
4. [Module 3: Server-Authoritative Whot Engine, State Projection & Bot AI](#4-module-3-server-authoritative-whot-engine-state-projection--bot-ai)
5. [Module 4: Scrella Engineering Standard Migration & Frontend Architecture](#5-module-4-scrella-engineering-standard-migration--frontend-architecture)
6. [Module 5: Practice Mode, Adsgram Verification & Ad Credits Engine](#6-module-5-practice-mode-adsgram-verification--ad-credits-engine)
7. [Module 6: Entitlements, Daily Tasks & Login Streak Engine](#7-module-6-entitlements-daily-tasks--login-streak-engine)
8. [Module 7: Telegram Stars Payments & Premium Subscription System](#8-module-7-telegram-stars-payments--premium-subscription-system)
9. [Module 8: Wallet Ledger, Payout Engine & Airtime Aggregator Integration](#9-module-8-wallet-ledger-payout-engine--airtime-aggregator-integration)
10. [Module 9: Monthly Game & Community Builder Leaderboards](#10-module-9-monthly-game--community-builder-leaderboards)
11. [Module 10: Step-by-Step Implementation Roadmap (Steps 0 through 13)](#11-module-10-step-by-step-implementation-roadmap-steps-0-through-13)
12. [Module 11: Resolution of Open Items (O1 to O15) & Security Runbooks](#12-module-11-resolution-of-open-items-o1-to-o15--security-runbooks)

---

## 1. Executive Summary & Target Architecture

Cash Dey Play is a competitive mobile card game (Nigerian Whot) integrated within Telegram Mini Apps, providing real airtime rewards and Telegram Stars monetization.

### 1.1 High-Level Topology

```
+---------------------------------------------------------------------------------------+
|                                    TELEGRAM CLIENT                                    |
|   Mini App URL: https://t.me/Cash_dey_play_bot/Cash_Dey_Play                          |
+---------------------------------------------------------------------------------------+
                     |                                       |
    Static Assets / REST Queries                WebSocket (WSS) Transport
    (React SPA on Vercel)                      (Socket.io Gateway)
                     v                                       v
+-------------------------------+      +------------------------------------------------+
|        VERCEL HOSTING         |      |           BACKEND NODE.JS CLUSTER              |
|  - SPA Static Bundle          |      |  - Express REST API (Auth, Entitlements, Admin)|
|  - vercel.json rewrite        |      |  - Socket.io Realtime Server (Stateful WSS)   |
|  - Self-hosted Outfit/Bebas   |      |  - Whot Server Game Engine (Pure Deterministic)|
|  - Sentry Error Tracking      |      |  - BullMQ Background Workers (Payouts, Close)  |
+-------------------------------+      +------------------------------------------------+
                                              |                |                |
                       +----------------------+                |                +-----------------------+
                       |                                       |                                        |
                       v                                       v                                        v
+-------------------------------+      +-------------------------------+      +---------------------------------+
|      POSTGRESQL (AUTHORITY)   |      |        REDIS (EPHEMERAL)      |      |      EXTERNAL INTEGRATIONS      |
|  - users, entitlements        |      |  - mm:ranked:queue (ZSET)     |      |  - Telegram Bot API (Stars Webhook)|
|  - matches, match_events      |      |  - presence, socket mappings  |      |  - Adsgram Callback Verification|
|  - wallet_ledger, payouts     |      |  - match live state & locks   |      |  - VTpass / Aggregator Airtime  |
|  - streaks, daily_task_state  |      |  - rate limits & idempotency  |      |  - Sentry APM & Tracing         |
+-------------------------------+      +-------------------------------+      +---------------------------------+
```

### 1.2 Core Guarantees & Constraints
1. **Africa/Lagos Clock:** All daily resets (tasks, allowance, streak windows) and monthly leaderboard closures strictly evaluate on `00:00:00 Africa/Lagos` (`UTC+1`).
2. **Client-Server Purity:** The frontend never decides an entitlement, streak milestone, match outcome, points balance, or card dealt. It is an authoritative state projection renderer.
3. **Information Security:** No hidden card state (opponent hand, draw deck order) is ever transmitted over WebSocket or REST.
4. **Idempotency & Acid Ledger:** Financial and airtime operations use double-entry append-only transactions with strict idempotency keys.

---

## 2. Module 1: Authentication, Telegram Login & Identity Consolidation

### 2.1 The Problem & Current Codebase Loopholes
1. `env.config.ts`: `JWT_SECRET` defaults to `"dev_secret"`, and `readNodeEnv` defaults to `"development"` when unset, permitting dev auth bypass in staging/production.
2. `verify-telegram-init-data.ts`: Does not validate future timestamps (`auth_date > now + 60s`).
3. `auth.service.ts`: Generates arbitrary user IDs without consolidating streak and task history. Ignores the Telegram `start_param` containing referral codes.
4. Token lifetimes are unpinned and missing audience/issuer verification.

### 2.2 Concrete Technical Specification

#### A. Unified User Identity
All users are identified by a canonical string:
```
id: "tg_<telegram_id>"
```
No integer/string ID dichotomy. Foreign keys across `matches`, `wallet_ledger`, `login_streaks`, `referrals`, and `task_completions` reference `users.id` directly.

#### B. Cryptographic Verification & Referral Capture
The HMAC-SHA256 signature verification over `window.Telegram.WebApp.initData`:
1. Parse parameters and extract `hash`.
2. Construct sorted check string `k=v\n`.
3. Secret key derivation: `HMAC_SHA256(key="WebAppData", data=botToken)`.
4. Validate signature via `crypto.timingSafeEqual`.
5. **Freshness & Clock-Skew Check:**
   $$\text{now} - 86400 \le \text{auth\_date} \le \text{now} + 60$$
6. **Referral Extraction:** Parse `start_param`. If present and the user is registering for the first time, queue referral association.

#### C. Backend Auth Architecture (`src/auth/auth.service.ts`)
```typescript
import { createHmac, timingSafeEqual } from "crypto";
import jwt from "jsonwebtoken";

export interface AuthenticatedUserSession {
  userId: string;
  telegramId: number;
  username: string | null;
  firstName: string;
  avatarUrl: string | null;
  isNewUser: boolean;
}

export class AuthService {
  constructor(
    private readonly pool: Pool,
    private readonly botToken: string,
    private readonly jwtSecret: string,
    private readonly isProduction: boolean
  ) {}

  async loginWithTelegram(initData: string, rawDevUserId?: string): Promise<{ token: string; user: UserProfile }> {
    // 1. Strict Dev Bypass Guard
    if (rawDevUserId && !this.isProduction && process.env.ALLOW_DEV_AUTH_BYPASS === "true") {
      const devTgId = parseInt(rawDevUserId, 10);
      return this.handleUserUpsert(devTgId, "DevPlayer", "Dev", null, null);
    }

    // 2. Production Cryptographic Verification
    const validatedData = this.verifyInitData(initData);
    return this.handleUserUpsert(
      validatedData.telegramId,
      validatedData.username,
      validatedData.firstName,
      validatedData.photoUrl,
      validatedData.startParam
    );
  }

  private verifyInitData(initData: string) {
    if (!initData) throw new TelegramAuthError("MISSING_INIT_DATA");
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) throw new TelegramAuthError("MISSING_HASH");
    params.delete("hash");

    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");

    const secretKey = createHmac("sha256", "WebAppData").update(this.botToken).digest();
    const computedHash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

    const hashBuf = Buffer.from(hash, "hex");
    const compBuf = Buffer.from(computedHash, "hex");
    if (hashBuf.length !== compBuf.length || !timingSafeEqual(hashBuf, compBuf)) {
      throw new TelegramAuthError("HASH_MISMATCH");
    }

    const authDate = Number(params.get("auth_date"));
    const now = Math.floor(Date.now() / 1000);
    if (!Number.isInteger(authDate) || authDate > now + 60 || now - authDate > 86400) {
      throw new TelegramAuthError("EXPIRED_OR_FUTURE_AUTH_DATE");
    }

    const userPayload = JSON.parse(params.get("user") || "{}");
    if (!userPayload.id) throw new TelegramAuthError("INVALID_USER_PAYLOAD");

    return {
      telegramId: Number(userPayload.id),
      firstName: userPayload.first_name || "",
      username: userPayload.username || null,
      photoUrl: userPayload.photo_url || null,
      startParam: params.get("start_param") || null,
    };
  }

  private async handleUserUpsert(
    telegramId: number,
    username: string | null,
    firstName: string,
    avatarUrl: string | null,
    startParam: string | null
  ) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const userId = `tg_${telegramId}`;

      // Check if user is newly created
      const checkRes = await client.query("SELECT id FROM users WHERE id = $1", [userId]);
      const isNew = checkRes.rowCount === 0;

      // Upsert User
      const userRes = await client.query(
        `INSERT INTO users (id, telegram_id, first_name, username, avatar_url, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (id) DO UPDATE SET
           first_name = EXCLUDED.first_name,
           username = EXCLUDED.username,
           avatar_url = EXCLUDED.avatar_url,
           updated_at = NOW()
         RETURNING *`,
        [userId, telegramId, firstName, username, avatarUrl]
      );

      // Handle referral capture if new user and startParam provided
      if (isNew && startParam && startParam.startsWith("ref_")) {
        const referrerCode = startParam;
        await client.query(
          `INSERT INTO referrals (referrer_id, referee_id, referral_code, created_at)
           SELECT u.id, $1, $2, NOW()
           FROM users u
           WHERE u.referral_code = $2 AND u.id != $1
           ON CONFLICT (referee_id) DO NOTHING`,
          [userId, referrerCode]
        );
      }

      await client.query("COMMIT");

      // Sign JWT with algorithm pinned to HS256
      const token = jwt.sign(
        { sub: userId, telegramId, iss: "cash-dey-play-api", aud: "cash-dey-play-client" },
        this.jwtSecret,
        { algorithm: "HS256", expiresIn: "7d" }
      );

      return { token, user: this.mapUser(userRes.rows[0]) };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
}
```

#### D. Socket.io Authentication Middleware
When the frontend initializes the WebSocket connection, authentication occurs during the initial handshake:
```typescript
io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.headers["authorization"]?.replace("Bearer ", "");
  if (!token) {
    return next(new Error("AUTH_REQUIRED"));
  }
  try {
    const payload = jwt.verify(token, env.jwtSecret, { algorithms: ["HS256"] }) as { sub: string; telegramId: number };
    socket.data.userId = payload.sub;
    socket.data.telegramId = payload.telegramId;
    next();
  } catch (err) {
    next(new Error("INVALID_TOKEN"));
  }
});
```

---

## 3. Module 2: Ranked Matchmaking, Lobby States & Match Flow (Deep Dive)

### 3.1 Overview of the Architecture
As established in Section 6 of the Build Order, **scanning for online users is prohibited**. Players enter a FIFO queue (`ZSET`), and an atomic matchmaking loop pairs the oldest compatible candidates.

```
+-----------------------------------------------------------------------------------------------------+
|                                      MATCHMAKING STATE MACHINE                                      |
|                                                                                                     |
|   [IDLE]                                                                                            |
|     |  User taps "Ranked Match"                                                                     |
|     v                                                                                               |
|   [QUEUE_JOIN] ----(Checks: Allowance < 3, Cooldown = 0, Lockout = 0, Not Active)                   |
|     |                                                                                               |
|     v                                                                                               |
|   [SEARCHING] <-------------------+ (Declined by opponent / Opponent timeout -> re-queued at top)  |
|     |                             |                                                                 |
|     | Matchmaker loop pairs A & B |                                                                 |
|     v                             |                                                                 |
|   [OFFER / READY CHECK (10s)] ----+                                                                 |
|     |                                                                                               |
|     | Both A & B emit `match:accept`                                                                |
|     v                                                                                               |
|   [STARTING] (Allowance consumed, DB match created, Redis authoritative match loaded)               |
|     |                                                                                               |
|     v                                                                                               |
|   [IN_MATCH] <------------------------------------+ (30s Reconnect Grace Period)                    |
|     |                                             |                                                 |
|     | Turns alternate (30s limit; auto-draw)     | Disconnect event                                |
|     |                                             |                                                 |
|     +---------------------------------------------> [OPPONENT_DISCONNECTED]                         |
|     |                                                                                               |
|     v                                                                                               |
|   [MATCH_ENDED] (Result: WIN/LOSS/VOID -> write Postgres match & events -> update Recent Opponents) |
|     |                                                                                               |
|     v                                                                                               |
|   [REMATCH_OFFER (15s)] (Bilateral agreement, max 2/day per opponent, max 3 reqs/hr)               |
+-----------------------------------------------------------------------------------------------------+
```

### 3.2 Redis Data Structures & Invariants
All ephemeral states live in Redis with strict TTLs:
1. `mm:ranked:queue` (`ZSET`): Score is epoch millisecond timestamp (`Date.now()`). Member is `userId`.
2. `mm:ticket:{userId}` (`HASH`): Holds `{ ticketId, joinedAt, socketId }`, TTL: 180s.
3. `presence:{userId}` (`STRING`): Value is `socketId`, TTL: 45s (refreshed every 15s via socket heartbeat).
4. `user:active:{userId}` (`STRING`): Value is `match:{matchId}` or `offer:{offerId}`, TTL: 3600s. Guards against concurrent queue/match presence.
5. `mm:recent:{userId}` (`SET`): Opponents faced today, expires at midnight Africa/Lagos.
6. `match:{matchId}` (`HASH`): Complete authoritative game state + version counter for optimistic locking.
7. `ranked:penalties:{userId}` (`HASH`): `{ strikes, lockedUntil }`.

### 3.3 Atomic Pairing Lua Script (`pair_atomically.lua`)
Prevents race conditions where two concurrently executing matchmaker ticks pick the same candidate:

```lua
-- KEYS[1]: mm:ranked:queue
-- ARGV[1]: playerA (userId)
-- ARGV[2]: playerB (userId)

local scoreA = redis.call('ZSCORE', KEYS[1], ARGV[1])
local scoreB = redis.call('ZSCORE', KEYS[1], ARGV[2])

if scoreA and scoreB then
  redis.call('ZREM', KEYS[1], ARGV[1], ARGV[2])
  return 1
else
  return 0
end
```

### 3.4 Matchmaker Loop & Compatibility Rules
The matchmaker operates on a 1-second fixed interval tick protected by a distributed Redis leader lock (`redlock` or `SET mm:leader:lock my_instance_id PX 2000 NX`):

```typescript
export class MatchmakerService {
  constructor(
    private readonly redis: Redis,
    private readonly io: Server,
    private readonly pool: Pool
  ) {}

  async tick(): Promise<void> {
    // 1. Acquire leader lock (2000ms TTL)
    const acquired = await this.redis.set("mm:leader:lock", process.pid.toString(), "PX", 2000, "NX");
    if (!acquired) return;

    try {
      // 2. Fetch oldest 50 waiting players
      const candidates = await this.redis.zrange("mm:ranked:queue", 0, 49);
      if (candidates.length < 2) return;

      const paired = new Set<string>();

      for (let i = 0; i < candidates.length; i++) {
        const playerA = candidates[i];
        if (paired.has(playerA)) continue;

        for (let j = i + 1; j < candidates.length; j++) {
          const playerB = candidates[j];
          if (paired.has(playerB)) continue;

          // Compatibility validation
          const compatible = await this.isCompatible(playerA, playerB);
          if (!compatible) continue;

          // Attempt atomic removal
          const success = await this.redis.eval(
            PAIR_ATOMICALLY_LUA,
            1,
            "mm:ranked:queue",
            playerA,
            playerB
          );

          if (success === 1) {
            paired.add(playerA);
            paired.add(playerB);
            await this.createMatchOffer(playerA, playerB);
            break;
          }
        }
      }
    } finally {
      // Release lock safely
      await this.redis.del("mm:leader:lock");
    }
  }

  private async isCompatible(playerA: string, playerB: string): Promise<boolean> {
    if (playerA === playerB) return false;

    // Verify both have active socket connections
    const [sockA, sockB] = await Promise.all([
      this.redis.get(`presence:${playerA}`),
      this.redis.get(`presence:${playerB}`),
    ]);
    if (!sockA || !sockB) return false;

    // Verify neither player has exceeded the 2 matches/day limit against each other
    const [metA, metB] = await Promise.all([
      this.redis.sismember(`mm:recent:${playerA}`, playerB),
      this.redis.sismember(`mm:recent:${playerB}`, playerA),
    ]);
    if (metA || metB) return false;

    return true;
  }
}
```

### 3.5 Realtime WebSocket Protocol Taxonomy

#### Client-to-Server Events
| Event | Payload Schema | Description |
|---|---|---|
| `session:resume` | `{}` | Re-syncs client state after page reload or connection recovery. |
| `queue:join` | `{ mode: "RANKED" }` | Enters matchmaking queue after eligibility verification. |
| `queue:leave` | `{}` | Cancels queue search without penalty. |
| `match:accept` | `{ offerId: string }` | Confirms ready check within 10s window. |
| `match:decline` | `{ offerId: string }` | Rejects ready check; triggers penalty ladder. |
| `match:action` | `{ matchId: string, actionId: string, type: "PLAY_CARD" \| "DRAW_CARD" \| "CHOOSE_SUIT", cardId?: string, suit?: WhotSuit, expectedVersion: number }` | Authoritative player turn action. |
| `match:forfeit` | `{ matchId: string }` | Voluntary surrender; counts as LOSS and consumes allowance. |
| `rematch:request` | `{ matchId: string, targetUserId: string }` | Solicits post-game rematch. |
| `rematch:respond` | `{ requestId: string, accept: boolean }` | Answers post-game rematch. |

#### Server-to-Client Events
| Event | Payload Schema | Description |
|---|---|---|
| `session:state` | `{ phase: LobbyPhase, allowance: number, cooldownSeconds: number, currentOffer?: OfferDTO, currentMatchView?: PlayerMatchView }` | Master sync payload. |
| `queue:joined` | `{ ticketId: string, joinedAt: number, estimatedWaitSeconds: number \| null }` | Queue acknowledgement. |
| `queue:status` | `{ elapsedSeconds: number, searchingCount: number, estimatedWaitSeconds: number \| null }` | Periodic 5s queue pulse. |
| `queue:left` | `{ reason: "CANCELLED" \| "TIMEOUT" }` | Confirms queue exit. |
| `match:offer` | `{ offerId: string, expiresAt: number, opponent: { username: string, avatarUrl: string, monthlyWins: number, monthlyPlayed: number } }` | Ready check modal display. |
| `match:offer_update` | `{ offerId: string, playerAccepted: boolean, opponentAccepted: boolean }` | Acceptance status display. |
| `match:started` | `{ matchId: string, view: PlayerMatchView }` | Board initialization. |
| `match:view` | `{ matchId: string, version: number, view: PlayerMatchView, lastAction?: GameActionDTO }` | Incremental turn delta. |
| `match:opponent_connection` | `{ status: "DISCONNECTED" \| "RECONNECTED", graceDeadline: number }` | Disconnection overlay display. |
| `match:ended` | `{ matchId: string, result: "WIN" \| "LOSS" \| "VOID", reason: string, rewards: { points: number, xp: number }, remainingAllowance: number }` | Result screen trigger. |
| `rematch:requested` | `{ requestId: string, expiresAt: number, requester: { id: string, username: string } }` | Rematch modal prompt. |
| `error` | `{ code: ErrorCodeEnum, message: string, retryAfterSeconds?: number }` | Normalized error handler. |

### 3.6 Ready Check & Penalty Ladder (Section 6.11)
When an offer is generated:
1. Both players receive `match:offer` with a strict **10.0-second** deadline.
2. If both accept, transition to `STARTING`.
3. If Player A declines or times out:
   - Player B is re-queued with their **original join timestamp** (`scoreA` preserved), ensuring they remain at the head of the queue.
   - Player A suffers the penalty ladder:
     - 1st offense (within 24h): Warning notification.
     - 2nd offense: 2-minute ranked lockout (`ranked:penalties:{userId}`).
     - 3rd offense: 5-minute ranked lockout.
     - 4th+ offense: 15-minute ranked lockout.

### 3.7 Disconnection, Turn Timers & Reconnect Grace Period
- **Turn Timer:** 30 seconds per turn. If a player fails to act, the server executes a fallback action (`DRAW_CARD`). After 3 consecutive timeouts, the player forfeits (`LOSS`).
- **Connection Loss:** When Socket disconnects during `IN_MATCH`:
  1. The server retains the match in Redis and marks `opponent_disconnected_at = Date.now()`.
  2. Emits `match:opponent_connection` to the opponent with a **30-second countdown**.
  3. If the disconnected player reconnects and emits `session:resume` within 30s, the state is restored seamlessly.
  4. Max cumulative disconnect grace: 60s per match. Exceeding 60s results in automatic forfeit (`LOSS`).
  5. If **both** players disconnect, or if the server crashes and cannot restore state, the match is marked `VOID` (no allowance consumed, no win/loss recorded).

---

## 4. Module 3: Server-Authoritative Whot Engine, State Projection & Bot AI

### 4.1 Anti-Cheat State Projection (`viewFor`)
To prevent memory scrapers and packet analyzers from leaking upcoming cards (finding H12), the server generates a stripped `PlayerMatchView`:

```typescript
export interface AuthoritativeMatchState {
  matchId: string;
  drawPile: WhotCard[];      // Secret to server
  discardPile: WhotCard[];   // Top card public; rest secret
  hands: {
    [userId: string]: WhotCard[]; // Secret: only player's own hand sent
  };
  turnUserId: string;
  turnExpiresAt: number;
  currentSuit: WhotSuit;     // Active shape (Whot 20 special)
  penaltyCount: number;      // Stacked cards to draw
  version: number;
}

export interface PlayerMatchView {
  matchId: string;
  myHand: WhotCard[];
  opponentCardCount: number;
  topCard: WhotCard;
  currentSuit: WhotSuit;
  isMyTurn: boolean;
  turnExpiresAt: number;
  drawDeckCount: number;
  discardDeckCount: number;
  version: number;
}

export function projectPlayerView(state: AuthoritativeMatchState, targetUserId: string): PlayerMatchView {
  const opponentId = Object.keys(state.hands).find(id => id !== targetUserId);
  const opponentHand = opponentId ? state.hands[opponentId] : [];

  return {
    matchId: state.matchId,
    myHand: state.hands[targetUserId] || [],
    opponentCardCount: opponentHand.length,
    topCard: state.discardPile[state.discardPile.length - 1],
    currentSuit: state.currentSuit,
    isMyTurn: state.turnUserId === targetUserId,
    turnExpiresAt: state.turnExpiresAt,
    drawDeckCount: state.drawPile.length,
    discardDeckCount: state.discardPile.length,
    version: state.version,
  };
}
```

### 4.2 Deterministic Shuffle & Event Sourcing
Every match is initialized with an alphanumeric seed:
1. `seed = crypto.randomBytes(16).toString("hex")`
2. Deck initialized using a seeded PRNG (`splitmix32` or `mulberry32`).
3. Every move (`PLAY_CARD`, `DRAW_CARD`, `CHOOSE_SUIT`) is written to `match_events`:
   ```sql
   INSERT INTO match_events (match_id, version, user_id, action_type, payload, created_at)
   VALUES ($1, $2, $3, $4, $5, NOW());
   ```
4. Matches can be replayed deterministically in disputes or anti-cheat audits.

### 4.3 Bot AI Engine (Practice Mode)
- **Practice opponent only; never used in ranked matches** (Decision D16).
- Bot AI runs server-side with zero access to hidden cards (acts strictly on `projectPlayerView`).
- Simulates human latency: delays moves by a random interval between **1.0s and 3.0s** before emitting action.

---

## 5. Module 4: Scrella Engineering Standard Migration & Frontend Architecture

### 5.1 Directory Structure Alignment
Following Step 2e and Section 5.1 of the Build Order, the frontend directory structure is migrated to match the Scrella standard:

```
cash-dey-play-frontend/src/
├── api/                     # methods.api.ts + domain api files
│   ├── methods.api.ts       # getService, postService, etc.
│   ├── auth.api.ts
│   ├── ranked.api.ts
│   ├── practice.api.ts
│   ├── tasks.api.ts
│   └── wallet.api.ts
├── config/
│   ├── client.config.ts
│   ├── ranked.endpoints.ts  # Typed endpoint maps
│   ├── wallet.endpoints.ts
│   └── socketEvents.config.ts
├── container/
│   ├── AppLayout.tsx
│   ├── AppRoute.tsx
│   ├── SearchPill.tsx       # Persistent search bar during navigation
│   └── ConnectionBanner.tsx # Amber reconnect bar
├── helpers/
│   ├── socketService.helpers.ts # Singleton socket connection
│   └── lagosClock.helpers.ts
├── hooks/
│   ├── useMatchmakingSocket.ts
│   ├── useCountdown.ts
│   └── useEntitlements.ts
├── stores/                  # PURE VIEW STATE ONLY
│   ├── auth.stores.ts       # token and user profile
│   ├── matchmaking.store.ts # phase, deadlines, offers
│   └── ui.store.ts          # modals, toasts
├── types/
│   ├── enums/allEnum.types.ts
│   └── interfaces/
│       ├── user.types.ts
│       ├── match.types.ts
│       └── wallet.types.ts
└── views/                   # Renamed from features/
    ├── Lobby/
    │   ├── LobbyView.tsx
    │   └── PageFragments/
    │       ├── RankedAllowanceChip.tsx
    │       ├── CooldownBanner.tsx
    │       ├── ModeCard.tsx
    │       ├── SearchingCard.tsx
    │       ├── MatchOfferSheet.tsx
    │       ├── RecentOpponentsCard.tsx
    │       ├── RecentOpponentRow.tsx
    │       └── RematchRequestSheet.tsx
    ├── Game/
    ├── Tasks/
    ├── Wallet/
    └── Leaderboard/
```

### 5.2 Elimination of Store State Mutation Exploits
Remove all business rules, streak advancement, and premium toggles from `auth.store.ts`:
- **Deleted:** `upgradeToPremium()`, `claimStreakReward()`, `updateUserStats()`.
- **Replaced with React Query Invalidation:** Whenever a server event or mutation finishes (`streak:claimed`, `match:ended`), call `queryClient.invalidateQueries({ queryKey: [UserQueryKeys.GET_PROFILE] })`.

---

## 6. Module 5: Practice Mode, Adsgram Verification & Ad Credits Engine

### 6.1 Daily Limits & Verification Pipeline
- **Regular Players:** Maximum 5 practice matches started per Lagos day (resets at 00:00 Africa/Lagos). Each start requires a verified ad credit. If no ad is available from Adsgram, the player is still permitted to play (Decision D9).
- **Premium Players:** Unlimited practice matches with zero video ads.

### 6.2 Adsgram Server-to-Server Reward Callback
Client-side ad completion is never trusted.
1. The app requests an ad session: `POST /ads/session` -> returns `{ sessionId: string, blockId: string }`.
2. Adsgram plays rewarded video and triggers the backend reward callback:
   ```
   POST /api/ads/reward-callback?token=<ADSGRAM_REWARD_TOKEN>
   Payload: { "session_id": "...", "user_id": "tg_12345", "reward": 1 }
   ```
3. Backend validates secret token, records a row in `ad_credits`:
   ```sql
   INSERT INTO ad_credits (id, user_id, purpose, expires_at, created_at)
   VALUES ($1, $2, $3, NOW() + INTERVAL '10 minutes', NOW());
   ```
4. The client polls `GET /ads/status/:sessionId`. Once `CREDITED`, the client initiates `POST /practice/start`.

---

## 7. Module 6: Entitlements, Daily Tasks & Login Streak Engine

### 7.1 Authoritative Entitlements Service (`entitlements.service.ts`)
The server provides a single endpoint `GET /users/me` resolving what the player can do:

```typescript
export interface UserEntitlements {
  tier: "REGULAR" | "PREMIUM";
  premiumExpiresAt: string | null;
  isAdFreeToday: boolean;
  practice: {
    dailyLimit: number; // 5 for regular, -1 for premium
    playedToday: number;
    adRequired: boolean;
  };
  ranked: {
    dailyLimit: number; // 3
    playedToday: number;
    isInCooldown: boolean;
    cooldownExpiresAt: string | null;
    isLockedOut: boolean;
    lockoutExpiresAt: string | null;
  };
  streak: {
    dayInCycle: number;
    graceDaysRemaining: number;
    completedPracticeInCycle: number;
  };
}
```

### 7.2 Daily Tasks (`daily_task_state`)
Four daily tasks (up to 200 points):
1. `MANDATORY_VIDEO_LOGIN` (50 pts)
2. `MANDATORY_VIDEO_UNLOCK` (50 pts)
3. `WIN_1_MATCH` (50 pts, ranked wins only per Assumption A7)
4. `COMPLETE_ALL_TASKS` (50 bonus pts)

**Premium & Ads-Free Behavior:** Video tasks automatically spawn in state `AUTO_READY`. The user simply taps **Claim** (`POST /tasks/:taskKey/claim`).

### 7.3 Personal 30-Day Streak Window
- Window tracks 30 calendar days starting from the user's first login with **1 grace day**.
- Milestone rewards are determined by the user's tier **at the moment of claiming** (Decision D6):
  - **Regular:** Day 14: ₦50 airtime. Day 20: Ads-free day. Day 30: ₦100 airtime (requires 25 practice matches in the window).
  - **Premium:** Day 10: ₦50 airtime. Day 20: ₦100 airtime. Day 30: ₦200 airtime (25 practice matches waived).
- Atomic claim execution:
  ```sql
  INSERT INTO streak_milestone_claims (user_id, window_index, milestone_day, claimed_at, tier_at_claim)
  VALUES ($1, $2, $3, NOW(), $4);
  -- In same transaction: credit wallet_ledger
  ```

---

## 8. Module 7: Telegram Stars Payments & Premium Subscription System

### 8.1 Plan Economics & Weekly Price Review (A3, D8)
- 1 Month (30 days): Estimated 55 Telegram Stars (~₦1,000 equivalent).
- 3 Months (90 days): Estimated 150 Telegram Stars (~₦2,700 equivalent).
- Price table in database updated weekly via admin script using formula:
  $$\text{Stars} = \left\lceil \frac{\text{Naira Price}}{\text{Naira per USD} \times 0.013} \right\rceil_{\text{round up to 5}}$$

### 8.2 Telegram Bot Webhook Implementation
1. App initiates invoice: `POST /api/premium/orders` -> calls Telegram `createInvoiceLink` with payload `{ order_id: orderId, user_id: userId }`.
2. App opens invoice using `window.Telegram.WebApp.openInvoice`.
3. Telegram Bot webhook receives `pre_checkout_query`:
   - Validates order ID exists, is `PENDING`, and matches price.
   - Responds to Telegram with `answerPreCheckoutQuery(ok=true)`.
4. Telegram Bot webhook receives `successful_payment`:
   - Extracts `telegram_payment_charge_id`.
   - Executes atomic transaction:
     ```sql
     -- 1. Mark order paid
     UPDATE premium_orders SET status = 'PAID', charge_id = $1 WHERE id = $2;
     -- 2. Extend subscription expiry
     INSERT INTO premium_subscriptions (user_id, expires_at)
     VALUES ($3, NOW() + INTERVAL '30 days')
     ON CONFLICT (user_id) DO UPDATE SET
       expires_at = GREATEST(premium_subscriptions.expires_at, NOW()) + INTERVAL '30 days';
     ```
5. Bot sends confirmation message with `/terms` and `/paysupport` links.

---

## 9. Module 8: Wallet Ledger, Payout Engine & Airtime Aggregator Integration

### 9.1 Double-Entry Append-Only Ledger (`wallet_ledger`)
No user balance column is ever updated directly. Balances are derived from the ledger:
$$\text{Available Balance} = \sum \text{Credits} - \sum \text{Debits}$$

```sql
CREATE TABLE wallet_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(64) NOT NULL REFERENCES users(id),
  entry_type VARCHAR(32) NOT NULL, -- 'STREAK_REWARD', 'PRIZE_PAYOUT', 'AIRTIME_REDEMPTION', 'REDEMPTION_REFUND'
  amount_ngn INTEGER NOT NULL,      -- Positive for credit, negative for debit
  idempotency_key VARCHAR(128) UNIQUE NOT NULL,
  reference_id VARCHAR(128),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 9.2 Airtime Provider Adapter & State Machine
1. User requests airtime: `POST /wallet/redemptions` (limits: ₦50 to ₦100,000, whole-naira, Nigerian mobile format).
2. Atomic debit entry written to `wallet_ledger` and row created in `airtime_payouts` with state `PENDING`.
3. BullMQ Worker processes queue item:
   - Derives unguessable provider request ID: `cdp_payout_<id>`.
   - Calls aggregator API (e.g. VTpass).
   - If provider responds `SUCCESS` -> update `SUCCESS`.
   - If provider responds `FAIL` (e.g. invalid number) -> update `FAILED`, write compensating `REDEMPTION_REFUND` credit to `wallet_ledger`.
   - If timeout / network error -> transition to `QUERYING_PROVIDER`. The reconciliation worker polls status using provider request ID. Never re-submit with a new request ID!
   - If provider float balance is below threshold -> mark `WAITING_FOR_FUNDING` and trigger alert.

---

## 10. Module 9: Monthly Game & Community Builder Leaderboards

### 10.1 Derived Eligibility Rules (Month-End Snapshot)
Counters are **never** maintained manually. They are computed dynamically:
1. **Task Days:** $\ge 20$ Lagos calendar days with at least one task claimed.
2. **Ranked Wins:** $\ge 15$ completed ranked match victories in the month.
3. **Practice Matches (Regulars):** $\ge 25$ completed practice matches in the month (waived for Premium).

### 10.2 Ranking Formula & Settlement
$$\text{Score} = \text{Win Rate} \times \left( \frac{\text{Ranked Matches Played}}{50} \right)$$
- Top 100 players qualify for the prize pool (PRD Section 6 tiers: 27%, 24%, 18%, 14%, 9%, 8%).
- Month close job runs at `00:00:00 Africa/Lagos` on the 1st of every month.
- Freezes results into `leaderboard_results`. Top 20 are flagged for admin review (win-trading and multi-account verification) before automated ledger credit.

---

## 11. Module 10: Step-by-Step Implementation Roadmap (Steps 0 through 13)

### Step 0: Decisions & Architecture Finalization
- **Backend Host:** DigitalOcean App Platform / Render / AWS ECS (Region: Frankfurt `eu-central-1` or London `eu-west-2` for lowest latency to Lagos).
- **Rulebook Sign-Off:** Establish written Whot rules (Pick Two, Pick Three, General Market, Hold On, Suspension, Whot 20).
- **Staging Bot:** Create `@Cash_dey_play_staging_bot` in BotFather.

### Step 1: Security & Exploit Lockdown
- Fail-safe environment config (`env.config.ts` requires 32+ char secret in production).
- Remove fake endpoints (`/premium/subscribe`, `/tasks/record-match`).
- Atomic task points award in `tasks.repository.ts`.
- Return 501 for unbuilt match stubs.

### Step 2: Foundations & Scrella Standard Migration
- Consolidate identity to `tg_<telegramId>`.
- Deploy `LagosCalendarClock` utility.
- Expose authoritative `GET /config/rules`.
- Execute frontend folder rename (`features/` -> `views/`, `store/` -> `stores/`, `methods.api.ts`).
- Add Vercel rewrite file (`vercel.json`).

### Step 3: Entitlements Service & Daily Tasks
- Build `entitlements.service.ts` and `GET /users/me`.
- Implement `daily_task_state` table with `AUTO_READY` for premium players.
- Expose `POST /tasks/:taskKey/claim`.

### Step 4: Referral System
- Generate random 8-character referral codes.
- Parse `start_param` on login and associate referrer.
- Expose `GET /referrals/summary`.

### Step 5: Server Whot Engine & Bot
- Pure TypeScript Whot game engine (`whot-engine.ts`) with deterministic PRNG shuffle.
- Anti-cheat state projection (`projectPlayerView`).
- Bot AI player with 1.0-3.0s delay.

### Step 6: Realtime Socket Gateway & Practice Mode
- Socket.io gateway with JWT authentication handshake.
- Adsgram callback endpoint and `ad_credits` single-use tracking.
- Practice mode: 5/day limit for regulars, unlimited for premium.

### Step 7: Ranked Matchmaking & Rematch System
- Redis matchmaking queue (`ZSET`), leader-locked matchmaker loop, atomic Lua script.
- 10s Ready Check offer flow and penalty ladder.
- 30s turn timer and 30s disconnect grace period.
- Frontend Lobby views and page fragments (`RankedAllowanceChip`, `SearchingCard`, `MatchOfferSheet`, `RecentOpponentsCard`).

### Step 8: Streak Rewards, Gates & Ads-Free Day
- Personal 30-day window with 1 grace day.
- 25 practice match gate verification for Regular Day 30.
- Immediate wallet ledger credit on claim.

### Step 9: Telegram Stars Payments & Premium Views
- Telegram Bot webhook with secret token verification.
- Pre-checkout and successful payment handlers.
- Auto-extending subscription expiry.

### Step 10: Wallet Payouts & Airtime Aggregator
- Ledger debit and compensating refund flow.
- BullMQ payout worker with provider status query and float monitoring.
- Masked mobile numbers in client views and logs.

### Step 11: Leaderboard Engine & Month-End Settlement
- Dynamic eligibility query from match and task logs.
- Month-end freeze job and admin review dashboard.

### Step 12: Banner Ads
- Controlled `AdBanner` component with reserved layout height and kill-switch in `/config/rules`.

### Step 13: Hardening, Load Testing & Launch
- Simulate 5,000 concurrent socket connections.
- End-to-end rehearsal of low-float and refund runbooks.
- Staged closed beta rollout.

---

## 12. Module 11: Resolution of Open Items (O1 to O15) & Security Runbooks

| Item | Topic | Recommended Technical Resolution |
|---|---|---|
| **O1** | Backend Host | **Render** or **DigitalOcean App Platform** (Frankfurt/London region) with managed PostgreSQL and Redis. Supports persistent WebSocket connections. |
| **O2** | Whot Rules | Standard Nigerian Whot: Pick 2 (+2 cards), Pick 3 (+3 cards), General Market (everyone draws 1), Hold On (replay), Suspension (skip turn), Whot 20 (declare suit). No penalty stacking. |
| **O3** | Timers | Cooldown: 60 mins. Turn timer: 30 secs. Disconnect grace: 30 secs (60s max/match). Ready check: 10 secs. Queue timeouts: 30s (offer practice) and 120s (abort). |
| **O4** | Assumptions A1-A9 | **YES to all**. All coded into `/config/rules`. |
| **O5** | Float Operations | Threshold: ₦50,000. Daily cap: ₦10,000 per user. Named owner receives Telegram alert when float dips below threshold. |
| **O6** | Same-Opponent Limits | Max 2 matches against the same player per day. Max 3 rematch requests per hour. |
| **O7** | No Bots in Ranked | **Confirmed**. Ranked queues never fill with bots. Practice is the designated fallback. |
| **O8** | Stars Pricing | 1 Month: 55 Stars. 3 Months: 150 Stars. Reviewed every Monday morning against NGN/USD rates. |
| **O9** | Banners | Banners restricted to Home, Tasks, Profile, and Lobby Idle. Never inside a live match or beside payment buttons. |
| **O10** | 'Win 1 Match' Task | Ranked matches only. Practice wins do not count. |
| **O11** | Legal Review | Terms and Rules page link placed in footer and modal. |
| **O12** | Prize Finance | 25% net revenue prize pool distribution: 1st (27%), 2nd (24%), 3rd (18%), 4th (14%), 5th (9%), 6th-100th (8% distributed). |
| **O13** | Ranked Prime Time | Configurable daily window (e.g. 19:00 - 22:00 Lagos) with double points / active queue banner. |
| **O14** | Staging Bot | Setup `@Cash_dey_play_staging_bot` with dedicated webhook URL. |
| **O15** | Scrella Alignment | **Approved**. Execute Step 2e migration package immediately. |

---
*End of Master Implementation Specification.*
