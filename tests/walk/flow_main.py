import os
WALK = os.environ.get("WALK_DIR", os.path.dirname(os.path.abspath(__file__)))
exec(open(WALK + "/flow.py").read())
exec(open(WALK + "/flow_handlers.py").read())

def done():
    camp = [i for i in items("marketing/campaigns") if i["data"].get("kind") != "plan"]
    jobs = items("prototype/printing")
    return camp, jobs

with sync_playwright() as p:
    br = p.chromium.launch(channel="chrome", args=["--no-sandbox"])
    ctx = br.new_context(viewport={"width": 1440, "height": 900})
    pg = ctx.new_page()
    errors = []
    pg.on("console", lambda m: errors.append(m.text[:200]) if m.type == "error" else None)
    pg.goto(B + "/sign-in"); pg.get_by_label("Username").fill("demo"); pg.get_by_label("Password").fill("demo")
    pg.get_by_role("button", name="Sign in").click(); pg.wait_for_url(lambda u: "sign-in" not in u)
    pg.goto(f"{B}/?concept={PID}"); pg.wait_for_timeout(2500)
    seen_queued = False
    last = None; same = 0
    for step in range(200):
        # a row opened from ?item= sits in a dialog over the page: close it, as a person would, before the next step
        if pg.get_by_role("dialog").count(): pg.keyboard.press("Escape"); pg.wait_for_timeout(500)
        link = pg.locator("[data-testid=next-step-link], [data-testid=next-step-card] a").first
        link.wait_for(timeout=20000)
        pg.wait_for_timeout(700)
        label = link.inner_text().strip(); href = link.get_attribute("href")
        log(f"[{step}] NEXT: {label}  ->  {href}   (on {pg.url.replace(B, '')})")
        same = same + 1 if (label, href) == last else 0
        last = (label, href)
        if same >= 2:
            pg.screenshot(path=f"{SH}-stuck.png", full_page=True); log("     SAME STEP THREE TIMES; stopping"); break
        link.click(); pg.wait_for_timeout(2500)
        anchor = href.split("#")[1] if "#" in href else None
        if anchor:
            found = pg.locator(f"#{anchor}").count()
            log(f"     anchor #{anchor}: {'found' if found else 'NOT FOUND'}")
        if "?item=" in href:
            log(f"     row opened: {'yes' if pg.get_by_role('dialog').count() else 'no dialog'}")
        camp, jobs = done()
        if any(j["status"] == "queued" for j in jobs): seen_queued = True
        h = next((f for r, f in HANDLERS if r.search(label)), None)
        if not h:
            pg.screenshot(path=f"{SH}-stuck.png", full_page=True)
            log("     NO HANDLER; stopping"); break
        h(pg, label, href)
        # fixes made through the API are not in the page's cache: read the page again (UI fixes are already shown)
        pg.reload(); pg.wait_for_timeout(1500)
        camp, jobs = done()
        if any(j["status"] == "queued" for j in jobs): seen_queued = True
        if camp and seen_queued and not globals().get("reached"):
            globals()["reached"] = True
            log("REACHED: approved campaign plan", [c["title"] for c in camp], "and a queued print job was seen (walk goes on to the end of Marketing)")
        if label.startswith("Advance to Sales"):
            log("END OF MARKETING: the next step is", label); break
    pg.screenshot(path=f"{SH}-end.png", full_page=True)
    log("console errors:", errors[:10])
    br.close()
