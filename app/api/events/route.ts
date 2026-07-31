import { NextResponse } from "next/server";
import { createAffiliateEvent, getProductById } from "@/lib/dataStore";
import { isCoupangPartnersLink } from "@/lib/coupangLink";
import { isPublicDealReady } from "@/lib/publicDeal";
import type { AffiliateEventType } from "@/lib/types";

const eventTypes = new Set<AffiliateEventType>(["impression", "detail_view", "affiliate_click", "telegram_detail_click", "share_copy"]);
const manualTrackingSurfaces = [
  {
    context: "approval_sample",
    pathname: "/products/approval-sample",
    affiliateClickChannels: ["web_approval_sample"],
    detailViewChannels: [],
    telegramDetailChannels: []
  },
  {
    context: "editorial_pick",
    pathname: "/picks/novatech-s1-window-cleaner",
    affiliateClickChannels: ["web_editorial_pick", "telegram_editorial_pick"],
    detailViewChannels: ["web_editorial_pick"],
    telegramDetailChannels: ["telegram_editorial_pick"]
  }
] as const;

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

function isManualAffiliateTrackingRequest(request: Request, body: Record<string, unknown>, channel: string | null) {
  if (!isCoupangPartnersLink(process.env.NEXT_PUBLIC_COUPANG_APPROVAL_PRODUCT_URL)) return false;

  const surface = manualTrackingSurfaces.find((item) => item.context === body.context);
  if (!surface) return false;

  const allowedChannels: readonly string[] =
    body.event_type === "affiliate_click"
      ? surface.affiliateClickChannels
      : body.event_type === "detail_view"
        ? surface.detailViewChannels
        : body.event_type === "telegram_detail_click"
          ? surface.telegramDetailChannels
          : [];
  if (!channel || !allowedChannels.includes(channel)) return false;

  const requestReferrer = request.headers.get("referer");
  if (!requestReferrer) return false;

  try {
    const referrerUrl = new URL(requestReferrer);
    const requestUrl = new URL(request.url);
    const fetchSite = request.headers.get("sec-fetch-site");
    if (fetchSite && fetchSite !== "same-origin") return false;
    if (referrerUrl.origin !== requestUrl.origin) return false;
    return referrerUrl.pathname === surface.pathname;
  } catch {
    return false;
  }
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
  const eventType = body.event_type;

  const productId = cleanProductId(body.product_id);
  const channel = cleanTrackingLabel(body.channel, "web");
  const manualAffiliateEvent = !productId && isManualAffiliateTrackingRequest(request, body, channel);
  if (!productId && !manualAffiliateEvent) {
    return NextResponse.json({ ok: false, skipped: "PRODUCT_ID_REQUIRED" }, { status: 202 });
  }

  const referrer = cleanReferrer(body.referrer) ?? cleanReferrer(request.headers.get("referer"));
  try {
    if (manualAffiliateEvent) {
      const event = await createAffiliateEvent({
        product_id: null,
        event_type: eventType,
        channel,
        anon_session_id: cleanAnonSessionId(body.anon_session_id),
        referrer,
        utm_source: cleanTrackingLabel(body.utm_source)
      });

      return NextResponse.json({ ok: true, id: event.id });
    }

    if (!productId) {
      return NextResponse.json({ ok: false, skipped: "PRODUCT_ID_REQUIRED" }, { status: 202 });
    }

    const product = await getProductById(productId);
    if (!product || !isPublicDealReady(product)) {
      return NextResponse.json({ ok: false, skipped: "PRODUCT_NOT_PUBLIC_READY" }, { status: 202 });
    }

    const event = await createAffiliateEvent({
      product_id: productId,
      event_type: eventType,
      channel,
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
