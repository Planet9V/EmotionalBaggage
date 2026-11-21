@on(r"^Add \d+ more brief lines?")
def brief(pg, label, href):
    n = 3 - len(items("concept/brief"))
    for i in range(n):
        pg.locator("#add-row").click(); pg.wait_for_timeout(500)
        d = pg.get_by_role("dialog")
        d.get_by_label(re.compile("^Title")).first.fill(["Who it is for: people who work at a desk", "The problem: cables fall behind the desk", "Why now: more people work from home"][i % 3])
        d.get_by_role("button", name=re.compile("^(Add|Save)")).last.click(); pg.wait_for_timeout(1200)

@on(r"go/no-go question as the first decision|^Decide \"")
def decide(pg, label, href):
    ds = items("concept/decisions")
    if not ds:
        st, j = a.post(f"/api/projects/{PID}/items", {"section": "concept/decisions", "title": "Build the first prototype?", "data": {"key": "go", "parent": "", "options": [{"id": "yes", "label": "Go", "outcome": "Build it"}, {"id": "no", "label": "Stop", "outcome": "Stop here"}]}, "status": "open"}, ok=201)
        ds = [j["item"]]
    a.patch(f"/api/items/{ds[0]['id']}", {"data": {"chosen": "yes"}, "status": "decided"}, ok=200)
    log("     (API) decision added and decided")

@on(r"^Mark .*(in Open questions|open questions?) as")
def questions(pg, label, href):
    for q in items("concept/questions"):
        if q["status"] in ("open", "blocked"): status(q["id"], "decided")
    log("     (API) questions settled")

@on(r"^Add \d+ more claims?")
def claim(pg, label, href):
    pg.locator("#add-row").click(); pg.wait_for_timeout(500)
    d = pg.get_by_role("dialog")
    d.get_by_label(re.compile("^Title")).first.fill("Cables falling behind desks is a common nuisance")
    d.get_by_role("button", name=re.compile("^(Add|Save)")).last.click(); pg.wait_for_timeout(1200)

@on(r"^Verify ")
def verify(pg, label, href):
    # Research, Ask with the claim: ask, then judge the first source as supporting it (UI)
    c = [x for x in items("research/claims") if x["status"] != "verified"][0]
    if "/s/research/ask" not in pg.url:
        log("     the link did not open Research, Ask: going there by hand"); pg.goto(f"{B}/s/research/ask?ask={c['title']}&claim={c['id']}&item={c['id']}"); pg.wait_for_timeout(2000)
    pg.get_by_role("button", name="Ask").click(); pg.wait_for_timeout(3500)
    pg.get_by_role("button", name="Use as evidence").first.click(); pg.wait_for_timeout(400)
    pg.get_by_label(re.compile("^Supports")).first.check()
    pg.get_by_role("button", name="Save evidence").click(); pg.wait_for_timeout(1500)
    log("     (UI) asked from Verify this, judged the first source as supporting; claim now", [x["status"] for x in items("research/claims")])

@on(r"^Draft (Requirements|Bill of materials|Acceptance tests|Personas|Names and taglines|Ads|Landing page|Amazon listing|Social|Launch email and press note|Campaigns) with AI")
def draft(pg, label, href):
    approve_all_dialog(pg, label)
    log("     (UI) Draft with AI, approved all")

@on(r"^Mark .*(in Requirements|requirements?) as")
def reqs(pg, label, href):
    for r in items("design/requirements"):
        if r["status"] in ("open", "blocked"): status(r["id"], "done")
    log("     (API) requirements moved to done")

@on(r"(in Sourcing|parts?) to in hand")
def sourcing(pg, label, href):
    # The walk's concept is a printed product: its first part is printed on your own printer, as a person would set it
    # (the print checks apply only when a part is to be printed, U2); the rest are bought and in hand.
    rows = items("design/bom")
    for n, r in enumerate(rows):
        if n == 0: a.patch(f"/api/items/{r['id']}", {"status": "to print", "data": {"source": "Own printer"}}, ok=200)
        elif r["status"] not in ("in hand", "to print"): status(r["id"], "in hand")
    log("     (API) first part to print on your own printer, the rest in hand")

@on(r"^Advance to ")
def advance(pg, label, href):
    b = pg.get_by_role("button", name=re.compile("^" + re.escape(label)))
    b.first.click(); pg.wait_for_timeout(2000)
    log("     (UI) pressed", label)

def stl_bytes():
    import struct
    tri = [((0,0,0),(10,0,0),(0,10,0)), ((0,0,0),(0,10,0),(0,0,10)), ((0,0,0),(0,0,10),(10,0,0)), ((10,0,0),(0,10,0),(0,0,10))]
    out = b"\0" * 80 + struct.pack("<I", len(tri))
    for t in tri:
        out += struct.pack("<3f", 0, 0, 0) + b"".join(struct.pack("<3f", *v) for v in t) + b"\0\0"
    return out

@on(r"^Set up a print job")
def print_job(pg, label, href):
    st, pr = a.get("/api/admin/printers")
    printer = [x for x in pr["printers"] if x["name"] == "Walk printer"][0]
    r = a.s.post(f"{B}/api/projects/{PID}/files", files={"file": ("clip.stl", stl_bytes(), "model/stl")}, data={"kind": "stl"}, headers={"content-type": None})
    assert r.status_code in (200, 201), r.text
    f = r.json().get("file") or r.json()
    st, j = a.post(f"/api/projects/{PID}/items", {"section": "prototype/printing", "title": "Cable clip", "status": "queued", "data": {"fileId": f["id"], "fileName": "clip.stl", "printerId": printer["id"], "printerName": printer["name"], "printerMaker": "Bambu Lab", "printerModel": "A1", "material": "PLA", "layerHeight": 0.2, "infill": 15, "supports": False}}, ok=201)
    log("     (API) print job set up, status", j["item"]["status"])

@on(r'^Move "?.*"? (in 3D printing|print jobs?) to done')
def printed(pg, label, href):
    for job in items("prototype/printing"):
        if job["status"] == "done": continue
        jid = job["id"]
        a.post(f"/api/print-jobs/{jid}/slice", {}, ok=200)
        st, plan = a.get(f"/api/print-jobs/{jid}/plan", ok=200)
        conf = {"printer": plan["printer"]["name"], "file": plan["send"]["name"]}
        # the printer stand-in keeps its state between walks: make it idle (as finishing the last print would)
        requests_mod = __import__("requests"); requests_mod.post(f"http://127.0.0.1:{PORT_BASE + 5}/api/job", json={"command": "cancel"})
        a.post(f"/api/print-jobs/{jid}/send", {"confirm": conf}, ok=200)
        a.post(f"/api/print-jobs/{jid}/start", {"confirm": conf}, ok=200)
        a.post(f"/api/print-jobs/{jid}/result", {"outcome": "good", "photoFileIds": []}, ok=200)
    log("     (API) sliced, sent, started and recorded as good:", [j["status"] for j in items("prototype/printing")])

@on(r'^Move .* (in Acceptance tests|acceptance tests?) to pass')
def tests_pass(pg, label, href):
    for t in items("prototype/tests"):
        if t["status"] != "pass": status(t["id"], "pass")
    log("     (API) tests moved to pass")

@on(r"^Add a build|^Pass the build")
def build(pg, label, href):
    keys = [t["data"].get("key") for t in items("prototype/tests") if t["data"].get("key")]
    bs = items("prototype/builds")
    if not bs:
        st, j = a.post(f"/api/projects/{PID}/items", {"section": "prototype/builds", "title": "Works-like", "data": {"criteria": [{"text": "Holds a cable", "met": True}], "tests": keys}, "status": "planned"}, ok=201)
        bs = [j["item"]]
    a.patch(f"/api/items/{bs[0]['id']}", {"status": "passed"}, ok=200)
    log("     (API) build added and passed, linked tests", keys)

@on(r"^Add a cost line")
def econ(pg, label, href):
    a.post(f"/api/projects/{PID}/items", {"section": "production/economics", "title": "Packaging", "data": {"kind": "packaging", "amount": 0.4}, "status": "estimate"}, ok=201)
    log("     (API) cost line added")

@on(r"^Plan a batch")
def batch(pg, label, href):
    a.post(f"/api/projects/{PID}/items", {"section": "production/batches", "title": "First batch", "data": {"units": 100, "targetDate": "2027-03-01"}, "status": "planned"}, ok=201)
    log("     (API) batch planned")

@on(r"^Decide every compliance row|^Draft the compliance checklist")
def compliance(pg, label, href):
    rows = items("production/compliance")
    if not rows:
        a.post(f"/api/projects/{PID}/items", {"section": "production/compliance", "title": "General product safety", "status": "applies"}, ok=201)
    for r in rows:
        if r["status"] in ("to check", "draft"): status(r["id"], "applies")
    log("     (API) compliance decided")

@on(r"^Price every part")
def priced(pg, label, href):
    if not items("production/suppliers"):
        a.post(f"/api/projects/{PID}/items", {"section": "production/suppliers", "title": "Local print shop", "data": {"code": "SHOP1", "url": "https://example.com"}, "status": "approved"}, ok=201)
    for p in items("design/bom"):
        a.patch(f"/api/items/{p['id']}", {"data": {"unit": 1.5, "supplier": "SHOP1", "line": 1.5}}, ok=200)
    log("     (API) parts priced, supplier set")

@on(r"^Complete the economics|^Add a sales channel")
def channel(pg, label, href):
    if not items("sales/channels"):
        a.post(f"/api/projects/{PID}/items", {"section": "sales/channels", "title": "Own web shop", "data": {"price": 19, "platformPercent": 0, "paymentPercent": 3, "paymentFixed": 0.3, "fulfilment": 3, "returnsPercent": 2, "adCost": 2}, "status": "planned"}, ok=201)
    log("     (API) sales channel added")

SECTION_OF = {"Personas": "marketing/personas", "Competitors": "marketing/competitors", "Pricing": "marketing/pricing", "Brand kit": "marketing/brand", "Ads": "marketing/ads", "Landing page": "marketing/landing", "Social": "marketing/social", "Launch email and press note": "marketing/announce", "Names and taglines": "concept/names"}

@on(r'^(Approve|Choose) "(.+)" in (.+)$')
def approve_row(pg, label, href):
    m = re.match(r'^(Approve|Choose) "(.+)" in (.+)$', label)
    verb, title, sec = m.groups()
    want = "approved" if verb == "Approve" else "chosen"
    if sec == "Ads":
        return ad_rule(pg, f'Write the stop and scale rule for "{title}", then approve it', href)
    # on the page: the row's own button
    card = pg.locator("article, li, tr, [data-item-id]").filter(has_text=title).last
    btn = card.get_by_role("button", name=re.compile(r"^(Approve|Choose|Mark chosen)", re.I))
    sel = pg.get_by_label(f"Status of {title}")
    if sel.count():
        sel.first.select_option(want); pg.wait_for_timeout(1500)
        log(f"     (UI) status {want} chosen on \"{title}\"")
    elif btn.count():
        btn.first.click(); pg.wait_for_timeout(1500)
        log(f"     (UI) pressed {btn.first.inner_text() if btn.count() else verb} on \"{title}\"")
    target = [r for r in items(SECTION_OF[sec]) if r["title"] == title]
    if target and target[0]["status"] != want:
        st, j = a.patch(f"/api/items/{target[0]['id']}", {"status": want})
        log(f"     (API) status {want}: {st} {str(j)[:200] if st != 200 else ''}")

@on(r"^Research competitors and alternatives")
def competitors(pg, label, href):
    pg.locator("#research-competitors").click(); pg.wait_for_timeout(600)
    if MODE.get("shortQuestion", False):
        # the running build drops every row of a question over 300 characters (fixed in the source; see the report)
        pg.get_by_label("The question that will be sent").fill("What do buyers use instead of a desk cable clip? Name, price, claim and weakness, with sources.")
    pg.get_by_role("button", name="Ask Perplexity (billed)").click(); pg.wait_for_timeout(6000)
    approve_all_dialog(pg, label)
    log("     (UI) asked Perplexity from Competitors, approved the drafted rows:", [(r["title"], r["data"].get("basis"), r["data"].get("priceMinor")) for r in items("marketing/competitors")])

@on(r"^Draft the positioning with AI")
def positioning(pg, label, href):
    approve_all_dialog(pg, label); log("     (UI) positioning drafted and approved as a draft row")

@on(r"^Ask the reviewer to attack the positioning")
def attack(pg, label, href):
    pg.get_by_role("button", name=re.compile("^Ask the reviewer to attack it|^Ask again")).first.click(); pg.wait_for_timeout(3000)
    log("     (UI) reviewer asked")

@on(r"^Approve the positioning")
def approve_pos(pg, label, href):
    card = pg.locator("li[id^=positioning-], li").filter(has_text="Positioning line").first
    card.get_by_role("button", name=re.compile("^Approve")).first.click(); pg.wait_for_timeout(1500)
    log("     (UI) positioning approved:", [r["status"] for r in items("marketing/positioning")])

@on(r"^Add a price to consider")
def price(pg, label, href):
    f = pg.locator("#add-price")
    f.get_by_role("textbox").first.fill("19.00"); f.get_by_role("button", name="Add price").click(); pg.wait_for_timeout(1500)
    log("     (UI) price added:", [(r["title"], r["status"]) for r in items("marketing/pricing")])

@on(r"^Set up the brand kit")
def brand(pg, label, href):
    pg.locator("#brand-kit").click(); pg.wait_for_timeout(1500)
    log("     (UI) brand kit set up")

@on(r"^Draft (the )?(Names and taglines|Ads|Landing page|Amazon listing|Social|Launch email and press note) with AI|^Draft a campaign plan with AI")
def draft2(pg, label, href):
    approve_all_dialog(pg, label)
    log("     (UI) Draft with AI, approved all")

@on(r"^Set .* in Campaigns")
def budget(pg, label, href):
    c = pg.locator("#campaign-budget")
    c.get_by_label(re.compile("^Total marketing budget")).fill("2000")
    c.get_by_label(re.compile("^Monthly marketing budget")).fill("500")
    c.get_by_label(re.compile("^Share of the margin")).fill("40")
    c.get_by_label(re.compile("^Judge a campaign after")).fill("3")
    c.get_by_role("button", name=re.compile("^Save")).click(); pg.wait_for_timeout(1500)
    log("     (UI) budget saved")

@on(r"^Start a launch plan from a template")
def launch(pg, label, href):
    pg.locator("input[name=template]").first.check()
    pg.locator("input[type=date]").first.fill("2027-04-01")
    pg.get_by_role("button", name=re.compile("^Start")).first.click(); pg.wait_for_timeout(2000)
    log("     (UI) launch started:", len(items("marketing/launch")), "steps")

@on(r"^Make a tracked link")
def link(pg, label, href):
    # since the hardening, a link may only open a host on the plan's allow-list (Campaigns, plan card)
    plan = next((i for i in items("marketing/campaigns") if i["data"].get("kind") == "plan"), None)
    if plan and "example.com" not in (plan["data"].get("linkHosts") or []):
        a.patch(f"/api/items/{plan['id']}", {"data": {"linkHosts": ["example.com"]}}, ok=200)
        log("     (API) example.com added to the plan's link hosts")
        pg.reload(); pg.wait_for_timeout(1500)
    f = pg.locator("#new-link")
    f.get_by_label("Page it goes to").fill("https://example.com/clip")
    f.get_by_label(re.compile("^Source")).fill("meta")
    f.get_by_role("button").last.click(); pg.wait_for_timeout(2000)
    log("     (UI) tracked link made")

@on(r"^Enter a campaign's results")
def results(pg, label, href):
    pg.locator("#enter-results").click(); pg.wait_for_timeout(500)
    pg.get_by_label("Day").fill("2027-04-02"); pg.get_by_label(re.compile(r"^Spend")).fill("50"); pg.get_by_label(re.compile(r"^Revenue")).fill("57")
    pg.get_by_label("Impressions").fill("5000"); pg.get_by_label("Clicks").fill("120"); pg.get_by_label("Orders").fill("3")
    pg.get_by_role("button", name=re.compile("^Save")).last.click(); pg.wait_for_timeout(2000)
    log("     (UI) a day of results entered")


@on(r"^Write the stop and scale rule for \"(.+)\"")
def ad_rule(pg, label, href):
    title = re.match(r'^Write the stop and scale rule for "(.+)", then', label).group(1)
    card = pg.locator(f"article[aria-label=\"{title}\"]")
    card.get_by_label("The rule, in a sentence").fill("Stop when an order costs more than 8 after 24 spent; scale below 5.")
    card.get_by_label(re.compile("^Highest cost per order")).fill("8")
    card.get_by_label(re.compile("^Least spend before judging")).fill("24")
    card.get_by_role("button", name="Save changes").click(); pg.wait_for_timeout(1500)
    sel = pg.locator("article").first.locator("select[aria-label^='Status of']")
    if not sel.is_enabled():
        log("     the saved card stays locked (running build has defect D3): reloading"); pg.reload(); pg.wait_for_timeout(2500)
        sel = pg.locator("article").first.locator("select[aria-label^='Status of']")
    sel.select_option("approved"); pg.wait_for_timeout(1500)
    log("     (UI) rule written and ad approved:", [(r["title"][:30], r["status"]) for r in items("marketing/ads")][:3])

@on(r"^Write the press release and mark it reviewed")
def press(pg, label, href):
    approve_all_dialog(pg, label); log("     (UI) press release drafted and approved as a row")

@on(r'^Mark "(.+)" reviewed or final in Press release')
def press_reviewed(pg, label, href):
    d = pg.get_by_role("dialog")
    sel = d.get_by_label(re.compile("^Status")) if d.count() else None
    if sel is not None and sel.count():
        sel.first.select_option("reviewed"); pg.wait_for_timeout(500)
        b = d.get_by_role("button", name=re.compile("^Save"))
        if b.count(): b.first.click(); pg.wait_for_timeout(1500)
        log("     (UI) press release marked reviewed in the row editor")
    for r in items("concept/press"):
        if r["status"] not in ("reviewed", "final"): status(r["id"], "reviewed"); log("     (API) press release marked reviewed")
