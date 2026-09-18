# Enterprise Systems Factory

Commercial front door for Highest Degree Priorities' enterprise systems build + operate capability.

## Positioning

**Enterprise systems built to operate.**

Three simple engagement paths:

- **Build It** — reuse, assemble, extend, or custom-build the system, then deploy and hand off.
- **Build + Operate It** — build/assemble the system and continue with managed operation, monitoring, evidence, and improvement.
- **Operate It** — take over an existing app, AI agent, workflow stack, automation, internal tool, or custom system and make it operationally reliable.

## Site

Static GitHub Pages-ready site:

- `index.html` — sales page + browser-side system brief builder
- `styles.css` — responsive visual system + animation
- `script.js` — interactions, GA4 events, brief generation, copy/email flow
- `CNAME` — `enterprisesystemsfactory.com`
- `robots.txt` + `sitemap.xml` — search discovery
- `.nojekyll` — direct static asset serving

## Analytics

The first release uses HDP GA4 measurement ID `G-2ZD9GMMZ36` and emits ESF-specific events including:

- `esf_path_selected`
- `esf_section_view`
- `esf_brief_generated`
- `esf_brief_email_clicked`
- `esf_brief_copied`
- named CTA click events through `data-track`

## Conversion flow

The browser-side brief builder does not automatically transmit visitor information. It creates a structured project brief locally and lets the visitor explicitly choose to email it to `contact@highestdegreepriorities.com` or copy it.

A future backend intake can replace this without changing the front-end engagement model.

## Deployment checklist

1. Enable GitHub Pages for the repository from the `main` branch / root.
2. Configure DNS for `enterprisesystemsfactory.com` to GitHub Pages according to the domain provider and GitHub Pages instructions.
3. Verify HTTPS after DNS propagation.
4. Test desktop + mobile layout, brief generation, mailto flow, and GA4 events.
5. Add a dedicated first-party intake endpoint when ready.

Powered by **Highest Degree Priorities**.
