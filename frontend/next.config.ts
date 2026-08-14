import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hosts allowed to load the dev server's assets cross-origin. The dev server binds 0.0.0.0
  // (see the `dev` script), so it is reachable over Tailscale, but Next still refuses requests
  // whose Origin is not listed here.
  //
  // Add both the MagicDNS name and the raw tailnet IP: a phone using MagicDNS sends the hostname,
  // while anything resolving by IP sends the address.
  allowedDevOrigins: [
    "mac-003",
    "spiross-laptop.taila0d570.ts.net",
    "100.103.8.27",
  ],
};

export default nextConfig;
