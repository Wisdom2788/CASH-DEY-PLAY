# Sponsored task campaigns and editorial scheduling — proposed expansion

27 October 2026. User clarified that rotation must support fresh sponsor/community content and commercial campaigns, beyond repeated gameplay templates. This is a proposed design, not a shipped provider integration or approved change to reward economics.

## Existing implementation versus expansion

PR17 supplies immutable per-Lagos-date schedules, four rotating gameplay sets, trusted game-result progress, unique reward receipts and schedule-based task-day qualification. It does not supply a weekly editorial admin UI, sponsor portal, arbitrary social-action verification or sponsor billing. Published rotating-v2 schedules/claims remain intact. Expand through versioned campaign/assignment/verification services; do not weaken current task schemas to accept arbitrary URLs or client completion flags.

## Business operation

An authorized operator prepares a rolling seven-day draft: objective/content, sponsor, action/target, eligible audience, verification adapter, Lagos start/end, recurrence, reward unit/amount, campaign limit and required budget. Review permissions, content, availability and verification readiness before publication. Seven days is an editorial planning horizon, not a mandatory fixed task week: approved future drafts can change, but published user promises must remain stable. Publish immutable dated versions; retire/cancel through explicit audited policy and a fair fallback, not editing earned history. Cycle content across gameplay challenges, owned educational quizzes and permitted verified partner/community actions; never promise infinite nonrepetition from a finite catalogue.

Recommended initial separation: existing required daily objectives remain available without sponsor supply and keep the 200-point core maximum. Optional sponsored campaigns use a separately capped promotional points pool and do not count toward complete-task days, referral qualification, login streaks or skill-ranking inputs. Exact sponsor caps, financing and reward units need a recorded business decision before enabling payouts. Points do not silently become naira or airtime. Revenue accounting, sponsor billing and actual user reward liability are separate records.

## User and verification flow

Task offered -> Start -> server-bound attempt with user/campaign/target and expiry -> external action -> return -> Check completion -> server evidence check -> PENDING / VERIFIED / NOT_VERIFIED / EXPIRED / REVIEW -> once-only award receipt and visible status.

Returning, opening a link, a redirect, a timer, a screenshot or a user saying Done does not independently prove an external social action. A click measurement must be labelled as a click, not a verified follow/view. Where explicitly supported, verification uses consented provider identity/API reads or authenticated sponsor conversion callbacks. Telegram identity alone does not establish another platform account. No password collection, scraping workaround, fabricated callback or automatic approval on provider error. Manual decisions must be identified as reviewed evidence, not API verification.

Provider/action registry must store permission/policy checks and readiness. No task is published until its exact action can be verified and rewarded permissibly. Telegram getChatMember supports membership verification; the API guarantees other-user checks only when the bot is an administrator. This proves current membership, not necessarily a new join: baseline/transition evidence is required for a new-member promise. Existing-member retention must be a separately labelled campaign. Membership before the offer, leaving/rejoining and reusing one external account across users must not generate repeated acquisition rewards.

YouTube API policy disallows compensation for views, likes, subscriptions, comments and similar engagement; do not publish rewarded YouTube engagement tasks or substitute manual review/direct links to bypass that restriction. Ordinary unrewarded promotion is separate. Owned/licensed content and quizzes or a rewarded-ad provider expressly supporting rewards can be considered on their own terms. Quiz completion proves an answer submission, not a human's attention or a monetizable YouTube view. Other social platforms need their own action-level policy and API review; no universal verifier is assumed.

## Source design and fraud controls

Suggested records: sponsors; campaigns and immutable campaign_versions; seven-day editorial drafts and published placements; user task assignments; verification_attempts; consented external identity bindings; verification_evidence; reward_reservations; immutable reward_receipts; campaign budget movements; operator review/audit/outbox.

A verification adapter returns canonical user/target/action, provider event identity, observed/completed time and evidence reference. Only backend code can accept it. Verify callback authentication/signature, nonce/state, allowed target, expiry and exact participant/campaign correlation. Provider destinations come from an allowlisted registry, not client-selected URLs. Protect against duplicate/reordered callbacks, replay, account relinking, duplicate human accounts, concurrent Check presses, reused screenshots and forged webhooks.

Atomic award: lock assignment and budget in a documented global order, recheck eligibility/proof/window, insert unique completion receipt, debit/reserve campaign budget, apply the configured points award, record audit/outbox and durable response, commit together. A confirmed external acquisition action cannot be sold repeatedly just by making a new campaign ID: define provider/action/target deduplication and any distinct retention policy. Exhausted budget prevents new promises; existing reserved valid completions retain their promise under the published expiry policy. Temporary provider outages produce PENDING with bounded retries, never assumed success or automatic forfeiture. Late confirmations use trusted completion timestamps under explicit offer windows.

Do not make slow external API calls while holding long-lived SQL locks: create a fenced attempt/reservation, query the provider, then atomically validate and finalize. Retries cannot consume budget or award twice. Refunds/rejections/compensation append audited entries; never delete old reward receipts. Sponsor reports distinguish clicks, pending checks, verified conversions, rejected/duplicate events and funded awards. Store minimal evidence with a retention/deletion policy and protect account tokens separately from logs and public source.

## Implementation order and acceptance

1. Complete stage08 cycle/milestone and referral reward engines after pending business rules are answered.
2. Add editorial/campaign schema, operator authorization, budget/reservation model and immutable publication. No sponsor portal or paid campaign is implied by this document.
3. First live adapter: Telegram membership for an approved channel with least necessary admin rights and agreed new-member/retention policy; alternatively a sponsor-owned signed conversion callback. Verify exact permissions and actual account access before activation.
4. Connect start/check/status frontend and worker retry/recovery, with pending/rejected states and disclosure of sponsored content. Genuine provider evidence is required for acceptance.
5. Broaden catalogue/provider support only after action-level review and tests. Weekly planning should vary content, not only rename the same objectives.

Acceptance: authorization, immutable publication, stable assignment, no sponsor/fallback continuity, exact proof binding, unavailable providers, forged/duplicate/out-of-order callbacks, simultaneous completion checks, reserved/empty budget, rollback after every award write, preexisting membership, leave/rejoin, linked account reuse, late legitimate confirmations, cancellation handling, clear UI states and real-provider/device evidence. None is marked complete by writing this design.

## Official sources checked 27 October 2026

- YouTube API developer policies, Playback Integrity: https://developers.google.com/youtube/terms/developer-policies
- YouTube fake engagement policy: https://support.google.com/youtube/answer/3399767?hl=en
- Telegram Bot API getChatMember: https://core.telegram.org/bots/api#getchatmember
