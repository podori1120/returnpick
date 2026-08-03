import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { approvalSampleProduct } from "@/lib/approvalSample";

export default function SearchGuideEditorialBridge() {
  return (
    <section className="border-y border-line bg-mist" aria-labelledby="search-editorial-bridge-title">
      <div className="mx-auto grid max-w-7xl items-center gap-5 px-4 py-7 sm:px-6 lg:grid-cols-[180px_minmax(0,1fr)]">
        <Link
          aria-label={`${approvalSampleProduct.name} 직접 검수 사례 보기`}
          className="focus-ring group relative block aspect-[3/2] overflow-hidden rounded-lg bg-white"
          href={approvalSampleProduct.detailPath}
        >
          <Image
            alt={approvalSampleProduct.imageAlt}
            className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            fill
            sizes="(min-width: 1024px) 180px, 100vw"
            src={approvalSampleProduct.imageSrc}
          />
          <span className="absolute left-2 top-2 rounded-md bg-white/95 px-2 py-1 text-[11px] font-black text-ink">직접 검수 사례</span>
        </Link>
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-pine">
            <ShieldCheck size={18} aria-hidden />
            <p className="text-xs font-black">구매 전 확인 흐름을 실제 페이지에서 확인</p>
          </div>
          <h2 id="search-editorial-bridge-title" className="mt-2 text-xl font-black leading-7 text-ink">
            상품이 들어오기 전에도 리턴픽의 검수 방식을 살펴보세요
          </h2>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-steel">
            {approvalSampleProduct.name} 상세에서 사양, 사용 조건, 구성품과 쿠팡의 최신 가격·재고를 확인하는 순서를 보여드립니다. 상세 페이지에는 제휴 링크와 고지가 함께 표시됩니다.
          </p>
          <Link className="focus-ring mt-3 inline-flex items-center gap-2 text-sm font-black text-pine hover:text-ink" href={approvalSampleProduct.detailPath}>
            직접 검수 사례 보기 <ArrowRight size={16} aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
