"""Draw the link-preview banner (frontend/public/social/hindsight-preview.jpg, 1200 x 630).

The chart on the banner is real: days above 35 °C in each year of the NASA POWER record for the
Chakwal demonstration farm, read from the API's saved demonstration result. Nothing is invented.

Needs Playwright with Chrome:  python scripts/make_social_preview.py [output.jpg]"""
import sys
from pathlib import Path

from fastapi.testclient import TestClient
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from backend.api import app  # noqa: E402

PUBLIC = ROOT / "frontend" / "public"
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else PUBLIC / "social" / "hindsight-preview.jpg"
MARK = "M29 29H14.5L0 14.5h14.5zm0-14.5H14.5L0 0h14.5z"  # frontend/public/logo/hindsight-mark.svg

env = TestClient(app).get("/api/demo/chakwal").json()
climate = env["context"]["climate"]
years = climate["years"]
hot = climate["annual"]["hot_days"]
threshold = climate["thresholds"]["hot_day_c"]
late_from = env["result"]["meta"]["windows"]["late"][0]
top = max(hot)
bars = "".join(
    f'<i class="{"late" if y >= late_from else "early"}" style="height:{max(3.0, v / top * 100):.1f}%"></i>'
    for y, v in zip(years, hot)
)

HTML = f"""<!doctype html><html><head><meta charset="utf-8"><style>
@font-face {{ font-family: Outfit; src: url("{(PUBLIC / 'fonts' / 'Outfit-Variable.woff2').as_uri()}"); font-weight: 100 900; }}
@font-face {{ font-family: Nunito; src: url("{(PUBLIC / 'fonts' / 'Nunito-Variable.woff2').as_uri()}"); font-weight: 200 1000; }}
* {{ box-sizing: border-box; margin: 0; }}
body {{ width: 1200px; height: 630px; overflow: hidden; position: relative; background: #1c3a2a; color: #fffdf9; font-family: Nunito, sans-serif; }}
.glow {{ position: absolute; right: -180px; top: -220px; width: 900px; height: 900px; border-radius: 50%;
  background: radial-gradient(closest-side, rgba(238,243,132,.20), rgba(238,243,132,.06) 55%, rgba(238,243,132,0) 100%); }}
.ring {{ position: absolute; right: -150px; bottom: -330px; width: 760px; height: 760px; border-radius: 50%; background: #25483a; }}
.brand {{ position: absolute; left: 72px; top: 54px; display: flex; align-items: center; gap: 16px; font-family: Outfit; font-weight: 600; font-size: 40px; letter-spacing: -0.02em; }}
.brand svg {{ width: 42px; height: 42px; }}
h1 {{ position: absolute; left: 72px; top: 140px; width: 640px; font-family: Outfit; font-weight: 600; font-size: 98px; line-height: .98; letter-spacing: -0.04em; }}
h1 b {{ font-weight: 600; color: #eef384; }}
.sub {{ position: absolute; left: 72px; top: 358px; width: 560px; font-size: 31px; line-height: 1.32; font-weight: 600; color: #b8c7bf; }}
.sub b {{ color: #fffdf9; font-weight: 800; }}
.foot {{ position: absolute; left: 72px; bottom: 54px; display: flex; gap: 8px; }}
.foot span {{ padding: 8px 15px; border-radius: 999px; background: rgba(255,253,249,.09); box-shadow: inset 0 0 0 1.5px rgba(255,253,249,.16); font-size: 19.5px; font-weight: 800; color: #fffdf9; }}
.foot span.on {{ background: #eef384; color: #1c3a2a; box-shadow: none; }}
.card {{ position: absolute; left: 716px; top: 282px; width: 412px; height: 282px; border-radius: 34px; background: #fffdf9; color: #1c3a2a;
  padding: 26px 28px 22px; box-shadow: 0 30px 60px -20px rgba(0,0,0,.45); display: flex; flex-direction: column; }}
.card small {{ font-size: 15px; font-weight: 900; letter-spacing: .09em; text-transform: uppercase; color: #6e6b65; }}
.card strong {{ margin-top: 3px; font-family: Outfit; font-weight: 600; font-size: 27px; letter-spacing: -0.02em; }}
.bars {{ margin-top: 16px; flex: 1; display: flex; align-items: flex-end; gap: 3px; border-bottom: 2px solid #e2dfd8; }}
.bars i {{ flex: 1; border-radius: 3px 3px 0 0; }}
.bars i.early {{ background: #8aa396; }}
.bars i.late {{ background: #1c3a2a; }}
.axis {{ margin-top: 8px; display: flex; justify-content: space-between; font-size: 15px; font-weight: 800; color: #6e6b65; }}
.axis em {{ font-style: normal; display: flex; align-items: center; gap: 6px; }}
.axis em::before {{ content: ""; width: 11px; height: 11px; border-radius: 3px; background: #8aa396; }}
.axis em.late::before {{ background: #1c3a2a; }}
.mascot {{ position: absolute; left: 812px; top: -4px; width: 330px; height: 330px; }}
</style></head><body>
<div class="glow"></div><div class="ring"></div>
<div class="brand"><svg viewBox="0 0 29 29"><path fill="#eef384" d="{MARK}"/></svg>HindSight</div>
<h1>Look back at <b>your land.</b></h1>
<p class="sub">Replay <b>40 years of NASA weather</b> on your field and compare crop rotations side by side.</p>
<div class="foot"><span class="on">Open Earth data</span><span>NASA POWER</span><span>MODIS</span><span>SoilGrids</span></div>
<div class="card">
  <small>Chakwal, Pakistan · NASA POWER</small>
  <strong>Days above {threshold:g} °C each year</strong>
  <div class="bars">{bars}</div>
  <div class="axis"><em>{years[0]}–{late_from - 1}</em><em class="late">{late_from}–{years[-1]}</em></div>
</div>
<img class="mascot" src="{(PUBLIC / 'mascots' / 'mascot-blue.png').as_uri()}" alt="">
</body></html>"""

OUT.parent.mkdir(parents=True, exist_ok=True)
page_file = OUT.with_suffix(".html")
page_file.write_text(HTML, encoding="utf-8")
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=True)
        page = browser.new_page(viewport={"width": 1200, "height": 630}, device_scale_factor=1)
        page.goto(page_file.as_uri())
        page.evaluate("document.fonts.ready")
        page.wait_for_function("document.querySelector('.mascot').complete && document.fonts.check('600 98px Outfit')")
        page.screenshot(path=str(OUT), type="jpeg", quality=90)
        browser.close()
finally:
    page_file.unlink(missing_ok=True)
print(f"wrote {OUT} ({OUT.stat().st_size / 1024:.0f} KB), {len(years)} years {years[0]}-{years[-1]}")
