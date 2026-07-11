"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { isUsableAffiliateUrl } from "@/lib/coupangLink";
import type { ProductWithScore } from "@/lib/types";

type TelegramResponse = {
  status?: string;
  message?: string;
  error?: string;
};

function headers(password: string) {
  return { "Content-Type": "application/json", "x-admin-password": password };
}

function noticeClassName(type: "info" | "success" | "error") {
  if (type === "error") return "border-coral/30 bg-coral/10 text-coral";
  if (type === "success") return "border-pine/30 bg-pine/10 text-pine";
  return "border-line bg-mist text-steel";
}

export default function TelegramPreview({ product, password }: { product: ProductWithScore | null; password: string }) {
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState<{ type: "info" | "success" | "error"; message: string } | null>(null);
  const [runningMode, setRunningMode] = useState<"preview" | "send" | null>(null);

  if (!product) {
    return (
      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <h2 className="text-lg font-black">텔레그램 발송</h2>
        <p className="mt-3 text-sm font-semibold text-steel">게시 상품을 선택하면 메시지 미리보기를 만들 수 있습니다.</p>
      </section>
    );
  }

  async function preview() {
    setRunningMode("preview");
    setNotice({ type: "info", message: "텔레그램 메시지 미리보기를 생성 중입니다." });
    try {
      const response = await fetch("/api/admin/telegram", {
        method: "POST",
        headers: headers(password),
        body: JSON.stringify({ productId: product?.id, mode: "preview" })
      });
      const data = (await response.json().catch(() => ({}))) as TelegramResponse;
      if (!response.ok) {
        setNotice({ type: "error", message: data.message ?? data.error ?? "텔레그램 미리보기를 생성하지 못했습니다." });
        return;
      }
      setMessage(data.message ?? "");
      setNotice({ type: "success", message: "텔레그램 미리보기를 생성했습니다." });
    } catch {
      setNotice({ type: "error", message: "네트워크 문제로 텔레그램 미리보기를 생성하지 못했습니다." });
    } finally {
      setRunningMode(null);
    }
  }

  async function send() {
    setRunningMode("send");
    setNotice({ type: "info", message: "텔레그램으로 발송 중입니다." });
    try {
      const response = await fetch("/api/admin/telegram", {
        method: "POST",
        headers: headers(password),
        body: JSON.stringify({ productId: product?.id, mode: "send" })
      });
      const data = (await response.json().catch(() => ({}))) as TelegramResponse;
      if (!response.ok) {
        setNotice({ type: "error", message: data.message ?? data.error ?? "텔레그램 발송에 실패했습니다." });
        return;
      }
      setMessage(data.message ?? message);
      setNotice({
        type: data.status === "sent" ? "success" : "error",
        message:
          data.status === "sent"
            ? "텔레그램 발송이 완료되었습니다."
            : data.status === "API_NOT_CONFIGURED"
              ? "TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID가 없어 실제 발송하지 못했습니다."
              : data.status ?? "텔레그램 응답 상태를 확인하세요."
      });
    } catch {
      setNotice({ type: "error", message: "네트워크 문제로 텔레그램 발송을 실행하지 못했습니다." });
    } finally {
      setRunningMode(null);
    }
  }

  const telegramReady = product.is_published && product.sourcing_status === "published" && isUsableAffiliateUrl(product.affiliate_url);

  return (
    <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-black">텔레그램 발송</h2>
        <div className="flex gap-2">
          <button
            className="focus-ring rounded-lg border border-line px-3 py-2 text-sm font-black hover:bg-mist disabled:opacity-60"
            onClick={preview}
            disabled={!telegramReady || runningMode !== null}
            type="button"
          >
            미리보기
          </button>
          <button
            className="focus-ring inline-flex items-center gap-2 rounded-lg bg-pine px-3 py-2 text-sm font-black text-white hover:bg-ink disabled:opacity-60"
            onClick={send}
            disabled={!telegramReady || runningMode !== null}
            type="button"
          >
            <Send size={16} aria-hidden /> 발송
          </button>
        </div>
      </div>
      {!telegramReady ? (
        <p className="mt-2 rounded-lg border border-coral/30 bg-coral/10 px-3 py-2 text-xs font-black text-coral">
          텔레그램 발송은 공개 상태이며 상품별 쿠팡 파트너스 링크가 준비된 상품만 가능합니다.
        </p>
      ) : null}
      {notice ? (
        <p className={`mt-2 rounded-lg border px-3 py-2 text-sm font-bold ${noticeClassName(notice.type)}`} role="status" aria-live="polite">
          {notice.message}
        </p>
      ) : null}
      <pre className="mt-4 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-ink p-4 text-sm leading-6 text-white">
        {message || "미리보기 대기"}
      </pre>
    </section>
  );
}
