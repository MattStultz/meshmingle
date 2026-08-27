# MeshMingle

Scan-and-share contact exchange for trade shows and maker events. Pure client-side web app — no backend, no build step, deployable straight to GitHub Pages. Installable as a PWA with offline support.

## Run locally

```bash
python3 -m http.server 8080
```

Then open http://localhost:8080. Camera access requires HTTPS or `localhost`.

## How it works

- **Capture** — scans another attendee's MeshMingle QR code with the device camera (`getUserMedia` + [jsQR](https://github.com/cozmo/jsQR)) and saves it to the currently selected event, with an optional notes field.
- **Share** — shows your own contact info as a QR code (generated with [qrcode](https://github.com/soldair/node-qrcode)), plus a second QR that links to the app itself so people without it can load it on the spot.
- **Saves** — browse captured contacts by event; export a whole event as CSV or a single contact as a `.vcf` (vCard).
- **Settings** — set your own contact info and create/switch between events.

All data is stored in IndexedDB on the device (with `navigator.storage.persist()` requested on startup) — nothing leaves the browser except through explicit CSV/vCard export.

## PWA

The app registers a service worker (`sw.js`) that precaches the app shell, so it keeps working offline after the first load. On iOS, add it to the home screen from Safari's share sheet for the best experience (Safari doesn't show an install prompt, and treats home-screen apps more leniently for storage than regular tabs).

## Deploying

Push to GitHub and enable GitHub Pages on the repo (Settings → Pages). No build step required — it serves directly from the repo root.
