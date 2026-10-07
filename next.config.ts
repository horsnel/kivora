import type { NextConfig } from "next";
import { execSync } from "child_process";

// Build provenance: which commit is baked into this bundle?
// CF Pages GitHub builds set CF_PAGES_COMMIT_SHA; GH Actions sets GITHUB_SHA;
// local builds fall back to git rev-parse; all else → 'dev'.
function resolveBuildCommit(): string {
  try {
    return (
      process.env.CF_PAGES_COMMIT_SHA ||
      process.env.GITHUB_SHA ||
      execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] })
        .toString()
        .trim() ||
      "dev"
    );
  } catch {
    return "dev";
  }
}

const BUILD_COMMIT = resolveBuildCommit();

const nextConfig: NextConfig = {
  // ── Build provenance for /api/health ──────────────────────────────
  env: {
    NEXT_PUBLIC_BUILD_COMMIT: BUILD_COMMIT,
  },
  serverExternalPackages: ['groq-sdk', 'pptxgenjs', 'jszip', 'jspdf', 'docx', '@e2b/code-interpreter', 'e2b'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  images: {
    unoptimized: true, // Required for CF Pages
  },
  // View Transitions DISABLED — causes hydration mismatches and crashes
  // on Cloudflare Pages when combined with React 19 + SSR.
  experimental: {},
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
        https: false,
        http: false,
        crypto: false,
        stream: false,
        zlib: false,
      }
      config.externals = config.externals || []
      if (Array.isArray(config.externals)) {
        config.externals.push({
          pptxgenjs: 'commonjs pptxgenjs',
          jspdf: 'commonjs jspdf',
          docx: 'commonjs docx',
          jszip: 'commonjs jszip',
          '@e2b/code-interpreter': 'commonjs @e2b/code-interpreter',
          'e2b': 'commonjs e2b',
        })
      }
    }
    return config
  },
};

export default nextConfig;
