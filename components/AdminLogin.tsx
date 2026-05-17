"use client";

import { useEffect, useState } from "react";
import { LockKeyhole } from "lucide-react";

export default function AdminLogin({ onLogin }: { onLogin: (password: string) => void }) {
  const [password, setPassword] = useState("");

  useEffect(() => {
    const saved = window.localStorage.getItem("returnpick_admin_password");
    if (saved !== null) {
      setPassword(saved);
      onLogin(saved);
    }
  }, [onLogin]);

  return (
    <form
      className="mx-auto mt-12 max-w-md rounded-lg border border-line bg-white p-6 shadow-soft"
      onSubmit={(event) => {
        event.preventDefault();
        window.localStorage.setItem("returnpick_admin_password", password);
        onLogin(password);
      }}
    >
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink text-white">
          <LockKeyhole size={18} aria-hidden />
        </span>
        <div>
          <h1 className="text-xl font-black">리턴픽 관리자</h1>
          <p className="text-sm font-semibold text-steel">ADMIN_PASSWORD 기반 접근</p>
        </div>
      </div>
      <label className="block text-sm font-bold text-steel" htmlFor="admin-password">
        비밀번호
      </label>
      <input
        id="admin-password"
        className="focus-ring mt-2 w-full rounded-lg border border-line px-3 py-3"
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="로컬 mock 모드는 비워도 됩니다"
      />
      <button className="focus-ring mt-4 w-full rounded-lg bg-pine px-4 py-3 text-sm font-black text-white hover:bg-ink">
        로그인
      </button>
    </form>
  );
}
