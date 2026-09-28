import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Club logos are up to 2 MB; leave headroom for multipart overhead and the other form fields.
    serverActions: { bodySizeLimit: "3mb" },
  },
};

export default nextConfig;
