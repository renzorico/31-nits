import { defineConfig, type Plugin } from "vite";

// Social previews (LinkedIn, Open Graph) need absolute URLs, while the page
// itself uses relative paths. SITE_URL overrides the production address, for
// example with a custom domain.
const DEFAULT_SITE_URL = "https://31-nits.vercel.app/";
const SITE_URL_PLACEHOLDER = /__SITE_URL__/g;

function siteUrl(): string {
  const url = process.env.SITE_URL?.trim() || DEFAULT_SITE_URL;
  return url.endsWith("/") ? url : `${url}/`;
}

function absoluteSiteUrl(): Plugin {
  return {
    name: "absolute-site-url",
    transformIndexHtml: (html) => html.replace(SITE_URL_PLACEHOLDER, siteUrl()),
  };
}

// Relative base so the build works under any address or subpath.
export default defineConfig({
  base: "./",
  plugins: [absoluteSiteUrl()],
  build: { outDir: "dist", sourcemap: false },
});
