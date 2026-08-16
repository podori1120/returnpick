import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { golden50Deals } from "./bulk-golden-deals-catalog.mjs";
import { ultraHighValue5Deals } from "./publish-ultra-high-value-deals.mjs";
import { refurbishedTech8Deals } from "./publish-refurbished-tech-post.mjs";
import { rocketFresh7Deals } from "./publish-rocket-fresh-night-deals.mjs";
import { unitPrice8Deals } from "./publish-unit-price-breakdown-post.mjs";

function generateAllFeedsAndSitemaps() {
  console.log("=================================================");
  console.log("   📡 [실시간 RSS & JSON Feed] 자동 피드 배포 시스템");
  console.log("=================================================\n");

  const allDeals = [
    ...ultraHighValue5Deals,
    ...refurbishedTech8Deals,
    ...rocketFresh7Deals,
    ...unitPrice8Deals,
    ...golden50Deals
  ];

  const nowIso = new Date().toISOString();
  const nowRss = new Date().toUTCString();

  // 1. RSS 2.0 XML 피드 생성
  const rssItemsXml = allDeals.slice(0, 20).map(d => `
    <item>
      <title><![CDATA[${d.title} (${d.deal_price.toLocaleString()}원 / ${d.discount_rate}% 할인)]]></title>
      <link>https://returnpick.vercel.app/deals/${d.id}?utm_source=rss_feed</link>
      <guid>https://returnpick.vercel.app/deals/${d.id}</guid>
      <pubDate>${nowRss}</pubDate>
      <description><![CDATA[${d.public_note} | 네이버 최저가 대비 ${(d.naver_lowest_price - d.deal_price).toLocaleString()}원 절약 | 폴센트 60일 최저가 검증 완료]]></description>
      <category>${d.category}</category>
    </item>
  `).join("\n");

  const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>리턴픽(ReturnPick) 실시간 쿠팡 핫딜 &amp; 60일 가격 추적 검증 피드</title>
    <link>https://returnpick-deals.blogspot.com</link>
    <description>폴센트 60일 가격 변동과 역대 최저가를 실시간 교차 검증한 진짜 쿠팡 핫딜 모음</description>
    <language>ko-KR</language>
    <lastBuildDate>${nowRss}</lastBuildDate>
    <atom:link href="https://returnpick.vercel.app/feed.xml" rel="self" type="application/rss+xml" />
    ${rssItemsXml}
  </channel>
</rss>`;

  writeFileSync(resolve(process.cwd(), "public/feed.xml"), rssXml, "utf-8");
  console.log("✅ RSS 2.0 피드 생성 완료: public/feed.xml");

  // 2. JSON Feed 1.1 생성
  const jsonFeed = {
    version: "https://jsonfeed.org/version/1.1",
    title: "리턴픽 실시간 쿠팡 핫딜 피드",
    home_page_url: "https://returnpick-deals.blogspot.com",
    feed_url: "https://returnpick.vercel.app/feed.json",
    description: "폴센트 60일 가격 변동 검증 실시간 핫딜",
    items: allDeals.slice(0, 20).map(d => ({
      id: d.id,
      url: `https://returnpick.vercel.app/deals/${d.id}`,
      title: d.title,
      content_text: d.public_note,
      image: d.image_url,
      date_published: nowIso,
      tags: [d.category, "쿠팡핫딜", "가격비교"]
    }))
  };

  writeFileSync(resolve(process.cwd(), "public/feed.json"), JSON.stringify(jsonFeed, null, 2), "utf-8");
  console.log("✅ JSON Feed 1.1 생성 완료: public/feed.json");

  // 3. 사이트맵 (Sitemap XML) 갱신
  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://returnpick-deals.blogspot.com/2026/08/18.html</loc>
    <lastmod>${nowIso.split("T")[0]}</lastmod>
    <changefreq>hourly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://returnpick-deals.blogspot.com/2026/08/490ml-x-24-991.html</loc>
    <lastmod>${nowIso.split("T")[0]}</lastmod>
    <changefreq>hourly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://returnpick-deals.blogspot.com/2026/08/17900.html</loc>
    <lastmod>${nowIso.split("T")[0]}</lastmod>
    <changefreq>hourly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://returnpick-deals.blogspot.com/2026/08/40-967.html</loc>
    <lastmod>${nowIso.split("T")[0]}</lastmod>
    <changefreq>hourly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://returnpick-deals.blogspot.com/2026/08/355ml-x-24-535.html</loc>
    <lastmod>${nowIso.split("T")[0]}</lastmod>
    <changefreq>hourly</changefreq>
    <priority>0.9</priority>
  </url>
</urlset>`;

  writeFileSync(resolve(process.cwd(), "public/sitemap.xml"), sitemapXml, "utf-8");
  console.log("✅ Sitemap.xml 갱신 완료: public/sitemap.xml");

  console.log("\n=================================================");
  console.log("🎉 실시간 RSS / JSON Feed / Sitemap 3종 배포 완료!");
  console.log("=================================================");
}

generateAllFeedsAndSitemaps();
