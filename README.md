# MeshMingle

Scan-and-share contact exchange for trade shows and maker events. Pure client-side web app — no backend, no build step, deployable straight to GitHub Pages.

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

All data is stored in `localStorage` on the device — nothing leaves the browser except through explicit CSV/vCard export.

## Deploying

Push to GitHub and enable GitHub Pages on the repo (Settings → Pages). No build step required — it serves directly from the repo root.
