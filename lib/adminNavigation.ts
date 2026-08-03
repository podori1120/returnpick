const ADMIN_ANCHOR_HIGHLIGHT_CLASS = "admin-anchor-highlight";
const ADMIN_ANCHOR_HIGHLIGHT_MS = 1800;

export const ADMIN_CANDIDATE_QUEUE_EVENT = "returnpick_admin_candidate_queue";

export type AdminCandidateQueue = "review" | "publish_ready" | "affiliate_backfill" | "public_repair";
export type AdminCandidateQueueEventDetail = {
  queue: AdminCandidateQueue;
  productIds?: string[];
};

export function scrollToAdminAnchor(anchor: string) {
  if (!anchor || typeof document === "undefined") return;

  const target = document.getElementById(anchor);
  if (!target) return;

  target.scrollIntoView({ behavior: "smooth", block: "start" });

  if (typeof window !== "undefined") {
    window.history.replaceState(null, "", `#${anchor}`);
    highlightAdminAnchor(target);
  }
}

export function openAdminCandidateQueue(queue: AdminCandidateQueue, productIds: string[] = []) {
  scrollToAdminAnchor("admin-candidate-review");

  if (typeof window === "undefined") return;

  window.setTimeout(() => {
    window.dispatchEvent(
      new CustomEvent<AdminCandidateQueueEventDetail>(ADMIN_CANDIDATE_QUEUE_EVENT, {
        detail: { queue, productIds: Array.from(new Set(productIds.filter(Boolean))) }
      })
    );
  }, 80);
}

export function openAdminAffiliateLinkQueue() {
  scrollToAdminAnchor("admin-affiliate-links");
}

function highlightAdminAnchor(target: HTMLElement) {
  const root = target.ownerDocument;
  root.querySelectorAll(`.${ADMIN_ANCHOR_HIGHLIGHT_CLASS}`).forEach((element) => {
    element.classList.remove(ADMIN_ANCHOR_HIGHLIGHT_CLASS);
  });

  target.classList.remove(ADMIN_ANCHOR_HIGHLIGHT_CLASS);
  void target.offsetWidth;
  target.classList.add(ADMIN_ANCHOR_HIGHLIGHT_CLASS);

  window.setTimeout(() => {
    target.classList.remove(ADMIN_ANCHOR_HIGHLIGHT_CLASS);
  }, ADMIN_ANCHOR_HIGHLIGHT_MS);
}
