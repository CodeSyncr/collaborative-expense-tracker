import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    domains: ["firebasestorage.googleapis.com"],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
