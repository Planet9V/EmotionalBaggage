"""The slicer service: a thin HTTP wrapper around the OrcaSlicer command line.

    POST /slice   multipart: file (.stl or .3mf), maker, model, material, layer_height, infill, supports
    GET  /jobs/{id}/gcode | /project | /statistics
    GET  /profiles, GET /health

OrcaSlicer is a separate program in this container. The app talks to it only over HTTP; no OrcaSlicer code is linked into the app.
"""
from __future__ import annotations

import os
import re
import shutil
import tempfile
import threading
import time
import uuid
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse

from . import orca, profiles

ROOT = Path(os.environ.get("ORCA_PROFILES", "/opt/orca/profiles"))
WORK = Path(os.environ.get("SLICER_WORKDIR", Path(tempfile.gettempdir()) / "slicer-jobs"))
TTL_S = int(os.environ.get("SLICER_TTL_S", "3600"))
MAX_BYTES = int(os.environ.get("SLICER_MAX_BYTES", str(100 * 1024 * 1024)))
LOCK = threading.Semaphore(int(os.environ.get("SLICER_CONCURRENCY", "1")))  # one slice at a time: OrcaSlicer uses every core it is given
ORCA_VERSION = os.environ.get("ORCA_VERSION", "unknown")

app = FastAPI(title="slicer", version="1")
TABLE = profiles.load_table()
JOB_ID = re.compile(r"^[0-9a-f]{32}$")
KINDS = {"gcode": "gcode", "project": "project", "statistics": "statistics"}


def sweep() -> None:
    WORK.mkdir(parents=True, exist_ok=True)
    now = time.time()
    for d in WORK.iterdir():
        try:
            if d.is_dir() and now - d.stat().st_mtime > TTL_S:
                shutil.rmtree(d, ignore_errors=True)
        except OSError:
            pass


@app.get("/health")
def health() -> dict:
    ok = Path(orca.ORCA_BIN).exists()
    return {"ok": True, "slicerInstalled": ok, "orcaVersion": ORCA_VERSION, "profiles": TABLE["orca"], "profileRootPresent": ROOT.exists()}


@app.get("/profiles")
def list_profiles() -> dict:
    return {"orca": TABLE["orca"], "materials": TABLE["materials"], "printers": profiles.catalogue(TABLE)}


def _safe_stem(name: str) -> str:
    stem = re.sub(r"[^A-Za-z0-9._ -]+", "_", Path(name or "model").stem).strip(" ._") or "model"
    return stem[:80]


@app.post("/slice")
async def slice_(
    file: UploadFile = File(...),
    maker: str = Form(...),
    model: str = Form(...),
    material: str = Form("PLA"),
    layer_height: float = Form(0.2),
    infill: int = Form(15),
    supports: bool = Form(False),
) -> dict:
    ext = Path(file.filename or "").suffix.lower()
    if ext not in (".stl", ".3mf"):
        raise HTTPException(422, "Send an .stl or .3mf file.")
    if not 0 <= infill <= 100:
        raise HTTPException(422, "Infill is a percentage from 0 to 100.")
    try:
        res = profiles.resolve(TABLE, ROOT, maker, model, material, layer_height)
    except profiles.ProfileError as e:
        raise HTTPException(e.status, e.message)
    data = await file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(413, f"The file is larger than {MAX_BYTES // (1024 * 1024)} MB.")
    if not data:
        raise HTTPException(422, "The file is empty.")
    sweep()
    job = uuid.uuid4().hex
    jobdir = WORK / job
    jobdir.mkdir(parents=True)
    src = jobdir / f"model{ext}"
    src.write_bytes(data)
    stem = _safe_stem(file.filename or "model")

    def work() -> dict:
        with LOCK:
            return orca.slice_job(src, jobdir, res.machine, res.process, res.filament, orca.Settings(infill, supports))

    try:
        out = await run_in_threadpool(work)
    except orca.SliceError as e:
        shutil.rmtree(jobdir, ignore_errors=True)
        raise HTTPException(e.status, e.message)
    r: orca.Reading = out["reading"]
    (jobdir / "names.txt").write_text(stem)
    return {
        "id": job,
        "orca": {"version": ORCA_VERSION, "profileCommit": TABLE["orca"]["commit"]},
        "profile": {"machine": res.machine_name, "process": res.process_name, "filament": res.filament_name, "note": res.note},
        "settings": {"layerHeight": layer_height, "infill": infill, "supports": supports, "material": material.upper()},
        "result": {
            "seconds": round(r.seconds, 1),
            "filamentMm": round(r.filament_mm, 2),
            "filamentG": round(r.filament_g, 2),
            "filamentCm3": round(r.filament_cm3, 2),
            "supportG": None if r.support_g is None else round(r.support_g, 2),
            "layers": r.layers,
            "readFrom": r.source,
        },
        "warnings": out["warnings"],
        "files": {
            "gcode": {"name": f"{stem}.gcode", "url": f"/jobs/{job}/gcode"},
            "project": {"name": f"{stem}.gcode.3mf", "url": f"/jobs/{job}/project"} if out["project"] else None,
            "statistics": {"name": f"{stem}.statistics.json", "url": f"/jobs/{job}/statistics"} if out["statistics"] else None,
        },
        "expiresInSeconds": TTL_S,
    }


@app.get("/jobs/{job}/{kind}")
def job_file(job: str, kind: str):
    if not JOB_ID.match(job) or kind not in KINDS:
        raise HTTPException(404, "No such file.")
    out = WORK / job / "out"
    path = {"gcode": out / "plate_1.gcode", "project": out / "sliced.3mf", "statistics": out / "plate_1.statistics.json"}[kind]
    if not path.exists():
        raise HTTPException(404, "That result has expired or was never made.")
    stem = (WORK / job / "names.txt").read_text() if (WORK / job / "names.txt").exists() else "model"
    suffix = {"gcode": ".gcode", "project": ".gcode.3mf", "statistics": ".statistics.json"}[kind]
    return FileResponse(path, filename=f"{stem}{suffix}")


@app.delete("/jobs/{job}")
def delete_job(job: str) -> dict:
    if not JOB_ID.match(job):
        raise HTTPException(404, "No such job.")
    shutil.rmtree(WORK / job, ignore_errors=True)
    return {"ok": True}
