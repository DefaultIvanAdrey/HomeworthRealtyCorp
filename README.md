# Homeworth Realty Corp. site

React + TypeScript + Vite, hosted on GitHub Pages. **No listings live in code.** They are read from `public/data/listings.json`; site copy, phone and hero image from `public/data/site.json`.

## Set up
1. Create a GitHub repo, push this folder to `main`.
2. Settings → Pages → Source: **GitHub Actions**. Every push to `main` redeploys.
3. Settings → Developer settings → Fine-grained tokens: create one for this repo only, permission **Contents: Read and write**.
4. Open `https://<owner>.github.io/<repo>/#/admin`, enter owner, repo, branch and token, then Connect.

## Adding listings
- **Import CSV:** upload the sheet export. The header row is detected automatically, rows are previewed, existing listings are updated by web address/name instead of duplicated.
- **Add listing:** manual form. **On site** checkbox hides a listing without deleting it.
- **Publish to site** commits `listings.json`; Pages redeploys in about a minute. "Download JSON" works without a token.

## Custom domain
Add `public/CNAME` containing `homeworthrealtycorp.com` and point DNS to GitHub Pages, only when you are ready to leave Hostinger.

`npm install && npm run dev` to run locally.
