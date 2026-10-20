# MF MPanel v2.14.1 — Simplified Setup

- Kept the product on one clear architecture: Vercel frontend + Supabase backend.
- Removed unused Express, dotenv, Google GenAI, Express types, esbuild direct dependency and Autoprefixer direct dependency from the frontend package.
- Removed obsolete Netlify deployment config to prevent choosing the wrong hosting target.
- Moved old version-specific reports and legacy Firebase/Netlify notes into `docs/archive/`; no historical notes were discarded.
- Replaced the root README with a short setup and release checklist.
- Preserved the existing Android app source and pairing bridge compatibility notes.
- Did not apply database migrations or deploy the website.
