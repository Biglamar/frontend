import { useState, useCallback, useEffect, useRef } from 'react';
import { apiPost, fetchBounty } from '@/lib/api';
import { adaptBounty, type RawBounty } from '@/lib/adapters';
import type { Bounty, ClaimResult } from '@/types/bounty';

interface ApiError {
  status?: number;
  code?: string;
  message?: string;
}

// The backend rejects a claim on an already-claimed bounty with
// InvalidBountyTransitionError ("Cannot transition bounty from "claimed" to
// "claimed""), which currently surfaces as a 500 without a machine-readable
// code. Match that real message alongside a 409 / ALREADY_CLAIMED code so the
// race UI works until the backend returns a proper 409.
const ALREADY_CLAIMED_CODES = ['BOUNTY_ALREADY_CLAIMED', 'ALREADY_CLAIMED'];
const CLAIMED_TRANSITION_RE = /cannot transition bounty from ["']?claimed["']? to ["']?claimed["']?/i;

export function useClaimRace(bountyId: string, onClaimSuccess?: (bounty: Bounty) => void) {
  const [isClaiming, setIsClaiming] = useState(false);
  const [lastResult, setLastResult] = useState<ClaimResult | null>(null);
  // Mirrors useSmartPolling (#361): the claim request can still be in flight
  // when the caller unmounts (e.g. navigating away right after "Claim"), so
  // skip state updates once unmounted. Set to true in the effect body too so
  // React Strict Mode's simulated unmount/remount doesn't leave it false.
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const recordResult = useCallback((result: ClaimResult) => {
    if (isMountedRef.current) {
      setLastResult(result);
    }
    return result;
  }, []);

  const claim = useCallback(async (): Promise<ClaimResult> => {
    setIsClaiming(true);
    
    try {
      const raw = await apiPost<RawBounty>(`/bounties/${bountyId}/claim`, {});
      
      const bounty = adaptBounty(raw);
      const result: ClaimResult = {
        success: true,
        bounty,
      };
      recordResult(result);
      if (isMountedRef.current) {
        onClaimSuccess?.(bounty);
      }
      return result;
    } catch (error) {
      const apiError = error as ApiError;
      const isAlreadyClaimed = 
        apiError?.status === 409 ||
        (apiError?.code !== undefined && ALREADY_CLAIMED_CODES.includes(apiError.code)) ||
        CLAIMED_TRANSITION_RE.test(apiError?.message ?? '') ||
        apiError?.message?.toLowerCase().includes('already claimed') ||
        apiError?.message?.toLowerCase().includes('claimed by another user');

      if (isAlreadyClaimed) {
        try {
          const updatedResult = await fetchBounty(bountyId, undefined);
          const result: ClaimResult = {
            success: false,
            error: 'ALREADY_CLAIMED',
            bounty: updatedResult?.data,
          };
          return recordResult(result);
        } catch {
          const result: ClaimResult = {
            success: false,
            error: 'ALREADY_CLAIMED',
          };
          return recordResult(result);
        }
      }

      const result: ClaimResult = {
        success: false,
        error: 'NETWORK_ERROR',
        message: apiError?.message || 'Network error occurred',
      };
      return recordResult(result);
    } finally {
      if (isMountedRef.current) {
        setIsClaiming(false);
      }
    }
  }, [bountyId, onClaimSuccess, recordResult]);

  const reset = useCallback(() => {
    setLastResult(null);
  }, []);

  return {
    claim,
    isClaiming,
    lastResult,
    reset,
  };
}
