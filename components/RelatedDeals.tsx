import DealCard from "@/components/DealCard";
import type { ProductWithScore } from "@/lib/types";

export default function RelatedDeals({ products }: { products: ProductWithScore[] }) {
  if (!products.length) return null;

  return (
    <section className="space-y-3">
      <div>
        <p className="text-sm font-black text-pine">More Picks</p>
        <h2 className="text-lg font-black">비슷한 딜 더 보기</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {products.map((product) => (
          <DealCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
