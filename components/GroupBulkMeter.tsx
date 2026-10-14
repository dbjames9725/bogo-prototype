'use client';

import React from 'react';

interface GroupBulkMeterProps {
  totalUnits: number;
  offeredUnits: number; // Units available for the partner to claim
  unitPrice: number;
  compact?: boolean;
}

export default function GroupBulkMeter({
  totalUnits = 2,
  offeredUnits = 1,
  unitPrice,
  compact = false,
}: GroupBulkMeterProps) {
  const claimedUnits = Math.max(0, totalUnits - offeredUnits);
  const percentClaimed = Math.min(100, Math.round((claimedUnits / totalUnits) * 100));

  return (
    <div className={`w-full space-y-2 ${compact ? '' : 'bg-neutral-900/90 p-4 rounded-2xl border border-neutral-800'}`}>
      {/* HEADER & COUNTER */}
      <div className="flex justify-between items-center text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-emerald-400 font-black uppercase text-[10px] tracking-wider">
            📦 Bulk Split Progress
          </span>
          <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-500/20">
            ${unitPrice.toFixed(2)} / unit
          </span>
        </div>
        <span className="font-mono text-[11px] font-bold text-neutral-300">
          <strong className="text-amber-400">{offeredUnits}</strong> of {totalUnits} units available
        </span>
      </div>

      {/* PROGRESS BAR */}
      <div className="relative w-full h-3 bg-neutral-950 border border-neutral-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-amber-400 via-emerald-400 to-emerald-500 transition-all duration-500 rounded-full shadow-sm"
          style={{ width: `${percentClaimed}%` }}
        />
      </div>

      {/* UNIT SEGMENT DOTS */}
      {!compact && (
        <div className="flex justify-between items-center pt-1">
          <div className="flex gap-1.5">
            {Array.from({ length: totalUnits }).map((_, idx) => {
              const isClaimed = idx < claimedUnits;
              return (
                <div
                  key={idx}
                  className={`h-2.5 w-2.5 rounded-full border transition-all ${
                    isClaimed
                      ? 'bg-emerald-400 border-emerald-300 shadow-sm shadow-emerald-400/50'
                      : 'bg-neutral-800 border-neutral-700 animate-pulse'
                  }`}
                  title={isClaimed ? `Unit ${idx + 1}: Claimed by Host` : `Unit ${idx + 1}: Open for Partner`}
                />
              );
            })}
          </div>
          <span className="text-[10px] text-neutral-400 font-semibold">
            {percentClaimed}% Claimed
          </span>
        </div>
      )}
    </div>
  );
}
