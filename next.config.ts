import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: "standalone", // NOT compatible with Cloudflare Pages
  serverExternalPackages: ['groq-sdk', 'pptxgenjs', 'jszip', 'jspdf', 'docx'],
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
        })
      }
    }
    return config
  },
};

export default nextConfig;
