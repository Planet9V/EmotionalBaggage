import os
WALK = os.environ.get("WALK_DIR", os.path.dirname(os.path.abspath(__file__)))
import json, requests
# the app under test: npm run walk sets WALK_BASE (scripts/walk.mjs)
B = os.environ.get("WALK_BASE", "http://127.0.0.1:3378")
class Api:
    def __init__(self):
        self.s = requests.Session()
        self.s.headers.update({"origin": B, "content-type": "application/json"})
        r = self.s.post(B + "/api/auth/sign-in", data=json.dumps({"username": "demo", "password": "demo"}))
        assert r.status_code == 200, r.text
    def call(self, method, path, body=None, ok=None):
        r = self.s.request(method, B + path, data=None if body is None else json.dumps(body))
        try: j = r.json()
        except Exception: j = r.text
        if ok is not None and r.status_code not in (ok if isinstance(ok, (list, tuple)) else [ok]):
            raise AssertionError(f"{method} {path} -> {r.status_code}: {str(j)[:400]}")
        return r.status_code, j
    def get(self, p, **k): return self.call("GET", p, **k)
    def post(self, p, b=None, **k): return self.call("POST", p, b, **k)
    def patch(self, p, b=None, **k): return self.call("PATCH", p, b, **k)
    def put(self, p, b=None, **k): return self.call("PUT", p, b, **k)
    def delete(self, p, b=None, **k): return self.call("DELETE", p, b, **k)

def configure(a, models=True, pplx=True, slicer=True, printer=True):
    if models:
        a.put("/api/admin/settings", {"reasoningModel": {"provider": "ollama", "baseUrl": "http://127.0.0.1:3410/v1", "model": "walk-chat"}, "embeddingModel": {"provider": "ollama", "baseUrl": "http://127.0.0.1:3410/v1", "model": "walk-embed", "dims": 8}}, ok=200)
    if pplx:
        a.put("/api/admin/credentials/perplexity", {"fields": {"apiKey": "pplx-walk-key-0001"}}, ok=200)
    if slicer:
        a.put("/api/admin/settings", {"slicerUrl": "http://127.0.0.1:3416"}, ok=200)
    if printer:
        st, j = a.get("/api/admin/printers")
        if not any(p["name"] == "Walk printer" for p in j["printers"]):
            a.post("/api/admin/printers", {"name": "Walk printer", "family": "octoprint", "model": "Bambu Lab A1", "access": {"address": "http://127.0.0.1:3415", "apiKey": "walk-octo-key"}}, ok=201)
