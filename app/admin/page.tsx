"use client";

import { useCallback, useEffect, useState } from "react";
import AdminApiReadinessPanel from "@/components/AdminApiReadinessPanel";
import AdminAffiliateLinkQueue from "@/components/AdminAffiliateLinkQueue";
import AdminBootstrapCatalogPanel from "@/components/AdminBootstrapCatalogPanel";
import AdminCandidateTable from "@/components/AdminCandidateTable";
import AdminEditorialTelegramCampaign from "@/components/AdminEditorialTelegramCampaign";
import AdminKeywordManager from "@/components/AdminKeywordManager";
import AdminLaunchRunner from "@/components/AdminLaunchRunner";
import AdminLaunchStatusBar from "@/components/AdminLaunchStatusBar";
import AdminManualProductForm from "@/components/AdminManualProductForm";
import AdminManualProductBulkForm from "@/components/AdminManualProductBulkForm";
import AdminLogin from "@/components/AdminLogin";
import AdminOpsDashboard from "@/components/AdminOpsDashboard";
import AdminPriceBackfillPanel from "@/components/AdminPriceBackfillPanel";
import AdminSchedulerPanel from "@/components/AdminSchedulerPanel";
import AdminSourcingRunner from "@/components/AdminSourcingRunner";
import { scrollToAdminAnchor } from "@/lib/adminNavigation";

export default function AdminPage() {
  const [authState, setAuthState] = useState<"checking" | "anonymous" | "authenticated">("checking");
  const [refreshToken, setRefreshToken] = useState(0);
  const handleLogin = useCallback(() => setAuthState("authenticated"), []);

  useEffect(() => {
    try {
      window.localStorage.removeItem("returnpick_admin_password");
    } catch {
      // Some privacy-focused browsers disable storage; session-cookie auth must still continue.
    }
    let cancelled = false;
    fetch("/api/admin/session", { cache: "no-store" })
      .then((response) => {
        if (!cancelled) setAuthState(response.ok ? "authenticated" : "anonymous");
      })
      .catch(() => {
        if (!cancelled) setAuthState("anonymous");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (authState !== "authenticated") return;
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
  }, [authState]);

  if (authState === "checking") {
    return <p className="mx-auto mt-16 max-w-md rounded-lg border border-line bg-white p-6 text-center text-sm font-bold text-steel shadow-soft">관리자 세션 확인 중</p>;
  }
  if (authState === "anonymous") return <AdminLogin onLogin={handleLogin} />;

  const password = "";

  return (
    <main className="mx-auto max-w-7xl space-y-5 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-black text-pine">ReturnPick Admin</p>
          <h1 className="text-3xl font-black tracking-tight">수익형 소싱/검수</h1>
        </div>
        <button
          className="focus-ring rounded-lg border border-line bg-white px-4 py-2 text-sm font-black hover:bg-mist"
          onClick={async () => {
            try {
              await fetch("/api/admin/session", { method: "DELETE" });
            } finally {
              setAuthState("anonymous");
            }
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
      <AdminManualProductForm password={password} onCreated={() => setRefreshToken((value) => value + 1)} />
      <AdminManualProductBulkForm password={password} onCreated={() => setRefreshToken((value) => value + 1)} />
      <AdminBootstrapCatalogPanel />
      <AdminKeywordManager password={password} />
      <AdminSourcingRunner password={password} onCompleted={() => setRefreshToken((value) => value + 1)} />
      <AdminCandidateTable password={password} refreshToken={refreshToken} />
    </main>
  );
}
