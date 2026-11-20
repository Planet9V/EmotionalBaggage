"""Print, as JSON, the Python packages the planner installs and their transitive dependencies.

Reads planner/requirements.txt, then walks each package's own installed metadata
(importlib.metadata), evaluating environment markers and requested extras, so the
list is what is actually installed here, not what anyone remembers.

Called by scripts/notices.mjs. Exit code 3 with a message on stderr when a
requirement is not installed (the caller decides what to do about that).
"""
import json
import re
import sys
from importlib import metadata

try:
    from packaging.requirements import Requirement
    from packaging.utils import canonicalize_name
except ImportError:  # pip vendors packaging; use it when the standalone one is absent
    from pip._vendor.packaging.requirements import Requirement  # type: ignore
    from pip._vendor.packaging.utils import canonicalize_name  # type: ignore


def licence_of(dist):
    """The licence as the package declares it, and where that came from."""
    md = dist.metadata
    expr = (md.get("License-Expression") or "").strip()
    if expr:
        return expr, "License-Expression"
    lic = (md.get("License") or "").strip()
    # Some packages put the whole licence text in this field; only a short one-line value is an identifier.
    if lic and "\n" not in lic and len(lic) <= 80 and lic.upper() != "UNKNOWN":
        return lic, "License"
    classifiers = [c.split("::")[-1].strip() for c in (md.get_all("Classifier") or []) if c.startswith("License ::")]
    if classifiers:
        return " AND ".join(sorted(set(classifiers))) + " (classifier)", "Classifier"
    return "UNKNOWN", "none"


def home_of(dist):
    md = dist.metadata
    if md.get("Home-page"):
        return md.get("Home-page").strip()
    urls = {}
    for entry in md.get_all("Project-URL") or []:
        label, _, url = entry.partition(",")
        urls[label.strip().lower()] = url.strip()
    for key in ("homepage", "home", "source", "source code", "repository", "documentation"):
        if key in urls:
            return urls[key]
    return next(iter(sorted(urls.values())), "")


def licence_files(dist):
    out = []
    for f in dist.files or []:
        name = str(f).rsplit("/", 1)[-1].upper()
        if re.match(r"^(LICEN[CS]E|COPYING|NOTICE)", name):
            out.append(str(f))
    return sorted(out)


def main(requirements_path):
    top = []
    with open(requirements_path, encoding="utf8") as fh:
        for line in fh:
            line = line.split("#", 1)[0].strip()
            if line:
                top.append(Requirement(line))

    seen = {}  # canonical name -> record
    queue = [(r, None) for r in top]
    missing = []
    while queue:
        req, parent = queue.pop(0)
        key = canonicalize_name(req.name)
        try:
            dist = metadata.distribution(req.name)
        except metadata.PackageNotFoundError:
            missing.append(req.name)
            continue
        rec = seen.get(key)
        if rec is None:
            lic, lic_source = licence_of(dist)
            rec = {
                "name": dist.metadata["Name"],
                "version": dist.version,
                "license": lic,
                "licenseSource": lic_source,
                "home": home_of(dist),
                "licenseFiles": licence_files(dist),
                "direct": parent is None,
                "requiredBy": [],
                "extras": [],
            }
            seen[key] = rec
        if parent is None:
            rec["direct"] = True
        elif parent not in rec["requiredBy"]:
            rec["requiredBy"].append(parent)
        new_extras = [e for e in sorted(req.extras) if e not in rec["extras"]]
        rec["extras"].extend(new_extras)
        # Walk dependencies: base ones the first time we see the package, extra ones when an extra is new.
        first_visit = not rec.get("_walked")
        rec["_walked"] = True
        for dep in dist.requires or []:
            d = Requirement(dep)
            if d.marker is None:
                if first_visit:
                    queue.append((d, rec["name"]))
                continue
            extras_now = ([""] if first_visit else []) + new_extras
            if any(d.marker.evaluate({"extra": e}) for e in extras_now):
                queue.append((d, rec["name"]))

    if missing:
        print("not installed: " + ", ".join(sorted(set(missing))), file=sys.stderr)
        sys.exit(3)

    out = []
    for rec in seen.values():
        rec.pop("_walked", None)
        rec["requiredBy"] = sorted(rec["requiredBy"], key=str.lower)
        rec["extras"] = sorted(rec["extras"])
        out.append(rec)
    out.sort(key=lambda r: canonicalize_name(r["name"]))
    json.dump({"python": sys.version.split()[0], "packages": out}, sys.stdout, indent=1, sort_keys=True)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "planner/requirements.txt")
