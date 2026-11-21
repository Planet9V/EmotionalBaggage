import os
WALK = os.environ.get("WALK_DIR", os.path.dirname(os.path.abspath(__file__)))
# F1 walk: on a blank concept, follow ONLY the next-step link from each page (never the sidebar) until an
# approved campaign plan and a queued print job exist. Fixes are done on the page each link opens; where a
# fix is made through the app's own API from that page (marked API), the report says so.
import json, re, sys, time
from playwright.sync_api import sync_playwright
sys.path.insert(0, WALK)
from api import Api, configure, B

SH = WALK + "/shots/flow"
LOG = []
a = Api(); configure(a)
MODE = json.load(open(WALK + "/flow-mode.json")) if len(sys.argv) > 1 else {}

open(WALK + "/flow.log", "w").close()
def log(*x):
    s = " ".join(str(v) for v in x); LOG.append(s); print(s, flush=True)
    with open(WALK + "/flow.log", "a") as f: f.write(s + "\n")

# a blank concept: a name, a one-line description and a product type, nothing else
st, j = a.post("/api/projects", {"name": "Flow probe " + time.strftime("%H%M%S"), "oneLiner": "A clip that keeps a cable from falling behind the desk", "productType": "printed"}, ok=201)
PID = j["project"]["id"]
log("concept", PID)

def items(section):
    st, j = a.get(f"/api/projects/{PID}/items?section={section}")
    return j["items"]

def approve_all_dialog(pg, label):
    pg.locator("#draft-with-ai").click(); pg.wait_for_timeout(800)
    d = pg.get_by_role("dialog")
    if not d.get_by_role("button", name=re.compile(r"^Approve all \d+")).count():
        run = d.locator("section[aria-label=Run] button").filter(has_text=re.compile(r"^(?!Cancel|Retry|Keep).*")).last
        if run.count(): run.click(timeout=5000); pg.wait_for_timeout(3500)
    txt = d.inner_text()
    ab = d.get_by_role("button", name=re.compile(r"^Approve all \d+"))
    if ab.count():
        ab.first.click(); pg.wait_for_timeout(500)
        pg.get_by_role("button", name="Approve all", exact=True).last.click(); pg.wait_for_timeout(2500)
    else:
        one = d.locator("article[data-draft]").get_by_role("button", name=re.compile(r"^Approve"))
        if one.count():
            one.first.click(); pg.wait_for_timeout(800)
            ask = d.get_by_role("button", name="Approve and remove the price")
            if ask.count(): ask.click()
            pg.wait_for_timeout(2000)
        else:
            log("   no Approve all; dialog said:", txt[:500].replace("\n", " | "))
    pg.keyboard.press("Escape"); pg.wait_for_timeout(600)

def status(id, s): a.patch(f"/api/items/{id}", {"status": s}, ok=200)

HANDLERS = []
def on(pattern):
    def deco(f): HANDLERS.append((re.compile(pattern), f)); return f
    return deco
