import { networkInterfaces } from 'node:os'

const devOrigins = Object.values(networkInterfaces()).flatMap(entries =>
  (entries ?? []).filter(entry => entry.family === 'IPv4' && !entry.internal).map(entry => entry.address),
)

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: devOrigins,
  experimental: {
    agentUpgrade: "security",
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
