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
        hostname: '**',
      },
    ],
  },
};

export default nextConfig;
