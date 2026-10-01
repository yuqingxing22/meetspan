# MeetSpan: deployment and maintenance notes

Live site: https://meetspan.app (also served at https://yuqingxing22.github.io/meetspan/, which redirects to the custom domain).

The app is a static Vite build hosted on GitHub Pages. Data and sign-in live in Firebase (project id `meetspan`). The domain is registered and managed at Cloudflare. Nothing here is a secret: the Firebase web config is public by design, and real protection comes from the Firestore rules.

## How a deploy happens

Every push to `main` runs the GitHub Actions workflow in `.github/workflows/deploy.yml`, which builds the app and publishes it to GitHub Pages. The Firebase web config is injected at build time from repository Variables (Settings, Secrets and variables, Actions, Variables):

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

Paste only the value into each box, not the whole `NAME=value` line. The app strips an accidental prefix, but keep them clean anyway. After changing a Variable, re-run the deploy (Actions tab, Run workflow), because values are baked in at build time.

## Custom domain (meetspan.app)

DNS records at Cloudflare (DNS, Records). All five must be DNS only (grey cloud), not proxied, so GitHub can issue the HTTPS certificate:

| Type | Name | Content |
| --- | --- | --- |
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | yuqingxing22.github.io |

GitHub side: repository Settings, Pages, Custom domain is `meetspan.app`, and Enforce HTTPS is on. The certificate renews automatically.

The app uses relative asset paths (`base: "./"`) and hash routing (`#/`), so it works on both the custom domain and the github.io address without code changes.

## Firebase settings that must stay in place

1. Authentication, Sign-in method: **Anonymous** and **Google** are both enabled. Do not turn on Anonymous auto clean-up, because deleting old anonymous accounts would orphan the polls and availability they created.
2. Authentication, Settings, Authorized domains: `meetspan.app`, `www.meetspan.app` and `yuqingxing22.github.io` must be listed, otherwise Google sign-in fails with `auth/unauthorized-domain`.
3. Firestore, Rules: must match `firestore.rules` in this repo. After editing the file, paste it into the console Rules tab and publish. The rules file is not deployed automatically.

## Google Cloud API key restrictions

The Firebase web key lives in Google Cloud, APIs and Services, Credentials, "Browser key (auto created by Firebase)" (project `meetspan`).

- API restrictions must include: Identity Toolkit API, Cloud Firestore API, Token Service API. Places API is not used by this app.
- If Application restrictions is set to Websites, the allowed referrers must include `https://meetspan.app/*`, `https://www.meetspan.app/*`, `https://yuqingxing22.github.io/*`, `https://meetspan.firebaseapp.com/*` and `https://meetspan.web.app/*`. Add `http://localhost:5173/*` for local development.

Symptoms of a wrong setting:

| Console error | Cause |
| --- | --- |
| `auth/requests-to-this-api-...signup-are-blocked` | Identity Toolkit API is not in the key's API list |
| `auth/requests-from-referer-https://...-are-blocked` | the site's address is not in the key's website list |
| `auth/unauthorized-domain` | the domain is missing from Firebase Authorized domains |
| `auth/operation-not-allowed` | the sign-in provider is not enabled in Firebase |

Changes to key restrictions can take up to 5 minutes to apply, so wait before concluding something is still broken.

## Periodic upkeep

- **Domain renewal**: keep Auto-renew on for meetspan.app in Cloudflare (Domains, Registrations) and keep the payment card valid. An expired domain takes the site down.
- **Billing**: the Firebase project is on the Blaze (pay as you go) plan. Set a budget alert in Google Cloud Billing (for example 5 USD) so unexpected usage sends an email.
- **Rules drift**: if anyone edits rules in the console, make sure the repo file is updated to match.
- **Dependencies**: run `npm install` after pulling, and `npm test` and `npm run build` before pushing larger changes.
