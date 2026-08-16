/**
 * Fallcent (폴센트) 가격 변동 추적 및 60일 가격 히스토리 검증 모듈
 */

export interface FallcentPriceHistory {
  product_name: string;
  fallcent_product_id: string;
  current_price: number;
  lowest_price_60d: number;
  highest_price_60d: number;
  average_price_60d: number;
  is_all_time_low: boolean;
  price_drop_amount: number;
  price_drop_rate: number;
  trend_summary: string;
  date_list: string[];
  lowest_price_list: number[];
}

function fnv1a(seed: number, timestamp: number): string {
  const data = new Uint8Array(8);
  const view = new DataView(data.buffer);
  view.setUint32(0, seed >>> 0, false);
  view.setUint32(4, timestamp >>> 0, false);

  let h = 0x811c9dc5;
  for (let i = 0; i < data.length; i++) {
    h ^= data[i];
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export async function fetchFallcentPriceAnalysis(keywordOrTitle: string, currentPrice?: number): Promise<FallcentPriceHistory | null> {
  try {
    const cleanKeyword = keywordOrTitle
      .replace(/\[[^\]]+\]/g, "")
      .replace(/\([^)]+\)/g, "")
      .split(" ")
      .filter(w => w.length >= 2)
      .slice(0, 3)
      .join(" ");

    const searchUrl = `https://fallcent.com/product/search/?keyword=${encodeURIComponent(cleanKeyword || keywordOrTitle)}`;
    const searchRes = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      }
    });

    const searchHtml = await searchRes.text();
    const productLinkMatch = searchHtml.match(/\/product\/([a-zA-Z0-9_-]{20,})\//);
    if (!productLinkMatch) {
      return null;
    }

    const fallcentProductId = productLinkMatch[1];
    const detailUrl = `https://fallcent.com/product/${fallcentProductId}/`;
    
    const detailRes = await fetch(detailUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      }
    });

    const rawCookies = detailRes.headers.getSetCookie ? detailRes.headers.getSetCookie() : [detailRes.headers.get("set-cookie") || ""];
    const cookieHeader = rawCookies.map(c => c.split(";")[0]).filter(Boolean).join("; ");
    const detailHtml = await detailRes.text();

    const seedMatch = detailHtml.match(/data-chart-seed="(\d+)"/);
    if (!seedMatch) return null;

    const seed = parseInt(seedMatch[1], 10);
    const ts = Math.floor(Date.now() / 1000);
    const challenge = fnv1a(seed, ts);
    const deviceIdMatch = cookieHeader.match(/web_device_id=([a-f0-9]{32})/);
    const fp = deviceIdMatch ? deviceIdMatch[1] : "984541d7d50e4e799ff67ea633c54553";

    const chartApiUrl = `https://fallcent.com/api/v1/products/chart/${fallcentProductId}/?challenge=${challenge}&ts=${ts}&fp=${fp}`;
    const chartRes = await fetch(chartApiUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": detailUrl,
        "Cookie": cookieHeader,
        "Accept": "application/json, text/plain, */*",
        "X-Requested-With": "XMLHttpRequest"
      }
    });

    if (chartRes.status !== 200) return null;
    const chartJson = await chartRes.json();
    if (chartJson?.meta?.code !== "SUCCESS" || !chartJson?.data?.lowest_price_list) return null;

    const lowestList: number[] = chartJson.data.lowest_price_list;
    const highestList: number[] = chartJson.data.highest_price_list;
    const dateList: string[] = chartJson.data.date_list;

    const min60d = Math.min(...lowestList);
    const max60d = Math.max(...highestList);
    const avg60d = Math.round(lowestList.reduce((a, b) => a + b, 0) / lowestList.length);
    const targetPrice = currentPrice || lowestList[lowestList.length - 1];

    const isAllTimeLow = targetPrice <= min60d;
    const dropAmount = Math.max(0, avg60d - targetPrice);
    const dropRate = avg60d > 0 ? Math.round((dropAmount / avg60d) * 100) : 0;

    let trendSummary = `최근 60일 평균가(${avg60d.toLocaleString()}원) 대비 약 ${dropAmount.toLocaleString()}원(${dropRate}%) 저렴합니다.`;
    if (isAllTimeLow) {
      trendSummary = `🔥 [역대 최저가 달성] 최근 60일 중 가장 저렴한 가격(${min60d.toLocaleString()}원) 수준입니다!`;
    }

    return {
      product_name: keywordOrTitle,
      fallcent_product_id: fallcentProductId,
      current_price: targetPrice,
      lowest_price_60d: min60d,
      highest_price_60d: max60d,
      average_price_60d: avg60d,
      is_all_time_low: isAllTimeLow,
      price_drop_amount: dropAmount,
      price_drop_rate: dropRate,
      trend_summary: trendSummary,
      date_list: dateList,
      lowest_price_list: lowestList
    };
  } catch (error) {
    return null;
  }
}
