import { NextResponse } from "next/server";
import { createAffiliateEvent } from "@/lib/dataStore";
import type { AffiliateEventType } from "@/lib/types";

const eventTypes = new Set<AffiliateEventType>(["impression", "detail_view", "affiliate_click", "telegram_detail_click"]);

function isEventType(value: unknown): value is AffiliateEventType {
  return typeof value === "string" && eventTypes.has(value as AffiliateEventType);
}

function clean(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  return value.trim().slice(0, maxLength) || null;
}

function cleanProductId(value: unknown) {
  const next = clean(value, 80);
  if (!next) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(next) ? next : null;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (!isEventType(body.event_type)) {
    return NextResponse.json({ error: "INVALID_EVENT_TYPE" }, { status: 400 });
  }

  const referrer = clean(body.referrer, 500) ?? clean(request.headers.get("referer"), 500);
  const event = await createAffiliateEvent({
    product_id: cleanProductId(body.product_id),
    event_type: body.event_type,
    channel: clean(body.channel, 80),
    anon_session_id: clean(body.anon_session_id, 120),
    referrer,
    utm_source: clean(body.utm_source, 120)
  });

  return NextResponse.json({ ok: true, id: event.id });
}
