/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  serverExternalPackages: ['groq-sdk'],
  images: {
    unoptimized: true
  }
}

module.exports = nextConfig
