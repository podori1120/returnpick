"use client";

import Link from "next/link";
import { ExternalLink, Megaphone, Send } from "lucide-react";
import { useState } from "react";
import { approvalSampleProduct } from "@/lib/approvalSample";

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

export default function AdminEditorialTelegramCampaign({ password }: { password: string }) {
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState<{ type: "info" | "success" | "error"; message: string } | null>(null);
  const [runningMode, setRunningMode] = useState<"preview" | "send" | null>(null);

  async function run(mode: "preview" | "send") {
    setRunningMode(mode);
    setNotice({ type: "info", message: mode === "preview" ? "추천 메시지 미리보기를 만드는 중입니다." : "확인한 메시지를 텔레그램으로 발송 중입니다." });
    try {
      const response = await fetch("/api/admin/telegram", {
        method: "POST",
        headers: headers(password),
        body: JSON.stringify({ campaign: "editorial_pick", mode })
      });
      const data = (await response.json().catch(() => ({}))) as TelegramResponse;
      if (!response.ok) {
        setNotice({ type: "error", message: data.message ?? data.error ?? "추천 메시지 요청에 실패했습니다." });
        return;
      }

      setMessage(data.message ?? message);
      if (mode === "preview") {
        setNotice({ type: "success", message: "추천 메시지를 확인했습니다. 내용이 맞으면 채널로 발송하세요." });
        return;
      }

      setNotice({
        type: data.status === "sent" ? "success" : "error",
        message:
          data.status === "sent"
            ? "텔레그램 채널 발송이 완료되었습니다."
            : data.status === "API_NOT_CONFIGURED"
              ? "TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID가 없어 실제 발송하지 못했습니다."
              : data.status ?? "텔레그램 응답 상태를 확인하세요."
      });
    } catch {
      setNotice({ type: "error", message: "네트워크 문제로 추천 메시지 요청을 완료하지 못했습니다." });
    } finally {
      setRunningMode(null);
    }
  }

  return (
    <section id="admin-editorial-telegram" className="rounded-lg border border-line bg-white p-5 shadow-soft scroll-mt-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-pine">
            <Megaphone size={18} aria-hidden />
            <p className="text-xs font-black">첫 매출 캠페인</p>
          </div>
          <h2 className="mt-1 text-lg font-black">직접 검수 추천 상품 텔레그램 발송</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-steel">
            {approvalSampleProduct.name} 추천 메시지를 리턴픽 상세 페이지 링크로 보냅니다. 쿠팡 직링크를 메시지에 숨기지 않고, 상세에서 근거와 제휴 고지를 본 뒤 이동하게 합니다.
          </p>
        </div>
        <Link
          className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-black hover:bg-mist"
          href={approvalSampleProduct.detailPath}
          target="_blank"
          rel="noopener noreferrer"
        >
          공개 페이지 확인 <ExternalLink size={15} aria-hidden />
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          className="focus-ring rounded-lg border border-line px-4 py-2 text-sm font-black hover:bg-mist disabled:cursor-not-allowed disabled:opacity-60"
          disabled={runningMode !== null}
          onClick={() => run("preview")}
          type="button"
        >
          {runningMode === "preview" ? "생성 중" : "메시지 미리보기"}
        </button>
        <button
          className="focus-ring inline-flex items-center gap-2 rounded-lg bg-pine px-4 py-2 text-sm font-black text-white hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!message || runningMode !== null}
          onClick={() => run("send")}
          type="button"
        >
          <Send size={16} aria-hidden /> {runningMode === "send" ? "발송 중" : "확인 후 채널로 발송"}
        </button>
        <p className="text-xs font-bold text-steel">발송 버튼은 미리보기 성공 후 활성화됩니다.</p>
      </div>

      {notice ? (
        <p className={`mt-3 rounded-lg border px-3 py-2 text-sm font-bold ${noticeClassName(notice.type)}`} role="status" aria-live="polite">
          {notice.message}
        </p>
      ) : null}

      <pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-ink p-4 text-sm leading-6 text-white">
        {message || "미리보기 전입니다. 먼저 메시지 내용을 확인하세요."}
      </pre>
    </section>
  );
}
