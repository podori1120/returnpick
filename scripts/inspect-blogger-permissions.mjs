import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  const lines = readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx > 0) {
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      process.env[key] = val;
    }
  }
}

async function inspectUserAndBlog() {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN,
      grant_type: "refresh_token"
    }).toString()
  });

  const tokens = await tokenRes.json();
  const accessToken = tokens.access_token;
  console.log("AccessToken:", accessToken ? "OK" : "FAILED", tokens);

  // 1. 유저 정보 조회
  const userRes = await fetch("https://www.googleapis.com/blogger/v3/users/self", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  console.log("User status:", userRes.status);
  const userData = await userRes.json();
  console.log("User data:", JSON.stringify(userData, null, 2));

  // 2. 블로그 목록 조회
  const blogsRes = await fetch("https://www.googleapis.com/blogger/v3/users/self/blogs", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  console.log("\nBlogs status:", blogsRes.status);
  const blogsData = await blogsRes.json();
  console.log("Blogs data:", JSON.stringify(blogsData, null, 2));
}

inspectUserAndBlog().catch(console.error);
