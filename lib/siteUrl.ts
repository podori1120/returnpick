export function getSiteUrl() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (vercelHost) return `https://${vercelHost.replace(/\/$/, "")}`;
  return "https://returnpick.vercel.app";
}
