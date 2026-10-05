import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev server only: let phones/tablets on the local network load the dev JavaScript when the app
  // is opened via the Mac's LAN address (e.g. http://192.168.0.5:3000) or its .local name.
  // Without this, Next blocks those dev assets, the page never hydrates, and client-only controls
  // (e.g. the Add student modal button) do nothing. Production builds ignore this setting.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "*.local"],
  experimental: {
    // Club logos are up to 2 MB; leave headroom for multipart overhead and the other form fields.
    serverActions: { bodySizeLimit: "3mb" },
  },
};

export default nextConfig;
