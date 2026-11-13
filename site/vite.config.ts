import { defineConfig, type Plugin } from "vite";

// Social previews (LinkedIn, Open Graph) need absolute URLs, while the page
// itself uses relative paths. CI passes the real Pages URL in SITE_URL;
// locally the expected project URL is used.
const DEFAULT_SITE_URL = "https://renzorico.github.io/31-nits/";
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

// Relative base so the build works on a GitHub Pages project URL
// (https://<user>.github.io/<repo>/) without knowing the repo name.
export default defineConfig({
  base: "./",
  plugins: [absoluteSiteUrl()],
  build: { outDir: "dist", sourcemap: false },
});
