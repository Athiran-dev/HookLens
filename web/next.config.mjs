/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export: the Go server serves web/out, so one deployable serves API + dashboard.
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};
export default nextConfig;
