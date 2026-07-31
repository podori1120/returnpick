import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { approvalSampleProduct } from "@/lib/approvalSample";

export default function GuideEditorialLink() {
  return (
    <section aria-labelledby="guide-editorial-title" className="border-y border-line py-5 sm:py-6">
      <div className="grid items-center gap-5 sm:grid-cols-[200px_minmax(0,1fr)]">
        <Link
          aria-label={`${approvalSampleProduct.name} 구매 전 체크 보기`}
          className="focus-ring group relative block aspect-[3/2] overflow-hidden rounded-lg bg-mist"
          href={approvalSampleProduct.detailPath}
        >
          <Image
            alt={approvalSampleProduct.imageAlt}
            className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            fill
            sizes="(min-width: 640px) 200px, 100vw"
            src={approvalSampleProduct.imageSrc}
          />
          <span className="absolute left-2 top-2 rounded-md bg-white/95 px-2 py-1 text-[11px] font-black text-ink">제품 사용 연출 이미지</span>
        </Link>

        <div className="min-w-0">
          <div className="flex items-center gap-2 text-pine">
            <ShieldCheck size={18} aria-hidden />
            <p className="text-xs font-black">실전 구매 전 사례</p>
          </div>
          <h2 id="guide-editorial-title" className="mt-2 text-xl font-black leading-7 text-ink">
            창문 로봇청소기는 무엇을 확인해야 할까요?
          </h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-steel">
            안전줄, 창문 규격, 구성품과 가격·재고 실시간 확인까지 {approvalSampleProduct.name} 상세에서 리턴픽의 검수 순서로 살펴보세요.
          </p>
          <Link className="focus-ring mt-3 inline-flex items-center gap-2 text-sm font-black text-pine hover:text-ink" href={approvalSampleProduct.detailPath}>
            Novatech S1 구매 전 체크 보기 <ArrowRight size={16} aria-hidden />
          </Link>
          <p className="mt-2 text-[11px] font-semibold leading-5 text-steel">연결된 상세에는 쿠팡 파트너스 제휴 링크가 포함되어 있습니다.</p>
        </div>
      </div>
    </section>
  );
}
