"use client";

import Link from "next/link";
import { Copy, ExternalLink, FileText, Megaphone, MessageCircle, RefreshCw, Send } from "lucide-react";
import { useState } from "react";
import { approvalSampleProduct } from "@/lib/approvalSample";
import type { EditorialCampaignKit } from "@/lib/editorialCampaign";

type ApiResponse = {
  kit?: EditorialCampaignKit;
  status?: string;
  message?: string;
  error?: string;
};

type Notice = { type: "info" | "success" | "error"; message: string };

function headers(password: string) {
  return { "Content-Type": "application/json", "x-admin-password": password };
}

function noticeClassName(type: Notice["type"]) {
  if (type === "error") return "border-coral/30 bg-coral/10 text-coral";
  if (type === "success") return "border-pine/30 bg-pine/10 text-pine";
  return "border-line bg-mist text-steel";
}

export default function AdminEditorialTelegramCampaign({ password }: { password: string }) {
  const [kit, setKit] = useState<EditorialCampaignKit | null>(null);
  const [activeChannel, setActiveChannel] = useState<"telegram" | "naverBlog">("telegram");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [running, setRunning] = useState<"load" | "send" | "copy" | null>(null);

  async function loadKit() {
    setRunning("load");
    setNotice({ type: "info", message: "채널별 배포 원고를 만드는 중입니다." });
    try {
      const response = await fetch("/api/admin/editorial-campaign", { headers: headers(password), cache: "no-store" });
      const data = (await response.json().catch(() => ({}))) as ApiResponse;
      if (!response.ok || !data.kit) {
        setNotice({ type: "error", message: data.message ?? data.error ?? "배포 원고를 만들지 못했습니다." });
        return;
      }
      setKit(data.kit);
      setNotice({ type: "success", message: "텔레그램과 네이버 블로그 원고를 확인했습니다." });
    } catch {
      setNotice({ type: "error", message: "네트워크 문제로 배포 원고를 만들지 못했습니다." });
    } finally {
      setRunning(null);
    }
  }

  async function copyText(value: string, label: string) {
    setRunning("copy");
    try {
      await navigator.clipboard.writeText(value);
      setNotice({ type: "success", message: `${label}을 복사했습니다.` });
    } catch {
      setNotice({ type: "error", message: `${label}을 복사하지 못했습니다. 브라우저의 클립보드 권한을 확인하세요.` });
    } finally {
      setRunning(null);
    }
  }

  async function sendTelegram() {
    if (!kit) return;
    setRunning("send");
    setNotice({ type: "info", message: "확인한 원고를 텔레그램 채널로 발송 중입니다." });
    try {
      const response = await fetch("/api/admin/telegram", {
        method: "POST",
        headers: headers(password),
        body: JSON.stringify({ campaign: "editorial_pick", mode: "send" })
      });
      const data = (await response.json().catch(() => ({}))) as ApiResponse;
      if (!response.ok) {
        setNotice({ type: "error", message: data.message ?? data.error ?? "텔레그램 발송에 실패했습니다." });
        return;
      }
      setNotice({
        type: data.status === "sent" ? "success" : "error",
        message:
          data.status === "sent"
            ? "텔레그램 채널 발송이 완료되었습니다."
            : data.status === "API_NOT_CONFIGURED"
              ? "봇 설정 전에는 원고 복사로 수동 게시할 수 있습니다. TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID를 등록하면 채널 발송이 활성화됩니다."
              : data.status ?? "텔레그램 응답 상태를 확인하세요."
      });
    } catch {
      setNotice({ type: "error", message: "네트워크 문제로 텔레그램 발송을 완료하지 못했습니다." });
    } finally {
      setRunning(null);
    }
  }

  const channel = kit?.[activeChannel];

  return (
    <section id="admin-editorial-telegram" className="scroll-mt-6 rounded-lg border border-line bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-pine">
            <Megaphone size={18} aria-hidden />
            <p className="text-xs font-black">첫 매출 캠페인</p>
          </div>
          <h2 className="mt-1 text-lg font-black">채널별 첫 매출 배포 키트</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-steel">
            {approvalSampleProduct.name}의 검수 근거와 제휴 고지를 유지한 채 텔레그램과 등록된 네이버 블로그용 원고를 만듭니다. 각 링크의 UTM으로 상세 진입과 구매 클릭 출처를 구분합니다.
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
          className="focus-ring inline-flex items-center gap-2 rounded-lg bg-pine px-4 py-2 text-sm font-black text-white hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60"
          disabled={running !== null}
          onClick={loadKit}
          type="button"
        >
          <RefreshCw size={16} aria-hidden /> {running === "load" ? "생성 중" : kit ? "원고 새로고침" : "배포 원고 생성"}
        </button>
        <p className="text-xs font-bold text-steel">가격·재고를 고정하지 않고 현재 쿠팡 조건 확인으로 연결합니다.</p>
      </div>

      {notice ? (
        <p className={`mt-3 rounded-lg border px-3 py-2 text-sm font-bold ${noticeClassName(notice.type)}`} role="status" aria-live="polite">
          {notice.message}
        </p>
      ) : null}

      {kit && channel ? (
        <div className="mt-5 border-t border-line pt-4">
          <div className="inline-flex rounded-lg border border-line bg-mist p-1" role="tablist" aria-label="배포 채널">
            <button
              className={`focus-ring inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-black ${activeChannel === "telegram" ? "bg-white text-ink shadow-sm" : "text-steel"}`}
              onClick={() => setActiveChannel("telegram")}
              role="tab"
              aria-selected={activeChannel === "telegram"}
              type="button"
            >
              <MessageCircle size={16} aria-hidden /> 텔레그램
            </button>
            <button
              className={`focus-ring inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-black ${activeChannel === "naverBlog" ? "bg-white text-ink shadow-sm" : "text-steel"}`}
              onClick={() => setActiveChannel("naverBlog")}
              role="tab"
              aria-selected={activeChannel === "naverBlog"}
              type="button"
            >
              <FileText size={16} aria-hidden /> 네이버 블로그
            </button>
          </div>

          {activeChannel === "telegram" ? (
            <div className="mt-4" role="tabpanel">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-black">텔레그램 원고</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-black hover:bg-mist disabled:opacity-60"
                    disabled={running !== null}
                    onClick={() => copyText(kit.telegram.message, "텔레그램 원고")}
                    type="button"
                  >
                    <Copy size={15} aria-hidden /> 원고 복사
                  </button>
                  <button
                    className="focus-ring inline-flex items-center gap-2 rounded-lg bg-ink px-3 py-2 text-sm font-black text-white hover:bg-pine disabled:opacity-60"
                    disabled={running !== null}
                    onClick={sendTelegram}
                    type="button"
                  >
                    <Send size={15} aria-hidden /> {running === "send" ? "발송 중" : "확인 후 채널 발송"}
                  </button>
                </div>
              </div>
              <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap bg-ink p-4 text-sm leading-6 text-white">{kit.telegram.message}</pre>
            </div>
          ) : (
            <div className="mt-4" role="tabpanel">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
                <div className="min-w-0">
                  <p className="text-xs font-black text-steel">네이버 블로그 제목</p>
                  <p className="mt-1 break-words text-sm font-black">{kit.naverBlog.title}</p>
                </div>
                <button
                  className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-black hover:bg-mist disabled:opacity-60"
                  disabled={running !== null}
                  onClick={() => copyText(kit.naverBlog.title, "블로그 제목")}
                  type="button"
                >
                  <Copy size={15} aria-hidden /> 제목 복사
                </button>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-black">네이버 블로그 원고</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-black hover:bg-mist disabled:opacity-60"
                    disabled={running !== null}
                    onClick={() => copyText(kit.naverBlog.body, "블로그 본문")}
                    type="button"
                  >
                    <Copy size={15} aria-hidden /> 본문 복사
                  </button>
                  <a
                    className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-black hover:bg-mist"
                    href={kit.naverBlog.publisherUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    등록 채널 열기 <ExternalLink size={15} aria-hidden />
                  </a>
                </div>
              </div>
              <pre className="mt-3 max-h-[32rem] overflow-auto whitespace-pre-wrap bg-mist p-4 text-sm leading-6 text-ink">{kit.naverBlog.body}</pre>
            </div>
          )}

          <p className="mt-3 break-all text-xs font-semibold text-steel">추적 링크: {channel.trackedUrl}</p>
        </div>
      ) : (
        <p className="mt-5 border-y border-line py-5 text-sm font-bold text-steel">배포 전 원고와 제휴 고지를 먼저 생성해 확인하세요.</p>
      )}
    </section>
  );
}
