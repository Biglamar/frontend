export type UserRole = "contributor" | "maintainer" | "sponsor";

// Mirrors mergefi-backend's BountyDifficulty enum
export type Difficulty = "beginner" | "intermediate" | "advanced" | "expert";

export interface TeamSplit {
  role: string;
  percentage: number;
  contributor?: string;
}

export interface Milestone {
  id: string;
  name: string;
  repo: string;
  budget: number;
  distributed: number;
  asset: "USDC" | "XLM";
  status: string;
  deadline: string | null;
  issueCount: number;
  completedCount: number;
}

export interface ReputationProfile {
  handle: string;
  avatarUrl: string;
  lifetimeEarnings: number;
  mergedPRs: number;
  completionRate: number;
  avgReviewTimeHours: number;
  onTimeDeliveryRate: number;
  languages: string[];
  organizations: string[];
  /**
   * Whether this contributor has opted into search-engine indexing of their
   * profile page. Defaults to false — see src/lib/seo-policy.ts for the policy
   * and the backend field this maps to.
   */
  indexable?: boolean;
}

export interface MaintenancePool {
  id: string;
  name: string | null;
  repo: string;
  monthlyDeposit: number;
  balance: number;
  asset: "USDC" | "XLM";
  status: string;
}

export interface AuthUser {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  roles: UserRole[];
  stellarAddress: string | null;
}
