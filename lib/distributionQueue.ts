export const DISTRIBUTION_CANDIDATE_PAGE_SIZE = 100;
export const DISTRIBUTION_CANDIDATE_MAX_ATTEMPTS = 8;

export type DistributionCandidateCursor = {
  score: number;
  createdAt: string;
  productId: string;
};

export type DistributionCandidatePageItem = {
  productId: string;
  cursor: DistributionCandidateCursor;
};

export type DistributionCandidatePage = {
  items: DistributionCandidatePageItem[];
};

export type DistributionCandidateScanResult<T> = {
  candidate: T | null;
  nextCursor: DistributionCandidateCursor | null;
  scannedCount: number;
  pageCount: number;
  exhausted: boolean;
};

function sameCursor(left: DistributionCandidateCursor | null, right: DistributionCandidateCursor | null) {
  if (!left || !right) return left === right;
  return left.score === right.score && left.createdAt === right.createdAt && left.productId === right.productId;
}

/**
 * Walks a stable score-ordered database keyset until it finds one product that
 * passes the authoritative application readiness gate. Every database response
 * is bounded, but there is no fixed row ceiling that could permanently starve a
 * valid candidate behind SQL-prefilter false positives.
 */
export async function findNextReadyDistributionCandidate<T>(input: {
  afterCursor?: DistributionCandidateCursor | null;
  pageSize?: number;
  loadPage: (limit: number, afterCursor: DistributionCandidateCursor | null) => Promise<DistributionCandidatePage>;
  loadCandidates: (productIds: readonly string[]) => Promise<readonly T[]>;
  getCandidateId: (candidate: T) => string;
  isReady: (candidate: T) => boolean;
}) {
  const normalizedPageSize = Number.isFinite(input.pageSize) ? Math.floor(input.pageSize!) : DISTRIBUTION_CANDIDATE_PAGE_SIZE;
  const pageSize = Math.max(1, Math.min(DISTRIBUTION_CANDIDATE_PAGE_SIZE, normalizedPageSize));
  let cursor = input.afterCursor ?? null;
  let scannedCount = 0;
  let pageCount = 0;

  while (true) {
    const pageStartCursor = cursor;
    const page = await input.loadPage(pageSize, pageStartCursor);
    pageCount += 1;
    if (!page.items.length) {
      return { candidate: null, nextCursor: cursor, scannedCount, pageCount, exhausted: true } satisfies DistributionCandidateScanResult<T>;
    }

    const loadedCandidates = await input.loadCandidates(page.items.map((item) => item.productId));
    const candidateById = new Map(loadedCandidates.map((candidate) => [input.getCandidateId(candidate), candidate]));
    for (const item of page.items) {
      scannedCount += 1;
      cursor = item.cursor;
      const candidate = candidateById.get(item.productId);
      if (candidate && input.isReady(candidate)) {
        return { candidate, nextCursor: cursor, scannedCount, pageCount, exhausted: false } satisfies DistributionCandidateScanResult<T>;
      }
    }

    if (page.items.length < pageSize) {
      return { candidate: null, nextCursor: cursor, scannedCount, pageCount, exhausted: true } satisfies DistributionCandidateScanResult<T>;
    }

    const lastCursor = page.items.at(-1)?.cursor ?? null;
    if (!lastCursor || sameCursor(lastCursor, pageStartCursor)) {
      throw new Error("DISTRIBUTION_CANDIDATE_CURSOR_STALLED");
    }
    cursor = lastCursor;
  }
}
