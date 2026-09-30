# Homeworth Realty Corp. site

React + TypeScript + Vite on GitHub Pages. Listings are data, not code: `public/data/listings.json`. Site copy, contacts and the inquiry recipients live in `public/data/site.json`. Uploaded photos live in `public/photos/`.

## Deploy
Settings → Pages → Source: **GitHub Actions**. Keep exactly one workflow file in `.github/workflows/`.

## Admin: `/#/admin`
1. Connect with owner, repo, branch and a fine-grained token (Contents: read and write).
2. **Import** your `.xlsx` (or CSV). Rows marked “Unlisted / Occupied” in Webpage import as hidden. Re-importing updates matching listings.
3. **Add listing**: paste screenshots straight into the photo box (Ctrl/⌘+V), drop files, or choose photos. Images are resized, saved to `public/photos/`, and stored on the listing as a path.
4. **Publish to site** makes ONE commit (listings + photos), so only one deploy runs.

## Inquiry form
Sends through FormSubmit to `inquiry.to` with `inquiry.cc` copied (edit in `site.json`). The first submission after deploy sends an activation email to the `to` address; click the link once.
