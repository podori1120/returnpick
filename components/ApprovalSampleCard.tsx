import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Droplets, Gauge, ShieldCheck } from "lucide-react";
import { EditorialPickImpressionTracker } from "@/components/AffiliateEventTracker";
import { approvalSampleProduct } from "@/lib/approvalSample";

const highlightIcons = [Gauge, Droplets, ShieldCheck];

export default function ApprovalSampleCard({ placement }: { placement: "home" | "deals" | "picks" }) {
  return (
    <article className="overflow-hidden rounded-lg border border-line bg-white shadow-soft">
      <EditorialPickImpressionTracker placement={placement} />
      <Link className="focus-ring group block" href={approvalSampleProduct.detailPath} aria-label={`${approvalSampleProduct.name} 상세 보기`}>
        <div className="relative aspect-[3/2] overflow-hidden bg-mist">
          <Image
            alt={approvalSampleProduct.imageAlt}
            className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            fill
            sizes="(min-width: 1024px) 420px, (min-width: 768px) 50vw, 100vw"
            src={approvalSampleProduct.imageSrc}
          />
          <span className="absolute left-3 top-3 rounded-md bg-white/95 px-2.5 py-1 text-xs font-black text-ink shadow-soft">연출 이미지</span>
        </div>
        <div className="p-5">
          <div className="flex flex-wrap items-center gap-2 text-xs font-black">
            <span className="rounded-md bg-pine/10 px-2.5 py-1 text-pine">직접 검수 추천</span>
            <span className="rounded-md bg-mist px-2.5 py-1 text-steel">{approvalSampleProduct.categoryLabel}</span>
          </div>
          <h2 className="mt-3 text-xl font-black leading-7 text-ink">{approvalSampleProduct.name}</h2>
          <p className="mt-1 text-sm font-semibold leading-6 text-steel">{approvalSampleProduct.subtitle}</p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {approvalSampleProduct.highlights.map((highlight, index) => {
              const Icon = highlightIcons[index];
              return (
                <span key={highlight} className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-md bg-mist px-2 py-2 text-center text-[11px] font-black text-ink">
                  <Icon className="text-pine" size={15} aria-hidden />
                  <span className="break-keep">{highlight}</span>
                </span>
              );
            })}
          </div>
          <p className="mt-3 text-xs font-semibold leading-5 text-steel">{approvalSampleProduct.imageNotice}</p>
          <span className="mt-4 inline-flex items-center gap-2 text-sm font-black text-pine group-hover:text-ink">
            검수 내용과 구매 전 확인사항 보기 <ArrowRight size={16} aria-hidden />
          </span>
          <p className="mt-3 border-t border-line pt-3 text-[11px] font-semibold leading-5 text-steel">쿠팡 파트너스 제휴 링크가 포함된 추천 상품입니다.</p>
        </div>
      </Link>
    </article>
  );
}
