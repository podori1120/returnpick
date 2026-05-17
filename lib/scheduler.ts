import { listProducts, listTelegramLogs } from "@/lib/dataStore";
import { getDiscountRate } from "@/lib/dealIntelligence";
import { getLatestScore } from "@/lib/scoring";
import { runSourcing } from "@/lib/sourcing";
import { sendTelegramForProduct } from "@/lib/telegram";

export async function runScheduledSourcing() {
  const useMockFallback = process.env.CRON_USE_MOCK_FALLBACK !== "false";
  const run = await runSourcing({ useMockFallback });

  return {
    type: "sourcing",
    status: run.status,
    run_id: run.id,
    keyword_count: run.keyword_count,
    found_count: run.found_count,
    inserted_count: run.inserted_count,
    updated_count: run.updated_count,
    error_count: run.error_count
  };
}

export async function runScheduledTelegramDigest(limit = 1) {
  const logs = await listTelegramLogs(2000);
  const sentProductIds = new Set(logs.filter((log) => log.status === "sent" && log.product_id).map((log) => log.product_id as string));
  const products = await listProducts({ published: true });
  const candidates = products
    .filter((product) => product.sourcing_status === "published")
    .filter((product) => Boolean(product.affiliate_url))
    .filter((product) => product.stock_count !== 0)
    .filter((product) => !sentProductIds.has(product.id))
    .filter((product) => (getLatestScore(product)?.total_score ?? 0) >= 75)
    .sort((a, b) => {
      const scoreGap = (getLatestScore(b)?.total_score ?? 0) - (getLatestScore(a)?.total_score ?? 0);
      if (scoreGap) return scoreGap;
      return (getDiscountRate(b) ?? 0) - (getDiscountRate(a) ?? 0);
    })
    .slice(0, Math.max(1, Math.min(3, limit)));

  const results = [];
  for (const product of candidates) {
    try {
      const result = await sendTelegramForProduct(product.id);
      results.push({
        product_id: product.id,
        title: product.title,
        status: result.status
      });
    } catch (error) {
      results.push({
        product_id: product.id,
        title: product.title,
        status: "error",
        error: error instanceof Error ? error.message : "UNKNOWN_TELEGRAM_ERROR"
      });
    }
  }

  return {
    type: "telegram_digest",
    candidate_count: candidates.length,
    sent_count: results.filter((item) => item.status === "sent").length,
    skipped_reason: candidates.length ? null : "NO_UNSENT_PUBLISHED_DEALS_WITH_AFFILIATE_URL",
    results
  };
}
