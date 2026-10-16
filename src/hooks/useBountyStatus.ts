import { useSyncExternalStore, useCallback } from 'react';
import { fetchBounty } from '@/lib/api';
import type { Bounty, BountyStatus } from '@/types/bounty';
import { TERMINAL_STATUSES } from '@/types/bounty';
import {
  getBountySnapshot,
  subscribeBounty,
  refetchBounty,
} from './bountyPoller';

interface UseBountyStatusOptions {
  bountyId: string;
  fallbackBounty?: Bounty;
  interval?: number;
  enabled?: boolean;
  onStatusChange?: (status: BountyStatus) => void;
}

interface UseBountyStatusResult {
  bounty: Bounty | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  isPolling: boolean;
  isLive: boolean;
  status: BountyStatus | null;
  source: 'live' | 'mock' | null;
}

/**
 * Shared bounty status hook — uses the module-level poller registry
 * so multiple components on the same page share one fetch loop (#631).
 *
 * Stops polling once a terminal status is observed (#632).
 */
export function useBountyStatus({
  bountyId,
  fallbackBounty,
  interval = 5000,
  enabled = true,
  onStatusChange,
}: UseBountyStatusOptions): UseBountyStatusResult {
  const snapshot = useSyncExternalStore(
    useCallback(
      (onStoreChange: () => void) =>
        enabled ? subscribeBounty(bountyId, onStoreChange, interval) : () => {},
      [bountyId, enabled, interval],
    ),
    () => getBountySnapshot(bountyId),
    () => getBountySnapshot(bountyId),
  );

  const refetch = useCallback(async () => {
    refetchBounty(bountyId);
  }, [bountyId]);

  const status = snapshot.bounty?.status ?? null;

  return {
    bounty: snapshot.bounty,
    isLoading: snapshot.loading && !snapshot.bounty,
    error: snapshot.error,
    refetch,
    isPolling: enabled && !TERMINAL_STATUSES.has(status as BountyStatus),
    isLive: enabled && !TERMINAL_STATUSES.has(status as BountyStatus),
    status,
    source: snapshot.source,
  };
}
