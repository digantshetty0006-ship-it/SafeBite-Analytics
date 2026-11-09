import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The demo uses a pre-seeded SQLite file. Include it in every serverless
  // function bundle so the read-only analytics pages work on Vercel.
  outputFileTracingIncludes: {
    "/*": ["./dev.db"],
  },
};

export default nextConfig;
