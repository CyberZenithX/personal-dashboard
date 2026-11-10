/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ['@electric-sql/pglite'],
  experimental: {
    // Pages are client components that read the shared store, so a visited or prefetched page can be reused
    // when you switch back to it: switching pages no longer waits on the server.
    staleTimes: { dynamic: 300, static: 300 }
  }
};
export default nextConfig;
