"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import type { ProductWithScore } from "@/lib/types";

function headers(password: string) {
  return { "Content-Type": "application/json", "x-admin-password": password };
}

export default function TelegramPreview({ product, password }: { product: ProductWithScore | null; password: string }) {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");

  if (!product) {
    return (
      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <h2 className="text-lg font-black">텔레그램 발송</h2>
        <p className="mt-3 text-sm font-semibold text-steel">게시 상품을 선택하면 미리보기가 열립니다.</p>
      </section>
    );
  }

  async function preview() {
    const response = await fetch("/api/admin/telegram", {
      method: "POST",
      headers: headers(password),
      body: JSON.stringify({ productId: product?.id, mode: "preview" })
    });
    const data = await response.json();
    setMessage(data.message ?? "");
    setStatus(data.status ?? "");
  }

  async function send() {
    const response = await fetch("/api/admin/telegram", {
      method: "POST",
      headers: headers(password),
      body: JSON.stringify({ productId: product?.id, mode: "send" })
    });
    const data = await response.json();
    setMessage(data.message ?? message);
    setStatus(data.status ?? data.error ?? "sent");
  }

  return (
    <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-black">텔레그램 발송</h2>
        <div className="flex gap-2">
          <button className="focus-ring rounded-lg border border-line px-3 py-2 text-sm font-black hover:bg-mist" onClick={preview} type="button">
            미리보기
          </button>
          <button
            className="focus-ring inline-flex items-center gap-2 rounded-lg bg-pine px-3 py-2 text-sm font-black text-white hover:bg-ink disabled:opacity-60"
            onClick={send}
            disabled={!product.is_published || product.sourcing_status !== "published"}
            type="button"
          >
            <Send size={16} aria-hidden /> 발송
          </button>
        </div>
      </div>
      {status ? <p className="mt-2 text-sm font-bold text-steel">상태: {status}</p> : null}
      <pre className="mt-4 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-ink p-4 text-sm leading-6 text-white">
        {message || "미리보기 대기"}
      </pre>
    </section>
  );
}
