import { notFound } from "next/navigation";
import type { Metadata } from "next";
import DealDetail from "@/components/DealDetail";
import { getProductById, listProducts } from "@/lib/dataStore";
import { getRelatedProducts } from "@/lib/dealIntelligence";
import { getCategoryLabel } from "@/lib/category";
import { formatPrice } from "@/lib/format";
import { isUsableProductImageUrl } from "@/lib/productImageUrl";
import { isPublicDealReady } from "@/lib/publicDeal";
import { getPriceReferenceInfo } from "@/lib/priceReference";
import { getSiteUrl } from "@/lib/siteUrl";

export const dynamic = "force-dynamic";

function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const siteUrl = getSiteUrl();
  const canonicalUrl = `${siteUrl}/deals/${id}`;
  const product = await getProductById(id);
  if (!product || !isPublicDealReady(product)) {
    return {
      title: "딜을 찾을 수 없습니다 | 리턴픽",
      alternates: {
        canonical: canonicalUrl
      }
    };
  }

  const title = `${product.title} | 리턴픽 반품 딜`;
  const reference = getPriceReferenceInfo(product);
  const description = `${getCategoryLabel(product.category)} 반품 추천 후보입니다. 반품가 ${formatPrice(product.return_price)}, ${reference.label} ${formatPrice(reference.value)}를 리턴픽 기준으로 검수했습니다.`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: "ReturnPick",
      images: [{ url: `${canonicalUrl}/opengraph-image` }],
      type: "article"
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${canonicalUrl}/twitter-image`]
    }
  };
}

export default async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProductById(id);
  if (!product || !isPublicDealReady(product)) notFound();
  const publishedProducts = (await listProducts({ published: true })).filter(isPublicDealReady);
  const relatedProducts = getRelatedProducts(product, publishedProducts, 4);
  const canonicalUrl = `${getSiteUrl()}/deals/${product.id}`;
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${canonicalUrl}#product`,
    name: product.title,
    url: canonicalUrl,
    category: getCategoryLabel(product.category),
    ...(isUsableProductImageUrl(product.image_url) ? { image: [product.image_url] } : {}),
    ...(product.brand?.trim() ? { brand: { "@type": "Brand", name: product.brand.trim() } } : {}),
    ...(product.model_name?.trim() ? { model: product.model_name.trim() } : {})
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(productJsonLd) }} />
      <DealDetail product={product} relatedProducts={relatedProducts} />
    </>
  );
}
