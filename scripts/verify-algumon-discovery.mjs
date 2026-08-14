#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { parseAlgumonCoupangDiscovery, MAX_ALGUMON_DISCOVERY_RESULTS } from "../lib/providers/algumonDiscoveryParser.ts";
import {
  HOTDEALS_DISCOVERY_FEED_PATH,
  MAX_HOTDEALS_DISCOVERY_RESULTS,
  MAX_HOTDEALS_HTML_CHARS,
  MAX_HOTDEALS_RECORDS_SCANNED,
  matchesHotDealsDiscoveryKeyword,
  parseHotDealsCoupangDiscovery,
  parseHotDealsCoupangDiscoveryFeed
} from "../lib/providers/hotdealsDiscoveryParser.ts";
import {
  ALGUMON_DISCOVERY_HOST,
  ALGUMON_DISCOVERY_PROFILE_ID,
  ALGUMON_DISCOVERY_SEARCH_TEMPLATE,
  ALGUMON_HOTDEALS_DISCOVERY_PROFILE_ID,
  HOTDEALS_DISCOVERY_HOST,
  HOTDEALS_DISCOVERY_PROFILE_ID,
  HOTDEALS_DISCOVERY_SEARCH_TEMPLATE,
  getPublicWebRuntimeProfile,
  isApprovedHotDealsDiscoverySearchUrl,
  matchesRequiredPublicWebProfile
} from "../lib/providers/publicWebProfile.ts";
import {
  matchesSourcedProductForUpsert,
  preserveSourcedProductReviewState,
  resolveDiscoveryReviewState
} from "../lib/sourcedProductIdentity.ts";

assert.equal(HOTDEALS_DISCOVERY_SEARCH_TEMPLATE, "https://www.hotdeals.kr/deals/DomesticDealbada?keyword={keyword}");
for (const allowedUrl of [
  "https://www.hotdeals.kr/deals/DomesticDealbada?keyword=%EB%85%B8%ED%8A%B8%EB%B6%81",
  "https://hotdeals.kr/deals/DomesticDealbada?keyword=%EB%85%B8%ED%8A%B8%EB%B6%81"
]) {
  assert.equal(isApprovedHotDealsDiscoverySearchUrl(new URL(allowedUrl)), true, allowedUrl);
}
for (const rejectedUrl of [
  "https://www.hotdeals.kr/deals/DomesticDealbada/31695?keyword=%EB%85%B8%ED%8A%B8%EB%B6%81",
  "https://www.hotdeals.kr/deals/OtherSource?keyword=%EB%85%B8%ED%8A%B8%EB%B6%81",
  "https://www.hotdeals.kr/deals?keyword=%EB%85%B8%ED%8A%B8%EB%B6%81",
  "https://www.hotdeals.kr/deals/k/%EB%85%B8%ED%8A%B8%EB%B6%81",
  "https://www.hotdeals.kr/deals/DomesticDealbada?keyword=",
  "http://www.hotdeals.kr/deals/DomesticDealbada?keyword=%EB%85%B8%ED%8A%B8%EB%B6%81",
  "https://evil.example/deals/DomesticDealbada?keyword=%EB%85%B8%ED%8A%B8%EB%B6%81"
]) {
  assert.equal(isApprovedHotDealsDiscoverySearchUrl(new URL(rejectedUrl)), false, rejectedUrl);
}

function deal({ id, store = "쿠팡", title = "테스트 상품", ad = false, ended = false, extra = "" }) {
  return `{id:${id},siteName:"뽐뿌",siteIconUrl:"https://cdn.example/icon.png",siteType:"PPOMPPU",storeName:"${store}",rankNum:null,title:"${title}",thumbnailUrl:"https://cdn.example/image.jpg",price:"19,000원",deliveryInfo:"무료",perPriceText:"",outboundUrl:"/n/d/${id}?secret=must-not-leak",originalLikes:0,createdAt:"2026-08-09T09:00:00+09:00",ended:${ended},isAd:${ad}${extra}}`;
}

const escapedTitle = String.raw`한정판 \"쿠팡\" 상품\\세트`;
const fixture = [
  "<html><body><script>",
  "deals:{contents:[",
  deal({ id: 101, title: `[쿠팡] ${escapedTitle}` }),
  deal({ id: 102, store: "G마켓" }),
  deal({ id: 103, ad: true }),
  deal({ id: 101, title: "중복 상품" }),
  deal({ id: "abc", title: "잘못된 아이디" }),
  `{id:104,storeName:"쿠팡",title:"${"x".repeat(8_100)}",ended:false,isAd:false}`,
  `{id:105,storeName:"쿠팡",title:"접두사 없는 쿠팡 상품",ended:false,isAd:false}`,
  ...Array.from({ length: 12 }, (_, index) => deal({ id: 200 + index, title: `[쿠팡] 정상 상품 ${index}` })),
  "]}},",
  "</script></body></html>"
].join("");

const records = parseAlgumonCoupangDiscovery(fixture);
assert.equal(records.length, MAX_ALGUMON_DISCOVERY_RESULTS);
assert.equal(records[0].dealId, "101");
assert.equal(records[0].title, '[쿠팡] 한정판 "쿠팡" 상품\\세트');
assert.equal(records[0].storeName, "쿠팡");
assert.equal(records.filter((record) => record.dealId === "101").length, 1);
assert.equal(records.some((record) => record.dealId === "102" || record.dealId === "103" || record.dealId === "104"), false);
assert.equal(records.some((record) => record.dealId === "105"), false);
assert.equal(parseAlgumonCoupangDiscovery('{id:999,storeName:"쿠팡",title:"종료 상태 누락",isAd:false}').length, 0);

for (const record of records) {
  assert.deepEqual(Object.keys(record).sort(), [
    "dealId",
    "deliveryInfoText",
    "displayedPriceText",
    "siteName",
    "sourceCreatedAt",
    "storeName",
    "title"
  ]);
  assert.equal("outboundUrl" in record, false);
  assert.equal("thumbnailUrl" in record, false);
}

assert.deepEqual(parseAlgumonCoupangDiscovery("x".repeat(750_001)), []);

function hotDealsCard({ href, title, className = "public-deal-card", anchorAttrs = "", h2Attrs = "" }) {
  return `<a class="${className}" href="${href}" ${anchorAttrs}><div class="deal-image-frame"><img class="deal-image" data-nimg="fill"></div><div class="public-deal-body"><div class="public-deal-tags"><span>딜바다 국내핫딜</span><span>디지털</span></div><h2 ${h2Attrs}>${title}</h2><div class="public-deal-meta"><span>10분 전 등록</span><span>추천 0</span><span>댓글 0</span></div><span class="public-deal-rank">01</span></div></a>`;
}

function hotDealsList(cards) {
  return `<div class="public-deal-list">${cards.join("")}</div>`;
}

const hotDealsPageUrl = "https://www.hotdeals.kr/deals/DomesticDealbada?keyword=%EB%85%B8%ED%8A%B8%EB%B6%81";
const hotDealsFeedUrl = `https://www.hotdeals.kr${HOTDEALS_DISCOVERY_FEED_PATH}?keyword=LG%20%EA%B7%B8%EB%9E%A8%2016`;
const hotDealsFeedFixture = `<rss><channel>${[
  `<item><title><![CDATA[[쿠팡] LG 그램 16ZD90SU-GXF6K]]></title><link>https://www.hotdeals.kr/deals/DomesticDealbada/31695</link><description>가격과 외부 링크는 읽지 않음</description></item>`,
  `<item><title>[G마켓] LG 그램</title><link>https://www.hotdeals.kr/deals/DomesticDealbada/31696</link></item>`,
  `<item><title>[쿠팡] LG 그램 중복</title><link>https://www.hotdeals.kr/deals/DomesticDealbada/31695</link></item>`,
  `<item><title>[쿠팡] 갤럭시북</title><link>https://www.hotdeals.kr/deals/DomesticDealbada/31697</link></item>`
].join("")}</channel></rss>`;
assert.deepEqual(parseHotDealsCoupangDiscoveryFeed(hotDealsFeedFixture, hotDealsFeedUrl, "LG 그램 16"), [
  {
    siteId: "DomesticDealbada",
    dealId: "31695",
    title: "[쿠팡] LG 그램 16ZD90SU-GXF6K",
    sourceUrl: "https://www.hotdeals.kr/deals/DomesticDealbada/31695"
  }
]);
assert.equal(parseHotDealsCoupangDiscoveryFeed(hotDealsFeedFixture, "https://evil.example/feeds/deals.xml", "LG 그램").length, 0);
assert.equal(parseHotDealsCoupangDiscoveryFeed("x".repeat(MAX_HOTDEALS_HTML_CHARS + 1), hotDealsFeedUrl).length, 0);
const hotDealsLiveFixture = hotDealsList([
  hotDealsCard({
    href: "/deals/DomesticDealbada/31695",
    title: "[쿠팡] LG 그램 16ZD90SU-GXF6K (1,181,000원/무료)"
  })
]);
assert.deepEqual(parseHotDealsCoupangDiscovery(hotDealsLiveFixture, hotDealsPageUrl, "LG 그램 16"), [
  {
    siteId: "DomesticDealbada",
    dealId: "31695",
    title: "[쿠팡] LG 그램 16ZD90SU-GXF6K (1,181,000원/무료)",
    sourceUrl: "https://www.hotdeals.kr/deals/DomesticDealbada/31695"
  }
]);

const hotDealsFixture = [
  `<nav><a href="/deals/DasajaHotDeal/5227914">[쿠팡] 탐색 링크</a></nav>`,
  `<aside class="advertisement"><a class="public-deal-card" href="/deals/DasajaHotDeal/5227915"><h2>[쿠팡] 광고 링크</h2></a></aside>`,
  hotDealsList([
    hotDealsCard({ href: "/deals/DasajaHotDeal/5227901", title: "[쿠팡] 레고 게임보이 &amp; 세트" }),
    hotDealsCard({ href: "/deals/DasajaHotDeal/5227902", title: "[ 쿠팡 ] 무선 키보드" }),
    hotDealsCard({ href: "/deals/DasajaHotDeal/5227903", title: "쿠팡 [상품] 마우스" }),
    hotDealsCard({ href: "/deals/DasajaHotDeal/5227904", title: "[네이버] 모니터" }),
    hotDealsCard({ href: "/deals/DasajaHotDeal/5227901", title: "[쿠팡] 중복 세트" }),
    hotDealsCard({ href: "/deals/DasajaHotDeal/not-a-number", title: "[쿠팡] 잘못된 딜" }),
    hotDealsCard({ href: "/deals/DasajaHotDeal/5227905/extra", title: "[쿠팡] 경로 추가" }),
    hotDealsCard({ href: "/deals/DasajaHotDeal/5227906?utm_source=bad", title: "[쿠팡] 쿼리 딜" }),
    hotDealsCard({ href: "https://evil.example/deals/DasajaHotDeal/5227907", title: "[쿠팡] 외부 호스트" }),
    hotDealsCard({ href: "http://www.hotdeals.kr/deals/DasajaHotDeal/5227908", title: "[쿠팡] HTTP 딜" }),
    hotDealsCard({ href: "javascript:alert(1)", title: "[쿠팡] unsafe href" }),
    hotDealsCard({ href: "/deals/DasajaHotDeal/5227909", title: "[쿠팡] 숨김 앵커", anchorAttrs: "hidden" }),
    `<div hidden>${hotDealsCard({ href: "/deals/DasajaHotDeal/5227910", title: "[쿠팡] 숨김 부모" })}</div>`,
    hotDealsCard({ href: "/deals/DasajaHotDeal/5227911", title: "[쿠팡] 숨김 제목", h2Attrs: "style=\"display:none\"" }),
    hotDealsCard({ href: "/deals/DasajaHotDeal/5227912", title: "[쿠팡] 비카드 앵커", className: "deal-card" }),
    `<a class="public-deal-card" href="/deals/DasajaHotDeal/5227913"><span>[쿠팡] 링크 전용</span></a>`,
    `<div class="advertisement"><a class="public-deal-card" href="/deals/DasajaHotDeal/5227916"><h2>[쿠팡] 중첩 광고 링크</h2></a></div>`
  ])
].join("");

const hotDealsRecords = parseHotDealsCoupangDiscovery(hotDealsFixture, hotDealsPageUrl);
assert.deepEqual(
  hotDealsRecords,
  [
    {
      siteId: "DasajaHotDeal",
      dealId: "5227901",
      title: "[쿠팡] 레고 게임보이 & 세트",
      sourceUrl: "https://www.hotdeals.kr/deals/DasajaHotDeal/5227901"
    },
    {
      siteId: "DasajaHotDeal",
      dealId: "5227902",
      title: "[ 쿠팡 ] 무선 키보드",
      sourceUrl: "https://www.hotdeals.kr/deals/DasajaHotDeal/5227902"
    }
  ]
);
for (const record of hotDealsRecords) {
  assert.deepEqual(Object.keys(record).sort(), ["dealId", "siteId", "sourceUrl", "title"]);
  assert.equal("image_url" in record, false);
  assert.equal("outbound_url" in record, false);
  assert.equal("price" in record, false);
  assert.equal("stock_count" in record, false);
}

const hotDealsCapFixture = hotDealsList(Array.from({ length: 12 }, (_, index) =>
  hotDealsCard({ href: `/deals/DasajaHotDeal/${5230000 + index}`, title: `[쿠팡] 제한 상품 ${index}` })
));
assert.equal(parseHotDealsCoupangDiscovery(hotDealsCapFixture, hotDealsPageUrl).length, MAX_HOTDEALS_DISCOVERY_RESULTS);
assert.deepEqual(parseHotDealsCoupangDiscovery("x".repeat(MAX_HOTDEALS_HTML_CHARS + 1), hotDealsPageUrl), []);
assert.deepEqual(
  parseHotDealsCoupangDiscovery(
    hotDealsList([hotDealsCard({ href: "/deals/DasajaHotDeal/5230999", title: `[쿠팡] ${"x".repeat(301)}` })]),
    hotDealsPageUrl
  ),
  []
);
const hotDealsBeyondScanCapFixture = [
  ...Array.from({ length: MAX_HOTDEALS_RECORDS_SCANNED }, (_, index) => `<a href="/deals/k/navigation-${index}">navigation</a>`),
  hotDealsLiveFixture
].join("");
assert.deepEqual(parseHotDealsCoupangDiscovery(hotDealsBeyondScanCapFixture, hotDealsPageUrl, "LG 그램 16"), []);
assert.equal(matchesHotDealsDiscoveryKeyword("[쿠팡] LG그램 16 노트북", "LG 그램"), true);
assert.equal(matchesHotDealsDiscoveryKeyword("[쿠팡] 갤럭시북 프로", "LG 그램"), false);
assert.equal(matchesHotDealsDiscoveryKeyword("[쿠팡] LG 그램 파우치", "LG 그램"), true);
assert.equal(matchesHotDealsDiscoveryKeyword("[쿠팡] LG", "L"), false);
assert.equal(matchesHotDealsDiscoveryKeyword("[쿠팡] LG 그램 17ZD90", "LG Gram 17"), true);
assert.equal(matchesHotDealsDiscoveryKeyword("[쿠팡] MacBook Pro M4", "맥북 프로 M4"), true);
assert.equal(matchesHotDealsDiscoveryKeyword("[쿠팡] 다이슨 Gen5 디텍트", "Dyson Gen5 Detect"), true);
assert.equal(matchesHotDealsDiscoveryKeyword("[쿠팡] 드리미 X50", "Dreame X50"), true);
assert.equal(matchesHotDealsDiscoveryKeyword("[쿠팡] 로보락 Qrevo 프로", "Roborock Qrevo Pro"), true);
assert.equal(matchesHotDealsDiscoveryKeyword("[쿠팡] 삼성 OLED G8", "Samsung OLED G8"), true);
assert.equal(matchesHotDealsDiscoveryKeyword("[쿠팡] OLED 게이밍 모니터", "OLED Gaming Monitor"), true);
assert.equal(matchesHotDealsDiscoveryKeyword("[쿠팡] LG 그램 16", "LG Gram 17"), false);
assert.equal(matchesHotDealsDiscoveryKeyword("[쿠팡] LG 그램", "LG Gram 17"), false);
assert.equal(matchesHotDealsDiscoveryKeyword("[쿠팡] 고급 프로젝터 4K", "프로"), false);
assert.equal(matchesHotDealsDiscoveryKeyword("[쿠팡] Professional 모니터 암", "pro"), false);
assert.equal(matchesHotDealsDiscoveryKeyword("[쿠팡] Hair Dryer", "에어"), false);
assert.equal(matchesHotDealsDiscoveryKeyword("[쿠팡] 1 kilogram 주방저울", "그램"), false);
assert.equal(matchesHotDealsDiscoveryKeyword("[쿠팡] 1 kilogram 17단계 주방저울", "그램 17"), false);
assert.deepEqual(
  parseHotDealsCoupangDiscovery(hotDealsFixture, hotDealsPageUrl, "무선 키보드").map((record) => record.dealId),
  ["5227902"]
);
assert.deepEqual(parseHotDealsCoupangDiscovery(hotDealsFixture, hotDealsPageUrl, "갤럭시북"), []);
assert.deepEqual(parseHotDealsCoupangDiscovery(hotDealsLiveFixture, "https://evil.example/deals/k/쿠팡", "LG 그램 16"), []);

const exactProfile = getPublicWebRuntimeProfile({
  PUBLIC_WEB_CRAWL_ENABLED: "true",
  PUBLIC_WEB_ALLOWED_HOSTS: ALGUMON_DISCOVERY_HOST,
  PUBLIC_WEB_SEARCH_TEMPLATES: ALGUMON_DISCOVERY_SEARCH_TEMPLATE
});
assert.deepEqual(exactProfile, {
  id: ALGUMON_DISCOVERY_PROFILE_ID,
  enabled: true,
  exactMatch: true,
  hostCount: 1,
  templateCount: 1
});
assert.equal(matchesRequiredPublicWebProfile(ALGUMON_DISCOVERY_PROFILE_ID, exactProfile), true);
assert.equal(matchesRequiredPublicWebProfile(undefined, exactProfile), false);
assert.equal(matchesRequiredPublicWebProfile("", exactProfile), false);
assert.equal(matchesRequiredPublicWebProfile("   ", exactProfile), false);
assert.equal(matchesRequiredPublicWebProfile("custom", exactProfile), false);
assert.equal(
  getPublicWebRuntimeProfile({
    PUBLIC_WEB_CRAWL_ENABLED: "true",
    PUBLIC_WEB_ALLOWED_HOSTS: `${ALGUMON_DISCOVERY_HOST},example.com`,
    PUBLIC_WEB_SEARCH_TEMPLATES: ALGUMON_DISCOVERY_SEARCH_TEMPLATE
  }).exactMatch,
  false
);

const hotDealsProfile = getPublicWebRuntimeProfile({
  PUBLIC_WEB_CRAWL_ENABLED: "true",
  PUBLIC_WEB_ALLOWED_HOSTS: HOTDEALS_DISCOVERY_HOST,
  PUBLIC_WEB_SEARCH_TEMPLATES: HOTDEALS_DISCOVERY_SEARCH_TEMPLATE
});
assert.deepEqual(hotDealsProfile, {
  id: HOTDEALS_DISCOVERY_PROFILE_ID,
  enabled: true,
  exactMatch: true,
  hostCount: 1,
  templateCount: 1
});
assert.equal(matchesRequiredPublicWebProfile(HOTDEALS_DISCOVERY_PROFILE_ID, hotDealsProfile), true);
assert.equal(matchesRequiredPublicWebProfile(ALGUMON_DISCOVERY_PROFILE_ID, hotDealsProfile), false);
assert.equal(
  getPublicWebRuntimeProfile({
    PUBLIC_WEB_CRAWL_ENABLED: "true",
    PUBLIC_WEB_ALLOWED_HOSTS: HOTDEALS_DISCOVERY_HOST,
    PUBLIC_WEB_SEARCH_TEMPLATES: `${HOTDEALS_DISCOVERY_SEARCH_TEMPLATE},https://example.com/{keyword}`
  }).id,
  "custom"
);
for (const malformedSingleProfile of [
  {
    name: "Algumon trailing host comma",
    PUBLIC_WEB_ALLOWED_HOSTS: `${ALGUMON_DISCOVERY_HOST},`,
    PUBLIC_WEB_SEARCH_TEMPLATES: ALGUMON_DISCOVERY_SEARCH_TEMPLATE,
    required: ALGUMON_DISCOVERY_PROFILE_ID
  },
  {
    name: "HotDeals leading template comma",
    PUBLIC_WEB_ALLOWED_HOSTS: HOTDEALS_DISCOVERY_HOST,
    PUBLIC_WEB_SEARCH_TEMPLATES: `,${HOTDEALS_DISCOVERY_SEARCH_TEMPLATE}`,
    required: HOTDEALS_DISCOVERY_PROFILE_ID
  },
  {
    name: "HotDeals doubled host comma",
    PUBLIC_WEB_ALLOWED_HOSTS: `${HOTDEALS_DISCOVERY_HOST},,`,
    PUBLIC_WEB_SEARCH_TEMPLATES: HOTDEALS_DISCOVERY_SEARCH_TEMPLATE,
    required: HOTDEALS_DISCOVERY_PROFILE_ID
  }
]) {
  const malformedProfile = getPublicWebRuntimeProfile({
    PUBLIC_WEB_CRAWL_ENABLED: "true",
    PUBLIC_WEB_ALLOWED_HOSTS: malformedSingleProfile.PUBLIC_WEB_ALLOWED_HOSTS,
    PUBLIC_WEB_SEARCH_TEMPLATES: malformedSingleProfile.PUBLIC_WEB_SEARCH_TEMPLATES
  });
  assert.equal(malformedProfile.id, "custom", malformedSingleProfile.name);
  assert.equal(malformedProfile.exactMatch, false, malformedSingleProfile.name);
  assert.equal(matchesRequiredPublicWebProfile(malformedSingleProfile.required, malformedProfile), false, malformedSingleProfile.name);
}

const combinedProfile = getPublicWebRuntimeProfile({
  PUBLIC_WEB_CRAWL_ENABLED: "true",
  PUBLIC_WEB_ALLOWED_HOSTS: `${ALGUMON_DISCOVERY_HOST},${HOTDEALS_DISCOVERY_HOST}`,
  PUBLIC_WEB_SEARCH_TEMPLATES: `${ALGUMON_DISCOVERY_SEARCH_TEMPLATE},${HOTDEALS_DISCOVERY_SEARCH_TEMPLATE}`
});
assert.deepEqual(combinedProfile, {
  id: ALGUMON_HOTDEALS_DISCOVERY_PROFILE_ID,
  enabled: true,
  exactMatch: true,
  hostCount: 2,
  templateCount: 2
});
assert.equal(matchesRequiredPublicWebProfile(ALGUMON_HOTDEALS_DISCOVERY_PROFILE_ID, combinedProfile), true);
assert.equal(matchesRequiredPublicWebProfile(ALGUMON_DISCOVERY_PROFILE_ID, combinedProfile), false);
assert.equal(matchesRequiredPublicWebProfile(HOTDEALS_DISCOVERY_PROFILE_ID, combinedProfile), false);

const invalidCombinedProfiles = [
  {
    name: "reversed hosts",
    PUBLIC_WEB_ALLOWED_HOSTS: `${HOTDEALS_DISCOVERY_HOST},${ALGUMON_DISCOVERY_HOST}`,
    PUBLIC_WEB_SEARCH_TEMPLATES: `${ALGUMON_DISCOVERY_SEARCH_TEMPLATE},${HOTDEALS_DISCOVERY_SEARCH_TEMPLATE}`
  },
  {
    name: "reversed templates",
    PUBLIC_WEB_ALLOWED_HOSTS: `${ALGUMON_DISCOVERY_HOST},${HOTDEALS_DISCOVERY_HOST}`,
    PUBLIC_WEB_SEARCH_TEMPLATES: `${HOTDEALS_DISCOVERY_SEARCH_TEMPLATE},${ALGUMON_DISCOVERY_SEARCH_TEMPLATE}`
  },
  {
    name: "duplicate host",
    PUBLIC_WEB_ALLOWED_HOSTS: `${ALGUMON_DISCOVERY_HOST},${ALGUMON_DISCOVERY_HOST}`,
    PUBLIC_WEB_SEARCH_TEMPLATES: `${ALGUMON_DISCOVERY_SEARCH_TEMPLATE},${HOTDEALS_DISCOVERY_SEARCH_TEMPLATE}`
  },
  {
    name: "duplicate template",
    PUBLIC_WEB_ALLOWED_HOSTS: `${ALGUMON_DISCOVERY_HOST},${HOTDEALS_DISCOVERY_HOST}`,
    PUBLIC_WEB_SEARCH_TEMPLATES: `${ALGUMON_DISCOVERY_SEARCH_TEMPLATE},${ALGUMON_DISCOVERY_SEARCH_TEMPLATE}`
  },
  {
    name: "extra host",
    PUBLIC_WEB_ALLOWED_HOSTS: `${ALGUMON_DISCOVERY_HOST},${HOTDEALS_DISCOVERY_HOST},example.com`,
    PUBLIC_WEB_SEARCH_TEMPLATES: `${ALGUMON_DISCOVERY_SEARCH_TEMPLATE},${HOTDEALS_DISCOVERY_SEARCH_TEMPLATE}`
  },
  {
    name: "extra template",
    PUBLIC_WEB_ALLOWED_HOSTS: `${ALGUMON_DISCOVERY_HOST},${HOTDEALS_DISCOVERY_HOST}`,
    PUBLIC_WEB_SEARCH_TEMPLATES: `${ALGUMON_DISCOVERY_SEARCH_TEMPLATE},${HOTDEALS_DISCOVERY_SEARCH_TEMPLATE},https://example.com/{keyword}`
  },
  {
    name: "malformed host",
    PUBLIC_WEB_ALLOWED_HOSTS: `${ALGUMON_DISCOVERY_HOST},https://${HOTDEALS_DISCOVERY_HOST}`,
    PUBLIC_WEB_SEARCH_TEMPLATES: `${ALGUMON_DISCOVERY_SEARCH_TEMPLATE},${HOTDEALS_DISCOVERY_SEARCH_TEMPLATE}`
  },
  {
    name: "malformed template",
    PUBLIC_WEB_ALLOWED_HOSTS: `${ALGUMON_DISCOVERY_HOST},${HOTDEALS_DISCOVERY_HOST}`,
    PUBLIC_WEB_SEARCH_TEMPLATES: `${ALGUMON_DISCOVERY_SEARCH_TEMPLATE},https://${HOTDEALS_DISCOVERY_HOST}/deals`
  },
  {
    name: "partial lists",
    PUBLIC_WEB_ALLOWED_HOSTS: `${ALGUMON_DISCOVERY_HOST},${HOTDEALS_DISCOVERY_HOST}`,
    PUBLIC_WEB_SEARCH_TEMPLATES: ALGUMON_DISCOVERY_SEARCH_TEMPLATE
  },
  {
    name: "empty list item",
    PUBLIC_WEB_ALLOWED_HOSTS: `${ALGUMON_DISCOVERY_HOST},,${HOTDEALS_DISCOVERY_HOST}`,
    PUBLIC_WEB_SEARCH_TEMPLATES: `${ALGUMON_DISCOVERY_SEARCH_TEMPLATE},${HOTDEALS_DISCOVERY_SEARCH_TEMPLATE}`
  }
];
for (const invalidProfileEnv of invalidCombinedProfiles) {
  const invalidProfile = getPublicWebRuntimeProfile({
    PUBLIC_WEB_CRAWL_ENABLED: "true",
    PUBLIC_WEB_ALLOWED_HOSTS: invalidProfileEnv.PUBLIC_WEB_ALLOWED_HOSTS,
    PUBLIC_WEB_SEARCH_TEMPLATES: invalidProfileEnv.PUBLIC_WEB_SEARCH_TEMPLATES
  });
  assert.equal(invalidProfile.id, "custom", invalidProfileEnv.name);
  assert.equal(invalidProfile.exactMatch, false, invalidProfileEnv.name);
  assert.equal(matchesRequiredPublicWebProfile(ALGUMON_HOTDEALS_DISCOVERY_PROFILE_ID, invalidProfile), false, invalidProfileEnv.name);
}
const disabledCombinedProfile = getPublicWebRuntimeProfile({
  PUBLIC_WEB_CRAWL_ENABLED: "false",
  PUBLIC_WEB_ALLOWED_HOSTS: `${ALGUMON_DISCOVERY_HOST},${HOTDEALS_DISCOVERY_HOST}`,
  PUBLIC_WEB_SEARCH_TEMPLATES: `${ALGUMON_DISCOVERY_SEARCH_TEMPLATE},${HOTDEALS_DISCOVERY_SEARCH_TEMPLATE}`
});
assert.equal(disabledCombinedProfile.id, "disabled");
assert.equal(disabledCombinedProfile.exactMatch, false);
assert.equal(matchesRequiredPublicWebProfile(ALGUMON_HOTDEALS_DISCOVERY_PROFILE_ID, disabledCombinedProfile), false);

const disabledProfile = getPublicWebRuntimeProfile({
  PUBLIC_WEB_CRAWL_ENABLED: "false",
  PUBLIC_WEB_ALLOWED_HOSTS: HOTDEALS_DISCOVERY_HOST,
  PUBLIC_WEB_SEARCH_TEMPLATES: HOTDEALS_DISCOVERY_SEARCH_TEMPLATE
});
assert.equal(disabledProfile.id, "disabled");
assert.equal(matchesRequiredPublicWebProfile(HOTDEALS_DISCOVERY_PROFILE_ID, disabledProfile), false);

const approvedPublishedReviewState = {
  sourcing_status: "approved",
  is_published: true,
  is_rejected: false,
  rejection_reason: null
};
const rejectedReviewState = {
  sourcing_status: "rejected",
  is_published: false,
  is_rejected: true,
  rejection_reason: "manual rejection retained"
};
assert.deepEqual(resolveDiscoveryReviewState(approvedPublishedReviewState, true), {
  sourcing_status: "needs_review",
  is_published: false,
  is_rejected: false,
  rejection_reason: null
});
assert.deepEqual(resolveDiscoveryReviewState(approvedPublishedReviewState, false), approvedPublishedReviewState);
assert.deepEqual(resolveDiscoveryReviewState(rejectedReviewState, false), rejectedReviewState);

const sharedTitle = "[쿠팡] 동일 제목 노트북";
const hotDealsIdentityA = {
  source: "hotdeals_discovery",
  source_product_id: "hotdeals:SiteA:100",
  category: "laptop",
  title: sharedTitle
};
const hotDealsIdentityB = {
  ...hotDealsIdentityA,
  source_product_id: "hotdeals:SiteA:101"
};
const publishedManualIdentity = {
  source: "manual_admin",
  source_product_id: "manual:published-1",
  category: "laptop",
  title: sharedTitle,
  sourcing_status: "published",
  is_published: true,
  is_rejected: false,
  rejection_reason: null
};
assert.equal(matchesSourcedProductForUpsert(hotDealsIdentityA, hotDealsIdentityA, "source_identity_only"), true);
assert.equal(matchesSourcedProductForUpsert(hotDealsIdentityA, hotDealsIdentityB, "source_identity_only"), false);
assert.equal(matchesSourcedProductForUpsert(publishedManualIdentity, hotDealsIdentityA, "source_identity_only"), false);
assert.equal(matchesSourcedProductForUpsert(publishedManualIdentity, hotDealsIdentityA, "source_or_title"), true);
assert.deepEqual(
  preserveSourcedProductReviewState({
    sourcing_status: "rejected",
    is_published: false,
    is_rejected: true,
    rejection_reason: "검토 제외 유지"
  }),
  {
    sourcing_status: "rejected",
    is_published: false,
    is_rejected: true,
    rejection_reason: "검토 제외 유지"
  }
);

const root = process.cwd();
const readmeSource = fs.readFileSync(path.join(root, "README.md"), "utf8");
const parserSource = fs.readFileSync(path.join(root, "lib", "providers", "algumonDiscoveryParser.ts"), "utf8");
const hotDealsParserSource = fs.readFileSync(path.join(root, "lib", "providers", "hotdealsDiscoveryParser.ts"), "utf8");
const providerSource = fs.readFileSync(path.join(root, "lib", "providers", "publicWebProvider.ts"), "utf8");
const sourcingSource = fs.readFileSync(path.join(root, "lib", "sourcing.ts"), "utf8");
const qualitySource = fs.readFileSync(path.join(root, "lib", "quality.ts"), "utf8");
const dataStoreSource = fs.readFileSync(path.join(root, "lib", "dataStore.ts"), "utf8");
const schemaSource = fs.readFileSync(path.join(root, "sql", "schema.sql"), "utf8");
const readinessRouteSource = fs.readFileSync(path.join(root, "app", "api", "admin", "api-readiness", "route.ts"), "utf8");
const sourcingRouteSource = fs.readFileSync(path.join(root, "app", "api", "admin", "sourcing", "run", "route.ts"), "utf8");

assert.match(readmeSource, /PUBLIC_WEB_SEARCH_TEMPLATES=https:\/\/www\.algumon\.com\/n\/deal\?keyword=\{keyword\},https:\/\/www\.hotdeals\.kr\/deals\/DomesticDealbada\?keyword=\{keyword\}/);
assert.doesNotMatch(readmeSource, /www\.hotdeals\.kr\/deals\/k\//);
assert.equal(parserSource.includes("eval("), false);
assert.equal(parserSource.includes("new Function"), false);
assert.equal(parserSource.includes("outboundUrl"), false);
assert.equal(parserSource.includes("thumbnailUrl"), false);
assert.match(parserSource, /\^\\\[\\s\*쿠팡\\s\*\\\]/u);
assert.equal(hotDealsParserSource.includes("eval("), false);
assert.equal(hotDealsParserSource.includes("new Function"), false);
assert.equal(hotDealsParserSource.includes("image_url"), false);
assert.equal(hotDealsParserSource.includes("outbound_url"), false);
assert.equal(hotDealsParserSource.includes("price"), false);
assert.equal(hotDealsParserSource.includes("stock_count"), false);
assert.equal(hotDealsParserSource.includes("fetch("), false);
assert.match(hotDealsParserSource, /public-deal-list/);
assert.match(hotDealsParserSource, /hasHotDealsListParent/);
assert.match(providerSource, /source: "algumon_discovery"/);
assert.match(providerSource, /title: `\[알구몬 후보 #\$\{record\.dealId\}\]/);
assert.match(providerSource, /source_title: record\.title/);
assert.match(providerSource, /source_url: page\.toString\(\)/);
assert.match(providerSource, /url\.protocol === "https:"/);
assert.match(providerSource, /if \(isAlgumonHost\(base\)\)/);
assert.match(providerSource, /allowedHosts\.has\(base\.hostname\.toLowerCase\(\)\)/);
assert.match(providerSource, /return isAlgumonDealSearchPage\(base\) \? extractAlgumonDiscoveryCards/);
assert.match(providerSource, /outbound_not_fetched: true/);
assert.match(providerSource, /requires_manual_coupang_url: true/);
assert.match(providerSource, /product\.source === "algumon_discovery"/);
assert.match(providerSource, /source: "hotdeals_discovery"/);
assert.match(providerSource, /source_product_id: `hotdeals:\$\{record\.siteId\}:\$\{record\.dealId\}`/);
assert.match(providerSource, /source_url: record\.sourceUrl/);
assert.match(providerSource, /parseHotDealsCoupangDiscovery/);
assert.match(providerSource, /parseHotDealsCoupangDiscovery\(html, pageUrl, keyword\)/);
assert.match(providerSource, /parseHotDealsCoupangDiscoveryFeed\(html, pageUrl, keyword\)/);
assert.match(providerSource, /isHotDealsFeedPage/);
assert.match(providerSource, /isAllowedPublicWebSearchContentType/);
assert.match(providerSource, /application\/rss\+xml/);
assert.match(providerSource, /feed_only: true/);
assert.match(providerSource, /isHotDealsKeywordSearchPage/);
assert.match(providerSource, /isApprovedHotDealsDiscoverySearchUrl/);
assert.match(providerSource, /discovery_only: true/);
assert.match(providerSource, /source_site_id: record\.siteId/);
assert.match(providerSource, /source_deal_id: record\.dealId/);
assert.match(providerSource, /HOTDEALS_DISCOVERY_MANUAL_REVIEW|hotdeals_discovery/);
assert.match(providerSource, /image_url: null/);
assert.match(providerSource, /coupang_url: null/);
assert.match(providerSource, /affiliate_url: null/);
assert.match(providerSource, /source_price: null/);
assert.match(providerSource, /return_price: null/);
assert.match(providerSource, /new_price: null/);
assert.match(providerSource, /stock_count: null/);
assert.match(sourcingSource, /ALGUMON_DISCOVERY_MANUAL_REVIEW/);
assert.match(sourcingSource, /if \(isDiscoveryOnlyProduct\(product\)\) return "needs_review"/);
assert.match(sourcingSource, /resolveDiscoveryReviewState\(saved, inserted\)/);
assert.match(sourcingSource, /is_published: discoveryOnly \? discoveryReviewState!\.is_published : saved\.is_published/);
assert.match(qualitySource, /product\.source === "algumon_discovery"/);
assert.match(qualitySource, /새 수동 상품으로 등록해야 합니다/);
assert.match(sourcingSource, /function isDiscoveryOnlyProduct/);
assert.match(sourcingSource, /HOTDEALS_DISCOVERY_MANUAL_REVIEW/);
assert.match(sourcingSource, /matchMode: discoveryOnly \? "source_identity_only" : "source_or_title"/);
assert.match(dataStoreSource, /if \(!existing && matchMode !== "source_identity_only"\)/);
assert.match(dataStoreSource, /matchesSourcedProductForUpsert\(product, payload, matchMode\)/);
assert.match(dataStoreSource, /preserveSourcedProductReviewState\(existing\)/);
assert.match(schemaSource, /create unique index if not exists sourced_products_source_product_key/);
assert.match(schemaSource, /drop index if exists sourced_products_title_category_key;/);
assert.match(
  schemaSource,
  /create unique index sourced_products_title_category_key\s+on sourced_products \(lower\(title\), category\)\s+where source not in \('algumon_discovery', 'hotdeals_discovery'\);/
);
assert.match(qualitySource, /product\.source === "hotdeals_discovery"/);
assert.match(qualitySource, /HotDeals 후보는 실제 쿠팡 상품과 상품별 파트너스 링크/);
assert.match(readinessRouteSource, /publicWebProfile = getPublicWebRuntimeProfile\(\)/);
assert.match(readinessRouteSource, /NextResponse\.json\(\{ readiness, storage, checks, publicWebProfile(?:, mode)? \}\)/);
assert.match(readinessRouteSource, /runApiConnectionChecks\(mode\)/);
assert.match(sourcingRouteSource, /matchesRequiredPublicWebProfile\(body\.requiredPublicWebProfile, publicWebProfile\)/);
assert.match(sourcingRouteSource, /PUBLIC_WEB_PROFILE_MISMATCH/);
assert.ok(
  sourcingRouteSource.indexOf("PUBLIC_WEB_PROFILE_MISMATCH") < sourcingRouteSource.indexOf("await runSourcing"),
  "profile mismatch must return before runSourcing can write"
);

const detailSkip = providerSource.indexOf('if (product.source === "algumon_discovery")');
const generalizedDiscoverySkip = providerSource.indexOf("if (isDiscoveryOnlyProviderProduct(product))");
const detailFetch = providerSource.indexOf("const response = await fetchWithTimeout(normalizedUrl", detailSkip);
assert.ok(detailSkip >= 0 && detailFetch > detailSkip, "Algumon discovery must be skipped before any detail fetch");
assert.ok(generalizedDiscoverySkip >= 0 && detailFetch > generalizedDiscoverySkip, "All discovery-only products must be skipped before any detail fetch");

console.log(`Algumon/HotDeals discovery checks passed: ${records.length} Algumon and ${hotDealsRecords.length} HotDeals bounded review-only records, exact profiles, isolated titles, null commerce fields, no ads, duplicates, images, outbound paths, or automatic detail visits.`);
