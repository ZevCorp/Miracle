import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fija la raíz del proyecto (hay un package-lock.json suelto en el home del
  // usuario que confunde la inferencia del workspace root).
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
