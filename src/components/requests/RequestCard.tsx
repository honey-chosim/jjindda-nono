import Link from "next/link";
import Image from "next/image";
import CountdownTimer from "@/components/ui/CountdownTimer";
import type { DatingRequestStatus } from "@/types/database";

export interface RequestCardProfile {
  id: string;
  name: string;
  photos: string[] | null;
  birth_year: number | null;
  job_title: string | null;
  residence_city: string | null;
  residence_district: string | null;
}

interface RequestCardProps {
  requestId: string;
  createdAt: string;
  status: DatingRequestStatus;
  profile: RequestCardProfile;
  /** "received" → /requests/[id], "sent" → /profiles/[targetId] */
  direction: "received" | "sent";
  onExpired?: () => void;
}

function expiresAt(createdAt: string): string {
  return new Date(new Date(createdAt).getTime() + 24 * 60 * 60 * 1000).toISOString();
}

const STATUS_BADGE: Partial<Record<DatingRequestStatus, { label: string; className: string }>> = {
  accepted: { label: "수락함", className: "bg-[#D1FAE5] text-[#065F46]" },
  rejected: { label: "거절함", className: "bg-[#F3F4F6] text-[#6B7280]" },
  expired: { label: "만료됨", className: "bg-[#F3F4F6] text-[#6B7280]" },
  cancelled: { label: "취소됨", className: "bg-[#F3F4F6] text-[#6B7280]" },
  cancelled_unpaid: { label: "결제만료", className: "bg-[#F3F4F6] text-[#6B7280]" },
};

export default function RequestCard({
  requestId,
  createdAt,
  status,
  profile,
  direction,
  onExpired,
}: RequestCardProps) {
  const currentYear = new Date().getFullYear();
  const age = profile.birth_year ? currentYear - profile.birth_year + 1 : null;
  const residence = profile.residence_district
    ? `${profile.residence_city ?? ""} ${profile.residence_district}`
    : profile.residence_city ?? "";

  const href = direction === "received" ? `/requests/${requestId}` : `/profiles/${profile.id}`;
  const verbLabel = direction === "received" ? "요청" : "신청";

  return (
    <Link
      href={href}
      className="flex items-center gap-4 bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-4 shadow-sm active:scale-[0.99] transition-transform"
    >
      <div className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100">
        {profile.photos?.[0] && (
          <Image
            src={profile.photos[0]}
            alt={profile.name}
            fill
            className="object-cover"
            sizes="64px"
          />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="font-semibold text-sm text-[var(--text)]">
            {profile.name}{age != null ? `, ${age}` : ""}
          </p>
          {STATUS_BADGE[status] && (
            <span className={`inline-block px-1.5 py-0.5 rounded-md text-[10px] font-bold ${STATUS_BADGE[status]!.className}`}>
              {STATUS_BADGE[status]!.label}
            </span>
          )}
        </div>
        {(profile.job_title || residence) && (
          <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">
            {[profile.job_title, residence].filter(Boolean).join(" · ")}
          </p>
        )}
        <p className="text-xs text-[var(--text-muted)] mt-0.5">
          {new Date(createdAt).toLocaleDateString("ko-KR", {
            month: "long",
            day: "numeric",
          })}{" "}
          {verbLabel}
        </p>
        {status === "pending" && (
          <CountdownTimer
            expiresAt={expiresAt(createdAt)}
            onExpired={onExpired}
            compact
            className="mt-1"
          />
        )}
      </div>
      <span className="flex-shrink-0 text-[var(--text-muted)]" aria-hidden>
        ›
      </span>
    </Link>
  );
}
