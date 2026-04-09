import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: [
    '@nativelayer/schemas',
    '@nativelayer/security',
    '@nativelayer/observability',
  ],
  experimental: {
    serverActions: {
      allowedOrigins: [process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000'],
    },
  },
};

export default nextConfig;
