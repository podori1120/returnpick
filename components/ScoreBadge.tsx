import clsx from "clsx";

export default function ScoreBadge({ score }: { score?: number | null }) {
  const value = score ?? 0;
  return (
    <span
      className={clsx(
        "inline-flex h-11 min-w-11 items-center justify-center rounded-lg px-3 text-sm font-black",
        value >= 85 && "bg-pine text-white",
        value >= 75 && value < 85 && "bg-lemon text-ink",
        value >= 65 && value < 75 && "bg-coral text-white",
        value < 65 && "bg-steel text-white"
      )}
    >
      {score ?? "-"}점
    </span>
  );
}
