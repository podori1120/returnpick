"use client";

import { useCallback, useState } from "react";
import AdminCandidateTable from "@/components/AdminCandidateTable";
import AdminKeywordManager from "@/components/AdminKeywordManager";
import AdminLogin from "@/components/AdminLogin";
import AdminOpsDashboard from "@/components/AdminOpsDashboard";
import AdminSourcingRunner from "@/components/AdminSourcingRunner";

export default function AdminPage() {
  const [password, setPassword] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const handleLogin = useCallback((nextPassword: string) => setPassword(nextPassword), []);

  if (password === null) return <AdminLogin onLogin={handleLogin} />;

  return (
    <main className="mx-auto max-w-7xl space-y-5 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-black text-pine">ReturnPick Admin</p>
          <h1 className="text-3xl font-black tracking-tight">후보 수집과 검수</h1>
        </div>
        <button
          className="focus-ring rounded-lg border border-line bg-white px-4 py-2 text-sm font-black hover:bg-mist"
          onClick={() => {
            window.localStorage.removeItem("returnpick_admin_password");
            setPassword(null);
          }}
          type="button"
        >
          로그아웃
        </button>
      </div>

      <AdminOpsDashboard password={password} refreshToken={refreshToken} />
      <AdminKeywordManager password={password} />
      <AdminSourcingRunner password={password} onCompleted={() => setRefreshToken((value) => value + 1)} />
      <AdminCandidateTable password={password} refreshToken={refreshToken} />
    </main>
  );
}
