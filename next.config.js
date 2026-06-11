/** @type {import('next').NextConfig} */
const nextConfig = {
  // output: 'standalone', // NOT compatible with CloudFlare Pages — disabled for CF deployment
  serverExternalPackages: ['groq-sdk', 'pptxgenjs', 'jszip', 'jspdf', 'docx', '@e2b/code-interpreter', 'e2b'],
  eslint: {
    ignoreDuringBuilds: true
  },
  images: {
    unoptimized: true
  },
  experimental: {
    viewTransition: true,
  },
  turbopack: {
    root: '/home/z/my-project',
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
          '@e2b/code-interpreter': 'commonjs @e2b/code-interpreter',
          'e2b': 'commonjs e2b',
        })
      }
    }
    return config
  }
}

module.exports = nextConfig
