"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Clock3 } from "lucide-react";
import { formatPrice } from "@/lib/format";
import type { PublicDeal } from "@/lib/publicDeal";

type RecentDeal = {
  id: string;
  title: string;
  at: string;
};

const storageKey = "returnpick_recent_deals";

export default function RecentDealsRail() {
  const [products, setProducts] = useState<PublicDeal[]>([]);

  useEffect(() => {
    async function load() {
      let recent: RecentDeal[] = [];
      try {
        recent = JSON.parse(window.localStorage.getItem(storageKey) || "[]") as RecentDeal[];
      } catch {
        recent = [];
      }
      const ids = recent.map((item) => item.id).slice(0, 6);
      if (!ids.length) return;
      const response = await fetch(`/api/products/compare?ids=${encodeURIComponent(ids.join(","))}`, { cache: "no-store" });
      const body = (await response.json()) as { products?: PublicDeal[] };
      setProducts(body.products ?? []);
    }

    load();
  }, []);

  if (!products.length) return null;

  return (
    <section className="rounded-lg border border-line bg-white p-4 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Clock3 className="text-pine" size={18} aria-hidden />
          <div>
            <p className="text-xs font-black text-pine">Recently Viewed</p>
            <h2 className="text-lg font-black">최근 본 딜</h2>
          </div>
        </div>
        <Link className="text-xs font-black text-steel hover:text-pine" href="/compare">
          비교함 보기
        </Link>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <Link key={product.id} className="rounded-lg border border-line p-3 hover:border-pine hover:bg-mist" href={product.detail_url}>
            <span className="block text-xs font-black text-pine">{product.category_label}</span>
            <span className="mt-1 line-clamp-1 block text-sm font-black">{product.title}</span>
            <span className="mt-1 block text-xs font-bold text-steel">
              {formatPrice(product.deal_price)} · {product.score ?? 0}점
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
