# Contributing to MergeFi Frontend

Thank you for your interest in contributing to MergeFi! This guide will help you
get started.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Making Changes](#making-changes)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Bounty System](#bounty-system)

## Getting Started

1. **Find an issue**: Browse [open issues](https://github.com/MergeFi/frontend/issues)
   and look for issues labeled with the [Stellar Wave](https://github.com/MergeFi/frontend/labels/Stellar%20Wave)
   program or issues without assignees.

2. **Claim the issue**: Comment on the issue to let others know you're working on it.
   A maintainer will assign you.

3. **Fork the repository**: Click the "Fork" button on GitHub to create your own copy.

4. **Clone your fork**:
   ```bash
   git clone https://github.com/<your-username>/frontend.git
   cd frontend
   ```

5. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/MergeFi/frontend.git
   ```

## Development Setup

### Prerequisites

- **Node.js 20+** (see `.nvmrc` for the exact version)
- **npm** (comes with Node.js)

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app works with bundled
mock data when no backend is running.

### Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with Turbopack |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
| `npm test` | Run Jest test suite |
| `npm run test:watch` | Run tests in watch mode |
| `npm run verify:headers` | Verify security headers (run `build` first) |
| `npm run verify:env` | Validate environment variable handling |

## Project Structure

```
src/
  app/              App Router routes (one folder per route)
  components/       Reusable UI components
    ui/             Primitives: Button, Badge, StatCard, Avatar, Tabs
    layout/         Navbar, Footer, CopyrightYear
    bounty/         BountyCard, BountyDescription
    dashboard/      ActivityList, DashboardShell
  context/          React contexts (Auth, Theme, Wallet)
  hooks/            Custom React hooks
  lib/              Utilities, API client, types, mock data
  types/            Shared TypeScript types
```

## Making Changes

1. **Sync with upstream** before starting work:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Create a feature branch**:
   ```bash
   git checkout -b fix/issue-title
   # or
   git checkout -b feat/feature-name
   ```

3. **Make your changes** following the [coding standards](#coding-standards).

4. **Write or update tests** if your change affects component behavior.

5. **Run checks** before committing:
   ```bash
   npm run lint
   npm test
   ```

6. **Commit with a clear message**:
   ```bash
   git commit -m "fix: describe what you fixed

   Fixes #<issue-number>"
   ```

## Pull Request Process

1. **Push your branch** to your fork:
   ```bash
   git push origin fix/issue-title
   ```

2. **Open a PR** from your fork to `MergeFi/frontend:main`.

3. **Use this PR description template**:
   ```
   Fixes #<issue-number>

   ## What changed
   - 

   ## Why
   - 

   ## How to test
   - 
   ```

4. **Ensure CI passes**: The PR must pass lint, tests, build, and security header
   checks before it can be merged.

5. **Respond to review feedback**: A maintainer will review your PR and may request
   changes. Address feedback promptly.

## Coding Standards

- **TypeScript**: All new code should be TypeScript.
- **ESLint**: Follow the project's ESLint configuration (`eslint.config.mjs`).
- **Tailwind CSS**: Use Tailwind utility classes for styling. Follow the existing
  `slate`/`emerald` dark-mode-first design system.
- **Components**: Place reusable UI primitives in `src/components/ui/`. Feature-specific
  components go in their own folders under `src/components/`.
- **Testing**: Write tests using Jest and React Testing Library. Place test files
  next to the components they test (e.g., `Button.test.tsx`).
- **No `any`**: Avoid `any` types. Use proper TypeScript types.

## Bounty System

MergeFi uses a bounty system to reward contributors:

1. **Browse bounties**: Visit `/issues` to see available bounties with rewards.
2. **Claim a bounty**: Click "Claim" on a bounty to start working on it.
3. **Submit your work**: Open a PR that fixes the issue.
4. **Get paid**: Once your PR is merged, the Soroban smart contract automatically
   releases the bounty to your Stellar wallet.

Bounties are funded by sponsors and held in escrow by Soroban smart contracts on
the Stellar network. Payment is automatic upon PR merge — no manual payout needed.

## Questions?

If you have questions about contributing:

- Check the [existing issues](https://github.com/MergeFi/frontend/issues) for answers.
- Open a new issue with the `question` label.
- Reach out in the project's discussion channels.

Thank you for contributing to MergeFi!
