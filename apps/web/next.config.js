/** @type {import('next').NextConfig} */
const nextConfig = {
  // Emits .next/standalone: a minimal server + only the node_modules it needs, for the Docker image.
  output: "standalone",
};

export default nextConfig;
