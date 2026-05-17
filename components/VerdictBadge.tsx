import clsx from "clsx";
import type { Verdict } from "@/lib/types";

export default function VerdictBadge({ verdict }: { verdict?: Verdict | string | null }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-md px-2.5 py-1 text-xs font-black",
        verdict === "강력추천" && "bg-pine text-white",
        verdict === "추천" && "bg-lemon text-ink",
        verdict === "조건부 추천" && "bg-coral text-white",
        verdict === "보류" && "bg-steel text-white",
        verdict === "비추" && "bg-ink text-white",
        !verdict && "bg-line text-steel"
      )}
    >
      {verdict ?? "판정대기"}
    </span>
  );
}
