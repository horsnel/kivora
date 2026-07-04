import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
