# RiceFinance

RiceFinance is a personal finance companion for tracking assets, liabilities, net worth snapshots, and monthly AI-assisted financial reviews.

The project is built for low-frequency, long-term personal finance reflection rather than daily transaction logging or investment trading. It focuses on answering questions like:

- What do I own right now?
- How is my net worth changing?
- How are my assets distributed by risk, liquidity, and currency?
- What should I pay attention to next month?

## Project Structure

```text
apps/
  backend/   NestJS + Prisma backend
  ios/       SwiftUI iOS app
  web/       React + TypeScript + Vite web app
docs/        Product notes, technical plans, and design docs
scripts/     Project scripts
specs/       API and DTO specs
```

## Tech Stack

- iOS: SwiftUI
- Web: React, TypeScript, Vite, React Router, TanStack Query, Recharts
- Backend: NestJS, Prisma, PostgreSQL, JWT auth
- AI review: DeepSeek-compatible chat API configuration

## Getting Started

### Backend

```bash
cd apps/backend
npm install
cp .env.example .env
npm run prisma:generate
npm run prisma:migrate
npm run start:dev
```

The backend reads configuration from `apps/backend/.env`. Do not commit real secrets.

### Web

```bash
cd apps/web
npm install
npm run dev
```

The web app is configured for local development with Vite.

### iOS

Open `apps/ios/RiceFinance.xcodeproj` in Xcode and run the app from there.

## Environment Variables

Backend variables are documented in `apps/backend/.env.example`, including:

- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `DEEPSEEK_API_KEY`
- `DEEPSEEK_BASE_URL`
- `DEEPSEEK_MODEL`
- `CORS_ORIGINS`
- `DEFAULT_BASE_CURRENCY`

Use strong local or production values for secrets. The example file only contains placeholders and local defaults.

## Security Notes

- Real `.env` files are ignored by Git.
- Local backups and database dumps under `backups/` are ignored.
- Build outputs, dependency folders, IDE files, and local app state are ignored.
- Do not commit personal financial exports, production database dumps, API keys, tokens, or private credentials.

## Current Status

This repository is an active personal project. The current direction is a TypeScript backend plus web and iOS clients, with AI-assisted monthly finance reviews as a core workflow.
