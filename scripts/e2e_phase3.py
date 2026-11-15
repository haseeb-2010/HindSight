"""End-to-end check of the Phase 03 experiences in a real browser: Field Intelligence, Scenario Lab,
Decision Brief, the saved-on-this-device library, priority profiles, the Science page and the guided tour.

Needs both servers running (API on :8000, frontend on :5173) and Playwright with Chrome:
    python scripts/e2e_phase3.py [--shots DIR]
Every analysis in it is a real engine run on the cached NASA POWER record of a demonstration farm.
Exits non-zero if any check fails."""
import json
import os
import re
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8")
# HINDSIGHT_BASE points the same checks at a deployed site, e.g. the Azure website URL.
BASE = os.environ.get("HINDSIGHT_BASE", "http://127.0.0.1:5173").rstrip("/")
ROOT = Path(__file__).resolve().parents[1]
ARGS = sys.argv[1:]
SHOTS = Path(ARGS[ARGS.index("--shots") + 1]) if "--shots" in ARGS else None
FAILED: list[str] = []
LOG: list[str] = []
LIB = "JSON.parse(localStorage.getItem('hindsight.library.v1') || '[]')"
DISCLAIMER = ("These are hypothetical adjustments to the historical weather record. They are not future climate projections. "
              "The model applies a uniform temperature offset and precipitation multiplier; it does not simulate future weather "
              "timing or changing rainfall patterns.")
BRIEF_DISCLAIMER = ("HindSight provides historical decision-support simulations. Rankings are relative to the alternatives and "
                    "assumptions evaluated. They are not guaranteed recommendations, yield forecasts, or substitutes for local "
                    "agricultural expertise.")
BANNED = re.compile(r"\b(predicted yield|yield forecast(?!s, or)|guaranteed best|will yield|tonnes of soil|soil loss of|AI-powered|artificial intelligence)\b", re.I)


def check(name, ok, detail=""):
    LOG.append(f"{'PASS' if ok else 'FAIL'}  {name}{'  ' + str(detail)[:300] if detail and not ok else ''}")
    if not ok:
        FAILED.append(name)


def shot(pg, name):
    if SHOTS:
        SHOTS.mkdir(parents=True, exist_ok=True)
        pg.screenshot(path=str(SHOTS / f"{name}.png"), full_page=True)


def norm(text):
    return " ".join(text.split())


def main_text(pg):
    return norm(pg.locator("main").inner_text())


def saved(pid):
    return json.loads((ROOT / f"backend/data/saved/{pid}_response.json").read_text(encoding="utf-8"))


def quick_analysis(pg, pid):
    """A real engine run of a demonstration farm through the app's own one-click start."""
    pg.goto(f"{BASE}/app/insights", wait_until="networkidle")
    pg.evaluate("sessionStorage.clear()")
    pg.goto(f"{BASE}/app/insights", wait_until="networkidle")
    pg.locator(f'[data-quick-preset="{pid}"]').click()
    pg.wait_for_selector('[aria-label="Analysis being interpreted"]', timeout=180_000)
    pg.wait_for_timeout(500)
    return pg.evaluate(f"{LIB}[0].envelope")


def insight_tab(pg, tab_id, wait_text):
    pg.goto(f"{BASE}/app/insights?tab={tab_id}", wait_until="networkidle")
    pg.get_by_text(wait_text, exact=False).first.wait_for(timeout=30_000)
    pg.wait_for_timeout(500)
    return norm(pg.locator("#insight-panel").inner_text())


def overflow(pg):
    return pg.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")


with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome", headless=True)
    ctx = b.new_context(viewport={"width": 1440, "height": 900}, accept_downloads=True)
    pg = ctx.new_page()
    errors: list[str] = []
    api_failures: list[str] = []
    pg.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
    pg.on("console", lambda m: errors.append(f"console: {m.text}") if m.type == "error" else None)
    pg.on("response", lambda r: api_failures.append(f"{r.status} {r.url}") if r.status >= 500 and "/api/" in r.url else None)

    # ------------------------------------------------------------ routes named in the brief
    for short, full in [("/insights", "/app/insights"), ("/scenarios", "/app/scenarios"), ("/decision-brief", "/app/brief"),
                        ("/science", "/app/science"), ("/demo", "/app/demo")]:
        pg.goto(BASE + short, wait_until="networkidle")
        check(f"route {short} opens {full}", pg.url.split("?")[0].endswith(full), pg.url)

    # ------------------------------------------------------------ empty states
    pg.goto(f"{BASE}/app/insights", wait_until="networkidle")
    pg.evaluate("localStorage.clear(); sessionStorage.clear()")
    for path, label in [("/app/insights", "Field Intelligence"), ("/app/scenarios", "Scenario Lab"), ("/app/brief", "Decision Brief")]:
        pg.goto(BASE + path, wait_until="networkidle")
        pg.wait_for_selector("[data-analysis-required]", timeout=20_000)
        check(f"{label}: asks for an analysis when none is open", pg.locator("[data-quick-preset]").count() == 3)
    pg.goto(f"{BASE}/app/analyses", wait_until="networkidle")
    check("My Analyses: empty state", "Nothing saved on this device yet" in main_text(pg))

    # ------------------------------------------------------------ Field Intelligence on a real analysis (Chakwal)
    env = quick_analysis(pg, "chakwal")
    res = env["result"]
    cur = next(r for r in res["rotations"] if r["is_current"])
    ranked = sorted(res["rotations"], key=lambda r: r["scores"]["rank"])
    check("one-click demo analysis is a live engine run equal to the reference output", env["source"] == "live" and res == saved("chakwal"))
    check("analysis is saved on this device with its settings", pg.evaluate(f"{LIB}.length") == 1 and env["request"]["priorities"]["stability"] == 4)
    head = norm(pg.locator('[aria-label="Analysis being interpreted"]').inner_text())
    check("run summary names farm, period, rotation, priorities and data", all(s in head for s in [
        res["site"]["name"], "1985–2024", "Wheat then bare fallow", "Stability 4", "Live analysis", "NDVI check: performed"]), head)
    shot(pg, "insights_climate")

    t = insight_tab(pg, "climate", "Understand how your local growing conditions have changed")
    check("climate: all six engine indicators with both periods", all(s["label"].split(" ")[0] in t for s in res["climate_shift"]) and "1985–2004" in t and "2005–2024" in t, t[:400])
    hot = next(s for s in res["climate_shift"] if s["id"] == "hot_days")
    check("climate: shows the engine's early and late values", f"{hot['early']:.1f}" in t and f"{hot['late']:.1f}" in t, (hot, t[:300]))
    check("climate: documented labels are used", any(k in t for k in ["Higher in later period", "Lower in later period", "Little change"]) and
          ("Statistical evidence is limited" in t or "Consistent trend in this record" in t))
    check("climate: rainfall caution is visible", "Rainfall estimates should be interpreted alongside local station records" in t)
    check("climate: a p-value is not called the probability of a trend", "not the probability" in t.lower() or "is not the probability" in t.lower(), t[-600:])
    check("climate: yearly chart drawn from the record", pg.locator("#insight-panel svg").count() >= 1)

    t = insight_tab(pg, "season", "When is your field most exposed?")
    check("seasonal exposure: modelled bare-soil fraction with its legend", "modelled bare-soil" in t.lower() and "Higher bare-soil exposure" in t and "Lower bare-soil exposure" in t, t[:400])
    check("seasonal exposure: engine's heavy-rain exposure indicator, correctly named", "Heavy rainfall exposure during relatively bare periods" in t and
          f"{round(cur['indicators']['erosive_rain_on_bare_frac'] * 100)}%" in t, t[:600])
    bare = [c["month"] for c in cur["calendar"] if c["bare_frac"] >= 2 / 3]
    months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
    check("seasonal exposure: names the bare months from the engine calendar", months[bare[0] - 1] in t and months[bare[-1] - 1] in t, (bare, t[:500]))
    check("seasonal exposure: no soil-loss claim", not re.search(r"tonnes|t/ha|soil loss of|erosion rate of", t, re.I))
    shot(pg, "insights_season")

    t = insight_tab(pg, "resilience", "Which rotation holds up better under difficult historical conditions?")
    worst = cur["hindcast"]["worst_years"]
    check("resilience: the current rotation's five worst years", all(str(y) in t for y in worst["years"]), (worst, t[:400]))
    check("resilience: every rotation's mean index in those years", all(f"{r['hindcast']['worst_years']['mean_index']:.2f}" in t for r in res["rotations"]), t[:600])
    check("resilience: robustness to legume-effect assumptions and rainfall variation", "Robustness to legume-effect assumptions" in t and "Robustness to rainfall variation" in t)
    check("resilience: sensitivity checks are not called probabilities", "not probabilit" in t.lower() or "not a probability" in t.lower(), t[-500:])
    check("resilience: every returned rotation is profiled", all(r["name"].replace(" (current)", "") in t for r in res["rotations"]))
    shot(pg, "insights_resilience")

    t = insight_tab(pg, "water", "Explore how your rotation interacts with water availability.")
    check("water: demand and irrigation kept as two separate measures", "Crop water demand" in t and "Irrigation requirement" in t and
          f"{cur['hindcast']['water_demand_mm_per_year']:,.0f}" in t, t[:500])
    check("water: rainfed analysis says irrigation is zero by definition", "rainfed" in t.lower())
    with pg.expect_request(lambda r: r.url.endswith("/api/scenarios/compare") and r.method == "POST") as req:
        pg.get_by_role("button", name=re.compile("re-?rank|re-?run the ranking|rerun the ranking", re.I)).first.click()
    body = json.loads(req.value.post_data)
    check("water priority explorer: re-runs the real engine with only the water weight changed",
          [v["id"] for v in body["variants"]] == ["yours", "water"] and list(body["variants"][1]["priorities"]) == ["water_use"] and "priorities" not in body["variants"][0], body["variants"])
    pg.get_by_text("Water conservation raised", exact=False).first.wait_for(timeout=120_000)
    pg.wait_for_timeout(800)
    t = norm(pg.locator("#insight-panel").inner_text())
    check("water priority explorer: says weights change the ranking, not the simulation or the water supply",
          "does not change" in t and ("water supply" in t or "simulated seasons" in t), t[-900:])
    shot(pg, "insights_water")

    t = insight_tab(pg, "soil", "Where could your rotation do more for the soil?")
    check("soil care: proxies named as proxies", "proxy" in t.lower() and "not a" in t.lower() and f"{round(cur['indicators']['cover_frac'] * 100)}%" in t, t[:500])
    shot(pg, "insights_soil")

    t = insight_tab(pg, "location", "Explore the geographic context of your farm.")
    check("location: map with scale and schematic grid cell", pg.locator("#insight-panel .leaflet-container").count() == 1 and
          pg.locator("#insight-panel .leaflet-control-scale").count() >= 1 and "Approximate NASA POWER grid cell" in t)
    check("location: actual retrieved ranges from the response", env["inputs"]["climate"]["start"] in t and env["inputs"]["climate"]["end"] in t and
          env["inputs"]["ndvi"]["first_date"] in t and "0.5" in t and "250 m" in t, t[:800])
    check("location: three demonstration farms", all(x in t for x in ["Chakwal", "Sheikhupura", "Ames"]))
    check("location: no invented field-level layers", not re.search(r"field boundary detected|stress zone|erosion zone", t, re.I))
    shot(pg, "insights_location")

    # ------------------------------------------------------------ Scenario Lab
    compare_calls: list[dict] = []
    pg.on("request", lambda r: compare_calls.append(json.loads(r.post_data)) if r.url.endswith("/api/scenarios/compare") and r.method == "POST" else None)
    pg.goto(f"{BASE}/app/scenarios", wait_until="networkidle")
    pg.wait_for_timeout(800)
    t = main_text(pg)
    check("scenario lab: nothing runs when the page opens", compare_calls == [])
    check("scenario lab: mandatory disclaimer is shown before any run", DISCLAIMER in t, t[:500])
    check("scenario lab: baseline and presets offered", all(x in t for x in ["Historical baseline", "Mild warming test", "Higher warming test", "Moderately lower rainfall", "Lower rainfall"]))
    shot(pg, "scenarios_setup")
    for label in ["Lower rainfall", "Higher warming test"]:
        pg.get_by_role("checkbox", name=re.compile(rf"^{label}\b")).first.check()
    pg.get_by_role("button", name=re.compile(r"^Run (the )?(comparison|\d+ scenarios|scenarios)", re.I)).first.click()
    pg.get_by_text("What changed between these scenarios?", exact=False).first.wait_for(timeout=180_000)
    pg.wait_for_timeout(900)
    sent = compare_calls[-1]
    check("scenario lab: only the selected scenarios run, baseline first",
          [(v["scenario"]["temp_delta_c"], v["scenario"]["precip_factor"]) for v in sent["variants"]] == [(0, 1), (0, 0.8), (2, 1)], sent["variants"])
    check("scenario lab: runs reuse the open analysis's settings", sent["base"]["location"]["preset_id"] == "chakwal" and sent["base"]["priorities"] == env["request"]["priorities"])
    t = main_text(pg)
    check("scenario lab: disclaimer stays with the results", t.count(DISCLAIMER) >= 1 and pg.locator("[data-scenario-disclaimer]").first.is_visible())
    check("scenario lab: comparison shows the compared indicators", all(x in t for x in ["Median seasonal index", "P10", "Failure frequency", "Crop water demand", "Irrigation requirement"]), t[:700])
    check("scenario lab: results are labelled live", "Live analysis" in t)
    check("scenario lab: no guarantee about the future", not re.search(r"guaranteed|will withstand|future-proof", t, re.I))
    shot(pg, "scenarios_results")

    # save, reload, remove a custom scenario
    pg.get_by_label(re.compile("scenario name", re.I)).first.fill("My dry test")
    pg.get_by_role("button", name=re.compile(r"^Save", re.I)).first.click()
    pg.wait_for_timeout(400)
    stored = pg.evaluate("JSON.parse(localStorage.getItem('hindsight.scenarios.v1') || '[]')")
    check("scenario lab: a named scenario is saved on this device", len(stored) == 1 and stored[0]["label"] == "My dry test", stored)
    pg.reload(wait_until="networkidle")
    pg.wait_for_timeout(700)
    t = main_text(pg)
    check("scenario lab: saved scenario and last comparison survive a reload", "My dry test" in t and "What changed between these scenarios?" in t)
    pg.get_by_role("button", name=re.compile("(remove|delete).*My dry test", re.I)).first.click()
    pg.wait_for_timeout(300)
    check("scenario lab: saved scenario can be removed", pg.evaluate("JSON.parse(localStorage.getItem('hindsight.scenarios.v1') || '[]').length") == 0)

    # a failing comparison shows an error with a way to retry, not a blank page
    pg.route("**/api/scenarios/compare", lambda r: r.fulfill(status=503, content_type="application/json", body=json.dumps({"error": "busy", "detail": "The server is busy. Please try again."})))
    pg.get_by_role("button", name=re.compile(r"^Run (the )?(comparison|\d+ scenarios|scenarios)|run again", re.I)).first.click()
    pg.get_by_text("The server is busy. Please try again.", exact=False).first.wait_for(timeout=20_000)
    check("scenario lab: execution failure is reported with retry", pg.get_by_role("button", name=re.compile("try again", re.I)).count() >= 1)
    pg.unroute("**/api/scenarios/compare")
    api_failures.clear()
    errors[:] = [e for e in errors if "503" not in e]

    # ------------------------------------------------------------ Decision Brief and exports
    pg.goto(f"{BASE}/app/brief", wait_until="networkidle")
    pg.get_by_text("Your Rotation Decision Brief", exact=False).first.wait_for(timeout=30_000)
    pg.wait_for_timeout(900)
    t = main_text(pg)
    check("brief: seven report sections", all(x in t for x in ["Farm snapshot", "Historical environmental context", "Existing rotation assessment", "Leading alternatives",
                                                              "Evidence and limitations", "Local verification checklist"]), t[:300])
    check("brief: verbatim disclaimer", BRIEF_DISCLAIMER in t)
    check("brief: farm, exact priorities and identifier", res["site"]["name"] in t and "Stability" in t and env["analysis_id"][:8] in t)
    top = next(r for r in ranked if not r["is_current"])
    check("brief: leading alternative with the engine's reasons and local checks", top["name"] in t and top["explanation"]["reasons"][0] in t and top["explanation"]["local_review"][0] in t, top["name"])
    check("brief: current rotation numbers come from the engine", f"{cur['hindcast']['median']:.2f}" in t and f"{cur['hindcast']['p10']:.2f}" in t)
    check("brief: no unsupported claims", not BANNED.search(t), BANNED.search(t))
    shot(pg, "brief")
    with pg.expect_download() as d:
        pg.get_by_role("button", name=re.compile("JSON", re.I)).first.click()
    check("brief: JSON export is exactly this analysis", json.loads(Path(d.value.path()).read_text(encoding="utf-8")) == env)
    with pg.expect_download() as d:
        pg.get_by_role("button", name=re.compile("CSV", re.I)).first.click()
    csv_text = Path(d.value.path()).read_text(encoding="utf-8")
    rows = [ln for ln in csv_text.splitlines() if ln and not ln.startswith("#")]
    check("brief: CSV has one row per rotation and names its run", len(rows) == len(res["rotations"]) + 1 and env["analysis_id"] in csv_text and "stability" in csv_text.lower(), csv_text[:400])
    pg.emulate_media(media="print")
    pt = norm(pg.locator("body").inner_text())
    check("brief: print view keeps the report and drops the app chrome", BRIEF_DISCLAIMER in pt and "Farm snapshot" in pt and not pg.locator("header nav").first.is_visible())
    pdf = pg.pdf(format="A4", print_background=True)
    check("brief: saves as a PDF", pdf[:4] == b"%PDF" and len(pdf) > 20_000, len(pdf))
    if SHOTS:
        (SHOTS / "decision-brief.pdf").write_bytes(pdf)
    pg.emulate_media(media="screen")

    # ------------------------------------------------------------ priority profiles
    pg.goto(f"{BASE}/app/analysis?step=priorities", wait_until="networkidle")
    pg.wait_for_selector("text=Start from a priority profile")
    pg.get_by_role("radio", name=re.compile("Water-conscious")).check()
    pg.wait_for_timeout(300)
    vals = {k: pg.get_by_label(f"{k} weight").input_value() for k in ["Stability", "Water conservation", "Forage potential", "Nitrogen contribution"]}
    check("priority profile fills the sliders", vals == {"Stability": "5", "Water conservation": "5", "Forage potential": "1", "Nitrogen contribution": "2"}, vals)
    s = pg.get_by_label("Forage potential weight")
    s.focus(); s.press("ArrowRight")
    pg.wait_for_timeout(200)
    check("a profile stays editable and then reads as custom", s.input_value() == "2" and "Custom weights" in main_text(pg))
    pg.goto(f"{BASE}/app/analysis?step=results", wait_until="networkidle")
    pg.wait_for_selector("#results-title")
    check("changed priorities need a new analysis", "These results are from your previous settings." in main_text(pg))
    with pg.expect_request(lambda r: r.url.endswith("/api/analyze") and r.method == "POST") as req:
        pg.get_by_role("button", name="Rerun analysis").click()
    sent = json.loads(req.value.post_data)["priorities"]
    check("rerun sends the edited profile", sent["water_use"] == 5 and sent["stability"] == 5 and sent["forage"] == 2, sent)
    pg.wait_for_function(f"{LIB}.length === 2", timeout=120_000)
    pg.wait_for_timeout(600)

    # ------------------------------------------------------------ library: saved on this device
    pg.goto(f"{BASE}/app/analyses", wait_until="networkidle")
    pg.wait_for_timeout(500)
    t = main_text(pg)
    check("library: both analyses listed with their exact priorities", pg.locator("[data-analysis-card]").count() == 2 and "Water 5" in t and "Water 3" in t and "Saved on this device" in t, t[:400])
    check("library: does not claim syncing", "synchronised to your other devices" in t and "nothing is stored on a server" in t.lower())
    first = pg.locator("[data-analysis-card]").first
    first.get_by_role("button", name=re.compile("^Rename")).click()
    first.get_by_label("Name of this analysis").fill("Chakwal, water first")
    first.get_by_role("button", name="Save name").click()
    pg.wait_for_timeout(300)
    check("library: rename is stored", pg.evaluate(f"{LIB}[0].name") == "Chakwal, water first")
    pg.reload(wait_until="networkidle")
    check("library: survives a reload", pg.locator("[data-analysis-card]").count() == 2 and "Chakwal, water first" in main_text(pg))
    for card in pg.locator("[data-analysis-card]").all():
        card.get_by_text("Compare", exact=True).click()
    pg.get_by_role("button", name="Compare selected").click()
    pg.get_by_role("region", name="Comparison of the selected analyses").wait_for(timeout=30_000)
    pg.wait_for_timeout(900)
    t = norm(pg.get_by_role("region", name="Comparison of the selected analyses").inner_text())
    check("library: two saved analyses compared side by side", "Chakwal, water first" in t and "Median seasonal index" in t, t[:400])
    shot(pg, "library_compare")
    with pg.expect_download() as d:
        first.get_by_role("button", name=re.compile("as JSON")).click()
    exported_path = Path(d.value.path())
    exported = json.loads(exported_path.read_text(encoding="utf-8"))
    check("library: export before clearing browser data", exported["request"]["priorities"]["water_use"] == 5 and len(exported["result"]["rotations"]) >= 3)

    # a file with missing optional fields and no alternatives still imports and renders
    thin = json.loads(json.dumps(exported))
    for k in ("context", "inputs", "analysis_id", "computed_at", "notes", "elapsed_ms"):
        thin.pop(k, None)
    thin["result"]["rotations"] = [r for r in thin["result"]["rotations"] if r["is_current"]]
    lone = thin["result"]["rotations"][0]
    for k in ("calendar", "explanation"):
        lone.pop(k, None)
    lone["hindcast"]["worst_years"] = None
    lone["scores"].pop("rank_range", None); lone["scores"].pop("rank_range_rain", None)
    lone["scores"]["rank"] = 1
    thin["result"]["validation"] = {"ndvi_check": None}
    thin["result"]["site"]["name"] = "Sparse test field"
    sparse = exported_path.with_name("sparse.json")
    sparse.write_text(json.dumps(thin), encoding="utf-8")
    pg.locator('input[type="file"]').set_input_files(str(sparse))
    pg.get_by_text("Imported “Sparse test field”", exact=False).wait_for(timeout=10_000)
    bad = exported_path.with_name("not-an-analysis.json")
    bad.write_text('{"hello": "world"}', encoding="utf-8")
    pg.locator('input[type="file"]').set_input_files(str(bad))
    pg.get_by_text("is not a HindSight analysis file", exact=False).wait_for(timeout=10_000)
    check("library: import accepts an analysis file and rejects anything else", pg.locator("[data-analysis-card]").count() == 3)
    sparse_card = pg.locator("[data-analysis-card]", has_text="Sparse test field")
    sparse_card.get_by_role("button", name="Open", exact=True).click()
    pg.wait_for_selector("#results-title")
    before = len(errors)
    for tab_id in ["climate", "season", "resilience", "water", "soil", "location"]:
        pg.goto(f"{BASE}/app/insights?tab={tab_id}", wait_until="networkidle")
        pg.wait_for_timeout(700)
        panel = norm(pg.locator("#insight-panel").inner_text())
        check(f"missing optional fields: {tab_id} renders an honest state", len(panel) > 80 and "Something went wrong" not in panel and "NaN" not in panel and "undefined" not in panel, panel[:300])
    pg.goto(f"{BASE}/app/brief", wait_until="networkidle")
    pg.wait_for_timeout(900)
    t = main_text(pg)
    check("missing optional fields: brief renders without alternatives or explanations", BRIEF_DISCLAIMER in t and "NaN" not in t and "undefined" not in t and "Something went wrong" not in t, t[:300])
    pg.goto(f"{BASE}/app/scenarios", wait_until="networkidle")
    pg.wait_for_timeout(600)
    check("missing optional fields: scenario lab still opens", DISCLAIMER in main_text(pg))
    check("missing optional fields: no browser errors", len(errors) == before, errors[before:before + 3])

    pg.goto(f"{BASE}/app/analyses", wait_until="networkidle")
    sparse_card = pg.locator("[data-analysis-card]", has_text="Sparse test field")
    sparse_card.get_by_role("button", name=re.compile("^Delete the analysis")).click()
    sparse_card.get_by_role("button", name="Delete", exact=True).click()
    pg.wait_for_timeout(300)
    check("library: delete removes it from this device", pg.evaluate(f"{LIB}.length") == 2 and pg.locator("[data-analysis-card]").count() == 2)

    # ------------------------------------------------------------ science page
    pg.goto(f"{BASE}/app/science", wait_until="networkidle")
    pg.get_by_text("The science behind better-informed rotation decisions", exact=False).first.wait_for(timeout=30_000)
    pg.wait_for_timeout(600)
    t = main_text(pg)
    check("science: sources, method and limits are all covered", all(x in t for x in ["NASA POWER", "MODIS", "SoilGrids", "FAO-56", "Penman", "Theil", "Pareto", "1985–2004", "2005–2024"]), t[:300])
    check("science: says what it is not", "not a forecast" in t.lower() or "not forecasts" in t.lower() or "hindcast" in t.lower())
    check("science: no invented endorsement or accuracy claim", not re.search(r"endorsed by NASA(?! \.)|peer-reviewed validation of HindSight|% accura", t, re.I) or "not affiliated" in t.lower() or "not endorsed" in t.lower())
    shot(pg, "science")

    # ------------------------------------------------------------ guided tour
    pg.goto(f"{BASE}/demo", wait_until="networkidle")
    pg.wait_for_selector("#tour-main h1")
    check("tour: starts with the challenge", "The challenge" in pg.locator("#tour-main h1").inner_text() and "Step 1 of 9" in main_text(pg))
    shot(pg, "tour_1")
    titles = ["Choose a real demonstration farm", "Explore historical conditions", "Inspect the current rotation", "Compare alternatives",
              "Explore trade-offs", "Run a hypothetical scenario", "Review the decision brief", "The final takeaway"]
    demo = saved("chakwal")
    dcur = next(r for r in demo["rotations"] if r["is_current"])
    for i, title in enumerate(titles, start=2):
        pg.locator("aside").get_by_role("button", name=re.compile("^Next")).click()
        pg.wait_for_function("t => document.querySelector('#tour-main h1')?.innerText.includes(t)", arg=title, timeout=20_000)
        pg.wait_for_load_state("networkidle")
        pg.wait_for_timeout(1100)
        t = main_text(pg)
        check(f"tour step {i}: {title}", f"Step {i} of 9" in t)
        if i == 2:
            check("tour: demonstration dataset and saved result are labelled", "Demonstration dataset — Chakwal, Pakistan" in t and "Saved demonstration result" in t and "Live analysis" not in t)
        if i == 3:
            check("tour: real climate comparison", "Understand how your local growing conditions have changed" in t and "1985–2004" in t)
        if i == 4:
            check("tour: current rotation with the engine's numbers", "wheat then bare fallow" in t.lower() and f"{dcur['hindcast']['median']:.2f}" in t and dcur["explanation"]["summary"] in t)
        if i == 5:
            dtop = sorted((r for r in demo["rotations"] if not r["is_current"]), key=lambda r: r["scores"]["rank"])[0]
            check("tour: top alternative and the engine's reasons", dtop["name"] in t and dtop["explanation"]["reasons"][0] in t)
        if i == 6:
            check("tour: trade-off views", "Robustness & trade-offs" in t and "Seasonal cover" in t)
            pg.get_by_text("Seasonal cover", exact=True).click()
            pg.get_by_text("When is your field most exposed?", exact=False).first.wait_for(timeout=20_000)
            pg.get_by_text("Water", exact=True).first.click()
            pg.get_by_text("Explore how your rotation interacts with water availability.", exact=False).first.wait_for(timeout=20_000)
        if i == 7:
            check("tour: scenario warning shown before running", DISCLAIMER in t and "Nothing has been calculated on this step yet" in t)
            with pg.expect_request(lambda r: r.url.endswith("/api/scenarios/compare") and r.method == "POST") as req:
                pg.locator("[data-tour-run]").click()
            sent = json.loads(req.value.post_data)
            pg.wait_for_selector("[data-tour-live-result]", timeout=180_000)
            pg.wait_for_timeout(900)
            t = main_text(pg)
            check("tour: step 7 is a real engine run of baseline and scenario", [v["id"] for v in sent["variants"]] == ["baseline", "rain80"] and sent["base"]["location"]["preset_id"] == "chakwal")
            check("tour: live result labelled live, with the warning still visible", "Live analysis" in t and DISCLAIMER in t and "What changed between these scenarios?" in t)
            shot(pg, "tour_7_live")
        if i == 8:
            check("tour: decision brief with checklist and disclaimer", "Local verification checklist" in t and BRIEF_DISCLAIMER in t and "Saved demonstration result" in t)
        if i == 9:
            check("tour: final takeaway", "HindSight connects Earth observations, local farming information, and crop science" in t)
        shot(pg, f"tour_{i}")
    check("tour: no unsupported claims anywhere on the last step", not BANNED.search(main_text(pg)))
    pg.locator("aside").get_by_role("button", name="Previous").click()
    pg.wait_for_function("document.querySelector('#tour-main h1')?.innerText.includes('Review the decision brief')")
    check("tour: Previous goes back", True)
    pg.get_by_role("button", name=re.compile("Step 9 of 9")).click()
    pg.wait_for_function("document.querySelector('#tour-main h1')?.innerText.includes('The final takeaway')")
    pg.get_by_role("button", name="Start again").first.click()
    pg.wait_for_function("document.querySelector('#tour-main h1')?.innerText.includes('The challenge')")
    check("tour: Start again returns to step 1", "Step 1 of 9" in main_text(pg))
    pg.get_by_role("button", name="Skip to analysis").click()
    pg.wait_for_url("**/app/analysis**")
    pg.wait_for_selector("#step-title")
    check("tour: Skip to analysis opens Farm Analysis on the demonstration farm", pg.get_by_label("Latitude").input_value() == "32.93")
    pg.goto(f"{BASE}/app/demo?step=4", wait_until="networkidle")
    pg.get_by_role("link", name=re.compile("^Exit")).click()
    pg.wait_for_url(re.compile(r"/app/?$"))
    check("tour: Exit demo returns to the workspace", True)

    # ------------------------------------------------------------ the other two farms: different data shapes
    for pid, facts in [("sheikhupura", "irrigated, flat index, no NDVI check"), ("ames_iowa", "two-year cycle, frost")]:
        e = quick_analysis(pg, pid)
        check(f"{pid}: live run equals the reference output", e["result"] == saved(pid))
        before = len(errors)
        for tab_id in ["climate", "season", "resilience", "water", "soil", "location"]:
            pg.goto(f"{BASE}/app/insights?tab={tab_id}", wait_until="networkidle")
            pg.wait_for_timeout(700)
            panel = norm(pg.locator("#insight-panel").inner_text())
            check(f"{pid}: {tab_id} renders ({facts})", len(panel) > 200 and "NaN" not in panel and "undefined" not in panel and "Something went wrong" not in panel, panel[:200])
            shot(pg, f"{pid}_{tab_id}")
        pg.goto(f"{BASE}/app/brief", wait_until="networkidle")
        pg.wait_for_timeout(900)
        t = main_text(pg)
        check(f"{pid}: brief renders", BRIEF_DISCLAIMER in t and "NaN" not in t and "undefined" not in t)
        check(f"{pid}: no browser errors", len(errors) == before, errors[before:before + 3])
        if e["result"]["validation"]["ndvi_check"] is None:
            check(f"{pid}: missing NDVI check is stated, not invented", "NDVI check: not available" in norm(pg.goto(f"{BASE}/app/insights") and pg.locator("main").inner_text() or ""))

    # ------------------------------------------------------------ storage that refuses to save
    blocked = b.new_context(viewport={"width": 1280, "height": 800})
    blocked.add_init_script("""
      const real = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) {
        if (this === window.localStorage) throw new DOMException('quota', 'QuotaExceededError');
        return real.call(this, k, v);
      };
    """)
    bp = blocked.new_page()
    berr: list[str] = []
    bp.on("pageerror", lambda e: berr.append(str(e)))
    bp.goto(f"{BASE}/app/insights", wait_until="networkidle")
    bp.locator('[data-quick-preset="chakwal"]').click()
    bp.wait_for_selector('[aria-label="Analysis being interpreted"]', timeout=180_000)
    bp.goto(f"{BASE}/app/analyses", wait_until="networkidle")
    bp.wait_for_timeout(500)
    t = norm(bp.locator("main").inner_text())
    check("storage full: the user is told, and the app keeps working", "Analyses are not being saved on this device" in t and not berr, (t[:300], berr))
    blocked.close()

    # ------------------------------------------------------------ phone width
    quick_analysis(pg, "chakwal")
    phone = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True, storage_state=ctx.storage_state())
    mp = phone.new_page()
    merr: list[str] = []
    mp.on("pageerror", lambda e: merr.append(str(e)))
    mp.goto(f"{BASE}/app/insights", wait_until="networkidle")
    session = pg.evaluate("sessionStorage.getItem('hindsight.workspace.v1')")
    mp.evaluate("v => sessionStorage.setItem('hindsight.workspace.v1', v)", session)
    for path in ["/app", "/app/insights", "/app/insights?tab=season", "/app/insights?tab=resilience", "/app/insights?tab=water", "/app/insights?tab=soil",
                 "/app/insights?tab=location", "/app/scenarios", "/app/brief", "/app/analyses", "/app/science", "/app/analysis?step=priorities",
                 "/app/demo", "/app/demo?step=3", "/app/demo?step=5", "/app/demo?step=6", "/app/demo?step=8", "/app/demo?step=9", "/"]:
        mp.goto(BASE + path, wait_until="networkidle")
        mp.wait_for_timeout(900)
        over = overflow(mp)
        check(f"phone (390 px): {path} has no sideways scroll", over <= 1, f"{over}px")
        if SHOTS:
            SHOTS.mkdir(parents=True, exist_ok=True)
            mp.screenshot(path=str(SHOTS / ("m_" + re.sub(r"[^a-z0-9]+", "_", path.lower()).strip("_") + ".png")), full_page=True)
    check("phone: no page errors", not merr, merr[:3])
    phone.close()

    check("no failed API calls", not api_failures, api_failures[:5])
    check("no browser errors", not errors, errors[:5])
    b.close()

print("\n".join(LOG))
print(f"\n{len(LOG) - len(FAILED)} passed, {len(FAILED)} failed")
sys.exit(1 if FAILED else 0)
