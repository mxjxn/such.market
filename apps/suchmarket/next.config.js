/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@mxjxn/lssvm-abis'],
  typescript: {
    // Trading components copied from miniapp; tighten types incrementally
    ignoreBuildErrors: true,
  },
  async redirects() {
    return [
      {
        source: '/buy/:chainId/:poolAddress',
        destination: '/pool/:chainId/:poolAddress',
        permanent: false,
      },
      {
        source: '/sell/:chainId/:poolAddress',
        destination: '/pool/:chainId/:poolAddress',
        permanent: false,
      },
    ]
  },
  env: {
    NEXT_PUBLIC_ROUTER_ADDRESS_8453: process.env.NEXT_PUBLIC_ROUTER_ADDRESS_8453 || '',
    NEXT_PUBLIC_FACTORY_ADDRESS_8453: process.env.NEXT_PUBLIC_FACTORY_ADDRESS_8453 || '',
    NEXT_PUBLIC_BASE_RPC_URL: process.env.NEXT_PUBLIC_BASE_RPC_URL || '',
  },
}

module.exports = nextConfig

