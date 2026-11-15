# HindSight frontend

React + TypeScript + Vite + Tailwind CSS. Phase 01 is the homepage (`/`).

## Run

Start the API first, from the project root:

```
python -m venv .venv
.venv\Scripts\python -m pip install -r backend\requirements.txt
.venv\Scripts\python -m uvicorn backend.api:app --port 8000
```

Then the frontend, from this folder:

```
npm install
npm run dev
```

Open http://localhost:5173. The dev server forwards `/api` to `http://127.0.0.1:8000`
(change it with `HINDSIGHT_API_PROXY`; see `.env.example`).

`npm run build` writes `dist/`. When `dist/` exists, the API process also serves the built
homepage, so `http://localhost:8000` runs the whole app from one process.

## Where things are

| Path | What |
| --- | --- |
| `src/styles/theme.css` | Colour, type, radius, shadow and motion tokens (palette extracted from the NorthTitan reference) |
| `src/styles/fonts.css` | Self-hosted Outfit and Nunito (`public/fonts`) |
| `src/lib/api.ts`, `src/lib/types.ts` | API client and response types |
| `src/lib/analysis.ts` | Read-only selectors over engine output (no science is recomputed here) |
| `src/sections/` | One file per homepage section |
| `src/components/` | Shared UI, charts, logo |
| `public/logo`, `public/mascots` | Supplied brand assets, unmodified |

Every number on the page comes from the API. Nothing is hardcoded in components.
