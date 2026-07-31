"use client";

import { useCallback, useEffect, useState } from "react";
import AdminApiReadinessPanel from "@/components/AdminApiReadinessPanel";
import AdminAffiliateLinkQueue from "@/components/AdminAffiliateLinkQueue";
import AdminCandidateTable from "@/components/AdminCandidateTable";
import AdminEditorialTelegramCampaign from "@/components/AdminEditorialTelegramCampaign";
import AdminKeywordManager from "@/components/AdminKeywordManager";
import AdminLaunchRunner from "@/components/AdminLaunchRunner";
import AdminLaunchStatusBar from "@/components/AdminLaunchStatusBar";
import AdminLogin from "@/components/AdminLogin";
import AdminOpsDashboard from "@/components/AdminOpsDashboard";
import AdminPriceBackfillPanel from "@/components/AdminPriceBackfillPanel";
import AdminSchedulerPanel from "@/components/AdminSchedulerPanel";
import AdminSourcingRunner from "@/components/AdminSourcingRunner";
import { scrollToAdminAnchor } from "@/lib/adminNavigation";

export default function AdminPage() {
  const [password, setPassword] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const handleLogin = useCallback((nextPassword: string) => setPassword(nextPassword), []);

  useEffect(() => {
    if (password === null) return;
    let hashScrollTimer: number | undefined;

    function scrollToHashTarget() {
      const anchor = window.location.hash.replace(/^#/, "");
      if (!anchor) return;

      window.clearTimeout(hashScrollTimer);
      hashScrollTimer = window.setTimeout(() => {
        try {
          scrollToAdminAnchor(decodeURIComponent(anchor));
        } catch {
          scrollToAdminAnchor(anchor);
        }
      }, 80);
    }

    scrollToHashTarget();
    window.addEventListener("hashchange", scrollToHashTarget);
    return () => {
      window.clearTimeout(hashScrollTimer);
      window.removeEventListener("hashchange", scrollToHashTarget);
    };
  }, [password]);

  if (password === null) return <AdminLogin onLogin={handleLogin} />;

  return (
    <main className="mx-auto max-w-7xl space-y-5 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-black text-pine">ReturnPick Admin</p>
          <h1 className="text-3xl font-black tracking-tight">수익형 소싱/검수</h1>
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

      <AdminLaunchStatusBar password={password} />
      <AdminApiReadinessPanel password={password} />
      <AdminLaunchRunner password={password} onCompleted={() => setRefreshToken((value) => value + 1)} />
      <AdminOpsDashboard password={password} refreshToken={refreshToken} />
      <AdminEditorialTelegramCampaign password={password} />
      <AdminSchedulerPanel password={password} refreshToken={refreshToken} onCompleted={() => setRefreshToken((value) => value + 1)} />
      <AdminPriceBackfillPanel password={password} onCompleted={() => setRefreshToken((value) => value + 1)} />
      <AdminAffiliateLinkQueue password={password} refreshToken={refreshToken} onCompleted={() => setRefreshToken((value) => value + 1)} />
      <AdminKeywordManager password={password} />
      <AdminSourcingRunner password={password} onCompleted={() => setRefreshToken((value) => value + 1)} />
      <AdminCandidateTable password={password} refreshToken={refreshToken} />
    </main>
  );
}
