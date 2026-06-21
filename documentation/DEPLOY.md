# Deploying the docs

The documentation site is built with Astro Starlight and published to **GitHub Pages** on the
custom subdomain:

> **https://react-slots.grlt-hub.dev**

Deployment is automatic: every push to `main` runs `.github/workflows/ci.yml`, which builds the
docs and deploys them to Pages. The pieces below cover what the workflow does and the **one-time**
manual setup (DNS + repo settings) that isn't captured in code.

## How it works

`ci.yml` has three jobs:

1. **`build-and-test`** — runs on every push/PR (build, lint, test).
2. **`build-docs`** — only on pushes to `main`. Builds the library first
   (`pnpm build`), then the docs (`pnpm --filter ./documentation build`), and uploads
   `documentation/dist` as a Pages artifact.
   - The library must be built before the docs because the live sandbox injects the built bundle
     from `packages/react-slots/dist/` (see `documentation/react-slots-plugin.mjs`).
3. **`deploy-docs`** — publishes the artifact to GitHub Pages. It uses a dedicated
   `concurrency: pages` group with `cancel-in-progress: false` so a deploy is never interrupted by
   a newer CI run.

Two files tie the build to the domain:

- **`documentation/public/CNAME`** → `react-slots.grlt-hub.dev`. Astro copies `public/` into
  `dist/`, so GitHub Pages reads it and binds the custom domain on every deploy.
- **`documentation/astro.config.mjs`** → `site: "https://react-slots.grlt-hub.dev"`. Used for
  canonical URLs, the sitemap, and the absolute links in `/llms.txt`. No `base` is set because the
  subdomain serves the site at its root (`/`).

## One-time setup

### 1. DNS (in the `grlt-hub.dev` zone)

Add a `CNAME` record for the subdomain pointing at GitHub Pages:

| Type  | Name (host)   | Value                 |
| ----- | ------------- | --------------------- |
| CNAME | `react-slots` | `grlt-hub.github.io.` |

> A subdomain uses a `CNAME` record (not `A` records). `A`/`AAAA` records are only for an apex
> domain like `grlt-hub.dev` itself.

### 2. GitHub repo settings (`grlt-hub/react-slots`)

- **Settings → Pages → Build and deployment → Source:** select **GitHub Actions**.
- **Settings → Pages → Custom domain:** the `CNAME` file sets this automatically on first deploy.
  Once DNS has propagated, enable **Enforce HTTPS** (GitHub provisions the TLS cert; this can take
  a few minutes to an hour).
- **Settings → Environments → `github-pages`:** confirm it allows deployments from `main` (this is
  the default; the `deploy-docs` job targets this environment).

### 3. First deploy

Push to `main` (or re-run the latest `CI` workflow). Watch the **`deploy-docs`** job; its summary
links to the published URL. After DNS propagates, the site is live at
**https://react-slots.grlt-hub.dev**.

## Local preview

```bash
pnpm build                                   # build the library first
pnpm --filter ./documentation build          # build the docs
pnpm --filter ./documentation preview        # serve dist/ locally
```

## Troubleshooting

- **404 / "There isn't a GitHub Pages site here":** the Pages source isn't set to *GitHub Actions*,
  or the first deploy hasn't run yet.
- **Domain shows "improperly configured" in Settings → Pages:** DNS hasn't propagated, or the
  `CNAME` record points somewhere other than `grlt-hub.github.io`.
- **Custom domain keeps resetting:** make sure `documentation/public/CNAME` exists and ships in the
  artifact — every deploy re-asserts the domain from that file.
- **"Enforce HTTPS" is greyed out:** wait for the TLS certificate to finish provisioning after DNS
  resolves, then re-check.
