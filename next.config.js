/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  serverExternalPackages: ['groq-sdk'],
  images: {
    unoptimized: true
  },
  turbopack: {
    root: '/tmp/my-project'
  }
}

module.exports = nextConfig
