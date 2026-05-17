import { notFound } from "next/navigation";
import type { Metadata } from "next";
import DealDetail from "@/components/DealDetail";
import { getProductById, listProducts } from "@/lib/dataStore";
import { getRelatedProducts } from "@/lib/dealIntelligence";
import { getCategoryLabel } from "@/lib/category";
import { formatPrice } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const product = await getProductById(id);
  if (!product || !product.is_published || product.sourcing_status !== "published") {
    return {
      title: "딜을 찾을 수 없습니다 | 리턴픽"
    };
  }

  const title = `${product.title} | 리턴픽 반품 딜`;
  const description = `${getCategoryLabel(product.category)} 반품 추천 후보입니다. 반품가 ${formatPrice(product.return_price)}, 네이버 기준가 ${formatPrice(product.naver_lowest_price)}를 리턴픽 기준으로 검수했습니다.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: product.image_url ? [{ url: product.image_url }] : undefined,
      type: "article"
    }
  };
}

export default async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProductById(id);
  if (!product || !product.is_published || product.sourcing_status !== "published") notFound();
  const publishedProducts = (await listProducts({ published: true })).filter((item) => item.sourcing_status === "published");
  const relatedProducts = getRelatedProducts(product, publishedProducts, 4);
  return <DealDetail product={product} relatedProducts={relatedProducts} />;
}
