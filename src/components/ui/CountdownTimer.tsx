"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface CountdownTimerProps {
  expiresAt: string;
  onExpired?: () => void;
  className?: string;
  compact?: boolean;
}

function msToHMS(ms: number): { h: number; m: number; s: number } {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return { h, m, s };
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export default function CountdownTimer({
  expiresAt,
  onExpired,
  className,
  compact = false,
}: CountdownTimerProps) {
  const [remaining, setRemaining] = useState(
    () => new Date(expiresAt).getTime() - Date.now()
  );

  useEffect(() => {
    if (remaining <= 0) {
      onExpired?.();
      return;
    }
    const id = setInterval(() => {
      const ms = new Date(expiresAt).getTime() - Date.now();
      setRemaining(ms);
      if (ms <= 0) {
        clearInterval(id);
        onExpired?.();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [expiresAt, onExpired, remaining]);

  if (remaining <= 0) {
    return (
      <span className={cn("text-[var(--danger)] font-semibold", className)}>
        만료됨
      </span>
    );
  }

  const { h, m, s } = msToHMS(remaining);
  const isUrgent = remaining < 60 * 60 * 1000;

  if (compact) {
    return (
      <span
        className={cn(
          "tabular-nums font-semibold text-xs",
          isUrgent ? "text-[var(--danger)]" : "text-[var(--warning)]",
          className
        )}
      >
        {pad(h)}:{pad(m)}:{pad(s)}
      </span>
    );
  }

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={isUrgent ? "text-[var(--danger)]" : "text-[var(--warning)]"}
      >
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
      <span
        className={cn(
          "tabular-nums font-semibold text-sm",
          isUrgent ? "text-[var(--danger)]" : "text-[var(--warning)]"
        )}
      >
        {pad(h)}:{pad(m)}:{pad(s)} 남음
      </span>
    </div>
  );
}
