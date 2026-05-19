/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  serverExternalPackages: ['groq-sdk'],
  eslint: {
    ignoreDuringBuilds: true
  },
  images: {
    unoptimized: true
  }
}

module.exports = nextConfig
