import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // xlsx is a CJS module that doesn't always bundle cleanly in Next.js.
  // Keeping it external lets Node.js require() it at runtime so XLSX.utils
  // resolves correctly (fixes "Cannot read properties of undefined (reading 'utils')").
  serverExternalPackages: ["xlsx"],
};

export default nextConfig;
