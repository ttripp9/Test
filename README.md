# Daywise

Landing page and waitlist for Daywise: trip plans built around a daily budget, plus price-drop alerts on existing bookings.

## Structure
- `src/landing.html` – page content (styles, markup, script)
- `build.sh` – wraps it into `public/index.html`
- `netlify.toml` – build settings and security headers (CSP, HSTS, nosniff)

## Deploy (Netlify, free tier)
1. Connect this repo in Netlify (Add new site → Import from Git).
2. It runs `./build.sh` and publishes `public/`.
3. Signups appear under **Forms → waitlist** in the Netlify dashboard. Export to CSV anytime.

The form uses Netlify Forms with a honeypot field for bots and client-side email validation. No analytics or third-party scripts are loaded.

## Using another host
Set `data-endpoint` on each `<form class="signup">` to any endpoint that accepts a URL-encoded POST (e.g. Formspree), and update `connect-src` in the CSP to match.
