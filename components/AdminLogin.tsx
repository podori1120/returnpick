"use client";

import { useState } from "react";
import { LockKeyhole } from "lucide-react";

type LoginResponse = { authenticated?: boolean; error?: string };

function loginErrorMessage(error: string | undefined) {
  if (error === "UNAUTHORIZED") return "비밀번호가 일치하지 않습니다.";
  if (error === "ADMIN_PASSWORD_NOT_CONFIGURED") return "Vercel에 ADMIN_PASSWORD를 먼저 등록해 주세요.";
  if (error === "ADMIN_PASSWORD_WEAK_CONFIGURATION") return "ADMIN_PASSWORD를 12자 이상의 안전한 값으로 변경해 주세요.";
  if (error === "ADMIN_SESSION_ORIGIN_MISMATCH") return "현재 사이트 주소에서 다시 로그인해 주세요.";
  return "로그인을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

export default function AdminLogin({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      className="mx-auto mt-12 max-w-md rounded-lg border border-line bg-white p-6 shadow-soft"
      onSubmit={async (event) => {
        event.preventDefault();
        setSubmitting(true);
        setError("");
        try {
          const response = await fetch("/api/admin/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password })
          });
          const data = (await response.json().catch(() => ({}))) as LoginResponse;
          if (!response.ok || !data.authenticated) {
            setError(loginErrorMessage(data.error));
            return;
          }
          setPassword("");
          onLogin();
        } catch {
          setError("네트워크 문제로 로그인하지 못했습니다.");
        } finally {
          setSubmitting(false);
        }
      }}
    >
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink text-white">
          <LockKeyhole size={18} aria-hidden />
        </span>
        <div>
          <h1 className="text-xl font-black">리턴픽 관리자</h1>
          <p className="text-sm font-semibold text-steel">보안 세션 로그인</p>
        </div>
      </div>
      <label className="block text-sm font-bold text-steel" htmlFor="admin-password">
        비밀번호
      </label>
      <input
        id="admin-password"
        className="focus-ring mt-2 w-full rounded-lg border border-line px-3 py-3"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="로컬 mock 모드는 비워도 됩니다"
      />
      {error ? <p className="mt-3 rounded-lg border border-coral/30 bg-coral/10 px-3 py-2 text-sm font-bold text-coral" role="alert">{error}</p> : null}
      <button
        className="focus-ring mt-4 w-full rounded-lg bg-pine px-4 py-3 text-sm font-black text-white hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60"
        disabled={submitting}
      >
        {submitting ? "확인 중" : "로그인"}
      </button>
    </form>
  );
}
