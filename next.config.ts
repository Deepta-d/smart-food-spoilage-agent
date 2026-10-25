import type { NextConfig } from "next";
import path from "path";

/** Pin Turbopack root so a parent-folder lockfile does not hijack the workspace. */
const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(process.cwd()),
  },
};

export default nextConfig;
