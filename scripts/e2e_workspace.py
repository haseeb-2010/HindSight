"""End-to-end check of the analysis workspace in a real browser.

Needs both servers running (API on :8000, frontend on :5173) and Playwright with Chrome:
    python scripts/e2e_workspace.py [--shots DIR] [--custom]
--custom also runs a real custom-location analysis (downloads weather from NASA POWER).
Exits non-zero if any check fails."""
import json
import sys
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

sys.stdout.reconfigure(encoding="utf-8")
BASE = "http://127.0.0.1:5173"
ARGS = sys.argv[1:]
SHOTS = Path(ARGS[ARGS.index("--shots") + 1]) if "--shots" in ARGS else None
CUSTOM = "--custom" in ARGS
FAILED: list[str] = []
LOG: list[str] = []


def check(name, ok, detail=""):
    LOG.append(f"{'PASS' if ok else 'FAIL'}  {name}{'  ' + str(detail) if detail and not ok else ''}")
    if not ok:
        FAILED.append(name)


def shot(pg, name):
    if SHOTS:
        SHOTS.mkdir(parents=True, exist_ok=True)
        pg.screenshot(path=str(SHOTS / f"{name}.png"), full_page=True)


def cont(pg):
    pg.locator("main button", has_text="Continue").or_(pg.locator("main button", has_text="Review settings")).first.click()
    pg.wait_for_timeout(450)


def run_and_wait(pg):
    with pg.expect_request(lambda r: r.url.endswith("/api/analyze") and r.method == "POST") as req:
        pg.get_by_role("button", name="Analyse My Farm").click()
    body = json.loads(req.value.post_data)
    pg.wait_for_selector("#results-title", timeout=240_000)
    pg.wait_for_timeout(700)
    return body


def open_tab(pg, label):
    pg.get_by_role("tab", name=label).click()
    pg.wait_for_timeout(500)


def demo_farm(pg, pid, place, expect_soil, expect_water, expect_rotation, errors):
    pg.goto(f"{BASE}/app/analysis?step=field", wait_until="networkidle")
    pg.get_by_role("button", name=f"Select {place}").click()
    pg.wait_for_timeout(300)
    check(f"{pid}: coordinates populated", pg.get_by_label("Latitude").input_value() != "" and pg.get_by_label("Longitude").input_value() != "")
    shot(pg, f"{pid}_1_field")
    cont(pg)
    check(f"{pid}: soil texture populated", pg.get_by_label("Soil texture").input_value() == expect_soil, pg.get_by_label("Soil texture").input_value())
    check(f"{pid}: water mode populated", pg.locator(f"input[name='water-mode']:checked").locator("xpath=..").inner_text().startswith(expect_water))
    pg.wait_for_selector("text=What the model works out from this")
    pg.wait_for_timeout(900)
    shot(pg, f"{pid}_2_soil")
    cont(pg)
    pg.wait_for_selector("text=Your rotation through the year")
    pg.wait_for_timeout(900)
    check(f"{pid}: rotation populated", expect_rotation in pg.locator("main").inner_text(), expect_rotation)
    shot(pg, f"{pid}_3_rotation")
    cont(pg)
    return errors


with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome", headless=True)
    ctx = b.new_context(viewport={"width": 1440, "height": 900}, accept_downloads=True)
    pg = ctx.new_page()
    errors: list[str] = []
    pg.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
    pg.on("console", lambda m: errors.append(f"console: {m.text}") if m.type == "error" else None)

    # 1-3: homepage -> workspace
    pg.goto(BASE + "/", wait_until="networkidle")
    pg.get_by_role("link", name="Explore Your Field").first.click()
    pg.wait_for_url("**/app/analysis**")
    pg.wait_for_selector("#step-title")
    check("homepage CTA opens the Farm Analysis workspace", "Let’s start with your field." in pg.locator("#step-title").inner_text())

    # 4-5: Chakwal
    demo_farm(pg, "chakwal", "Chakwal", "loam", "Rainfed", "Wheat then bare fallow", errors)
    # 6: change a priority (Water conservation 3 -> 5) with the keyboard
    slider = pg.get_by_label("Water conservation weight")
    slider.focus()
    slider.press("ArrowRight"); slider.press("ArrowRight")
    pg.wait_for_timeout(200)
    check("priority slider moved to 5", slider.input_value() == "5", slider.input_value())
    shot(pg, "chakwal_4_priorities")
    cont(pg)
    shot(pg, "chakwal_5_scenario")
    cont(pg)
    pg.wait_for_selector("text=Everything ready?")
    pg.wait_for_timeout(600)
    shot(pg, "chakwal_6_review")
    # 7-8: run
    body = run_and_wait(pg)
    check("request carries the changed priority", body["priorities"]["water_use"] == 5 and body["priorities"]["stability"] == 4, body["priorities"])
    check("request built from the selected farm", body["location"]["preset_id"] == "chakwal" and body["current_rotation"]["slots"][0]["crop_id"] == "wheat")
    text = pg.locator("main").inner_text()
    check("results show live calculation and period", "Live calculation" in text and "1985–2024" in text and "Engine v0.3.0" in text)
    shot(pg, "chakwal_7_overview")
    env = pg.evaluate("JSON.parse(sessionStorage.getItem('hindsight.workspace.v1')).history[0].envelope")
    rots = env["result"]["rotations"]
    check("engine response stored with current rotation first", rots[0]["is_current"] and len(rots) >= 3, len(rots))
    cur = rots[0]
    check("overview shows the engine's failure frequency", f"{cur['hindcast']['failure_freq'] * 100:.1f}%" in text)
    # 9: comparison
    open_tab(pg, "Compare rotations")
    t = pg.locator("#results-panel").inner_text()
    check("comparison lists every returned rotation", all(r["name"].replace(" (current)", "") in t for r in rots))
    check("comparison shows rank ranges and Pareto", "Rainfall robustness range" in t and "Pareto efficient" in t)
    shot(pg, "chakwal_8_compare")
    # 11-12: details
    open_tab(pg, "Rotation details")
    t = pg.locator("#results-panel").inner_text()
    check("details show annual index chart and worst years", "not observed crop yield" in t and "struggled most" in t and "Season index (S)" in t)
    check("details list the engine's worst years", all(str(y) in t or "–" in t for y in cur["hindcast"]["worst_years"]["years"]))
    shot(pg, "chakwal_9_details")
    # 10: climate
    open_tab(pg, "Climate trends")
    t = pg.locator("#results-panel").inner_text()
    check("climate windows are 1985–2004 and 2005–2024", "1985–2004" in t and "2005–2024" in t)
    check("climate shows all six indicators", all(s["label"] in t for s in env["result"]["climate_shift"]))
    shot(pg, "chakwal_10_climate")
    # 13: evidence
    open_tab(pg, "Why these rotations")
    t = pg.locator("#results-panel").inner_text()
    top = sorted((r for r in rots if not r["is_current"]), key=lambda r: r["scores"]["rank"])[0]
    check("evidence shows the engine explanation", top["explanation"]["summary"] in t and top["explanation"]["gaps"][0] in t and top["explanation"]["local_review"][0] in t)
    shot(pg, "chakwal_11_evidence")
    # 14: provenance
    open_tab(pg, "Data & validation")
    t = pg.locator("#results-panel").inner_text()
    check("provenance and NDVI check shown", "r = 0.59" in t and all(pv["item"] in t for pv in env["result"]["provenance"]))
    shot(pg, "chakwal_12_data")

    # 18: exports
    pg.get_by_role("button", name="Export").click()
    with pg.expect_download() as d:
        pg.get_by_role("menuitem", name="Download analysis (JSON)").click()
    exported = json.loads(Path(d.value.path()).read_text(encoding="utf-8"))
    check("JSON export is the full engine response", exported["result"] == env["result"] and exported["request"]["priorities"]["water_use"] == 5)
    pg.get_by_role("button", name="Export").click()
    with pg.expect_download() as d:
        pg.get_by_role("menuitem", name="Rotation comparison (CSV)").click()
    csv_text = Path(d.value.path()).read_text(encoding="utf-8")
    rows = [ln for ln in csv_text.splitlines() if ln and not ln.startswith("#")]
    check("CSV export has one row per rotation", len(rows) == len(rots) + 1 and rows[0].startswith("rank,rotation"), len(rows))

    # 15-17: modify settings, stale banner, rerun, new results reflect the new request
    pg.get_by_role("button", name="Edit settings").click()
    pg.wait_for_selector("text=Everything ready?")
    pg.get_by_role("button", name="Edit Historical scenario").click()
    pg.wait_for_selector("text=What if historical conditions had been different?")
    rain = pg.get_by_label("Rainfall as a percentage of the recorded amount")
    rain.focus()
    for _ in range(4):
        rain.press("ArrowLeft")
    check("rainfall scenario set to 80%", rain.input_value() == "80", rain.input_value())
    pg.goto(f"{BASE}/app/analysis?step=results", wait_until="networkidle")
    pg.wait_for_selector("#results-title")
    check("stale results are flagged", "These results are from your previous settings." in pg.locator("main").inner_text())
    shot(pg, "chakwal_13_stale")
    with pg.expect_request(lambda r: r.url.endswith("/api/analyze") and r.method == "POST") as req:
        pg.get_by_role("button", name="Rerun analysis").click()
    body2 = json.loads(req.value.post_data)
    pg.wait_for_selector("text=What-if: rainfall 80%", timeout=120_000)
    pg.wait_for_timeout(600)
    t = pg.locator("main").inner_text()
    env2 = pg.evaluate("JSON.parse(sessionStorage.getItem('hindsight.workspace.v1')).history[0].envelope")
    check("rerun sent the scenario", body2["scenario"]["precip_factor"] == 0.8)
    check("new results reflect the new request", "These results are from your previous settings." not in t and "not a climate forecast" in t
          and env2["result"]["site"]["climate_summary"]["annual_rain_mm"] < env["result"]["site"]["climate_summary"]["annual_rain_mm"])
    shot(pg, "chakwal_14_scenario_results")

    # 19-20: the other two demonstration farms
    for pid, place, soil, water, rot in [("sheikhupura", "Sheikhupura", "silt_loam", "Full irrigation", "Cotton then Wheat"),
                                         ("ames_iowa", "Ames", "silty_clay_loam", "Rainfed", "Y1: Maize · Y2: Soybean")]:
        demo_farm(pg, pid, place, soil, water, rot, errors)
        cont(pg); cont(pg)
        pg.wait_for_selector("text=Everything ready?")
        body = run_and_wait(pg)
        e = pg.evaluate("JSON.parse(sessionStorage.getItem('hindsight.workspace.v1')).history[0].envelope")
        saved = json.loads((Path(__file__).resolve().parents[1] / f"backend/data/saved/{pid}_response.json").read_text(encoding="utf-8"))
        check(f"{pid}: untouched farm reproduces the saved engine output", e["result"] == saved)
        check(f"{pid}: at least three rotations", len(e["result"]["rotations"]) >= 3)
        shot(pg, f"{pid}_7_overview")
        open_tab(pg, "Compare rotations"); shot(pg, f"{pid}_8_compare")
        open_tab(pg, "Data & validation")
        t = pg.locator("#results-panel").inner_text()
        if e["result"]["validation"]["ndvi_check"] is None:
            check(f"{pid}: null NDVI check handled", "Not available for this analysis" in t and "r = 0" not in t)
        else:
            check(f"{pid}: NDVI check shown", f"r = {e['result']['validation']['ndvi_check']['r']:.2f}" in t)
        shot(pg, f"{pid}_12_data")

    # Custom location with SoilGrids unavailable
    pg.route("**/api/soil/lookup", lambda r: r.fulfill(status=200, content_type="application/json", body=json.dumps({
        "status": "unavailable", "profile": None, "lat": 31.42, "lon": 73.08, "source_label": "SoilGrids — 250 m soil data",
        "message": "SoilGrids did not answer just now. You can enter the soil yourself and carry on.", "depth_note": ""})))
    pg.goto(f"{BASE}/app/analysis?step=field", wait_until="networkidle")
    pg.get_by_label("Latitude").fill("95")
    check("invalid latitude is rejected in the form", "Latitude must be a number between −90 and 90." in pg.locator("main").inner_text())
    pg.get_by_label("Latitude").fill("31.42"); pg.get_by_label("Longitude").fill("73.08")
    pg.wait_for_timeout(500)
    check("custom coordinates accepted", "Custom field selected" in pg.locator("main").inner_text())
    check("map shows a marker", pg.locator(".hs-pin").count() == 1)
    pg.locator(".leaflet-container").click(position={"x": 300, "y": 180})
    pg.wait_for_timeout(500)
    check("clicking the map updates the coordinates", pg.get_by_label("Latitude").input_value() != "31.42")
    pg.get_by_label("Latitude").fill("31.42"); pg.get_by_label("Longitude").fill("73.08")
    pg.get_by_label("Field name").fill("Test field near Faisalabad")
    pg.wait_for_timeout(700)
    shot(pg, "custom_1_field")
    cont(pg)
    pg.wait_for_selector("text=SoilGrids did not answer just now")
    check("SoilGrids-unavailable state allows manual soil", pg.get_by_label("Soil texture").is_enabled())
    pg.get_by_label("Soil texture").select_option("clay_loam")
    pg.wait_for_timeout(800)
    shot(pg, "custom_2_soil")
    cont(pg)
    check("empty rotation blocks continuing", pg.locator("main button", has_text="Continue").is_disabled())
    pg.get_by_role("button", name="Add a crop to year 1").click()
    pg.wait_for_timeout(900)
    pg.get_by_role("button", name="Add a crop to year 1").click()
    pg.wait_for_timeout(1200)
    shot(pg, "custom_3_rotation")
    check("rotation preview comes from the engine", "Checking" not in pg.locator("main").inner_text() and pg.locator("main button", has_text="Continue").is_enabled())
    if CUSTOM:
        pg.unroute("**/api/soil/lookup")
        cont(pg); cont(pg); cont(pg)
        pg.wait_for_selector("text=Everything ready?")
        body = run_and_wait(pg)
        e = pg.evaluate("JSON.parse(sessionStorage.getItem('hindsight.workspace.v1')).history[0].envelope")
        check("custom field analysed with real NASA POWER weather", e["source"] == "live" and e["preset_id"] is None and len(e["result"]["rotations"]) >= 2
              and e["result"]["site"]["soil_used"]["texture_class"] == "clay_loam", (e["source"], len(e["result"]["rotations"])))
        check("custom field: NDVI unavailable is explained", e["result"]["validation"]["ndvi_check"] is None and "No MODIS NDVI series" in e["inputs"]["ndvi"]["reason"])
        shot(pg, "custom_7_overview")
        open_tab(pg, "Data & validation"); shot(pg, "custom_12_data")

    check("no browser errors", not errors, errors[:5])
    b.close()

print("\n".join(LOG))
print(f"\n{len(LOG) - len(FAILED)} passed, {len(FAILED)} failed")
sys.exit(1 if FAILED else 0)
