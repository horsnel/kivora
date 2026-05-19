/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  serverExternalPackages: ['groq-sdk', 'z-ai-web-dev-sdk', 'pptxgenjs', 'jszip', 'jspdf', 'docx'],
  eslint: {
    ignoreDuringBuilds: true
  },
  images: {
    unoptimized: true
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Don't bundle Node.js-only modules on the client
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
      // Externalize heavy export packages — they're loaded via dynamic import at runtime
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
  }
}

module.exports = nextConfig
