// @ts-check
import mdx from "@astrojs/mdx"
import react from "@astrojs/react"
import starlight from "@astrojs/starlight"
import { defineConfig } from "astro/config"
import starlightLlmsTxt from "starlight-llms-txt"
import { reactSlotsPlugin } from "./react-slots-plugin.mjs"

// Served from GitHub Pages on a custom subdomain (see documentation/public/CNAME + DEPLOY.md).
const site = "https://react-slots.grlt-hub.dev"

export default defineConfig({
  site,
  // expose the built library (JS + .d.ts) to the live sandbox as virtual modules
  vite: {
    plugins: [reactSlotsPlugin()],
  },
  integrations: [
    // the sandbox island is React (Sandpack + Monaco)
    react(),
    // Single-page docs: everything lives on the splash landing (src/content/docs/index.mdx).
    starlight({
      title: "React Slots",
      description:
        "Declarative slot system for React. Build extensible, plugin-ready components with dynamic injection.",
      // Single-page docs — no search needed; this removes the header search box.
      pagefind: false,
      // Generate /llms.txt + /llms-full.txt from the single landing page so LLMs
      // can ingest the docs as plain Markdown.
      plugins: [
        starlightLlmsTxt({
          projectName: "@grlt-hub/react-slots",
          description:
            "Declarative slot system for React. Build extensible, plugin-ready components with dynamic injection.",
          // The landing page hosts a client-only React island (the live <Sandbox>). The plugin's
          // render container only knows the MDX renderer, so rendering that island throws — use the
          // raw MDX body instead (the plugin's documented escape hatch for framework components).
          rawContent: true,
        }),
      ],
      customCss: ["./src/styles/hero.css", "./src/styles/sandbox.css"],
      components: {
        // brand icon + two-tone "@grlt-hub/react-slots" instead of the plain title
        SiteTitle: "./src/components/SiteTitle.astro",
        // custom splash hero that carries the package-manager install widget
        Hero: "./src/components/Hero.astro",
      },
      // TODO: drop the brand logo into src/assets/logo.webp and enable:
      // logo: { src: "./src/assets/logo.webp", alt: "React Slots", replacesTitle: false },
      social: [{ icon: "github", label: "GitHub", href: "https://github.com/grlt-hub/react-slots" }],
    }),
    mdx(),
  ],
})
