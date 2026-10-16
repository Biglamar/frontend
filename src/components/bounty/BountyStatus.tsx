'use client';

import React from 'react';
import { useBountyStatus } from '@/hooks/useBountyStatus';
import type { Bounty, BountyStatus } from '@/types/bounty';

interface BountyStatusProps {
  bountyId: string;
  fallbackBounty?: Bounty;
  onStatusChange?: (status: BountyStatus) => void;
  className?: string;
  interval?: number;
}

const statusColors: Record<BountyStatus, string> = {
  open: 'text-green-600 bg-green-50 border-green-200',
  funded: 'text-teal-600 bg-teal-50 border-teal-200',
  claimed: 'text-blue-600 bg-blue-50 border-blue-200',
  in_review: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  merged: 'text-purple-600 bg-purple-50 border-purple-200',
  paid: 'text-purple-600 bg-purple-50 border-purple-200',
  refunded: 'text-red-600 bg-red-50 border-red-200',
  expired: 'text-red-600 bg-red-50 border-red-200',
};

const statusLabels: Record<BountyStatus, string> = {
  open: 'Open',
  funded: 'Funded',
  claimed: 'Claimed',
  in_review: 'In Review',
  merged: 'Merged',
  paid: 'Paid',
  refunded: 'Refunded',
  expired: 'Expired',
};

export function BountyStatus({ 
  bountyId, 
  fallbackBounty, 
  onStatusChange, 
  className = '', 
  interval = 5000, 
}: BountyStatusProps) {
  const {
    bounty,
    isLoading,
    error,
    isPolling,
    isLive,
    status,
    source,
    refetch,
  } = useBountyStatus({
    bountyId,
    fallbackBounty,
    interval,
    onStatusChange,
  });

  if (isLoading && !bounty) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-6 w-32 bg-gray-200 rounded"></div>
        <div className="h-4 w-48 bg-gray-200 rounded mt-2"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-4 bg-red-50 border border-red-200 rounded-lg ${className}`}>
        <p className="text-red-600 text-sm">Failed to load status</p>
        <button 
          onClick={refetch}
          className="mt-2 text-sm text-red-500 hover:text-red-700 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!bounty) {
    return <div className={className}>Bounty not found</div>;
  }

  const colorClass = status ? statusColors[status] || 'text-gray-600 bg-gray-50' : 'text-gray-600 bg-gray-50';
  const label = status ? statusLabels[status] || status : 'Unknown';

  return (
    <div className={`${className}`}>
      <div className="flex items-center gap-3 flex-wrap">
        <span className={`px-3 py-1 rounded-full text-sm font-medium border ${colorClass}`}>
          {label}
        </span>
        
        <span className="text-xs text-gray-400 flex items-center gap-1">
          <span 
            className={`inline-block w-2 h-2 rounded-full ${
              isLive ? 'bg-green-500 animate-pulse' : 
              isPolling ? 'bg-yellow-500' : 
              'bg-gray-400'
            }`}
          />
          {isLive ? 'Live' : isPolling ? 'Polling' : 'Paused'}
        </span>

        {source === 'mock' && (
          <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded">
            Mock Data
          </span>
        )}
      </div>

      {bounty.claimedBy && (
        <div className="mt-2 text-sm text-blue-600">
          Claimed by: <span className="font-medium">{bounty.claimedBy}</span>
        </div>
      )}
    </div>
  );
}
