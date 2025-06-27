/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    serverComponentsExternalPackages: ["pg", "bull", "ioredis"],
  },
  // Railway-specific optimizations
  output: "standalone",
  poweredByHeader: false,
  compress: true,
  env: {
    // Railway automatically provides these
    DATABASE_URL: process.env.DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL,
    PORT: process.env.PORT || "3000",
    NODE_ENV: process.env.NODE_ENV || "production",
    // Disable database connections during build
    SKIP_DB_VALIDATION: "true",
  },
  webpack: (config, { isServer }) => {
    // Handle Monaco Editor on server-side
    if (isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        stream: false,
        util: false,
        buffer: false,
      };
    }

    // Ignore Monaco Editor's web workers on server-side
    config.module.rules.push({
      test: /\.worker\.js$/,
      use: { loader: "worker-loader" },
    });

    // Handle pg native bindings
    if (isServer) {
      config.externals.push("pg-native");
    }

    return config;
  },
};

export default nextConfig;
