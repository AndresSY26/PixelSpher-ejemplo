
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    // remotePatterns are not strictly needed for local images served from /public
    // If you still need picsum for fallbacks or other parts, you can keep it.
    // For this change, focusing on local uploads, it can be commented out or removed if not used elsewhere.
    // remotePatterns: [
    //   {
    //     protocol: 'https',
    //     hostname: 'picsum.photos',
    //     port: '',
    //     pathname: '/**',
    //   },
    // ],
  },
};

export default nextConfig;
