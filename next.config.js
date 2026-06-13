/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pas d'export statique — on utilise SSR pour Supabase auth
  reactStrictMode: true,
}

module.exports = nextConfig
