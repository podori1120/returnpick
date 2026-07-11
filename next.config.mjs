const sharedSecurityHeaders = [
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin"
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff"
  },
  {
    key: "X-Frame-Options",
    value: "DENY"
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()"
  }
];

const privateRouteHeaders = [
  {
    key: "X-Robots-Tag",
    value: "noindex, nofollow, noarchive"
  },
  {
    key: "Cache-Control",
    value: "no-store"
  }
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  async headers() {
    return [
      {
        source: "/:path*",
        headers: sharedSecurityHeaders
      },
      {
        source: "/admin",
        headers: privateRouteHeaders
      },
      {
        source: "/admin/:path*",
        headers: privateRouteHeaders
      },
      {
        source: "/api/:path*",
        headers: privateRouteHeaders
      }
    ];
  }
};

export default nextConfig;
