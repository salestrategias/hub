/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "drive.google.com" },
    ],
  },
  experimental: { serverActions: { bodySizeLimit: "10mb" } },

  // Pragmatic: type-check ainda roda no `next lint` e no editor, mas não bloqueia o build de produção.
  // Permite subir o sistema mesmo com nuances de tipos null vs undefined em rotas.
  // TODO: revisar e remover quando tipos estiverem 100% estritos.
  // Hub 2.0: checagem LIGADA — 68 erros zerados em 10/08/2026.
  // Import esquecido / tipo errado agora TRAVA o build (2 incidentes em prod).
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
