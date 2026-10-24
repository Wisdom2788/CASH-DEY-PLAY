# Cash Dey Play frontend

React 19, Vite, React Query and Zustand. Node.js 24; npm is the sole package manager.

```sh
npm ci
npm run dev
npm run typecheck
npm test
npm run build
```

See [repository setup](../README.md) and [delivery specifications](../docs/specs/delivery/README.md). Vercel's Root Directory must be this folder; output is dist. Configure VITE_API_URL separately for Preview and Production. No payment/provider secret belongs in frontend configuration. Video rewards and airtime redemption are unavailable until the verified server flows are complete; no ad simulation is shipped.
