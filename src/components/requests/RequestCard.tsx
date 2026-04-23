import Link from "next/link";
import Image from "next/image";
import Button from "@/components/ui/Button";
import CountdownTimer from "@/components/ui/CountdownTimer";
import type { RequestWithRequester, DatingRequestStatus } from "@/types/database";

interface RequestCardProps {
  request: RequestWithRequester;
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

export default function RequestCard({ request, onExpired }: RequestCardProps) {
  const requester = request.requester;
  if (!requester) return null;
  const currentYear = new Date().getFullYear();
  const age = currentYear - requester.birth_year + 1;
  const residence = requester.residence_district
    ? `${requester.residence_city} ${requester.residence_district}`
    : (requester.residence_city ?? '');

  return (
    <div className="flex items-center gap-4 bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-4 shadow-sm">
      <div className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100">
        {requester.photos[0] && (
          <Image
            src={requester.photos[0]}
            alt={requester.name}
            fill
            className="object-cover"
            sizes="64px"
          />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="font-semibold text-sm text-[var(--text)]">
            {requester.name}, {age}
          </p>
          {STATUS_BADGE[request.status] && (
            <span className={`inline-block px-1.5 py-0.5 rounded-md text-[10px] font-bold ${STATUS_BADGE[request.status]!.className}`}>
              {STATUS_BADGE[request.status]!.label}
            </span>
          )}
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">
          {requester.job_title} · {residence}
        </p>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">
          {new Date(request.created_at).toLocaleDateString("ko-KR", {
            month: "long",
            day: "numeric",
          })}{" "}
          요청
        </p>
        {request.status === "pending" && (
          <CountdownTimer
            expiresAt={expiresAt(request.created_at)}
            onExpired={onExpired}
            compact
            className="mt-1"
          />
        )}
      </div>
      <Link href={`/requests/${request.id}`} className="flex-shrink-0">
        <Button size="sm" variant="outline">
          상세 보기
        </Button>
      </Link>
    </div>
  );
}
