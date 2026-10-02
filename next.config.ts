import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Nunca usar typescript.ignoreBuildErrors ni eslint.ignoreDuringBuilds aquí.
  reactStrictMode: true,
  // Los e2e compilan en su propia carpeta para no pisar el `.next` de `next dev`.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'same-origin' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
    ];
  },
};

export default nextConfig;
