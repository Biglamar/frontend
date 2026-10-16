'use client';

import { BountyStatus } from './BountyStatus';
import type { Bounty } from '@/types/bounty';

interface LiveBountyStatusProps {
  bountyId: string;
  fallbackBounty?: Bounty;
  className?: string;
}

export function LiveBountyStatus({ bountyId, fallbackBounty, className = '' }: LiveBountyStatusProps) {
  return <BountyStatus bountyId={bountyId} fallbackBounty={fallbackBounty} className={className} interval={5000} />;
}