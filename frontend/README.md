# HindSight frontend

React + TypeScript + Vite + Tailwind CSS. `/` is the homepage; `/app` is the workspace.

| Address | What |
| --- | --- |
| `/app/analysis` | Farm Analysis: the step-by-step inputs and the results |
| `/app/insights` (`/insights`) | Field Intelligence: climate patterns, seasonal exposure, rotation resilience, water resilience, soil care, location and data |
| `/app/scenarios` (`/scenarios`) | Scenario Lab: hypothetical adjustments to the historical record, compared against the baseline |
| `/app/brief` (`/decision-brief`) | Decision Brief: the printable report, with CSV and JSON exports |
| `/app/analyses` | My Analyses: analyses saved on this device |
| `/app/science` (`/science`) | Data, method and limitations |
| `/app/demo` (`/demo`) | The guided tour |

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
app, so `http://localhost:8000` runs everything from one process.

## Tests

```
.venv\Scripts\python -m pytest backend/tests -q        # engine, data sources and API (from the project root)
npm test                                               # frontend unit tests (from this folder)
.venv\Scripts\python scripts/e2e_workspace.py          # browser check of Farm Analysis (both servers running)
.venv\Scripts\python scripts/e2e_phase3.py             # browser check of everything in the table above
```

## Where things are

| Path | What |
| --- | --- |
| `src/styles/theme.css` | Colour, type, radius, shadow and motion tokens (palette extracted from the NorthTitan reference) |
| `src/styles/fonts.css` | Self-hosted Outfit and Nunito (`public/fonts`) |
| `src/lib/api.ts`, `src/lib/types.ts` | API client and response types |
| `src/lib/analysis.ts` | Read-only selectors over engine output (no science is recomputed here) |
| `src/sections/` | One file per homepage section |
| `src/app/steps/`, `src/app/results/` | Farm Analysis inputs and result tabs |
| `src/app/insights/` | Field Intelligence sections; each takes one analysis envelope as its only data |
| `src/app/lib/insights.ts` | The interpretation rules: how a climate difference, a bare month, a trade-off and a rank range are worded. Thresholds are constants in this file and are printed on the Science page |
| `src/app/pages/` | One file per workspace page |
| `src/app/brief/`, `src/app/scenarios/`, `src/app/demo/`, `src/app/science/` | Decision Brief, Scenario Lab, guided tour and Science page parts |
| `src/app/state/` | Workspace state, analysis jobs, comparison runs |
| `src/app/lib/library.ts`, `src/app/lib/scenarios.ts` | Analyses and scenarios saved in this browser (`localStorage`); nothing is sent to a server |
| `src/components/` | Shared UI, charts, logo |
| `public/logo`, `public/mascots` | Supplied brand assets, unmodified |

Every number on the page comes from the API. Nothing is hardcoded in components.

## API added for Phase 03 (`backend/api.py`)

- Every analysis envelope now carries `context.climate`: the yearly values behind each of the engine's
  six climate indicators and a monthly climatology of the same NASA POWER record (`backend/context.py`).
  They are read with the engine's own thresholds and tested to reproduce its period means.
- `inputs` reports what was actually retrieved: weather date range and number of days, the SoilGrids
  profile if one was used, and the date range and count of stored MODIS NDVI observations.
- `POST /api/scenarios/compare` takes `{ base, variants }` and runs the engine once per variant
  (a different scenario and/or set of priority weights) on weather and soil that are read once.
  Poll `GET /api/analysis/{id}`; the finished job has `comparison.variants[].envelope`.

The engine (`backend/engine/`) is unchanged.
