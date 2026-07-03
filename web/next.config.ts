import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fija la raíz del proyecto (hay un package-lock.json suelto en el home del
  // usuario que confunde la inferencia del workspace root).
  turbopack: {
    root: __dirname,
  },
  images: {
    // Un sitio de marketing no necesita variantes de 2048/3840 px; capar aquí
    // evita que next/image reescale las fotos a tamaños enormes (más rápido de
    // optimizar y suficiente para retina).
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
  },
};

export default nextConfig;
