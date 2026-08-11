import {
  claimDistributionDelivery,
  createTelegramLog,
  getProductById,
  restoreDistributionDraftAfterPrewriteFailure,
  updateDistributionDelivery
} from "@/lib/dataStore";
import { buildProductDistributionKit } from "@/lib/productDistributionKit";
import { isPrewriteFailureRetryable, planBloggerProviderWrite } from "@/lib/distributionDeliveryState";
import { isPublicDealReady } from "@/lib/publicDeal";

export type BloggerPostMode = "draft" | "publish";

type BloggerConfig = {
  blogId: string;
  blogUrl: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
};

type BloggerApiPost = {
  id?: unknown;
  url?: unknown;
};

type BloggerApiBlog = {
  id?: unknown;
  name?: unknown;
  url?: unknown;
};

type BloggerDeliveryStatus = "failed" | "ambiguous";

class BloggerProviderError extends Error {
  deliveryStatus: BloggerDeliveryStatus;

  constructor(message: string, deliveryStatus: BloggerDeliveryStatus) {
    super(message);
    this.name = "BloggerProviderError";
    this.deliveryStatus = deliveryStatus;
  }
}

const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const BLOGGER_API_TIMEOUT_MS = 12_000;

function envValue(name: string) {
  const value = process.env[name]?.trim();
  return value || null;
}

function validBlogUrl() {
  const raw = envValue("BLOGGER_BLOG_URL");
  if (!raw) return null;

  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password || !url.hostname) return null;
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function getBloggerConfig(): BloggerConfig | null {
  const blogId = envValue("BLOGGER_BLOG_ID");
  const blogUrl = validBlogUrl();
  const clientId = envValue("GOOGLE_OAUTH_CLIENT_ID");
  const clientSecret = envValue("GOOGLE_OAUTH_CLIENT_SECRET");
  const refreshToken = envValue("GOOGLE_OAUTH_REFRESH_TOKEN");

  if (!blogId || !blogUrl || !clientId || !clientSecret || !refreshToken) return null;
  return { blogId, blogUrl, clientId, clientSecret, refreshToken };
}

export function isBloggerConfigured() {
  return Boolean(getBloggerConfig());
}

export function isBloggerDistributionEnabled() {
  return process.env.BLOGGER_DISTRIBUTION_ENABLED === "true";
}

export function getBloggerPublishMode(): BloggerPostMode {
  return process.env.BLOGGER_PUBLISH_MODE === "publish" ? "publish" : "draft";
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = BLOGGER_API_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function refreshGoogleAccessToken(config: BloggerConfig) {
  let response: Response;
  try {
    response = await fetchWithTimeout(GOOGLE_OAUTH_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: config.refreshToken,
        grant_type: "refresh_token"
      }).toString()
    });
  } catch (error) {
    throw new BloggerProviderError(safeBloggerError(error), "failed");
  }

  if (!response.ok) throw new BloggerProviderError(`GOOGLE_OAUTH_HTTP_${response.status}`, "failed");

  const payload = (await response.json().catch(() => ({}))) as { access_token?: unknown };
  if (typeof payload.access_token !== "string" || !payload.access_token.trim()) {
    throw new BloggerProviderError("GOOGLE_OAUTH_TOKEN_INVALID", "failed");
  }
  return payload.access_token;
}

async function insertBloggerPost(config: BloggerConfig, accessToken: string, isDraft: boolean, kit: ReturnType<typeof buildProductDistributionKit>) {
  const endpoint = new URL(`https://www.googleapis.com/blogger/v3/blogs/${encodeURIComponent(config.blogId)}/posts`);
  endpoint.searchParams.set("isDraft", isDraft ? "true" : "false");

  let response: Response;
  try {
    response = await fetchWithTimeout(endpoint.toString(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        kind: "blogger#post",
        title: kit.blogger.title,
        content: kit.blogger.html
      })
    });
  } catch (error) {
    throw new BloggerProviderError(safeBloggerError(error), "ambiguous");
  }

  if (!response.ok) throw new BloggerProviderError(`BLOGGER_HTTP_${response.status}`, "ambiguous");
  const payload = (await response.json().catch(() => ({}))) as BloggerApiPost;
  if (typeof payload.id !== "string" || !payload.id.trim()) throw new BloggerProviderError("BLOGGER_RESPONSE_INVALID", "ambiguous");

  return {
    postId: payload.id,
    postUrl: typeof payload.url === "string" && payload.url.trim() ? payload.url : null
  };
}

async function publishBloggerDraft(config: BloggerConfig, accessToken: string, postId: string) {
  const endpoint = new URL(
    `https://www.googleapis.com/blogger/v3/blogs/${encodeURIComponent(config.blogId)}/posts/${encodeURIComponent(postId)}/publish`
  );

  let response: Response;
  try {
    response = await fetchWithTimeout(endpoint.toString(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json"
      }
    });
  } catch (error) {
    throw new BloggerProviderError(safeBloggerError(error), "ambiguous");
  }

  if (!response.ok) throw new BloggerProviderError(`BLOGGER_PUBLISH_HTTP_${response.status}`, "ambiguous");
  const payload = (await response.json().catch(() => ({}))) as BloggerApiPost;
  if (typeof payload.id !== "string" || payload.id !== postId) {
    throw new BloggerProviderError("BLOGGER_PUBLISH_RESPONSE_INVALID", "ambiguous");
  }

  return {
    postId: payload.id,
    postUrl: typeof payload.url === "string" && payload.url.trim() ? payload.url : null
  };
}

function safeBloggerError(error: unknown) {
  if (error instanceof Error && error.name === "AbortError") return `BLOGGER_REQUEST_TIMEOUT_${BLOGGER_API_TIMEOUT_MS}MS`;
  const message = error instanceof Error ? error.message : "";
  if (/^(BLOGGER|GOOGLE_OAUTH)_/.test(message)) return message.slice(0, 120);
  return "BLOGGER_PROVIDER_FAILED";
}

export async function probeBloggerConnection() {
  const config = getBloggerConfig();
  if (!config) return { status: "not_configured" as const, blog_url: null };

  let accessToken: string;
  try {
    accessToken = await refreshGoogleAccessToken(config);
  } catch (error) {
    return { status: "error" as const, blog_url: config.blogUrl, error: safeBloggerError(error) };
  }

  const endpoint = `https://www.googleapis.com/blogger/v3/blogs/${encodeURIComponent(config.blogId)}`;
  let response: Response;
  try {
    response = await fetchWithTimeout(endpoint, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" }
    });
  } catch (error) {
    return { status: "error" as const, blog_url: config.blogUrl, error: safeBloggerError(error) };
  }

  if (!response.ok) return { status: "error" as const, blog_url: config.blogUrl, error: `BLOGGER_HTTP_${response.status}` };

  const payload = (await response.json().catch(() => ({}))) as BloggerApiBlog;
  if (payload.id !== config.blogId) {
    return { status: "error" as const, blog_url: config.blogUrl, error: "BLOGGER_BLOG_ID_MISMATCH" };
  }

  return {
    status: "ok" as const,
    blog_id: config.blogId,
    blog_url: config.blogUrl,
    provider_url: typeof payload.url === "string" && payload.url.trim() ? payload.url : null,
    blog_name: typeof payload.name === "string" && payload.name.trim() ? payload.name.slice(0, 160) : null
  };
}

function safeDistributionLedgerError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/^DISTRIBUTION_LEDGER_/.test(message)) return message.slice(0, 120);
  return "DISTRIBUTION_LEDGER_UPDATE_FAILED";
}

function bloggerLogMessage(input: {
  productId: string;
  mode: BloggerPostMode;
  title: string;
  result: "success" | "error" | "not_configured";
  postId?: string | null;
  postUrl?: string | null;
}) {
  return JSON.stringify({
    channel: "blogger",
    product_id: input.productId,
    mode: input.mode,
    result: input.result,
    title: input.title.slice(0, 180),
    post_id: input.postId ?? null,
    post_url: input.postUrl ?? null
  });
}

async function recordBloggerLog(input: {
  productId: string;
  mode: BloggerPostMode;
  title: string;
  status: "API_NOT_CONFIGURED" | "error" | "draft" | "published";
  error: string | null;
  postId?: string | null;
  postUrl?: string | null;
}) {
  try {
    await createTelegramLog({
      product_id: input.productId,
      target_type: "blogger",
      target_key: input.productId,
      message: bloggerLogMessage({
        productId: input.productId,
        mode: input.mode,
        title: input.title,
        result: input.status === "error" ? "error" : input.status === "API_NOT_CONFIGURED" ? "not_configured" : "success",
        postId: input.postId,
        postUrl: input.postUrl
      }),
      status: input.status,
      error: input.error
    });
  } catch {
    throw new Error("BLOGGER_LOG_FAILED");
  }
}

export async function sendBloggerForProduct(productId: string, mode: BloggerPostMode) {
  if (mode !== "draft" && mode !== "publish") throw new Error("INVALID_BLOGGER_MODE");
  if (!isBloggerDistributionEnabled()) throw new Error("BLOGGER_DISTRIBUTION_DISABLED");

  const product = await getProductById(productId);
  if (!product) throw new Error("PRODUCT_NOT_FOUND");
  if (!isPublicDealReady(product)) throw new Error("PRODUCT_NOT_PUBLIC_READY");

  const kit = buildProductDistributionKit(product);
  const config = getBloggerConfig();
  if (!config) {
    await recordBloggerLog({
      productId: product.id,
      mode,
      title: kit.blogger.title,
      status: "API_NOT_CONFIGURED",
      error: "BLOGGER_API_NOT_CONFIGURED"
    });
    return {
      status: "API_NOT_CONFIGURED" as const,
      productId: product.id,
      title: kit.blogger.title
    };
  }

  const claim = await claimDistributionDelivery(product.id, "blogger", mode);
  if (!claim.claimed) {
    if (claim.reason === "pending") throw new Error("BLOGGER_DISTRIBUTION_PENDING");
    if (claim.reason === "ambiguous" || claim.reason === "draft_post_id_missing") throw new Error("BLOGGER_DISTRIBUTION_AMBIGUOUS");
    if (claim.reason === "already_distributed") throw new Error("BLOGGER_ALREADY_DISTRIBUTED");
    throw new Error("BLOGGER_DISTRIBUTION_FAILED");
  }

  let post: { postId: string; postUrl: string | null };
  try {
    const accessToken = await refreshGoogleAccessToken(config);
    const providerPlan = planBloggerProviderWrite(claim.operation, mode, claim.delivery.provider_post_id);
    if (providerPlan.action === "publish_existing_draft") {
      post = await publishBloggerDraft(config, accessToken, providerPlan.postId);
    } else {
      post = await insertBloggerPost(config, accessToken, providerPlan.isDraft, kit);
    }
  } catch (error) {
    const safeError = safeBloggerError(error);
    const definitePrewriteFailure = error instanceof BloggerProviderError && error.deliveryStatus === "failed";
    let transitionError: unknown = null;
    try {
      if (definitePrewriteFailure && !isPrewriteFailureRetryable(claim.operation)) {
        await restoreDistributionDraftAfterPrewriteFailure({
          id: claim.delivery.id,
          request_key: claim.delivery.request_key,
          last_error: safeError
        });
      } else {
        await updateDistributionDelivery({
          id: claim.delivery.id,
          request_key: claim.delivery.request_key,
          status: definitePrewriteFailure ? "failed" : "ambiguous",
          delivery_mode: mode,
          last_error: safeError
        });
      }
    } catch (error) {
      transitionError = error;
    }
    try {
      await recordBloggerLog({
        productId: product.id,
        mode,
        title: kit.blogger.title,
        status: "error",
        error: transitionError ? "DISTRIBUTION_LEDGER_UPDATE_FAILED" : safeError
      });
    } catch {
      if (transitionError) throw new Error("BLOGGER_DISTRIBUTION_AMBIGUOUS");
      throw new Error("BLOGGER_LOG_FAILED");
    }
    if (transitionError) throw new Error("BLOGGER_DISTRIBUTION_AMBIGUOUS");
    throw new Error(safeError);
  }

  const status = mode === "publish" ? ("published" as const) : ("draft" as const);
  try {
    await updateDistributionDelivery({
      id: claim.delivery.id,
      request_key: claim.delivery.request_key,
      status: "succeeded",
      delivery_mode: mode,
      provider_post_id: post.postId,
      provider_url: post.postUrl,
      last_error: null
    });
  } catch (error) {
    const ledgerError = safeDistributionLedgerError(error);
    try {
      await updateDistributionDelivery({
        id: claim.delivery.id,
        request_key: claim.delivery.request_key,
        status: "ambiguous",
        delivery_mode: mode,
        provider_post_id: post.postId,
        provider_url: post.postUrl,
        last_error: ledgerError
      });
    } catch {
      // The external post already exists; leave the claim conservative if the second write also fails.
    }
    try {
      await recordBloggerLog({
        productId: product.id,
        mode,
        title: kit.blogger.title,
        status: "error",
        error: "BLOGGER_DISTRIBUTION_AMBIGUOUS",
        postId: post.postId,
        postUrl: post.postUrl
      });
    } catch {
      // The delivery ledger is the source of truth; an audit-log failure must not trigger a retry.
    }
    throw new Error("BLOGGER_DISTRIBUTION_AMBIGUOUS");
  }
  await recordBloggerLog({
    productId: product.id,
    mode,
    title: kit.blogger.title,
    status,
    error: null,
    postId: post.postId,
    postUrl: post.postUrl
  });

  return {
    status,
    productId: product.id,
    title: kit.blogger.title,
    postId: post.postId,
    postUrl: post.postUrl,
    trackedUrl: kit.blogger.trackedUrl,
    operation: claim.operation
  };
}
