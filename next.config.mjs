const supabaseHost = (() => {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
    return url ? new URL(url).hostname : '';
  } catch {
    return '';
  }
})();

const remotePatterns = [
  { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },
  { protocol: 'https', hostname: '*.supabase.in', pathname: '/storage/v1/object/public/**' },
];

if (supabaseHost && !supabaseHost.endsWith('.supabase.co') && !supabaseHost.endsWith('.supabase.in')) {
  remotePatterns.push({ protocol: 'https', hostname: supabaseHost, pathname: '/storage/v1/object/public/**' });
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns,
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [320, 420, 640, 768, 1024, 1280, 1600],
    imageSizes: [64, 96, 128, 192, 256, 384],
    minimumCacheTTL: 60 * 60 * 24,
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store, max-age=0' }],
      },
    ];
  },
};

export default nextConfig;
