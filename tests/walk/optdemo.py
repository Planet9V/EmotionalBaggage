import os
WALK = os.environ.get("WALK_DIR", os.path.dirname(os.path.abspath(__file__)))
import sys, re, requests as rq; sys.path.insert(0,'.')
exec(open(WALK + "/flow_handlers.py").read().split("@on")[0]) if False else None
from api import *
from playwright.sync_api import sync_playwright
import struct
a=Api(); configure(a)
EX="baggage-claims"
def stl():
    tri=[((0,0,0),(10,0,0),(0,10,0)),((0,0,0),(0,10,0),(0,0,10)),((0,0,0),(0,0,10),(10,0,0)),((10,0,0),(0,10,0),(0,0,10))]
    out=b"\0"*80+struct.pack("<I",len(tri))
    for t in tri: out+=struct.pack("<3f",0,0,0)+b"".join(struct.pack("<3f",*v) for v in t)+b"\0\0"
    return out
pr=[x for x in a.get("/api/admin/printers")[1]["printers"] if x["name"]=="Walk printer"][0]
r=a.s.post(f"{B}/api/projects/{EX}/files", files={"file":("clamshell.stl",stl(),"model/stl")}, data={"kind":"stl"}, headers={"content-type":None}); f=r.json().get("file") or r.json()
a.patch("/api/items/60", {"data":{"fileId":f["id"],"fileName":"clamshell.stl","printerId":pr["id"],"printerName":pr["name"],"printerMaker":"Bambu Lab","printerModel":"A1","material":"PLA","layerHeight":0.2,"infill":15,"supports":False}}, ok=200)
print("slice before:", a.post("/api/print-jobs/60/slice", {})[0])
SH="shots/opt"
with sync_playwright() as p:
    br=p.chromium.launch(channel="chrome",args=["--no-sandbox"]); pg=br.new_page(viewport={"width":1440,"height":900})
    pg.goto(B+"/sign-in"); pg.get_by_label("Username").fill("demo"); pg.get_by_label("Password").fill("demo")
    pg.get_by_role("button", name="Sign in").click(); pg.wait_for_url(lambda u: "sign-in" not in u)
    pg.goto(f"{B}/optimise?concept={EX}"); pg.wait_for_timeout(2500)
    pg.screenshot(path=f"{SH}-0-before.png", full_page=True)
    for act in ["Propose cheaper substitutes","Check the design for assembly","Propose faster print settings"]:
        pg.get_by_role("button", name=act).click(); pg.wait_for_timeout(4000)
    pg.screenshot(path=f"{SH}-1-proposed.png", full_page=True)
    print(pg.locator("main").inner_text()[:2500])
    # approve every waiting proposal on the page
    for _ in range(10):
        b=pg.locator("article[data-draft]").get_by_role("button", name=re.compile(r"^Approve")).first
        if not b.count(): break
        b.click(); pg.wait_for_timeout(800)
        c=pg.get_by_role("button", name="Approve and remove the price")
        if c.count():
            pg.screenshot(path=f"{SH}-2-price-warning.png"); c.click()
        pg.wait_for_timeout(1500)
    print("job status after approval:", a.get(f"/api/projects/{EX}/items?section=prototype/printing")[1]["items"][1]["status"])
    rq.post(f"http://127.0.0.1:{PORT_BASE + 5}/api/job", json={"command":"cancel"})
    print("slice after:", a.post("/api/print-jobs/60/slice", {})[0])
    pg.reload(); pg.wait_for_timeout(2500)
    pg.screenshot(path=f"{SH}-3-after.png", full_page=True)
    print(pg.locator("main").inner_text()[:2500])
    br.close()
