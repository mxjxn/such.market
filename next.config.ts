import type { NextConfig } from "next";
import { config } from 'dotenv';

// Load .env file in development
if (process.env.NODE_ENV !== 'production') {
  config();
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'arweave.net',
      },
      {
        protocol: 'https',
        hostname: 'ipfs.io',
      },
      {
        protocol: 'https',
        hostname: 'ipfs.infura.io',
      },
      {
        protocol: 'https',
        hostname: 'gateway.pinata.cloud',
      },
      {
        protocol: 'https',
        hostname: 'cloudflare-ipfs.com',
      },
      {
        protocol: 'https',
        hostname: '**.alchemy.com',
      },
      {
        protocol: 'https',
        hostname: '**.nftstorage.link',
      },
    ],
  },
};

export default nextConfig;
