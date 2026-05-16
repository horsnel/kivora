const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  serverExternalPackages: ['groq-sdk'],
  images: {
    unoptimized: true
  }
}

module.exports = withBundleAnalyzer(nextConfig)
