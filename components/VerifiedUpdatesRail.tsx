import Link from "next/link";
import { Activity, ArrowRight, Clock3 } from "lucide-react";
import { getCategoryLabel } from "@/lib/category";
import { formatDate } from "@/lib/format";
import type { DiscoveryUpdate } from "@/lib/discoveryUpdates";

export default function VerifiedUpdatesRail({
  updates,
  title = "최근 검증된 상품",
  description = "자동 수집 또는 허용된 가격 확인 과정에서 실제로 관찰된 상품만 시간순으로 보여드립니다."
}: {
  updates: DiscoveryUpdate[];
  title?: string;
  description?: string;
}) {
  if (!updates.length) return null;

  return (
    <section className="rounded-lg border border-line bg-white p-5 shadow-soft" aria-labelledby="verified-updates-heading">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-black text-pine">
            <Activity size={17} aria-hidden />
            <span>LIVE CHECK</span>
          </div>
          <h2 id="verified-updates-heading" className="mt-1 text-xl font-black">{title}</h2>
          <p className="mt-1 max-w-2xl text-sm font-semibold leading-6 text-steel">{description}</p>
        </div>
        <Link className="focus-ring inline-flex items-center gap-1 text-sm font-black text-pine hover:text-ink" href="/deals?sort=latest">
          전체 최근 검증 <ArrowRight size={15} aria-hidden />
        </Link>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {updates.map((update) => (
          <Link
            key={update.product.id}
            href={`/deals/${update.product.id}`}
            className="focus-ring rounded-lg border border-line p-4 hover:border-pine hover:bg-mist"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-black text-pine">{getCategoryLabel(update.product.category)}</p>
                <h3 className="mt-1 line-clamp-2 text-sm font-black leading-5 text-ink">{update.product.title}</h3>
              </div>
              <span className="shrink-0 rounded-md bg-pine/10 px-2 py-1 text-xs font-black text-pine">
                {update.product.latest_score?.total_score ?? 0}점
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold text-steel">
              <span className="inline-flex items-center gap-1">
                <Clock3 size={13} aria-hidden />
                {formatDate(update.observedAt)} 확인
              </span>
              {(update.labels.length ? update.labels : ["자동 수집 확인"]).slice(0, 2).map((label) => (
                <span key={label} className="rounded-md bg-mist px-2 py-1">{label}</span>
              ))}
            </div>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-black text-pine">
              가격·반품 근거 보기 <ArrowRight size={13} aria-hidden />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
