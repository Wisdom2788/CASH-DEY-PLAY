# Cash Dey Play — Design System & Screen Specification

> **Purpose:** This document is the implementation source of truth for recreating the generated Cash Dey Play UI.
>
> **Primary reference:** `cash-dey-play-design-reference.png`
>
> **Product:** Telegram Mini App for a free-to-play Nigerian Whot card game.
>
> **Launch market:** Nigeria only.
>
> **Core product principle:** competitive gameplay + progression + airtime/data rewards, never cash rewards or gambling mechanics.

---

## 1. Reference and Design Intent

The attached reference image is the visual source of truth for the overall composition, hierarchy, density, spacing rhythm, color relationships, component styling, and screen patterns.

The interface should feel like:

- An **Afrobeats concert poster translated into a polished mobile esports UI**
- A **night-time game table / scoreboard**, not a fintech dashboard
- Energetic, Nigerian, celebratory, premium, and highly legible
- Dense enough to feel game-like, but never cluttered
- Dark-first, with bright green/orange/gold accents creating the visual energy
- Built specifically for **Telegram Mini App chrome**, not a standalone consumer app with a duplicate authentication flow

Do **not** drift toward:

- Generic casual-game UI
- Casino UI
- Betting/gambling UI
- Corporate banking/fintech UI
- Excessive glassmorphism
- Flat monochrome productivity UI
- Generic mobile-game fantasy styling

---

# 2. Brand System

## 2.1 Brand Name

**Cash Dey Play**

The name should always retain the Nigerian street-pop personality.

Recommended display treatment:

- `CASH` — strongest emphasis
- `DEY` — secondary emphasis
- `PLAY` — strongest emphasis
- Use stacked or compressed logo compositions where space allows
- Logo should feel like an event poster / esports lockup rather than a wordmark for a financial product

## 2.2 Brand Descriptor

Recommended lockup descriptor:

**WHOT • PLAY • WIN**  
**AIRTIME & DATA REWARDS**

This establishes the product loop without suggesting monetary gambling.

## 2.3 Brand Voice

Copy should be:

- Short
- Confident
- Nigerian-flavoured without forcing slang into every string
- Celebratory
- Competitive
- Clear
- Friendly

Examples:

- `PLAY NOW`
- `QUICK MATCH`
- `RANKED MATCH`
- `PLAY WITH FRIENDS`
- `YOU WIN!`
- `GREAT GAME!`
- `LAST CARD!`
- `STREAK DAY 14`
- `TOP 100`
- `BOOST REWARDS`
- `REFER & EARN`

Avoid:

- `BET`
- `WAGER`
- `STAKE`
- `ODDS`
- `CASH OUT`
- casino/chance terminology
- language implying paid entries or prize pools

---

# 3. Visual Language

## 3.1 Overall Mood

The visual language is **dark, luminous, energetic, competitive**.

Surfaces should look as though they are being illuminated by a scoreboard or arcade table rather than lit like a standard SaaS dashboard.

Key visual ingredients:

1. Near-black base
2. Bright Nigerian emerald green
3. Vivid orange/red-orange action accent
4. Trophy/achievement gold
5. Subtle electric purple/magenta for tertiary accents
6. Off-white typography
7. Thin green or dark-gray borders
8. Soft environmental glow
9. Rounded chunky cards
10. Strong iconography

## 3.2 Background Treatment

Primary background:

`#111214`

Secondary surface:

`#1A1B1E`

The background should not be visually flat.

Use a **very subtle Whot-card shape pattern** at low opacity on splash/boot and selected hero areas:

- Circle outlines
- Triangles
- Crosses
- Squares
- Stars
- Very-low-opacity line geometry
- Large spacing
- No repetitive wallpaper feel

Recommended pattern opacity:

`3–7%`

Do not allow the pattern to compete with game content.

---

# 4. Color System

## 4.1 Core Palette

| Token | Hex | Usage |
|---|---:|---|
| `bg-primary` | `#111214` | App background |
| `bg-surface` | `#1A1B1E` | Cards / panels |
| `bg-surface-soft` | `#202226` | Secondary cards / inputs |
| `brand-green` | `#009951` | Primary brand accent |
| `brand-green-bright` | `#00B85F` | Active/highlight states |
| `achievement-gold` | `#F2B705` | Streaks, trophies, ranking highlights |
| `action-orange` | `#FF5A36` | Primary CTA / live gameplay |
| `electric-purple` | `#7A2BE2` | Selected tertiary / cosmetic accent |
| `text-primary` | `#F5F5F0` | Main text |
| `text-secondary` | `#9A9A9A` | Supporting copy |
| `text-muted` | `#6F7278` | Low-emphasis metadata |
| `border-subtle` | `#303338` | Card boundaries |
| `success-soft` | `#0D6B3E` | Success background |
| `danger` | `#E94B4B` | Errors/loss states |
| `info` | `#3D8BFF` | Informational highlights |

## 4.2 Color Roles

### Emerald green

Use for:

- Brand
- Active navigation
- Successful task completion
- Live status
- Positive progression
- Eligibility
- Selected leaderboard state
- Primary secondary buttons

### Orange

Use for:

- Main gameplay CTA
- `PLAY NOW`
- `QUICK MATCH`
- High-energy interaction
- Timer urgency
- Major match moments

Orange should feel like the **action color**, not the brand color.

### Gold

Use for:

- Streaks
- Trophies
- Rank badges
- Achievement markers
- Reward moments
- Winner emphasis

Gold must look like **achievement / medal gold**, never casino gold.

### Purple / magenta

Use sparingly for:

- Premium
- Cosmetic card-back accents
- Secondary player categories
- Selected decorative elements

---

# 5. Typography

## 5.1 Recommended Type Families

The reference design uses a bold geometric display style paired with a highly legible UI sans.

### Display / Headline

Recommended:

**Bebas Neue**

Use for:

- Brand headings
- Match results
- Large countdown numbers
- Section hero headings
- Major scores
- Large ranking numbers
- Event-like labels

Characteristics:

- Condensed
- Tall
- Strong
- Poster-like
- High-impact

### UI / Body

Recommended:

**Inter**

Use for:

- Navigation
- Body copy
- Buttons
- Labels
- Status chips
- Settings rows
- Match controls
- Leaderboard metadata

### Numeric emphasis

Use a tabular-number-capable sans font.

Recommended:

**Inter with `font-variant-numeric: tabular-nums;`**

Use for:

- Timers
- Scores
- Match statistics
- Rank values
- Streak counts
- Reward balances
- Leaderboard scores

## 5.2 Typography Scale

Recommended baseline scale:

| Role | Size | Weight | Line Height |
|---|---:|---:|---:|
| Display XL | 48–56px | 800 | 0.95–1.0 |
| Display | 36–44px | 800 | 0.95–1.0 |
| H1 | 28–32px | 800 | 1.05 |
| H2 | 22–26px | 750 | 1.1 |
| H3 | 17–20px | 700 | 1.15 |
| Body | 14–16px | 400–600 | 1.35 |
| Caption | 11–13px | 500–700 | 1.2 |
| Numeric XL | 32–44px | 800 | 1.0 |
| Button | 13–15px | 750–800 | 1.0 |

## 5.3 Case Rules

Prefer:

- ALL CAPS for major action labels
- Title Case for screen titles
- Sentence case for explanations

Examples:

`PLAY NOW`  
`QUICK MATCH`  
`Daily Tasks`  
`Premium never affects your odds or leaderboard eligibility`

---

# 6. Shape Language

The design system uses **chunky rounded geometry**.

## 6.1 Border Radius Tokens

| Token | Radius |
|---|---:|
| `radius-xs` | 8px |
| `radius-sm` | 12px |
| `radius-md` | 16px |
| `radius-lg` | 20px |
| `radius-xl` | 24px |
| `radius-pill` | 999px |

Primary cards should normally use:

**16–20px radius**

Large hero/result cards:

**20–24px**

Buttons/status chips:

**999px**

## 6.2 Borders

Use subtle borders instead of heavy shadows.

Default:

`1px solid #303338`

Active:

`1px solid #009951`

Achievement:

`1px solid rgba(242,183,5,0.45)`

Avoid bright white borders.

---

# 7. Elevation and Glow

The UI does not depend on large drop shadows.

Preferred model:

- dark surface
- subtle border
- low-opacity colored glow

Examples:

### Green active glow

`0 0 20px rgba(0,153,81,0.16)`

### Orange CTA glow

`0 0 22px rgba(255,90,54,0.18)`

### Gold achievement glow

`0 0 22px rgba(242,183,5,0.16)`

Glow should be environmental and restrained.

Do not make every element glow.

---

# 8. Spacing System

Use an 4px / 8px rhythm.

Recommended spacing tokens:

| Token | Value |
|---|---:|
| `space-1` | 4px |
| `space-2` | 8px |
| `space-3` | 12px |
| `space-4` | 16px |
| `space-5` | 20px |
| `space-6` | 24px |
| `space-8` | 32px |
| `space-10` | 40px |
| `space-12` | 48px |

Typical screen padding:

**16px**

Large hero sections:

**20–24px**

---

# 9. Buttons

## 9.1 Primary CTA

Appearance:

- Orange fill
- Black / near-black text
- Bold uppercase
- Pill shape
- Large enough for thumb interaction
- Optional subtle orange glow

Example:

`PLAY NOW`

Recommended height:

**48–52px**

## 9.2 Green Secondary CTA

Appearance:

- Green outline or green fill
- White text on filled variant
- Rounded pill

Examples:

`INVITE FRIENDS`  
`CLAIM`

## 9.3 Dark Secondary

Appearance:

- `#1A1B1E`
- subtle border
- off-white text

Used for:

- Rematch
- Settings
- Supporting actions

## 9.4 Disabled

Use:

- `#303338` or muted gray surface
- `#6F7278` text
- no glow

---

# 10. Status Pills

Pills are core to the visual system.

Examples:

- `Live Match`
- `Streak Day 14`
- `Rank #23`
- `Task 2/4`
- `20/20 Days`
- `15 Wins`
- `Grace Day Used`
- `Online`
- `Rematch`

Visual rules:

- 11–13px text
- 650–750 weight
- 28–32px height
- 999px radius
- compact horizontal padding
- icon + label where useful

Recommended colors:

| Type | Background | Text |
|---|---|---|
| Live | green translucent | green/white |
| Streak | gold translucent | gold |
| Rank | purple translucent | white |
| Task | dark gray | white |
| Success | green translucent | green |
| Warning | orange translucent | orange |

---

# 11. Icon Set Preview

Iconography should be simple, bold, and rounded.

Preferred visual language:

- Filled or semi-filled icons
- 1.75–2px visual stroke equivalent
- Rounded endpoints
- Compact silhouettes
- Avoid ultra-thin line icons

Primary navigation icon set:

- Game controller → **Play**
- Checklist / clipboard → **Tasks**
- Trophy → **Leaderboard**
- Gift / package → **Rewards**
- Users / people → **Friends / Referrals**
- Crown → **Premium**
- User circle → **Profile**
- Gear → **Settings**

## Functional Icons

Use icons for:

- Telegram
- Search
- Share
- Copy
- Bell
- Globe/language
- Help
- Signal bars
- Mobile phone
- Data package
- Trophy
- Crown
- Fire/streak
- Play
- Gift
- User group
- Arrow up/down
- Check
- Lock
- Clock
- Timer
- Refresh/rematch
- Volume/chat/reaction

## Reward Iconography

Rewards MUST read as:

- airtime
- mobile top-up
- data package
- communication benefits

Preferred symbols:

- smartphone
- signal bars
- data packet
- cellular bars
- gift card/package
- telecom-style badge

Never use:

- naira notes
- cash stacks
- coin piles
- casino chips
- slot icons

---

# 12. Whot Card Design

Whot cards are a major visual identity element and must remain immediately recognizable.

## 12.1 Five Shapes

Use the exact five Whot shape families:

1. **Circle**
2. **Triangle**
3. **Cross**
4. **Square**
5. **Star**

Each shape should retain a vivid, game-readable color identity.

Suggested display colors:

| Shape | Suggested accent |
|---|---|
| Circle | Blue |
| Triangle | Yellow |
| Cross | Red |
| Square | Green |
| Star | Purple |

The exact colors can be tuned for contrast, but the shapes must remain distinct even for users with imperfect color perception.

## 12.2 Card Anatomy

Every normal card should contain:

- Top-left number
- Main central shape
- Optional lower/right number marker depending on card type
- White/off-white card body
- Dark text
- Soft border
- Mild shadow
- Slight corner radius

Recommended card radius:

**10–14px**

## 12.3 Whot / Wild Card

The Whot/wild card should use:

- multi-color circular or radial motif
- prominent `W`
- strong contrast
- visual hierarchy above normal cards

It must look like a special game card, not a prize token.

---

# 13. Game Table

The gameplay screen is the most visually immersive screen.

## Table Surface

Use a dark near-black/charcoal table:

`#101516` → `#161C19` range

Optional extremely subtle radial green glow beneath active areas.

## Table Objects

Center:

- Draw pile / Market
- Discard pile
- Last played card
- Special state indicators

Top:

- Opponent avatar
- Opponent name
- Card count
- Online/live state
- Turn timer

Bottom:

- Player hand
- Action buttons
- Reaction bar

## Active Turn

The active player area gets:

- green halo
- subtle animated pulse
- timer emphasis
- `YOUR TURN` / `OPPONENT'S TURN`

Animation should be noticeable but never distracting.

---

# 14. Splash / Boot Screen

## Purpose

Very brief Mini App boot state.

## Layout

Top/center:

**Cash Dey Play logo**

Background:

- dark charcoal
- subtle animated Whot shapes
- extremely low opacity

Bottom:

- loading indicator
- `Loading table...`
- `Built for Telegram`

The reference screen uses a green progress bar.

Important:

Do not add a sign-up form.

Telegram supplies:

- identity
- avatar
- username

## Motion

Animation:

- logo scale/fade
- slow floating card symbols
- green progress sweep

Duration should feel instant.

Target perceived time:

**~0.5–1.5 seconds**

---

# 15. Home Dashboard

## Header

Contains:

- Telegram avatar
- Telegram display name
- small greeting
- compact app identity/header
- Telegram-native back/navigation chrome

Example:

`Good evening, Chinedu. 👋`

## Primary Sections

### Streak Card

Shows:

- current day
- `Streak Day 14`
- Grace Day availability
- horizontal 30-day strip
- current day highlighted in gold/green

### Wallet Card

Shows:

- Airtime & Data
- available balance
- signal/data iconography

### Daily Tasks

Shows:

- `2 / 4 Completed`
- next task
- compact progress indicator

### Leaderboard Preview

Shows:

- `#23`
- current rank
- upward/downward trend
- short comparison such as previous period

### Primary CTA

Large orange:

`PLAY NOW`

### Rewarded Video Booster

Compact card:

- clearly labeled `Optional`
- `Watch video to earn rewards`
- reward amount in airtime/data terms
- never make it look mandatory

---

# 16. Matchmaking / Lobby

Header:

`CHOOSE HOW TO PLAY`

Three large selector cards:

### Quick Match

- Orange
- lightning icon
- `Find an opponent instantly`

### Ranked Match

- Green
- trophy icon
- `Compete for the leaderboard`

### Play With Friends

- Purple
- people icon
- Telegram invite/share flow

## Search State

Show:

- animated search indicator
- green ring / radar treatment
- `Searching for opponent...`
- estimated wait text
- cancel action

## Recent Opponents

Circular avatars with:

- player name
- match history state
- `Rematch`

## Invite

Full-width green pill:

`INVITE FRIENDS`

Use Telegram sharing rather than an in-app contacts database.

---

# 17. Match / Gameplay Screen

## Header / Opponent Area

Top-center:

- opponent avatar
- name
- online status
- card count

Example:

`Tayo_92`  
`7 Cards`

## Turn Timer

Top-right:

- circular timer
- numeric seconds
- orange urgency
- green active-turn glow

Example:

`23s`

## Center Table

Objects:

- Draw / Market pile
- Last played card
- Discard pile

Keep the play area visually open.

## Last Card CTA

Large orange button:

`LAST CARD!`

Only enable when the player's rules state permits it.

## Player Hand

Bottom:

- fan of cards
- cards partially overlapping
- selected card rises slightly
- selected card receives green/orange glow

Recommended overlap:

**15–25%**

## Reactions

Compact bottom reaction bar:

- 😂
- 😎
- 🔥
- 👏
- 😮
- 💬

Reactions should be lightweight and non-intrusive.

---

# 18. Match Result

This is a celebration screen, not a financial transaction receipt.

## Win State

Hero:

`YOU WIN!`

Use:

- trophy
- gold glow
- subtle particles/confetti
- opponent/player avatars
- score comparison

Example:

`95 vs 70`

## Reward Breakdown

Show:

- Match Points
- Streak Progress
- Task Progress
- Airtime/Data Earned

Each row gets a small icon.

## Primary Actions

Orange:

`REMATCH`

Telegram-style blue/neutral action:

`SHARE TO TELEGRAM`

## Loss State

Use:

- encouraging tone
- no humiliation
- show progression that was preserved

Example:

`GOOD GAME!`

---

# 19. Daily Tasks & Streak

Use a tabbed structure:

`Daily Tasks` | `Streak Calendar`

## Daily Tasks

Each task row contains:

- icon
- task title
- progress
- progress bar
- reward
- `CLAIM` or `WATCH`

Example:

`Play 2 matches`  
`2/2`  
`CLAIM`

## Progress Bars

Use:

- dark track
- green progress
- rounded ends

Avoid oversized progress graphics.

## Streak Calendar

30-day calendar:

- completed = green circle/check
- current = highlighted ring
- grace day = gold/amber marker
- missed = neutral gray
- future = dimmed

The one grace day must be visually distinct.

Example label:

`Grace Day Used`

## Optional Video Boost

A small secondary module:

`Watch rewarded video`

Never present this as required for participation.

---

# 20. Monthly Leaderboard

## Header

`MONTHLY LEADERBOARD`

Supporting copy:

`TOP 100`

Show countdown to reset:

`Resets in 12d 00h 10m`

## Top Three

Special podium:

- Rank 1 → gold
- Rank 2 → silver/light neutral
- Rank 3 → bronze

The primary design language can still remain within the dark/green/gold system.

## Leaderboard Rows

Every row:

- rank
- avatar
- username
- score
- optional movement indicator

Player's own row:

- green highlight
- slightly brighter surface
- pinned/highlighted treatment

## Eligibility

Two progress conditions must both be visible:

`20` non-consecutive task days  
`15` match wins

Display as compact dual progress cards:

`14/20`  
`11/15`

Do not imply that users can buy eligibility.

## Reward Tiers

Show rewards as:

- airtime amounts
- data packages
- telecom-style reward badges

Never display:

- cash prize
- money withdrawal
- bank transfer

---

# 21. Rewards & Wallet

## Hero Balance

Primary:

`AIRTIME & DATA BALANCE`

Example:

`₦2,500`

The number here represents reward redemption value; the visual presentation should still emphasize telecom redemption rather than cash ownership.

Include:

- signal-bars icon
- phone/data icon

## Redeem Reward

Flow:

1. Choose network
2. Choose airtime/data
3. Enter amount
4. Confirm
5. Success

Networks can use Nigerian telecom names/logos where licensed/appropriate.

## History

Rows show:

- reward type
- network
- amount
- status
- timestamp

## Referral Earnings

Small summary module.

No `Withdraw`, `Cash Out`, or `Transfer to Bank` action is allowed.

---

# 22. Referral Screen

## Hero

`REFER & EARN`

Subtitle:

`Invite friends. Play together. Earn airtime & data rewards.`

## Referral Code

Large code card:

`CDP-CHINED`

Actions:

- `COPY`
- `SHARE`

## Telegram Link

Display compact shareable link.

Use Telegram's native share flow.

## Friends

Rows include:

- avatar
- username
- joined status
- active status
- reward earned

Possible status labels:

- `Joined`
- `Active`
- `Reward Earned`
- `Pending`

## Reward Ladder

A horizontal/vertical ladder:

`1 Friend → reward`  
`5 Friends → reward`  
`10 Friends → reward`  
`20 Friends → reward`

Use airtime/data visuals, not coins or cash.

---

# 23. Premium Screen

Premium is explicitly cosmetic/convenience-only.

## Heading

`GO PREMIUM`

Subtitle:

`Cosmetics & Convenience Only`

## Comparison Cards

Example tiers:

### Basic

`Free`

Benefits:

- Ads in match
- Standard card backs
- Normal queue

### Premium

Example:

`₦1,200 / mo`

Benefits:

- Ad-free matches
- Exclusive card backs
- Premium badge
- Priority matchmaking
- Support the game

### Premium+

Optional tier.

Focus on:

- more cosmetics
- additional customisation
- profile visual effects

## Mandatory Safety Copy

Place near the primary CTA:

> `Premium never affects your odds or leaderboard eligibility`

This must remain visually persistent.

Do not place:

- odds
- win-rate modifiers
- matchmaking advantage that changes competitive fairness
- probability language
- gambling language

---

# 24. Profile & Stats

## Profile Header

Contains:

- Telegram avatar
- username
- online state
- optional edit profile action

## Stats Grid

Four-to-six stat tiles:

- Matches Played
- Win Rate
- Current Streak
- Best Streak
- Current Rank
- Total Wins / Points

Use bold tabular numerals.

## Card Back Customization

Show visual card-back thumbnails.

States:

- Locked
- Unlocked
- Equipped

Premium cosmetics can use:

- purple
- gold
- green
- animated accent borders

## Avatar Frames

Show selectable/unlocked frame styles.

## Settings

Rows:

- Notifications
- Language
- Help & Support
- About Cash Dey Play

Do not create a redundant account/security system for Telegram identity.

---

# 25. Navigation

Recommended persistent bottom navigation:

1. **Home**
2. **Tasks**
3. **Play**
4. **Leaderboard**
5. **Profile**

Rewards/Referrals/Premium can be reached from Home/Profile surfaces.

The center `Play` tab can receive the strongest visual treatment.

Active icon:

- green
- optional small glow
- strong label

Inactive:

- muted gray

---

# 26. Telegram Mini App Conventions

The product is not a standalone app shell.

Use Telegram native behavior:

- Telegram header/back button
- Telegram user identity
- Telegram avatar
- Telegram share sheet
- Telegram WebApp theme variables where appropriate
- safe-area handling
- native light/dark theme compatibility

Do not create:

- email signup
- password signup
- duplicate profile-registration flow
- redundant authentication splash

The boot screen should only initialize the Mini App.

---

# 27. Light Theme Adaptation

Dark mode is primary, but the UI must work with Telegram's light theme.

Do NOT simply invert colors.

Map surfaces semantically:

| Dark token | Light adaptation |
|---|---|
| `#111214` | `#F4F4F1` |
| `#1A1B1E` | `#FFFFFF` |
| `#202226` | `#F0F1EE` |
| `#F5F5F0` | `#151618` |
| `#9A9A9A` | `#666A70` |
| `#303338` | `#D9DBD8` |

Maintain:

- emerald primary
- orange action
- gold achievement
- distinct Whot card colors

Reduce glow intensity in light mode.

---

# 28. Motion Design

Motion should feel like **sports/esports UI**, not casino animation.

## Recommended Animations

### Button press

`scale(0.98)`  
Duration: 100–140ms

### Card selection

- translateY(-8 to -14px)
- subtle glow
- 150–220ms

### Match found

- green pulse
- opponent avatar reveal
- 250–400ms

### Victory

- trophy scale-in
- gold particles
- score count-up
- 500–900ms

### Streak claimed

- streak marker glow
- number count-up
- 400–700ms

### Rank up

- rank number transition
- green/gold accent
- directional movement

Avoid:

- slot-machine reels
- roulette spins
- scratch-to-reveal
- spinning prize wheels
- coin showers

---

# 29. Accessibility

Even with the expressive aesthetic, gameplay must remain highly readable.

## Requirements

- Minimum touch target: **44×44px**
- Strong text contrast
- Do not rely only on color to distinguish card shapes
- Every Whot shape must be visually distinct
- Timer should include numerals, not only a color change
- Selected card state should use position + glow + border
- Status should use icon + text + color where possible

---

# 30. Responsive Behavior

Primary target:

**Telegram mobile viewport**

Recommended breakpoints:

- 320–359px: compact
- 360–389px: default small mobile
- 390–430px: large mobile
- 431px+: tablet/desktop Mini App container behavior

## Mobile Rules

Cards and controls should scale down before removing information.

Prioritize:

1. Game table
2. Player hand
3. Turn state
4. Timer
5. Last Card
6. Primary action

For dashboard:

Prioritize:

1. Greeting
2. Streak
3. Play Now
4. Tasks
5. Rank
6. Rewards

---

# 31. Component Inventory

A production implementation should create reusable components for:

### Brand

- `Logo`
- `Wordmark`
- `BrandLockup`

### Navigation

- `TopBar`
- `BottomNav`
- `NavItem`

### Cards

- `SurfaceCard`
- `HeroCard`
- `StatCard`
- `RewardCard`
- `TaskCard`
- `LeaderboardRow`
- `PremiumPlanCard`

### Controls

- `PrimaryButton`
- `SecondaryButton`
- `IconButton`
- `PillButton`
- `SegmentedSelector`
- `Toggle`
- `ProgressBar`
- `CountdownTimer`

### Status

- `StatusPill`
- `LiveBadge`
- `RankBadge`
- `StreakBadge`
- `EligibilityBadge`

### Gameplay

- `WhotCard`
- `CardHand`
- `DrawPile`
- `DiscardPile`
- `TurnIndicator`
- `OpponentPanel`
- `ReactionBar`
- `LastCardButton`

### Rewards

- `RewardBalance`
- `NetworkSelector`
- `TopUpForm`
- `RewardHistory`
- `ReferralLadder`

### Profile

- `Avatar`
- `AvatarFrame`
- `CardBackPicker`
- `StatsGrid`
- `SettingsRow`

---

# 32. Component State Rules

Every interactive component should have clear states.

## Buttons

- default
- pressed
- hover (where applicable)
- focused
- disabled
- loading
- success

## Cards

- default
- selected
- active
- completed
- locked
- premium
- unavailable

## Tasks

- incomplete
- in-progress
- claimable
- claimed
- optional-video

## Leaderboard

- normal
- top 3
- own row
- rank up
- rank down

## Match

- searching
- found
- opponent turn
- your turn
- last-card warning
- match finished
- reconnecting

---

# 33. Reward Design Rules

The reward economy must visibly communicate utility rather than gambling.

Reward UI should use:

- phone
- signal
- data package
- gift
- badge
- trophy

Reward UI should never use:

- stacks of cash
- coins
- banknotes
- betting slips
- casino chips
- roulette
- slot machine
- jackpot imagery

The central reward message is:

**Play → progress → earn airtime/data**

Not:

**pay → risk → win money**

---

# 34. Data and Status Presentation

Use compact labels and tabular numbers.

Examples:

`128 Matches Played`

`68% Win Rate`

`14 Days`

`#23`

`1,620 Points`

`₦2,500`

`14/20`

`11/15`

Timers:

`23s`

`12d 00h 10m`

Avoid excessively verbose labels in high-frequency gameplay screens.

---

# 35. Screen-to-Screen Visual Continuity

Every screen should feel like the same product.

Shared traits:

- dark charcoal surface
- rounded cards
- green active state
- orange action state
- gold achievement state
- off-white primary type
- gray secondary type
- subtle border
- compact pills
- bold numeric hierarchy

The following screens should intentionally share components:

### Home ↔ Tasks

- streak card
- progress indicators
- task status

### Home ↔ Leaderboard

- rank card
- movement indicator
- score hierarchy

### Home ↔ Rewards

- reward balance
- telecom icons

### Match ↔ Result

- avatars
- player names
- scores
- Whot cards

### Profile ↔ Premium

- card backs
- avatar frames
- cosmetic unlock states

---

# 36. Implementation Tokens

Recommended CSS variable foundation:

```css
:root {
  --cdp-bg: #111214;
  --cdp-surface: #1A1B1E;
  --cdp-surface-soft: #202226;

  --cdp-green: #009951;
  --cdp-green-bright: #00B85F;

  --cdp-gold: #F2B705;
  --cdp-orange: #FF5A36;
  --cdp-purple: #7A2BE2;

  --cdp-text: #F5F5F0;
  --cdp-text-secondary: #9A9A9A;
  --cdp-text-muted: #6F7278;

  --cdp-border: #303338;
  --cdp-danger: #E94B4B;
  --cdp-info: #3D8BFF;

  --cdp-radius-sm: 12px;
  --cdp-radius-md: 16px;
  --cdp-radius-lg: 20px;
  --cdp-radius-xl: 24px;
  --cdp-radius-pill: 999px;

  --cdp-page-padding: 16px;
}
```

---

# 37. Suggested Frontend Architecture

Recommended implementation approach:

```text
src/
├── app/
│   ├── routes/
│   ├── providers/
│   └── theme/
├── components/
│   ├── brand/
│   ├── navigation/
│   ├── surfaces/
│   ├── buttons/
│   ├── badges/
│   ├── cards/
│   ├── rewards/
│   ├── profile/
│   └── game/
├── features/
│   ├── home/
│   ├── matchmaking/
│   ├── gameplay/
│   ├── results/
│   ├── tasks/
│   ├── leaderboard/
│   ├── rewards/
│   ├── referrals/
│   ├── premium/
│   └── profile/
├── assets/
│   ├── cards/
│   ├── icons/
│   ├── avatars/
│   └── backgrounds/
└── styles/
    ├── tokens.css
    ├── typography.css
    └── animations.css
```

---

# 38. Source-of-Truth Rules for an Implementing Agent

When implementation details are ambiguous, follow this priority order:

1. **Generated reference image**
2. **This design specification**
3. Product functional requirements
4. Standard Telegram Mini App conventions
5. Implementation best judgement

Do not introduce a new visual pattern when an existing component can be reused.

Do not replace a distinctive Cash Dey Play treatment with a generic library component just because it is easier.

---

# 39. Non-Negotiable Visual Constraints

The resulting app MUST preserve:

- Dark primary theme
- Nigerian emerald green brand accent
- Orange primary action color
- Gold achievement language
- Rounded 16–20px card system
- Pill-shaped controls/statuses
- Bold geometric headings
- Legible UI sans
- Tabular numeric hierarchy
- Vivid Whot shape colors
- Soft glow instead of heavy shadow
- Telegram-native identity/chrome
- Nigerian street-pop / Afrobeats energy
- Airtime/data reward visual language
- Non-gambling presentation

The resulting app MUST NOT introduce:

- cash-out screens
- bank withdrawal
- casino imagery
- wagering language
- odds displays
- betting slips
- coin/jackpot visual language
- generic fintech-wallet styling
- duplicate authentication screens

---

# 40. Reference Image

Use the bundled image below as the primary visual reference while implementing:

`cash-dey-play-design-reference.png`

The image contains:

- splash/boot
- home dashboard
- matchmaking/lobby
- gameplay
- match result
- daily tasks/streak
- leaderboard
- rewards/wallet
- referral
- premium
- profile/stats
- color palette
- typography examples
- card shape examples
- button states
- status badges
- icon preview

---

# 41. Final Design North Star

**Cash Dey Play should look like Nigeria's answer to a modern mobile esports card game inside Telegram.**

It should feel:

**Fast. Loud. Competitive. Familiar. Nigerian. Rewarding.**

But never:

**Casino-like. Financial. Corporate. Complicated.**

The UI should always make the next action obvious:

**PLAY → COMPETE → PROGRESS → EARN AIRTIME/DATA → COME BACK TOMORROW**
