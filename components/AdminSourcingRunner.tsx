"use client";

import { useEffect, useState } from "react";
import { Play, RefreshCw } from "lucide-react";
import { formatDate } from "@/lib/format";
import type { SourcingRun } from "@/lib/types";

function headers(password: string) {
  return { "Content-Type": "application/json", "x-admin-password": password };
}

export default function AdminSourcingRunner({ password, onCompleted }: { password: string; onCompleted: () => void }) {
  const [runs, setRuns] = useState<SourcingRun[]>([]);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");

  async function loadRuns() {
    const response = await fetch("/api/admin/sourcing/run", { headers: headers(password) });
    const data = await response.json();
    setRuns(data.runs ?? []);
  }

  useEffect(() => {
    void loadRuns();
  }, [password]);

  async function runSourcing() {
    setRunning(true);
    setMessage("후보 수집 중입니다");
    const response = await fetch("/api/admin/sourcing/run", {
      method: "POST",
      headers: headers(password),
      body: JSON.stringify({ useMockFallback: true })
    });
    const data = await response.json();
    const run = data.run as SourcingRun | undefined;
    setMessage(run ? `${run.found_count}개 발견, ${run.inserted_count}개 추가, ${run.updated_count}개 갱신` : "실행 결과를 확인하지 못했습니다");
    setRunning(false);
    await loadRuns();
    onCompleted();
  }

  return (
    <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black">자동 후보 수집</h2>
          {message ? <p className="mt-1 text-sm font-semibold text-steel">{message}</p> : null}
        </div>
        <div className="flex gap-2">
          <button className="focus-ring rounded-lg border border-line p-2 hover:bg-mist" onClick={loadRuns} type="button" title="새로고침">
            <RefreshCw size={18} aria-hidden />
          </button>
          <button
            className="focus-ring inline-flex items-center gap-2 rounded-lg bg-pine px-4 py-2 text-sm font-black text-white hover:bg-ink disabled:opacity-60"
            onClick={runSourcing}
            disabled={running}
            type="button"
          >
            <Play size={16} aria-hidden /> 후보 수집 실행
          </button>
        </div>
      </div>

      <div className="mt-4 overflow-auto rounded-lg border border-line">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-mist text-xs font-black text-steel">
            <tr>
              <th className="px-3 py-2">시작</th>
              <th className="px-3 py-2">상태</th>
              <th className="px-3 py-2">키워드</th>
              <th className="px-3 py-2">발견</th>
              <th className="px-3 py-2">추가</th>
              <th className="px-3 py-2">갱신</th>
              <th className="px-3 py-2">오류</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id} className="border-t border-line">
                <td className="px-3 py-2">{formatDate(run.started_at)}</td>
                <td className="px-3 py-2 font-bold">{run.status}</td>
                <td className="px-3 py-2">{run.keyword_count}</td>
                <td className="px-3 py-2">{run.found_count}</td>
                <td className="px-3 py-2">{run.inserted_count}</td>
                <td className="px-3 py-2">{run.updated_count}</td>
                <td className="px-3 py-2">{run.error_count}</td>
              </tr>
            ))}
            {!runs.length ? (
              <tr>
                <td className="px-3 py-5 text-center font-bold text-steel" colSpan={7}>
                  실행 기록이 없습니다
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
