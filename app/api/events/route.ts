import { NextResponse } from "next/server";
import { createAffiliateEvent, getProductById } from "@/lib/dataStore";
import { isPublicDealReady } from "@/lib/publicDeal";
import type { AffiliateEventType } from "@/lib/types";

const eventTypes = new Set<AffiliateEventType>(["impression", "detail_view", "affiliate_click", "telegram_detail_click", "share_copy"]);

function isEventType(value: unknown): value is AffiliateEventType {
  return typeof value === "string" && eventTypes.has(value as AffiliateEventType);
}

function clean(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  return value.trim().slice(0, maxLength) || null;
}

function cleanTrackingLabel(value: unknown, fallback: string | null = null) {
  const raw = clean(value, 80);
  if (!raw) return fallback;
  return /^[a-z0-9][a-z0-9._-]{0,79}$/i.test(raw) ? raw.toLowerCase() : fallback;
}

function cleanReferrer(value: unknown) {
  const raw = clean(value, 500);
  if (!raw) return null;

  try {
    const url = new URL(raw);
    return `${url.origin}${url.pathname}`.slice(0, 500);
  } catch {
    return raw.split(/[?#]/)[0]?.slice(0, 500) || null;
  }
}

function cleanProductId(value: unknown) {
  const next = clean(value, 80);
  if (!next) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(next) ? next : null;
}

function cleanAnonSessionId(value: unknown) {
  const next = clean(value, 80);
  if (!next) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(next) ? next : null;
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 4096) {
    return NextResponse.json({ error: "EVENT_PAYLOAD_TOO_LARGE" }, { status: 413 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (!isEventType(body.event_type)) {
    return NextResponse.json({ error: "INVALID_EVENT_TYPE" }, { status: 400 });
  }

  const productId = cleanProductId(body.product_id);
  if (!productId) {
    return NextResponse.json({ ok: false, skipped: "PRODUCT_ID_REQUIRED" }, { status: 202 });
  }

  const referrer = cleanReferrer(body.referrer) ?? cleanReferrer(request.headers.get("referer"));
  try {
    const product = await getProductById(productId);
    if (!product || !isPublicDealReady(product)) {
      return NextResponse.json({ ok: false, skipped: "PRODUCT_NOT_PUBLIC_READY" }, { status: 202 });
    }

    const event = await createAffiliateEvent({
      product_id: productId,
      event_type: body.event_type,
      channel: cleanTrackingLabel(body.channel, "web"),
      anon_session_id: cleanAnonSessionId(body.anon_session_id),
      referrer,
      utm_source: cleanTrackingLabel(body.utm_source)
    });

    return NextResponse.json({ ok: true, id: event.id });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "EVENT_STORE_FAILED",
        ...(process.env.NODE_ENV !== "production"
          ? { detail: error instanceof Error ? error.message : "UNKNOWN_EVENT_STORE_ERROR" }
          : {})
      },
      { status: 202 }
    );
  }
}
