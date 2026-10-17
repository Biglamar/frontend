import type { Difficulty, TeamSplit } from './shared';

export type BountyStatus =
  | 'open'
  | 'funded'
  | 'claimed'
  | 'in_review'
  | 'merged'
  | 'release_failed'
  | 'paid'
  | 'refunded'
  | 'expired'
  | 'unknown';

/** Statuses that never change again — polling should stop once observed. */
export const TERMINAL_STATUSES: ReadonlySet<BountyStatus> = new Set([
  'paid',
  'refunded',
  'expired',
]);

export interface Bounty {
  id: string;
  title: string;
  description: string;
  reward: number;
  asset: "USDC" | "XLM";
  difficulty: Difficulty;
  status: BountyStatus;
  org: string;
  repo: string;
  issueNumber: number;
  labels: string[];
  deadline: string | null;
  /** ISO creation timestamp; backs the "Newest" sort. Absent on mock data. */
  createdAt?: string;
  claimedBy?: string;
  claimedById?: string;
  /**
   * Stable id of the user who created — and, once funded, funds — this
   * bounty. Mirrors `Bounty.sponsorId` on mergefi-backend (nullable FK to
   * `users.id`, see `mergefi-backend/src/common/entities/bounty.entity.ts`).
   *
   * The only field on this type that answers "whose money is in escrow?", and
   * therefore what gates the "Refund sponsor" action. Absent on mock bounties
   * and on any backend response predating the column, so consumers gating a
   * money-moving action on it must fail closed.
   */
  sponsorId?: string;
  milestoneId?: string;
  escrowId?: string;
  teamSplits?: TeamSplit[];
  teamSplitsValid?: { valid: boolean; sum: number; message?: string };
}

export interface BountyStatusUpdate {
  bountyId: string;
  status: BountyStatus;
  claimedBy?: string;
  timestamp: string;
}

export interface ClaimResult {
  success: boolean;
  message?: string;
  bounty?: Bounty;
  error?: 'ALREADY_CLAIMED' | 'NETWORK_ERROR' | 'UNKNOWN';
}
