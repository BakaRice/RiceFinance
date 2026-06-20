# CLAUDE.md — RiceFinance Web / TS Workbench

This file provides guidance to Claude Code when working with the web admin client and TypeScript learning surface.

## Quick Start

```bash
npm install
npm run dev      # Vite dev server
npm run build    # Production build
npm run preview  # Preview production build
```

## Architecture

### Stack
React + Vite + TypeScript + Tailwind CSS (or plain CSS)

The web app is both a desktop management UI and the main TypeScript learning surface. Future backend migration work should try to move shared DTO/schema definitions toward `specs/` so Web, iOS, and the TypeScript API can converge on the same contracts.

### Source structure
```
src/
├── api/          # V2 API client (v2-client.ts, v2-types.ts)
├── assets/       # Static assets (images, icons)
├── components/   # Reusable UI components
├── data/         # Mock data / fixtures
├── hooks/        # Custom React hooks
├── lib/          # Utility functions
├── pages/        # Route-level page components
├── store/        # State management
├── types/        # TypeScript type definitions
├── App.tsx       # Root component with routing
├── main.tsx      # Entry point
└── index.css     # Global styles
```

### Route design (tentative)
| Route | Page |
|-------|------|
| `/` | Dashboard / net worth overview |
| `/assets` | Asset & liability management |
| `/snapshots` | Monthly snapshot history |
| `/analysis` | Structure analysis |
| `/reports` | AI review reports |
| `/spending` | Spending import and consumption review (future) |
| `/settings` | User settings, sync status |

### V2 API Client
The web app communicates with the NestJS backend via `/api/v2`:

- **Auth**: POST `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`
- **Users**: GET `/users/me`
- **Finance**: GET/POST `/finance/assets`, GET/POST `/finance/liabilities`
- **Snapshots**: GET/POST `/snapshots`
- **Stats**: GET `/stats/overview`
- **Reports**: GET `/reports`, GET `/reports/latest-ai-review`
- **AI**: POST `/ai/reviews`
- **Exchange**: GET/POST `/exchange/rates`

**Proxy config** (vite.config.ts): `/api/v2` → `http://localhost:3000`

Token management uses `rice_auth_v2` localStorage key with automatic refresh rotation.

## Design notes
- Web admin is a companion to the iOS/Mac app, not a replacement
- Primary use case: data management, CSV/JSON import/export, spending-statement import, detailed reports, and Agent review workflows
- Shares DTO types with the backend — keep type definitions in sync with `specs/dto/`
- Avoid turning spending support into high-frequency manual bookkeeping. The product direction is low-frequency spending behavior review.
