import { createRequire } from "module";

// \0rolldown/runtime.js
var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) {
		__defProp(target, name, {
			get: all[name],
			enumerable: true
		});
	}
	if (!no_symbols) {
		__defProp(target, Symbol.toStringTag, { value: "Module" });
	}
	return target;
};

// vendor/casemaker/casemaker-app/src/types/snap.ts
/**
* Relief (mm) each variant adds to the cut. `undefined` (no fit set) resolves
* to the 'tight' rung — the as-designed number — so a project that never
* chose a fit compiles exactly as it did before #153.
*/
const FIT_RELIEF_MM = {
	tight: 0,
	standard: .1,
	loose: .25
};
/** Added relief (mm) for a fit variant; `undefined` = 0 (legacy, 'tight'). */
function fitRelief(fit) {
	return FIT_RELIEF_MM[fit ?? "tight"];
}
/**
* PLA-default cantilever snap-fit dimensions (issue #29). See docs/snap-fit.md
* for the strain derivation.
*/
const SNAP_DEFAULTS = {
	armLength: 6,
	armThickness: 1.6,
	armWidth: 6,
	barbProtrusion: .8,
	barbLength: 2,
	pocketDepth: .8,
	pocketWidth: 7,
	pocketHeight: 4
};

// vendor/casemaker/casemaker-app/src/types/badge.ts
/**
* The one assertion the oracle script makes (`make_badge.py:33-34`), as a
* check rather than a crash: the pocket has to sit wholly inside the bottom
* colour, or the colour change would cut through the pocket roof.
*
* Returns a human-readable reason, or `null` when the parameters are sound.
*/
function badgeParamsProblem(b) {
	if (!(b.thickness > 0)) return "the badge thickness must be positive";
	if (!(b.splitHeight > 0)) return "the colour split height must be positive";
	if (b.splitHeight >= b.thickness) return `the colour split (${b.splitHeight} mm) must be below the thickness (${b.thickness} mm) — nothing would be left for the top colour`;
	const p = b.magnetPocket;
	if (!p) return null;
	if (!(p.depth > 0)) return "the magnet pocket depth must be positive, or the pocket should be null";
	if (p.depth >= b.splitHeight) return `the magnet pocket (${p.depth} mm deep) would break through the colour split (${b.splitHeight} mm) — its roof must stay in the bottom colour`;
	if (p.length >= b.width - 2 || p.width >= b.height - 2) return `the magnet pocket (${p.length} × ${p.width} mm) is too big for the badge (${b.width} × ${b.height} mm) — the oracle keeps 1 mm of wall per side`;
	return null;
}

// vendor/casemaker/casemaker-app/src/types/blank.ts
/**
* Why these parameters will not make a blank, or `null` when they will.
*
* Mirrors `badgeParamsProblem`: the panel states the reason rather than the
* compiler throwing out of a render (#280's "no dialog can caliper a blank"
* cousin — a hand-edited project should say what is wrong, not go blank).
*/
function blankParamsProblem(b) {
	if (!(b.width > 0)) return "the blank width must be positive";
	if (!(b.height > 0)) return "the blank height must be positive";
	if (!(b.thickness > 0)) return "the blank thickness must be positive";
	if (b.cornerRadius < 0) return "the blank corner radius cannot be negative";
	if (b.cornerRadius >= Math.min(b.width, b.height) / 2) return `the corner radius (${b.cornerRadius} mm) is too big for a ${b.width} × ${b.height} mm blank — it must be under half the shorter side`;
	return null;
}

// vendor/casemaker/casemaker-app/src/types/toolbox.ts
/** Height of the registration foot, mm — how far a module nests into the one
*  below, and how deep the receiving ledge sits below the rim. */
const TOOLBOX_FOOT_H = 12;
/** Inset of the foot's OUTER face from the module's outer face, mm. */
const TOOLBOX_FOOT_INSET = 3.3;
/** Inset of the foot's INNER (cavity) face from the module's outer face, mm. */
const TOOLBOX_FOOT_CAVITY_INSET = 6.3;
/**
* The smallest plan a module can have, mm, exterior.
*
* The foot's cavity is `TOOLBOX_FOOT_CAVITY_INSET` in from each edge, and the
* seating ledge reaches a further `TOOLBOX_LEDGE_W` in — below twice their sum
* there is no cavity left for the module above's foot to land in.
*/
const TOOLBOX_MIN_PLAN = 24.6;
/**
* The shortest buildable module, mm.
*
* The outward flare that turns the foot into the full-width box takes
* `TOOLBOX_FOOT_INSET` of height, and the foot itself takes `TOOLBOX_FOOT_H`;
* below their sum there is no box left above the foot.
*/
const TOOLBOX_MIN_HEIGHT = 15.3;
/**
* Inset of the nearest socket EDGE from the module's outer face, mm.
*
* The floor grid must not break into the foot's wall — the two features share
* the floor, and a socket under the wall would leave it overhanging a notch. A
* socket is only safe once its whole outline clears the foot's cavity face by
* `TOOLBOX_GRID_GAP`.
*
* Measured to the EDGE, which is what `HoleGridOptions.margin` means; that
* function adds half a socket itself before placing centres. The effective
* inset is therefore unchanged from the old centre-measured constant (this plus
* half a socket), so the lattice sits exactly where it used to.
*/
const TOOLBOX_GRID_MARGIN = 7.3;
/**
* Why these parameters will not make a module, or `null` when they will.
*
* Mirrors `blankParamsProblem`: the panel states the reason rather than the
* compiler throwing out of a render, so a hand-edited or migrated project says
* what is wrong instead of going silently blank.
*
* This is the ONLY predicate — `buildToolboxNodes` consults it rather than
* repeating the limits, so a size that reports a reason is exactly a size that
* will not build.
*/
function toolboxParamsProblem(p) {
	if (!(p.width > 0)) return "the toolbox width must be positive";
	if (!(p.depth > 0)) return "the toolbox depth must be positive";
	if (!(p.height > 0)) return "the toolbox height must be positive";
	if (p.width < 24.6) return `the toolbox width (${p.width} mm) is too narrow — the walls, the registration foot and the seating ledge need ${TOOLBOX_MIN_PLAN} mm`;
	if (p.depth < 24.6) return `the toolbox depth (${p.depth} mm) is too narrow — the walls, the registration foot and the seating ledge need ${TOOLBOX_MIN_PLAN} mm`;
	if (p.height < 15.3) return `the toolbox height (${p.height} mm) is too short — the registration foot alone is ${12} mm, so it needs at least ${TOOLBOX_MIN_HEIGHT} mm`;
	return null;
}

// vendor/casemaker/casemaker-app/src/types/stackConnector.ts
/**
* Pad material left between the wall and the channel floor, mm. It is what
* the seam notch is cut into, so the notch never reaches the case wall.
*/
const STACK_BACKING = 1.2;
/** How far the socket pad stands proud of the wall, mm. */
const STACK_PAD_PROUD = 4.2;
/** Extra length of the long key between its two halves, mm. */
const STACK_LONG_REACH = 16;
/** Free length past the key's end in the storage channel and the pocket, mm. */
const STACK_END_PLAY = .5;
/** How far the key's web stands proud of the pad face — the grip, mm. */
const STACK_WEB_PROUD = 1.5;
/** How far the bump's tip reaches past the key's floor-side face, mm. */
const STACK_BUMP = .8;
/** Length of the bump's flat tip along the key, mm. */
const STACK_BUMP_TIP = .8;
const STACK_NOTCH_FLAT = .6;
/**
* Sliding clearance per engagement face at the 'tight' rung, mm. Ours and
* UNPRINTED: it is the gap a 0.4 mm nozzle reliably leaves between two
* printed faces that must slide, not a measurement. PROVISIONAL until the
* `stack-connector` fit coupon has been printed and read.
*
* The fit ladder's relief (`FIT_RELIEF_MM`) is added to it ON THE KEY, the
* reverse of the snap catches' "relief goes on the cut": a socket is part of
* a finished case, a key is a 2 g reprint, so one socket must serve every key
* — exactly how the reviewed system ships its loose slider.
*/
const STACK_SLIDE_CLEARANCE = .15;
/** Key length for a variant, mm. */
function stackKeyLength(variant) {
	return 24 + (variant === "long" ? 16 : 0);
}

// vendor/casemaker/casemaker-app/src/types/antenna.ts
const ANTENNA_SPECS = {
	internal: {
		holeDiameter: 0,
		counterboreDiameter: 0
	},
	"rpi-external": {
		holeDiameter: 9,
		counterboreDiameter: 12
	},
	"external-mount": {
		holeDiameter: 6.4,
		counterboreDiameter: 9
	}
};

// vendor/casemaker/casemaker-app/src/engine/compiler/profile.ts
/** Closed polygon from a point ring. */
function poly(points) {
	return {
		kind: "p-poly",
		contours: [points]
	};
}
/** Axis-aligned rectangle; bbox-min at the origin unless `center`. */
function rectProfile(width, height, center = false) {
	return {
		kind: "p-rect",
		size: [width, height],
		center
	};
}
function circleProfile(radius, segments) {
	return {
		kind: "p-circle",
		radius,
		segments
	};
}
/**
* Rectangle with all four corners rounded to `radius`, as a real arc rather
* than a union of corner cylinders. Origin convention matches `rectProfile`:
* bbox-min at (0, 0), body out to (width, height).
*/
function roundedRect(width, height, radius) {
	const r = Math.min(radius, width / 2, height / 2);
	if (r <= 0) return rectProfile(width, height);
	return pOffset(pTranslate([r, r], rectProfile(width - 2 * r, height - 2 * r)), r, "round");
}
function pUnion(children) {
	return {
		kind: "p-union",
		children
	};
}
function pDifference(children) {
	return {
		kind: "p-difference",
		children
	};
}
function pIntersection(children) {
	return {
		kind: "p-intersection",
		children
	};
}
function pOffset(child, delta, join = "round", opts = {}) {
	return {
		kind: "p-offset",
		child,
		delta,
		join,
		...opts
	};
}
function pTranslate(offset, child) {
	return {
		kind: "p-translate",
		offset,
		child
	};
}
function pRotate(degrees, child) {
	return {
		kind: "p-rotate",
		degrees,
		child
	};
}
/**
* Conservative 2D bounds. Over-covers but never under-covers, matching
* `aabbOfOp`'s contract — negative offsets keep the un-shrunk box rather than
* guessing how far a concave region actually pulls in.
*/
function aabbOfProfile(p) {
	switch (p.kind) {
		case "p-poly": {
			let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
			for (const contour of p.contours) for (const [x, y] of contour) {
				if (x < minX) minX = x;
				if (y < minY) minY = y;
				if (x > maxX) maxX = x;
				if (y > maxY) maxY = y;
			}
			return minX === Infinity ? null : {
				min: [minX, minY],
				max: [maxX, maxY]
			};
		}
		case "p-rect": {
			const [w, h] = p.size;
			return p.center ? {
				min: [-w / 2, -h / 2],
				max: [w / 2, h / 2]
			} : {
				min: [0, 0],
				max: [w, h]
			};
		}
		case "p-circle": return {
			min: [-p.radius, -p.radius],
			max: [p.radius, p.radius]
		};
		case "p-union":
		case "p-hull": {
			let out = null;
			for (const c of p.children) {
				const b = aabbOfProfile(c);
				if (!b) continue;
				out = out ? mergeAabb2(out, b) : b;
			}
			return out;
		}
		case "p-difference": return p.children[0] ? aabbOfProfile(p.children[0]) : null;
		case "p-intersection": {
			let out = null;
			for (const c of p.children) {
				const b = aabbOfProfile(c);
				if (!b) continue;
				if (!out) out = b;
				else out = {
					min: [Math.max(out.min[0], b.min[0]), Math.max(out.min[1], b.min[1])],
					max: [Math.min(out.max[0], b.max[0]), Math.min(out.max[1], b.max[1])]
				};
			}
			return out;
		}
		case "p-offset": {
			const b = aabbOfProfile(p.child);
			if (!b) return null;
			const g = Math.max(p.delta, 0);
			return {
				min: [b.min[0] - g, b.min[1] - g],
				max: [b.max[0] + g, b.max[1] + g]
			};
		}
		case "p-translate": {
			const b = aabbOfProfile(p.child);
			if (!b) return null;
			const [dx, dy] = p.offset;
			return {
				min: [b.min[0] + dx, b.min[1] + dy],
				max: [b.max[0] + dx, b.max[1] + dy]
			};
		}
		case "p-mirror": {
			const b = aabbOfProfile(p.child);
			if (!b) return null;
			const [nx, ny] = p.normal;
			const len2 = nx * nx + ny * ny;
			if (!len2) return b;
			let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
			for (const x of [b.min[0], b.max[0]]) for (const y of [b.min[1], b.max[1]]) {
				const d = 2 * (x * nx + y * ny) / len2;
				const rx = x - d * nx;
				const ry = y - d * ny;
				if (rx < minX) minX = rx;
				if (ry < minY) minY = ry;
				if (rx > maxX) maxX = rx;
				if (ry > maxY) maxY = ry;
			}
			return {
				min: [minX, minY],
				max: [maxX, maxY]
			};
		}
		case "p-scale": {
			const b = aabbOfProfile(p.child);
			if (!b) return null;
			const [sx, sy] = p.scale;
			return {
				min: [Math.min(b.min[0] * sx, b.max[0] * sx), Math.min(b.min[1] * sy, b.max[1] * sy)],
				max: [Math.max(b.min[0] * sx, b.max[0] * sx), Math.max(b.min[1] * sy, b.max[1] * sy)]
			};
		}
		case "p-rotate": {
			const b = aabbOfProfile(p.child);
			if (!b) return null;
			const a = p.degrees * Math.PI / 180;
			const c = Math.cos(a);
			const s = Math.sin(a);
			let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
			for (const x of [b.min[0], b.max[0]]) for (const y of [b.min[1], b.max[1]]) {
				const rx = x * c - y * s;
				const ry = x * s + y * c;
				if (rx < minX) minX = rx;
				if (ry < minY) minY = ry;
				if (rx > maxX) maxX = rx;
				if (ry > maxY) maxY = ry;
			}
			return {
				min: [minX, minY],
				max: [maxX, maxY]
			};
		}
	}
}
function mergeAabb2(a, b) {
	return {
		min: [Math.min(a.min[0], b.min[0]), Math.min(a.min[1], b.min[1])],
		max: [Math.max(a.max[0], b.max[0]), Math.max(a.max[1], b.max[1])]
	};
}
/**
* The *pocket* profile that lightens a prismatic part: everything inside
* `outline` except a solid rim, a rib lattice, and any keep-outs. Cut it with
* `difference([slab, extrude(lightenPocket(outline, opts), depth)])`.
*
* This exists so lightening is part of drawing the part rather than a second
* pass bolted on afterwards — the rim, the ribs, and the bosses that must stay
* solid are all stated once, in the outline's own plane.
*/
/**
* The rib bars a lightenPocket leaves behind, one Profile per angle.
*
* Exposed so callers can build ON the lattice they just cut — raising one
* diagonal family to stand proud, say. Anything that has to line up with the
* lattice must come from here rather than being reconstructed, or it lands
* fractionally off and the two patterns fight.
*/
function lightenBars(outline, opts) {
	const { rib, pitch, angle = 45, cross = true } = opts;
	const b = aabbOfProfile(outline);
	if (!b) return [];
	const w = b.max[0] - b.min[0];
	const h = b.max[1] - b.min[1];
	const cx = (b.min[0] + b.max[0]) / 2;
	const cy = (b.min[1] + b.max[1]) / 2;
	const span = Math.hypot(w, h) + 2 * pitch;
	const n = Math.ceil(span / pitch);
	return (cross ? [angle, -angle] : [angle]).map((a) => {
		const strip = [];
		for (let i = -n; i <= n; i++) strip.push(pTranslate([-span / 2, i * pitch - rib / 2], rectProfile(span, rib)));
		return pTranslate([cx, cy], pRotate(a, pUnion(strip)));
	});
}
function lightenPocket(outline, opts) {
	const { rim, keepOut = [] } = opts;
	const field = pOffset(outline, -rim, "miter");
	if (!aabbOfProfile(outline)) return field;
	return pDifference([
		field,
		...lightenBars(outline, opts),
		...keepOut
	]);
}

// vendor/casemaker/casemaker-app/src/engine/compiler/buildPlan.ts
function cube(size, center = false) {
	return {
		kind: "cube",
		size,
		center
	};
}
function cylinder(height, radius, segments = 48, center = false) {
	return {
		kind: "cylinder",
		height,
		radiusLow: radius,
		segments,
		center
	};
}
function translate(offset, child) {
	return {
		kind: "translate",
		offset,
		child
	};
}
function rotate(degrees, child) {
	return {
		kind: "rotate",
		degrees,
		child
	};
}
function scale(factor, child) {
	return {
		kind: "scale",
		factor,
		child
	};
}
function mesh(positions, indices) {
	return {
		kind: "mesh",
		positions,
		indices
	};
}
/**
* Issue #45 — axis-aligned cylinder oriented along a face normal. The
* resulting cylinder is centered on origin in its perpendicular plane and
* extends from 0 to `length` along the chosen axis. Combine with `translate`
* to position the centerline.
*
* The base `cylinder` primitive only supports the +z axis; previously every
* compiler that needed a wall-piercing through-hole open re-emitted a
* bespoke `rotate(cylinder)` switch (roundCutout, antennas, mountingFeatures
* VESA — the last one shipped the wrong rotation, hence the issue).
*/
function axisCylinder(facing, length, radius, segments = 48) {
	const cyl = cylinder(length, radius, segments);
	switch (facing) {
		case "+z": return cyl;
		case "+x":
		case "-x": return rotate([
			0,
			90,
			0
		], cyl);
		case "+y":
		case "-y": return rotate([
			-90,
			0,
			0
		], cyl);
		default: return cyl;
	}
}
/**
* Conservative world-space bounding box of a build op. Rotations transform
* the child box's corners (applied X→Y→Z), so the result may over-cover but
* never under-covers. Used for coarse keep-out tests (e.g. ventilation
* avoiding port cutouts). Returns null for empty composites.
*/
function aabbOfOp(op) {
	switch (op.kind) {
		case "cube": {
			const [x, y, z] = op.size;
			return op.center ? {
				min: [
					-x / 2,
					-y / 2,
					-z / 2
				],
				max: [
					x / 2,
					y / 2,
					z / 2
				]
			} : {
				min: [
					0,
					0,
					0
				],
				max: [
					x,
					y,
					z
				]
			};
		}
		case "cylinder": {
			const r = Math.max(op.radiusLow, op.radiusHigh ?? op.radiusLow);
			return op.center ? {
				min: [
					-r,
					-r,
					-op.height / 2
				],
				max: [
					r,
					r,
					op.height / 2
				]
			} : {
				min: [
					-r,
					-r,
					0
				],
				max: [
					r,
					r,
					op.height
				]
			};
		}
		case "mesh": {
			if (!op.positions.length) return null;
			const min = [
				Infinity,
				Infinity,
				Infinity
			];
			const max = [
				-Infinity,
				-Infinity,
				-Infinity
			];
			for (let i = 0; i < op.positions.length; i += 3) for (let a = 0; a < 3; a++) {
				const v = op.positions[i + a];
				if (v < min[a]) min[a] = v;
				if (v > max[a]) max[a] = v;
			}
			return {
				min,
				max
			};
		}
		case "translate": {
			const b = aabbOfOp(op.child);
			if (!b) return null;
			const o = op.offset;
			return {
				min: [
					b.min[0] + o[0],
					b.min[1] + o[1],
					b.min[2] + o[2]
				],
				max: [
					b.max[0] + o[0],
					b.max[1] + o[1],
					b.max[2] + o[2]
				]
			};
		}
		case "scale": {
			const b = aabbOfOp(op.child);
			if (!b) return null;
			const f = op.factor;
			return {
				min: [
					b.min[0] * f,
					b.min[1] * f,
					b.min[2] * f
				],
				max: [
					b.max[0] * f,
					b.max[1] * f,
					b.max[2] * f
				]
			};
		}
		case "rotate": {
			const b = aabbOfOp(op.child);
			if (!b) return null;
			const [ax, ay, az] = op.degrees.map((d) => d * Math.PI / 180);
			const rot = (v) => {
				let [x, y, z] = v;
				let c = Math.cos(ax);
				let s = Math.sin(ax);
				[y, z] = [y * c - z * s, y * s + z * c];
				c = Math.cos(ay);
				s = Math.sin(ay);
				[x, z] = [x * c + z * s, -x * s + z * c];
				c = Math.cos(az);
				s = Math.sin(az);
				[x, y] = [x * c - y * s, x * s + y * c];
				return [
					x,
					y,
					z
				];
			};
			const min = [
				Infinity,
				Infinity,
				Infinity
			];
			const max = [
				-Infinity,
				-Infinity,
				-Infinity
			];
			for (const cx of [b.min[0], b.max[0]]) for (const cy of [b.min[1], b.max[1]]) for (const cz of [b.min[2], b.max[2]]) {
				const p = rot([
					cx,
					cy,
					cz
				]);
				for (let a = 0; a < 3; a++) {
					if (p[a] < min[a]) min[a] = p[a];
					if (p[a] > max[a]) max[a] = p[a];
				}
			}
			return {
				min,
				max
			};
		}
		case "extrude": {
			const b = aabbOfProfile(op.profile);
			if (!b) return null;
			const s = op.scaleTop ?? 1;
			const sx = typeof s === "number" ? s : s[0];
			const sy = typeof s === "number" ? s : s[1];
			let lo = [Math.min(b.min[0], b.min[0] * sx), Math.min(b.min[1], b.min[1] * sy)];
			let hi = [Math.max(b.max[0], b.max[0] * sx), Math.max(b.max[1], b.max[1] * sy)];
			if (op.twistDegrees) {
				const r = Math.max(Math.abs(lo[0]), Math.abs(hi[0]), Math.abs(lo[1]), Math.abs(hi[1]));
				lo = [-r, -r];
				hi = [r, r];
			}
			return op.center ? {
				min: [
					lo[0],
					lo[1],
					-op.height / 2
				],
				max: [
					hi[0],
					hi[1],
					op.height / 2
				]
			} : {
				min: [
					lo[0],
					lo[1],
					0
				],
				max: [
					hi[0],
					hi[1],
					op.height
				]
			};
		}
		case "revolve": {
			const b = aabbOfProfile(op.profile);
			if (!b) return null;
			const r = Math.max(Math.abs(b.min[0]), Math.abs(b.max[0]));
			return {
				min: [
					-r,
					-r,
					b.min[1]
				],
				max: [
					r,
					r,
					b.max[1]
				]
			};
		}
		case "hull":
		case "union":
		case "difference":
		case "intersection": {
			const kids = op.kind === "union" || op.kind === "hull" ? op.children : op.children.slice(0, 1);
			let out = null;
			for (const k of kids) {
				const b = aabbOfOp(k);
				if (!b) continue;
				if (!out) out = {
					min: [...b.min],
					max: [...b.max]
				};
				else for (let a = 0; a < 3; a++) {
					if (b.min[a] < out.min[a]) out.min[a] = b.min[a];
					if (b.max[a] > out.max[a]) out.max[a] = b.max[a];
				}
			}
			return out;
		}
	}
}
function difference(children) {
	return {
		kind: "difference",
		children
	};
}
function union$1(children) {
	return {
		kind: "union",
		children
	};
}
function intersection$1(children) {
	return {
		kind: "intersection",
		children
	};
}
/** Extrude a profile along +Z, base at z = 0. */
function extrude(profile, height, opts = {}) {
	const divisions = opts.divisions ?? (opts.twistDegrees || opts.scaleTop !== void 0 ? 16 : 0);
	return {
		kind: "extrude",
		profile,
		height,
		...opts,
		divisions
	};
}
/** Extrude along +X — the profile's x becomes y, its y becomes z. */
function extrudeX(profile, length, opts = {}) {
	return rotate([
		0,
		90,
		0
	], rotate([
		0,
		0,
		90
	], extrude(profile, length, opts)));
}
/** Convex hull of the children. */
function hull(children) {
	return {
		kind: "hull",
		children
	};
}
/**
* Issue #81 — extruded rounded rectangle: a box of (width × height × depth)
* with the four VERTICAL edges rounded to `radius`. Built as the union of
* two perpendicular center-cross strips + four corner cylinders, all of full
* `depth`. Manifold's union fuses them into a single connected component.
*
* When `radius <= 0` returns a plain cube to keep the legacy fast path
* byte-identical to pre-#81 builds.
*
* Origin convention: bbox-min corner sits at (0, 0, 0); body extends to
* (width, height, depth) — same as `cube([w, h, d], false)` so callers can
* swap in roundedRectPrism without changing translation logic.
*/
function roundedRectPrism(width, height, depth, radius, segments = 24) {
	if (radius <= 0) return cube([
		width,
		height,
		depth
	], false);
	const r = Math.min(radius, width / 2, height / 2);
	const out = [];
	const horizH = height - 2 * r;
	if (horizH > 0) out.push(translate([
		0,
		r,
		0
	], cube([
		width,
		horizH,
		depth
	], false)));
	const vertW = width - 2 * r;
	if (vertW > 0) out.push(translate([
		r,
		0,
		0
	], cube([
		vertW,
		height,
		depth
	], false)));
	out.push(translate([
		r,
		r,
		0
	], cylinder(depth, r, segments)));
	out.push(translate([
		width - r,
		r,
		0
	], cylinder(depth, r, segments)));
	out.push(translate([
		r,
		height - r,
		0
	], cylinder(depth, r, segments)));
	out.push(translate([
		width - r,
		height - r,
		0
	], cylinder(depth, r, segments)));
	return union$1(out);
}

// vendor/casemaker/casemaker-app/src/engine/coords.ts
/**
* Per-side total X/Y clearance from PCB edge to inside wall. Each side =
* `internalClearance + (clearanceTweaks?.<side> ?? 0)`. Use this anywhere you
* previously wrote `wall + cl` for a board-origin or inside-wall position;
* the per-side values let the cavity grow asymmetrically without scaling
* the board.
*/
function cavityClearance(params) {
	const cl = params.internalClearance;
	const t = params.clearanceTweaks;
	return {
		xMin: cl + (t?.xMin ?? 0),
		xMax: cl + (t?.xMax ?? 0),
		yMin: cl + (t?.yMin ?? 0),
		yMax: cl + (t?.yMax ?? 0)
	};
}
/** World-frame X / Y of the cavity origin (PCB lower-left corner in world coords). */
function cavityOriginXY(params) {
	const cl = cavityClearance(params);
	return {
		x: params.wallThickness + cl.xMin,
		y: params.wallThickness + cl.yMin
	};
}
/**
* Build the local frame for one face of an axis-aligned case with outer
* dimensions `outerX × outerY × outerZ`. The case sits in the first octant
* (corner at the origin), so e.g. the `-z` face is the bottom plane (z = 0)
* and the `+z` face is the top plane (z = outerZ).
*/
function faceFrame(face, outerX, outerY, outerZ) {
	switch (face) {
		case "-z": return {
			origin: [
				0,
				0,
				0
			],
			uAxis: [
				1,
				0,
				0
			],
			vAxis: [
				0,
				1,
				0
			],
			outwardAxis: [
				0,
				0,
				-1
			],
			outwardLetter: "z",
			outwardSign: -1
		};
		case "+z": return {
			origin: [
				0,
				0,
				outerZ
			],
			uAxis: [
				1,
				0,
				0
			],
			vAxis: [
				0,
				1,
				0
			],
			outwardAxis: [
				0,
				0,
				1
			],
			outwardLetter: "z",
			outwardSign: 1
		};
		case "-y": return {
			origin: [
				0,
				0,
				0
			],
			uAxis: [
				1,
				0,
				0
			],
			vAxis: [
				0,
				0,
				1
			],
			outwardAxis: [
				0,
				-1,
				0
			],
			outwardLetter: "y",
			outwardSign: -1
		};
		case "+y": return {
			origin: [
				0,
				outerY,
				0
			],
			uAxis: [
				1,
				0,
				0
			],
			vAxis: [
				0,
				0,
				1
			],
			outwardAxis: [
				0,
				1,
				0
			],
			outwardLetter: "y",
			outwardSign: 1
		};
		case "-x": return {
			origin: [
				0,
				0,
				0
			],
			uAxis: [
				0,
				1,
				0
			],
			vAxis: [
				0,
				0,
				1
			],
			outwardAxis: [
				-1,
				0,
				0
			],
			outwardLetter: "x",
			outwardSign: -1
		};
		case "+x": return {
			origin: [
				outerX,
				0,
				0
			],
			uAxis: [
				0,
				1,
				0
			],
			vAxis: [
				0,
				0,
				1
			],
			outwardAxis: [
				1,
				0,
				0
			],
			outwardLetter: "x",
			outwardSign: 1
		};
	}
}
/**
* Map a face-local (u, v) coordinate to world-space, optionally offset along
* the face's outward normal. Replaces the inline
* `[origin[0] + uAxis[0]*u + vAxis[0]*v, ...]` triplet that was duplicated in
* every feature compiler.
*/
function placeOnFace(frame, u, v, outwardOffset = 0) {
	return [
		frame.origin[0] + frame.uAxis[0] * u + frame.vAxis[0] * v + frame.outwardAxis[0] * outwardOffset,
		frame.origin[1] + frame.uAxis[1] * u + frame.vAxis[1] * v + frame.outwardAxis[1] * outwardOffset,
		frame.origin[2] + frame.uAxis[2] * u + frame.vAxis[2] * v + frame.outwardAxis[2] * outwardOffset
	];
}

// vendor/casemaker/casemaker-app/src/engine/compiler/lidMode.ts
/**
* Issue #117 — one place that answers "what shape is the lid?".
*
* Before this, seven modules each read `params.lidRecess` and
* `params.lidCavityHeight` for themselves — the shell (its recess pocket),
* the lid, the seal (where the channel and tongue sit), the latches (they
* refuse a recessed lid), the alignment flange, the rugged ribs and the
* bosses. A clamshell lid is defined by a *combination* of those two
* fields, so every one of those readers had to agree on the combination or
* the geometry would disagree with itself. They now all ask these
* functions, and the answer for a project with no `seal.mode` is exactly
* what each of them used to compute on its own — so legacy geometry is
* unchanged by construction.
*
* This module is deliberately a leaf: it imports types and nothing else.
* `seal.ts` imports `caseShell.ts`, and every one of the readers above
* imports one or both, so anything with compiler imports here would be a
* cycle.
*/
/**
* The shallowest cavity a clamshell lid may have (mm). Issue #117: the
* lid's cavity is "just enough to clear the lid-side gasket flange + 2–3 mm
* of clearance"; 3 is the top of that range, chosen because the case-side
* rim is the highest thing above the rim plane and the tongue hangs *below*
* the lid's bottom face, so nothing above the rim needs more room than the
* flange lip it is clearing.
*/
const CLAMSHELL_MIN_CAVITY = 3;
/** Is this project's lid a clamshell box (#117)? */
function isClamshell(params) {
	return params.seal?.mode === "clamshell";
}
/**
* Does the lid drop INTO a pocket in the rim? A clamshell lid sits ON the
* rim by definition, so `lidRecess` is ignored in that mode rather than
* being a second, contradictory way to say the same thing.
*/
function lidIsRecessed(params) {
	return !!params.lidRecess && !isClamshell(params);
}
/**
* Height of the lid's internal cavity, above its open underside. 0 means
* the lid is a plate, not a shell. A clamshell lid is never a plate: when
* the user has not set a cavity height it gets {@link CLAMSHELL_MIN_CAVITY},
* which is the difference between "asked for a box" and "got a box".
*/
function lidCavityHeight(params) {
	const requested = params.lidCavityHeight ?? 0;
	if (!isClamshell(params)) return requested;
	return Math.max(requested, 3);
}

// vendor/casemaker/casemaker-app/src/engine/compiler/caseShell.ts
/**
* Compute the additional internal Z height required by stacked HATs.
* Each enabled HAT contributes (lift + pcb.z + tallest +z component height).
* Unknown hatId entries are ignored (defensive — the project store may carry
* stale references after a HAT is removed).
*/
const HOST_HAT_CLEARANCE = .5;
function tallestPlusZ(profile, includePcb) {
	return profile.components.reduce((m, c) => Math.max(m, c.position.z + c.size.z), includePcb ? profile.pcb.size.z : 0);
}
function computeStackedHatHeight(hats, resolveHat, hostBoard) {
	if (!hats || hats.length === 0) return 0;
	const ordered = [...hats].sort((a, b) => a.stackIndex - b.stackIndex);
	const hostTallest = hostBoard ? tallestPlusZ(hostBoard, false) : 0;
	let total = 0;
	let firstEnabled = true;
	for (const placement of ordered) {
		if (!placement.enabled) continue;
		const profile = resolveHat(placement.hatId);
		if (!profile) continue;
		let lift = placement.liftOverride ?? profile.headerHeight;
		if (firstEnabled && hostTallest > 0) lift = Math.max(lift, hostTallest + HOST_HAT_CLEARANCE);
		firstEnabled = false;
		const tallest = tallestPlusZ(profile, true);
		total += lift + tallest;
	}
	return total;
}
/**
* Issue #46 — `hats` and `resolveHat` are required, not optional. Every shell
* dimension (`outerZ`, `cavityZ`) depends on the HAT stack, so any caller
* that omits HATs is computing the wrong envelope. Pass `[]` and `() =>
* undefined` explicitly only when the call site truly has no HATs to resolve.
*
* Issue #105 — optional `display` + `resolveDisplay` parameters. When
* provided AND the display's PCB is larger than the host's, the cavity
* grows so the case envelope contains the display. Optional to avoid
* rippling through every caller; ProjectCompiler is the only call site
* that has the project's display in scope and passes it.
*/
function computeShellDims(board, params, hats, resolveHat, display = null, resolveDisplay = () => void 0) {
	const { wallThickness: wall, floorThickness: floor, zClearance } = params;
	const cl = cavityClearance(params);
	const pcb = board.pcb.size;
	let displayMaxX = pcb.x;
	let displayMaxY = pcb.y;
	let displayTopAddedZ = 0;
	if (display && display.enabled) {
		const profile = resolveDisplay(display.displayId);
		if (profile) {
			const offX = display.offset?.x ?? 0;
			const offY = display.offset?.y ?? 0;
			displayMaxX = Math.max(pcb.x, offX + profile.pcb.size.x);
			displayMaxY = Math.max(pcb.y, offY + profile.pcb.size.y);
			displayTopAddedZ = profile.overallHeight;
		}
	}
	const cavityX = displayMaxX + cl.xMin + cl.xMax;
	const cavityY = displayMaxY + cl.yMin + cl.yMax;
	const stackHeight = computeStackedHatHeight(hats, resolveHat, board);
	const hostTallestAbovePcb = board.components.reduce((m, c) => Math.max(m, c.position.z + c.size.z - pcb.z), 0);
	const rimSafe = Math.max(hostTallestAbovePcb, stackHeight, displayTopAddedZ) + params.lidThickness + 2;
	const baseClearance = Math.max(zClearance, stackHeight, hostTallestAbovePcb, rimSafe, displayTopAddedZ);
	const extra = Math.max(0, params.extraCavityZ ?? 0);
	const cavityZ = board.defaultStandoffHeight + pcb.z + baseClearance + extra;
	const recessExtra = lidIsRecessed(params) ? params.lidThickness + 1 : 0;
	return {
		outerX: cavityX + 2 * wall,
		outerY: cavityY + 2 * wall,
		outerZ: floor + cavityZ + recessExtra,
		cavityX,
		cavityY,
		cavityZ
	};
}
/**
* Issue #105 — `display` + `resolveDisplay` are optional. When provided AND
* the display PCB is larger than the host's, the resulting shell envelope
* grows so the case contains the display. Other compilers that recompute
* shellDims internally without the display still see the host-only
* envelope; that's a known partial fix tracked separately.
*/
function buildOuterShell(board, params, hats, resolveHat, display = null, resolveDisplay = () => void 0) {
	const dims = computeShellDims(board, params, hats, resolveHat, display, resolveDisplay);
	const { wallThickness: wall, floorThickness: floor } = params;
	const outerR = Math.max(0, params.cornerRadius);
	const innerR = Math.max(0, outerR - wall);
	const outer = roundedRectPrism(dims.outerX, dims.outerY, dims.outerZ, outerR);
	const overshoot = 1;
	const cavity = translate([
		wall,
		wall,
		floor
	], roundedRectPrism(dims.cavityX, dims.cavityY, dims.cavityZ + overshoot, innerR));
	if (lidIsRecessed(params)) {
		const recessOffset = Math.max(.5, wall - .5);
		const pocketX = dims.cavityX + 2 * recessOffset;
		const pocketY = dims.cavityY + 2 * recessOffset;
		const pocketZ = params.lidThickness + .5;
		const pocketOriginX = wall - recessOffset;
		const pocketOriginY = wall - recessOffset;
		const pocketOriginZ = dims.outerZ - pocketZ;
		const pocketR = Math.max(0, outerR);
		const pocket = translate([
			pocketOriginX,
			pocketOriginY,
			pocketOriginZ
		], roundedRectPrism(pocketX, pocketY, pocketZ + overshoot, pocketR));
		return difference([
			outer,
			cavity,
			pocket
		]);
	}
	return difference([outer, cavity]);
}

// vendor/casemaker/casemaker-app/src/engine/compiler/bosses.ts
const HEAT_SET_SPECS = {
	"self-tap": {
		hole: 2.5,
		minOuter: 4.5
	},
	"heat-set-m2.5": {
		hole: 3.6,
		minOuter: 5.6
	},
	"heat-set-m3": {
		hole: 4.2,
		minOuter: 6.2
	},
	"pass-through": {
		hole: 3.2,
		minOuter: 5
	},
	none: {
		hole: 0,
		minOuter: 4.5
	}
};
function resolveInsertSpec(insertType, configuredOuter, configuredHole) {
	const spec = HEAT_SET_SPECS[insertType];
	const holeDiameter = insertType === "none" ? 0 : insertType === "heat-set-m2.5" || insertType === "heat-set-m3" ? spec.hole : configuredHole;
	const minOuter = Math.max(spec.minOuter, holeDiameter + 2);
	return {
		outerDiameter: Math.max(configuredOuter, minOuter),
		holeDiameter
	};
}
function computeBossPlacements(board, params) {
	const screwRetained = (params.boardRetention ?? "screws") === "screws";
	if (!params.bosses.enabled && !screwRetained) return [];
	const { floorThickness: floor } = params;
	const origin = cavityOriginXY(params);
	const totalHeight = floor + board.defaultStandoffHeight;
	const { outerDiameter, holeDiameter } = resolveInsertSpec(screwRetained || params.joint === "screw-down" ? params.bosses.insertType : "none", params.bosses.outerDiameter, params.bosses.holeDiameter);
	const lidAnchored = params.bosses.enabled && params.joint === "screw-down" && params.bosses.position === "top";
	const baseZ = 0;
	const STUB_PILOT_MIN = 1.2;
	const STUB_PILOT_WALL = .5;
	const STUB_MIN_OD = 1.8;
	const STUB_RADIAL_EMBED = .1;
	const mk = (h, position) => {
		const stubMaxOD = h.diameter - .4;
		const canEmitStub = position === "bottom" && stubMaxOD >= STUB_MIN_OD && stubMaxOD >= holeDiameter + STUB_RADIAL_EMBED;
		const lockNotchDiameter = canEmitStub ? stubMaxOD : 0;
		const lockNotchHeight = canEmitStub ? Math.min(board.pcb.size.z, 1.6) : 0;
		let lockNotchPilotDiameter = 0;
		if (canEmitStub && holeDiameter > 0) {
			const wallLimited = lockNotchDiameter - 2 * STUB_PILOT_WALL;
			const candidate = Math.min(holeDiameter - .5, wallLimited);
			lockNotchPilotDiameter = candidate >= STUB_PILOT_MIN ? candidate : 0;
		}
		return {
			id: position === "top" ? `boss-${h.id}-lid` : `boss-${h.id}`,
			x: h.x + origin.x,
			y: h.y + origin.y,
			outerDiameter,
			holeDiameter,
			totalHeight,
			position,
			baseZ,
			lockNotchDiameter,
			lockNotchHeight,
			lockNotchPilotDiameter
		};
	};
	const out = [];
	for (const h of board.mountingHoles) {
		out.push(mk(h, "bottom"));
		if (lidAnchored) out.push(mk(h, "top"));
	}
	return out;
}
function getScrewClearanceDiameter(insertType) {
	switch (insertType) {
		case "heat-set-m3": return 3.4;
		case "heat-set-m2.5":
		case "self-tap": return 2.9;
		case "pass-through": return 3.4;
		case "none": return 0;
		default: return 2.9;
	}
}
/**
* Build the boss cylinders that get UNIONED with the floor (for 'bottom'
* placements) — the legacy path. Top-position bosses are emitted by
* {@link buildLidBosses} instead so they fuse with the lid mesh.
*/
function buildBossesUnion(placements) {
	const SECTION_EMBED = .05;
	return placements.filter((b) => b.position === "bottom").map((b) => {
		const outer = cylinder(b.totalHeight, b.outerDiameter / 2, 32);
		let body = outer;
		if (b.lockNotchDiameter > 0 && b.lockNotchHeight > 0) {
			const stubH = b.lockNotchHeight + SECTION_EMBED;
			const stub = cylinder(stubH, b.lockNotchDiameter / 2, 24);
			const stubAtTop = translate([
				0,
				0,
				b.totalHeight - SECTION_EMBED
			], stub);
			body = union$1([outer, stubAtTop]);
		}
		if (b.holeDiameter <= 0) return translate([
			b.x,
			b.y,
			0
		], body);
		const mainPilotH = b.totalHeight + SECTION_EMBED;
		const mainPilot = translate([
			0,
			0,
			-1
		], cylinder(mainPilotH + 1, b.holeDiameter / 2, 24));
		let piloted;
		if (b.lockNotchPilotDiameter > 0 && b.lockNotchHeight > 0) {
			const starterH = b.lockNotchHeight + 1;
			const starter = translate([
				0,
				0,
				b.totalHeight - SECTION_EMBED
			], cylinder(starterH, b.lockNotchPilotDiameter / 2, 24));
			piloted = difference([
				body,
				mainPilot,
				starter
			]);
		} else {
			const fullH = b.totalHeight + b.lockNotchHeight + 2;
			const fullPilot = translate([
				0,
				0,
				-1
			], cylinder(fullH, b.holeDiameter / 2, 24));
			piloted = difference([body, fullPilot]);
		}
		return translate([
			b.x,
			b.y,
			0
		], piloted);
	});
}
/**
* Issue #104 — bosses anchored to the lid underside hang DOWN from the lid.
* The cylinder's top face fuses with the lid; its bottom face sits at
* lidUndersideZ - boss.totalHeight, which is the same Z the bottom-position
* bosses' top face would have been at — so the screw insert position is
* unchanged, just the material it threads into is now lid-attached.
*
* Returned ops are in WORLD coords (not lid-local). The lid compiler is
* responsible for unioning them into the lid mesh.
*/
function buildLidBosses(placements, lidUndersideZ, postBottomZ) {
	const height = lidUndersideZ - postBottomZ;
	if (height <= 0) return [];
	return placements.filter((b) => b.position === "top").map((b) => {
		const outer = cylinder(height, b.outerDiameter / 2, 32);
		if (b.holeDiameter <= 0) return translate([
			b.x,
			b.y,
			postBottomZ
		], outer);
		const pilot = cylinder(height + 2, b.holeDiameter / 2, 24);
		const piloted = difference([outer, translate([
			0,
			0,
			-1
		], pilot)]);
		return translate([
			b.x,
			b.y,
			postBottomZ
		], piloted);
	});
}

// vendor/casemaker/casemaker-app/src/engine/compiler/seal.ts
const NO_HATS$10 = [];
const NO_RESOLVE$10 = () => void 0;
const NO_RESOLVE_DISPLAY$14 = () => void 0;
/**
* Issue #107 — waterproof gasket geometry.
*
* Case-side: a closed-loop rectangular channel cut into the rim top face.
* Lid-side: a matching tongue protruding from the lid underside.
*
* Cross-section in the rim n-z plane (n = inboard-normal, z = vertical):
*
*   case rim:     ┌──┬──┬──┐   ← rim top face
*                 │  │  │  │   ← channel of depth = channelDepth
*                 │  └──┘  │
*                 │ ░░░░░░ │   ← rest of rim wall material
*
*   lid (closed): ┌────────┐   ← lid plate underside
*                 │   ▼▼   │   ← tongue protrudes by tongueHeight
*
*   When closed, the tongue presses the (gasketDepth-tall) gasket into
*   the (channelDepth-deep) channel, compressing it by `compressionFactor`.
*
*   channelDepth + tongueHeight = gasketDepth × (1 + compressionFactor)
*
*   So if the gasket is 2 mm thick at 25% compression:
*     • channelDepth = 1.0 mm
*     • tongueHeight = 1.5 mm
*     • Compressed gasket = 2.0 × (1 - 0.25) = 1.5 mm
*     • Sum (channel + tongue) = 2.5 mm; gasket compressed to 1.5 mm fills
*       channel (1.0) + leaves 0.5 mm pressing tongue ⇒ correct preload.
*/
/**
* Issue #264 — the minimum web of case wall that survives on each side of the
* gasket channel.
*
* A channel as wide as the wall it is cut into leaves no material outboard (or
* inboard) of itself: the cut runs from the case's outer face to the cavity
* face. In recess mode the rim it is cut into is only `lidThickness` tall, so
* that full-width cut is the ONLY connection between the rim band above it and
* the body below — the band floats and the shell decomposes into two bodies
* instead of one printed part.
*
* 0.4 mm is one nozzle width: the thinnest web that is a wall rather than a
* knife edge. It is deliberately smaller than the 0.8 mm first proposed in
* #264 — `wallThickness` defaults to 2, so a 0.8 mm web would clamp the default
* 4 mm gasket to 0.4 mm and refuse the seal on every stock project, which is
* the same silence (a channel that is never cut) this fix exists to end.
*/
const MIN_SEAL_WEB = .4;
/** Narrowest ring that is still a ring; below this there is no seal to build. */
const MIN_SEAL_RING_WIDTH = .5;
/** Widest channel a wall of `wall` can hold with both webs left intact. */
function maxSealRingWidth(wall) {
	return wall - 2 * MIN_SEAL_WEB;
}
/** Cross-section width of the lid tongue for a ring of `ringWidth`, or null
*  when the configured clearance leaves too little tongue to build. */
function sealTongueWidth(ringWidth, clearance) {
	const width = ringWidth - 2 * clearance;
	return width > .5 ? width : null;
}
/** Channel cross-section depth and lid-tongue height for a given seal config. */
function computeChannelAndTongue(seal) {
	const compressedGasketDepth = seal.depth * (1 - seal.compressionFactor);
	return {
		channelDepth: compressedGasketDepth * .4,
		tongueHeight: compressedGasketDepth * .6 + seal.depth * seal.compressionFactor
	};
}
/**
* Compute the gasket ring geometry in world coords. The ring follows the
* case rim, offset INWARD from the outer wall so it doesn't break the
* outer envelope. Centerline sits at:
*   uOffset = wallThickness/2  (i.e. centered in the wall material)
*
* For the lid tongue, offset by an additional `tongueClearance` so it
* sits WITHIN the case ring without binding (the gasket fills the gap).
*
* Issue #264 — the requested width is CLAMPED to what the wall can hold with
* `MIN_SEAL_WEB` left on each side, so the channel can never consume the whole
* wall. `ringWidth` is what the channel, the gasket body and the tongue are all
* built from, so clamping here keeps the three consistent; `sealFitNote()` is
* the panel's view of the same clamp, so the warning and the geometry agree.
*/
function computeSealRing(board, params, hats = NO_HATS$10, resolveHat = NO_RESOLVE$10, display = null, resolveDisplay = NO_RESOLVE_DISPLAY$14) {
	if (!params.seal?.enabled) return null;
	const dims = computeShellDims(board, params, hats, resolveHat, display, resolveDisplay);
	const { wallThickness: wall } = params;
	const available = maxSealRingWidth(wall);
	if (available < .5) return null;
	const ringWidth = Math.min(params.seal.width, available);
	const outerOffset = wall / 2 - ringWidth / 2;
	return {
		outerCornerX: outerOffset,
		outerCornerY: outerOffset,
		outerWidth: dims.outerX - 2 * outerOffset,
		outerHeight: dims.outerY - 2 * outerOffset,
		ringWidth,
		cornerRadius: Math.max(0, params.cornerRadius - outerOffset)
	};
}
/**
* Build the gasket channel as a subtractive op cut into the rim top face.
* Uses a ring-shape primitive (outer rectangle minus inner rectangle, both
* with rounded corners matching the case envelope). Returns null if the
* seal isn't enabled or the wall is too thin.
*/
function buildSealChannel(board, params, hats = NO_HATS$10, resolveHat = NO_RESOLVE$10, display = null, resolveDisplay = NO_RESOLVE_DISPLAY$14) {
	const ring = computeSealRing(board, params, hats, resolveHat, display, resolveDisplay);
	if (!ring) return null;
	const { channelDepth } = computeChannelAndTongue(params.seal);
	const dims = computeShellDims(board, params, hats, resolveHat, display, resolveDisplay);
	const overshoot = .1;
	const totalDepth = channelDepth + 2 * overshoot;
	const outerSolid = roundedRectPrism(ring.outerWidth, ring.outerHeight, totalDepth, ring.cornerRadius);
	const innerWidth = ring.outerWidth - 2 * ring.ringWidth;
	const innerHeight = ring.outerHeight - 2 * ring.ringWidth;
	if (innerWidth <= 0 || innerHeight <= 0) return null;
	const innerR = Math.max(0, ring.cornerRadius - ring.ringWidth);
	const innerSolid = translate([
		ring.ringWidth,
		ring.ringWidth,
		0
	], roundedRectPrism(innerWidth, innerHeight, totalDepth, innerR));
	const ringOp = difference([outerSolid, innerSolid]);
	const channelBottomZ = (lidIsRecessed(params) ? dims.outerZ - params.lidThickness : dims.outerZ) + overshoot - totalDepth;
	return translate([
		ring.outerCornerX,
		ring.outerCornerY,
		channelBottomZ
	], ringOp);
}
/**
* Build the lid tongue as an additive op fused with the lid mesh. The
* tongue is the SAME ring shape as the channel (slightly narrower so it
* fits with installation slop) extruded DOWN from the lid underside.
*
* Returned op is in WORLD coords. The caller (ProjectCompiler) translates
* it into lid-local before unioning, since the lid op gets translated up
* by `lidDims.zPosition` afterward.
*/
function buildSealTongue(board, params, hats = NO_HATS$10, resolveHat = NO_RESOLVE$10, display = null, resolveDisplay = NO_RESOLVE_DISPLAY$14) {
	const ring = computeSealRing(board, params, hats, resolveHat, display, resolveDisplay);
	if (!ring) return null;
	const { tongueHeight } = computeChannelAndTongue(params.seal);
	const dims = computeShellDims(board, params, hats, resolveHat, display, resolveDisplay);
	const tongueClearance = params.seal.gasketClearance ?? .2;
	const tongueRingWidth = sealTongueWidth(ring.ringWidth, tongueClearance);
	if (tongueRingWidth === null) return null;
	const outerInset = tongueClearance;
	const outerWidth = ring.outerWidth - 2 * outerInset;
	const outerHeight = ring.outerHeight - 2 * outerInset;
	const cornerR = Math.max(0, ring.cornerRadius - outerInset);
	const tongueTotalHeight = tongueHeight + .5;
	const outerSolid = roundedRectPrism(outerWidth, outerHeight, tongueTotalHeight, cornerR);
	const innerWidth = outerWidth - 2 * tongueRingWidth;
	const innerHeight = outerHeight - 2 * tongueRingWidth;
	if (innerWidth <= 0 || innerHeight <= 0) return null;
	const innerR = Math.max(0, cornerR - tongueRingWidth);
	const innerSolid = translate([
		tongueRingWidth,
		tongueRingWidth,
		-.1
	], roundedRectPrism(innerWidth, innerHeight, tongueTotalHeight + .2, innerR));
	const tongueOp = difference([outerSolid, innerSolid]);
	const tongueBottomZ = (lidIsRecessed(params) ? dims.outerZ - params.lidThickness : dims.outerZ) - tongueHeight;
	return translate([
		ring.outerCornerX + outerInset,
		ring.outerCornerY + outerInset,
		tongueBottomZ
	], tongueOp);
}
/**
* Issue #108 — gasket body as a separate top-level part. The gasket is
* the closed-loop centerline extruded as a uncompressed-thickness ring.
* Lives as its own BuildNode so the export pipeline emits it as a
* separate STL (printed in TPU 95A).
*
* For 'flat' profile: rectangular cross-section, dims = ringWidth × depth.
* For 'o-ring' profile: not yet supported in v1 (would need a sweep-along-
*   path operation; falls back to rectangular).
*/
function buildGasketBody(board, params, hats = NO_HATS$10, resolveHat = NO_RESOLVE$10, display = null, resolveDisplay = NO_RESOLVE_DISPLAY$14) {
	const ring = computeSealRing(board, params, hats, resolveHat, display, resolveDisplay);
	if (!ring) return null;
	const dims = computeShellDims(board, params, hats, resolveHat, display, resolveDisplay);
	const seal = params.seal;
	const rimTopZ = lidIsRecessed(params) ? dims.outerZ - params.lidThickness : dims.outerZ;
	const { channelDepth } = computeChannelAndTongue(seal);
	rimTopZ - channelDepth - seal.depth + channelDepth;
	const baseZ = rimTopZ - channelDepth;
	const outerSolid = roundedRectPrism(ring.outerWidth, ring.outerHeight, seal.depth, ring.cornerRadius);
	const innerWidth = ring.outerWidth - 2 * ring.ringWidth;
	const innerHeight = ring.outerHeight - 2 * ring.ringWidth;
	if (innerWidth <= 0 || innerHeight <= 0) return null;
	const innerR = Math.max(0, ring.cornerRadius - ring.ringWidth);
	const innerSolid = translate([
		ring.ringWidth,
		ring.ringWidth,
		-.1
	], roundedRectPrism(innerWidth, innerHeight, seal.depth + .2, innerR));
	const ringOp = difference([outerSolid, innerSolid]);
	return translate([
		ring.outerCornerX,
		ring.outerCornerY,
		baseZ
	], ringOp);
}

// vendor/casemaker/casemaker-app/src/engine/compiler/latchProtection.ts
/** Shared geometry between the latch hinge (`latches.ts`) and the protective
*  ribs that flank each latch (`rugged.ts`). The ribs need to know where the
*  hinge knuckles sit so they can bump out to match the knuckle profile, and
*  the pin needs to extend through the corner-facing rib so the user can
*  push it out with a paperclip from outside the case. */
const LATCH_RIB_GAP = 2;
const LATCH_RIB_W = 3;
const LATCH_RIB_KNUCKLE_PAD = 1.5;
const LATCH_PIN_R = 1.5;
const LATCH_PIN_HOLE_CLEAR = .4;
const LATCH_PIN_CAP_R = 2.5;
const LATCH_PIN_CAP_LEN = 1.8;
const LATCH_PIN_CAP_CLEAR_RADIAL = .3;
const LATCH_PIN_CAP_CLEAR_AXIAL = .15;
/** Returns +1 if the latch's nearest corner is on the +tangent side of the
*  wall midpoint, -1 if the -tangent side. The CORNER-facing protective rib
*  is the one on this side; that's the rib that gets the pin removal hole. */
function cornerSign(latch, dims) {
	const tangentMax = latch.wall === "+x" || latch.wall === "-x" ? dims.outerY : dims.outerX;
	return latch.uPosition < tangentMax / 2 ? -1 : 1;
}
/** Wall-tangent center positions of the two protective ribs flanking a
*  latch. The "corner" rib is the one in `cornerSign(latch)` direction —
*  closer to the case corner. The "inner" rib is opposite. */
function protectiveRibPositions(latch, dims) {
	const sCorner = cornerSign(latch, dims);
	const offset = latch.width / 2 + 2;
	return {
		innerCenter: latch.uPosition - sCorner * offset,
		cornerCenter: latch.uPosition + sCorner * offset,
		cornerSign: sCorner
	};
}
/** Wall-tangent extent of the print-in-place pin SHAFT (excluding the
*  cap). Asymmetric — short end on the inner side (just past the latch's
*  case knuckles, captured), long end on the corner side terminating
*  EXACTLY at the corner-facing protective rib's outer face. The cap
*  occupies the outer (LATCH_PIN_CAP_LEN mm) of this same span — it
*  sits in a counter-sink so its outer face ends up flush with the rib. */
function pinSpanU(latch, dims) {
	const sCorner = cornerSign(latch, dims);
	const halfW = latch.width / 2;
	const cornerRibOuter = latch.uPosition + sCorner * (halfW + 2) + sCorner * (3 / 2);
	const innerEnd = latch.uPosition - sCorner * (halfW + .5);
	const cornerEnd = cornerRibOuter;
	return {
		uMin: Math.min(innerEnd, cornerEnd),
		uMax: Math.max(innerEnd, cornerEnd)
	};
}
/** Tangent extent of the pin CAP — the wider head that sits flush in the
*  counter-sink. Returns null if cap geometry doesn't fit (e.g. degenerate
*  pin span). */
function pinCapSpanU(latch, dims) {
	const sCorner = cornerSign(latch, dims);
	const halfW = latch.width / 2;
	const cornerRibOuter = latch.uPosition + sCorner * (halfW + 2) + sCorner * (3 / 2);
	const capInner = cornerRibOuter - sCorner * LATCH_PIN_CAP_LEN;
	return {
		uMin: Math.min(cornerRibOuter, capInner),
		uMax: Math.max(cornerRibOuter, capInner),
		sCorner
	};
}

// vendor/casemaker/casemaker-app/src/engine/compiler/featureScale.ts
/** Compile-time auto-scaling for latch + hinge dimensions.
*
*  The user's stored values are TARGETS. The compiler clamps them based
*  on (a) what physically fits on the case wall, and (b) what's
*  practically printable on a typical FDM machine. Resizing the case
*  smaller than the stored hardware would call for re-scales the
*  hardware automatically, with hard floors so nothing shrinks below
*  print-reliable feature sizes.
*/
const MIN_LATCH_WIDTH = 8;
const MIN_LATCH_HEIGHT = 14;
const MIN_LATCH_THROW = .8;
const MIN_KNUCKLE_OD = 5;
const MIN_PIN_DIAMETER = 2;
const MIN_HINGE_LEN = 25;
const MAX_LATCH_WIDTH_FRACTION = .4;
const MAX_LATCH_HEIGHT_FRACTION = .7;
const MAX_HINGE_LEN_FRACTION = .85;
/** Clamp a latch's stored dimensions to fit the case + stay printable.
*  Also clamps uPosition so the latch (plus its protective ribs) stays
*  inside the wall — otherwise a small case with a uPosition stored from
*  a larger-case template would put the latch hardware OUTSIDE the case
*  envelope and leave it as a loose component. */
function clampLatch(latch, dims) {
	const tangentMax = latch.wall === "+x" || latch.wall === "-x" ? dims.outerY : dims.outerX;
	const fitWidth = Math.min(latch.width, tangentMax * MAX_LATCH_WIDTH_FRACTION);
	const fitHeight = Math.min(latch.height, dims.outerZ * MAX_LATCH_HEIGHT_FRACTION);
	const width = Math.max(8, fitWidth);
	const safeMargin = width / 2 + 2 + 3 / 2 + 1;
	const minU = safeMargin;
	const maxU = Math.max(safeMargin, tangentMax - safeMargin);
	return {
		...latch,
		uPosition: Math.max(minU, Math.min(maxU, latch.uPosition)),
		width,
		height: Math.max(14, fitHeight),
		throw: Math.max(MIN_LATCH_THROW, latch.throw)
	};
}
/** Clamp a hinge's stored dimensions to fit the case + stay printable. */
function clampHinge(hinge, dims) {
	const tangentMax = hinge.face === "+x" || hinge.face === "-x" ? dims.outerY : dims.outerX;
	const fitLen = Math.min(hinge.hingeLength, tangentMax * MAX_HINGE_LEN_FRACTION);
	const numK = Math.max(3, hinge.numKnuckles);
	const perKnuckleSlice = (fitLen - (numK - 1) * hinge.knuckleClearance) / numK;
	const fitOD = Math.min(hinge.knuckleOuterDiameter, perKnuckleSlice * .9);
	const fitPin = Math.min(hinge.pinDiameter, fitOD * .55);
	return {
		...hinge,
		hingeLength: Math.max(25, fitLen),
		knuckleOuterDiameter: Math.max(5, fitOD),
		pinDiameter: Math.max(2, fitPin)
	};
}

// vendor/casemaker/casemaker-app/src/engine/compiler/latches.ts
const NO_HATS$9 = [];
const NO_RESOLVE$9 = () => void 0;
const NO_RESOLVE_DISPLAY$13 = () => void 0;
/** Issue #109 — Pelican-standard spring-cam latch (v2 redesign).
*
*  Pelican design (vs. the v1 freestanding-arm placeholder):
*
*      ┌──── lid plate ────┐
*      │                ●──── striker tab + post (additive on lid;
*      │                       sticks OUT past case envelope so the
*      │                       cam can hook it)
*      ├───────────────────
*      ║ rim (case wall)   ║
*      ║                   ║
*      ║                   ╚── ⌒── cam hook at TOP of arm
*      ║                       │
*      ║                       │   arm body
*      ║                       │
*      ║   ⊙─⊙─⊙ ←──────── 3 knuckles share one pin axis:
*      ║                       outer two = additive on case wall,
*      ║                       middle one = on the arm.
*      ║   pin (separate
*      ║   top-level part,
*      ║   print-in-place)
*      ║                       arm pivots ABOUT the pin axis.
*      ║                       Closed: arm flat against wall, cam
*      ║                       wraps over lid striker, lid pulled tight.
*      ║                       Open:   arm rotates outward, cam
*      ║                       releases lid striker.
*
*  v2 still ships a SIMPLE rectangular cam hook (no over-center
*  cardioid profile) — the engagement is "captured" but not
*  preloaded. Adding the over-center pull-down is a follow-up;
*  for now the gasket compression depends on the user pressing the
*  lid down before flipping the latch.
*
*  Constraint: Pelican-standard latches require lidRecess=false. The
*  lid plate must sit ON TOP of the rim so the striker tab has clear
*  air to project outward into. With lidRecess=true, the rim
*  surrounds the lid plate at its own Z and there's no path for the
*  striker. The compiler skips latch generation (and logs) when
*  lidRecess is true so a misconfigured project still loads — UI is
*  expected to surface the constraint.
*/
const KNUCKLE_OUTER_R = 4;
const PIN_R = 1.5;
const PIN_CLEAR = .4;
const KNUCKLE_AXIAL_GAP = .3;
const KNUCKLE_OFFSET = 4;
const PIVOT_BELOW_RIM = 22;
const ARM_KNUCKLE_FRACTION = .4;
const ARM_PLATE_THICKNESS = 3;
const HOOK_WALL_OFFSET = 1;
const STRIKER_R = 1.5;
const STRIKER_TAB_THICKNESS = 3;
const STRIKER_TAB_HEIGHT = 5;
const HOOK_VERTICAL = 4;
const EMBED$2 = .5;
const CAM_PRELOAD = .3;
const EMPTY$1 = {
	lidAdditive: [],
	caseAdditive: [],
	caseSubtract: [],
	armNodes: [],
	pinNodes: []
};
function buildLatchOps(latches, board, params, hats = NO_HATS$9, resolveHat = NO_RESOLVE$9, display = null, resolveDisplay = NO_RESOLVE_DISPLAY$13) {
	if (!latches || latches.length === 0) return EMPTY$1;
	if (lidIsRecessed(params)) return EMPTY$1;
	const dims = computeShellDims(board, params, hats, resolveHat, display, resolveDisplay);
	const out = {
		lidAdditive: [],
		caseAdditive: [],
		caseSubtract: [],
		armNodes: [],
		pinNodes: []
	};
	for (const rawLatch of latches) {
		if (!rawLatch.enabled) continue;
		const latch = clampLatch(rawLatch, dims);
		const built = buildOneLatch(latch, dims, params);
		if (!built) continue;
		out.caseAdditive.push(...built.caseAdditive);
		out.caseSubtract.push(...built.caseSubtract);
		out.lidAdditive.push(...built.lidAdditive);
		out.armNodes.push({
			id: `latch-arm-${latch.id}`,
			op: built.arm
		});
		out.pinNodes.push({
			id: `latch-pin-${latch.id}`,
			op: built.pin
		});
	}
	return out;
}
function frameForWall(wall, dims) {
	switch (wall) {
		case "-x": return {
			wallOuter: 0,
			outwardSign: -1,
			wallAxis: "x"
		};
		case "+x": return {
			wallOuter: dims.outerX,
			outwardSign: 1,
			wallAxis: "x"
		};
		case "-y": return {
			wallOuter: 0,
			outwardSign: -1,
			wallAxis: "y"
		};
		case "+y": return {
			wallOuter: dims.outerY,
			outwardSign: 1,
			wallAxis: "y"
		};
	}
}
function buildOneLatch(latch, dims, params) {
	const rimTopZ = dims.outerZ;
	const lidPlateTopZ = rimTopZ + params.lidThickness;
	const pivotZ = rimTopZ - PIVOT_BELOW_RIM;
	const tolerance = latch.tolerance ?? .2;
	const f = frameForWall(latch.wall, dims);
	const u0 = latch.uPosition;
	const wallOuter = f.wallOuter;
	const totalKnuckleSpan = latch.width;
	const armKnuckleLen = ARM_KNUCKLE_FRACTION * totalKnuckleSpan - 2 * KNUCKLE_AXIAL_GAP;
	const caseKnuckleLen = (totalKnuckleSpan - armKnuckleLen - 2 * KNUCKLE_AXIAL_GAP) / 2;
	if (armKnuckleLen <= .5 || caseKnuckleLen <= .5) return null;
	const armKnuckleU0 = u0 - armKnuckleLen / 2;
	const caseKnuckleAU0 = u0 - latch.width / 2;
	const caseKnuckleBU0 = u0 + armKnuckleLen / 2 + KNUCKLE_AXIAL_GAP;
	const pinAxisN = wallOuter + f.outwardSign * KNUCKLE_OFFSET;
	const caseKnuckleA = makeKnuckleAlongTangent(f, caseKnuckleAU0, caseKnuckleLen, pinAxisN, pivotZ, KNUCKLE_OUTER_R, EMBED$2);
	const caseKnuckleB = makeKnuckleAlongTangent(f, caseKnuckleBU0, caseKnuckleLen, pinAxisN, pivotZ, KNUCKLE_OUTER_R, EMBED$2);
	const pinBore = makeBoreAlongTangent(f, u0 - latch.width / 2 - .5, latch.width + 1, pinAxisN, pivotZ, PIN_R + tolerance + PIN_CLEAR);
	const pinSpan = pinSpanU(latch, dims);
	const pinShaft = makeBoreAlongTangent(f, pinSpan.uMin, pinSpan.uMax - pinSpan.uMin, pinAxisN, pivotZ, PIN_R);
	const capSpan = pinCapSpanU(latch, dims);
	const pin = capSpan ? union$1([pinShaft, makeBoreAlongTangent(f, capSpan.uMin, capSpan.uMax - capSpan.uMin, pinAxisN, pivotZ, LATCH_PIN_CAP_R)]) : pinShaft;
	const lidShellMode = lidCavityHeight(params) > 0;
	let strikerAxisN;
	let strikerZ;
	let tabInnerN;
	let tabOuterN;
	if (lidShellMode) {
		const STRIKER_Z_ABOVE_RIM = 6;
		strikerAxisN = wallOuter;
		strikerZ = rimTopZ + STRIKER_Z_ABOVE_RIM;
		tabInnerN = wallOuter;
		tabOuterN = wallOuter;
	} else {
		tabInnerN = wallOuter - f.outwardSign * EMBED$2;
		tabOuterN = wallOuter + f.outwardSign * STRIKER_TAB_THICKNESS;
		strikerAxisN = tabOuterN;
		strikerZ = lidPlateTopZ + STRIKER_TAB_HEIGHT / 2;
	}
	const armKnuckle = makeKnuckleAlongTangent(f, armKnuckleU0, armKnuckleLen, pinAxisN, pivotZ, KNUCKLE_OUTER_R, 0);
	const bodyBotZ = pivotZ - KNUCKLE_OUTER_R + EMBED$2;
	const hookBotZ = strikerZ + STRIKER_R - CAM_PRELOAD + tolerance;
	const hookTopZ = hookBotZ + HOOK_VERTICAL;
	const bodyTopZ = hookTopZ;
	const armBodyInnerN = wallOuter + f.outwardSign * (HOOK_WALL_OFFSET + tolerance);
	const armBodyOuterN = armBodyInnerN + f.outwardSign * ARM_PLATE_THICKNESS;
	const ARM_BODY_RADIUS = .6;
	const armBody = makeBoxBetween(f, u0 - latch.width / 2, u0 + latch.width / 2, armBodyInnerN, armBodyOuterN, bodyBotZ, bodyTopZ, ARM_BODY_RADIUS);
	const hookInnerN = strikerAxisN - f.outwardSign * 2.5;
	const hookOuterN = armBodyInnerN + f.outwardSign * EMBED$2;
	const hook = makeBoxBetween(f, u0 - latch.width / 2, u0 + latch.width / 2, hookInnerN, hookOuterN, hookBotZ, hookTopZ, ARM_BODY_RADIUS);
	const arm = union$1([
		armKnuckle,
		armBody,
		hook
	]);
	const strikerLen = latch.width;
	const striker = makeKnuckleAlongTangent(f, u0 - strikerLen / 2, strikerLen, strikerAxisN, strikerZ, STRIKER_R, 0);
	let lidPart;
	if (lidShellMode) lidPart = striker;
	else {
		const tab = makeBoxBetween(f, u0 - latch.width / 2, u0 + latch.width / 2, tabInnerN, tabOuterN, lidPlateTopZ - EMBED$2, lidPlateTopZ + STRIKER_TAB_HEIGHT);
		lidPart = union$1([tab, striker]);
	}
	return {
		caseAdditive: [caseKnuckleA, caseKnuckleB],
		caseSubtract: [pinBore],
		lidAdditive: [lidPart],
		arm,
		pin
	};
}
/** Cylinder along the wall tangent, axis at (n=axisN, z=axisZ), spanning
*  [u0, u0+len] along the tangent. `embed` extends the cylinder INWARD
*  toward the wall by axially-symmetric extra radius — used by case
*  knuckles to overlap wall material volumetrically. */
function makeKnuckleAlongTangent(f, u0, len, axisN, axisZ, outerR, embed) {
	const r = outerR;
	const effectiveAxisN = axisN - f.outwardSign * embed;
	const cyl = cylinder(len, r, 24);
	if (f.wallAxis === "x") return translate([
		effectiveAxisN,
		u0,
		axisZ
	], {
		kind: "rotate",
		degrees: [
			-90,
			0,
			0
		],
		child: cyl
	});
	return translate([
		u0,
		effectiveAxisN,
		axisZ
	], {
		kind: "rotate",
		degrees: [
			0,
			90,
			0
		],
		child: cyl
	});
}
function makeBoreAlongTangent(f, u0, len, axisN, axisZ, r) {
	return makeKnuckleAlongTangent(f, u0, len, axisN, axisZ, r, 0);
}
/** Rectangular box (cube) spanning [u0,u1] along the wall tangent,
*  [n0,n1] along the wall normal, [z0,z1] along Z. Handles either sign
*  ordering of n0/n1. Optional `radius` rounds the FOUR vertical (Z-axis)
*  corners — the user-facing "soften the sharp arm body edges" knob. */
function makeBoxBetween(f, u0, u1, n0, n1, z0, z1, radius = 0) {
	const uMin = Math.min(u0, u1);
	const uMax = Math.max(u0, u1);
	const nMin = Math.min(n0, n1);
	const nMax = Math.max(n0, n1);
	const zMin = Math.min(z0, z1);
	const zMax = Math.max(z0, z1);
	const widthN = nMax - nMin;
	const widthU = uMax - uMin;
	const heightZ = zMax - zMin;
	const safeRadius = radius > 0 && widthN > 2 * radius + .2 && widthU > 2 * radius + .2 ? radius : 0;
	if (f.wallAxis === "x") {
		const prim = safeRadius > 0 ? roundedRectPrism(widthN, widthU, heightZ, safeRadius) : cube([
			widthN,
			widthU,
			heightZ
		]);
		return translate([
			nMin,
			uMin,
			zMin
		], prim);
	}
	const prim = safeRadius > 0 ? roundedRectPrism(widthU, widthN, heightZ, safeRadius) : cube([
		widthU,
		widthN,
		heightZ
	]);
	return translate([
		uMin,
		nMin,
		zMin
	], prim);
}

// vendor/casemaker/casemaker-app/src/engine/compiler/alignmentFlange.ts
const NO_HATS$8 = [];
const NO_RESOLVE$8 = () => void 0;
const NO_RESOLVE_DISPLAY$12 = () => void 0;
/**
* Pelican-standard ALIGNMENT FLANGE.
*
* Both the case rim and the lid bottom carry a horizontal BRIM that
* extends OUTWARD past the case envelope by the same distance as the
* wall ribbing. The two brims meet face-to-face when the lid is
* closed and have a matching tongue+groove for alignment — so the
* lid centers on the case during closing regardless of any o-ring
* seal in the rim middle.
*
*           [ Lid wall ]
*           [ Lid brim ──────────[ groove ]──────] ← lid-local z=[0, BRIM_T]
*                                  ↕              ← meeting plane (world z=outerZ)
*                                [ tongue ]
*           [ Case brim ────────────────────────] ← world z=[outerZ-BRIM_T, outerZ]
*           [ Case wall ]
*
* Brims sit OUTSIDE the case envelope (perimeter ring around the
* envelope footprint), so they never conflict with the seal channel
* (which lives in the middle of the rim wall material).
*
* Auto-emitted whenever the lid is in shell mode (lidCavityHeight > 0)
* and not recessed.
*/
const BRIM_T = 4;
const TONGUE_WIDTH = 2;
const FLANGE_MIN_DEPTH = 3;
const FLANGE_FALLBACK_DEPTH = 3;
const GUSSET_H = 6;
const GUSSET_LEG = 4;
const EMPTY = {
	caseAdditive: null,
	lidAdditive: null,
	lidSubtract: null
};
function buildAlignmentFlange(board, params, hats = NO_HATS$8, resolveHat = NO_RESOLVE$8, display = null, resolveDisplay = NO_RESOLVE_DISPLAY$12) {
	if (lidIsRecessed(params)) return EMPTY;
	if (lidCavityHeight(params) <= 0) return EMPTY;
	const dims = computeShellDims(board, params, hats, resolveHat, display, resolveDisplay);
	const flangeDepth = Math.max(FLANGE_MIN_DEPTH, params.rugged?.ribbing?.enabled && params.rugged.ribbing.ribDepth > 0 ? params.rugged.ribbing.ribDepth : FLANGE_FALLBACK_DEPTH);
	const brimOuterW = dims.outerX + 2 * flangeDepth;
	const brimOuterH = dims.outerY + 2 * flangeDepth;
	const brimOuterR = Math.max(0, params.cornerRadius + flangeDepth);
	const envelopeR = Math.max(0, params.cornerRadius);
	const EMBED = .5;
	const caseBrimZSpan = 4.5;
	const caseBrimZ0 = dims.outerZ - BRIM_T;
	const caseBrimSlab = roundedRectPrism(brimOuterW, brimOuterH, caseBrimZSpan, brimOuterR);
	const envelopeSubtract = translate([
		flangeDepth,
		flangeDepth,
		-.1
	], roundedRectPrism(dims.outerX, dims.outerY, 4.7, envelopeR));
	const caseBrimRing = difference([caseBrimSlab, envelopeSubtract]);
	const caseBrim = translate([
		-flangeDepth,
		-flangeDepth,
		caseBrimZ0 - EMBED
	], caseBrimRing);
	const gussets = [];
	if (flangeDepth >= 3.5) {
		const gussetBotZ = caseBrimZ0 - GUSSET_H;
		if (gussetBotZ < dims.outerZ - .5) {
			const gusset = (xCorner, yCorner) => {
				const xOrigin = xCorner === -1 ? -4 : dims.outerX;
				const yOrigin = yCorner === -1 ? -4 : dims.outerY;
				const xEmbed = xCorner === -1 ? -.5 : 0;
				const yEmbed = yCorner === -1 ? -.5 : 0;
				const xExtra = xCorner === -1 ? EMBED : EMBED;
				const yExtra = yCorner === -1 ? EMBED : EMBED;
				return translate([
					xOrigin + (xCorner === -1 ? 0 : xEmbed),
					yOrigin + (yCorner === -1 ? 0 : yEmbed),
					gussetBotZ
				], cube([
					GUSSET_LEG + xExtra,
					GUSSET_LEG + yExtra,
					6.5
				]));
			};
			gussets.push(gusset(-1, -1));
			gussets.push(gusset(1, -1));
			gussets.push(gusset(-1, 1));
			gussets.push(gusset(1, 1));
		}
	}
	const tongueCenterFromEnv = flangeDepth / 2;
	const tongueOuterDist = tongueCenterFromEnv + TONGUE_WIDTH / 2;
	const tongueInnerDist = tongueCenterFromEnv - TONGUE_WIDTH / 2;
	let caseAdditive = caseBrim;
	if (tongueInnerDist > 0 && true) {
		const tongueOuterW = dims.outerX + 2 * tongueOuterDist;
		const tongueOuterH = dims.outerY + 2 * tongueOuterDist;
		const tongueInnerW = dims.outerX + 2 * tongueInnerDist;
		const tongueInnerH = dims.outerY + 2 * tongueInnerDist;
		const tongueOuterR = Math.max(0, params.cornerRadius + tongueOuterDist);
		const tongueInnerR = Math.max(0, params.cornerRadius + tongueInnerDist);
		const tongueOuterSlab = roundedRectPrism(tongueOuterW, tongueOuterH, 2, tongueOuterR);
		const tongueInnerSlab = translate([
			TONGUE_WIDTH,
			TONGUE_WIDTH,
			-.1
		], roundedRectPrism(tongueInnerW, tongueInnerH, 2.2, tongueInnerR));
		const tongueRing = difference([tongueOuterSlab, tongueInnerSlab]);
		const tongue = translate([
			-tongueOuterDist,
			-tongueOuterDist,
			dims.outerZ - EMBED
		], tongueRing);
		caseAdditive = union$1([caseBrim, tongue]);
	}
	if (gussets.length > 0) caseAdditive = union$1([caseAdditive, ...gussets]);
	const lidBrimSlab = roundedRectPrism(brimOuterW, brimOuterH, 4.5, brimOuterR);
	const lidEnvelopeSubtract = translate([
		flangeDepth,
		flangeDepth,
		-.1
	], roundedRectPrism(dims.outerX, dims.outerY, 4.7, envelopeR));
	const lidBrimRing = difference([lidBrimSlab, lidEnvelopeSubtract]);
	const lidAdditive = translate([
		-flangeDepth,
		-flangeDepth,
		0
	], lidBrimRing);
	let lidSubtract = null;
	const grooveCenterFromEnv = flangeDepth / 2;
	const grooveWidth = 2.3;
	const grooveOuterDist = grooveCenterFromEnv + grooveWidth / 2;
	const grooveInnerDist = grooveCenterFromEnv - grooveWidth / 2;
	if (grooveInnerDist > 0 && true) {
		const grooveOuterW = dims.outerX + 2 * grooveOuterDist;
		const grooveOuterH = dims.outerY + 2 * grooveOuterDist;
		const grooveInnerW = dims.outerX + 2 * grooveInnerDist;
		const grooveInnerH = dims.outerY + 2 * grooveInnerDist;
		const grooveOuterR = Math.max(0, params.cornerRadius + grooveOuterDist);
		const grooveInnerR = Math.max(0, params.cornerRadius + grooveInnerDist);
		const grooveOuterSlab = roundedRectPrism(grooveOuterW, grooveOuterH, 2, grooveOuterR);
		const grooveInnerSlab = translate([
			grooveWidth,
			grooveWidth,
			-.1
		], roundedRectPrism(grooveInnerW, grooveInnerH, 2.2, grooveInnerR));
		const grooveRing = difference([grooveOuterSlab, grooveInnerSlab]);
		lidSubtract = translate([
			-grooveOuterDist,
			-grooveOuterDist,
			-.1
		], grooveRing);
	}
	return {
		caseAdditive,
		lidAdditive,
		lidSubtract
	};
}

// vendor/casemaker/casemaker-app/src/engine/compiler/rugged.ts
const NO_HATS$7 = [];
const NO_RESOLVE$7 = () => void 0;
const NO_RESOLVE_DISPLAY$11 = () => void 0;
function buildRuggedOps(board, params, hats = NO_HATS$7, resolveHat = NO_RESOLVE$7, display = null, resolveDisplay = NO_RESOLVE_DISPLAY$11) {
	const empty = {
		caseAdditive: [],
		lidAdditive: [],
		bumperNodes: []
	};
	if (!params.rugged?.enabled) return empty;
	const dims = computeShellDims(board, params, hats, resolveHat, display, resolveDisplay);
	const caseAdditive = [];
	const lidAdditive = [];
	const bumperNodes = [];
	const lidCavity = lidCavityHeight(params);
	const lidShellMode = lidCavity > 0 && !lidIsRecessed(params);
	const lidTotalZ = params.lidThickness + lidCavity;
	if (params.rugged.corners.enabled) {
		const c = buildCornerBumpers(dims, params, lidShellMode, lidTotalZ);
		const placeBumpers = (ops, target) => {
			target.push(...ops);
		};
		if (params.rugged.corners.flexBumper) [...c.caseCaps, ...c.lidCaps].forEach((op, i) => {
			bumperNodes.push({
				id: `bumper-${i}`,
				op
			});
		});
		else {
			placeBumpers(c.caseCaps, caseAdditive);
			placeBumpers(c.lidCaps, lidAdditive);
		}
	}
	if (params.rugged.ribbing.enabled) {
		const ribs = buildWallRibs(dims, params, lidShellMode, lidTotalZ);
		caseAdditive.push(...ribs.caseRibs);
		lidAdditive.push(...ribs.lidRibs);
	}
	if (params.rugged.feet.enabled) caseAdditive.push(...buildIntegratedFeet(dims, params));
	return {
		caseAdditive,
		lidAdditive,
		bumperNodes
	};
}
function buildCornerBumpers(dims, params, lidShellMode, lidTotalZ) {
	const corners = params.rugged.corners;
	const r = Math.max(0, corners.radius);
	if (r <= 0) return {
		caseCaps: [],
		lidCaps: []
	};
	const capHeight = Math.max(2, corners.capHeight ?? 12);
	const corners2D = [
		[0, 0],
		[dims.outerX, 0],
		[0, dims.outerY],
		[dims.outerX, dims.outerY]
	];
	const caseCaps = [];
	const lidCaps = [];
	const safeCapCase = Math.min(capHeight, dims.outerZ / 2 - 2);
	if (safeCapCase <= 0) return {
		caseCaps: [],
		lidCaps: []
	};
	for (const [x, y] of corners2D) {
		caseCaps.push(translate([
			x,
			y,
			0
		], chamferedCylinder(safeCapCase, r)));
		if (!lidShellMode) caseCaps.push(translate([
			x,
			y,
			dims.outerZ - safeCapCase
		], chamferedCylinder(safeCapCase, r)));
	}
	if (lidShellMode) {
		const safeCapLid = Math.min(capHeight, lidTotalZ / 2 - 2);
		if (safeCapLid > 0) for (const [x, y] of corners2D) lidCaps.push(translate([
			x,
			y,
			lidTotalZ - safeCapLid
		], chamferedCylinder(safeCapLid, r)));
	}
	return {
		caseCaps,
		lidCaps
	};
}
/** Tiny frustum at the top + bottom rim of a vertical bumper cylinder so
*  the edges read as gently rounded instead of printed-flat. The middle
*  cylinder + the two frustums are extended by SECTION_EMBED to overlap
*  volumetrically; otherwise their coplanar junction at z=CHAM_H and
*  z=height-CHAM_H produces a tiny zero-area sliver during manifold's
*  union, breaking the single-component invariant. */
function chamferedCylinder(height, r) {
	const CHAM_H = Math.min(.6, height * .15);
	const CHAM_R = Math.min(.6, r * .2);
	if (height <= 2 * CHAM_H + .4 || r <= CHAM_R + .4) return cylinder(height, r, 24);
	const innerR = r - CHAM_R;
	const SECTION_EMBED = .05;
	const bottom = {
		kind: "cylinder",
		height: CHAM_H + SECTION_EMBED,
		radiusLow: innerR,
		radiusHigh: r,
		segments: 24
	};
	const middle = translate([
		0,
		0,
		CHAM_H - SECTION_EMBED
	], cylinder(height - 2 * CHAM_H + 2 * SECTION_EMBED, r, 24));
	const top = translate([
		0,
		0,
		height - CHAM_H - SECTION_EMBED
	], {
		kind: "cylinder",
		height: CHAM_H + SECTION_EMBED,
		radiusLow: r,
		radiusHigh: innerR,
		segments: 24
	});
	return union$1([
		bottom,
		middle,
		top
	]);
}
function buildWallRibs(dims, params, lidShellMode, lidTotalZ) {
	const ribbing = params.rugged.ribbing;
	if (ribbing.ribCount <= 0) return {
		caseRibs: [],
		lidRibs: []
	};
	const caseRibs = [];
	const lidRibs = [];
	const clear = Math.max(0, ribbing.clearBand);
	const jointGap = lidShellMode ? 0 : 0;
	const ribZTop = dims.outerZ - clear - jointGap;
	const ribZBottom = clear;
	const ribZSpan = ribZTop - ribZBottom;
	if (ribZSpan <= 1) return {
		caseRibs: [],
		lidRibs: []
	};
	const ribDepth = ribbing.ribDepth;
	const EMBED = .5;
	const totalDepth = ribDepth + EMBED;
	const RIB_TAPER = 3;
	const emitRibs = (out, zBot, zSpan) => {
		if (zSpan <= 1) return;
		if (ribbing.direction === "vertical") {
			const RIB_W = 2;
			for (const wall of [
				"+x",
				"-x",
				"+y",
				"-y"
			]) {
				const stride = (wall === "+x" || wall === "-x" ? dims.outerY : dims.outerX) / (ribbing.ribCount + 1);
				for (let i = 1; i <= ribbing.ribCount; i++) {
					const tCenter = i * stride;
					out.push(buildTaperedVerticalRib(wall, tCenter, RIB_W, zBot, zBot + zSpan, ribDepth, EMBED, RIB_TAPER, dims));
				}
			}
		} else {
			const RIB_H = 2;
			const stride = zSpan / (ribbing.ribCount + 1);
			for (let i = 1; i <= ribbing.ribCount; i++) {
				const z = zBot + i * stride;
				out.push(translate([
					dims.outerX - EMBED,
					0,
					z - RIB_H / 2
				], cube([
					totalDepth,
					dims.outerY,
					RIB_H
				], false)));
				out.push(translate([
					-ribDepth,
					0,
					z - RIB_H / 2
				], cube([
					totalDepth,
					dims.outerY,
					RIB_H
				], false)));
				out.push(translate([
					0,
					dims.outerY - EMBED,
					z - RIB_H / 2
				], cube([
					dims.outerX,
					totalDepth,
					RIB_H
				], false)));
				out.push(translate([
					0,
					-ribDepth,
					z - RIB_H / 2
				], cube([
					dims.outerX,
					totalDepth,
					RIB_H
				], false)));
			}
		}
	};
	emitRibs(caseRibs, ribZBottom, ribZSpan);
	if (lidShellMode) {
		const lidRibBot = clear;
		emitRibs(lidRibs, lidRibBot, lidTotalZ - clear - lidRibBot);
	}
	const latches = params.latches ?? [];
	const RAMP_LEN = 3;
	const emitLatchRibs = (out, zBot, zSpan, zIsLidLocal) => {
		if (zSpan <= 1) return;
		const knuckleCenterZ = dims.outerZ - 22;
		const knuckleZBot = knuckleCenterZ - 4 - LATCH_RIB_KNUCKLE_PAD;
		const knuckleZTop = knuckleCenterZ + 4 + LATCH_RIB_KNUCKLE_PAD;
		for (const latch of latches) {
			if (!latch.enabled) continue;
			const positions = protectiveRibPositions(latch, dims);
			const ribCenters = [{
				center: positions.innerCenter,
				isCorner: false
			}, {
				center: positions.cornerCenter,
				isCorner: true
			}];
			for (const { center: tCenter, isCorner } of ribCenters) {
				const zTop = zBot + zSpan;
				const slices = [];
				const push = (z, depth) => {
					if (slices.length > 0 && Math.abs(slices[slices.length - 1].z - z) < .01) {
						slices[slices.length - 1].depth = depth;
						return;
					}
					slices.push({
						z,
						depth
					});
				};
				push(zBot, 0);
				push(Math.min(zBot + RIB_TAPER, zTop), 5);
				if (!zIsLidLocal && knuckleZBot < zTop && knuckleZTop > zBot) {
					const rampInZ = Math.max(zBot + RIB_TAPER, knuckleZBot - RAMP_LEN);
					const bumpBotZ = Math.max(zBot + RIB_TAPER, knuckleZBot);
					const bumpTopZ = Math.min(zTop - RIB_TAPER, knuckleZTop);
					const rampOutZ = Math.min(zTop - RIB_TAPER, knuckleZTop + RAMP_LEN);
					if (rampInZ > slices[slices.length - 1].z) push(rampInZ, 5);
					if (bumpBotZ > rampInZ - .01) push(bumpBotZ, 9);
					if (bumpTopZ > bumpBotZ - .01) push(bumpTopZ, 9);
					if (rampOutZ > bumpTopZ - .01) push(rampOutZ, 5);
				}
				push(Math.max(zBot, zTop - RIB_TAPER), 5);
				push(zTop, 0);
				let rib = buildSmoothLatchRib(latch.wall, tCenter, 3, slices, EMBED, dims);
				if (!zIsLidLocal && isCorner) {
					const holeR = LATCH_PIN_R + LATCH_PIN_HOLE_CLEAR;
					const capR = LATCH_PIN_CAP_R + LATCH_PIN_CAP_CLEAR_RADIAL;
					const capDepth = LATCH_PIN_CAP_LEN + LATCH_PIN_CAP_CLEAR_AXIAL;
					const sCorner = cornerSign(latch, dims);
					rib = difference([
						rib,
						buildPinHoleCutter(latch.wall, tCenter, holeR, knuckleCenterZ, dims),
						buildCapCounterSink(latch.wall, tCenter, capR, capDepth, knuckleCenterZ, sCorner, dims)
					]);
				}
				out.push(rib);
			}
		}
	};
	emitLatchRibs(caseRibs, ribZBottom, ribZSpan, false);
	if (lidShellMode) emitLatchRibs(lidRibs, clear, lidTotalZ - 2 * clear, true);
	return {
		caseRibs,
		lidRibs
	};
}
/** Smooth latch protective rib: a generalized-prism mesh built from a
*  sequence of (z, depth) slices. Each slice is a horizontal cross-section
*  with the same wall-side at n=-embed and a varying outer face at
*  n=depth. Adjacent slices connect with sloped quad faces — no segment
*  boundaries / no hard angular shoulders — so the contour reads as one
*  smooth continuous part as the user requested. */
function buildSmoothLatchRib(wall, tCenter, ribW, slices, embed, dims) {
	const axis = wall === "+x" || wall === "-x" ? "x" : "y";
	const sign = wall === "+x" || wall === "+y" ? 1 : -1;
	const wallOuter = wall === "-x" || wall === "-y" ? 0 : wall === "+x" ? dims.outerX : dims.outerY;
	const tStart = tCenter - ribW / 2;
	if (slices.length < 2) return cube([
		0,
		0,
		0
	]);
	const positions = [];
	function pushVert(t, n, z) {
		if (axis === "x") positions.push(wallOuter + sign * n, tStart + t, z);
		else positions.push(tStart + t, wallOuter + sign * n, z);
	}
	for (const s of slices) {
		pushVert(0, -embed, s.z);
		pushVert(0, s.depth, s.z);
		pushVert(ribW, -embed, s.z);
		pushVert(ribW, s.depth, s.z);
	}
	const N = slices.length;
	const idx = (i, k) => i * 4 + k;
	const tris = [];
	tris.push(idx(0, 0), idx(0, 2), idx(0, 3));
	tris.push(idx(0, 0), idx(0, 3), idx(0, 1));
	tris.push(idx(N - 1, 0), idx(N - 1, 1), idx(N - 1, 3));
	tris.push(idx(N - 1, 0), idx(N - 1, 3), idx(N - 1, 2));
	for (let i = 0; i < N - 1; i++) {
		tris.push(idx(i, 0), idx(i + 1, 0), idx(i + 1, 2));
		tris.push(idx(i, 0), idx(i + 1, 2), idx(i, 2));
		tris.push(idx(i, 1), idx(i, 3), idx(i + 1, 3));
		tris.push(idx(i, 1), idx(i + 1, 3), idx(i + 1, 1));
		tris.push(idx(i, 0), idx(i, 1), idx(i + 1, 1));
		tris.push(idx(i, 0), idx(i + 1, 1), idx(i + 1, 0));
		tris.push(idx(i, 2), idx(i + 1, 2), idx(i + 1, 3));
		tris.push(idx(i, 2), idx(i + 1, 3), idx(i, 3));
	}
	if (axis === "x" && sign === -1 || axis === "y" && sign === 1) for (let i = 0; i < tris.length; i += 3) {
		const swap = tris[i + 1];
		tris[i + 1] = tris[i + 2];
		tris[i + 2] = swap;
	}
	return mesh(new Float32Array(positions), new Uint32Array(tris));
}
/** A horizontal cylinder along the wall tangent at the latch pin axis,
*  long enough to pierce a single protective rib. Used as a subtractor
*  on the corner-facing rib so the print-in-place pin can pass through. */
function buildPinHoleCutter(wall, ribTCenter, holeR, pinZ, dims) {
	const axis = wall === "+x" || wall === "-x" ? "x" : "y";
	const sign = wall === "+x" || wall === "+y" ? 1 : -1;
	const pinAxisN = (wall === "-x" || wall === "-y" ? 0 : wall === "+x" ? dims.outerX : dims.outerY) + sign * 4;
	const cutLen = 3 + 2;
	const cyl = cylinder(cutLen, holeR, 24);
	const oriented = axis === "x" ? rotate([
		-90,
		0,
		0
	], cyl) : rotate([
		0,
		90,
		0
	], cyl);
	if (axis === "x") return translate([
		pinAxisN,
		ribTCenter - cutLen / 2,
		pinZ
	], oriented);
	return translate([
		ribTCenter - cutLen / 2,
		pinAxisN,
		pinZ
	], oriented);
}
/** Counter-sink cylinder for the pin cap: wider than the through-hole,
*  recessed inward from the rib's CORNER-FACING outer face by capDepth.
*  When the pin is fully inserted the cap bottoms out against the inner
*  end of this counter-sink, leaving the cap's outer face flush with the
*  rib's outer face (with LATCH_PIN_CAP_CLEAR_AXIAL of axial slop so the
*  pin actually slides). */
function buildCapCounterSink(wall, ribTCenter, capR, capDepth, pinZ, sCorner, dims) {
	const axis = wall === "+x" || wall === "-x" ? "x" : "y";
	const sign = wall === "+x" || wall === "+y" ? 1 : -1;
	const pinAxisN = (wall === "-x" || wall === "-y" ? 0 : wall === "+x" ? dims.outerX : dims.outerY) + sign * 4;
	const halfRibW = 3 / 2;
	const overshoot = .5;
	const totalLen = capDepth + overshoot;
	const baseT = sCorner === 1 ? ribTCenter + halfRibW - capDepth : ribTCenter - halfRibW - overshoot;
	const cyl = cylinder(totalLen, capR, 24);
	const oriented = axis === "x" ? rotate([
		-90,
		0,
		0
	], cyl) : rotate([
		0,
		90,
		0
	], cyl);
	if (axis === "x") return translate([
		pinAxisN,
		baseT,
		pinZ
	], oriented);
	return translate([
		baseT,
		pinAxisN,
		pinZ
	], oriented);
}
/** Tapered vertical rib: hexagonal cross-section in the (wall-normal,
*  Z) plane extruded along the wall tangent for `ribW`. The hexagon has
*  a flat outer face spanning the middle Z range and a slope at top +
*  bottom that ramps from no outward protrusion (at the very edge) up
*  to full ribDepth at z=zBot+taper / z=zTop-taper. The wall-side face
*  is fully embedded into the wall material throughout. */
function buildTaperedVerticalRib(wall, tCenter, ribW, zBot, zTop, ribDepth, embed, taper, dims) {
	return buildTaperedVerticalRibAsymmetric(wall, tCenter, ribW, zBot, zTop, ribDepth, embed, taper, taper, dims);
}
/** Same as buildTaperedVerticalRib but with independent top + bottom
*  taper lengths. Used by the protective-latch-rib stack so segments
*  meet at full depth (small `0.6` mm taper at shared boundaries) while
*  the outer ends keep the full `RIB_TAPER` for the smooth wall fade. */
function buildTaperedVerticalRibAsymmetric(wall, tCenter, ribW, zBot, zTop, ribDepth, embed, taperBot, taperTop, dims) {
	const axis = wall === "+x" || wall === "-x" ? "x" : "y";
	const sign = wall === "+x" || wall === "+y" ? 1 : -1;
	const wallOuter = wall === "-x" || wall === "-y" ? 0 : wall === "+x" ? dims.outerX : dims.outerY;
	const tStart = tCenter - ribW / 2;
	const span = zTop - zBot;
	const maxCombined = Math.max(0, span * .9);
	let effTaperBot = Math.max(0, taperBot);
	let effTaperTop = Math.max(0, taperTop);
	if (effTaperBot + effTaperTop > maxCombined) {
		const scale = maxCombined / (effTaperBot + effTaperTop);
		effTaperBot *= scale;
		effTaperTop *= scale;
	}
	if (effTaperBot < .1 && effTaperTop < .1) {
		if (axis === "x") {
			const x0 = sign === -1 ? wallOuter - ribDepth : wallOuter - embed;
			return translate([
				x0,
				tStart,
				zBot
			], cube([
				embed + ribDepth,
				ribW,
				span
			], false));
		}
		const y0 = sign === -1 ? wallOuter - ribDepth : wallOuter - embed;
		return translate([
			tStart,
			y0,
			zBot
		], cube([
			ribW,
			embed + ribDepth,
			span
		], false));
	}
	const positions = [];
	function pushVert(t, n, z) {
		if (axis === "x") positions.push(wallOuter + sign * n, tStart + t, z);
		else positions.push(tStart + t, wallOuter + sign * n, z);
	}
	const bMidY = effTaperBot > .05 ? 0 : ribDepth;
	const eMidY = effTaperTop > .05 ? 0 : ribDepth;
	pushVert(0, -embed, zBot);
	pushVert(0, bMidY, zBot);
	pushVert(0, ribDepth, zBot + effTaperBot);
	pushVert(0, ribDepth, zTop - effTaperTop);
	pushVert(0, eMidY, zTop);
	pushVert(0, -embed, zTop);
	pushVert(ribW, -embed, zBot);
	pushVert(ribW, bMidY, zBot);
	pushVert(ribW, ribDepth, zBot + effTaperBot);
	pushVert(ribW, ribDepth, zTop - effTaperTop);
	pushVert(ribW, eMidY, zTop);
	pushVert(ribW, -embed, zTop);
	const inverted = axis === "x" && sign === 1 || axis === "y" && sign === -1;
	const tris = [
		0,
		5,
		4,
		0,
		4,
		3,
		0,
		3,
		2,
		0,
		2,
		1,
		6,
		7,
		8,
		6,
		8,
		9,
		6,
		9,
		10,
		6,
		10,
		11,
		0,
		1,
		7,
		0,
		7,
		6,
		1,
		2,
		8,
		1,
		8,
		7,
		2,
		3,
		9,
		2,
		9,
		8,
		3,
		4,
		10,
		3,
		10,
		9,
		4,
		5,
		11,
		4,
		11,
		10,
		5,
		0,
		6,
		5,
		6,
		11
	];
	if (inverted) for (let i = 0; i < tris.length; i += 3) {
		const swap = tris[i + 1];
		tris[i + 1] = tris[i + 2];
		tris[i + 2] = swap;
	}
	return mesh(new Float32Array(positions), new Uint32Array(tris));
}
function buildIntegratedFeet(dims, params) {
	const feet = params.rugged.feet;
	const r = feet.padDiameter / 2;
	const cylHeight = feet.padHeight + 1;
	const pads4 = [
		[r + 1, r + 1],
		[dims.outerX - r - 1, r + 1],
		[r + 1, dims.outerY - r - 1],
		[dims.outerX - r - 1, dims.outerY - r - 1]
	];
	const pads6 = [
		...pads4,
		[dims.outerX / 2, r + 1],
		[dims.outerX / 2, dims.outerY - r - 1]
	];
	return (feet.pads === 6 ? pads6 : pads4).map(([x, y]) => translate([
		x,
		y,
		-feet.padHeight
	], cylinder(cylHeight, r, 24)));
}

// vendor/casemaker/casemaker-app/src/engine/compiler/roundCutout.ts
/**
* Build a round cutout occupying the same axis-aligned bounding box that a
* rectangular cutout would. The cylinder's axis is parallel to the wall the
* cutout pierces (derived from `facing`); its diameter matches the larger of
* the two perpendicular dimensions. Used for connectors with circular bodies
* such as XLR-3, SMA, U.FL panel mounts, where a rectangular hole would leave
* a visible gap around the connector body.
*/
function buildAxisAlignedCutout(facing, xMin, yMin, zMin, sizeX, sizeY, sizeZ, shape, segments = 48) {
	if (shape === "rect" || facing === "+z") return translate([
		xMin,
		yMin,
		zMin
	], cube([
		sizeX,
		sizeY,
		sizeZ
	], false));
	switch (facing) {
		case "+y":
		case "-y": {
			const radius = Math.max(sizeX, sizeZ) / 2;
			const cyl = cylinder(sizeY, radius, segments);
			const rotated = rotate([
				-90,
				0,
				0
			], cyl);
			const cx = xMin + sizeX / 2;
			const cz = zMin + sizeZ / 2;
			return translate([
				cx,
				yMin,
				cz
			], rotated);
		}
		case "+x":
		case "-x": {
			const radius = Math.max(sizeY, sizeZ) / 2;
			const cyl = cylinder(sizeX, radius, segments);
			const rotated = rotate([
				0,
				90,
				0
			], cyl);
			const cy = yMin + sizeY / 2;
			const cz = zMin + sizeZ / 2;
			return translate([
				xMin,
				cy,
				cz
			], rotated);
		}
		case "-z": {
			const radius = Math.max(sizeX, sizeY) / 2;
			const cyl = cylinder(sizeZ, radius, segments);
			const cx = xMin + sizeX / 2;
			const cy = yMin + sizeY / 2;
			return translate([
				cx,
				cy,
				zMin
			], cyl);
		}
		default: return translate([
			xMin,
			yMin,
			zMin
		], cube([
			sizeX,
			sizeY,
			sizeZ
		], false));
	}
}

// vendor/casemaker/casemaker-app/src/engine/compiler/hatOrientation.ts
/**
* Resolve the mounting position to apply for a placement.
*  - Profile has no mountingPositions → identity (rotation 0, offset 0)
*  - Placement names a mountingPositionId → that one
*  - Otherwise the first declared position
*/
function resolveMountingPosition(profile, placement) {
	if (!profile.mountingPositions || profile.mountingPositions.length === 0) return {
		id: "default",
		label: "Default",
		offset: {
			x: 0,
			y: 0
		},
		rotation: 0
	};
	return (placement.mountingPositionId ? profile.mountingPositions.find((p) => p.id === placement.mountingPositionId) : void 0) ?? profile.mountingPositions[0];
}
const FACING_AT_0 = [
	"+x",
	"+y",
	"-x",
	"-y"
];
function rotateFacing(facing, rotation) {
	if (facing === "+z") return "+z";
	const idx = FACING_AT_0.indexOf(facing);
	if (idx < 0) return facing;
	const steps = rotation / 90 | 0;
	return FACING_AT_0[(idx + steps) % 4];
}
/**
* Rotate a port position around the HAT PCB center, then apply the position
* offset. Size axes swap on 90/270° rotations.
*/
function applyMountingPosition(port, pcb, pos) {
	const cx = pcb.x / 2;
	const cy = pcb.y / 2;
	const px = port.position.x - cx;
	const py = port.position.y - cy;
	let rx = px;
	let ry = py;
	let sx = port.size.x;
	let sy = port.size.y;
	switch (pos.rotation) {
		case 0: break;
		case 90:
			rx = -py;
			ry = px;
			sx = port.size.y;
			sy = port.size.x;
			break;
		case 180:
			rx = -px;
			ry = -py;
			break;
		case 270:
			rx = py;
			ry = -px;
			sx = port.size.y;
			sy = port.size.x;
	}
	const offsetForBbox = (() => {
		switch (pos.rotation) {
			case 0: return {
				x: 0,
				y: 0
			};
			case 90: return {
				x: -port.size.y,
				y: 0
			};
			case 180: return {
				x: -port.size.x,
				y: -port.size.y
			};
			case 270: return {
				x: 0,
				y: -port.size.x
			};
		}
	})();
	return {
		...port,
		position: {
			x: rx + cx + pos.offset.x + offsetForBbox.x,
			y: ry + cy + pos.offset.y + offsetForBbox.y,
			z: port.position.z
		},
		size: {
			x: sx,
			y: sy,
			z: port.size.z
		},
		facing: rotateFacing(port.facing, pos.rotation)
	};
}
/** Apply mounting position to every port in a placement. */
function transformPlacementPorts(placement, profile) {
	const pos = resolveMountingPosition(profile, placement);
	if (pos.rotation === 0 && pos.offset.x === 0 && pos.offset.y === 0) return placement.ports;
	return placement.ports.map((p) => applyMountingPosition(p, profile.pcb.size, pos));
}

// node_modules/nanoid/url-alphabet/index.js
let urlAlphabet = "57X6y3wQZNzYjJB2L_10pxbackgroundhimselfUTF-8DEMOGRAPHICSVqvt4KW9";

// node_modules/nanoid/index.js
const GET_RANDOM_LIMIT = 65536;
function fillRandom(buffer) {
	let from = 0;
	while (from < buffer.length) {
		let to = Math.min(from + GET_RANDOM_LIMIT, buffer.length);
		crypto.getRandomValues(buffer.subarray(from, to));
		from = to;
	}
}
function random(bytes) {
	bytes |= 0;
	if (bytes < 0) throw new RangeError("Wrong ID size");
	let buffer = Buffer.allocUnsafe(bytes);
	fillRandom(buffer);
	return buffer;
}
function customRandom(alphabet, defaultSize, getRandom) {
	let safeByteCutoff = 256 - 256 % alphabet.length;
	if (safeByteCutoff === 256) {
		let mask = alphabet.length - 1;
		return (size = defaultSize) => {
			if (!size) return "";
			let id = "";
			while (true) {
				let bytes = getRandom(size);
				let i = size |= 0;
				while (i--) {
					id += alphabet[bytes[i] & mask];
					if (id.length >= size) return id;
				}
			}
		};
	}
	return (size = defaultSize) => {
		if (!size) return "";
		let id = "";
		let step = Math.ceil(409.6 * size / safeByteCutoff);
		while (true) {
			let bytes = getRandom(step);
			let i = step;
			while (i--) if (bytes[i] < safeByteCutoff) {
				id += alphabet[bytes[i] % alphabet.length];
				if (id.length >= size) return id;
			}
		}
	};
}
const POOL_MAX = GET_RANDOM_LIMIT / 2;
function customAlphabet(alphabet, defaultSize = 21) {
	if (typeof alphabet !== "string" || !alphabet || alphabet.length > 256) return customRandom(alphabet, defaultSize, random);
	for (let i = 0; i < alphabet.length; i++) if (alphabet.charCodeAt(i) > 255) return customRandom(alphabet, defaultSize, random);
	let charCodes = Uint8Array.from(alphabet, (str) => {
		return str.charCodeAt(0);
	});
	let alphabetLen = alphabet.length;
	let mask = (2 << 31 - Math.clz32(alphabetLen - 1 | 1)) - 1;
	let pool = "";
	let poolOffset = 0;
	let poolNext = 0;
	return (size = defaultSize) => {
		size |= 0;
		if (size < 0) throw new RangeError("Wrong ID size");
		if (size === 0) return "";
		if (poolOffset + size > pool.length) {
			let target = Math.max(poolNext, size);
			poolNext = Math.min(target * 16, POOL_MAX);
			let buffer = Buffer.allocUnsafe(target);
			if (mask === alphabetLen - 1) {
				fillRandom(buffer);
				for (let i = 0; i < target; i++) buffer[i] = charCodes[buffer[i] & mask];
			} else {
				let randomBytes = Buffer.allocUnsafe(Math.ceil(1.6 * (mask + 1) * target / alphabetLen));
				let accepted = 0;
				while (accepted < target) {
					fillRandom(randomBytes);
					for (let i = 0; i < randomBytes.length; i++) {
						let index = randomBytes[i] & mask;
						if (index < alphabetLen) {
							buffer[accepted++] = charCodes[index];
							if (accepted === target) break;
						}
					}
				}
			}
			pool = buffer.toString("latin1");
			poolOffset = 0;
		}
		poolOffset += size;
		return pool.substring(poolOffset - size, poolOffset);
	};
}
const nanoid$1 = customAlphabet(urlAlphabet);

// vendor/casemaker/casemaker-app/src/utils/id.ts
const nano = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 10);

// vendor/casemaker/casemaker-app/src/engine/compiler/hats.ts
const OVERSHOOT$1 = 1;
/**
* Compute, for each enabled HAT placement, the world-frame Z offset of its PCB
* bottom (= host PCB top + headerHeight + previous-stack contributions).
*/
function computeHatBaseZ(board, params, hats, resolveHat) {
	const out = /* @__PURE__ */ new Map();
	const ordered = [...hats].sort((a, b) => a.stackIndex - b.stackIndex);
	const hostTallest = board.components.reduce((m, c) => Math.max(m, c.position.z + c.size.z), 0);
	let cursor = params.floorThickness + board.defaultStandoffHeight + board.pcb.size.z;
	let firstEnabled = true;
	for (const placement of ordered) {
		const profile = resolveHat(placement.hatId);
		if (!profile) continue;
		let lift = placement.liftOverride ?? profile.headerHeight;
		if (placement.enabled && firstEnabled && hostTallest > 0) lift = Math.max(lift, hostTallest + HOST_HAT_CLEARANCE);
		if (placement.enabled) firstEnabled = false;
		cursor += lift;
		if (placement.enabled) out.set(placement.id, cursor);
		cursor += profile.pcb.size.z;
		const tallestPlus = profile.components.reduce((m, c) => Math.max(m, c.position.z + c.size.z), 0);
		cursor += tallestPlus;
	}
	return out;
}
/**
* Build wall-piercing cutouts for a HAT placement's enabled ports.
* Each cutout is sized like a board-port cutout but anchored at the HAT's PCB-Z.
*/
function buildHatCutoutsForProject(board, params, hats, resolveHat) {
	if (!hats || hats.length === 0) return [];
	const baseZ = computeHatBaseZ(board, params, hats, resolveHat);
	const ops = [];
	const { wallThickness: wall } = params;
	const cl = cavityClearance(params);
	const pcbXY = board.pcb.size;
	for (const placement of hats) {
		if (!placement.enabled) continue;
		const profile = resolveHat(placement.hatId);
		if (!profile) continue;
		const z0 = baseZ.get(placement.id);
		if (z0 === void 0) continue;
		const offsetX = placement.offsetOverride?.x ?? 0;
		const offsetY = placement.offsetOverride?.y ?? 0;
		const transformedPorts = transformPlacementPorts(placement, profile);
		for (const port of transformedPorts) {
			if (!port.enabled) continue;
			if (port.facing === "+z") continue;
			const m = port.cutoutMargin;
			let xMin = port.position.x + offsetX - m;
			let xMax = port.position.x + offsetX + port.size.x + m;
			let yMin = port.position.y + offsetY - m;
			let yMax = port.position.y + offsetY + port.size.y + m;
			const zMin = z0 + port.position.z - m - profile.pcb.size.z;
			const zMax = z0 + port.position.z + port.size.z + m - profile.pcb.size.z;
			switch (port.facing) {
				case "-x":
					xMin = -(wall + cl.xMin) - OVERSHOOT$1;
					break;
				case "+x":
					xMax = pcbXY.x + cl.xMax + wall + OVERSHOOT$1;
					break;
				case "-y":
					yMin = -(wall + cl.yMin) - OVERSHOOT$1;
					break;
				case "+y": yMax = pcbXY.y + cl.yMax + wall + OVERSHOOT$1;
			}
			const sizeX = xMax - xMin;
			const sizeY = yMax - yMin;
			const sizeZ = zMax - zMin;
			if (sizeX <= 0 || sizeY <= 0 || sizeZ <= 0) continue;
			const wx = wall + cl.xMin + xMin;
			const wy = wall + cl.yMin + yMin;
			const wz = zMin;
			ops.push(buildAxisAlignedCutout(port.facing, wx, wy, wz, sizeX, sizeY, sizeZ, port.cutoutShape ?? "rect"));
		}
	}
	return ops;
}

// vendor/casemaker/casemaker-app/src/engine/compiler/lid.ts
const NO_HATS$6 = [];
const NO_RESOLVE$6 = () => void 0;
const NO_RESOLVE_DISPLAY$10 = () => void 0;
const LID_POST_BOARD_CLEARANCE = .3;
const POST_CEILING_EMBED = .5;
const RECESS_LEDGE = 1;
const RECESS_CLEARANCE = .2;
const SNAP_FRICTION = .2;
const SNAP_LIP_DEPTH = 4;
/**
* Recessed-lid pocket dimensions (issue #30). The lid drops into the top of
* the case, sitting on a 1mm horizontal ledge with a small clearance around
* the perimeter. Returns null when the lid isn't recessed — which includes
* every clamshell project (#117), whose lid sits ON the rim.
*/
function computeRecessDims(board, params, hats = NO_HATS$6, resolveHat = NO_RESOLVE$6, display = null, resolveDisplay = NO_RESOLVE_DISPLAY$10) {
	if (!lidIsRecessed(params)) return null;
	const dims = computeShellDims(board, params, hats, resolveHat, display, resolveDisplay);
	const offset = Math.max(.5, params.wallThickness - .5);
	return {
		pocketX: dims.cavityX + 2 * offset,
		pocketY: dims.cavityY + 2 * offset,
		pocketZ: params.lidThickness,
		ledge: RECESS_LEDGE,
		clearance: RECESS_CLEARANCE
	};
}
function computeLidDims(board, params, hats = NO_HATS$6, resolveHat = NO_RESOLVE$6, display = null, resolveDisplay = NO_RESOLVE_DISPLAY$10) {
	const dims = computeShellDims(board, params, hats, resolveHat, display, resolveDisplay);
	const recess = computeRecessDims(board, params, hats, resolveHat, display, resolveDisplay);
	if (recess) return {
		x: recess.pocketX - 2 * recess.clearance,
		y: recess.pocketY - 2 * recess.clearance,
		z: params.lidThickness,
		zPosition: dims.outerZ - params.lidThickness,
		liftAboveShell: 6
	};
	const cavityHeight = lidCavityHeight(params);
	return {
		x: dims.outerX,
		y: dims.outerY,
		z: params.lidThickness + cavityHeight,
		zPosition: dims.outerZ,
		liftAboveShell: 2
	};
}
/**
* Build the lid posts that clamp the board from above. Used by every joint type
* (issue #27): a flat-lid case still needs the posts to retain the board, the
* only difference is whether the post carries a screw clearance hole.
*/
function buildLidPosts(board, params, hats = NO_HATS$6, resolveHat = NO_RESOLVE$6, display = null, resolveDisplay = NO_RESOLVE_DISPLAY$10) {
	const dims = computeShellDims(board, params, hats, resolveHat, display, resolveDisplay);
	const placements = computeBossPlacements(board, params);
	const standoff = board.defaultStandoffHeight;
	let anchorTopWorld = params.floorThickness + standoff + board.pcb.size.z;
	const enabledHats = (hats ?? []).filter((h) => h.enabled);
	if (enabledHats.length > 0) {
		const baseZ = computeHatBaseZ(board, params, enabledHats, resolveHat);
		for (const placement of enabledHats) {
			const profile = resolveHat(placement.hatId);
			const z0 = baseZ.get(placement.id);
			if (!profile || z0 === void 0) continue;
			const top = z0 + profile.components.reduce((m, c) => Math.max(m, c.position.z + c.size.z), profile.pcb.size.z);
			if (top > anchorTopWorld) anchorTopWorld = top;
		}
	}
	const lidBottomWorld = dims.outerZ;
	const postLength = Math.max(0, lidBottomWorld - anchorTopWorld - LID_POST_BOARD_CLEARANCE);
	if (postLength <= 0 || placements.length === 0) return {
		posts: [],
		holes: [],
		postLength
	};
	const screwDia = params.joint === "screw-down" ? getScrewClearanceDiameter(params.bosses.insertType) : 0;
	const postPlacements = placements.some((b) => b.position === "top") ? [] : placements.filter((b) => b.position === "bottom");
	const cavityHeight = lidCavityHeight(params);
	const postTopLocal = cavityHeight > 0 ? cavityHeight + POST_CEILING_EMBED : 0;
	return {
		posts: postPlacements.map((b) => translate([
			b.x,
			b.y,
			-postLength
		], cylinder(postLength + postTopLocal, b.outerDiameter / 2, 32))),
		holes: screwDia > 0 ? postPlacements.map((b) => {
			const totalH = params.lidThickness + postLength + postTopLocal + 1;
			return translate([
				b.x,
				b.y,
				-postLength - .5
			], cylinder(totalH, screwDia / 2, 24));
		}) : [],
		postLength
	};
}
function attachPosts(plate, posts, holes) {
	if (posts.length === 0) return plate;
	const solid = union$1([plate, ...posts]);
	return holes.length > 0 ? difference([solid, ...holes]) : solid;
}
/**
* Lid body without posts — shared between the flat-lid and (cavity-mode)
* snap-fit branches so both paths produce the same Pelican-style shell
* when lidCavityHeight > 0. Issue #125: previously buildSnapFitLid emitted
* just a thin plate, so latch/hinge/rugged/seal/flange features sized for
* the tall cavity-mode lid orphaned into 20+ disjoint components when the
* user toggled joint to snap-fit on a hinged template.
*/
function buildLidBody(board, params, hats, resolveHat, display, resolveDisplay) {
	const lid = computeLidDims(board, params, hats, resolveHat, display, resolveDisplay);
	const cavityHeight = lidCavityHeight(params);
	const outerR = lidOuterCornerRadius(params);
	if (cavityHeight <= 0) return roundedRectPrism(lid.x, lid.y, lid.z, outerR);
	const wall = params.wallThickness;
	const innerR = Math.max(0, outerR - wall);
	const outer = roundedRectPrism(lid.x, lid.y, lid.z, outerR);
	const overshoot = .1;
	const innerW = lid.x - 2 * wall;
	const innerH = lid.y - 2 * wall;
	if (innerW <= 0 || innerH <= 0) return outer;
	const cavity = translate([
		wall,
		wall,
		-.1
	], roundedRectPrism(innerW, innerH, cavityHeight + overshoot, innerR));
	return difference([outer, cavity]);
}
function buildFlatLid(board, params, hats = NO_HATS$6, resolveHat = NO_RESOLVE$6, display = null, resolveDisplay = NO_RESOLVE_DISPLAY$10) {
	const body = buildLidBody(board, params, hats, resolveHat, display, resolveDisplay);
	const { posts, holes } = buildLidPosts(board, params, hats, resolveHat, display, resolveDisplay);
	return attachPosts(body, posts, holes);
}
/**
* Issue #81 — vertical-corner radius applied to the lid plate. For a
* recessed lid the pocket radius determines this; for a flat lid the case
* envelope's outer radius matches the rim. cornerRadius=0 returns 0 and
* roundedRectPrism falls back to a plain cube for byte-identical legacy.
*/
function lidOuterCornerRadius(params) {
	return Math.max(0, params.cornerRadius);
}
function lidRecessedCornerRadius(params) {
	return Math.max(0, params.cornerRadius);
}
function buildSnapFitLid(board, params, hats = NO_HATS$6, resolveHat = NO_RESOLVE$6, display = null, resolveDisplay = NO_RESOLVE_DISPLAY$10) {
	const topPlate = buildLidBody(board, params, hats, resolveHat, display, resolveDisplay);
	const { posts, holes } = buildLidPosts(board, params, hats, resolveHat, display, resolveDisplay);
	if (params.snapType !== "full-lid") return attachPosts(topPlate, posts, holes);
	const lipRing = buildFullLidFrictionLip(board, params, hats, resolveHat, display, resolveDisplay);
	if (!lipRing) return attachPosts(topPlate, posts, holes);
	const withPosts = posts.length > 0 ? union$1([
		topPlate,
		lipRing,
		...posts
	]) : union$1([topPlate, lipRing]);
	return holes.length > 0 ? difference([withPosts, ...holes]) : withPosts;
}
/**
* Continuous-perimeter friction lip for the Full-Lid snap variant. Returns a
* hollow rectangular ring extruded DOWN by SNAP_LIP_DEPTH from the lid-plate
* underside, sized to friction-fit between the cavity walls.
*
* Returns null when the cavity is too narrow to host a lip wide enough to
* survive the print (issue #42 degenerate-cavity guard).
*
* Used by buildSnapFitLid AND by the lidRecess + full-lid combo path.
*/
function buildFullLidFrictionLip(board, params, hats = NO_HATS$6, resolveHat = NO_RESOLVE$6, display = null, resolveDisplay = NO_RESOLVE_DISPLAY$10) {
	const dims = computeShellDims(board, params, hats, resolveHat, display, resolveDisplay);
	const wall = params.wallThickness;
	const lipOuterX = dims.cavityX - 2 * SNAP_FRICTION;
	const lipOuterY = dims.cavityY - 2 * SNAP_FRICTION;
	const lipOriginX = wall + SNAP_FRICTION;
	const lipOriginY = wall + SNAP_FRICTION;
	const lipWallNominal = Math.max(.8, wall - .6);
	const minInnerDim = 1;
	const maxLipWallX = (lipOuterX - minInnerDim) / 2;
	const maxLipWallY = (lipOuterY - minInnerDim) / 2;
	const lipWall = Math.min(lipWallNominal, maxLipWallX, maxLipWallY);
	if (lipOuterX <= minInnerDim || lipOuterY <= minInnerDim || lipWall < .4) return null;
	const lipInnerX = lipOuterX - 2 * lipWall;
	const lipInnerY = lipOuterY - 2 * lipWall;
	const lipOuter = translate([
		lipOriginX,
		lipOriginY,
		-4
	], cube([
		lipOuterX,
		lipOuterY,
		SNAP_LIP_DEPTH
	], false));
	const lipInner = translate([
		lipOriginX + lipWall,
		lipOriginY + lipWall,
		-4.5
	], cube([
		lipInnerX,
		lipInnerY,
		5
	], false));
	return difference([lipOuter, lipInner]);
}
function buildScrewDownLid(board, params, hats = NO_HATS$6, resolveHat = NO_RESOLVE$6, display = null, resolveDisplay = NO_RESOLVE_DISPLAY$10) {
	const dims = computeShellDims(board, params, hats, resolveHat, display, resolveDisplay);
	const plate = roundedRectPrism(dims.outerX, dims.outerY, params.lidThickness, lidOuterCornerRadius(params));
	const { posts, holes } = buildLidPosts(board, params, hats, resolveHat, display, resolveDisplay);
	return attachPosts(plate, posts, holes);
}
/**
* Issue #122 — extension tab on a recessed lid that bridges the lid plate's
* hinge-side edge out to the hinge knuckle bodies (which sit OUTSIDE the
* case envelope). Without this the recessed lid plate doesn't reach the
* knuckle XY positions and the lid splits into [plate, knuckle-1, …]
* disconnected components.
*
* Returns null when no hinge is configured or the hinge isn't on a side
* face (±x / ±y).
*/
function buildHingeLidExtension(board, params, hats, resolveHat, display, resolveDisplay, plateOriginX, plateOriginY, lid) {
	const hinge = params.hinge;
	if (!hinge?.enabled) return null;
	const dims = computeShellDims(board, params, hats, resolveHat, display, resolveDisplay);
	const knuckleR = hinge.knuckleOuterDiameter / 2;
	const tabU = hinge.hingeLength + 2;
	const EMBED_PLATE = .5;
	const EMBED_KNUCKLE = .5;
	const plateEdgeX = plateOriginX;
	const plateEdgeXMax = plateOriginX + lid.x;
	const plateEdgeY = plateOriginY;
	const plateEdgeYMax = plateOriginY + lid.y;
	const uStart = ((hinge.face === "+x" || hinge.face === "-x" ? dims.outerY : dims.outerX) - hinge.hingeLength) / 2 - 1;
	const tabZ = lid.z;
	switch (hinge.face) {
		case "+y": {
			const yStart = plateEdgeYMax - EMBED_PLATE;
			const yLen = dims.outerY + knuckleR + EMBED_KNUCKLE - yStart;
			if (yLen <= 0) return null;
			return translate([
				uStart,
				yStart,
				0
			], cube([
				tabU,
				yLen,
				tabZ
			], false));
		}
		case "-y": {
			const yEnd = plateEdgeY + EMBED_PLATE;
			const yStart = -knuckleR - EMBED_KNUCKLE;
			const yLen = yEnd - yStart;
			if (yLen <= 0) return null;
			return translate([
				uStart,
				yStart,
				0
			], cube([
				tabU,
				yLen,
				tabZ
			], false));
		}
		case "+x": {
			const xStart = plateEdgeXMax - EMBED_PLATE;
			const xLen = dims.outerX + knuckleR + EMBED_KNUCKLE - xStart;
			if (xLen <= 0) return null;
			return translate([
				xStart,
				uStart,
				0
			], cube([
				xLen,
				tabU,
				tabZ
			], false));
		}
		case "-x": {
			const xEnd = plateEdgeX + EMBED_PLATE;
			const xStart = -knuckleR - EMBED_KNUCKLE;
			const xLen = xEnd - xStart;
			if (xLen <= 0) return null;
			return translate([
				xStart,
				uStart,
				0
			], cube([
				xLen,
				tabU,
				tabZ
			], false));
		}
	}
}
function buildLid(board, params, hats = NO_HATS$6, resolveHat = NO_RESOLVE$6, display = null, resolveDisplay = NO_RESOLVE_DISPLAY$10) {
	if (lidIsRecessed(params)) {
		const lid = computeLidDims(board, params, hats, resolveHat, display, resolveDisplay);
		const recess = computeRecessDims(board, params, hats, resolveHat, display, resolveDisplay);
		const recessOffset = Math.max(.5, params.wallThickness - .5);
		const plateOriginX = params.wallThickness - recessOffset + recess.clearance;
		const plateOriginY = params.wallThickness - recessOffset + recess.clearance;
		let plate = translate([
			plateOriginX,
			plateOriginY,
			0
		], roundedRectPrism(lid.x, lid.y, lid.z, lidRecessedCornerRadius(params)));
		const ext = buildHingeLidExtension(board, params, hats, resolveHat, display, resolveDisplay, plateOriginX, plateOriginY, lid);
		if (ext) plate = union$1([plate, ext]);
		const { posts, holes } = buildLidPosts(board, params, hats, resolveHat, display, resolveDisplay);
		if (params.joint === "snap-fit" && params.snapType === "full-lid") {
			const lip = buildFullLidFrictionLip(board, params, hats, resolveHat, display, resolveDisplay);
			if (lip) return attachPosts(union$1([plate, lip]), posts, holes);
		}
		return attachPosts(plate, posts, holes);
	}
	switch (params.joint) {
		case "snap-fit": return buildSnapFitLid(board, params, hats, resolveHat, display, resolveDisplay);
		case "screw-down": return buildScrewDownLid(board, params, hats, resolveHat, display, resolveDisplay);
		default: return buildFlatLid(board, params, hats, resolveHat, display, resolveDisplay);
	}
}

// vendor/casemaker/casemaker-app/src/engine/compiler/ports.ts
const OVERSHOOT = 1;
function buildPortCutoutOp(port, board, params) {
	if (!port.enabled) return null;
	if (port.facing === "+z") return null;
	if (port.kind === "antenna-connector") return null;
	const m = port.cutoutMargin;
	const { wallThickness: wall, floorThickness: floor } = params;
	const cl = cavityClearance(params);
	const pcb = board.pcb.size;
	let xMin = port.position.x - m;
	let xMax = port.position.x + port.size.x + m;
	let yMin = port.position.y - m;
	let yMax = port.position.y + port.size.y + m;
	let zMin = port.position.z - m;
	const zMax = port.position.z + port.size.z + m;
	switch (port.facing) {
		case "-x":
			xMin = -(wall + cl.xMin) - OVERSHOOT;
			break;
		case "+x":
			xMax = pcb.x + cl.xMax + wall + OVERSHOOT;
			break;
		case "-y":
			yMin = -(wall + cl.yMin) - OVERSHOOT;
			break;
		case "+y":
			yMax = pcb.y + cl.yMax + wall + OVERSHOOT;
			break;
		case "-z": zMin = -(board.defaultStandoffHeight + floor) - OVERSHOOT;
	}
	const sizeX = xMax - xMin;
	const sizeY = yMax - yMin;
	const sizeZ = zMax - zMin;
	if (sizeX <= 0 || sizeY <= 0 || sizeZ <= 0) return null;
	const wx = wall + cl.xMin + xMin;
	const wy = wall + cl.yMin + yMin;
	const wz = floor + board.defaultStandoffHeight + zMin;
	return buildAxisAlignedCutout(port.facing, wx, wy, wz, sizeX, sizeY, sizeZ, port.cutoutShape ?? "rect");
}
function buildPortCutoutsForProject(ports, board, params) {
	const out = [];
	for (const p of ports) {
		const op = buildPortCutoutOp(p, board, params);
		if (op) out.push(op);
	}
	return out;
}

// vendor/casemaker/casemaker-app/src/engine/compiler/smartCutoutLayout.ts
const NO_RESOLVE_DISPLAY$9 = () => void 0;
const MIN_BRIDGE_THICKNESS = 1.5;
/**
* Pre-pass over port cutouts: when a side-facing cutout's top is closer than
* MIN_BRIDGE_THICKNESS to the outer shell top, extend the cutout up through
* the top so it becomes a notch instead of leaving a thin unsupported bridge
* of wall material above it (issue #17, see `giga-parts.jpg`).
*/
function applySmartCutoutLayout(ports, board, params, hats = [], resolveHat = () => void 0, display = null, resolveDisplay = NO_RESOLVE_DISPLAY$9) {
	const shell = computeShellDims(board, params, hats, resolveHat, display, resolveDisplay);
	const decisions = [];
	const out = [];
	for (const port of ports) {
		if (!port.enabled || port.facing === "+z" || port.facing === "-z") {
			out.push(port);
			continue;
		}
		const cutoutTopWorldZ = params.floorThickness + board.defaultStandoffHeight + port.position.z + port.size.z + port.cutoutMargin;
		const topClearance = shell.outerZ - cutoutTopWorldZ;
		if (topClearance > 0 && topClearance < 1.5) {
			const extraZ = topClearance + MIN_BRIDGE_THICKNESS;
			out.push({
				...port,
				size: {
					...port.size,
					z: port.size.z + extraZ
				}
			});
			decisions.push({
				portId: port.id,
				action: "extended-to-top",
				topClearanceMm: topClearance,
				reason: `Bridge above cutout would be ${topClearance.toFixed(2)}mm (< ${MIN_BRIDGE_THICKNESS}mm). Cutout extended to wall top.`
			});
		} else {
			out.push(port);
			if (topClearance > 0) decisions.push({
				portId: port.id,
				action: "as-is",
				topClearanceMm: topClearance,
				reason: `Bridge above cutout is ${topClearance.toFixed(2)}mm — adequate.`
			});
		}
	}
	return {
		ports: out,
		decisions
	};
}

// vendor/casemaker/casemaker-app/src/engine/compiler/ventilation.ts
const NO_HATS$5 = [];
const NO_RESOLVE$5 = () => void 0;
const NO_RESOLVE_DISPLAY$8 = () => void 0;
const HEX_RADIUS = 2.2;
const HEX_GAP = 1.4;
const SLAT_LENGTH = 14;
const SLAT_HEIGHT = 4;
const SLAT_U_GAP = 4;
const SLAT_V_GAP = 4;
const CHEV_ARM_LEN = 8;
const CHEV_ARM_W = 2.8;
const CHEV_U_GAP = 3.5;
const CHEV_V_GAP = 3.5;
const CHEV_CELL_U = Math.SQRT2 * 9.4;
const CHEV_CELL_V = 10.8 * Math.SQRT1_2;
function frameFor(surface, outerX, outerY, outerZ, wall, floor, lid, lidTotalZ) {
	const OVER = 1;
	switch (surface) {
		case "back": return {
			uAxis: "x",
			vAxis: "z",
			uMax: outerX,
			vMax: outerZ,
			cutAxis: "y",
			cutDir: -1,
			cutOriginW: {
				x: 0,
				y: outerY - wall - OVER,
				z: 0
			},
			cutThru: wall + 2
		};
		case "front": return {
			uAxis: "x",
			vAxis: "z",
			uMax: outerX,
			vMax: outerZ,
			cutAxis: "y",
			cutDir: 1,
			cutOriginW: {
				x: 0,
				y: -1,
				z: 0
			},
			cutThru: wall + 2
		};
		case "right": return {
			uAxis: "y",
			vAxis: "z",
			uMax: outerY,
			vMax: outerZ,
			cutAxis: "x",
			cutDir: -1,
			cutOriginW: {
				x: outerX - wall - OVER,
				y: 0,
				z: 0
			},
			cutThru: wall + 2
		};
		case "left": return {
			uAxis: "y",
			vAxis: "z",
			uMax: outerY,
			vMax: outerZ,
			cutAxis: "x",
			cutDir: 1,
			cutOriginW: {
				x: -1,
				y: 0,
				z: 0
			},
			cutThru: wall + 2
		};
		case "bottom": return {
			uAxis: "x",
			vAxis: "y",
			uMax: outerX,
			vMax: outerY,
			cutAxis: "z",
			cutDir: 1,
			cutOriginW: {
				x: 0,
				y: 0,
				z: -1
			},
			cutThru: floor + 2
		};
		case "top": return {
			uAxis: "x",
			vAxis: "y",
			uMax: outerX,
			vMax: outerY,
			cutAxis: "z",
			cutDir: -1,
			cutOriginW: {
				x: 0,
				y: 0,
				z: lidTotalZ - lid - OVER
			},
			cutThru: lid + 2
		};
	}
}
/** Translate a (u, v, n) local offset into the world frame defined by `frame`. */
function place(frame, uOff, vOff) {
	const w = {
		x: frame.cutOriginW.x,
		y: frame.cutOriginW.y,
		z: frame.cutOriginW.z
	};
	if (frame.uAxis === "x") w.x += uOff;
	else if (frame.uAxis === "y") w.y += uOff;
	else w.z += uOff;
	if (frame.vAxis === "x") w.x += vOff;
	else if (frame.vAxis === "y") w.y += vOff;
	else w.z += vOff;
	return w;
}
const KEEPOUT_MARGIN = 2;
/** World AABB of one vent cell (u0..u0+uSize, v0..v0+vSize, full cut depth). */
function cellAabb(frame, u0, v0, uSize, vSize) {
	const a = place(frame, u0, v0);
	const b = place(frame, u0 + uSize, v0 + vSize);
	const min = [
		Math.min(a.x, b.x),
		Math.min(a.y, b.y),
		Math.min(a.z, b.z)
	];
	const max = [
		Math.max(a.x, b.x),
		Math.max(a.y, b.y),
		Math.max(a.z, b.z)
	];
	const axis = frame.cutAxis === "x" ? 0 : frame.cutAxis === "y" ? 1 : 2;
	max[axis] = min[axis] + frame.cutThru;
	return {
		min,
		max
	};
}
function cellBlocked(frame, u0, v0, uSize, vSize, keepOuts) {
	if (keepOuts.length === 0) return false;
	const c = cellAabb(frame, u0, v0, uSize, vSize);
	for (const k of keepOuts) if (c.min[0] < k.max[0] + KEEPOUT_MARGIN && c.max[0] > k.min[0] - KEEPOUT_MARGIN && c.min[1] < k.max[1] + KEEPOUT_MARGIN && c.max[1] > k.min[1] - KEEPOUT_MARGIN && c.min[2] < k.max[2] + KEEPOUT_MARGIN && c.max[2] > k.min[2] - KEEPOUT_MARGIN) return true;
	return false;
}
/** A cube cutter aligned with `frame.cutAxis`. Sized (uSize, vSize) in-plane,
*  cutThru along the cutter axis. */
function planarCutter(frame, uOrigin, vOrigin, uSize, vSize) {
	const sx = frame.uAxis === "x" ? uSize : frame.vAxis === "x" ? vSize : frame.cutThru;
	const sy = frame.uAxis === "y" ? uSize : frame.vAxis === "y" ? vSize : frame.cutThru;
	const sz = frame.uAxis === "z" ? uSize : frame.vAxis === "z" ? vSize : frame.cutThru;
	return translate([
		place(frame, uOrigin, vOrigin).x,
		place(frame, uOrigin, vOrigin).y,
		place(frame, uOrigin, vOrigin).z
	], cube([
		sx,
		sy,
		sz
	]));
}
/** Lay out a tiled grid of short slots over the given frame using the SLAT_*
*  constants. Coverage scales the usable V range (matching hex's behavior) so
*  the slider controls "how much of the wall is open" the same way for all
*  patterns. Returns the column origin / row origin / counts so callers can
*  emit either flat slot cutters (slats) or rotated cutters (chevron). */
function slatGrid(frame, coverage, cellU = SLAT_LENGTH, cellV = SLAT_HEIGHT, gapU = SLAT_U_GAP, gapV = SLAT_V_GAP) {
	const usableU = frame.uMax - 12;
	const usableV = (frame.vMax - 12) * coverage;
	if (usableU < cellU || usableV < cellV) return null;
	const strideU = cellU + gapU;
	const strideV = cellV + gapV;
	const cols = Math.max(1, Math.floor((usableU + gapU) / strideU));
	const rows = Math.max(1, Math.floor((usableV + gapV) / strideV));
	const totalUsedU = cols * cellU + (cols - 1) * gapU;
	const totalUsedV = rows * cellV + (rows - 1) * gapV;
	return {
		cols,
		rows,
		uOrigin: (frame.uMax - totalUsedU) / 2,
		vOrigin: (frame.vMax - totalUsedV) / 2,
		strideU,
		strideV
	};
}
function buildSlotsForFrame(frame, coverage, keepOuts) {
	const grid = slatGrid(frame, coverage);
	if (!grid) return [];
	const ops = [];
	for (let r = 0; r < grid.rows; r++) for (let c = 0; c < grid.cols; c++) {
		const u = grid.uOrigin + c * grid.strideU;
		const v = grid.vOrigin + r * grid.strideV;
		if (cellBlocked(frame, u, v, SLAT_LENGTH, SLAT_HEIGHT, keepOuts)) continue;
		ops.push(planarCutter(frame, u, v, SLAT_LENGTH, SLAT_HEIGHT));
	}
	return ops;
}
function buildHexForFrame(frame, coverage, keepOuts) {
	const usableU = frame.uMax - 10;
	const usableV = (frame.vMax - 10) * coverage;
	if (usableU <= HEX_RADIUS * 2 || usableV <= HEX_RADIUS * 2) return [];
	const strideU = 5.800000000000001;
	const strideV = Math.sqrt(3) * HEX_RADIUS + HEX_GAP;
	const cols = Math.max(1, Math.floor((usableU - HEX_RADIUS) / strideU));
	const rows = Math.max(1, Math.floor((usableV - HEX_RADIUS) / strideV));
	if (cols < 1 || rows < 1) return [];
	const uOrigin = (frame.uMax - (cols - 1) * strideU) / 2;
	const vOrigin = (frame.vMax - (rows - 1) * strideV) / 2;
	const ops = [];
	for (let r = 0; r < rows; r++) {
		const isOdd = r % 2 === 1;
		const uOff = isOdd ? strideU / 2 : 0;
		for (let c = 0; c < cols - (isOdd ? 1 : 0); c++) {
			const u = uOrigin + c * strideU + uOff;
			const v = vOrigin + r * strideV;
			if (cellBlocked(frame, u - HEX_RADIUS, v - HEX_RADIUS, 2 * HEX_RADIUS, 2 * HEX_RADIUS, keepOuts)) continue;
			const w = place(frame, u, v);
			const cyl = cylinder(frame.cutThru, HEX_RADIUS, 6, false);
			let oriented = cyl;
			if (frame.cutAxis === "y") oriented = rotate([
				90,
				0,
				0
			], cyl);
			else if (frame.cutAxis === "x") oriented = rotate([
				0,
				90,
				0
			], cyl);
			if (frame.cutAxis === "y") ops.push(translate([
				w.x,
				w.y + frame.cutThru,
				w.z
			], oriented));
			else if (frame.cutAxis === "x") ops.push(translate([
				w.x,
				w.y,
				w.z
			], oriented));
			else ops.push(translate([
				w.x,
				w.y,
				w.z
			], oriented));
		}
	}
	return ops;
}
function buildChevronForFrame(frame, coverage, keepOuts) {
	const grid = slatGrid(frame, coverage, CHEV_CELL_U, CHEV_CELL_V, CHEV_U_GAP, CHEV_V_GAP);
	if (!grid) return [];
	const c45 = Math.SQRT1_2;
	const rotSign = frame.cutAxis === "y" ? -1 : 1;
	const rotVecFor = (deg) => frame.cutAxis === "x" ? [
		deg,
		0,
		0
	] : frame.cutAxis === "y" ? [
		0,
		deg,
		0
	] : [
		0,
		0,
		deg
	];
	const dim = (long, wide, thru) => {
		return [
			frame.uAxis === "x" ? long : frame.vAxis === "x" ? wide : thru,
			frame.uAxis === "y" ? long : frame.vAxis === "y" ? wide : thru,
			frame.uAxis === "z" ? long : frame.vAxis === "z" ? wide : thru
		];
	};
	const ops = [];
	const armBox = cube(dim(CHEV_ARM_LEN, CHEV_ARM_W, frame.cutThru), true);
	for (let r = 0; r < grid.rows; r++) for (let cCol = 0; cCol < grid.cols; cCol++) {
		if (cellBlocked(frame, grid.uOrigin + cCol * grid.strideU, grid.vOrigin + r * grid.strideV, CHEV_CELL_U, CHEV_CELL_V, keepOuts)) continue;
		const apexU = grid.uOrigin + cCol * grid.strideU + CHEV_CELL_U / 2;
		const apexV = grid.vOrigin + r * grid.strideV + CHEV_CELL_V - CHEV_ARM_W / 2 * c45;
		for (const armSide of [-1, 1]) {
			const armU = apexU + armSide * (CHEV_ARM_LEN / 2) * c45;
			const armV = apexV - CHEV_ARM_LEN / 2 * c45;
			const rotated = rotate(rotVecFor(rotSign * -armSide * 45), armBox);
			const w = place(frame, armU, armV);
			const off = frame.cutThru / 2;
			ops.push(translate([
				w.x + (frame.cutAxis === "x" ? off : 0),
				w.y + (frame.cutAxis === "y" ? off : 0),
				w.z + (frame.cutAxis === "z" ? off : 0)
			], rotated));
		}
	}
	return ops;
}
function buildVentilationCutouts(board, params, hats = NO_HATS$5, resolveHat = NO_RESOLVE$5, display = null, resolveDisplay = NO_RESOLVE_DISPLAY$8, keepOuts = []) {
	const empty = {
		shellCuts: [],
		lidCuts: []
	};
	if (!params.ventilation.enabled) return empty;
	if (params.ventilation.coverage <= 0) return empty;
	const dims = computeShellDims(board, params, hats, resolveHat, display, resolveDisplay);
	const surfaces = params.ventilation.surfaces && params.ventilation.surfaces.length > 0 ? params.ventilation.surfaces : ["back"];
	const coverage = clamp01(params.ventilation.coverage);
	const shellCuts = [];
	const lidCuts = [];
	const lidTotalZ = params.lidThickness + lidCavityHeight(params);
	for (const s of surfaces) {
		const frame = frameFor(s, dims.outerX, dims.outerY, dims.outerZ, params.wallThickness, params.floorThickness, params.lidThickness, lidTotalZ);
		if (!frame) continue;
		const dest = s === "top" ? lidCuts : shellCuts;
		const ko = s === "top" ? [] : keepOuts;
		if (params.ventilation.pattern === "slots") dest.push(...buildSlotsForFrame(frame, coverage, ko));
		else if (params.ventilation.pattern === "hex") dest.push(...buildHexForFrame(frame, coverage, ko));
		else if (params.ventilation.pattern === "chevron") dest.push(...buildChevronForFrame(frame, coverage, ko));
	}
	return {
		shellCuts,
		lidCuts
	};
}
function clamp01(v) {
	if (v < 0) return 0;
	if (v > 1) return 1;
	return v;
}

// vendor/casemaker/casemaker-app/src/engine/import/base64.ts
function base64ToArrayBuffer(b64) {
	const binary = atob(b64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes.buffer;
}

// vendor/casemaker/casemaker-app/src/engine/import/stlParser.ts
function parseBinaryStl(buf) {
	const dv = new DataView(buf);
	if (buf.byteLength < 84) throw new Error("STL: file too small to contain a header");
	const triCount = dv.getUint32(80, true);
	const expected = 84 + triCount * 50;
	if (buf.byteLength < expected) throw new Error(`STL: declared ${triCount} triangles but file size ${buf.byteLength} is shorter than required ${expected}`);
	const positions = new Float32Array(triCount * 9);
	const indices = new Uint32Array(triCount * 3);
	let off = 84;
	let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
	for (let t = 0; t < triCount; t++) {
		off += 12;
		for (let v = 0; v < 3; v++) {
			const x = dv.getFloat32(off, true);
			const y = dv.getFloat32(off + 4, true);
			const z = dv.getFloat32(off + 8, true);
			positions[t * 9 + v * 3] = x;
			positions[t * 9 + v * 3 + 1] = y;
			positions[t * 9 + v * 3 + 2] = z;
			indices[t * 3 + v] = t * 3 + v;
			if (x < minX) minX = x;
			if (y < minY) minY = y;
			if (z < minZ) minZ = z;
			if (x > maxX) maxX = x;
			if (y > maxY) maxY = y;
			if (z > maxZ) maxZ = z;
			off += 12;
		}
		off += 2;
	}
	return {
		positions,
		indices,
		triangleCount: triCount,
		bbox: {
			min: [
				minX,
				minY,
				minZ
			],
			max: [
				maxX,
				maxY,
				maxZ
			]
		}
	};
}
function looksLikeBinaryStl(buf) {
	if (buf.byteLength < 84) return false;
	const triCount = new DataView(buf).getUint32(80, true);
	return buf.byteLength === 84 + triCount * 50;
}
function looksLikeAsciiStl(buf) {
	if (buf.byteLength < 6) return false;
	const head = new Uint8Array(buf, 0, Math.min(80, buf.byteLength));
	return new TextDecoder("utf-8", { fatal: false }).decode(head).trimStart().toLowerCase().startsWith("solid") && !looksLikeBinaryStl(buf);
}
const VERTEX_RE = /vertex\s+(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s+(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s+(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;
function parseAsciiStl(text) {
	const flat = [];
	let m;
	VERTEX_RE.lastIndex = 0;
	while ((m = VERTEX_RE.exec(text)) !== null) flat.push(parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]));
	if (flat.length === 0 || flat.length % 9 !== 0) throw new Error(`ASCII STL: parsed ${flat.length / 3} vertices, not a multiple of 3`);
	const triCount = flat.length / 9;
	const positions = new Float32Array(flat);
	const indices = new Uint32Array(triCount * 3);
	let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
	for (let i = 0; i < triCount * 3; i++) indices[i] = i;
	for (let i = 0; i < triCount * 3; i++) {
		const x = positions[i * 3];
		const y = positions[i * 3 + 1];
		const z = positions[i * 3 + 2];
		if (x < minX) minX = x;
		if (y < minY) minY = y;
		if (z < minZ) minZ = z;
		if (x > maxX) maxX = x;
		if (y > maxY) maxY = y;
		if (z > maxZ) maxZ = z;
	}
	return {
		positions,
		indices,
		triangleCount: triCount,
		bbox: {
			min: [
				minX,
				minY,
				minZ
			],
			max: [
				maxX,
				maxY,
				maxZ
			]
		}
	};
}
function parseStl(buf) {
	if (looksLikeBinaryStl(buf)) return parseBinaryStl(buf);
	if (looksLikeAsciiStl(buf)) return parseAsciiStl(new TextDecoder("utf-8").decode(buf));
	throw new Error("STL: not recognized as binary or ASCII");
}

// node_modules/fflate/esm/index.mjs
var require = createRequire("/");
var _a$2;
var Worker;
var isMarkedAsUntransferable;
try {
	_a$2 = require("worker_threads"), Worker = _a$2.Worker, isMarkedAsUntransferable = _a$2.isMarkedAsUntransferable;
} catch (e) {}
var u8 = Uint8Array;
var u16 = Uint16Array;
var i32 = Int32Array;
var fleb = new u8([
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	1,
	1,
	1,
	1,
	2,
	2,
	2,
	2,
	3,
	3,
	3,
	3,
	4,
	4,
	4,
	4,
	5,
	5,
	5,
	5,
	0,
	0,
	0,
	0
]);
var fdeb = new u8([
	0,
	0,
	0,
	0,
	1,
	1,
	2,
	2,
	3,
	3,
	4,
	4,
	5,
	5,
	6,
	6,
	7,
	7,
	8,
	8,
	9,
	9,
	10,
	10,
	11,
	11,
	12,
	12,
	13,
	13,
	0,
	0
]);
var clim = new u8([
	16,
	17,
	18,
	0,
	8,
	7,
	9,
	6,
	10,
	5,
	11,
	4,
	12,
	3,
	13,
	2,
	14,
	1,
	15
]);
var freb = function(eb, start) {
	var b = new u16(31);
	for (var i = 0; i < 31; ++i) b[i] = start += 1 << eb[i - 1];
	var r = new i32(b[30]);
	for (var i = 1; i < 30; ++i) for (var j = b[i]; j < b[i + 1]; ++j) r[j] = j - b[i] << 5 | i;
	return {
		b,
		r
	};
};
var _a$2 = freb(fleb, 2);
var fl = _a$2.b;
var revfl = _a$2.r;
fl[28] = 258, revfl[258] = 28;
var _b = freb(fdeb, 0);
var fd = _b.b;
var revfd = _b.r;
var rev = new u16(32768);
for (var i = 0; i < 32768; ++i) {
	var x = (i & 43690) >> 1 | (i & 21845) << 1;
	x = (x & 52428) >> 2 | (x & 13107) << 2;
	x = (x & 61680) >> 4 | (x & 3855) << 4;
	rev[i] = ((x & 65280) >> 8 | (x & 255) << 8) >> 1;
}
var hMap = (function(cd, mb, r) {
	var s = cd.length;
	var i = 0;
	var l = new u16(mb);
	for (; i < s; ++i) if (cd[i]) ++l[cd[i] - 1];
	var le = new u16(mb);
	for (i = 1; i < mb; ++i) le[i] = le[i - 1] + l[i - 1] << 1;
	var co;
	if (r) {
		co = new u16(1 << mb);
		var rvb = 15 - mb;
		for (i = 0; i < s; ++i) if (cd[i]) {
			var sv = i << 4 | cd[i];
			var r_1 = mb - cd[i];
			var v = le[cd[i] - 1]++ << r_1;
			for (var m = v | (1 << r_1) - 1; v <= m; ++v) co[rev[v] >> rvb] = sv;
		}
	} else {
		co = new u16(s);
		for (i = 0; i < s; ++i) if (cd[i]) co[i] = rev[le[cd[i] - 1]++] >> 15 - cd[i];
	}
	return co;
});
var flt = new u8(288);
for (var i = 0; i < 144; ++i) flt[i] = 8;
for (var i = 144; i < 256; ++i) flt[i] = 9;
for (var i = 256; i < 280; ++i) flt[i] = 7;
for (var i = 280; i < 288; ++i) flt[i] = 8;
var fdt = new u8(32);
for (var i = 0; i < 32; ++i) fdt[i] = 5;
var flrm = /*#__PURE__*/ hMap(flt, 9, 1);
var fdrm = /*#__PURE__*/ hMap(fdt, 5, 1);
var max = function(a) {
	var m = a[0];
	for (var i = 1; i < a.length; ++i) if (a[i] > m) m = a[i];
	return m;
};
var bits = function(d, p, m) {
	var o = p / 8 | 0;
	return (d[o] | d[o + 1] << 8) >> (p & 7) & m;
};
var bits16 = function(d, p) {
	var o = p / 8 | 0;
	return (d[o] | d[o + 1] << 8 | d[o + 2] << 16) >> (p & 7);
};
var shft = function(p) {
	return (p + 7) / 8 | 0;
};
var slc = function(v, s, e) {
	if (s == null || s < 0) s = 0;
	if (e == null || e > v.length) e = v.length;
	return new u8(v.subarray(s, e));
};
var ec = [
	"unexpected EOF",
	"invalid block type",
	"invalid length/literal",
	"invalid distance",
	"stream finished",
	"no stream handler",
	,
	"no callback",
	"invalid UTF-8 data",
	"extra field too long",
	"date not in range 1980-2099",
	"filename too long",
	"stream finishing",
	"invalid zip data"
];
var err = function(ind, msg, nt) {
	var e = new Error(msg || ec[ind]);
	e.code = ind;
	if (Error.captureStackTrace) Error.captureStackTrace(e, err);
	if (!nt) throw e;
	return e;
};
var inflt = function(dat, st, buf, dict) {
	var sl = dat.length, dl = dict ? dict.length : 0;
	if (!sl || st.f && !st.l) return buf || new u8(0);
	var noBuf = !buf;
	var resize = noBuf || st.i != 2;
	var noSt = st.i;
	if (noBuf) buf = new u8(sl * 3);
	var cbuf = function(l) {
		var bl = buf.length;
		if (l > bl) {
			var nbuf = new u8(Math.max(bl * 2, l));
			nbuf.set(buf);
			buf = nbuf;
		}
	};
	var final = st.f || 0, pos = st.p || 0, bt = st.b || 0, lm = st.l, dm = st.d, lbt = st.m, dbt = st.n;
	var tbts = sl * 8;
	do {
		if (!lm) {
			final = bits(dat, pos, 1);
			var type = bits(dat, pos + 1, 3);
			pos += 3;
			if (!type) {
				var s = shft(pos) + 4, l = dat[s - 4] | dat[s - 3] << 8, t = s + l;
				if (t > sl) {
					if (noSt) err(0);
					break;
				}
				if (resize) cbuf(bt + l);
				buf.set(dat.subarray(s, t), bt);
				st.b = bt += l, st.p = pos = t * 8, st.f = final;
				continue;
			} else if (type == 1) lm = flrm, dm = fdrm, lbt = 9, dbt = 5;
			else if (type == 2) {
				var hLit = bits(dat, pos, 31) + 257, hcLen = bits(dat, pos + 10, 15) + 4;
				var tl = hLit + bits(dat, pos + 5, 31) + 1;
				pos += 14;
				var ldt = new u8(tl);
				var clt = new u8(19);
				for (var i = 0; i < hcLen; ++i) clt[clim[i]] = bits(dat, pos + i * 3, 7);
				pos += hcLen * 3;
				var clb = max(clt), clbmsk = (1 << clb) - 1;
				var clm = hMap(clt, clb, 1);
				for (var i = 0; i < tl;) {
					var r = clm[bits(dat, pos, clbmsk)];
					pos += r & 15;
					var s = r >> 4;
					if (s < 16) ldt[i++] = s;
					else {
						var c = 0, n = 0;
						if (s == 16) n = 3 + bits(dat, pos, 3), pos += 2, c = ldt[i - 1];
						else if (s == 17) n = 3 + bits(dat, pos, 7), pos += 3;
						else if (s == 18) n = 11 + bits(dat, pos, 127), pos += 7;
						while (n--) ldt[i++] = c;
					}
				}
				var lt = ldt.subarray(0, hLit), dt = ldt.subarray(hLit);
				lbt = max(lt);
				dbt = max(dt);
				lm = hMap(lt, lbt, 1);
				dm = hMap(dt, dbt, 1);
			} else err(1);
			if (pos > tbts) {
				if (noSt) err(0);
				break;
			}
		}
		if (resize) cbuf(bt + 131072);
		var lms = (1 << lbt) - 1, dms = (1 << dbt) - 1;
		var lpos = pos;
		for (;; lpos = pos) {
			var c = lm[bits16(dat, pos) & lms], sym = c >> 4;
			pos += c & 15;
			if (pos > tbts) {
				if (noSt) err(0);
				break;
			}
			if (!c) err(2);
			if (sym < 256) buf[bt++] = sym;
			else if (sym == 256) {
				lpos = pos, lm = null;
				break;
			} else {
				var add = sym - 254;
				if (sym > 264) {
					var i = sym - 257, b = fleb[i];
					add = bits(dat, pos, (1 << b) - 1) + fl[i];
					pos += b;
				}
				var d = dm[bits16(dat, pos) & dms], dsym = d >> 4;
				if (!d) err(3);
				pos += d & 15;
				var dt = fd[dsym];
				if (dsym > 3) {
					var b = fdeb[dsym];
					dt += bits16(dat, pos) & (1 << b) - 1, pos += b;
				}
				if (pos > tbts) {
					if (noSt) err(0);
					break;
				}
				if (resize) cbuf(bt + 131072);
				var end = bt + add;
				if (bt < dt) {
					var shift = dl - dt, dend = Math.min(dt, end);
					if (shift + bt < 0) err(3);
					for (; bt < dend; ++bt) buf[bt] = dict[shift + bt];
				}
				for (; bt < end; ++bt) buf[bt] = buf[bt - dt];
			}
		}
		st.l = lm, st.p = lpos, st.b = bt, st.f = final;
		if (lm) final = 1, st.m = lbt, st.d = dm, st.n = dbt;
	} while (!final);
	return bt != buf.length && noBuf ? slc(buf, 0, bt) : buf.subarray(0, bt);
};
var et = /*#__PURE__*/ new u8(0);
var b2 = function(d, b) {
	return d[b] | d[b + 1] << 8;
};
var b4 = function(d, b) {
	return (d[b] | d[b + 1] << 8 | d[b + 2] << 16 | d[b + 3] << 24) >>> 0;
};
var b8 = function(d, b) {
	return b4(d, b) + b4(d, b + 4) * 4294967296;
};
function inflateSync(data, opts) {
	return inflt(data, { i: 2 }, opts && opts.out, opts && opts.dictionary);
}
var td = typeof TextDecoder != "undefined" && /*#__PURE__*/ new TextDecoder();
var tds = 0;
try {
	td.decode(et, { stream: true });
	tds = 1;
} catch (e) {}
var dutf8 = function(d) {
	for (var r = "", i = 0;;) {
		var c = d[i++];
		var eb = (c > 127) + (c > 223) + (c > 239);
		if (i + eb > d.length) return {
			s: r,
			r: slc(d, i - 1)
		};
		if (!eb) r += String.fromCharCode(c);
		else if (eb == 3) c = ((c & 15) << 18 | (d[i++] & 63) << 12 | (d[i++] & 63) << 6 | d[i++] & 63) - 65536, r += String.fromCharCode(55296 | c >> 10, 56320 | c & 1023);
		else if (eb & 1) r += String.fromCharCode((c & 31) << 6 | d[i++] & 63);
		else r += String.fromCharCode((c & 15) << 12 | (d[i++] & 63) << 6 | d[i++] & 63);
	}
};
/**
* Converts a Uint8Array to a string
* @param dat The data to decode to string
* @param latin1 Whether or not to interpret the data as Latin-1. This should
*               not need to be true unless encoding to binary string.
* @returns The original UTF-8/Latin-1 string
*/
function strFromU8(dat, latin1) {
	if (latin1) {
		var r = "";
		for (var i = 0; i < dat.length; i += 16384) r += String.fromCharCode.apply(null, dat.subarray(i, i + 16384));
		return r;
	} else if (td) return td.decode(dat);
	else {
		var _a = dutf8(dat), s = _a.s, r = _a.r;
		if (r.length) err(8);
		return s;
	}
}
var slzh = function(d, b) {
	return b + 30 + b2(d, b + 26) + b2(d, b + 28);
};
var zh = function(d, b, z) {
	var fnl = b2(d, b + 28), efl = b2(d, b + 30), fn = strFromU8(d.subarray(b + 46, b + 46 + fnl), !(b2(d, b + 8) & 2048)), es = b + 46 + fnl;
	var _a = z64hs(d, es, efl, z, b4(d, b + 20), b4(d, b + 24), b4(d, b + 42)), sc = _a[0], su = _a[1], off = _a[2];
	return [
		b2(d, b + 10),
		sc,
		su,
		fn,
		es + efl + b2(d, b + 32),
		off
	];
};
var z64hs = function(d, b, l, z, sc, su, off) {
	var nsc = sc == 4294967295, nsu = su == 4294967295, noff = off == 4294967295, e = b + l;
	var nf = nsc + nsu + noff;
	if (z && nf) {
		for (; b + 4 < e; b += 4 + b2(d, b + 2)) if (b2(d, b) == 1) return [
			nsc ? b8(d, b + 4 + 8 * nsu) : sc,
			nsu ? b8(d, b + 4) : su,
			noff ? b8(d, b + 4 + 8 * (nsu + nsc)) : off,
			1
		];
		if (z < 2) err(13);
	}
	return [
		sc,
		su,
		off,
		0
	];
};
/**
* Synchronously decompresses a ZIP archive. Prefer using `unzip` for better
* performance with more than one file.
* @param data The raw compressed ZIP file
* @param opts The ZIP extraction options
* @returns The decompressed files
*/
function unzipSync(data, opts) {
	var files = {};
	var e = data.length - 22;
	for (; b4(data, e) != 101010256; --e) if (!e || data.length - e > 65558) err(13);
	var c = b2(data, e + 8);
	if (!c) return {};
	var o = b4(data, e + 16);
	var z = b4(data, e - 20) == 117853008;
	if (z) {
		var ze = b4(data, e - 12);
		z = b4(data, ze) == 101075792;
		if (z) {
			c = b4(data, ze + 32);
			o = b4(data, ze + 48);
		}
	}
	var fltr = opts && opts.filter;
	for (var i = 0; i < c; ++i) {
		var _a = zh(data, o, z), c_2 = _a[0], sc = _a[1], su = _a[2], fn = _a[3], no = _a[4], off = _a[5], b = slzh(data, off);
		o = no;
		if (!fltr || fltr({
			name: fn,
			size: sc,
			originalSize: su,
			compression: c_2
		})) {
			if (!c_2) files[fn] = slc(data, b, b + sc);
			else if (c_2 == 8) files[fn] = inflateSync(data.subarray(b, b + sc), { out: new u8(su) });
			else err(14, "unknown compression type " + c_2);
		}
	}
	return files;
}

// vendor/casemaker/casemaker-app/src/engine/import/threeMfParser.ts
/** The core spec's unit tokens and their millimetres. */
const UNIT_MM = {
	micron: .001,
	millimeter: 1,
	centimeter: 10,
	inch: 25.4,
	foot: 304.8,
	meter: 1e3
};
/** The model's declared unit, or the format's millimetre default when it declares none. */
function modelUnit(xml) {
	const modelTag = /<model\b[^>]*>/.exec(xml)?.[0];
	const raw = modelTag === void 0 ? void 0 : /\bunit\s*=\s*"([^"]*)"/.exec(modelTag)?.[1];
	if (raw === void 0) return {
		stated: null,
		mmPerUnit: 1
	};
	const stated = raw.trim().toLowerCase();
	const mmPerUnit = UNIT_MM[stated];
	if (mmPerUnit === void 0) throw new Error(`3MF: the model's unit "${raw}" is not one of micron, millimeter, centimeter, inch, foot or meter`);
	return {
		stated,
		mmPerUnit
	};
}
const IDENTITY$1 = [
	1,
	0,
	0,
	0,
	1,
	0,
	0,
	0,
	1,
	0,
	0,
	0
];
/** One transform attribute, or null when the element states none (the identity). */
function parseTransform(raw) {
	if (raw === void 0) return null;
	const m = raw.trim().split(/\s+/).map(Number);
	if (m.length !== 12 || m.some((v) => !Number.isFinite(v))) throw new Error(`3MF: the transform "${raw}" is not 12 finite numbers`);
	return m;
}
/**
* `a` then `b`: the 3MF point-on-the-left convention means the composed matrix is the ordinary
* 4×4 product a·b, restricted to the affine twelve (the last column is always 0 0 0 1).
*/
function compose$1(a, b) {
	const out = new Array(12);
	for (let r = 0; r < 3; r++) {
		for (let c = 0; c < 3; c++) out[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
		out[9 + r] = a[9] * b[r] + a[10] * b[3 + r] + a[11] * b[6 + r] + b[9 + r];
	}
	return out;
}
/** Every `<object>` in the document, keyed by id. */
function parseObjects(xml) {
	const objects = /* @__PURE__ */ new Map();
	const objectRe = /<object\b([^>]*?)(?:\/>|>([\s\S]*?)<\/object>)/g;
	let objectMatch;
	while ((objectMatch = objectRe.exec(xml)) !== null) {
		const attrs = objectMatch[1] ?? "";
		const id = /\bid\s*=\s*"([^"]*)"/.exec(attrs)?.[1];
		if (id === void 0) continue;
		const body = objectMatch[2] ?? "";
		const vertices = [];
		const vertexRe = /<vertex\s+x="([^"]+)"\s+y="([^"]+)"\s+z="([^"]+)"\s*\/>/g;
		let vm;
		while ((vm = vertexRe.exec(body)) !== null) vertices.push(parseFloat(vm[1]), parseFloat(vm[2]), parseFloat(vm[3]));
		const triRe = /<triangle\s+v1="(\d+)"\s+v2="(\d+)"\s+v3="(\d+)"[^>]*>/g;
		let tm;
		const triangles = [];
		while ((tm = triRe.exec(body)) !== null) triangles.push(parseInt(tm[1], 10), parseInt(tm[2], 10), parseInt(tm[3], 10));
		const components = [];
		const componentRe = /<component\b([^>]*)\/?>/g;
		let cm;
		while ((cm = componentRe.exec(body)) !== null) {
			const cattrs = cm[1] ?? "";
			const objectId = /\bobjectid\s*=\s*"([^"]*)"/.exec(cattrs)?.[1];
			if (objectId === void 0) continue;
			const transform = parseTransform(/\btransform\s*=\s*"([^"]*)"/.exec(cattrs)?.[1]);
			components.push({
				objectId,
				transform
			});
		}
		objects.set(id, {
			id,
			vertices,
			triangles,
			components
		});
	}
	return objects;
}
/** The `<build>`'s items, in document order; empty when the document has no build. */
function parseBuildItems(xml) {
	const buildBlock = /<build\b[^>]*>([\s\S]*?)<\/build>/.exec(xml)?.[1];
	if (buildBlock === void 0) return [];
	const items = [];
	const itemRe = /<item\b([^>]*)\/?>/g;
	let im;
	while ((im = itemRe.exec(buildBlock)) !== null) {
		const attrs = im[1] ?? "";
		const objectId = /\bobjectid\s*=\s*"([^"]*)"/.exec(attrs)?.[1];
		if (objectId === void 0) continue;
		const transform = parseTransform(/\btransform\s*=\s*"([^"]*)"/.exec(attrs)?.[1]);
		items.push({
			objectId,
			transform
		});
	}
	return items;
}
function parse3MF(buf) {
	const zip = unzipSync(new Uint8Array(buf));
	const modelEntry = zip["3D/3dmodel.model"] ?? zip["3d/3dmodel.model"];
	if (!modelEntry) throw new Error("3MF: missing 3D/3dmodel.model entry");
	const xml = new TextDecoder("utf-8").decode(modelEntry);
	const unit = modelUnit(xml);
	const objects = parseObjects(xml);
	const positions = [];
	const indices = [];
	/** The objects a build item (directly or through components) placed. */
	const placed = /* @__PURE__ */ new Set();
	/**
	* Append one object's geometry, transformed by `transform` (the accumulated item/parent chain)
	* and converted to millimetres. Components recurse with their own transform applied first.
	*/
	function appendObject(id, transform, path) {
		if (path.has(id)) throw new Error(`3MF: the model's components form a cycle at object "${id}"`);
		const object = objects.get(id);
		if (object === void 0) throw new Error(`3MF: the model references object "${id}", which it does not define`);
		placed.add(id);
		if (object.components.length > 0) {
			const next = new Set(path);
			next.add(id);
			for (const component of object.components) {
				const combined = compose$1(component.transform ?? IDENTITY$1, transform);
				appendObject(component.objectId, combined, next);
			}
		}
		if (object.vertices.length === 0 || object.triangles.length === 0) return;
		const vertexBase = positions.length / 3;
		for (let i = 0; i < object.vertices.length; i += 3) {
			const x = object.vertices[i];
			const y = object.vertices[i + 1];
			const z = object.vertices[i + 2];
			positions.push((x * transform[0] + y * transform[3] + z * transform[6] + transform[9]) * unit.mmPerUnit, (x * transform[1] + y * transform[4] + z * transform[7] + transform[10]) * unit.mmPerUnit, (x * transform[2] + y * transform[5] + z * transform[8] + transform[11]) * unit.mmPerUnit);
		}
		for (const index of object.triangles) indices.push(vertexBase + index);
	}
	const buildItems = parseBuildItems(xml);
	for (const item of buildItems) appendObject(item.objectId, item.transform ?? IDENTITY$1, /* @__PURE__ */ new Set());
	for (const object of objects.values()) if (!placed.has(object.id) && object.vertices.length > 0 && object.triangles.length > 0) appendObject(object.id, IDENTITY$1, /* @__PURE__ */ new Set());
	if (indices.length === 0) throw new Error("3MF: no triangles found in model");
	const positionsTyped = new Float32Array(positions);
	const indicesTyped = new Uint32Array(indices);
	let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
	const vertCount = positionsTyped.length / 3;
	for (let i = 0; i < vertCount; i++) {
		const x = positionsTyped[i * 3];
		const y = positionsTyped[i * 3 + 1];
		const z = positionsTyped[i * 3 + 2];
		if (x < minX) minX = x;
		if (y < minY) minY = y;
		if (z < minZ) minZ = z;
		if (x > maxX) maxX = x;
		if (y > maxY) maxY = y;
		if (z > maxZ) maxZ = z;
	}
	return {
		positions: positionsTyped,
		indices: indicesTyped,
		triangleCount: indicesTyped.length / 3,
		bbox: {
			min: [
				minX,
				minY,
				minZ
			],
			max: [
				maxX,
				maxY,
				maxZ
			]
		},
		unit
	};
}

// vendor/casemaker/casemaker-app/src/engine/import/assetImporter.ts
const meshCache = /* @__PURE__ */ new Map();
function decodeAssetMesh(asset) {
	const cached = meshCache.get(asset.id);
	if (cached) return cached;
	const buf = base64ToArrayBuffer(asset.data);
	const parsed = asset.format === "3mf" ? parse3MF(buf) : parseStl(buf);
	meshCache.set(asset.id, parsed);
	return parsed;
}

// vendor/casemaker/casemaker-app/src/engine/compiler/externalAssets.ts
function applyTransforms(asset, op) {
	let result = op;
	if (asset.transform.scale !== 1) result = scale(asset.transform.scale, result);
	const [rx, ry, rz] = asset.transform.rotation;
	if (rx !== 0 || ry !== 0 || rz !== 0) result = rotate([
		rx,
		ry,
		rz
	], result);
	const [tx, ty, tz] = asset.transform.position;
	if (tx !== 0 || ty !== 0 || tz !== 0) result = translate([
		tx,
		ty,
		tz
	], result);
	return result;
}
function buildExternalAssetOps(assets) {
	const unionOps = [];
	const subtractOps = [];
	for (const asset of assets) {
		if (asset.visibility === "reference") continue;
		let parsed;
		try {
			parsed = decodeAssetMesh(asset);
		} catch {
			continue;
		}
		const transformed = applyTransforms(asset, mesh(parsed.positions.slice(), parsed.indices.slice()));
		if (asset.visibility === "union") unionOps.push(transformed);
		else if (asset.visibility === "subtract") subtractOps.push(transformed);
	}
	return {
		unionOps,
		subtractOps
	};
}

// node_modules/zod/v4/core/util.js
function getEnumValues(entries) {
	const numericValues = Object.values(entries).filter((v) => typeof v === "number");
	return Object.entries(entries).filter(([k, _]) => numericValues.indexOf(+k) === -1).map(([_, v]) => v);
}
function joinValues(array, separator = "|") {
	return array.map((val) => stringifyPrimitive(val)).join(separator);
}
function jsonStringifyReplacer(_, value) {
	if (typeof value === "bigint") return value.toString();
	return value;
}
var Cached = class {
	constructor(getter) {
		this._getter = getter;
		this._value = void 0;
	}
	get value() {
		const getter = this._getter;
		if (getter !== void 0) {
			this._value = getter();
			this._getter = void 0;
		}
		return this._value;
	}
};
function cached(getter) {
	return new Cached(getter);
}
function nullish(input) {
	return input === null || input === void 0;
}
function cleanRegex(source) {
	const start = source.startsWith("^") ? 1 : 0;
	const end = source.endsWith("$") ? source.length - 1 : source.length;
	return source.slice(start, end);
}
function floatSafeRemainder(val, step) {
	const ratio = val / step;
	const roundedRatio = Math.round(ratio);
	const tolerance = 4 * Number.EPSILON * Math.max(Math.abs(ratio), 1);
	if (Math.abs(ratio - roundedRatio) < tolerance) return 0;
	return ratio - roundedRatio;
}
function assignProp(target, prop, value) {
	Object.defineProperty(target, prop, {
		value,
		writable: true,
		enumerable: true,
		configurable: true
	});
}
/**
* Whichever object a def's `shape` currently answers from: the one the caller passed until the first read, the frozen copy after it.
*
* Its keys and descriptors read without invoking anything, which is what lets a discriminated union check its discriminator, and the cycle walk read a shape, without resolving a getter that references the schema being constructed. A def that answers `shape` from an accessor of its own has none.
*/
function rawShape(def) {
	const desc = Object.getOwnPropertyDescriptor(def, "shape");
	return desc?.get ? desc.get.raw : desc?.value;
}
function sourceShape(schema) {
	return rawShape(schema._zod.def) ?? schema._zod.def.shape;
}
function deferProp(target, key, getter) {
	Object.defineProperty(target, key, {
		get() {
			const value = getter();
			assignProp(this, key, value);
			return value;
		},
		enumerable: true,
		configurable: true
	});
}
function putProp(target, key, value) {
	if (key in target) assignProp(target, key, value);
	else target[key] = value;
}
/**
* Copies `keys` of `source`'s shape onto `target`, each value passed through `wrap`.
*
* A key the source has resolved is copied through now, so the derived shape states it outright and nothing has to resolve it to learn what it holds. A key the source still defers stays deferred, and reads back through the source's own `shape`, so it resolves once and both shapes get that one schema.
*/
function mirrorShape(target, source, keys, wrap) {
	const raw = sourceShape(source);
	for (const key of keys) {
		const desc = Object.getOwnPropertyDescriptor(raw, key);
		if (!desc.enumerable) continue;
		if (desc.get) deferProp(target, key, () => {
			const value = source._zod.def.shape[key];
			return wrap ? wrap(value, key) : value;
		});
		else putProp(target, key, wrap ? wrap(desc.value, key) : desc.value);
	}
}
function mirrorProps(target, source) {
	for (const key of Reflect.ownKeys(source)) {
		const desc = Object.getOwnPropertyDescriptor(source, key);
		if (!desc.enumerable) continue;
		if (desc.get) deferProp(target, key, () => source[key]);
		else putProp(target, key, desc.value);
	}
}
function mergeDefs(...defs) {
	const mergedDescriptors = {};
	for (const def of defs) {
		const descriptors = Object.getOwnPropertyDescriptors(def);
		Object.assign(mergedDescriptors, descriptors);
	}
	return Object.defineProperties({}, mergedDescriptors);
}
function esc(str) {
	return JSON.stringify(str);
}
function slugify(input) {
	return input.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
}
const captureStackTrace = "captureStackTrace" in Error ? Error.captureStackTrace : (..._args) => {};
function isObject(data) {
	return typeof data === "object" && data !== null && !Array.isArray(data);
}
const allowsEval = /* @__PURE__*/ cached(() => {
	if (globalConfig.jitless) return false;
	if (typeof navigator !== "undefined" && navigator?.userAgent?.includes("Cloudflare")) return false;
	try {
		new Function("");
		return true;
	} catch (_) {
		return false;
	}
});
function isPlainObject(o) {
	if (isObject(o) === false) return false;
	const ctor = o.constructor;
	if (ctor === void 0) return true;
	if (typeof ctor !== "function") return true;
	const prot = ctor.prototype;
	if (isObject(prot) === false) return false;
	if (Object.prototype.hasOwnProperty.call(prot, "isPrototypeOf") === false) return false;
	return true;
}
function shallowClone(o) {
	if (isPlainObject(o)) return { ...o };
	if (Array.isArray(o)) return [...o];
	if (o instanceof Map) return new Map(o);
	if (o instanceof Set) return new Set(o);
	return o;
}
const propertyKeyTypes = /* @__PURE__*/ new Set([
	"string",
	"number",
	"symbol"
]);
function escapeRegex(str) {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function clone(inst, def, params) {
	const cl = new inst._zod.constr(def ?? inst._zod.def);
	if (!def || params?.parent) cl._zod.parent = inst;
	return cl;
}
function normalizeParams(_params) {
	const params = _params;
	if (!params) return {};
	if (typeof params === "string") return { error: () => params };
	if (params?.message !== void 0) {
		if (params?.error !== void 0) throw new Error("Cannot specify both `message` and `error` params");
		params.error = params.message;
	}
	delete params.message;
	if (typeof params.error === "string") return {
		...params,
		error: () => params.error
	};
	return params;
}
function stringifyPrimitive(value) {
	if (typeof value === "bigint") return value.toString() + "n";
	if (typeof value === "string") return `"${value}"`;
	return `${value}`;
}
function optionalKeys(shape) {
	return Object.keys(shape).filter((k) => {
		return shape[k]._zod.optin !== void 0 && shape[k]._zod.optout === "optional";
	});
}
const NUMBER_FORMAT_RANGES = /*@__PURE__*/ (() => ({
	safeint: [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
	int32: [-2147483648, 2147483647],
	uint32: [0, 4294967295],
	float32: [-34028234663852886e22, 34028234663852886e22],
	float64: [-Number.MAX_VALUE, Number.MAX_VALUE]
}))();
const BIGINT_FORMAT_RANGES = {
	int64: [/* @__PURE__*/ BigInt("-9223372036854775808"), /* @__PURE__*/ BigInt("9223372036854775807")],
	uint64: [/* @__PURE__*/ BigInt(0), /* @__PURE__*/ BigInt("18446744073709551615")]
};
function pick(schema, mask) {
	const currDef = schema._zod.def;
	const checks = currDef.checks;
	if (checks && checks.length > 0) throw new Error(".pick() cannot be used on object schemas containing refinements");
	const newShape = {};
	mirrorShape(newShape, schema, maskedKeys(schema, mask));
	return clone(schema, mergeDefs(currDef, {
		shape: newShape,
		checks: []
	}));
}
function maskedKeys(schema, mask) {
	const raw = sourceShape(schema);
	const keys = [];
	for (const key of Reflect.ownKeys(mask)) {
		if (!Object.getOwnPropertyDescriptor(raw, key)?.enumerable) throw new Error(`Unrecognized key: "${String(key)}"`);
		if (mask[key]) keys.push(key);
	}
	return keys;
}
function omit(schema, mask) {
	const currDef = schema._zod.def;
	const checks = currDef.checks;
	if (checks && checks.length > 0) throw new Error(".omit() cannot be used on object schemas containing refinements");
	const omitted = new Set(maskedKeys(schema, mask));
	const newShape = {};
	mirrorShape(newShape, schema, Reflect.ownKeys(sourceShape(schema)).filter((key) => !omitted.has(key)));
	return clone(schema, mergeDefs(currDef, {
		shape: newShape,
		checks: []
	}));
}
function extend(schema, shape) {
	if (!isPlainObject(shape)) throw new Error("Invalid input to extend: expected a plain object");
	const checks = schema._zod.def.checks;
	if (checks && checks.length > 0) {
		const existingShape = sourceShape(schema);
		for (const key of Reflect.ownKeys(shape)) if (Object.getOwnPropertyDescriptor(existingShape, key) !== void 0) throw new Error("Cannot overwrite keys on object schemas containing refinements. Use `.safeExtend()` instead.");
	}
	return clone(schema, mergeDefs(schema._zod.def, { shape: extended(schema, shape) }));
}
function extended(schema, shape) {
	const newShape = {};
	mirrorShape(newShape, schema, Reflect.ownKeys(sourceShape(schema)));
	mirrorProps(newShape, shape);
	return newShape;
}
function safeExtend(schema, shape) {
	if (!isPlainObject(shape)) throw new Error("Invalid input to safeExtend: expected a plain object");
	return clone(schema, mergeDefs(schema._zod.def, { shape: extended(schema, shape) }));
}
function merge(a, b) {
	if (!b?._zod?.def) throw new Error("Invalid input to merge: expected an object schema. To merge a plain shape, use `.extend()`.");
	if (a._zod.def.checks?.length) throw new Error(".merge() cannot be used on object schemas containing refinements. Use .safeExtend() instead.");
	const newShape = {};
	mirrorShape(newShape, a, Reflect.ownKeys(sourceShape(a)));
	mirrorShape(newShape, b, Reflect.ownKeys(sourceShape(b)));
	return clone(a, mergeDefs(a._zod.def, {
		shape: newShape,
		get catchall() {
			return b._zod.def.catchall;
		},
		checks: b._zod.def.checks ?? []
	}));
}
function partial(Class, schema, mask, name = "partial") {
	const checks = schema._zod.def.checks;
	if (checks && checks.length > 0) throw new Error(`.${name}() cannot be used on object schemas containing refinements`);
	const selected = mask ? new Set(maskedKeys(schema, mask)) : void 0;
	const newShape = {};
	mirrorShape(newShape, schema, Reflect.ownKeys(sourceShape(schema)), Class && ((value, key) => selected && !selected.has(key) ? value : new Class({
		type: "optional",
		innerType: value
	})));
	return clone(schema, mergeDefs(schema._zod.def, {
		shape: newShape,
		checks: []
	}));
}
function required(Class, schema, mask) {
	const selected = mask ? new Set(maskedKeys(schema, mask)) : void 0;
	const newShape = {};
	mirrorShape(newShape, schema, Reflect.ownKeys(sourceShape(schema)), (value, key) => selected && !selected.has(key) ? value : new Class({
		type: "nonoptional",
		innerType: value
	}));
	return clone(schema, mergeDefs(schema._zod.def, { shape: newShape }));
}
function aborted(x, startIndex = 0) {
	if (x.aborted === true) return true;
	for (let i = startIndex; i < x.issues.length; i++) if (x.issues[i]?.continue !== true) return true;
	return false;
}
function explicitlyAborted(x, startIndex = 0) {
	if (x.aborted === true) return true;
	for (let i = startIndex; i < x.issues.length; i++) if (x.issues[i]?.continue === false) return true;
	return false;
}
function prefixIssues(path, issues) {
	return issues.map((iss) => {
		var _a;
		(_a = iss).path ?? (_a.path = []);
		iss.path.unshift(path);
		return iss;
	});
}
function unwrapMessage(message) {
	return typeof message === "string" ? message : message?.message;
}
/** The leading size checks of `defChecks` that set an upper bound, each paired with it. */
function sizeCaps(defChecks) {
	const caps = [];
	for (const ch of defChecks ?? []) {
		const d = ch._zod.def;
		if (!/_(length|size)$|_equals$/.test(d.check)) break;
		const max = d.maximum ?? d.length ?? d.size;
		if (max >= 0) caps.push([max, ch]);
	}
	return caps;
}
function attachSchema(issues, start, inst) {
	var _a;
	for (let i = start; i < issues.length; i++) (_a = issues[i]).schema ?? (_a.schema = inst);
}
function finalizeIssue(iss, ctx, config) {
	var _a;
	const traits = iss.inst?._zod?.traits;
	if (traits?.has("$ZodType")) {
		if (traits.has("$ZodCheck")) (_a = iss).schema ?? (_a.schema = iss.inst);
		else iss.schema = iss.inst;
	}
	const schemaError = iss.schema !== iss.inst ? iss.schema?._zod.def?.error : void 0;
	const message = iss.message ? iss.message : unwrapMessage(iss.inst?._zod.def?.error?.(iss)) ?? unwrapMessage(schemaError?.(iss)) ?? unwrapMessage(ctx?.error?.(iss)) ?? unwrapMessage(config.customError?.(iss)) ?? unwrapMessage(config.localeError?.(iss)) ?? "Invalid input";
	const full = {};
	for (const k of Object.keys(iss)) {
		if (k === "inst" || k === "schema" || k === "continue" || k === "input" || k === "__proto__") continue;
		full[k] = iss[k];
	}
	full.path ?? (full.path = []);
	full.message = message;
	if (ctx?.reportInput) full.input = iss.input;
	return full;
}
const highSurrogate = /[\uD800-\uDBFF]/;
function codePointLength(str) {
	const units = str.length;
	if (!highSurrogate.test(str)) return units;
	let count = units;
	for (let i = 0; i < units - 1; i++) if ((str.charCodeAt(i) & 64512) === 55296 && (str.charCodeAt(i + 1) & 64512) === 56320) {
		count--;
		i++;
	}
	return count;
}
function getLengthableOrigin(input) {
	if (Array.isArray(input)) return "array";
	if (typeof input === "string") return "string";
	return "unknown";
}
function parsedType(data) {
	const t = typeof data;
	switch (t) {
		case "number": return Number.isNaN(data) ? "nan" : "number";
		case "object": {
			if (data === null) return "null";
			if (Array.isArray(data)) return "array";
			const obj = data;
			if (obj && Object.getPrototypeOf(obj) !== Object.prototype && "constructor" in obj && obj.constructor) return obj.constructor.name;
		}
	}
	return t;
}
function issue(...args) {
	const [iss, input, inst] = args;
	if (typeof iss === "string") return {
		message: iss,
		code: "custom",
		input,
		inst
	};
	return { ...iss };
}
/**
* Installs a trait's members on its prototype. Each value builds that member for the instance on first read; the built value shadows the accessor as an own property, so a detached `const { parse } = schema` keeps working.
*
* Call this from a `proto` initializer, which runs once per prototype — never per instance.
*/
function members(proto, table) {
	for (const key in table) {
		const desc = Object.getOwnPropertyDescriptor(table, key);
		if (desc.get) Object.defineProperty(proto, key, {
			...desc,
			enumerable: false
		});
		else defineBound(proto, key, desc.value);
	}
}
/** Shadows a prototype member with an own value, so a getter that builds from the instance runs once. */
function own(inst, key, value, enumerable = true) {
	Object.defineProperty(inst, key, {
		configurable: true,
		writable: true,
		enumerable,
		value
	});
	return value;
}
/** Like {@link own}, for a member that was never an own data property and has to stay out of `Object.keys`. */
function hide(inst, key, value) {
	return own(inst, key, value, false);
}
/** Adds members a table derives from the instance: each builds on first read and shadows as own data, and assignment shadows the same way, as when these were own properties. */
/* @__NO_SIDE_EFFECTS__ */
function derived(computes, table) {
	for (const key in computes) {
		const compute = computes[key];
		Object.defineProperty(table, key, {
			configurable: true,
			enumerable: true,
			get() {
				return own(this, key, compute(this));
			},
			set(value) {
				own(this, key, value);
			}
		});
	}
	return table;
}
function defineBound(proto, key, fn) {
	Object.defineProperty(proto, key, {
		configurable: true,
		get() {
			return this == null ? fn : own(this, key, fn.bind(this));
		},
		set(value) {
			own(this, key, value);
		}
	});
}
/** Returns the prototype to install on, or `undefined` if this group is already installed on it. */
function claim(inst, sentinel) {
	const proto = Object.getPrototypeOf(inst);
	return sentinel in proto ? void 0 : proto;
}
let installing;
let broke = false;
const breaker = {
	configurable: true,
	get() {
		broke = true;
	}
};
/**
* Installs a lazily-derived internal on the `_zod` prototype of `inst`'s
* constructor, computed from the internals object itself and cached there on
* first read. One accessor per constructor rather than one per instance.
*/
function defineLazyInternal(inst, key, compute) {
	const proto = Object.getPrototypeOf(inst._zod);
	if (key in proto && installing !== inst._zod) {
		installing = void 0;
		return;
	}
	installing = inst._zod;
	Object.defineProperty(proto, key, {
		configurable: true,
		get() {
			Object.defineProperty(this, key, breaker);
			const outer = broke;
			broke = false;
			try {
				const value = compute(this);
				if (broke) delete this[key];
				else Object.defineProperty(this, key, {
					configurable: true,
					writable: true,
					value
				});
				broke = broke || outer;
				return value;
			} catch (err) {
				delete this[key];
				broke = broke || outer;
				throw err;
			}
		},
		set(value) {
			Object.defineProperty(this, key, {
				configurable: true,
				writable: true,
				value
			});
		}
	});
}
/**
* Installs `key` on `inst`'s prototype, computed by `make` on first read and cached there as an own
* data property. One accessor per constructor rather than one per instance, because an own accessor
* puts every instance after the first into v8 dictionary mode. The key doubles as the sentinel.
*/
function installLazyProp(inst, key, make, enumerable) {
	const proto = claim(inst, key);
	if (!proto) return;
	Object.defineProperty(proto, key, {
		configurable: true,
		get() {
			const desc = {
				configurable: true,
				writable: true,
				enumerable,
				value: void 0
			};
			Object.defineProperty(this, key, desc);
			desc.value = make(this);
			Object.defineProperty(this, key, desc);
			return desc.value;
		},
		set(value) {
			Object.defineProperty(this, key, {
				configurable: true,
				writable: true,
				enumerable,
				value
			});
		}
	});
}
/** Marks the thunk `_catch` synthesises for a constant catch value. `Function.length` cannot tell that thunk from a user callback — rest and defaulted parameters both report arity 0 — and a user callback reads `ctx.error`, whose issues only finalize correctly against the caller's per-parse error map. Provenance can say what arity cannot. A plain string key rather than `Symbol.for`, whose call at module scope no bundler can prove pure — the same shape that anchored `urlCanParse` into every build. */
const CONSTANT_CATCH = "~constantCatch";
/** Wraps a constant catch value in a thunk tagged with {@link CONSTANT_CATCH}. */
function constantCatch(value) {
	const fn = () => value;
	fn[CONSTANT_CATCH] = true;
	return fn;
}

// node_modules/zod/v4/core/core.js
var _a$1;
const _zodDesc = {
	value: void 0,
	enumerable: false
};
let _E = "captureStackTrace" in Error ? Error : null;
function newError(Definition) {
	const E = _E;
	if (E) {
		const saved = E.stackTraceLimit;
		if (typeof saved === "number") {
			try {
				E.stackTraceLimit = 0;
			} catch {
				_E = null;
				return new Definition();
			}
			try {
				return new Definition();
			} finally {
				E.stackTraceLimit = saved;
			}
		}
	}
	return new Definition();
}
/* @__NO_SIDE_EFFECTS__ */
function $constructor(name, initializer, proto, params) {
	const zodProto = {};
	function Internals(def) {
		this.def = def;
		this.constr = _;
		this.traits = /* @__PURE__ */ new Set();
	}
	Internals.prototype = zodProto;
	const protoMembers = proto;
	const initialized = protoMembers && /* @__PURE__ */ new WeakSet();
	function init(inst, def) {
		if (!inst._zod) {
			_zodDesc.value = new Internals(def);
			try {
				Object.defineProperty(inst, "_zod", _zodDesc);
			} finally {
				_zodDesc.value = void 0;
			}
		} else if (inst._zod.traits.has(name)) return;
		inst._zod.traits.add(name);
		initializer(inst, def);
		if (initialized) {
			const own = Object.getPrototypeOf(inst);
			const ctorProto = inst._zod.constr.prototype;
			let up = own;
			while (up && up !== ctorProto) up = Object.getPrototypeOf(up);
			const target = up ?? own;
			if (!initialized.has(target)) {
				initialized.add(target);
				members(target, protoMembers);
			}
		}
		const proto = _.prototype;
		for (const k in proto) {
			if (!Object.prototype.hasOwnProperty.call(proto, k)) continue;
			if (!(k in inst)) inst[k] = proto[k].bind(inst);
		}
	}
	const Parent = params?.Parent ?? Object;
	class Definition extends Parent {}
	Object.defineProperty(Definition, "name", { value: name });
	function _(def) {
		const inst = params?.Parent ? newError(Definition) : this;
		init(inst, def);
		const deferred = inst._zod.deferred;
		if (deferred) {
			for (const fn of deferred) fn();
			inst._zod.deferred = void 0;
		}
		const pp = globalThis.__zod_globalConfig?.postProcessor;
		if (pp) pp(inst);
		return inst;
	}
	Object.defineProperty(_, "init", { value: init });
	Object.defineProperty(_, Symbol.hasInstance, { value: (inst) => {
		if (params?.Parent && inst instanceof params.Parent) return true;
		return inst?._zod?.traits?.has(name);
	} });
	Object.defineProperty(_, "name", { value: name });
	return _;
}
var $ZodAsyncError = class extends Error {
	constructor() {
		super(`Encountered Promise during synchronous parse. Use .parseAsync() instead.`);
	}
};
var $ZodEncodeError = class extends Error {
	constructor(name) {
		super(`Encountered unidirectional transform during encode: ${name}`);
		this.name = "ZodEncodeError";
	}
};
(_a$1 = globalThis).__zod_globalConfig ?? (_a$1.__zod_globalConfig = {});
const globalConfig = globalThis.__zod_globalConfig;
function config(newConfig) {
	if (newConfig) Object.assign(globalConfig, newConfig);
	return globalConfig;
}

// node_modules/zod/v4/core/errors.js
function _getMessage() {
	const internals = this._zod;
	internals.message ?? (internals.message = JSON.stringify(internals.def, jsonStringifyReplacer, 2));
	return internals.message;
}
function _setMessage(value) {
	this._zod.message = value;
}
const _messageDesc = {
	get: _getMessage,
	set: _setMessage,
	enumerable: true,
	configurable: true
};
const _issuesDesc = {
	value: void 0,
	enumerable: false
};
const _installedToString = /* @__PURE__ */ new WeakSet([Object.prototype, Error.prototype]);
const initializer$1 = (inst, def) => {
	inst.name = "$ZodError";
	_issuesDesc.value = def;
	Object.defineProperty(inst, "issues", _issuesDesc);
	_issuesDesc.value = void 0;
	Object.defineProperty(inst, "message", _messageDesc);
	const proto = Object.getPrototypeOf(inst);
	if (!_installedToString.has(proto)) {
		_installedToString.add(proto);
		Object.defineProperty(proto, "toString", {
			configurable: true,
			enumerable: false,
			get() {
				const value = () => this.message;
				Object.defineProperty(this, "toString", {
					value,
					configurable: true,
					writable: true
				});
				return value;
			},
			set(value) {
				Object.defineProperty(this, "toString", {
					value,
					configurable: true,
					writable: true
				});
			}
		});
	}
};
const $ZodError = /* @__PURE__ */ $constructor("$ZodError", initializer$1);
/** Get-or-create `obj[key]` as an own data property. A path segment naming an inherited member
* ("toString", "constructor") would otherwise read through to the prototype, and assigning
* "__proto__" would hit the setter instead of creating a key. */
function node(obj, key, make) {
	if (!Object.prototype.hasOwnProperty.call(obj, key)) {
		if (key === "__proto__") Object.defineProperty(obj, key, {
			value: make(),
			writable: true,
			enumerable: true,
			configurable: true
		});
		else obj[key] = make();
	}
	return obj[key];
}
function flattenError(error, mapper = (issue) => issue.message) {
	const fieldErrors = {};
	const formErrors = [];
	for (const sub of error.issues) if (sub.path.length > 0) node(fieldErrors, sub.path[0], () => []).push(mapper(sub));
	else formErrors.push(mapper(sub));
	return {
		formErrors,
		fieldErrors
	};
}
function formatError(error, mapper = (issue) => issue.message) {
	const fieldErrors = { _errors: [] };
	const processError = (error, path = []) => {
		for (const issue of error.issues) if (issue.code === "invalid_union" && issue.errors.length) issue.errors.map((issues) => processError({ issues }, [...path, ...issue.path]));
		else if (issue.code === "invalid_key") processError({ issues: issue.issues }, [...path, ...issue.path]);
		else if (issue.code === "invalid_element") processError({ issues: issue.issues }, [...path, ...issue.path]);
		else {
			const fullpath = [...path, ...issue.path];
			if (fullpath.length === 0) fieldErrors._errors.push(mapper(issue));
			else {
				let curr = fieldErrors;
				let i = 0;
				while (i < fullpath.length) {
					const el = fullpath[i];
					const terminal = i === fullpath.length - 1;
					if (el === "_errors") {
						if (terminal) curr._errors.push(mapper(issue));
						i++;
						continue;
					}
					if (!Object.prototype.hasOwnProperty.call(curr, el)) Object.defineProperty(curr, el, {
						value: { _errors: [] },
						enumerable: true,
						writable: true,
						configurable: true
					});
					const node = curr[el];
					if (terminal) node._errors.push(mapper(issue));
					curr = node;
					i++;
				}
			}
		}
	};
	processError(error);
	return fieldErrors;
}

// node_modules/zod/v4/core/parse.js
function finalizeParams(callee, params) {
	return {
		callee: params?.callee ?? callee,
		Err: params?.Err
	};
}
const _parse = (_Err) => {
	const fn = (schema, value, _ctx, _params) => {
		const ctx = _ctx ? {
			..._ctx,
			async: false
		} : { async: false };
		const result = schema._zod.run({
			value,
			issues: []
		}, ctx);
		if (result instanceof Promise) throw new $ZodAsyncError();
		if (result.issues.length) {
			const e = new ((_params?.Err) ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
			captureStackTrace(e, _params?.callee ?? fn);
			throw e;
		}
		return result.value;
	};
	return fn;
};
const _parseAsync = (_Err) => {
	const fn = async (schema, value, _ctx, params) => {
		const ctx = _ctx ? {
			..._ctx,
			async: true
		} : { async: true };
		let result = schema._zod.run({
			value,
			issues: []
		}, ctx);
		if (result instanceof Promise) result = await result;
		if (result.issues.length) {
			const e = new ((params?.Err) ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
			captureStackTrace(e, params?.callee ?? fn);
			throw e;
		}
		return result.value;
	};
	return fn;
};
const _safeParse = (_Err) => (schema, value, _ctx) => {
	const ctx = _ctx ? {
		..._ctx,
		async: false
	} : { async: false };
	const result = schema._zod.run({
		value,
		issues: []
	}, ctx);
	if (result instanceof Promise) throw new $ZodAsyncError();
	return result.issues.length ? failure(_Err, result.issues, ctx) : {
		success: true,
		data: result.value
	};
};
function failure(Err, issues, ctx) {
	let error;
	return {
		success: false,
		get error() {
			if (!error) {
				error = new Err(issues.map((iss) => finalizeIssue(iss, ctx, config())));
				issues = void 0;
				ctx = void 0;
			}
			return error;
		},
		set error(e) {
			error = e;
			issues = void 0;
			ctx = void 0;
		}
	};
}
const _safeParseAsync = (_Err) => async (schema, value, _ctx) => {
	const ctx = _ctx ? {
		..._ctx,
		async: true
	} : { async: true };
	let result = schema._zod.run({
		value,
		issues: []
	}, ctx);
	if (result instanceof Promise) result = await result;
	return result.issues.length ? failure(_Err, result.issues, ctx) : {
		success: true,
		data: result.value
	};
};
const COMPILE_INVALID = /* @__PURE__ */ Symbol.for("zod.compile.invalid");
const COMPILE_FALLBACK = /* @__PURE__ */ Symbol.for("zod.compile.fallback");
const validate = ((schema, value, _ctx) => {
	const validator = schema._zod.bag.validator;
	if (validator !== void 0) {
		if (validator(value) !== COMPILE_INVALID) return true;
		if (validator.definite === true && _ctx === void 0) return false;
	}
	return validateFallback(schema, value, _ctx);
});
function validateFallback(schema, value, _ctx) {
	const ctx = _ctx ? {
		..._ctx,
		async: false,
		abortEarly: true
	} : {
		async: false,
		abortEarly: true
	};
	const fallbackRun = schema._zod.bag.fallbackRun;
	let result;
	if (fallbackRun) {
		ctx[COMPILE_FALLBACK] = true;
		result = fallbackRun({
			value,
			issues: []
		}, ctx);
	} else result = schema._zod.run({
		value,
		issues: []
	}, ctx);
	if (result instanceof Promise) throw new $ZodAsyncError();
	return result.issues.length === 0;
}
const validateAsync$1 = async (schema, value, _ctx) => {
	const ctx = _ctx ? {
		..._ctx,
		async: true,
		abortEarly: true
	} : {
		async: true,
		abortEarly: true
	};
	let result = schema._zod.run({
		value,
		issues: []
	}, ctx);
	if (result instanceof Promise) result = await result;
	return result.issues.length === 0;
};
const _encode = (_Err) => {
	const parse = _parse(_Err);
	const fn = (schema, value, _ctx, _params) => {
		const ctx = _ctx ? {
			..._ctx,
			direction: "backward"
		} : { direction: "backward" };
		return parse(schema, value, ctx, finalizeParams(fn, _params));
	};
	return fn;
};
const _decode = (_Err) => {
	const parse = _parse(_Err);
	const fn = (schema, value, _ctx, _params) => {
		return parse(schema, value, _ctx, finalizeParams(fn, _params));
	};
	return fn;
};
const _encodeAsync = (_Err) => {
	const parseAsync = _parseAsync(_Err);
	const fn = async (schema, value, _ctx, _params) => {
		const ctx = _ctx ? {
			..._ctx,
			direction: "backward"
		} : { direction: "backward" };
		return await parseAsync(schema, value, ctx, finalizeParams(fn, _params));
	};
	return fn;
};
const _decodeAsync = (_Err) => {
	const parseAsync = _parseAsync(_Err);
	const fn = async (schema, value, _ctx, _params) => {
		return await parseAsync(schema, value, _ctx, finalizeParams(fn, _params));
	};
	return fn;
};
const _safeEncode = (_Err) => (schema, value, _ctx) => {
	const ctx = _ctx ? {
		..._ctx,
		direction: "backward"
	} : { direction: "backward" };
	return _safeParse(_Err)(schema, value, ctx);
};
const _safeDecode = (_Err) => (schema, value, _ctx) => {
	return _safeParse(_Err)(schema, value, _ctx);
};
const _safeEncodeAsync = (_Err) => async (schema, value, _ctx) => {
	const ctx = _ctx ? {
		..._ctx,
		direction: "backward"
	} : { direction: "backward" };
	return _safeParseAsync(_Err)(schema, value, ctx);
};
const _safeDecodeAsync = (_Err) => async (schema, value, _ctx) => {
	return _safeParseAsync(_Err)(schema, value, _ctx);
};

// node_modules/zod/v4/core/regexes.js
/**
* @deprecated CUID v1 is deprecated by its authors due to information leakage
* (timestamps embedded in the id). Use {@link cuid2} instead.
* See https://github.com/paralleldrive/cuid.
*/
const cuid = /^[cC][0-9a-z]{6,}$/;
const cuid2 = /^[0-9a-z]+$/;
const ulid = /^[0-7][0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{25}$/;
const xid = /^[0-9a-vA-V]{20}$/;
const ksuid = /^[A-Za-z0-9]{27}$/;
const nanoid = /^[a-zA-Z0-9_-]{21}$/;
function nanoidOfLength(length) {
	return new RegExp(`^[a-zA-Z0-9_-]{${length}}$`);
}
/** ISO 8601-1 duration regex. Does not support the 8601-2 extensions like negative durations or fractional/negative components. */
const duration = /^P(?:(\d+W)|(?!.*W)(?=\d|T\d)(\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+([.,]\d+)?S)?)?)$/;
/** A regex for any UUID-like identifier: 8-4-4-4-12 hex pattern */
const guid = /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;
/** Returns a regex for validating an RFC 9562/4122 UUID.
*
* @param version Optionally specify a version 1-8. If no version is specified, all versions are supported. */
const uuid = (version) => {
	if (!version) return /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/;
	return new RegExp(`^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-${version}[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$`);
};
/** Practical email validation */
const email = /^(?:[A-Za-z0-9_'+\-]+\.)*[A-Za-z0-9_'+\-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/;
const _emoji$1 = `^(?=[\\s\\S]*[\\p{Extended_Pictographic}\\p{Regional_Indicator}\\u20E3])[\\p{Extended_Pictographic}\\p{Emoji_Component}]+$`;
function emoji() {
	return new RegExp(_emoji$1, "u");
}
const ipv4 = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
const ipv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/;
const cidrv4 = /^((25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/([0-9]|[1-2][0-9]|3[0-2])$/;
const cidrv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
const base64 = /^$|^(?:[0-9a-zA-Z+/]{4})*(?:(?:[0-9a-zA-Z+/]{2}==)|(?:[0-9a-zA-Z+/]{3}=))?$/;
const base64url = /^(?:[A-Za-z0-9_-]{4})*(?:[A-Za-z0-9_-]{2,3})?$/;
const httpProtocol = /^https?$/;
const e164 = /^\+[1-9]\d{6,14}$/;
const dateSource = `(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))`;
/** Anchors a pattern source. The interpolation lives here rather than at the call site because
* esbuild will not drop a `@__PURE__` call whose own argument interpolates a variable, but it
* will drop `anchor(dateSource)`. Keeping it inline pinned `date` into every bundle. */
function anchor(source) {
	return new RegExp(`^${source}$`);
}
const date = /*@__PURE__*/ anchor(dateSource);
function timeSource(args) {
	const hhmm = `(?:[01]\\d|2[0-3]):[0-5]\\d`;
	return typeof args.precision === "number" ? args.precision === -1 ? `${hhmm}` : args.precision === 0 ? `${hhmm}:[0-5]\\d` : `${hhmm}:[0-5]\\d\\.\\d{${args.precision}}` : args.seconds ? `${hhmm}:[0-5]\\d(?:\\.\\d+)?` : `${hhmm}(?::[0-5]\\d(?:\\.\\d+)?)?`;
}
function time(args) {
	return new RegExp(`^${timeSource(args)}$`);
}
function datetime(args) {
	const opts = ["Z"];
	if (args.offset) opts.push(`([+-](?:[01]\\d|2[0-3]):[0-5]\\d)`);
	const qualified = `${timeSource({
		precision: args.precision,
		seconds: true
	})}(?:${opts.join("|")})`;
	const timeRegex = args.local ? `${qualified}|${timeSource({ precision: args.precision })}` : qualified;
	return new RegExp(`^${dateSource}T(?:${timeRegex})$`);
}
const anyString = /^[\s\S]{0,}$/;
const number$1 = /^-?\d+(?:\.\d+)?$/;
const boolean$1 = /^(?:true|false)$/i;
const lowercase = /^[^A-Z]*$/;
const uppercase = /^[^a-z]*$/;

// node_modules/zod/v4/core/checks.js
const $ZodCheck = /*@__PURE__*/ $constructor("$ZodCheck", (inst, def) => {
	var _a;
	inst._zod ?? (inst._zod = {});
	inst._zod.def = def;
	(_a = inst._zod).onattach ?? (_a.onattach = []);
});
/** Default `when` for length-based checks: run only on non-nullish values with a `length`. */
const _whenHasLength = (payload) => {
	const val = payload.value;
	return !nullish(val) && val.length !== void 0;
};
const numericOriginMap = {
	number: "number",
	bigint: "bigint",
	object: "date"
};
const $ZodCheckLessThan = /*@__PURE__*/ $constructor("$ZodCheckLessThan", (inst, def) => {
	$ZodCheck.init(inst, def);
	const origin = numericOriginMap[typeof def.value];
	inst._zod.check = (payload) => {
		if (def.inclusive ? payload.value <= def.value : payload.value < def.value) return;
		payload.issues.push({
			origin: numericOriginMap[typeof payload.value] ?? origin,
			code: "too_big",
			maximum: typeof def.value === "object" ? def.value.getTime() : def.value,
			input: payload.value,
			inclusive: def.inclusive,
			inst,
			continue: !def.abort
		});
	};
});
const $ZodCheckGreaterThan = /*@__PURE__*/ $constructor("$ZodCheckGreaterThan", (inst, def) => {
	$ZodCheck.init(inst, def);
	const origin = numericOriginMap[typeof def.value];
	inst._zod.check = (payload) => {
		if (def.inclusive ? payload.value >= def.value : payload.value > def.value) return;
		payload.issues.push({
			origin: numericOriginMap[typeof payload.value] ?? origin,
			code: "too_small",
			minimum: typeof def.value === "object" ? def.value.getTime() : def.value,
			input: payload.value,
			inclusive: def.inclusive,
			inst,
			continue: !def.abort
		});
	};
});
const $ZodCheckMultipleOf = /*@__PURE__*/ $constructor("$ZodCheckMultipleOf", (inst, def) => {
	$ZodCheck.init(inst, def);
	inst._zod.check = (payload) => {
		if (typeof payload.value !== typeof def.value) throw new Error("Cannot mix number and bigint in multiple_of check.");
		if (typeof payload.value === "bigint" ? def.value !== BigInt(0) && payload.value % def.value === BigInt(0) : floatSafeRemainder(payload.value, def.value) === 0) return;
		payload.issues.push({
			origin: typeof payload.value,
			code: "not_multiple_of",
			divisor: def.value,
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
const $ZodCheckNumberFormat = /*@__PURE__*/ $constructor("$ZodCheckNumberFormat", (inst, def) => {
	$ZodCheck.init(inst, def);
	def.format = def.format || "float64";
	const isInt = def.format?.includes("int");
	const origin = isInt ? "int" : "number";
	const [minimum, maximum] = NUMBER_FORMAT_RANGES[def.format];
	inst._zod.check = (payload) => {
		const input = payload.value;
		if (isInt) {
			if (!Number.isInteger(input)) {
				payload.issues.push({
					expected: origin,
					format: def.format,
					code: "invalid_type",
					continue: false,
					input,
					inst
				});
				return;
			}
			if (!Number.isSafeInteger(input)) {
				if (input > 0) payload.issues.push({
					input,
					code: "too_big",
					maximum: Number.MAX_SAFE_INTEGER,
					note: "Integers must be within the safe integer range.",
					inst,
					origin,
					inclusive: true,
					continue: !def.abort
				});
				else payload.issues.push({
					input,
					code: "too_small",
					minimum: Number.MIN_SAFE_INTEGER,
					note: "Integers must be within the safe integer range.",
					inst,
					origin,
					inclusive: true,
					continue: !def.abort
				});
				return;
			}
		}
		if (input < minimum) payload.issues.push({
			origin: "number",
			input,
			code: "too_small",
			minimum,
			inclusive: true,
			inst,
			continue: !def.abort
		});
		if (input > maximum) payload.issues.push({
			origin: "number",
			input,
			code: "too_big",
			maximum,
			inclusive: true,
			inst,
			continue: !def.abort
		});
	};
});
const $ZodCheckMaxLength = /*@__PURE__*/ $constructor("$ZodCheckMaxLength", (inst, def) => {
	var _a;
	$ZodCheck.init(inst, def);
	(_a = inst._zod.def).when ?? (_a.when = _whenHasLength);
	inst._zod.check = (payload) => {
		const input = payload.value;
		const units = input.length;
		if ((typeof input === "string" && units > def.maximum ? codePointLength(input) : units) <= def.maximum) return;
		const origin = getLengthableOrigin(input);
		payload.issues.push({
			origin,
			code: "too_big",
			maximum: def.maximum,
			inclusive: true,
			input,
			inst,
			continue: !def.abort
		});
	};
});
const $ZodCheckMinLength = /*@__PURE__*/ $constructor("$ZodCheckMinLength", (inst, def) => {
	var _a;
	$ZodCheck.init(inst, def);
	(_a = inst._zod.def).when ?? (_a.when = _whenHasLength);
	inst._zod.check = (payload) => {
		const input = payload.value;
		const units = input.length;
		if ((typeof input === "string" && units >= def.minimum && units < def.minimum * 2 ? codePointLength(input) : units) >= def.minimum) return;
		const origin = getLengthableOrigin(input);
		payload.issues.push({
			origin,
			code: "too_small",
			minimum: def.minimum,
			inclusive: true,
			input,
			inst,
			continue: !def.abort
		});
	};
});
const $ZodCheckLengthEquals = /*@__PURE__*/ $constructor("$ZodCheckLengthEquals", (inst, def) => {
	var _a;
	$ZodCheck.init(inst, def);
	(_a = inst._zod.def).when ?? (_a.when = _whenHasLength);
	inst._zod.check = (payload) => {
		const input = payload.value;
		const units = input.length;
		const length = typeof input === "string" && units >= def.length && units <= def.length * 2 ? codePointLength(input) : units;
		if (length === def.length) return;
		const origin = getLengthableOrigin(input);
		const tooBig = length > def.length;
		payload.issues.push({
			origin,
			...tooBig ? {
				code: "too_big",
				maximum: def.length
			} : {
				code: "too_small",
				minimum: def.length
			},
			inclusive: true,
			exact: true,
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
const $ZodCheckStringFormat = /*@__PURE__*/ $constructor("$ZodCheckStringFormat", (inst, def) => {
	var _a, _b;
	$ZodCheck.init(inst, def);
	if (def.pattern) (_a = inst._zod).check ?? (_a.check = (payload) => {
		def.pattern.lastIndex = 0;
		if (def.pattern.test(payload.value)) return;
		payload.issues.push({
			origin: "string",
			code: "invalid_format",
			format: def.format,
			input: payload.value,
			...def.pattern ? { pattern: def.pattern.toString() } : {},
			inst,
			continue: !def.abort
		});
	});
	else (_b = inst._zod).check ?? (_b.check = () => {});
});
const $ZodCheckRegex = /*@__PURE__*/ $constructor("$ZodCheckRegex", (inst, def) => {
	$ZodCheckStringFormat.init(inst, def);
	inst._zod.check = (payload) => {
		def.pattern.lastIndex = 0;
		if (def.pattern.test(payload.value)) return;
		payload.issues.push({
			origin: "string",
			code: "invalid_format",
			format: "regex",
			input: payload.value,
			pattern: def.pattern.toString(),
			inst,
			continue: !def.abort
		});
	};
});
const $ZodCheckLowerCase = /*@__PURE__*/ $constructor("$ZodCheckLowerCase", (inst, def) => {
	def.pattern ?? (def.pattern = lowercase);
	$ZodCheckStringFormat.init(inst, def);
});
const $ZodCheckUpperCase = /*@__PURE__*/ $constructor("$ZodCheckUpperCase", (inst, def) => {
	def.pattern ?? (def.pattern = uppercase);
	$ZodCheckStringFormat.init(inst, def);
});
const $ZodCheckIncludes = /*@__PURE__*/ $constructor("$ZodCheckIncludes", (inst, def) => {
	$ZodCheck.init(inst, def);
	const escapedRegex = escapeRegex(def.includes);
	def.pattern = new RegExp(typeof def.position === "number" ? `^.{${def.position},}${escapedRegex}` : escapedRegex);
	inst._zod.check = (payload) => {
		if (payload.value.includes(def.includes, def.position)) return;
		payload.issues.push({
			origin: "string",
			code: "invalid_format",
			format: "includes",
			includes: def.includes,
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
const $ZodCheckStartsWith = /*@__PURE__*/ $constructor("$ZodCheckStartsWith", (inst, def) => {
	$ZodCheck.init(inst, def);
	const pattern = new RegExp(`^${escapeRegex(def.prefix)}.*`);
	def.pattern ?? (def.pattern = pattern);
	inst._zod.check = (payload) => {
		if (payload.value.startsWith(def.prefix)) return;
		payload.issues.push({
			origin: "string",
			code: "invalid_format",
			format: "starts_with",
			prefix: def.prefix,
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
const $ZodCheckEndsWith = /*@__PURE__*/ $constructor("$ZodCheckEndsWith", (inst, def) => {
	$ZodCheck.init(inst, def);
	const pattern = new RegExp(`.*${escapeRegex(def.suffix)}$`);
	def.pattern ?? (def.pattern = pattern);
	inst._zod.check = (payload) => {
		if (payload.value.endsWith(def.suffix)) return;
		payload.issues.push({
			origin: "string",
			code: "invalid_format",
			format: "ends_with",
			suffix: def.suffix,
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
const $ZodCheckOverwrite = /*@__PURE__*/ $constructor("$ZodCheckOverwrite", (inst, def) => {
	$ZodCheck.init(inst, def);
	inst._zod.check = (payload) => {
		payload.value = def.tx(payload.value);
	};
});

// node_modules/zod/v4/core/doc.js
var Doc = class {
	constructor(args = [], closed = {}) {
		this.content = [];
		this.indent = 0;
		this.args = args;
		this.closed = closed;
	}
	indented(fn) {
		this.indent += 1;
		try {
			fn(this);
		} finally {
			this.indent -= 1;
		}
	}
	write(arg) {
		if (typeof arg === "function") {
			arg(this, { execution: "sync" });
			arg(this, { execution: "async" });
			return;
		}
		const lines = arg.split("\n").filter((x) => x);
		const minIndent = Math.min(...lines.map((x) => x.length - x.trimStart().length));
		const dedented = lines.map((x) => x.slice(minIndent)).map((x) => " ".repeat(this.indent * 2) + x);
		for (const line of dedented) this.content.push(line);
	}
	compile() {
		const F = Function;
		const content = this?.content ?? [``];
		return new F(...Object.keys(this.closed), `return function (${this.args.join(", ")}) {\n${content.join("\n")}\n};`)(...Object.values(this.closed));
	}
};

// node_modules/zod/v4/core/versions.js
const version = {
	major: 4,
	minor: 6,
	patch: 7
};

// node_modules/zod/v4/core/schemas.js
const $ZodType = /*@__PURE__*/ $constructor("$ZodType", (inst, def) => {
	var _a;
	inst ?? (inst = {});
	inst._zod.def = def;
	inst._zod.bag = inst._zod.bag || {};
	inst._zod.version = version;
	const defChecks = inst._zod.def.checks;
	const checks = inst._zod.traits.has("$ZodCheck") ? [inst, ...defChecks ?? []] : defChecks?.length ? [...defChecks] : [];
	for (const ch of checks) for (const fn of ch._zod.onattach) fn(inst);
	if (checks.length === 0) {
		(_a = inst._zod).deferred ?? (_a.deferred = []);
		inst._zod.deferred?.push(() => {
			inst._zod.run = inst._zod.parse;
		});
	} else {
		const runChecks = (payload, checks, ctx) => {
			if (payload.memo) return payload;
			let isAborted = aborted(payload);
			let asyncResult;
			for (const ch of checks) {
				if (ch._zod.def.when) {
					if (explicitlyAborted(payload)) continue;
					if (!ch._zod.def.when(payload)) continue;
				} else if (isAborted) continue;
				const currLen = payload.issues.length;
				const _ = ch._zod.check(payload);
				if (_ instanceof Promise && ctx?.async === false) throw new $ZodAsyncError();
				if (asyncResult || _ instanceof Promise) asyncResult = (asyncResult ?? Promise.resolve()).then(async () => {
					await _;
					if (payload.issues.length === currLen) return;
					attachSchema(payload.issues, currLen, inst);
					if (!isAborted) isAborted = aborted(payload, currLen);
				});
				else {
					if (payload.issues.length === currLen) continue;
					attachSchema(payload.issues, currLen, inst);
					if (!isAborted) isAborted = aborted(payload, currLen);
				}
			}
			if (asyncResult) return asyncResult.then(() => {
				return payload;
			});
			return payload;
		};
		const handleCanaryResult = (canary, payload, ctx) => {
			if (aborted(canary)) {
				canary.aborted = true;
				return canary;
			}
			const checkResult = runChecks(payload, checks, ctx);
			if (checkResult instanceof Promise) {
				if (ctx.async === false) throw new $ZodAsyncError();
				return checkResult.then((checkResult) => inst._zod.parse(checkResult, ctx));
			}
			return inst._zod.parse(checkResult, ctx);
		};
		inst._zod.run = (payload, ctx) => {
			if (ctx.skipChecks) return inst._zod.parse(payload, ctx);
			if (ctx.direction === "backward") {
				const canary = inst._zod.parse({
					value: payload.value,
					issues: []
				}, {
					...ctx,
					skipChecks: true
				});
				if (canary instanceof Promise) return canary.then((canary) => {
					return handleCanaryResult(canary, payload, ctx);
				});
				return handleCanaryResult(canary, payload, ctx);
			}
			const result = inst._zod.parse(payload, ctx);
			if (result instanceof Promise) {
				if (ctx.async === false) throw new $ZodAsyncError();
				return result.then((result) => runChecks(result, checks, ctx));
			}
			return runChecks(result, checks, ctx);
		};
	}
}, {
	get "~standard"() {
		return hide(this, "~standard", standardProps(this));
	},
	set "~standard"(value) {
		own(this, "~standard", value);
	}
});
/** The Standard Schema surface for `inst`. Shared so wrappers can extend it without forcing it. */
const toStandardResult = (r, ctx) => r.issues.length ? { issues: r.issues.map((iss) => finalizeIssue(iss, ctx, config())) } : { value: r.value };
async function validateAsync(inst, value) {
	const ctx = { async: true };
	return toStandardResult(await inst._zod.run({
		value,
		issues: []
	}, ctx), ctx);
}
function standardProps(inst) {
	return {
		validate: (value) => {
			const ctx = { async: false };
			try {
				const r = inst._zod.run({
					value,
					issues: []
				}, ctx);
				if (!(r instanceof Promise)) return toStandardResult(r, ctx);
			} catch (_) {}
			return validateAsync(inst, value);
		},
		vendor: "zod",
		version: 1
	};
}
const $ZodString = /*@__PURE__*/ $constructor("$ZodString", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.pattern = def.pattern ?? anyString;
	inst._zod.parse = (payload, _) => {
		if (def.coerce) try {
			payload.value = String(payload.value);
		} catch (_) {}
		if (typeof payload.value === "string") return payload;
		payload.issues.push({
			expected: "string",
			code: "invalid_type",
			input: payload.value,
			inst
		});
		return payload;
	};
});
const $ZodStringFormat = /*@__PURE__*/ $constructor("$ZodStringFormat", (inst, def) => {
	$ZodCheckStringFormat.init(inst, def);
	$ZodString.init(inst, def);
});
const $ZodGUID = /*@__PURE__*/ $constructor("$ZodGUID", (inst, def) => {
	def.pattern ?? (def.pattern = guid);
	$ZodStringFormat.init(inst, def);
});
const $ZodUUID = /*@__PURE__*/ $constructor("$ZodUUID", (inst, def) => {
	if (def.version) {
		const v = {
			v1: 1,
			v2: 2,
			v3: 3,
			v4: 4,
			v5: 5,
			v6: 6,
			v7: 7,
			v8: 8
		}[def.version];
		if (v === void 0) throw new Error(`Invalid UUID version: "${def.version}"`);
		def.pattern ?? (def.pattern = uuid(v));
	} else def.pattern ?? (def.pattern = uuid());
	$ZodStringFormat.init(inst, def);
});
const $ZodEmail = /*@__PURE__*/ $constructor("$ZodEmail", (inst, def) => {
	def.pattern ?? (def.pattern = email);
	$ZodStringFormat.init(inst, def);
});
/** The `://` guard rejected the input before the URL constructor saw it. */
const URL_BAD_FORMAT = 1;
/** The URL parser rejected the input. */
const URL_UNPARSEABLE = 2;
function canParseURL(input) {
	try {
		if (typeof URL !== "undefined" && typeof URL.canParse === "function") return URL.canParse(input);
		new URL(input);
		return true;
	} catch {
		return false;
	}
}
function validateURL(trimmed, def) {
	if (!("normalize" in def) && !("hostname" in def) && !("protocol" in def)) return canParseURL(trimmed) || 2;
	return parseURLObject(trimmed, def);
}
/** Parses a URL while preserving the non-normalizing HTTP guard. */
function parseURLObject(trimmed, def) {
	if (!def.normalize && def.protocol?.source === httpProtocol.source && !/^https?:\/\//i.test(trimmed)) return 1;
	try {
		if (typeof URL !== "undefined") {
			const URLStatic = URL;
			if (typeof URLStatic.parse === "function") return URLStatic.parse(trimmed) ?? 2;
		}
		return new URL(trimmed);
	} catch {
		return 2;
	}
}
const asciiTabOrNewline = /[\t\n\r]/g;
/** The URL parser deletes every ASCII tab, LF and CR from its input before it parses, so `new URL("https://exa\nmple.com")` reports on `example.com`. Applying the same deletion to the returned value closes the half of that divergence which can move the host; the parser's other rewrite, stripping C0 controls at the edges, cannot. */
function stripTabAndNewline(value) {
	return value.replace(asciiTabOrNewline, "");
}
function urlHostnameOk(url, hostname) {
	hostname.lastIndex = 0;
	return hostname.test(url.hostname);
}
function urlProtocolOk(url, protocol) {
	protocol.lastIndex = 0;
	return protocol.test(url.protocol.endsWith(":") ? url.protocol.slice(0, -1) : url.protocol);
}
const $ZodURL = /*@__PURE__*/ $constructor("$ZodURL", (inst, def) => {
	$ZodStringFormat.init(inst, def);
	inst._zod.check = (payload) => {
		try {
			const trimmed = payload.value.trim();
			const url = validateURL(trimmed, def);
			if (url === 1) {
				payload.issues.push({
					code: "invalid_format",
					format: "url",
					note: "Invalid URL format",
					input: payload.value,
					inst,
					continue: !def.abort
				});
				return;
			}
			if (url === 2) {
				payload.issues.push({
					code: "invalid_format",
					format: "url",
					input: payload.value,
					inst,
					continue: !def.abort
				});
				return;
			}
			if (url === true) {
				payload.value = stripTabAndNewline(trimmed);
				return;
			}
			if (def.hostname && !urlHostnameOk(url, def.hostname)) payload.issues.push({
				code: "invalid_format",
				format: "url",
				note: "Invalid hostname",
				pattern: def.hostname.source,
				input: payload.value,
				inst,
				continue: !def.abort
			});
			if (def.protocol && !urlProtocolOk(url, def.protocol)) payload.issues.push({
				code: "invalid_format",
				format: "url",
				note: "Invalid protocol",
				pattern: def.protocol.source,
				input: payload.value,
				inst,
				continue: !def.abort
			});
			payload.value = def.normalize ? url.href : stripTabAndNewline(trimmed);
			return;
		} catch (_) {
			payload.issues.push({
				code: "invalid_format",
				format: "url",
				input: payload.value,
				inst,
				continue: !def.abort
			});
		}
	};
});
const $ZodEmoji = /*@__PURE__*/ $constructor("$ZodEmoji", (inst, def) => {
	def.pattern ?? (def.pattern = emoji());
	$ZodStringFormat.init(inst, def);
});
const $ZodNanoID = /*@__PURE__*/ $constructor("$ZodNanoID", (inst, def) => {
	if (def.length !== void 0 && (!Number.isInteger(def.length) || def.length < 1)) throw new Error(`Invalid nanoid length: ${def.length}`);
	def.pattern ?? (def.pattern = def.length === void 0 ? nanoid : nanoidOfLength(def.length));
	$ZodStringFormat.init(inst, def);
});
/**
* @deprecated CUID v1 is deprecated by its authors due to information leakage
* (timestamps embedded in the id). Use {@link $ZodCUID2} instead.
* See https://github.com/paralleldrive/cuid.
*/
const $ZodCUID = /*@__PURE__*/ $constructor("$ZodCUID", (inst, def) => {
	def.pattern ?? (def.pattern = cuid);
	$ZodStringFormat.init(inst, def);
});
const $ZodCUID2 = /*@__PURE__*/ $constructor("$ZodCUID2", (inst, def) => {
	def.pattern ?? (def.pattern = cuid2);
	$ZodStringFormat.init(inst, def);
});
const $ZodULID = /*@__PURE__*/ $constructor("$ZodULID", (inst, def) => {
	def.pattern ?? (def.pattern = ulid);
	$ZodStringFormat.init(inst, def);
});
const $ZodXID = /*@__PURE__*/ $constructor("$ZodXID", (inst, def) => {
	def.pattern ?? (def.pattern = xid);
	$ZodStringFormat.init(inst, def);
});
const $ZodKSUID = /*@__PURE__*/ $constructor("$ZodKSUID", (inst, def) => {
	def.pattern ?? (def.pattern = ksuid);
	$ZodStringFormat.init(inst, def);
});
const $ZodISODateTime = /*@__PURE__*/ $constructor("$ZodISODateTime", (inst, def) => {
	def.pattern ?? (def.pattern = datetime(def));
	$ZodStringFormat.init(inst, def);
});
const $ZodISODate = /*@__PURE__*/ $constructor("$ZodISODate", (inst, def) => {
	def.pattern ?? (def.pattern = date);
	$ZodStringFormat.init(inst, def);
});
const $ZodISOTime = /*@__PURE__*/ $constructor("$ZodISOTime", (inst, def) => {
	def.pattern ?? (def.pattern = time(def));
	$ZodStringFormat.init(inst, def);
});
const $ZodISODuration = /*@__PURE__*/ $constructor("$ZodISODuration", (inst, def) => {
	def.pattern ?? (def.pattern = duration);
	$ZodStringFormat.init(inst, def);
});
const $ZodIPv4 = /*@__PURE__*/ $constructor("$ZodIPv4", (inst, def) => {
	def.pattern ?? (def.pattern = ipv4);
	$ZodStringFormat.init(inst, def);
});
/** An IPv6 address is written with hex digits, colons and dots, and nothing else. The guard is what makes the check below an IPv6 check: `new URL("http://[...]")` parses an authority, not an address, so `@` and `\` re-delimit it and `"::@1\\"` validates against the host `0.0.0.1`. The URL parser also deletes ASCII tab, LF and CR rather than failing, which is how `"::1\n"` validated as `::1`. */
const ipv6Alphabet = /^[0-9a-fA-F:.]+$/;
function isValidIPv6(value) {
	if (!ipv6Alphabet.test(value)) return false;
	return canParseURL(`http://[${value}]`);
}
const $ZodIPv6 = /*@__PURE__*/ $constructor("$ZodIPv6", (inst, def) => {
	def.pattern ?? (def.pattern = ipv6);
	$ZodStringFormat.init(inst, def);
	inst._zod.check = (payload) => {
		if (!isValidIPv6(payload.value)) payload.issues.push({
			code: "invalid_format",
			format: "ipv6",
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
const $ZodCIDRv4 = /*@__PURE__*/ $constructor("$ZodCIDRv4", (inst, def) => {
	def.pattern ?? (def.pattern = cidrv4);
	$ZodStringFormat.init(inst, def);
});
function isValidCIDRv6(value) {
	const parts = value.split("/");
	if (parts.length !== 2) return false;
	const [address, prefix] = parts;
	if (!prefix) return false;
	const prefixNum = Number(prefix);
	if (`${prefixNum}` !== prefix) return false;
	if (prefixNum < 0 || prefixNum > 128) return false;
	return isValidIPv6(address);
}
const $ZodCIDRv6 = /*@__PURE__*/ $constructor("$ZodCIDRv6", (inst, def) => {
	def.pattern ?? (def.pattern = cidrv6);
	$ZodStringFormat.init(inst, def);
	inst._zod.check = (payload) => {
		if (!isValidCIDRv6(payload.value)) payload.issues.push({
			code: "invalid_format",
			format: "cidrv6",
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
function isValidBase64(data) {
	if (data === "") return true;
	if (/\s/.test(data)) return false;
	if (data.length % 4 !== 0) return false;
	try {
		atob(data);
		return true;
	} catch {
		return false;
	}
}
const base64Charset = /^[0-9a-zA-Z+/]*={0,2}$/;
const $ZodBase64 = /*@__PURE__*/ $constructor("$ZodBase64", (inst, def) => {
	def.pattern ?? (def.pattern = base64Charset);
	$ZodStringFormat.init(inst, def);
	inst._zod.check = (payload) => {
		if (isValidBase64(payload.value)) return;
		payload.issues.push({
			code: "invalid_format",
			format: "base64",
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
const base64urlCharset = /^[A-Za-z0-9_-]*$/;
function isValidBase64URL(data) {
	if (!base64urlCharset.test(data)) return false;
	const base64 = data.replace(/[-_]/g, (c) => c === "-" ? "+" : "/");
	return isValidBase64(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
}
const $ZodBase64URL = /*@__PURE__*/ $constructor("$ZodBase64URL", (inst, def) => {
	def.pattern ?? (def.pattern = base64urlCharset);
	$ZodStringFormat.init(inst, def);
	inst._zod.check = (payload) => {
		if (isValidBase64URL(payload.value)) return;
		payload.issues.push({
			code: "invalid_format",
			format: "base64url",
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
const $ZodE164 = /*@__PURE__*/ $constructor("$ZodE164", (inst, def) => {
	def.pattern ?? (def.pattern = e164);
	$ZodStringFormat.init(inst, def);
});
function isValidJWT(token, algorithm = null) {
	try {
		const tokensParts = token.split(".");
		if (tokensParts.length !== 3) return false;
		const [header] = tokensParts;
		if (!header) return false;
		const parsedHeader = JSON.parse(atob(header));
		if ("typ" in parsedHeader && parsedHeader?.typ !== "JWT") return false;
		if (!parsedHeader.alg) return false;
		if (algorithm && (!("alg" in parsedHeader) || parsedHeader.alg !== algorithm)) return false;
		return true;
	} catch {
		return false;
	}
}
const $ZodJWT = /*@__PURE__*/ $constructor("$ZodJWT", (inst, def) => {
	$ZodStringFormat.init(inst, def);
	inst._zod.check = (payload) => {
		if (isValidJWT(payload.value, def.alg)) return;
		payload.issues.push({
			code: "invalid_format",
			format: "jwt",
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
const $ZodNumber = /*@__PURE__*/ $constructor("$ZodNumber", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.pattern = number$1;
	inst._zod.parse = (payload, _ctx) => {
		if (def.coerce) try {
			payload.value = Number(payload.value);
		} catch (_) {}
		const input = payload.value;
		if (typeof input === "number" && !Number.isNaN(input) && Number.isFinite(input)) return payload;
		const received = typeof input === "number" ? Number.isNaN(input) ? "NaN" : !Number.isFinite(input) ? String(input) : void 0 : void 0;
		payload.issues.push({
			expected: "number",
			code: "invalid_type",
			input,
			inst,
			...received ? { received } : {}
		});
		return payload;
	};
});
const $ZodNumberFormat = /*@__PURE__*/ $constructor("$ZodNumberFormat", (inst, def) => {
	$ZodCheckNumberFormat.init(inst, def);
	$ZodNumber.init(inst, def);
});
const $ZodBoolean = /*@__PURE__*/ $constructor("$ZodBoolean", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.pattern = boolean$1;
	inst._zod.parse = (payload, _ctx) => {
		if (def.coerce) try {
			payload.value = Boolean(payload.value);
		} catch (_) {}
		const input = payload.value;
		if (typeof input === "boolean") return payload;
		payload.issues.push({
			expected: "boolean",
			code: "invalid_type",
			input,
			inst
		});
		return payload;
	};
});
const $ZodUnknown = /*@__PURE__*/ $constructor("$ZodUnknown", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.parse = (payload) => payload;
});
const $ZodNever = /*@__PURE__*/ $constructor("$ZodNever", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.parse = (payload, _ctx) => {
		payload.issues.push({
			expected: "never",
			code: "invalid_type",
			input: payload.value,
			inst
		});
		return payload;
	};
});
function capSize(inst, size) {
	const caps = sizeCaps(inst._zod.def.checks);
	if (!caps.length) return;
	const cap = Math.min(...caps.map((c) => c[0]));
	const parse = inst._zod.parse;
	inst._zod.parse = (payload, ctx) => {
		const n = size(payload.value);
		if (n > cap && !ctx?.skipChecks && ctx?.direction !== "backward") {
			for (const [max, ch] of sizeCaps(inst._zod.def.checks)) if (n > max && ch._zod.def.when(payload)) {
				const start = payload.issues.length;
				ch._zod.check(payload);
				payload.issues[start].continue = false;
				attachSchema(payload.issues, start, inst);
				return payload;
			}
		}
		return parse(payload, ctx);
	};
}
const arraySize = (input) => Array.isArray(input) ? input.length : -1;
function handleArrayResult(result, final, index) {
	if (result.issues.length) final.issues.push(...prefixIssues(index, result.issues));
	final.value[index] = result.value;
}
const $ZodArray = /*@__PURE__*/ $constructor("$ZodArray", (inst, def) => {
	$ZodType.init(inst, def);
	const memo = globalConfig.memoizer;
	memo?.attach(inst);
	inst._zod.parse = (payload, ctx) => {
		const input = payload.value;
		if (!Array.isArray(input)) {
			payload.issues.push({
				expected: "array",
				code: "invalid_type",
				input,
				inst
			});
			return payload;
		}
		payload.value = memo ? memo.alloc(inst, payload, Array(input.length), ctx) : Array(input.length);
		const proms = [];
		const abortEarly = ctx?.abortEarly;
		for (let i = 0; i < input.length; i++) {
			const item = input[i];
			const result = def.element._zod.run({
				value: item,
				issues: []
			}, ctx);
			if (result instanceof Promise) proms.push(result.then((result) => handleArrayResult(result, payload, i)));
			else {
				handleArrayResult(result, payload, i);
				if (abortEarly && result.issues.length !== 0 && aborted(result)) break;
			}
		}
		if (proms.length) return Promise.all(proms).then(() => payload);
		return payload;
	};
	capSize(inst, arraySize);
});
function handlePropertyResult(result, final, key, input, optin, optout) {
	const isPresent = key in input;
	const isOptionalOut = optout === "optional";
	if (!isPresent && isOptionalOut && optin === "optional") return;
	if (result.issues.length) {
		if (optin !== void 0 && isOptionalOut && !isPresent) return;
		final.issues.push(...prefixIssues(key, result.issues));
	}
	if (!isPresent && optin === void 0) {
		if (!result.issues.length) final.issues.push({
			code: "invalid_type",
			expected: "nonoptional",
			input: void 0,
			path: [key]
		});
		return;
	}
	if (result.value === void 0) {
		if (isPresent || optin === "defaulted" && !isOptionalOut) final.value[key] = void 0;
	} else final.value[key] = result.value;
}
const NO_SYMBOL_KEYS = [];
function normalizeDef(def) {
	const keys = Object.keys(def.shape);
	const ownSymbols = Object.getOwnPropertySymbols(def.shape);
	const symbolKeys = ownSymbols.length ? ownSymbols : NO_SYMBOL_KEYS;
	const allKeys = symbolKeys.length ? [...keys, ...symbolKeys] : keys;
	for (const k of allKeys) if (!def.shape?.[k]?._zod?.traits?.has("$ZodType")) throw new Error(`Invalid element at key "${String(k)}": expected a Zod schema`);
	const okeys = optionalKeys(def.shape);
	return {
		...def,
		allKeys,
		symbolKeys,
		keySet: new Set(keys),
		numKeys: keys.length,
		optionalKeys: new Set(okeys)
	};
}
function handleCatchall(proms, input, payload, ctx, def, inst, abortEarly) {
	const unrecognized = [];
	const keySet = def.keySet;
	const _catchall = def.catchall._zod;
	const t = _catchall.def.type;
	const optin = _catchall.optin;
	const optout = _catchall.optout;
	let seen = 0;
	for (const key in input) {
		if (abortEarly && payload.issues.length !== seen) {
			if (aborted(payload, seen)) break;
			seen = payload.issues.length;
		}
		if (keySet.has(key)) continue;
		if (key === "__proto__") {
			if (t === "never") unrecognized.push(key);
			continue;
		}
		if (t === "never") {
			unrecognized.push(key);
			continue;
		}
		const r = _catchall.run({
			value: input[key],
			issues: []
		}, ctx);
		if (r instanceof Promise) proms.push(r.then((r) => handlePropertyResult(r, payload, key, input, optin, optout)));
		else handlePropertyResult(r, payload, key, input, optin, optout);
	}
	if (unrecognized.length) payload.issues.push({
		code: "unrecognized_keys",
		keys: unrecognized,
		input,
		inst,
		continue: true
	});
	if (!proms.length) return payload;
	return Promise.all(proms).then(() => {
		return payload;
	});
}
const $ZodObject = /*@__PURE__*/ $constructor("$ZodObject", (inst, def) => {
	$ZodType.init(inst, def);
	const desc = Object.getOwnPropertyDescriptor(def, "shape");
	const sh = desc?.get ? desc.get.raw : def.shape ?? {};
	if (sh) {
		const get = () => {
			const newSh = { ...sh };
			Object.defineProperty(def, "shape", { value: newSh });
			get.raw = newSh;
			return newSh;
		};
		get.raw = sh;
		Object.defineProperty(def, "shape", { get });
	}
	const _normalized = cached(() => normalizeDef(def));
	defineLazyInternal(inst, "propValues", (zod) => {
		const shape = zod.def.shape;
		const propValues = {};
		for (const key in shape) {
			const field = shape[key]._zod;
			if (field.values) {
				if (!Object.prototype.hasOwnProperty.call(propValues, key)) assignProp(propValues, key, /* @__PURE__ */ new Set());
				for (const v of field.values) propValues[key].add(v);
				if (field.optin !== void 0) propValues[key].add(void 0);
			}
		}
		return propValues;
	});
	const isObject$1 = isObject;
	const catchall = def.catchall;
	let value;
	const memo = globalConfig.memoizer;
	memo?.attach(inst);
	inst._zod.parse = (payload, ctx) => {
		value ?? (value = _normalized.value);
		const input = payload.value;
		if (!isObject$1(input)) {
			payload.issues.push({
				expected: "object",
				code: "invalid_type",
				input,
				inst
			});
			return payload;
		}
		payload.value = memo ? memo.alloc(inst, payload, {}, ctx) : {};
		const proms = [];
		const shape = value.shape;
		const abortEarly = ctx?.abortEarly;
		let seen = payload.issues.length;
		for (const key of value.allKeys) {
			if (abortEarly && payload.issues.length !== seen) {
				if (aborted(payload, seen)) break;
				seen = payload.issues.length;
			}
			if (key === "__proto__") continue;
			const el = shape[key];
			const optin = el._zod.optin;
			const optout = el._zod.optout;
			const r = el._zod.run({
				value: input[key],
				issues: []
			}, ctx);
			if (r instanceof Promise) proms.push(r.then((r) => handlePropertyResult(r, payload, key, input, optin, optout)));
			else handlePropertyResult(r, payload, key, input, optin, optout);
		}
		if (!catchall) return proms.length ? Promise.all(proms).then(() => payload) : payload;
		return handleCatchall(proms, input, payload, ctx, _normalized.value, inst, abortEarly === true);
	};
});
const $ZodObjectJIT = /*@__PURE__*/ $constructor("$ZodObjectJIT", (inst, def) => {
	$ZodObject.init(inst, def);
	const superParse = inst._zod.parse;
	const _normalized = cached(() => normalizeDef(def));
	const memo = globalConfig.memoizer;
	const generateFastpass = (shape) => {
		const normalized = _normalized.value;
		const syms = normalized.symbolKeys;
		const doc = new Doc(["payload", "ctx"], {
			shape,
			inst,
			memo,
			syms
		});
		const parseStr = (k) => `shape[${k}]._zod.run({ value: input[${k}], issues: [] }, ctx)`;
		const prefixStr = (id, k) => `
          let ${id}_ab = false;
          for (let i = 0; i < ${id}.issues.length; i++) {
            const iss = ${id}.issues[i];
            iss.path = iss.path ? [${k}, ...iss.path] : [${k}];
            payload.issues.push(iss);
            if (iss.continue !== true) ${id}_ab = true;
          }
          if (${id}_ab && ctx && ctx.abortEarly) {
            payload.value = newResult;
            return payload;
          }`;
		doc.write(`const input = payload.value;`);
		const ids = Object.create(null);
		let counter = 0;
		for (const key of normalized.allKeys) ids[key] = `key_${counter++}`;
		doc.write(memo ? `const newResult = memo.alloc(inst, payload, {}, ctx);` : `const newResult = {};`);
		for (const key of normalized.allKeys) {
			if (key === "__proto__") continue;
			const id = ids[key];
			const k = typeof key === "symbol" ? `syms[${syms.indexOf(key)}]` : esc(key);
			const isPresent = `${k} in input`;
			const schema = shape[key];
			const optin = schema?._zod?.optin;
			const isOptionalIn = optin !== void 0;
			const isOptionalOut = schema?._zod?.optout === "optional";
			doc.write(`const ${id} = ${parseStr(k)};`);
			if (isOptionalIn && isOptionalOut) {
				const assign = optin === "optional" ? `${id}_present` : `${id}.value !== undefined || ${id}_present`;
				doc.write(`
        const ${id}_present = ${isPresent};
        if (!${id}.issues.length || ${id}_present) {
          if (${id}.issues.length) {${prefixStr(id, k)}
          }

          if (${assign}) {
            newResult[${k}] = ${id}.value;
          }
        }

      `);
			} else if (!isOptionalIn) doc.write(`
        const ${id}_present = ${isPresent};
        if (${id}.issues.length) {${prefixStr(id, k)}
        }
        if (!${id}_present && !${id}.issues.length) {
          payload.issues.push({
            code: "invalid_type",
            expected: "nonoptional",
            input: undefined,
            path: [${k}]
          });
          if (ctx && ctx.abortEarly) {
            payload.value = newResult;
            return payload;
          }
        }

        if (${id}_present) {
          newResult[${k}] = ${id}.value;
        }

      `);
			else {
				doc.write(`
        if (${id}.issues.length) {${prefixStr(id, k)}
        }
      `);
				if (optin === "defaulted") doc.write(`newResult[${k}] = ${id}.value;`);
				else doc.write(`
        if (${id}.value !== undefined || ${isPresent}) {
          newResult[${k}] = ${id}.value;
        }
      `);
			}
		}
		doc.write(`payload.value = newResult;`);
		doc.write(`return payload;`);
		return doc.compile();
	};
	let fastpass;
	const isObject$2 = isObject;
	const jit = !globalConfig.jitless;
	const allowsEval$1 = allowsEval;
	const fastEnabled = jit && allowsEval$1.value;
	const catchall = def.catchall;
	let value;
	inst._zod.parse = (payload, ctx) => {
		value ?? (value = _normalized.value);
		const input = payload.value;
		if (!isObject$2(input)) {
			payload.issues.push({
				expected: "object",
				code: "invalid_type",
				input,
				inst
			});
			return payload;
		}
		if (jit && fastEnabled && ctx?.async === false && ctx.jitless !== true) {
			if (!fastpass) fastpass = generateFastpass(def.shape);
			payload = fastpass(payload, ctx);
			if (!catchall) return payload;
			return handleCatchall([], input, payload, ctx, value, inst, ctx?.abortEarly === true);
		}
		return superParse(payload, ctx);
	};
});
function handleUnionResults(results, final, inst, ctx) {
	for (const result of results) if (result.issues.length === 0) {
		final.value = result.value;
		return final;
	}
	const nonaborted = results.filter((r) => !aborted(r));
	if (nonaborted.length === 1) {
		final.value = nonaborted[0].value;
		return nonaborted[0];
	}
	final.issues.push({
		code: "invalid_union",
		input: final.value,
		inst,
		errors: results.map((result) => result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
	});
	return final;
}
const $ZodUnion = /*@__PURE__*/ $constructor("$ZodUnion", (inst, def) => {
	$ZodType.init(inst, def);
	defineLazyInternal(inst, "optin", (zod) => zod.def.options.some((o) => o._zod.optin === "defaulted") ? "defaulted" : zod.def.options.some((o) => o._zod.optin !== void 0) ? "optional" : void 0);
	defineLazyInternal(inst, "optout", (zod) => zod.def.options.some((o) => o._zod.optout === "optional") ? "optional" : void 0);
	defineLazyInternal(inst, "values", (zod) => {
		if (zod.def.options.every((o) => o._zod.values)) return new Set(zod.def.options.flatMap((option) => Array.from(option._zod.values)));
	});
	defineLazyInternal(inst, "pattern", (zod) => {
		if (zod.def.options.every((o) => o._zod.pattern)) {
			const patterns = zod.def.options.map((o) => o._zod.pattern);
			return new RegExp(`^(${patterns.map((p) => cleanRegex(p.source)).join("|")})$`);
		}
	});
	const first = def.options.length === 1 ? def.options[0]._zod.run : null;
	inst._zod.parse = (payload, ctx) => {
		if (first) return first(payload, ctx);
		let async = false;
		const results = [];
		for (const option of def.options) {
			const result = option._zod.run({
				value: payload.value,
				issues: []
			}, ctx);
			if (result instanceof Promise) {
				results.push(result);
				async = true;
			} else {
				if (result.issues.length === 0) return result;
				results.push(result);
			}
		}
		if (!async) return handleUnionResults(results, payload, inst, ctx);
		return Promise.all(results).then((results) => {
			return handleUnionResults(results, payload, inst, ctx);
		});
	};
});
const $ZodIntersection = /*@__PURE__*/ $constructor("$ZodIntersection", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.parse = (payload, ctx) => {
		const input = payload.value;
		const left = def.left._zod.run({
			value: input,
			issues: []
		}, ctx);
		const right = def.right._zod.run({
			value: input,
			issues: []
		}, ctx);
		if (left instanceof Promise || right instanceof Promise) return Promise.all([left, right]).then(([left, right]) => {
			return handleIntersectionResults(payload, left, right);
		});
		return handleIntersectionResults(payload, left, right);
	};
});
function mergeValues(a, b) {
	if (a === b) return {
		valid: true,
		data: a
	};
	if (a instanceof Date && b instanceof Date && +a === +b) return {
		valid: true,
		data: a
	};
	if (isPlainObject(a) && isPlainObject(b)) {
		const bKeys = Object.keys(b);
		const sharedKeys = Object.keys(a).filter((key) => bKeys.indexOf(key) !== -1);
		const newObj = {
			...a,
			...b
		};
		if (Object.prototype.hasOwnProperty.call(newObj, "__proto__")) delete newObj.__proto__;
		for (const key of sharedKeys) {
			if (key === "__proto__") continue;
			const sharedValue = mergeValues(a[key], b[key]);
			if (!sharedValue.valid) return {
				valid: false,
				mergeErrorPath: [key, ...sharedValue.mergeErrorPath]
			};
			newObj[key] = sharedValue.data;
		}
		return {
			valid: true,
			data: newObj
		};
	}
	if (Array.isArray(a) && Array.isArray(b)) {
		if (a.length !== b.length) return {
			valid: false,
			mergeErrorPath: []
		};
		const newArray = [];
		for (let index = 0; index < a.length; index++) {
			const itemA = a[index];
			const itemB = b[index];
			const sharedValue = mergeValues(itemA, itemB);
			if (!sharedValue.valid) return {
				valid: false,
				mergeErrorPath: [index, ...sharedValue.mergeErrorPath]
			};
			newArray.push(sharedValue.data);
		}
		return {
			valid: true,
			data: newArray
		};
	}
	return {
		valid: false,
		mergeErrorPath: []
	};
}
function handleIntersectionResults(result, left, right) {
	const unrecKeys = /* @__PURE__ */ new Map();
	let unrecIssue;
	const keyIssues = /* @__PURE__ */ new Map();
	const collect = (iss, side) => {
		let keys;
		if (iss.code === "unrecognized_keys" && !iss.path?.length) {
			unrecIssue ?? (unrecIssue = iss);
			keys = iss.keys;
		} else if (iss.code === "invalid_key" && iss.origin === "record" && iss.path?.length === 1) {
			const k = String(iss.path[0]);
			if (!keyIssues.has(k)) keyIssues.set(k, iss);
			keys = [k];
		} else return false;
		for (const k of keys) {
			if (!unrecKeys.has(k)) unrecKeys.set(k, {});
			unrecKeys.get(k)[side] = true;
		}
		return true;
	};
	for (const iss of left.issues) if (!collect(iss, "l")) result.issues.push(iss);
	for (const iss of right.issues) if (!collect(iss, "r")) result.issues.push(iss);
	const bothKeys = [...unrecKeys].filter(([, f]) => f.l && f.r).map(([k]) => k);
	if (bothKeys.length) {
		const aggregated = unrecIssue ? bothKeys.filter((k) => unrecIssue.keys.includes(k)) : [];
		if (aggregated.length) result.issues.push({
			...unrecIssue,
			keys: aggregated
		});
		for (const k of bothKeys) if (!aggregated.includes(k) && keyIssues.has(k)) result.issues.push(keyIssues.get(k));
	}
	const merged = mergeValues(left.value, right.value);
	if (!merged.valid) {
		if (aborted(result)) return result;
		throw new Error(`Unmergable intersection. Error path: ${JSON.stringify(merged.mergeErrorPath)}`);
	}
	result.value = merged.data;
	return result;
}
const $ZodTuple = /*@__PURE__*/ $constructor("$ZodTuple", (inst, def) => {
	$ZodType.init(inst, def);
	const items = def.items;
	const memo = globalConfig.memoizer;
	memo?.attach(inst);
	inst._zod.parse = (payload, ctx) => {
		const input = payload.value;
		if (!Array.isArray(input)) {
			payload.issues.push({
				input,
				inst,
				expected: "tuple",
				code: "invalid_type"
			});
			return payload;
		}
		payload.value = memo ? memo.alloc(inst, payload, [], ctx) : [];
		const proms = [];
		const optinStart = getTupleOptStart(items, "optin");
		const optoutStart = getTupleOptStart(items, "optout");
		if (!def.rest) {
			if (input.length < optinStart) {
				payload.issues.push({
					code: "too_small",
					minimum: optinStart,
					inclusive: true,
					input,
					inst,
					origin: "array"
				});
				return payload;
			}
			if (input.length > items.length) payload.issues.push({
				code: "too_big",
				maximum: items.length,
				inclusive: true,
				input,
				inst,
				origin: "array"
			});
		}
		const itemResults = new Array(items.length);
		const abortEarly = def.rest ? ctx?.abortEarly : void 0;
		let itemAborted = false;
		for (let i = 0; i < items.length; i++) {
			const r = items[i]._zod.run({
				value: input[i],
				issues: []
			}, ctx);
			if (r instanceof Promise) proms.push(r.then((rr) => {
				itemResults[i] = rr;
			}));
			else {
				itemResults[i] = r;
				if (abortEarly && !itemAborted && r.issues.length) itemAborted = aborted(r);
			}
		}
		if (def.rest && !itemAborted) {
			let i = items.length - 1;
			const rest = input.slice(items.length);
			let seen = payload.issues.length;
			for (const el of rest) {
				if (abortEarly && payload.issues.length !== seen) {
					if (aborted(payload, seen)) break;
					seen = payload.issues.length;
				}
				i++;
				const result = def.rest._zod.run({
					value: el,
					issues: []
				}, ctx);
				if (result instanceof Promise) proms.push(result.then((r) => handleTupleResult(r, payload, i)));
				else handleTupleResult(result, payload, i);
			}
		}
		if (proms.length) return Promise.all(proms).then(() => handleTupleResults(itemResults, payload, items, input, optoutStart));
		return handleTupleResults(itemResults, payload, items, input, optoutStart);
	};
});
function getTupleOptStart(items, key) {
	for (let i = items.length - 1; i >= 0; i--) if (!(key === "optin" ? items[i]._zod.optin !== void 0 : items[i]._zod.optout === "optional")) return i + 1;
	return 0;
}
function handleTupleResult(result, final, index) {
	if (result.issues.length) final.issues.push(...prefixIssues(index, result.issues));
	final.value[index] = result.value;
}
function handleTupleResults(itemResults, final, items, input, optoutStart) {
	for (let i = 0; i < items.length; i++) {
		const r = itemResults[i];
		const isPresent = i < input.length;
		if (!isPresent && i >= optoutStart && items[i]._zod.optin === "optional") {
			final.value.length = i;
			break;
		}
		if (r.issues.length) {
			if (!isPresent && i >= optoutStart) {
				final.value.length = i;
				break;
			}
			final.issues.push(...prefixIssues(i, r.issues));
		}
		final.value[i] = r.value;
	}
	for (let i = final.value.length - 1; i >= input.length; i--) if (items[i]._zod.optout === "optional" && final.value[i] === void 0) final.value.length = i;
	else break;
	return final;
}
const $ZodEnum = /*@__PURE__*/ $constructor("$ZodEnum", (inst, def) => {
	$ZodType.init(inst, def);
	const values = getEnumValues(def.entries);
	const valuesSet = new Set(values);
	inst._zod.values = valuesSet;
	defineLazyInternal(inst, "pattern", (zod) => {
		const patternValues = getEnumValues(zod.def.entries).filter((k) => propertyKeyTypes.has(typeof k));
		return new RegExp(patternValues.length ? `^(${patternValues.map((o) => escapeRegex(o.toString())).join("|")})$` : "^[^\\s\\S]$");
	});
	inst._zod.parse = (payload, _ctx) => {
		const input = payload.value;
		if (valuesSet.has(input)) return payload;
		payload.issues.push({
			code: "invalid_value",
			values,
			input,
			inst
		});
		return payload;
	};
});
const $ZodLiteral = /*@__PURE__*/ $constructor("$ZodLiteral", (inst, def) => {
	$ZodType.init(inst, def);
	const values = new Set(def.values);
	inst._zod.values = values;
	defineLazyInternal(inst, "pattern", (zod) => {
		const vals = zod.def.values;
		return new RegExp(vals.length ? `^(${vals.map((o) => typeof o === "string" ? escapeRegex(o) : o ? escapeRegex(o.toString()) : String(o)).join("|")})$` : "^[^\\s\\S]$");
	});
	inst._zod.parse = (payload, _ctx) => {
		const input = payload.value;
		if (values.has(input)) return payload;
		payload.issues.push({
			code: "invalid_value",
			values: def.values,
			input,
			inst
		});
		return payload;
	};
});
const $ZodTransform = /*@__PURE__*/ $constructor("$ZodTransform", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.optin = "optional";
	globalConfig.memoizer?.guard(inst);
	inst._zod.parse = (payload, ctx) => {
		if (ctx.direction === "backward") throw new $ZodEncodeError(inst.constructor.name);
		const _out = def.transform(payload.value, payload);
		if (ctx.async) return (_out instanceof Promise ? _out : Promise.resolve(_out)).then((output) => {
			payload.value = output;
			return payload;
		});
		if (_out instanceof Promise) throw new $ZodAsyncError();
		payload.value = _out;
		return payload;
	};
});
function handleOptionalResult(payload, result) {
	payload.value = result.issues.length ? void 0 : result.value;
	return payload;
}
const $ZodOptional = /*@__PURE__*/ $constructor("$ZodOptional", (inst, def) => {
	$ZodType.init(inst, def);
	defineLazyInternal(inst, "optin", (zod) => zod.def.innerType._zod.optin === "defaulted" ? "defaulted" : "optional");
	inst._zod.optout = "optional";
	defineLazyInternal(inst, "values", (zod) => {
		const values = zod.def.innerType._zod.values;
		return values ? /* @__PURE__ */ new Set([...values, void 0]) : void 0;
	});
	defineLazyInternal(inst, "pattern", (zod) => {
		const pattern = zod.def.innerType._zod.pattern;
		return pattern ? new RegExp(`^(${cleanRegex(pattern.source)})?$`) : void 0;
	});
	inst._zod.parse = (payload, ctx) => {
		if (payload.value === void 0) {
			if (def.innerType._zod.optin !== "defaulted") return payload;
			const result = def.innerType._zod.run({
				value: payload.value,
				issues: []
			}, ctx);
			if (result instanceof Promise) return result.then((result) => handleOptionalResult(payload, result));
			return handleOptionalResult(payload, result);
		}
		return def.innerType._zod.run(payload, ctx);
	};
});
const $ZodExactOptional = /*@__PURE__*/ $constructor("$ZodExactOptional", (inst, def) => {
	$ZodOptional.init(inst, def);
	defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
	defineLazyInternal(inst, "pattern", (zod) => zod.def.innerType._zod.pattern);
	inst._zod.parse = (payload, ctx) => {
		return def.innerType._zod.run(payload, ctx);
	};
});
const $ZodNullable = /*@__PURE__*/ $constructor("$ZodNullable", (inst, def) => {
	$ZodType.init(inst, def);
	defineLazyInternal(inst, "optin", (zod) => zod.def.innerType._zod.optin);
	defineLazyInternal(inst, "optout", (zod) => zod.def.innerType._zod.optout);
	defineLazyInternal(inst, "pattern", (zod) => {
		const pattern = zod.def.innerType._zod.pattern;
		return pattern ? new RegExp(`^(${cleanRegex(pattern.source)}|null)$`) : void 0;
	});
	defineLazyInternal(inst, "values", (zod) => {
		return zod.def.innerType._zod.values ? /* @__PURE__ */ new Set([...zod.def.innerType._zod.values, null]) : void 0;
	});
	inst._zod.parse = (payload, ctx) => {
		if (payload.value === null) return payload;
		return def.innerType._zod.run(payload, ctx);
	};
});
const $ZodDefault = /*@__PURE__*/ $constructor("$ZodDefault", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.optin = "defaulted";
	defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
	inst._zod.parse = (payload, ctx) => {
		if (ctx.direction === "backward") return def.innerType._zod.run(payload, ctx);
		if (payload.value === void 0) {
			payload.value = def.defaultValue;
			/**
			* $ZodDefault returns the default value immediately in forward direction.
			* It doesn't pass the default value into the validator ("prefault"). There's no reason to pass the default value through validation. The validity of the default is enforced by TypeScript statically. Otherwise, it's the responsibility of the user to ensure the default is valid. In the case of pipes with divergent in/out types, you can specify the default on the `in` schema of your ZodPipe to set a "prefault" for the pipe.   */
			return payload;
		}
		const result = def.innerType._zod.run(payload, ctx);
		if (result instanceof Promise) return result.then((result) => handleDefaultResult(result, def));
		return handleDefaultResult(result, def);
	};
});
function handleDefaultResult(payload, def) {
	if (payload.value === void 0) payload.value = def.defaultValue;
	return payload;
}
const $ZodPrefault = /*@__PURE__*/ $constructor("$ZodPrefault", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.optin = "defaulted";
	defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
	inst._zod.parse = (payload, ctx) => {
		if (ctx.direction === "backward") return def.innerType._zod.run(payload, ctx);
		if (payload.value === void 0) payload.value = def.defaultValue;
		return def.innerType._zod.run(payload, ctx);
	};
});
const $ZodNonOptional = /*@__PURE__*/ $constructor("$ZodNonOptional", (inst, def) => {
	$ZodType.init(inst, def);
	defineLazyInternal(inst, "values", (zod) => {
		const v = zod.def.innerType._zod.values;
		return v ? new Set([...v].filter((x) => x !== void 0)) : void 0;
	});
	inst._zod.parse = (payload, ctx) => {
		const result = def.innerType._zod.run(payload, ctx);
		if (result instanceof Promise) return result.then((result) => handleNonOptionalResult(result, inst));
		return handleNonOptionalResult(result, inst);
	};
});
function handleNonOptionalResult(payload, inst) {
	if (!payload.issues.length && payload.value === void 0) payload.issues.push({
		code: "invalid_type",
		expected: "nonoptional",
		input: payload.value,
		inst
	});
	return payload;
}
function handleCatchResult(payload, result, def, ctx) {
	if (!result.issues.length) {
		payload.value = result.value;
		if (result.memo) payload.memo = true;
		return payload;
	}
	payload.value = def.catchValue({
		...result,
		value: payload.value,
		error: { issues: result.issues.map((iss) => finalizeIssue(iss, ctx, config())) },
		input: payload.value
	});
	return payload;
}
const $ZodCatch = /*@__PURE__*/ $constructor("$ZodCatch", (inst, def) => {
	$ZodType.init(inst, def);
	defineLazyInternal(inst, "optin", (zod) => zod.def.innerType._zod.optin === "defaulted" ? "defaulted" : "optional");
	defineLazyInternal(inst, "optout", (zod) => zod.def.innerType._zod.optout);
	defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
	inst._zod.parse = (payload, ctx) => {
		if (ctx.direction === "backward") return def.innerType._zod.run(payload, ctx);
		const result = def.innerType._zod.run({
			value: payload.value,
			issues: []
		}, ctx);
		if (result instanceof Promise) return result.then((result) => handleCatchResult(payload, result, def, ctx));
		return handleCatchResult(payload, result, def, ctx);
	};
});
const $ZodPipe = /*@__PURE__*/ $constructor("$ZodPipe", (inst, def) => {
	$ZodType.init(inst, def);
	defineLazyInternal(inst, "values", (zod) => zod.def.in._zod.values);
	defineLazyInternal(inst, "optin", (zod) => zod.def.in._zod.optin);
	defineLazyInternal(inst, "optout", (zod) => zod.def.out._zod.optout);
	defineLazyInternal(inst, "propValues", (zod) => zod.def.in._zod.propValues);
	inst._zod.parse = (payload, ctx) => {
		if (ctx.direction === "backward") {
			const right = def.out._zod.run(payload, ctx);
			if (right instanceof Promise) return right.then((right) => handlePipeResult(right, def.in, ctx));
			return handlePipeResult(right, def.in, ctx);
		}
		const left = def.in._zod.run(payload, ctx);
		if (left instanceof Promise) return left.then((left) => handlePipeResult(left, def.out, ctx));
		return handlePipeResult(left, def.out, ctx);
	};
});
function handlePipeResult(left, next, ctx) {
	if (left.issues.some((iss) => iss.code !== "unrecognized_keys")) {
		left.aborted = true;
		return left;
	}
	return next._zod.run({
		value: left.value,
		issues: left.issues
	}, ctx);
}
const $ZodReadonly = /*@__PURE__*/ $constructor("$ZodReadonly", (inst, def) => {
	$ZodType.init(inst, def);
	defineLazyInternal(inst, "propValues", (zod) => zod.def.innerType._zod.propValues);
	defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
	defineLazyInternal(inst, "optin", (zod) => zod.def.innerType?._zod?.optin);
	defineLazyInternal(inst, "optout", (zod) => zod.def.innerType?._zod?.optout);
	inst._zod.parse = (payload, ctx) => {
		if (ctx.direction === "backward") return def.innerType._zod.run(payload, ctx);
		const result = def.innerType._zod.run(payload, ctx);
		if (result instanceof Promise) return result.then(handleReadonlyResult);
		return handleReadonlyResult(result);
	};
});
function handleReadonlyResult(payload) {
	if (!payload.memo) payload.value = Object.freeze(payload.value);
	return payload;
}
const $ZodCustom = /*@__PURE__*/ $constructor("$ZodCustom", (inst, def) => {
	$ZodCheck.init(inst, def);
	$ZodType.init(inst, def);
	inst._zod.parse = (payload, _) => {
		return payload;
	};
	inst._zod.check = (payload) => {
		const input = payload.value;
		const r = def.fn(input);
		if (r instanceof Promise) return r.then((r) => handleRefineResult(r, payload, input, inst));
		handleRefineResult(r, payload, input, inst);
	};
});
function handleRefineResult(result, payload, input, inst) {
	if (!result) {
		const _iss = {
			code: "custom",
			input,
			inst,
			path: [...inst._zod.def.path ?? []],
			continue: !inst._zod.def.abort
		};
		if (inst._zod.def.params) _iss.params = inst._zod.def.params;
		payload.issues.push(issue(_iss));
	}
}

// node_modules/zod/v4/core/memoizer.js
var $ZodCyclicError = class extends Error {
	constructor() {
		super(`Cannot parse a reference cycle that closes through a transform`);
		this.name = "ZodCyclicError";
	}
};
/** Keyed off the context object every schema in one parse call already shares. */
const STATE = "~memo";
const NO_ISSUES = [];
function isRef(value) {
	return value !== null && typeof value === "object";
}
function cloneIssues(issues) {
	return issues.map((iss) => iss.path ? {
		...iss,
		path: iss.path.slice()
	} : { ...iss });
}
const recursive = /*@__PURE__*/ new WeakMap();
/** What the walk established, in order of certainty: ordered so the strongest answer among children wins. */
const NONE = 0;
const ASSUMED = 1;
const PROVEN = 2;
/** Whether this schema's subtree contains a cycle, so one parse can re-enter it. */
function isRecursive(inst, stack, resolve) {
	const cached = recursive.get(inst);
	if (cached !== void 0) return cached ? PROVEN : NONE;
	if (stack.has(inst)) return PROVEN;
	stack.add(inst);
	let result = NONE;
	const check = (child) => {
		if (result !== PROVEN && child?._zod) {
			const answer = isRecursive(child, stack, resolve);
			if (answer > result) result = answer;
		}
	};
	const shape = (sh, spread) => {
		let answer = NONE;
		for (const key of Reflect.ownKeys(sh)) {
			const desc = Object.getOwnPropertyDescriptor(sh, key);
			if (spread && !desc.enumerable) continue;
			const child = desc.get ? ASSUMED : desc.value?._zod ? isRecursive(desc.value, stack, resolve) : NONE;
			if (child > answer) answer = child;
		}
		return answer;
	};
	const merge = (answer) => {
		if (answer > result) result = answer;
	};
	const def = inst._zod.def;
	switch (def.type) {
		case "object": {
			const raw = rawShape(def);
			merge(raw ? shape(raw, true) : ASSUMED);
			check(def.catchall);
			break;
		}
		case "array":
			check(def.element);
			break;
		case "tuple":
			for (const el of def.items) check(el);
			check(def.rest);
			break;
		case "record":
		case "map":
			check(def.keyType);
			check(def.valueType);
			break;
		case "set":
			check(def.valueType);
			break;
		case "union":
			for (const el of def.options) check(el);
			break;
		case "intersection":
			check(def.left);
			check(def.right);
			break;
		case "optional":
		case "nullable":
		case "default":
		case "prefault":
		case "catch":
		case "readonly":
		case "nonoptional":
		case "promise":
		case "success":
			check(def.innerType);
			break;
		case "pipe":
			check(def.in);
			check(def.out);
			break;
		case "function":
			check(def.input);
			check(def.output);
			break;
		case "lazy": {
			const inner = def._cachedInner ?? (resolve ? inst._zod.innerType : void 0);
			merge(inner ? isRecursive(inner, stack, false) : ASSUMED);
			break;
		}
		case "template_literal":
		case "string":
		case "number":
		case "int":
		case "boolean":
		case "bigint":
		case "symbol":
		case "undefined":
		case "null":
		case "void":
		case "never":
		case "any":
		case "unknown":
		case "date":
		case "nan":
		case "enum":
		case "literal":
		case "file":
		case "transform":
		case "custom": break;
		default: for (const key in def) {
			const desc = Object.getOwnPropertyDescriptor(def, key);
			if (!desc || desc.get) continue;
			const value = desc.value;
			if (!value || typeof value !== "object") continue;
			if (value._zod) check(value);
			else if (Array.isArray(value)) for (const el of value) check(el);
		}
	}
	stack.delete(inst);
	return settle(inst, result);
}
/** An assumed answer must not outlive the resolution that settles it, so only a certain one is cached. */
function settle(inst, answer) {
	if (answer !== ASSUMED) recursive.set(inst, answer === PROVEN);
	return answer;
}
function bucketFor(state, inst) {
	let bucket = state.buckets.get(inst);
	if (!bucket) {
		bucket = /* @__PURE__ */ new WeakMap();
		state.buckets.set(inst, bucket);
	}
	return bucket;
}
let handoff;
const open = [];
const memo = {
	alloc(_inst, payload, empty) {
		const bucket = handoff;
		if (!bucket) return empty;
		handoff = void 0;
		const entry = {
			value: empty,
			issues: null
		};
		bucket.set(payload.value, entry);
		open.push(entry);
		return empty;
	},
	guard(inst) {
		var _a;
		(_a = inst._zod).deferred ?? (_a.deferred = []);
		inst._zod.deferred.push(() => {
			const base = inst._zod.parse;
			const wrapped = (payload, ctx) => {
				if (ctx.direction !== "backward" && isBackEdge(ctx, payload.value)) throw new $ZodCyclicError();
				return base(payload, ctx);
			};
			inst._zod.parse = wrapped;
			if (inst._zod.run === base) inst._zod.run = wrapped;
		});
	},
	attach(inst) {
		var _a;
		let isRecursiveInst;
		let rechecked = false;
		let lastCtx;
		let lastBucket;
		(_a = inst._zod).deferred ?? (_a.deferred = []);
		inst._zod.deferred.push(() => {
			const base = inst._zod.parse;
			const wrapped = (payload, ctx) => {
				if (isRecursiveInst === void 0) {
					const walked = isRecursive(inst, /* @__PURE__ */ new Set(), false);
					if (walked === NONE) {
						inst._zod.parse = base;
						if (inst._zod.run === wrapped) inst._zod.run = base;
						return base(payload, ctx);
					}
					if (walked === PROVEN || rechecked) isRecursiveInst = true;
					else rechecked = true;
				}
				const input = payload.value;
				if (!isRef(input)) return base(payload, ctx);
				let state = ctx[STATE];
				if (!state) {
					state = {
						buckets: /* @__PURE__ */ new WeakMap(),
						backEdges: void 0
					};
					ctx[STATE] = state;
				}
				let bucket;
				if (lastCtx === ctx) bucket = lastBucket;
				else {
					bucket = bucketFor(state, inst);
					lastCtx = ctx;
					lastBucket = bucket;
				}
				const hit = bucket.get(input);
				if (hit) {
					payload.value = hit.value;
					if (hit.issues) {
						if (hit.issues.length) payload.issues.push(...cloneIssues(hit.issues));
					} else {
						payload.memo = true;
						state.backEdges ?? (state.backEdges = /* @__PURE__ */ new WeakSet());
						state.backEdges.add(hit.value);
					}
					return payload;
				}
				handoff = bucket;
				const depth = open.length;
				const result = base(payload, ctx);
				handoff = void 0;
				const entry = open.length > depth ? open.pop() : void 0;
				if (result instanceof Promise) return result.then((r) => {
					if (entry) entry.issues = r.issues.length ? cloneIssues(r.issues) : NO_ISSUES;
					return r;
				});
				if (entry) entry.issues = result.issues.length ? cloneIssues(result.issues) : NO_ISSUES;
				return result;
			};
			inst._zod.parse = wrapped;
			if (inst._zod.run === base) inst._zod.run = wrapped;
		});
	}
};
/** The memoizer that gives containers cycle support. `zod` installs it by default; `zod/mini` opts in with `config({ memoizer: memoizer() })`. */
function memoizer() {
	return memo;
}
/** Whether this value is a node a back-edge resolved to before it finished. */
function isBackEdge(ctx, value) {
	const backEdges = ctx[STATE]?.backEdges;
	return backEdges !== void 0 && isRef(value) && backEdges.has(value);
}

// node_modules/zod/v4/locales/en.js
const error = () => {
	const Sizable = {
		string: {
			unit: "characters",
			verb: "to have"
		},
		file: {
			unit: "bytes",
			verb: "to have"
		},
		array: {
			unit: "items",
			verb: "to have"
		},
		set: {
			unit: "items",
			verb: "to have"
		},
		map: {
			unit: "entries",
			verb: "to have"
		}
	};
	function getSizing(origin) {
		return Sizable[origin] ?? null;
	}
	const FormatDictionary = {
		regex: "input",
		email: "email address",
		url: "URL",
		emoji: "emoji",
		uuid: "UUID",
		uuidv4: "UUIDv4",
		uuidv6: "UUIDv6",
		nanoid: "nanoid",
		guid: "GUID",
		cuid: "cuid",
		cuid2: "cuid2",
		ulid: "ULID",
		xid: "XID",
		ksuid: "KSUID",
		datetime: "ISO datetime",
		date: "ISO date",
		time: "ISO time",
		duration: "ISO duration",
		ipv4: "IPv4 address",
		ipv6: "IPv6 address",
		mac: "MAC address",
		cidrv4: "IPv4 range",
		cidrv6: "IPv6 range",
		base64: "base64-encoded string",
		base64url: "base64url-encoded string",
		json_string: "JSON string",
		e164: "E.164 number",
		currency_code: "currency code",
		credit_card: "credit card number",
		iban: "IBAN",
		jwt: "JWT",
		template_literal: "input"
	};
	const TypeDictionary = { nan: "NaN" };
	function getTypeName(type, input) {
		if (type === "number" && typeof input === "number" && !Number.isFinite(input)) return String(input);
		return TypeDictionary[type] ?? type;
	}
	return (issue) => {
		switch (issue.code) {
			case "invalid_type": return `Invalid input: expected ${getTypeName(issue.expected)}, received ${getTypeName(parsedType(issue.input), issue.input)}`;
			case "invalid_value":
				if (issue.values.length === 1) return `Invalid input: expected ${stringifyPrimitive(issue.values[0])}`;
				return `Invalid option: expected one of ${joinValues(issue.values, "|")}`;
			case "too_big": {
				const adj = issue.exact ? "exactly " : issue.inclusive ? "<=" : "<";
				const sizing = getSizing(issue.origin);
				if (sizing) return `Too big: expected ${issue.origin ?? "value"} to have ${adj}${issue.maximum.toString()} ${sizing.unit ?? "elements"}`;
				return `Too big: expected ${issue.origin ?? "value"} to be ${adj}${issue.maximum.toString()}`;
			}
			case "too_small": {
				const adj = issue.exact ? "exactly " : issue.inclusive ? ">=" : ">";
				const sizing = getSizing(issue.origin);
				if (sizing) return `Too small: expected ${issue.origin} to have ${adj}${issue.minimum.toString()} ${sizing.unit}`;
				return `Too small: expected ${issue.origin} to be ${adj}${issue.minimum.toString()}`;
			}
			case "invalid_format": {
				const _issue = issue;
				if (_issue.format === "starts_with") return `Invalid string: must start with "${_issue.prefix}"`;
				if (_issue.format === "ends_with") return `Invalid string: must end with "${_issue.suffix}"`;
				if (_issue.format === "includes") return `Invalid string: must include "${_issue.includes}"`;
				if (_issue.format === "regex") return `Invalid string: must match pattern ${_issue.pattern}`;
				return `Invalid ${FormatDictionary[_issue.format] ?? issue.format}`;
			}
			case "not_multiple_of": return `Invalid number: must be a multiple of ${issue.divisor}`;
			case "unrecognized_keys": return `Unrecognized key${issue.keys.length > 1 ? "s" : ""}: ${joinValues(issue.keys, ", ")}`;
			case "invalid_key": return `Invalid key in ${issue.origin}`;
			case "invalid_union":
				if (issue.options && Array.isArray(issue.options) && issue.options.length > 0) return `Invalid discriminator value. Expected ${issue.options.map((o) => `'${o}'`).join(" | ")}`;
				if (issue.inclusive === false) return "Invalid input: more than one option matched";
				return "Invalid input";
			case "invalid_element": return `Invalid value in ${issue.origin}`;
			default: return `Invalid input`;
		}
	};
};
function en_default() {
	return { localeError: error() };
}

// node_modules/zod/v4/core/registries.js
var _a;
var $ZodRegistry = class {
	constructor() {
		this._map = /* @__PURE__ */ new WeakMap();
		this._idmap = /* @__PURE__ */ new Map();
	}
	add(schema, ..._meta) {
		const meta = _meta[0];
		this._map.set(schema, meta);
		if (meta && typeof meta === "object" && "id" in meta) this._idmap.set(meta.id, schema);
		return this;
	}
	clear() {
		this._map = /* @__PURE__ */ new WeakMap();
		this._idmap = /* @__PURE__ */ new Map();
		return this;
	}
	remove(schema) {
		const meta = this._map.get(schema);
		if (meta && typeof meta === "object" && "id" in meta) this._idmap.delete(meta.id);
		this._map.delete(schema);
		return this;
	}
	get(schema) {
		const p = schema._zod.parent;
		if (p) {
			const pm = { ...this.get(p) ?? {} };
			delete pm.id;
			const f = {
				...pm,
				...this._map.get(schema)
			};
			return Object.keys(f).length ? f : void 0;
		}
		return this._map.get(schema);
	}
	has(schema) {
		return this._map.has(schema);
	}
};
function registry() {
	return new $ZodRegistry();
}
(_a = globalThis).__zod_globalRegistry ?? (_a.__zod_globalRegistry = registry());
const globalRegistry = globalThis.__zod_globalRegistry;

// node_modules/zod/v4/core/api.js
function snapshotChecks(def) {
	if (def.checks) def.checks = [...def.checks];
	return def;
}
// @__NO_SIDE_EFFECTS__
function _string(Class, params) {
	return new Class(snapshotChecks({
		type: "string",
		...normalizeParams(params)
	}));
}
// @__NO_SIDE_EFFECTS__
function _email(Class, params) {
	return new Class({
		type: "string",
		format: "email",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _guid(Class, params) {
	return new Class({
		type: "string",
		format: "guid",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _uuid(Class, params) {
	return new Class({
		type: "string",
		format: "uuid",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _uuidv4(Class, params) {
	return new Class({
		type: "string",
		format: "uuid",
		check: "string_format",
		abort: false,
		version: "v4",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _uuidv6(Class, params) {
	return new Class({
		type: "string",
		format: "uuid",
		check: "string_format",
		abort: false,
		version: "v6",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _uuidv7(Class, params) {
	return new Class({
		type: "string",
		format: "uuid",
		check: "string_format",
		abort: false,
		version: "v7",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _url(Class, params) {
	return new Class({
		type: "string",
		format: "url",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _emoji(Class, params) {
	return new Class({
		type: "string",
		format: "emoji",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _nanoid(Class, params) {
	return new Class({
		type: "string",
		format: "nanoid",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
/**
* @deprecated CUID v1 is deprecated by its authors due to information leakage
* (timestamps embedded in the id). Use {@link _cuid2} instead.
* See https://github.com/paralleldrive/cuid.
*/
// @__NO_SIDE_EFFECTS__
function _cuid(Class, params) {
	return new Class({
		type: "string",
		format: "cuid",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _cuid2(Class, params) {
	return new Class({
		type: "string",
		format: "cuid2",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _ulid(Class, params) {
	return new Class({
		type: "string",
		format: "ulid",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _xid(Class, params) {
	return new Class({
		type: "string",
		format: "xid",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _ksuid(Class, params) {
	return new Class({
		type: "string",
		format: "ksuid",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _ipv4(Class, params) {
	return new Class({
		type: "string",
		format: "ipv4",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _ipv6(Class, params) {
	return new Class({
		type: "string",
		format: "ipv6",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _cidrv4(Class, params) {
	return new Class({
		type: "string",
		format: "cidrv4",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _cidrv6(Class, params) {
	return new Class({
		type: "string",
		format: "cidrv6",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _base64(Class, params) {
	return new Class({
		type: "string",
		format: "base64",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _base64url(Class, params) {
	return new Class({
		type: "string",
		format: "base64url",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _e164(Class, params) {
	return new Class({
		type: "string",
		format: "e164",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _jwt(Class, params) {
	return new Class({
		type: "string",
		format: "jwt",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _isoDateTime(Class, params) {
	return new Class({
		type: "string",
		format: "datetime",
		check: "string_format",
		offset: false,
		local: false,
		precision: null,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _isoDate(Class, params) {
	return new Class({
		type: "string",
		format: "date",
		check: "string_format",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _isoTime(Class, params) {
	return new Class({
		type: "string",
		format: "time",
		check: "string_format",
		precision: null,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _isoDuration(Class, params) {
	return new Class({
		type: "string",
		format: "duration",
		check: "string_format",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _number(Class, params) {
	return new Class(snapshotChecks({
		type: "number",
		checks: [],
		...normalizeParams(params)
	}));
}
// @__NO_SIDE_EFFECTS__
function _int(Class, params) {
	return new Class({
		type: "number",
		check: "number_format",
		abort: false,
		format: "safeint",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _boolean(Class, params) {
	return new Class({
		type: "boolean",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _unknown(Class) {
	return new Class({ type: "unknown" });
}
// @__NO_SIDE_EFFECTS__
function _never(Class, params) {
	return new Class({
		type: "never",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _lt(value, params) {
	return new $ZodCheckLessThan({
		check: "less_than",
		...normalizeParams(params),
		value,
		inclusive: false
	});
}
// @__NO_SIDE_EFFECTS__
function _lte(value, params) {
	return new $ZodCheckLessThan({
		check: "less_than",
		...normalizeParams(params),
		value,
		inclusive: true
	});
}
// @__NO_SIDE_EFFECTS__
function _gt(value, params) {
	return new $ZodCheckGreaterThan({
		check: "greater_than",
		...normalizeParams(params),
		value,
		inclusive: false
	});
}
// @__NO_SIDE_EFFECTS__
function _gte(value, params) {
	return new $ZodCheckGreaterThan({
		check: "greater_than",
		...normalizeParams(params),
		value,
		inclusive: true
	});
}
// @__NO_SIDE_EFFECTS__
function _multipleOf(value, params) {
	return new $ZodCheckMultipleOf({
		check: "multiple_of",
		...normalizeParams(params),
		value
	});
}
// @__NO_SIDE_EFFECTS__
function _maxLength(maximum, params) {
	return new $ZodCheckMaxLength({
		check: "max_length",
		...normalizeParams(params),
		maximum
	});
}
// @__NO_SIDE_EFFECTS__
function _minLength(minimum, params) {
	return new $ZodCheckMinLength({
		check: "min_length",
		...normalizeParams(params),
		minimum
	});
}
// @__NO_SIDE_EFFECTS__
function _length(length, params) {
	return new $ZodCheckLengthEquals({
		check: "length_equals",
		...normalizeParams(params),
		length
	});
}
// @__NO_SIDE_EFFECTS__
function _regex(pattern, params) {
	return new $ZodCheckRegex({
		check: "string_format",
		format: "regex",
		...normalizeParams(params),
		pattern
	});
}
// @__NO_SIDE_EFFECTS__
function _lowercase(params) {
	return new $ZodCheckLowerCase({
		check: "string_format",
		format: "lowercase",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _uppercase(params) {
	return new $ZodCheckUpperCase({
		check: "string_format",
		format: "uppercase",
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _includes(includes, params) {
	return new $ZodCheckIncludes({
		check: "string_format",
		format: "includes",
		...normalizeParams(params),
		includes
	});
}
// @__NO_SIDE_EFFECTS__
function _startsWith(prefix, params) {
	return new $ZodCheckStartsWith({
		check: "string_format",
		format: "starts_with",
		...normalizeParams(params),
		prefix
	});
}
// @__NO_SIDE_EFFECTS__
function _endsWith(suffix, params) {
	return new $ZodCheckEndsWith({
		check: "string_format",
		format: "ends_with",
		...normalizeParams(params),
		suffix
	});
}
// @__NO_SIDE_EFFECTS__
function _overwrite(tx) {
	return new $ZodCheckOverwrite({
		check: "overwrite",
		tx
	});
}
// @__NO_SIDE_EFFECTS__
function _normalize(form) {
	return /* @__PURE__ */ _overwrite((input) => input.normalize(form));
}
// @__NO_SIDE_EFFECTS__
function _trim() {
	return /* @__PURE__ */ _overwrite((input) => input.trim());
}
// @__NO_SIDE_EFFECTS__
function _toLowerCase() {
	return /* @__PURE__ */ _overwrite((input) => input.toLowerCase());
}
// @__NO_SIDE_EFFECTS__
function _toUpperCase() {
	return /* @__PURE__ */ _overwrite((input) => input.toUpperCase());
}
// @__NO_SIDE_EFFECTS__
function _slugify() {
	return /* @__PURE__ */ _overwrite((input) => slugify(input));
}
// @__NO_SIDE_EFFECTS__
function _array(Class, element, params) {
	return new Class({
		type: "array",
		element,
		...normalizeParams(params)
	});
}
// @__NO_SIDE_EFFECTS__
function _refine(Class, fn, _params) {
	return new Class({
		type: "custom",
		check: "custom",
		fn,
		...normalizeParams(_params)
	});
}
// @__NO_SIDE_EFFECTS__
function _superRefine(fn, params) {
	const ch = /* @__PURE__ */ _check((payload) => {
		payload.addIssue = (issue$2) => {
			if (typeof issue$2 === "string") payload.issues.push(issue(issue$2, payload.value, ch._zod.def));
			else {
				const _issue = issue$2;
				if (_issue.fatal) _issue.continue = false;
				_issue.code ?? (_issue.code = "custom");
				if (!("input" in _issue)) _issue.input = payload.value;
				_issue.inst ?? (_issue.inst = ch);
				_issue.continue ?? (_issue.continue = !ch._zod.def.abort);
				payload.issues.push(issue(_issue));
			}
		};
		return fn(payload.value, payload);
	}, params);
	return ch;
}
// @__NO_SIDE_EFFECTS__
function _check(fn, params) {
	const ch = new $ZodCheck({
		check: "custom",
		...normalizeParams(params)
	});
	ch._zod.check = fn;
	return ch;
}

// node_modules/zod/v4/core/to-json-schema.js
function assignProps(target, ...sources) {
	for (const source of sources) for (const key of Reflect.ownKeys(source)) if (Object.prototype.propertyIsEnumerable.call(source, key)) assignProp(target, key, source[key]);
	return target;
}
function initializeContext(params) {
	let target = params?.target ?? "draft-2020-12";
	if (target === "draft-4") target = "draft-04";
	if (target === "draft-7") target = "draft-07";
	return {
		processors: params.processors ?? {},
		metadataRegistry: params?.metadata ?? globalRegistry,
		target,
		unrepresentable: params?.unrepresentable ?? "throw",
		override: params?.override ?? (() => {}),
		io: params?.io ?? "output",
		counter: 0,
		seen: /* @__PURE__ */ new Map(),
		sharedDefsExtractedFor: void 0,
		sharedEmitDoneFor: void 0,
		cycles: params?.cycles ?? "ref",
		reused: params?.reused ?? "inline",
		intersections: [],
		deferred: [],
		external: params?.external ?? void 0
	};
}
/**
* Applies the `unrepresentable` setting at a site that has no JSON Schema equivalent. Throws
* `message` unless the setting (or the handler's return value) says otherwise. Returns `true` if a
* custom JSON Schema was written into `json`, in which case the caller must not write its own.
*/
function handleUnrepresentable(schema, ctx, json, params, message) {
	const result = typeof ctx.unrepresentable === "function" ? ctx.unrepresentable({
		zodSchema: schema,
		path: params.path,
		message
	}) : ctx.unrepresentable;
	if (result === "any") return false;
	if (result === void 0 || result === "throw") throw new Error(message);
	Object.assign(json, result);
	return true;
}
function processSchema(schema, ctx, _params = {
	path: [],
	schemaPath: []
}) {
	var _a;
	const def = schema._zod.def;
	const seen = ctx.seen.get(schema);
	if (seen) {
		seen.count++;
		if (_params.schemaPath.includes(schema)) seen.cycle = _params.path;
		return seen.schema;
	}
	const result = {
		schema: {},
		count: 1,
		cycle: void 0,
		path: _params.path
	};
	ctx.seen.set(schema, result);
	ctx.sharedDefsExtractedFor = void 0;
	ctx.sharedEmitDoneFor = void 0;
	const overrideSchema = schema._zod.toJSONSchema?.();
	if (overrideSchema) result.schema = overrideSchema;
	else {
		const params = {
			..._params,
			schemaPath: [..._params.schemaPath, schema],
			path: _params.path
		};
		if (schema._zod.processJSONSchema) schema._zod.processJSONSchema(ctx, result.schema, params);
		else {
			const _json = result.schema;
			const processor = ctx.processors[def.type];
			if (!processor) throw new Error(`[toJSONSchema]: Non-representable type encountered: ${def.type}`);
			processor(schema, ctx, _json, params);
		}
		const parent = schema._zod.parent;
		if (parent) {
			if (!result.ref) result.ref = parent;
			processSchema(parent, ctx, params);
			ctx.seen.get(parent).isParent = true;
		}
	}
	const meta = ctx.metadataRegistry.get(schema);
	if (meta) assignProps(result.schema, meta);
	if (ctx.io === "input" && isTransforming(schema)) {
		delete result.schema.examples;
		delete result.schema.default;
	}
	if (ctx.io === "input" && "_prefault" in result.schema) (_a = result.schema).default ?? (_a.default = result.schema._prefault);
	delete result.schema._prefault;
	return ctx.seen.get(schema).schema;
}
function encodeJSONPointerSegment(segment) {
	return segment.replace(/~/g, "~0").replace(/\//g, "~1");
}
function extractDefs(ctx, schema) {
	const root = ctx.seen.get(schema);
	if (!root) throw new Error("Unprocessed schema. This is a bug in Zod.");
	if (ctx.external && ctx.sharedDefsExtractedFor === ctx.external) return;
	const idToSchema = /* @__PURE__ */ new Map();
	for (const entry of ctx.seen.entries()) {
		const id = ctx.metadataRegistry.get(entry[0])?.id;
		if (id) {
			const existing = idToSchema.get(id);
			if (existing && existing !== entry[0]) throw new Error(`Duplicate schema id "${id}" detected during JSON Schema conversion. Two different schemas cannot share the same id when converted together.`);
			idToSchema.set(id, entry[0]);
		}
	}
	const makeURI = (entry) => {
		const defsSegment = ctx.target === "draft-2020-12" ? "$defs" : "definitions";
		if (ctx.external) {
			const externalId = ctx.external.registry.get(entry[0])?.id;
			const uriGenerator = ctx.external.uri ?? ((id) => id);
			if (externalId) return { ref: uriGenerator(externalId) };
			const id = entry[1].defId ?? entry[1].schema.id ?? `schema${ctx.counter++}`;
			entry[1].defId = id;
			return {
				defId: id,
				ref: `${uriGenerator("__shared")}#/${defsSegment}/${encodeJSONPointerSegment(id)}`
			};
		}
		const uriPrefix = `#`;
		const defUriPrefix = `${uriPrefix}/${defsSegment}/`;
		if (entry[1] === root && !entry[1].schema.id) return { ref: uriPrefix };
		const defId = entry[1].schema.id ?? `__schema${ctx.counter++}`;
		return {
			defId,
			ref: defUriPrefix + encodeJSONPointerSegment(defId)
		};
	};
	const extractToDef = (entry) => {
		if (entry[1].schema.$ref) return;
		const seen = entry[1];
		const { ref, defId } = makeURI(entry);
		seen.def = { ...seen.schema };
		if (defId) seen.defId = defId;
		const schema = seen.schema;
		for (const key in schema) delete schema[key];
		schema.$ref = ref;
	};
	if (ctx.cycles === "throw") for (const entry of ctx.seen.entries()) {
		const seen = entry[1];
		if (seen.cycle) throw new Error(`Cycle detected: #/${seen.cycle?.join("/")}/<root>

Set the \`cycles\` parameter to \`"ref"\` to resolve cyclical schemas with defs.`);
	}
	for (const entry of ctx.seen.entries()) {
		const seen = entry[1];
		if (schema === entry[0]) {
			extractToDef(entry);
			continue;
		}
		if (ctx.external) {
			const ext = ctx.external.registry.get(entry[0])?.id;
			if (schema !== entry[0] && ext) {
				extractToDef(entry);
				continue;
			}
		}
		if (ctx.metadataRegistry.get(entry[0])?.id) {
			extractToDef(entry);
			continue;
		}
		if (seen.cycle) {
			extractToDef(entry);
			continue;
		}
		if (seen.count > 1) {
			if (ctx.reused === "ref") extractToDef(entry);
		}
	}
	if (ctx.external) ctx.sharedDefsExtractedFor = ctx.external;
}
/** Rewrites `anyOf: [{type: "a"}, {type: "b"}]` to `type: ["a", "b"]`, which every JSON Schema draft treats as equivalent and most consumers render far better for the nullable case. Only branches that are a bare type assertion qualify — anything carrying a constraint, `$ref`, `const` or metadata is left alone. Runs after `flattenRef`, so a branch an override decorated or `$defs` extraction turned into a `$ref` is no longer bare and correctly stays in `anyOf`. `oneOf` is excluded: `integer` and `number` overlap, so "exactly one" and "at least one" are not the same there. OpenAPI 3.0 is excluded: its `type` must be a single string. */
function compactTypeUnion(schema) {
	const options = schema.anyOf;
	if (!Array.isArray(options) || options.length === 0 || schema.type !== void 0) return;
	const types = [];
	for (const option of options) {
		if (!option || typeof option !== "object") return;
		compactTypeUnion(option);
		const keys = Object.keys(option);
		if (keys.length !== 1 || keys[0] !== "type") return;
		const type = option.type;
		for (const member of Array.isArray(type) ? type : [type]) {
			if (typeof member !== "string") return;
			if (!types.includes(member)) types.push(member);
		}
	}
	delete schema.anyOf;
	schema.type = types.length === 1 ? types[0] : types;
}
/** Keywords `foldIntersection` knows how to combine. Anything else — `$ref`, `patternProperties`,
* an annotation like `description` — makes a member unfoldable, so a constraint this does not
* understand leaves the `allOf` alone instead of being silently dropped or misattributed. */
const FOLDABLE_KEYS = /* @__PURE__ */ new Set([
	"type",
	"properties",
	"required",
	"additionalProperties"
]);
const UNION_KEYS = ["oneOf", "anyOf"];
/** A member's constraint on a key it does not declare itself. A `catchall` states one; `false`, an absent `additionalProperties`, and the empty schema a loose object emits state nothing. */
function undeclaredConstraint(member) {
	const extra = member.additionalProperties;
	if (extra === void 0 || extra === false || typeof extra !== "object" || extra === null) return null;
	return Object.keys(extra).length ? extra : null;
}
/** Combines object members into the single object they describe together, or returns `null` if any of them carries a keyword outside {@link FOLDABLE_KEYS}. */
function foldObjects(members) {
	const objects = [];
	for (const member of members) {
		if (typeof member !== "object" || member.type !== "object") return null;
		for (const key in member) if (!FOLDABLE_KEYS.has(key)) return null;
		objects.push(member);
	}
	const properties = {};
	const required = /* @__PURE__ */ new Set();
	for (const object of objects) {
		for (const key in object.properties) {
			if (Object.prototype.hasOwnProperty.call(properties, key)) continue;
			const parts = [];
			for (const other of objects) {
				const part = other.properties?.[key] ?? undeclaredConstraint(other);
				if (part === null || part === void 0) continue;
				if (!parts.some((seen) => JSON.stringify(seen) === JSON.stringify(part))) parts.push(part);
			}
			const merged = parts.length === 1 ? parts[0] : foldObjects(parts) ?? { allOf: parts };
			assignProp(properties, key, merged);
		}
		for (const key of object.required ?? []) required.add(key);
	}
	const folded = {
		type: "object",
		properties
	};
	if (required.size) folded.required = [...required];
	if (objects.every((object) => object.additionalProperties === false)) folded.additionalProperties = false;
	else {
		const constraints = [];
		for (const object of objects) {
			const constraint = undeclaredConstraint(object);
			if (constraint && !constraints.some((seen) => JSON.stringify(seen) === JSON.stringify(constraint))) constraints.push(constraint);
		}
		if (constraints.length === 1) folded.additionalProperties = constraints[0];
		else if (constraints.length > 1) folded.additionalProperties = { allOf: constraints };
	}
	return folded;
}
/** `additionalProperties` in an `allOf` member sees only that member's own `properties`, so two
* closed object members reject each other's keys and the schema validates nothing. Zod's parser
* pools the key sets instead — `handleIntersectionResults` reports a key as unrecognized only when
* *every* side rejects it — so the emitted schema has to pool them too, and folding the members
* into one object is the encoding that says so on every target.
*
* This runs from `finalize`, after `extractDefs`, which is what keeps it clear of the `$ref`
* machinery: a member extracted into `$defs` is already a `$ref` by now and declines to fold, so it
* keeps its reference and its own closedness rather than being inlined as a stale copy. */
function foldIntersection(json) {
	const allOf = json.allOf;
	if (!Array.isArray(allOf) || allOf.length < 2) return;
	for (const key of FOLDABLE_KEYS) if (key in json) return;
	const unions = allOf.filter((m) => UNION_KEYS.some((k) => Array.isArray(m[k])));
	let folded = null;
	if (!unions.length) folded = foldObjects(allOf);
	else {
		const union = unions[0];
		const keyword = UNION_KEYS.find((k) => Array.isArray(union[k]));
		if (Object.keys(union).length !== 1) return;
		const rest = allOf.filter((m) => m !== union);
		const branches = union[keyword].map((branch) => foldObjects([...rest, branch]));
		if (branches.some((b) => !b)) return;
		folded = { [keyword]: branches };
	}
	if (!folded) return;
	delete json.allOf;
	assignProps(json, folded);
}
function finalize(ctx, schema) {
	const root = ctx.seen.get(schema);
	if (!root) throw new Error("Unprocessed schema. This is a bug in Zod.");
	const flattenRef = (zodSchema) => {
		const seen = ctx.seen.get(zodSchema);
		if (seen.ref === null) return;
		const schema = seen.def ?? seen.schema;
		const _cached = { ...schema };
		const ref = seen.ref;
		seen.ref = null;
		if (ref) {
			flattenRef(ref);
			const refSeen = ctx.seen.get(ref);
			const refSchema = refSeen.schema;
			if (refSchema.$ref && (ctx.target === "draft-07" || ctx.target === "draft-04" || ctx.target === "openapi-3.0")) {
				schema.allOf = schema.allOf ?? [];
				schema.allOf.push(refSchema);
			} else assignProps(schema, refSchema);
			assignProps(schema, _cached);
			if (zodSchema._zod.parent === ref) for (const key in schema) {
				if (key === "$ref" || key === "allOf") continue;
				if (!(key in _cached)) delete schema[key];
			}
			if (refSchema.$ref && refSeen.def) for (const key in schema) {
				if (key === "$ref" || key === "allOf") continue;
				if (key in refSeen.def && JSON.stringify(schema[key]) === JSON.stringify(refSeen.def[key])) delete schema[key];
			}
		}
		const parent = zodSchema._zod.parent;
		if (parent && parent !== ref) {
			flattenRef(parent);
			const parentSeen = ctx.seen.get(parent);
			if (parentSeen?.schema.$ref) {
				schema.$ref = parentSeen.schema.$ref;
				if (parentSeen.def) for (const key in schema) {
					if (key === "$ref" || key === "allOf") continue;
					if (key in parentSeen.def && JSON.stringify(schema[key]) === JSON.stringify(parentSeen.def[key])) delete schema[key];
				}
			}
		}
		ctx.override({
			zodSchema,
			jsonSchema: schema,
			path: seen.path ?? []
		});
	};
	if (!ctx.external || ctx.sharedEmitDoneFor !== ctx.external) {
		for (const entry of [...ctx.seen.entries()].reverse()) flattenRef(entry[0]);
		if (ctx.target !== "openapi-3.0") for (const entry of ctx.seen.entries()) compactTypeUnion(entry[1].def ?? entry[1].schema);
		for (const rewrite of ctx.deferred) rewrite();
		if (ctx.intersections.length) {
			const carriers = /* @__PURE__ */ new Map();
			for (const seen of ctx.seen.values()) for (const json of [seen.schema, seen.def]) {
				const allOf = json?.allOf;
				if (!Array.isArray(allOf)) continue;
				const existing = carriers.get(allOf);
				if (existing) existing.push(json);
				else carriers.set(allOf, [json]);
			}
			for (const allOf of ctx.intersections) for (const json of carriers.get(allOf) ?? []) foldIntersection(json);
		}
	}
	const result = {};
	if (ctx.target === "draft-2020-12") result.$schema = "https://json-schema.org/draft/2020-12/schema";
	else if (ctx.target === "draft-07") result.$schema = "http://json-schema.org/draft-07/schema#";
	else if (ctx.target === "draft-04") result.$schema = "http://json-schema.org/draft-04/schema#";
	else if (ctx.target === "openapi-3.0") {}
	if (ctx.external?.uri) {
		const id = ctx.external.registry.get(schema)?.id;
		if (!id) throw new Error("Schema is missing an `id` property");
		result.$id = ctx.external.uri(id);
	}
	assignProps(result, root.defId ? root.schema : root.def ?? root.schema);
	const rootMetaId = ctx.metadataRegistry.get(schema)?.id;
	if (rootMetaId !== void 0 && result.id === rootMetaId) delete result.id;
	const defs = ctx.external?.defs ?? {};
	if (!ctx.external || ctx.sharedEmitDoneFor !== ctx.external) for (const entry of ctx.seen.entries()) {
		const seen = entry[1];
		if (seen.def && seen.defId) {
			if (seen.def.id === seen.defId) delete seen.def.id;
			assignProp(defs, seen.defId, seen.def);
		}
	}
	if (ctx.external) ctx.sharedEmitDoneFor = ctx.external;
	if (ctx.external) {} else if (Object.keys(defs).length > 0) {
		if (ctx.target === "draft-2020-12") result.$defs = defs;
		else result.definitions = defs;
	}
	try {
		const finalized = JSON.parse(JSON.stringify(result));
		Object.defineProperty(finalized, "~standard", {
			value: {
				...schema["~standard"],
				jsonSchema: {
					input: createStandardJSONSchemaMethod(schema, "input", ctx.processors),
					output: createStandardJSONSchemaMethod(schema, "output", ctx.processors)
				}
			},
			enumerable: false,
			writable: false
		});
		return finalized;
	} catch (_err) {
		throw new Error("Error converting schema to JSON.");
	}
}
function isTransforming(_schema, _ctx) {
	const ctx = _ctx ?? { seen: /* @__PURE__ */ new Set() };
	if (ctx.seen.has(_schema)) return false;
	ctx.seen.add(_schema);
	const def = _schema._zod.def;
	if (def.type === "transform") return true;
	if (def.type === "array") return isTransforming(def.element, ctx);
	if (def.type === "set") return isTransforming(def.valueType, ctx);
	if (def.type === "lazy") return isTransforming(def.getter(), ctx);
	if (def.type === "promise" || def.type === "optional" || def.type === "nonoptional" || def.type === "nullable" || def.type === "readonly" || def.type === "default" || def.type === "prefault" || def.type === "catch") return isTransforming(def.innerType, ctx);
	if (def.type === "intersection") return isTransforming(def.left, ctx) || isTransforming(def.right, ctx);
	if (def.type === "record" || def.type === "map") return isTransforming(def.keyType, ctx) || isTransforming(def.valueType, ctx);
	if (def.type === "pipe") {
		if (_schema._zod.traits.has("$ZodCodec")) return true;
		return isTransforming(def.in, ctx) || isTransforming(def.out, ctx);
	}
	if (def.type === "object") {
		for (const key in def.shape) if (isTransforming(def.shape[key], ctx)) return true;
		return false;
	}
	if (def.type === "union") {
		for (const option of def.options) if (isTransforming(option, ctx)) return true;
		return false;
	}
	if (def.type === "tuple") {
		for (const item of def.items) if (isTransforming(item, ctx)) return true;
		if (def.rest && isTransforming(def.rest, ctx)) return true;
		return false;
	}
	return false;
}
/**
* Creates a toJSONSchema method for a schema instance.
* This encapsulates the logic of initializing context, processing, extracting defs, and finalizing.
*/
const createToJSONSchemaMethod = (schema, processors = {}) => (params) => {
	const ctx = initializeContext({
		...params,
		processors
	});
	processSchema(schema, ctx);
	extractDefs(ctx, schema);
	return finalize(ctx, schema);
};
const createStandardJSONSchemaMethod = (schema, io, processors = {}) => (params) => {
	const { libraryOptions, target } = params ?? {};
	const ctx = initializeContext({
		...libraryOptions ?? {},
		target,
		io,
		processors
	});
	processSchema(schema, ctx);
	extractDefs(ctx, schema);
	return finalize(ctx, schema);
};

// node_modules/zod/v4/core/json-schema-processors.js
const narrowMin = (agg, key, value) => {
	if (agg[key] === void 0 || value > agg[key]) agg[key] = value;
};
const narrowMax = (agg, key, value) => {
	if (agg[key] === void 0 || value < agg[key]) agg[key] = value;
};
const narrowBoth = (agg, value) => {
	narrowMin(agg, "minimum", value);
	narrowMax(agg, "maximum", value);
};
const addDivisor = (agg, value) => {
	agg.multipleOf ?? (agg.multipleOf = []);
	if (!agg.multipleOf.includes(value)) agg.multipleOf.push(value);
};
const addPattern = (agg, pattern) => {
	agg.patterns ?? (agg.patterns = /* @__PURE__ */ new Set());
	agg.patterns.add(pattern);
};
const intersectMime = (agg, mime) => {
	agg.mime = agg.mime ? agg.mime.filter((m) => mime.includes(m)) : [...mime];
};
const setFormat = (agg, format) => {
	agg.format = format;
	if (format.includes("int")) agg.isInt = true;
};
const minContributor = (agg, def) => narrowMin(agg, "minimum", def.minimum);
const maxContributor = (agg, def) => narrowMax(agg, "maximum", def.maximum);
const formatContributor = (ranges) => (agg, def) => {
	setFormat(agg, def.format);
	const [minimum, maximum] = ranges[def.format];
	narrowMin(agg, "minimum", minimum);
	narrowMax(agg, "maximum", maximum);
};
const contributors = {
	greater_than: (agg, def) => narrowMin(agg, def.inclusive ? "minimum" : "exclusiveMinimum", def.value),
	less_than: (agg, def) => narrowMax(agg, def.inclusive ? "maximum" : "exclusiveMaximum", def.value),
	multiple_of: (agg, def) => addDivisor(agg, def.value),
	number_format: formatContributor(NUMBER_FORMAT_RANGES),
	bigint_format: formatContributor(BIGINT_FORMAT_RANGES),
	min_length: minContributor,
	max_length: maxContributor,
	length_equals: (agg, def) => narrowBoth(agg, def.length),
	min_size: minContributor,
	max_size: maxContributor,
	size_equals: (agg, def) => narrowBoth(agg, def.size),
	string_format: (agg, def) => {
		setFormat(agg, def.format);
		if (def.pattern) addPattern(agg, def.pattern);
		if (def.format === "base64" || def.format === "base64url") agg.contentEncoding = def.format;
		if (def.local || def.precision === -1) agg.laxFormat = true;
	},
	mime_type: (agg, def) => intersectMime(agg, def.mime)
};
function aggregateChecks(schema) {
	const agg = {};
	const def = schema._zod.def;
	const list = schema._zod.traits.has("$ZodCheck") ? [schema, ...def.checks ?? []] : def.checks ?? [];
	for (const ch of list) contributors[ch._zod.def.check]?.(agg, ch._zod.def);
	const bag = schema._zod.bag;
	if (bag.minimum !== void 0) narrowMin(agg, "minimum", bag.minimum);
	if (bag.exclusiveMinimum !== void 0) narrowMin(agg, "exclusiveMinimum", bag.exclusiveMinimum);
	if (bag.maximum !== void 0) narrowMax(agg, "maximum", bag.maximum);
	if (bag.exclusiveMaximum !== void 0) narrowMax(agg, "exclusiveMaximum", bag.exclusiveMaximum);
	if (bag.multipleOf !== void 0) addDivisor(agg, bag.multipleOf);
	if (bag.format !== void 0) {
		agg.format ?? (agg.format = bag.format);
		if (bag.format.includes("int")) agg.isInt = true;
	}
	if (bag.mime) intersectMime(agg, bag.mime);
	for (const pattern of bag.patterns ?? []) addPattern(agg, pattern);
	return agg;
}
const formatMap = {
	guid: "uuid",
	url: "uri",
	datetime: "date-time",
	json_string: "json-string",
	regex: ""
};
const exactPatterns = /* @__PURE__ */ new Map([[base64Charset, base64], [base64urlCharset, base64url]]);
const exactPattern = (p) => exactPatterns.get(p) ?? p;
const stringProcessor = (schema, ctx, _json, _params) => {
	const json = _json;
	json.type = "string";
	const { minimum, maximum, format, patterns, contentEncoding, laxFormat } = aggregateChecks(schema);
	if (typeof minimum === "number") json.minLength = minimum;
	if (typeof maximum === "number") json.maxLength = maximum;
	if (format) {
		json.format = formatMap[format] ?? format;
		if (json.format === "") delete json.format;
		if (format === "time" || laxFormat) delete json.format;
	}
	if (contentEncoding) json.contentEncoding = contentEncoding;
	if (patterns && patterns.size > 0) {
		const patternList = [...patterns].map(exactPattern);
		if (patternList.length === 1) json.pattern = patternList[0].source;
		else if (patternList.length > 1) json.allOf = [...patternList.map((regex) => ({
			...ctx.target === "draft-07" || ctx.target === "draft-04" || ctx.target === "openapi-3.0" ? { type: "string" } : {},
			pattern: regex.source
		}))];
	}
};
const numberProcessor = (schema, ctx, _json, params) => {
	const json = _json;
	const { minimum, maximum, multipleOf, exclusiveMaximum, exclusiveMinimum, isInt } = aggregateChecks(schema);
	json.type = isInt ? "integer" : "number";
	const exMin = typeof exclusiveMinimum === "number" && exclusiveMinimum >= (minimum ?? Number.NEGATIVE_INFINITY);
	const exMax = typeof exclusiveMaximum === "number" && exclusiveMaximum <= (maximum ?? Number.POSITIVE_INFINITY);
	const legacy = ctx.target === "draft-04" || ctx.target === "openapi-3.0";
	if (exMin) {
		if (legacy) {
			json.minimum = exclusiveMinimum;
			json.exclusiveMinimum = true;
		} else json.exclusiveMinimum = exclusiveMinimum;
	} else if (typeof minimum === "number") json.minimum = minimum;
	if (exMax) {
		if (legacy) {
			json.maximum = exclusiveMaximum;
			json.exclusiveMaximum = true;
		} else json.exclusiveMaximum = exclusiveMaximum;
	} else if (typeof maximum === "number") json.maximum = maximum;
	if (multipleOf) {
		const divisors = /* @__PURE__ */ new Set();
		for (const divisor of multipleOf) if (Number.isFinite(divisor) && divisor !== 0) divisors.add(Math.abs(divisor));
		else handleUnrepresentable(schema, ctx, json, params, `A multipleOf divisor of ${divisor} cannot be represented in JSON Schema`);
		const [first, ...rest] = divisors;
		if (first !== void 0) json.multipleOf = first;
		if (rest.length) json.allOf = [...json.allOf ?? [], ...rest.map((m) => ({ multipleOf: m }))];
	}
};
const booleanProcessor = (_schema, _ctx, json, _params) => {
	json.type = "boolean";
};
const neverProcessor = (_schema, _ctx, json, _params) => {
	json.not = {};
};
const unknownProcessor = (_schema, _ctx, _json, _params) => {};
const enumProcessor = (schema, _ctx, json, _params) => {
	const def = schema._zod.def;
	const values = getEnumValues(def.entries);
	if (values.length === 0) {
		json.not = {};
		return;
	}
	if (values.every((v) => typeof v === "number")) json.type = "number";
	if (values.every((v) => typeof v === "string")) json.type = "string";
	json.enum = values;
};
const literalProcessor = (schema, ctx, json, params) => {
	const def = schema._zod.def;
	if (def.values.length === 0) {
		json.not = {};
		return;
	}
	const vals = [];
	for (const val of def.values) if (val === void 0) {
		if (handleUnrepresentable(schema, ctx, json, params, "Literal `undefined` cannot be represented in JSON Schema")) return;
	} else if (typeof val === "bigint") {
		if (handleUnrepresentable(schema, ctx, json, params, "BigInt literals cannot be represented in JSON Schema")) return;
		vals.push(Number(val));
	} else vals.push(val);
	if (vals.length === 0) {} else if (vals.length === 1) {
		const val = vals[0];
		json.type = val === null ? "null" : typeof val;
		if (ctx.target === "draft-04" || ctx.target === "openapi-3.0") json.enum = [val];
		else json.const = val;
	} else {
		if (vals.every((v) => typeof v === "number")) json.type = "number";
		if (vals.every((v) => typeof v === "string")) json.type = "string";
		if (vals.every((v) => typeof v === "boolean")) json.type = "boolean";
		if (vals.every((v) => v === null)) json.type = "null";
		json.enum = vals;
	}
};
const customProcessor = (schema, ctx, json, params) => {
	handleUnrepresentable(schema, ctx, json, params, "Custom types cannot be represented in JSON Schema");
};
const transformProcessor = (schema, ctx, json, params) => {
	handleUnrepresentable(schema, ctx, json, params, "Transforms cannot be represented in JSON Schema");
};
const arrayProcessor = (schema, ctx, _json, params) => {
	const json = _json;
	const def = schema._zod.def;
	const { minimum, maximum } = aggregateChecks(schema);
	if (typeof minimum === "number") json.minItems = minimum;
	if (typeof maximum === "number") json.maxItems = maximum;
	json.type = "array";
	json.items = processSchema(def.element, ctx, {
		...params,
		path: [...params.path, "items"]
	});
};
function inputOptin(schema) {
	const def = schema._zod.def;
	if (def.type === "pipe" && def.in._zod.traits.has("$ZodTransform")) return inputOptin(def.out);
	if (def.type === "catch") return inputOptin(def.innerType);
	return schema._zod.optin;
}
const objectProcessor = (schema, ctx, _json, params) => {
	const json = _json;
	const def = schema._zod.def;
	const shape = def.shape;
	if (Object.getOwnPropertySymbols(shape).length && handleUnrepresentable(schema, ctx, json, params, "Symbol keys cannot be represented in JSON Schema")) return;
	json.type = "object";
	json.properties = {};
	for (const key in shape) assignProp(json.properties, key, processSchema(shape[key], ctx, {
		...params,
		path: [
			...params.path,
			"properties",
			key
		]
	}));
	const requiredKeys = [];
	for (const key of Object.keys(shape)) {
		const field = def.shape[key];
		if (ctx.io === "input" ? inputOptin(field) === void 0 : field._zod.optout === void 0) requiredKeys.push(key);
	}
	if (requiredKeys.length > 0) json.required = requiredKeys;
	if (def.catchall?._zod.def.type === "never") json.additionalProperties = false;
	else if (!def.catchall) {
		if (ctx.io === "output") json.additionalProperties = false;
	} else if (def.catchall) json.additionalProperties = processSchema(def.catchall, ctx, {
		...params,
		path: [...params.path, "additionalProperties"]
	});
};
const unionProcessor = (schema, ctx, json, params) => {
	const def = schema._zod.def;
	const isExclusive = def.inclusive === false;
	const options = def.options.map((x, i) => processSchema(x, ctx, {
		...params,
		path: [
			...params.path,
			isExclusive ? "oneOf" : "anyOf",
			i
		]
	}));
	if (isExclusive) json.oneOf = options;
	else json.anyOf = options;
};
const intersectionProcessor = (schema, ctx, json, params) => {
	const def = schema._zod.def;
	const a = processSchema(def.left, ctx, {
		...params,
		path: [
			...params.path,
			"allOf",
			0
		]
	});
	const b = processSchema(def.right, ctx, {
		...params,
		path: [
			...params.path,
			"allOf",
			1
		]
	});
	const isSimpleIntersection = (val) => "allOf" in val && Object.keys(val).length === 1;
	const allOf = [...isSimpleIntersection(a) ? a.allOf : [a], ...isSimpleIntersection(b) ? b.allOf : [b]];
	json.allOf = allOf;
	ctx.intersections.push(allOf);
};
const tupleProcessor = (schema, ctx, _json, params) => {
	const json = _json;
	const def = schema._zod.def;
	json.type = "array";
	const prefixPath = ctx.target === "draft-2020-12" ? "prefixItems" : "items";
	const restPath = ctx.target === "draft-2020-12" ? "items" : ctx.target === "openapi-3.0" ? "items" : "additionalItems";
	const prefixItems = def.items.map((x, i) => processSchema(x, ctx, {
		...params,
		path: [
			...params.path,
			prefixPath,
			i
		]
	}));
	const rest = def.rest ? processSchema(def.rest, ctx, {
		...params,
		path: [
			...params.path,
			restPath,
			...ctx.target === "openapi-3.0" ? [def.items.length] : []
		]
	}) : null;
	let minItems = def.items.length;
	while (minItems > 0) {
		const item = def.items[minItems - 1];
		if (!(ctx.io === "input" ? inputOptin(item) !== void 0 : item._zod.optout === "optional")) break;
		minItems--;
	}
	const maxItems = def.items.length;
	const isClosed = !def.rest;
	if (ctx.target === "draft-2020-12") {
		json.prefixItems = prefixItems;
		if (isClosed) json.items = false;
		else if (rest) json.items = rest;
		if (minItems > 0) json.minItems = minItems;
		if (isClosed) json.maxItems = maxItems;
	} else if (ctx.target === "openapi-3.0") {
		json.items = { anyOf: prefixItems };
		if (rest) json.items.anyOf.push(rest);
		if (minItems > 0) json.minItems = minItems;
		if (isClosed) json.maxItems = maxItems;
	} else {
		json.items = prefixItems;
		if (isClosed) json.additionalItems = false;
		else if (rest) json.additionalItems = rest;
		if (minItems > 0) json.minItems = minItems;
		if (isClosed) json.maxItems = maxItems;
	}
	const { minimum, maximum } = aggregateChecks(schema);
	if (typeof minimum === "number") json.minItems = minimum;
	if (typeof maximum === "number") json.maxItems = maximum;
};
const nullableProcessor = (schema, ctx, json, params) => {
	const def = schema._zod.def;
	const inner = processSchema(def.innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	if (ctx.target === "openapi-3.0") {
		seen.ref = def.innerType;
		json.nullable = true;
	} else json.anyOf = [inner, { type: "null" }];
};
const nonoptionalProcessor = (schema, ctx, _json, params) => {
	const def = schema._zod.def;
	processSchema(def.innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	seen.ref = def.innerType;
};
/** Round-trips a default value through JSON so the emitted schema is guaranteed to be valid JSON.
* A BigInt has no reliable encoding, so it goes through `unrepresentable` like any other
* unrepresentable value. Returns a sentinel when the caller must not write a default of its own. */
const UNREPRESENTABLE_DEFAULT = Symbol();
function serializeDefaultValue(value, schema, ctx, json, params) {
	let unrepresentable = false;
	const serialized = JSON.stringify(value, (_, val) => {
		if (typeof val !== "bigint") return val;
		unrepresentable = true;
		return null;
	});
	if (!unrepresentable) return JSON.parse(serialized);
	handleUnrepresentable(schema, ctx, json, params, "BigInt defaults cannot be represented in JSON Schema");
	return UNREPRESENTABLE_DEFAULT;
}
const defaultProcessor = (schema, ctx, json, params) => {
	const def = schema._zod.def;
	processSchema(def.innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	seen.ref = def.innerType;
	const value = serializeDefaultValue(def.defaultValue, schema, ctx, json, params);
	if (value !== UNREPRESENTABLE_DEFAULT) json.default = value;
};
const prefaultProcessor = (schema, ctx, json, params) => {
	const def = schema._zod.def;
	processSchema(def.innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	seen.ref = def.innerType;
	if (ctx.io !== "input") return;
	const value = serializeDefaultValue(def.defaultValue, schema, ctx, json, params);
	if (value !== UNREPRESENTABLE_DEFAULT) json._prefault = value;
};
const catchProcessor = (schema, ctx, json, params) => {
	const def = schema._zod.def;
	processSchema(def.innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	seen.ref = def.innerType;
	let catchValue;
	try {
		catchValue = def.catchValue(void 0);
	} catch {
		handleUnrepresentable(schema, ctx, json, params, "Dynamic catch values are not supported in JSON Schema");
		return;
	}
	json.default = catchValue;
};
const pipeProcessor = (schema, ctx, _json, params) => {
	const def = schema._zod.def;
	const inIsTransform = def.in._zod.traits.has("$ZodTransform");
	const innerType = ctx.io === "input" ? inIsTransform ? def.out : def.in : def.out;
	processSchema(innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	seen.ref = innerType;
};
const readonlyProcessor = (schema, ctx, json, params) => {
	const def = schema._zod.def;
	processSchema(def.innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	seen.ref = def.innerType;
	json.readOnly = true;
};
const optionalProcessor = (schema, ctx, _json, params) => {
	const def = schema._zod.def;
	processSchema(def.innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	seen.ref = def.innerType;
};

// node_modules/zod/v4/classic/errors.js
const _installedErrorProtos = /* @__PURE__ */ new WeakSet([Object.prototype, Error.prototype]);
function _lazyMethod(proto, key, make) {
	Object.defineProperty(proto, key, {
		configurable: true,
		enumerable: false,
		get() {
			const value = make(this);
			Object.defineProperty(this, key, {
				value,
				configurable: true,
				writable: true
			});
			return value;
		},
		set(value) {
			Object.defineProperty(this, key, {
				value,
				configurable: true,
				writable: true
			});
		}
	});
}
const initializer = (inst, issues) => {
	$ZodError.init(inst, issues);
	inst.name = "ZodError";
	const proto = Object.getPrototypeOf(inst);
	if (_installedErrorProtos.has(proto)) return;
	_installedErrorProtos.add(proto);
	_lazyMethod(proto, "format", (self) => (mapper) => formatError(self, mapper));
	_lazyMethod(proto, "flatten", (self) => (mapper) => flattenError(self, mapper));
	_lazyMethod(proto, "addIssue", (self) => (issue) => {
		self.issues.push(issue);
		self.message = JSON.stringify(self.issues, jsonStringifyReplacer, 2);
	});
	_lazyMethod(proto, "addIssues", (self) => (issues) => {
		self.issues.push(...issues);
		self.message = JSON.stringify(self.issues, jsonStringifyReplacer, 2);
	});
	Object.defineProperty(proto, "isEmpty", {
		configurable: true,
		enumerable: false,
		get() {
			return this.issues.length === 0;
		}
	});
};
const ZodRealError = /*@__PURE__*/ $constructor("ZodError", initializer, void 0, { Parent: Error });

// node_modules/zod/v4/classic/parse.js
const parse$1 = /* @__PURE__ */ _parse(ZodRealError);
const parseAsync = /* @__PURE__ */ _parseAsync(ZodRealError);
const safeParse = /* @__PURE__ */ _safeParse(ZodRealError);
const safeParseAsync = /* @__PURE__ */ _safeParseAsync(ZodRealError);
const encode = /* @__PURE__ */ _encode(ZodRealError);
const decode = /* @__PURE__ */ _decode(ZodRealError);
const encodeAsync = /* @__PURE__ */ _encodeAsync(ZodRealError);
const decodeAsync = /* @__PURE__ */ _decodeAsync(ZodRealError);
const safeEncode = /* @__PURE__ */ _safeEncode(ZodRealError);
const safeDecode = /* @__PURE__ */ _safeDecode(ZodRealError);
const safeEncodeAsync = /* @__PURE__ */ _safeEncodeAsync(ZodRealError);
const safeDecodeAsync = /* @__PURE__ */ _safeDecodeAsync(ZodRealError);

// node_modules/zod/v4/classic/schemas.js
function _ensureDefaultLocale() {
	if (!globalConfig.localeError) config(en_default());
}
function _ensureDefaultMemoizer() {
	if (!globalConfig.memoizer) config({ memoizer: memoizer() });
}
const ZodType = /*@__PURE__*/ $constructor("ZodType", (inst, def) => {
	_ensureDefaultLocale();
	$ZodType.init(inst, def);
	inst.def = def;
	inst.type = def.type;
	return inst;
}, {
	check(...chks) {
		const def = this.def;
		return this.clone(mergeDefs(def, { checks: [...def.checks ?? [], ...chks.map((ch) => typeof ch === "function" ? { _zod: {
			check: ch,
			def: { check: "custom" },
			onattach: []
		} } : ch)] }), { parent: true });
	},
	with(...chks) {
		return this.check(...chks);
	},
	clone(def, params) {
		return clone(this, def, params);
	},
	brand() {
		return this;
	},
	register(reg, meta) {
		reg.add(this, meta);
		return this;
	},
	refine(check, params) {
		return this.check(refine(check, params));
	},
	superRefine(refinement, params) {
		return this.check(superRefine(refinement, params));
	},
	overwrite(fn) {
		return this.check(_overwrite(fn));
	},
	optional() {
		return optional(this);
	},
	exactOptional() {
		return exactOptional(this);
	},
	nullable() {
		return nullable(this);
	},
	nullish() {
		return optional(nullable(this));
	},
	nonoptional(params) {
		return nonoptional(this, params);
	},
	array() {
		return array(this);
	},
	or(arg) {
		return union([this, arg]);
	},
	and(arg) {
		return intersection(this, arg);
	},
	transform(tx) {
		return pipe(this, transform(tx));
	},
	default(d) {
		return _default(this, d);
	},
	prefault(d) {
		return prefault(this, d);
	},
	catch(params) {
		return _catch(this, params);
	},
	pipe(target) {
		return pipe(this, target);
	},
	readonly() {
		return readonly(this);
	},
	describe(description) {
		const cl = this.clone();
		globalRegistry.add(cl, { description });
		return cl;
	},
	meta(...args) {
		if (args.length === 0) return globalRegistry.get(this);
		const cl = this.clone();
		globalRegistry.add(cl, args[0]);
		return cl;
	},
	isOptional() {
		return this.safeParse(void 0).success;
	},
	isNullable() {
		return this.safeParse(null).success;
	},
	apply(fn, ...args) {
		return args.length === 0 ? fn(this) : fn(this, ...args);
	},
	get "~standard"() {
		return hide(this, "~standard", {
			...standardProps(this),
			jsonSchema: {
				input: createStandardJSONSchemaMethod(this, "input"),
				output: createStandardJSONSchemaMethod(this, "output")
			}
		});
	},
	set "~standard"(value) {
		own(this, "~standard", value);
	},
	parse: function _parse(data, params) {
		return parse$1(this, data, params, { callee: _parse });
	},
	parseAsync: async function _parseAsync(data, params) {
		return await parseAsync(this, data, params, { callee: _parseAsync });
	},
	safeParse(data, params) {
		return safeParse(this, data, params);
	},
	async safeParseAsync(data, params) {
		return safeParseAsync(this, data, params);
	},
	get spa() {
		return this?.safeParseAsync;
	},
	set spa(value) {
		own(this, "spa", value);
	},
	validate(data, params) {
		return validate(this, data, params);
	},
	validateAsync(data, params) {
		return validateAsync$1(this, data, params);
	},
	encode: function _encode(data, params) {
		return encode(this, data, params, { callee: _encode });
	},
	decode: function _decode(data, params) {
		return decode(this, data, params, { callee: _decode });
	},
	encodeAsync: async function _encodeAsync(data, params) {
		return await encodeAsync(this, data, params, { callee: _encodeAsync });
	},
	decodeAsync: async function _decodeAsync(data, params) {
		return await decodeAsync(this, data, params, { callee: _decodeAsync });
	},
	safeEncode(data, params) {
		return safeEncode(this, data, params);
	},
	safeDecode(data, params) {
		return safeDecode(this, data, params);
	},
	async safeEncodeAsync(data, params) {
		return safeEncodeAsync(this, data, params);
	},
	async safeDecodeAsync(data, params) {
		return safeDecodeAsync(this, data, params);
	},
	toJSONSchema(params) {
		return createToJSONSchemaMethod(this, {})(params);
	},
	get description() {
		return globalRegistry.get(this)?.description;
	},
	get _def() {
		return this._zod.def;
	}
});
/** @internal */
const _ZodString = /*@__PURE__*/ $constructor("_ZodString", (inst, def) => {
	$ZodString.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => stringProcessor(inst, ctx, json, params);
}, /*@__PURE__*/ derived({
	format: (inst) => aggregateChecks(inst).format ?? null,
	minLength: (inst) => aggregateChecks(inst).minimum ?? null,
	maxLength: (inst) => aggregateChecks(inst).maximum ?? null
}, {
	regex(...args) {
		return this.check(_regex(...args));
	},
	includes(...args) {
		return this.check(_includes(...args));
	},
	startsWith(...args) {
		return this.check(_startsWith(...args));
	},
	endsWith(...args) {
		return this.check(_endsWith(...args));
	},
	min(...args) {
		return this.check(_minLength(...args));
	},
	max(...args) {
		return this.check(_maxLength(...args));
	},
	length(...args) {
		return this.check(_length(...args));
	},
	nonempty(...args) {
		return this.check(_minLength(1, ...args));
	},
	lowercase(params) {
		return this.check(_lowercase(params));
	},
	uppercase(params) {
		return this.check(_uppercase(params));
	},
	trim() {
		return this.check(_trim());
	},
	normalize(...args) {
		return this.check(_normalize(...args));
	},
	toLowerCase() {
		return this.check(_toLowerCase());
	},
	toUpperCase() {
		return this.check(_toUpperCase());
	},
	slugify() {
		return this.check(_slugify());
	}
}));
const ZodString = /*@__PURE__*/ $constructor("ZodString", (inst, def) => {
	$ZodString.init(inst, def);
	_ZodString.init(inst, def);
}, {
	email(params) {
		return this.check(_email(ZodEmail, params));
	},
	url(params) {
		return this.check(_url(ZodURL, params));
	},
	jwt(params) {
		return this.check(_jwt(ZodJWT, params));
	},
	emoji(params) {
		return this.check(_emoji(ZodEmoji, params));
	},
	guid(params) {
		return this.check(_guid(ZodGUID, params));
	},
	uuid(params) {
		return this.check(_uuid(ZodUUID, params));
	},
	uuidv4(params) {
		return this.check(_uuidv4(ZodUUID, params));
	},
	uuidv6(params) {
		return this.check(_uuidv6(ZodUUID, params));
	},
	uuidv7(params) {
		return this.check(_uuidv7(ZodUUID, params));
	},
	nanoid(params) {
		return this.check(_nanoid(ZodNanoID, params));
	},
	cuid(params) {
		return this.check(_cuid(ZodCUID, params));
	},
	cuid2(params) {
		return this.check(_cuid2(ZodCUID2, params));
	},
	ulid(params) {
		return this.check(_ulid(ZodULID, params));
	},
	base64(params) {
		return this.check(_base64(ZodBase64, params));
	},
	base64url(params) {
		return this.check(_base64url(ZodBase64URL, params));
	},
	xid(params) {
		return this.check(_xid(ZodXID, params));
	},
	ksuid(params) {
		return this.check(_ksuid(ZodKSUID, params));
	},
	ipv4(params) {
		return this.check(_ipv4(ZodIPv4, params));
	},
	ipv6(params) {
		return this.check(_ipv6(ZodIPv6, params));
	},
	cidrv4(params) {
		return this.check(_cidrv4(ZodCIDRv4, params));
	},
	cidrv6(params) {
		return this.check(_cidrv6(ZodCIDRv6, params));
	},
	e164(params) {
		return this.check(_e164(ZodE164, params));
	},
	datetime(params) {
		return this.check(_isoDateTime(ZodISODateTime, params));
	},
	date(params) {
		return this.check(_isoDate(ZodISODate, params));
	},
	time(params) {
		return this.check(_isoTime(ZodISOTime, params));
	},
	duration(params) {
		return this.check(_isoDuration(ZodISODuration, params));
	}
});
function string(params) {
	return _string(ZodString, params);
}
const ZodStringFormat = /*@__PURE__*/ $constructor("ZodStringFormat", (inst, def) => {
	$ZodStringFormat.init(inst, def);
	_ZodString.init(inst, def);
});
const ZodISODateTime = /*@__PURE__*/ $constructor("ZodISODateTime", (inst, def) => {
	$ZodISODateTime.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodISODate = /*@__PURE__*/ $constructor("ZodISODate", (inst, def) => {
	$ZodISODate.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodISOTime = /*@__PURE__*/ $constructor("ZodISOTime", (inst, def) => {
	$ZodISOTime.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodISODuration = /*@__PURE__*/ $constructor("ZodISODuration", (inst, def) => {
	$ZodISODuration.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodEmail = /*@__PURE__*/ $constructor("ZodEmail", (inst, def) => {
	$ZodEmail.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodGUID = /*@__PURE__*/ $constructor("ZodGUID", (inst, def) => {
	$ZodGUID.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodUUID = /*@__PURE__*/ $constructor("ZodUUID", (inst, def) => {
	$ZodUUID.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodURL = /*@__PURE__*/ $constructor("ZodURL", (inst, def) => {
	$ZodURL.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodEmoji = /*@__PURE__*/ $constructor("ZodEmoji", (inst, def) => {
	$ZodEmoji.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodNanoID = /*@__PURE__*/ $constructor("ZodNanoID", (inst, def) => {
	$ZodNanoID.init(inst, def);
	ZodStringFormat.init(inst, def);
});
/**
* @deprecated CUID v1 is deprecated by its authors due to information leakage
* (timestamps embedded in the id). Use {@link ZodCUID2} instead.
* See https://github.com/paralleldrive/cuid.
*/
const ZodCUID = /*@__PURE__*/ $constructor("ZodCUID", (inst, def) => {
	$ZodCUID.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodCUID2 = /*@__PURE__*/ $constructor("ZodCUID2", (inst, def) => {
	$ZodCUID2.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodULID = /*@__PURE__*/ $constructor("ZodULID", (inst, def) => {
	$ZodULID.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodXID = /*@__PURE__*/ $constructor("ZodXID", (inst, def) => {
	$ZodXID.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodKSUID = /*@__PURE__*/ $constructor("ZodKSUID", (inst, def) => {
	$ZodKSUID.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodIPv4 = /*@__PURE__*/ $constructor("ZodIPv4", (inst, def) => {
	$ZodIPv4.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodIPv6 = /*@__PURE__*/ $constructor("ZodIPv6", (inst, def) => {
	$ZodIPv6.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodCIDRv4 = /*@__PURE__*/ $constructor("ZodCIDRv4", (inst, def) => {
	$ZodCIDRv4.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodCIDRv6 = /*@__PURE__*/ $constructor("ZodCIDRv6", (inst, def) => {
	$ZodCIDRv6.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodBase64 = /*@__PURE__*/ $constructor("ZodBase64", (inst, def) => {
	$ZodBase64.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodBase64URL = /*@__PURE__*/ $constructor("ZodBase64URL", (inst, def) => {
	$ZodBase64URL.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodE164 = /*@__PURE__*/ $constructor("ZodE164", (inst, def) => {
	$ZodE164.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodJWT = /*@__PURE__*/ $constructor("ZodJWT", (inst, def) => {
	$ZodJWT.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodNumber = /*@__PURE__*/ $constructor("ZodNumber", (inst, def) => {
	$ZodNumber.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => numberProcessor(inst, ctx, json, params);
	inst.isFinite = true;
}, /*@__PURE__*/ derived({
	minValue: (inst) => {
		const { minimum, exclusiveMinimum } = aggregateChecks(inst);
		return Math.max(minimum ?? Number.NEGATIVE_INFINITY, exclusiveMinimum ?? Number.NEGATIVE_INFINITY);
	},
	maxValue: (inst) => {
		const { maximum, exclusiveMaximum } = aggregateChecks(inst);
		return Math.min(maximum ?? Number.POSITIVE_INFINITY, exclusiveMaximum ?? Number.POSITIVE_INFINITY);
	},
	isInt: (inst) => {
		const { isInt, multipleOf } = aggregateChecks(inst);
		return !!isInt || !!multipleOf?.some(Number.isSafeInteger);
	},
	format: (inst) => aggregateChecks(inst).format ?? null
}, {
	gt(value, params) {
		return this.check(_gt(value, params));
	},
	gte(value, params) {
		return this.check(_gte(value, params));
	},
	min(value, params) {
		return this.check(_gte(value, params));
	},
	lt(value, params) {
		return this.check(_lt(value, params));
	},
	lte(value, params) {
		return this.check(_lte(value, params));
	},
	max(value, params) {
		return this.check(_lte(value, params));
	},
	int(params) {
		return this.check(int(params));
	},
	safe(params) {
		return this.check(int(params));
	},
	positive(params) {
		return this.check(_gt(0, params));
	},
	nonnegative(params) {
		return this.check(_gte(0, params));
	},
	negative(params) {
		return this.check(_lt(0, params));
	},
	nonpositive(params) {
		return this.check(_lte(0, params));
	},
	multipleOf(value, params) {
		return this.check(_multipleOf(value, params));
	},
	step(value, params) {
		return this.check(_multipleOf(value, params));
	},
	finite() {
		return this;
	}
}));
function number(params) {
	return _number(ZodNumber, params);
}
const ZodNumberFormat = /*@__PURE__*/ $constructor("ZodNumberFormat", (inst, def) => {
	$ZodNumberFormat.init(inst, def);
	ZodNumber.init(inst, def);
});
function int(params) {
	return _int(ZodNumberFormat, params);
}
const ZodBoolean = /*@__PURE__*/ $constructor("ZodBoolean", (inst, def) => {
	$ZodBoolean.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => booleanProcessor(inst, ctx, json, params);
});
function boolean(params) {
	return _boolean(ZodBoolean, params);
}
const ZodUnknown = /*@__PURE__*/ $constructor("ZodUnknown", (inst, def) => {
	$ZodUnknown.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => unknownProcessor(inst, ctx, json, params);
});
function unknown() {
	return _unknown(ZodUnknown);
}
const ZodNever = /*@__PURE__*/ $constructor("ZodNever", (inst, def) => {
	$ZodNever.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => neverProcessor(inst, ctx, json, params);
});
function never(params) {
	return _never(ZodNever, params);
}
const ZodArray = /*@__PURE__*/ $constructor("ZodArray", (inst, def) => {
	_ensureDefaultMemoizer();
	$ZodArray.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => arrayProcessor(inst, ctx, json, params);
	inst.element = def.element;
}, {
	min(n, params) {
		return this.check(_minLength(n, params));
	},
	nonempty(params) {
		return this.check(_minLength(1, params));
	},
	max(n, params) {
		return this.check(_maxLength(n, params));
	},
	length(n, params) {
		return this.check(_length(n, params));
	},
	unwrap() {
		return this.element;
	}
});
function array(element, params) {
	return _array(ZodArray, element, params);
}
const ZodObject = /*@__PURE__*/ $constructor("ZodObject", (inst, def) => {
	_ensureDefaultMemoizer();
	$ZodObjectJIT.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => objectProcessor(inst, ctx, json, params);
	installLazyProp(inst, "shape", (self) => self._zod.def.shape, false);
}, {
	keyof() {
		return _enum(Object.keys(this._zod.def.shape));
	},
	catchall(catchall) {
		return this.clone(mergeDefs(this._zod.def, { catchall }));
	},
	passthrough() {
		return this.clone(mergeDefs(this._zod.def, { catchall: unknown() }));
	},
	loose() {
		return this.clone(mergeDefs(this._zod.def, { catchall: unknown() }));
	},
	strict() {
		return this.clone(mergeDefs(this._zod.def, { catchall: never() }));
	},
	strip() {
		return this.clone(mergeDefs(this._zod.def, { catchall: void 0 }));
	},
	extend(incoming) {
		return extend(this, incoming);
	},
	safeExtend(incoming) {
		return safeExtend(this, incoming);
	},
	merge(other) {
		return merge(this, other);
	},
	pick(mask) {
		return pick(this, mask);
	},
	omit(mask) {
		return omit(this, mask);
	},
	partial(...args) {
		return partial(ZodOptional, this, args[0]);
	},
	exactPartial(...args) {
		return partial(ZodExactOptional, this, args[0], "exactPartial");
	},
	required(...args) {
		return required(ZodNonOptional, this, args[0]);
	}
});
function object(shape, params) {
	const def = {
		type: "object",
		shape: shape ?? {},
		...normalizeParams(params)
	};
	return new ZodObject(def);
}
const ZodUnion = /*@__PURE__*/ $constructor("ZodUnion", (inst, def) => {
	$ZodUnion.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => unionProcessor(inst, ctx, json, params);
	inst.options = def.options;
});
function union(options, params) {
	return new ZodUnion({
		type: "union",
		options,
		...normalizeParams(params)
	});
}
const ZodIntersection = /*@__PURE__*/ $constructor("ZodIntersection", (inst, def) => {
	$ZodIntersection.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => intersectionProcessor(inst, ctx, json, params);
});
function intersection(left, right) {
	return new ZodIntersection({
		type: "intersection",
		left,
		right
	});
}
const ZodTuple = /*@__PURE__*/ $constructor("ZodTuple", (inst, def) => {
	_ensureDefaultMemoizer();
	$ZodTuple.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => tupleProcessor(inst, ctx, json, params);
}, {
	rest(rest) {
		return this.clone({
			...this._zod.def,
			rest
		});
	},
	partial() {
		const def = this._zod.def;
		if (def.checks?.length) throw new Error(".partial() cannot be used on tuple schemas containing refinements");
		return this.clone({
			...def,
			items: def.items.map((item) => new ZodOptional({
				type: "optional",
				innerType: item
			}))
		});
	}
});
function tuple(items, _paramsOrRest, _params) {
	const hasRest = _paramsOrRest instanceof $ZodType;
	const params = hasRest ? _params : _paramsOrRest;
	return new ZodTuple({
		type: "tuple",
		items,
		rest: hasRest ? _paramsOrRest : null,
		...normalizeParams(params)
	});
}
const ZodEnum = /*@__PURE__*/ $constructor("ZodEnum", (inst, def) => {
	$ZodEnum.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => enumProcessor(inst, ctx, json, params);
	inst.enum = def.entries;
	inst.options = [...inst._zod.values];
	const keys = new Set(Object.keys(def.entries));
	inst.extract = (values, params) => {
		const newEntries = {};
		for (const value of values) if (keys.has(value)) newEntries[value] = def.entries[value];
		else throw new Error(`Key ${value} not found in enum`);
		return new ZodEnum({
			...def,
			checks: [],
			...normalizeParams(params),
			entries: newEntries
		});
	};
	inst.exclude = (values, params) => {
		const newEntries = { ...def.entries };
		for (const value of values) if (keys.has(value)) delete newEntries[value];
		else throw new Error(`Key ${value} not found in enum`);
		return new ZodEnum({
			...def,
			checks: [],
			...normalizeParams(params),
			entries: newEntries
		});
	};
});
function _enum(values, params) {
	const entries = Array.isArray(values) ? Object.fromEntries(values.map((v) => [v, v])) : values;
	return new ZodEnum({
		type: "enum",
		entries,
		...normalizeParams(params)
	});
}
const ZodLiteral = /*@__PURE__*/ $constructor("ZodLiteral", (inst, def) => {
	$ZodLiteral.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => literalProcessor(inst, ctx, json, params);
	inst.values = new Set(def.values);
	Object.defineProperty(inst, "value", { get() {
		if (def.values.length > 1) throw new Error("This schema contains multiple valid literal values. Use `.values` instead.");
		return def.values[0];
	} });
});
function literal(value, params) {
	return new ZodLiteral({
		type: "literal",
		values: Array.isArray(value) ? value : [value],
		...normalizeParams(params)
	});
}
const ZodTransform = /*@__PURE__*/ $constructor("ZodTransform", (inst, def) => {
	_ensureDefaultMemoizer();
	$ZodTransform.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => transformProcessor(inst, ctx, json, params);
	inst._zod.parse = (payload, _ctx) => {
		if (_ctx.direction === "backward") throw new $ZodEncodeError(inst.constructor.name);
		payload.addIssue = (issue$1) => {
			if (typeof issue$1 === "string") payload.issues.push(issue(issue$1, payload.value, def));
			else {
				const _issue = issue$1;
				if (_issue.fatal) _issue.continue = false;
				_issue.code ?? (_issue.code = "custom");
				if (!("input" in _issue)) _issue.input = payload.value;
				_issue.inst ?? (_issue.inst = inst);
				payload.issues.push(issue(_issue));
			}
		};
		const output = def.transform(payload.value, payload);
		if (output instanceof Promise) return output.then((output) => {
			payload.value = output;
			return payload;
		});
		payload.value = output;
		return payload;
	};
});
function transform(fn) {
	return new ZodTransform({
		type: "transform",
		transform: fn
	});
}
const ZodOptional = /*@__PURE__*/ $constructor("ZodOptional", (inst, def) => {
	$ZodOptional.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => optionalProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
});
function optional(innerType) {
	return new ZodOptional({
		type: "optional",
		innerType
	});
}
const ZodExactOptional = /*@__PURE__*/ $constructor("ZodExactOptional", (inst, def) => {
	$ZodExactOptional.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => optionalProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
});
function exactOptional(innerType) {
	return new ZodExactOptional({
		type: "optional",
		innerType
	});
}
const ZodNullable = /*@__PURE__*/ $constructor("ZodNullable", (inst, def) => {
	$ZodNullable.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => nullableProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
});
function nullable(innerType) {
	return new ZodNullable({
		type: "nullable",
		innerType
	});
}
const ZodDefault = /*@__PURE__*/ $constructor("ZodDefault", (inst, def) => {
	$ZodDefault.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => defaultProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
	inst.removeDefault = inst.unwrap;
});
function _default(innerType, defaultValue) {
	return new ZodDefault({
		type: "default",
		innerType,
		get defaultValue() {
			return typeof defaultValue === "function" ? defaultValue() : shallowClone(defaultValue);
		}
	});
}
const ZodPrefault = /*@__PURE__*/ $constructor("ZodPrefault", (inst, def) => {
	$ZodPrefault.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => prefaultProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
});
function prefault(innerType, defaultValue) {
	return new ZodPrefault({
		type: "prefault",
		innerType,
		get defaultValue() {
			return typeof defaultValue === "function" ? defaultValue() : shallowClone(defaultValue);
		}
	});
}
const ZodNonOptional = /*@__PURE__*/ $constructor("ZodNonOptional", (inst, def) => {
	$ZodNonOptional.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => nonoptionalProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
});
function nonoptional(innerType, params) {
	return new ZodNonOptional({
		type: "nonoptional",
		innerType,
		...normalizeParams(params)
	});
}
const ZodCatch = /*@__PURE__*/ $constructor("ZodCatch", (inst, def) => {
	$ZodCatch.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => catchProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
	inst.removeCatch = inst.unwrap;
});
function _catch(innerType, catchValue) {
	return new ZodCatch({
		type: "catch",
		innerType,
		catchValue: typeof catchValue === "function" ? catchValue : constantCatch(catchValue)
	});
}
const ZodPipe = /*@__PURE__*/ $constructor("ZodPipe", (inst, def) => {
	$ZodPipe.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => pipeProcessor(inst, ctx, json, params);
	inst.in = def.in;
	inst.out = def.out;
});
function pipe(in_, out) {
	return new ZodPipe({
		type: "pipe",
		in: in_,
		out
	});
}
const ZodReadonly = /*@__PURE__*/ $constructor("ZodReadonly", (inst, def) => {
	$ZodReadonly.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => readonlyProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
});
function readonly(innerType) {
	return new ZodReadonly({
		type: "readonly",
		innerType
	});
}
const ZodCustom = /*@__PURE__*/ $constructor("ZodCustom", (inst, def) => {
	$ZodCustom.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => customProcessor(inst, ctx, json, params);
});
function refine(fn, _params = {}) {
	return _refine(ZodCustom, fn, _params);
}
function superRefine(fn, params) {
	return _superRefine(fn, params);
}

// node_modules/zod/v4/classic/compat.js
/** @deprecated Use the raw string literal codes instead, e.g. "invalid_type". */
const ZodIssueCode = {
	invalid_type: "invalid_type",
	too_big: "too_big",
	too_small: "too_small",
	invalid_format: "invalid_format",
	not_multiple_of: "not_multiple_of",
	unrecognized_keys: "unrecognized_keys",
	invalid_union: "invalid_union",
	invalid_key: "invalid_key",
	invalid_element: "invalid_element",
	invalid_value: "invalid_value",
	custom: "custom"
};
/** @deprecated Do not use. Stub definition, only included for zod-to-json-schema compatibility. */
var ZodFirstPartyTypeKind;
ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {});

// vendor/casemaker/casemaker-app/src/engine/cnc/materials.ts
/**
* Every material this app can name, in the order the stock shelf offers it.
*
* The first four are the ones the starting table has rows for — a material this app can cut with
* numbers of its own. The rest have no starting row at all: they are the materials a machine
* profile declares, and only the user's own synced catalogue can answer them, which is exactly why
* `feedsFor` refuses such a job until a row for (that cutter, that material) exists (#347, Route A).
*
* The PRINTED-BLANK classes (#456) are the exception in how they are answered. Their names are
* PrusaSlicer's own `filament_type` words, because the file that printed the blank is what states
* the material; the catalogue lists no row for any of them either, and `CATALOGUE_MATERIAL_ALIASES`
* in `feeds.ts` stands its nearest plastic rows in, labelled as a mapping. `pa-cf` and `pa-gf` are
* separate from `pa` because fibre-filled nylon is abrasive (`runEnd.ts`'s wear class).
*
* TWO LISTS ARE EDITED TOGETHER, and the compiler only enforces one of them: `MATERIAL_LABELS` below
* is `Record<StockMaterial, string>`, so a new material in the TYPE is a compile error until it has
* a word. This tuple is checked the other way round — it is `satisfies readonly StockMaterial[]`, so
* a typo here fails — but nothing forces a material that exists in the type to appear here. What
* that costs is a material the schema would refuse to parse, which is why the job schema's enum is
* this tuple and not a retyped literal.
*/
const STOCK_MATERIALS = [
	"softwood",
	"hardwood",
	"mdf",
	"pla",
	"petg",
	"pet",
	"abs",
	"asa",
	"hips",
	"pa",
	"pa-cf",
	"pa-gf",
	"pc",
	"pp",
	"tpu",
	"pva",
	"acrylic",
	"plastic",
	"pcb",
	"aluminium-6061",
	"aluminium-7075",
	"brass",
	"copper",
	"epoxy-tooling"
];

// vendor/casemaker/casemaker-app/src/engine/cnc/registration/viseReferenceFrame.ts
const Z1_VISE_REFERENCE_FRAME = {
	fixedJawFaceX: -180.175,
	jawStartY: -202.8
};

// vendor/casemaker/casemaker-app/src/engine/cnc/machine.ts
/**
* The machine profile (#184, decision 25): one object for every machine-dependent number.
*
* Built now, with one supported machine, because two things need it immediately:
*
*  1. Feeds and speeds must be clamped against SOMETHING. Makera's own tool table has no
*     machine column and 32 of its rows specify a spindle speed above the Z1's 13 000 RPM
*     ceiling (`/Makera-Parity.md` §5.1). Without a profile there is nowhere to clamp from.
*  2. The emulator animates the tool-change macro (#182, Q14), and every position in that
*     macro is machine config — clearance, safe height, the tool-length sensor — not
*     anything the program file contains.
*
* Scope was the Z1 ONLY until #773. Carvera and Carvera Air are rows in Makera's own database,
* and #773 brings them in as far as the evidence goes: the Carvera Air is a full profile (its
* shipped controller settings are Makera's own open-source Controller's), while the Carvera is a
* {@link MillModel} — the vendor's row with NO frame, because no Carvera controller configuration
* has ever been read. What #183 guarded against (a second machine's numbers silently borrowed from
* the Z1) is what the `frameState` discriminator now makes impossible to compile past.
*
* PROVENANCE. Every number carries where it came from. Three sources, in order of trust:
*   - `t_MachineType` in Makera's library database: the Z1's own row.
*   - `src/configZ1.default` in MakeraZ1Firmware: the shipped default config. A READING of
*     the repo, not of the machine; the device's own config could differ, and that file
*     carries Carvera-era boilerplate (its `worksize_x` says 300 on a 200 mm machine).
*   - Hard-coded constants in `ATCHandler.cpp` for the Z1 model.
* Nothing here has been verified on hardware.
*/
/** The Z1's {@link FrameDerivationOffsets}: the two `ATCHandler.cpp` model constants. */
const Z1_DERIVATION_OFFSETS = {
	sensorOffsetFromAnchor1: [181, 181],
	changePositionExtraX: 132
};
/**
* The Carvera Air's {@link FrameDerivationOffsets} (#773), from the same `ATCHandler.cpp` and its
* own model branch: the manual tool change parks the head at `anchor1 + (280, 196)` to probe the
* tool (`ATCHandler.cpp`, the `CARVERA_AIR == MachineModel` arm), and the change position adds the
* same `132` on X every model does (`ATCHandler.cpp:134`).
*/
const CA1_DERIVATION_OFFSETS = {
	sensorOffsetFromAnchor1: [280, 196],
	changePositionExtraX: 132
};
/**
* Derive the positions the head is actually driven to from the frame the controller holds.
*
* **ONE formula, two callers**: the shipped `Z1` below, and a machine's own read
* (`calibration.ts`). While this was inline arithmetic inside the `Z1` literal, an override had
* nowhere to put itself except a duplicated expression — and a duplicated derivation is how two
* numbers that must agree stop agreeing.
*
* These three are the DERIVED positions. `clearanceXY`, `clearanceZ` and `sensorZ` are config
* keys in their own right and are read from the frame directly; in particular
* `clearance` and `anchor1` are the two *opposite corners of the work area*, not links in a
* chain (`ATCHandler::fill_Autoclean_scripts` sweeps between them), so a change position that
* lands on `clearance_x` is a coincidence of the shipped defaults rather than a check.
*/
function deriveCoordinateFrame(frame, offsets) {
	const [ax, ay] = frame.anchor1;
	const [c2x, c2y] = frame.anchor2Offset;
	const [tx, ty] = frame.toolrackOffset;
	return {
		anchor2: [ax + c2x, ay + c2y],
		sensor: [ax + offsets.sensorOffsetFromAnchor1[0], ay + offsets.sensorOffsetFromAnchor1[1]],
		changePosition: [ax + tx + offsets.changePositionExtraX, ay + ty]
	};
}
/**
* The coordinate frame the shipped `Z1` profile carries, one value per `coordinate.*` key.
*
* **The anchors are the firmware's SHIPPED DEFAULTS, and this machine is calibrated away from
* them.** `configZ1.default:405-406` carries exactly these numbers; `config-get sd
* coordinate.anchor1_x` and `.anchor1_y` read **(−190.89, −193.83)** out of the machine's own
* `/sd/config.txt` (#208 B6, 2026-10-06) — 1.51 mm and 0.47 mm away (#279).
*
* An earlier version of this note argued for keeping them on the grounds that `changePosition` lands
* on the config's `clearance_x` (−11.6; it computes −11.62) only with these numbers, and that the
* machine's anchor moves it to −10.09. **That argument was wrong, and why it was wrong is worth
* keeping.** `clearance` and `anchor1` are the two *opposite corners of the work area*, not links in
* a derived chain: `ATCHandler::fill_Autoclean_scripts` sweeps X back and forth between `clearance_x`
* and `anchor1_x`, and Y between `clearance_y` and `anchor1_y`. Two independent config keys that
* happen to sit 0.02 mm apart under the shipped defaults are a coincidence, and a coincidence cannot
* confirm a constant.
*
* What is actually true: `/sd/config.txt` is a *calibration* of the shipped defaults, and it has
* moved several keys together — this anchor, `toolrack_offset_y` (179.74 → 181),
* `rotation_offset_{x,y}` (12.0/85.5 → −7.5/69.0), `clearance_z` (−1.0 → −3.0) — while
* `anchor2_offset` (88.5, 45.0) and `toolrack_offset_x` (48.8) are untouched. So nothing here says
* the profile's anchor is *wrong*; what it says is that this profile describes a stock Z1 and this
* machine is not one.
*
* **#279 decided how that is handled: default + override.** This constant is the DEFAULT half —
* the profile a stock Z1 gets, which is what every user without a calibration should be running —
* and `calibration.ts` is the override half, holding a machine's own read of this same object. The
* anchors stay the vendor's on purpose: pasting one machine's calibration into the shipped profile
* would aim every other Z1's probe 1.5 mm off, which is option 2 and was rejected.
*
* **This frame is not purely the vendor's file, and saying so is part of the fix.** Four of the six
* keys are `configZ1.default`'s; the two Z values are this repo's own machine reads, because the
* vendor file cannot supply them honestly:
*
*  - `clearanceZ` is **−3.0**, read on the machine (#208 B6), where `configZ1.default` says −1.0 —
*    and −1.0 is also B4's post-homing rest Z, which would have meant `G28` moved no Z at all. C1
*    watched it move 2 mm, to −3.000.
*  - `toolrackZ` is **−108**, read on the machine (#208 B7). The vendor file has no such key; −108
*    is Carvera-Air boilerplate the firmware uses as "all the way down", past this machine's own Z
*    travel.
*
* So the profile as shipped was *already* part vendor and part measurement, and was silent about
* which. That is the confusion this constant ends: every value below is traceable, and a machine
* that disagrees supplies a whole frame rather than three borrowed numbers.
*/
const Z1_FRAME = {
	anchor1: [-192.4, -194.3],
	anchor2Offset: [88.5, 45],
	toolrackOffset: [48.78, 179.74],
	clearanceXY: [-11.6, -14.6],
	clearanceZ: -3,
	toolrackZ: -108
};
/** The shipped frame's derived positions. `deriveCoordinateFrame` is the only thing that makes them. */
const Z1_DATUMS = deriveCoordinateFrame(Z1_FRAME, Z1_DERIVATION_OFFSETS);
/**
* The materials every Makera mill's profile carries (#347, #773): Makera's own `t_MaterialList`,
* in this app's words, one entry per vendor row this app can name EXACTLY. The library table has
* no machine column — the vendor list is the firm's materials, not a per-model one — so the same
* list rides on the Z1 and both Carveras. See the Z1's `materials` field for what is left out and
* why.
*/
const MAKERA_MATERIALS = [
	"softwood",
	"hardwood",
	"abs",
	"acrylic",
	"petg",
	"pet",
	"asa",
	"hips",
	"pa",
	"pa-cf",
	"pa-gf",
	"pc",
	"pp",
	"tpu",
	"pva",
	"aluminium-6061",
	"aluminium-7075",
	"brass",
	"copper",
	"pcb",
	"epoxy-tooling"
];
/**
* The Makera Z1.
*
* `t_MachineType`: 200 x 200 x 100, 1200 mm/min, 13 000 RPM, isATC = 0, rotary ⌀80 x 150.
*
* `coordinate.*`, **read on the machine** (`config-get sd`, 2026-10-06): `clearance_x` = `-11.6`
* and `clearance_z` = `-3.0` — both exactly where bench item C1 watched `G28` stop, so the group
* name and the values are hardware-confirmed. `atc.*` holds neither (it answers *"not in config"*),
* so the earlier note crediting it was wrong. Everything the anchors, safe Z and sensor need is
* under `coordinate.*`, and as of 2026-10-06 it has all been read — see the table below.
*
* `ATCHandler.cpp`: the Z1's sensor position is `anchor1 + 181` on each axis (line 266), and its
* change position is `anchor1 + toolrack_offset + (132, 0)` (line 134) — the shipped defaults put
* that at (-11.62, -14.56), which is *not* a consistency check on the anchor; see {@link Z1_FRAME}.
*
* | Key | Shipped default | Read off the machine |
* |---|---|---|
* | `coordinate.anchor1_x` / `_y` | -192.4 / -194.3 | **-190.89 / -193.83** |
* | `coordinate.anchor2_offset_x` / `_y` | 88.5 / 45.0 | 88.5 / 45.0 |
* | `coordinate.toolrack_offset_x` / `_y` | 48.78 / 179.74 | **48.8 / 181** |
* | `coordinate.toolrack_z` | (not in the default file) | -108 |
* | `coordinate.clearance_x` / `_y` / `_z` | -11.6 / -14.6 / -1.0 | -11.6 / -14.6 / **-3.0** |
* | `coordinate.rotation_offset_x` / `_y` / `_z` | 12.0 / 85.5 / — | **-7.5 / 69.0 / 17.0** |
* | `coordinate.worksize_x` / `_y` | (not in the default file) | 200.0 / 200.0 |
*
* `toolrack_z` = **-108** is where `sensorZ` below comes from — the constant the profile had
* credited to an unread key. `worksize` = 200 x 200 independently restates the vendor's own figure,
* and `anchor2_offset` matching to the digit says the anchor *frame* is intact on this machine; only
* its origin has been calibrated.
*
* The bolded values are this machine's calibration. **#279 decided what to do with them: the
* shipped profile keeps the vendor's defaults (see {@link Z1_FRAME}) and a read like this one is
* held separately, as a saved record with provenance, in `calibration.ts`.** Nothing below is
* typed twice: every position in `toolChange` that the firmware derives, is derived here.
*/
/**
* #927 — the Z1 spindle's ramp, seconds, and where it came from. The profile carries it twice on
* purpose: `spinUpSeconds` is the profile's home for the number, `rapidEstimate.spinUpSeconds` is
* where the cycle estimate reads it; one constant keeps the two from drifting.
*/
const Z1_SPIN_UP_SECONDS = 12;
const Z1_SPIN_UP_SOURCE = "the 2026-10-15 185-v-groove cut trace: S:36.8 at 17:18:08.262 to S:12011.7 at 17:18:20.296, ~12 s from rest to 12000 rpm (docs/bench/traces/2026-10-15-185-cut.log); a speed-field read, not the D3 timed run";
const Z1 = {
	id: "Z1",
	name: "Makera Z1",
	process: "mill",
	viseReferenceFrame: Z1_VISE_REFERENCE_FRAME,
	frameState: "read",
	materials: MAKERA_MATERIALS,
	envelope: {
		x: {
			min: -200,
			max: 0
		},
		y: {
			min: -200,
			max: 0
		},
		z: {
			min: -100,
			max: 0
		}
	},
	maxCutFeed: 1200,
	rapidEstimate: {
		xyMmPerMin: 1200,
		zMmPerMin: 600,
		accelMmPerS2: 150,
		source: "config read 2026-10-07 + stopwatch 2026-10-08",
		spinUpSeconds: Z1_SPIN_UP_SECONDS,
		spinUpSource: Z1_SPIN_UP_SOURCE,
		aMaxDegPerMin: 3600
	},
	spinUpSeconds: Z1_SPIN_UP_SECONDS,
	spinUpSource: Z1_SPIN_UP_SOURCE,
	axisSteps: {
		xyPerMm: 1600,
		zPerMm: 3200,
		source: "configZ1.default, shipped firmware default — keys absent from /sd/config.txt and unreadable over the bridge"
	},
	maxRpm: 13e3,
	sensorOffsetFromAnchor1: Z1_DERIVATION_OFFSETS.sensorOffsetFromAnchor1,
	changePositionExtraX: Z1_DERIVATION_OFFSETS.changePositionExtraX,
	sources: {
		maxCutFeed: "t_MachineType, Makera library database (the Z1 row) — a vendor figure, not measured",
		maxRpm: "t_MachineType, Makera library database (the Z1 row) — a vendor figure, not measured",
		sensorOffsetFromAnchor1: "ATCHandler.cpp:266, hard-coded for the Z1 model — the same number on X and Y",
		changePositionExtraX: "ATCHandler.cpp:134, hard-coded for the Z1 model"
	},
	hasATC: false,
	toolSlots: 0,
	camera: {
		port: 82,
		path: "/ws_video",
		source: "observed on the Z1, 2026-10-08 (#286): ws://<host>:82/ws_video, `start_stream`, binary JPEG frames"
	},
	softEndstop: {
		enabled: true,
		xMin: -207,
		yMin: -206,
		zMin: -102,
		source: "read from the machine, 2026-10-06"
	},
	capabilities: {
		rotary: true,
		laser: false,
		air: false,
		vacuum: true,
		antistatic: true,
		blow: true
	},
	dialect: {
		acceptsArcs: true,
		cannedCycles: false,
		grblMode: true,
		axisPrecision: 3,
		feedPrecision: 2
	},
	anchor1: Z1_FRAME.anchor1,
	anchor2: Z1_DATUMS.anchor2,
	toolChange: {
		clearanceZ: Z1_FRAME.clearanceZ,
		clearanceXY: Z1_FRAME.clearanceXY,
		changePosition: Z1_DATUMS.changePosition,
		safeZ: -20,
		sensor: Z1_DATUMS.sensor,
		sensorZ: Z1_FRAME.toolrackZ,
		probeFastFeed: 500,
		probeSlowFeed: 100,
		probeRetract: 1,
		sources: {
			safeZ: "config-get sd on the machine, 2026-10-06 (atc.safe_z_mm -20.0)",
			probeFastFeed: "config-get sd on the machine, 2026-10-06 (atc.probe.fast_rate_mm_m 500)",
			probeSlowFeed: "config-get sd on the machine, 2026-10-06 (atc.probe.slow_rate_mm_m 100)",
			probeRetract: "config-get sd on the machine, 2026-10-06 (atc.probe.retract_mm 1)"
		}
	},
	holder: null,
	headEnvelope: {
		radiusMm: 28.5,
		source: "Makera’s public Z1 model (Machine_Design_Files/Makera-Z1_Simplified_4Axis.step, sha256 b7df28bc…), height-filtered to the bodies that can descend within the stock’s height plus clearance above the tip: the one in that band measures 52 × 57 × 67 mm, taken as a 57 mm diameter (radius 28.5 mm); the assembly transforms were not resolved, so it is a model reading, not a calipered nose — #943 owes the caliper"
	},
	rotary: {
		axis: "A",
		parent: "y",
		envelope: {
			diameter: 80,
			length: 150
		},
		stepsPerDegree: 88.888889,
		maxRate: 3600,
		acceleration: 360,
		homing: "home_to_min",
		unwind: "G92.4 A S",
		sources: {
			envelope: "Makera’s own figure (t_MachineType row “Makera Z1”: range_A_Diameter 80, range_A_Length 150 — the library database, read 2026-10-26) — not measured",
			stepsPerDegree: "Makera’s shipped value (configZ1.default delta_steps_per_mm 88.888889 = 32 000 steps per turn; absent from the machine’s /sd/config.txt, sweep 2026-10-07) — unverified on the device",
			maxRate: "Makera’s shipped value (configZ1.default delta_max_rate 3600 °/min = 60 °/s = 10 rpm; Studio’s ControllerConfig.txt and the machine’s config read 2026-10-07 agree) — a config read, not a measurement",
			acceleration: "Makera’s shipped value (configZ1.default delta_acceleration 360 °/s²; Studio’s ControllerConfig.txt and the machine’s config read 2026-10-07 agree) — a config read, not a measurement",
			homing: "Makera’s shipped value (configZ1.default delta_homing_direction home_to_min, delta_min_endstop 1.4^, delta_limit_enable true; absent from the machine’s /sd/config.txt) — unverified on the device",
			unwind: "Makera’s shipped value (configZ1.default / Robot.cpp: G92.4 A S drops whole turns, R resets to the value modulo 360; Studio sends G92.4 A0 S0 and calls it “A-axis shrunk”, and the vendor rotary files end on it) — unverified on the device"
		}
	}
};
/**
* The Carvera Air's shipped coordinate frame (#773), from Makera's own Carvera Controller
* (`github.com/MakeraInc/CarveraController`, `src/config.txt`, commit
* `3914c912452f83fbd5b5d90c730cb78795198438`). That file is the Carvera Air model's shipped
* user-settings document — its own `wifi.machine_name CARVERA_AIR_Lab_2` names the model, and its
* `worksize_x/y` (300 × 200) agree with the library database's CA1 row digit for digit, which is
* the consistency check the anchors do not have. The firmware's `ATCHandler.cpp` carries the same
* model's toolrack defaults (`-108` / `126` / `196`, lines 1579–1583), and its rotation offsets
* (41.5 / 82.5 / 23 here, 30 / 82.5 / 23 as the firmware default) are the controller file's
* newer values.
*
* NOT THIS Z1's EXPORT: Studio's `ControllerConfig.txt` on this machine carries the Z1's own
* numbers (anchor1 −190.89 / −193.83, clearance_z −3.0, rotation −7.5 / 69 / 17) — the values this
* file already records as THIS machine's reads — so it was not used for a Carvera. A stock Air's
* own `/sd/config.txt` may have been calibrated away from these shipped defaults; that read is
* #279's override, and it is not held here.
*/
const CA1_FRAME = {
	anchor1: [-287.51, -202.11],
	anchor2Offset: [88.5, 45],
	toolrackOffset: [126, 196],
	clearanceXY: [-5, -21],
	clearanceZ: -3,
	toolrackZ: -108
};
/** The shipped Air frame's derived positions — `deriveCoordinateFrame` is the only thing that makes them. */
const CA1_DATUMS = deriveCoordinateFrame(CA1_FRAME, CA1_DERIVATION_OFFSETS);
/**
* The Makera Carvera Air (#773): the second FRAMED mill.
*
* `t_MachineType` (read 2026-10-29, the CA1 row): 300 × 200 × 130, rotary ⌀92 × 200, no ATC,
* 3000 mm/min, 13 000 RPM. The shipped frame and motion settings are the Carvera Controller's
* `src/config.txt` at 3914c912: the rates and acceleration, the probe feeds, safe Z and the soft
* endstops.
*
* WHAT IS NULL, RATHER THAN COPIED FROM THE Z1: the axes' steps-per-mm and the rotary's
* steps-per-degree and homing direction. The user-settings file states none of them, and nothing
* else we hold does; a controller read against a real Air is what fills them.
*
* WHAT IS FALSE, AND IS NOT SILENCE: this app's accessory words are the Z1's (`M331`/`M332` and
* their sub-codes). The Carvera's vacuum is `M801`/`M802` — a different machine's controls, which
* this app does not drive — so `vacuum`, `air` and `antistatic` are false here because the post
* must not speak them at a Carvera, not because the machine lacks them. `rotary` is true: the
* library row states the module's envelope. `laser` is false: no source states one is fitted.
*
* The dialect is the shared Makera firmware's (MakeraZ1Firmware @ 8ae81f3 carries the
* `CARVERA_AIR` branches beside the Z1's), read off that firmware's parser and its own G-code
* vocabulary — a family figure, NOT verified on a Carvera Air.
*/
const CARVERA_AIR = {
	id: "CA1",
	name: "Makera Carvera Air",
	process: "mill",
	frameState: "read",
	materials: MAKERA_MATERIALS,
	envelope: {
		x: {
			min: -300,
			max: 0
		},
		y: {
			min: -200,
			max: 0
		},
		z: {
			min: -130,
			max: 0
		}
	},
	maxCutFeed: 3e3,
	rapidEstimate: {
		xyMmPerMin: 3e3,
		zMmPerMin: 2e3,
		accelMmPerS2: 150,
		source: "CarveraController src/config.txt @ 3914c912 — shipped settings, not measured"
	},
	axisSteps: null,
	maxRpm: 13e3,
	sensorOffsetFromAnchor1: CA1_DERIVATION_OFFSETS.sensorOffsetFromAnchor1,
	changePositionExtraX: CA1_DERIVATION_OFFSETS.changePositionExtraX,
	sources: {
		maxCutFeed: "makera_library.db t_MachineType, Carvera Air (CA1) row, read 2026-10-29 (vendor figure, not measured)",
		maxRpm: "makera_library.db t_MachineType, Carvera Air (CA1) row, read 2026-10-29 (vendor figure, not measured)",
		sensorOffsetFromAnchor1: "MakeraZ1Firmware ATCHandler.cpp, the CARVERA_AIR manual-change arm (anchor1 + 280 on X, + 196 on Y), commit 8ae81f3 — the firmware’s own model constant",
		changePositionExtraX: "MakeraZ1Firmware ATCHandler.cpp:134 (+132 on X for every model), commit 8ae81f3"
	},
	hasATC: false,
	toolSlots: 0,
	softEndstop: {
		enabled: true,
		xMin: -302,
		yMin: -212,
		zMin: -121,
		source: "CarveraController src/config.txt @ 3914c912 — shipped settings, not measured"
	},
	capabilities: {
		rotary: true,
		laser: false,
		air: false,
		vacuum: false,
		antistatic: false,
		blow: false
	},
	dialect: {
		acceptsArcs: true,
		cannedCycles: false,
		grblMode: true,
		axisPrecision: 3,
		feedPrecision: 2
	},
	anchor1: CA1_FRAME.anchor1,
	anchor2: CA1_DATUMS.anchor2,
	toolChange: {
		clearanceZ: CA1_FRAME.clearanceZ,
		clearanceXY: CA1_FRAME.clearanceXY,
		changePosition: CA1_DATUMS.changePosition,
		safeZ: -20,
		sensor: CA1_DATUMS.sensor,
		sensorZ: CA1_FRAME.toolrackZ,
		probeFastFeed: 500,
		probeSlowFeed: 100,
		probeRetract: 2,
		sources: {
			safeZ: "CarveraController src/config.txt @ 3914c912 (atc.safe_z_mm -20.0) — shipped settings",
			probeFastFeed: "CarveraController src/config.txt @ 3914c912 (atc.probe.fast_rate_mm_m 500)",
			probeSlowFeed: "CarveraController src/config.txt @ 3914c912 (atc.probe.slow_rate_mm_m 100)",
			probeRetract: "CarveraController src/config.txt @ 3914c912 (atc.probe.retract_mm 2)"
		}
	},
	holder: null,
	rotary: {
		axis: "A",
		parent: "y",
		envelope: {
			diameter: 92,
			length: 200
		},
		stepsPerDegree: null,
		maxRate: 2400,
		acceleration: 360,
		homing: null,
		unwind: "G92.4 A S",
		sources: {
			envelope: "Makera’s own figure (t_MachineType CA1 row: range_A_Diameter 92, range_A_Length 200 — the library database, read 2026-10-29) — not measured",
			stepsPerDegree: "not read from a Carvera Air: its shipped user-settings file states no steps per degree, and no other source we hold does",
			maxRate: "CarveraController src/config.txt @ 3914c912 (delta_max_rate 2400) — shipped settings",
			acceleration: "CarveraController src/config.txt @ 3914c912 (delta_acceleration 360) — shipped settings",
			homing: "not read from a Carvera Air: its shipped user-settings file states no homing direction",
			unwind: "the shared Makera firmware (MakeraZ1Firmware Robot.cpp:667, G92.4) @ 8ae81f3 — not verified on a Carvera Air"
		}
	}
};
/**
* #828 — THE CARVERA'S SHIPPED FRAME, from the Carvera Community Firmware: the open-source fork
* that targets the ORIGINAL Carvera (C1), not the Air. Its `src/config.default` carries
* `wifi.machine_name CARVERA_01001` (the Air's file is `config2.default` with
* `CARVERA_AIR_01001`), and the anchor, toolrack, clearance and worksize values below; the keys
* the file leaves commented are the firmware's own compiled defaults, which `ATCHandler.cpp` and
* `Robot.cpp` state.
*
* Commit: `2c97111cb0bbd6d3edfac2c138963c0255248865`
* (github.com/Carvera-Community/Carvera_Community_Firmware).
*
* NONE OF IT IS A READ OF A MACHINE. A Carvera whose own `/sd/config.txt` was calibrated away
* from these shipped defaults reports its own values, and the #279 connection read is what would
* replace them — the same standing the Air's shipped frame has. And it is NOT the Z1's Studio
* export nor the Air's Controller config: #773 records which file belongs to which machine.
*/
const C1_FRAME = {
	anchor1: [-360.158, -234.568],
	anchor2Offset: [90, 45],
	toolrackOffset: [356, 0],
	clearanceXY: [-75, -3],
	clearanceZ: -3,
	toolrackZ: -112.5
};
/**
* The Carvera's derivation constants (#828), from the same firmware commit:
*
*  - the tool-length sensor: `ATCHandler.cpp`'s CARVERA probe fallback is
*    `(anchor1_x + toolrack_offset_x, anchor1_y + toolrack_offset_y + 180)` — (356, 180) from
*    anchor1 — used when the machine configures no `probe_mcs_*`;
*  - the +132 on X: the family's change-arm constant (`ATCHandler.cpp`), the same number the Z1
*    and the Air derive. A Carvera with an ATC never runs a manual park — the controller's `M6`
*    drives its own rack — so the change position this derives is the family formula, carried
*    because the profile's shape is shared, not a position this app commands.
*
* The config.default comment beside `probe_mcs_*` states the unset probe as Y −42.568, Z −157.0,
* which DISAGREES with this commit's code (Y −54.568, Z −152.5 at the same file's toolrack_z).
* The code is what the firmware runs, so the code's formula is recorded here and the
* disagreement is stated rather than smoothed over.
*/
const C1_DERIVATION_OFFSETS = {
	sensorOffsetFromAnchor1: [356, 180],
	changePositionExtraX: 132
};
/** The Carvera's shipped frame and its derived datums (#828). */
const C1_DATUMS = deriveCoordinateFrame(C1_FRAME, C1_DERIVATION_OFFSETS);
/**
* The changer's default rack (#828): six slots (`t_MachineType`'s `ATC_Number`), the firmware's
* own default arrangement — tool i at `anchor1 + toolrack_offset`, 30 mm apart along Y, tool 1 at
* the far end. A machine that configured custom slots (`load_custom_tool_slots`) reports those
* instead; this app never commands a slot, so the numbers are carried to be STATED.
*/
const C1_RACK_SLOTS = [
	1,
	2,
	3,
	4,
	5,
	6
].map((tool) => [Number((C1_FRAME.anchor1[0] + C1_FRAME.toolrackOffset[0]).toFixed(3)), Number((C1_FRAME.anchor1[1] + C1_FRAME.toolrackOffset[1] + (6 - tool) * 30).toFixed(3))]);
/**
* The Makera Carvera (#773, framed in #828): the vendor's row for the travel and the changer's
* size, and the Carvera Community Firmware's shipped configuration for the frame the controller
* works in.
*
* `t_MachineType` (read 2026-10-29, the Carvera/C1 row): 320 × 240 × 140, rotary ⌀92 × 240, ATC
* with 6 tools, 3000 mm/min, 15 000 RPM. The worksize the firmware file states (340 × 240) is
* WIDER on X than the vendor row; the row is what this app bounds a job's stock with, and the
* firmware figure is noted here rather than preferred, because the row is the machine's stated
* range and the work area is not.
*
* WHAT IS NULL, RATHER THAN COPIED FROM THE Z1: the axes' steps-per-mm (the firmware's
* `config.default` carries the generic Smoothieboard 200, not this machine's steps, and nothing
* else we hold states them) and the rotary's steps-per-degree and homing direction. A controller
* read against a real Carvera is what fills them.
*
* WHAT IS FALSE, AND IS NOT SILENCE: this app's accessory words are the Z1's (`M331`/`M332` and
* their sub-codes). The Carvera's vacuum is `M801`/`M802` — a different machine's controls, which
* this app does not drive — so `vacuum`, `air` and `antistatic` are false here because the post
* must not speak them at a Carvera, not because the machine lacks them. `rotary` is true: the
* library row states the module's envelope. `laser` is false: no source states one is fitted.
*
* The dialect is the shared Makera firmware's — the same family the Air's comment records — read
* off that firmware's parser and its own G-code vocabulary.
*/
const CARVERA = {
	id: "C1",
	name: "Makera Carvera",
	process: "mill",
	frameState: "read",
	materials: MAKERA_MATERIALS,
	envelope: {
		x: {
			min: -320,
			max: 0
		},
		y: {
			min: -240,
			max: 0
		},
		z: {
			min: -140,
			max: 0
		}
	},
	maxCutFeed: 3e3,
	rapidEstimate: {
		xyMmPerMin: 3e3,
		zMmPerMin: 2e3,
		accelMmPerS2: 150,
		source: "Carvera Community Firmware src/config.default @ 2c97111 (alpha/beta_max_rate 3000, gamma_max_rate 2000, acceleration 150 — the keys’ defaults) — shipped settings, not measured"
	},
	axisSteps: null,
	maxRpm: 15e3,
	sensorOffsetFromAnchor1: C1_DERIVATION_OFFSETS.sensorOffsetFromAnchor1,
	changePositionExtraX: C1_DERIVATION_OFFSETS.changePositionExtraX,
	sources: {
		maxCutFeed: "makera_library.db t_MachineType, Carvera (C1) row (maxFeedRate 3000), read 2026-10-29 (vendor figure, not measured)",
		maxRpm: "makera_library.db t_MachineType, Carvera (C1) row (maxRPM 15000), read 2026-10-29 (vendor figure, not measured)",
		sensorOffsetFromAnchor1: "Carvera Community Firmware src/modules/tools/atc/ATCHandler.cpp @ 2c97111 — the CARVERA probe fallback (anchor1 + toolrack offsets, +180 on Y) when no probe_mcs_* is configured",
		changePositionExtraX: "Carvera Community Firmware src/modules/tools/atc/ATCHandler.cpp @ 2c97111 — the +132 on X every model’s change arm uses (an ATC Carvera changes at its rack, not here)"
	},
	hasATC: true,
	toolSlots: 6,
	toolRack: {
		slots: C1_RACK_SLOTS,
		z: C1_FRAME.toolrackZ,
		source: "Carvera Community Firmware src/modules/tools/atc/ATCHandler.cpp @ 2c97111 — the default slot list built when a machine configures no custom slots (tool i at anchor1 + the toolrack offsets, 30 mm apart along Y); a machine with its own slot list reports those, and this app does not hold them"
	},
	softEndstop: {
		enabled: true,
		xMin: -371,
		yMin: -250,
		zMin: -135,
		source: "Carvera Community Firmware src/modules/robot/Robot.cpp @ 2c97111 (the soft_endstop defaults) — shipped settings, not measured"
	},
	capabilities: {
		rotary: true,
		laser: false,
		air: false,
		vacuum: false,
		antistatic: false,
		blow: false
	},
	dialect: {
		acceptsArcs: true,
		cannedCycles: false,
		grblMode: true,
		axisPrecision: 3,
		feedPrecision: 2
	},
	anchor1: C1_FRAME.anchor1,
	anchor2: C1_DATUMS.anchor2,
	toolChange: {
		clearanceZ: C1_FRAME.clearanceZ,
		clearanceXY: C1_FRAME.clearanceXY,
		changePosition: C1_DATUMS.changePosition,
		safeZ: -20,
		sensor: C1_DATUMS.sensor,
		sensorZ: C1_FRAME.toolrackZ - 40,
		probeFastFeed: 500,
		probeSlowFeed: 100,
		probeRetract: 2,
		sources: {
			safeZ: "Carvera Community Firmware src/config.default @ 2c97111 (atc.safe_z_mm -20.0) — shipped settings",
			probeFastFeed: "Carvera Community Firmware src/config.default @ 2c97111 (atc.probe.fast_rate_mm_m 500)",
			probeSlowFeed: "Carvera Community Firmware src/config.default @ 2c97111 (atc.probe.slow_rate_mm_m 100)",
			probeRetract: "Carvera Community Firmware src/config.default @ 2c97111 (atc.probe.retract_mm default 2)"
		}
	},
	holder: null,
	rotary: {
		axis: "A",
		parent: "y",
		envelope: {
			diameter: 92,
			length: 240
		},
		stepsPerDegree: null,
		maxRate: 1800,
		acceleration: 360,
		homing: null,
		unwind: "G92.4 A S",
		sources: {
			envelope: "Makera’s own figure (t_MachineType C1 row: range_A_Diameter 92, range_A_Length 240 — the library database, read 2026-10-29) — not measured",
			stepsPerDegree: "not stated anywhere we hold: the Carvera Community Firmware config.default carries no rotary steps per degree for the C1",
			maxRate: "Carvera Community Firmware src/config.default @ 2c97111 (delta_max_rate 1800) — shipped settings",
			acceleration: "Carvera Community Firmware src/config.default @ 2c97111 (delta_acceleration 360) — shipped settings",
			homing: "not stated: config.default leaves delta_homing_direction commented at this commit, so the A axis’s homing direction is unread",
			unwind: "the shared Makera firmware (MakeraZ1Firmware Robot.cpp:667, G92.4) @ 8ae81f3 — the same family"
		}
	}
};
/**
* #845 SLICE B — THE GRBL MACHINES THE APP SHIPS PRESETS FOR.
*
* A stated machine, not a vendor row: the owner tells the app the work area and the spindle, and
* Case Maker writes its `.nc` for the owner's own sender and never drives the machine
* (`frameState: 'stated'`, `post: 'grbl'`). Every value's `sources` entry says where it came from —
* the vendor's published spec with its URL, or "stated by you — the vendor publishes no value" for
* the handful no vendor states. Nothing here is measured on the maintainer's bench, and nothing is
* invented and labelled as published.
*
* THE ENVELOPE IS THE WORK AREA, from the machine's front-left corner: `0 … W` on each axis. The
* Z1's negative machine frame is a controller convention it has and these machines do not; a
* stated machine's numbers are relative to the work origin the profile names in `workOrigin`.
*
* THE VALUES ARE STARTING POINTS. Any of them may be edited on the machine record; after an edit
* the value is the owner's, which is why the Manage row reads "values stated by you".
*/
/** A cited value: the vendor's number, with the page it came from. */
const cited = (what, url) => `${what} (${url})`;
/** What no vendor publishes: the owner's own starting value, said as such. */
const statedByYou = (what) => `stated by you — ${what}`;
const GRBL_MATERIALS = [
	"softwood",
	"hardwood",
	"mdf",
	"plastic",
	"acrylic",
	"aluminium-6061"
];
/** The 0…extent envelope a work-area figure makes. */
const workArea = (x, y, z) => ({
	x: {
		min: 0,
		max: x
	},
	y: {
		min: 0,
		max: y
	},
	z: {
		min: 0,
		max: z
	}
});
/** The tools every GRBL preset is run with: a manual change, so no slots. */
const MANUAL_CHANGE = {
	hasATC: false,
	toolSlots: 0
};
const SHAPEOKO_4 = {
	id: "grbl:shapeoko-4",
	name: "Shapeoko 4 XXL",
	process: "mill",
	post: "grbl",
	frameState: "stated",
	workOrigin: "top-front-left",
	materials: GRBL_MATERIALS,
	envelope: workArea(838.2, 838.2, 101.6),
	maxCutFeed: 3e3,
	maxRpm: 3e4,
	rapidEstimate: {
		xyMmPerMin: 5e3,
		zMmPerMin: 1e3,
		accelMmPerS2: 250,
		source: "stated by you — the vendor publishes no rapid rate; 5000 mm/min XY, 1000 mm/min Z, 250 mm/s²"
	},
	...MANUAL_CHANGE,
	sources: {
		envelope: cited("Carbide 3D Shapeoko 4 XXL, 33 × 33 × 4 in (838.2 × 838.2 × 101.6 mm)", "https://easel.inventables.com/partners/machines/carbide3d-shapeoko-4/"),
		maxCutFeed: statedByYou("Carbide 3D publishes no maximum feed; 3000 mm/min is a starting value"),
		maxRpm: cited("Carbide Compact Router 12 000–30 000 RPM", "https://easel.inventables.com/partners/machines/carbide3d-shapeoko-4/"),
		atc: cited("no tool changer — a manual change", "https://easel.inventables.com/partners/machines/carbide3d-shapeoko-4/")
	}
};
const SHAPEOKO_5 = {
	id: "grbl:shapeoko-5-pro",
	name: "Shapeoko 5 Pro (4 × 4)",
	process: "mill",
	post: "grbl",
	frameState: "stated",
	workOrigin: "top-front-left",
	materials: GRBL_MATERIALS,
	envelope: workArea(1237, 1237, 154.9),
	maxCutFeed: 3e3,
	maxRpm: 27e3,
	rapidEstimate: {
		xyMmPerMin: 5e3,
		zMmPerMin: 1e3,
		accelMmPerS2: 250,
		source: "stated by you — the vendor publishes no rapid rate; 5000 mm/min XY, 1000 mm/min Z, 250 mm/s²"
	},
	...MANUAL_CHANGE,
	sources: {
		envelope: cited("Carbide 3D Shapeoko 5 Pro, 4 × 4: 48.7 × 48.7 × 6.1 in (1237 × 1237 × 154.9 mm)", "https://easel.inventables.com/partners/machines/carbide3d-shapeoko-5-pro/"),
		maxCutFeed: statedByYou("Carbide 3D publishes no maximum feed; 3000 mm/min is a starting value"),
		maxRpm: cited("the DeWalt DW611 dial tops out at 27 000 RPM (no router is included)", "https://easel.inventables.com/partners/machines/carbide3d-shapeoko-5-pro/"),
		atc: cited("no tool changer — a manual change", "https://easel.inventables.com/partners/machines/carbide3d-shapeoko-5-pro/")
	}
};
const X_CARVE = {
	id: "grbl:x-carve-pro",
	name: "X-Carve Pro (4 × 4)",
	process: "mill",
	post: "grbl",
	frameState: "stated",
	workOrigin: "top-front-left",
	materials: GRBL_MATERIALS,
	envelope: workArea(1219.2, 1219.2, 101.6),
	maxCutFeed: 3e3,
	maxRpm: 24e3,
	rapidEstimate: {
		xyMmPerMin: 5e3,
		zMmPerMin: 1e3,
		accelMmPerS2: 250,
		source: "stated by you — the vendor publishes no rapid rate; 5000 mm/min XY, 1000 mm/min Z, 250 mm/s²"
	},
	...MANUAL_CHANGE,
	sources: {
		envelope: cited("Inventables X-Carve Pro 4 × 4: 48 × 48 × 4 in (1219.2 × 1219.2 × 101.6 mm)", "https://easel.inventables.com/partners/machines/inventables-x-carve-pro/"),
		maxCutFeed: statedByYou("Inventables publishes no maximum feed; 3000 mm/min is a starting value"),
		maxRpm: cited("X-Carve Pro 2 HP VFD spindle, 8 000–24 000 RPM", "https://easel.inventables.com/partners/machines/inventables-x-carve-pro/"),
		atc: cited("no tool changer — a manual change", "https://easel.inventables.com/partners/machines/inventables-x-carve-pro/")
	}
};
const GENMITSU_3018 = {
	id: "grbl:3018-prover",
	name: "3018-PROVer V2",
	process: "mill",
	post: "grbl",
	frameState: "stated",
	workOrigin: "top-front-left",
	materials: GRBL_MATERIALS,
	envelope: workArea(300, 180, 45),
	maxCutFeed: 500,
	maxRpm: 1e4,
	rapidEstimate: {
		xyMmPerMin: 2e3,
		zMmPerMin: 500,
		accelMmPerS2: 100,
		source: "stated by you — the vendor publishes no rapid rate; 2000 mm/min XY, 500 mm/min Z, 100 mm/s²"
	},
	...MANUAL_CHANGE,
	sources: {
		envelope: cited("Genmitsu 3018-PROVer V2 work area 300 × 180 × 45 mm (V2 Z travel 40 mm)", "https://www.sainsmart.com/products/genmitsu-3018-prover"),
		maxCutFeed: statedByYou("SainSmart publishes no maximum feed; 500 mm/min is a starting value"),
		maxRpm: cited("775 spindle motor at 24 V: 10 000 RPM", "https://www.sainsmart.com/products/genmitsu-3018-prover"),
		atc: cited("no tool changer — a manual change", "https://www.sainsmart.com/products/genmitsu-3018-prover")
	}
};
/** The four GRBL presets the Manage panel offers, in the order it lists them. */
const GRBL_PRESETS = [
	SHAPEOKO_4,
	SHAPEOKO_5,
	X_CARVE,
	GENMITSU_3018
];
/**
* The mills whose controller frame is established: the only machines a job may be written for.
* The Z1, the Carvera Air and — since #828 — the Carvera are FRAMED; a {@link MillModel} is not
* in here, so no id lookup that returns a `MillProfile` can ever hand back a machine whose
* positions are unknown.
*/
const MACHINES = {
	[Z1.id]: Z1,
	[CARVERA_AIR.id]: CARVERA_AIR,
	[CARVERA.id]: CARVERA
};
/**
* Every mill model the app knows, framed or not: what the machine picker, the location's machine
* records and the job schema read when they only need to say WHICH machine is meant.
*/
const MILL_MODELS = {
	[Z1.id]: Z1,
	[CARVERA_AIR.id]: CARVERA_AIR,
	[CARVERA.id]: CARVERA,
	...Object.fromEntries(GRBL_PRESETS.map((model) => [model.id, model]))
};
/**
* The nozzle width assumed when the printer is not named. Nearly every consumer FDM machine
* ships with a 0.4 mm nozzle, and the profile carries no per-job printer for the case and rack
* compilers to read yet, so `preThreadPrintable` falls back to this. Moved here from
* `fasteners.ts` (it is a machine number, and #184's acceptance greps for it outside the
* profile). A real line-width setting, when one lands, replaces this in one place.
*/
const ASSUMED_NOZZLE = .4;
/**
* The consumer printers the rack fit-checker offers. Bed volumes, byte-identical ids and names
* to the old `PRINTER_PRESETS`, so a stored `rack.printer.preset` keeps resolving; `nozzle` is
* the addition this fold buys. Not supported machines to execute against — only fit volumes.
*/
const PRINTER_PROFILES = [
	{
		id: "a1-mini",
		name: "Bambu A1 mini (180³)",
		process: "fdm",
		buildVolume: {
			x: 180,
			y: 180,
			z: 180
		},
		nozzle: ASSUMED_NOZZLE
	},
	{
		id: "prusa-mini",
		name: "Prusa MINI+ (180³)",
		process: "fdm",
		buildVolume: {
			x: 180,
			y: 180,
			z: 180
		},
		nozzle: ASSUMED_NOZZLE
	},
	{
		id: "ender-3",
		name: "Ender-3 class (220×220×250)",
		process: "fdm",
		buildVolume: {
			x: 220,
			y: 220,
			z: 250
		},
		nozzle: ASSUMED_NOZZLE
	},
	{
		id: "prusa-mk4",
		name: "Prusa MK4/MK3 (250×210×220)",
		process: "fdm",
		buildVolume: {
			x: 250,
			y: 210,
			z: 220
		},
		nozzle: ASSUMED_NOZZLE
	},
	{
		id: "bambu-256",
		name: "Bambu X1/P1/A1 (256³)",
		process: "fdm",
		buildVolume: {
			x: 256,
			y: 256,
			z: 256
		},
		nozzle: ASSUMED_NOZZLE
	},
	{
		id: "prusa-xl",
		name: "Prusa XL (360³)",
		process: "fdm",
		buildVolume: {
			x: 360,
			y: 360,
			z: 360
		},
		nozzle: ASSUMED_NOZZLE
	}
];
/** Every machine we know, of any process (#184), framed or not. */
const ALL_MACHINES = [
	Z1,
	CARVERA_AIR,
	CARVERA,
	...PRINTER_PROFILES
];
const finite = number().finite();
const vec2 = tuple([finite, finite]);
const softEndstopSchema = object({
	enabled: boolean(),
	xMin: finite,
	yMin: finite,
	zMin: finite,
	source: string().min(1)
});
const holderSchema = object({
	nutDiameter: finite.positive(),
	nutLength: finite.positive(),
	source: string().min(1)
});
/**
* The optional 4th-axis module (#237). A shipped default is carried as sourced data, one string per
* sourced field (#238) — so a profile that states a rate but not where it came from does not parse.
*/
const rotarySchema = object({
	axis: literal("A"),
	parent: literal("y"),
	envelope: object({
		diameter: finite.positive(),
		length: finite.positive()
	}),
	stepsPerDegree: finite.positive().nullable(),
	maxRate: finite.positive(),
	acceleration: finite.positive(),
	homing: literal("home_to_min").nullable(),
	unwind: literal("G92.4 A S"),
	sources: object({
		envelope: string().min(1),
		stepsPerDegree: string().min(1),
		maxRate: string().min(1),
		acceleration: string().min(1),
		homing: string().min(1),
		unwind: string().min(1)
	})
});
const millProfileSchema = object({
	id: string().min(1),
	name: string().min(1),
	process: literal("mill"),
	viseReferenceFrame: object({
		fixedJawFaceX: number().finite(),
		jawStartY: number().finite()
	}).optional(),
	post: _enum(["z1", "grbl"]).optional(),
	frameState: literal("read"),
	materials: array(_enum(STOCK_MATERIALS)),
	envelope: object({
		x: object({
			min: finite,
			max: finite
		}),
		y: object({
			min: finite,
			max: finite
		}),
		z: object({
			min: finite,
			max: finite
		})
	}),
	maxCutFeed: finite.positive(),
	rapidEstimate: object({
		xyMmPerMin: finite.positive(),
		zMmPerMin: finite.positive(),
		accelMmPerS2: finite.positive(),
		source: string().min(1),
		spinUpSeconds: finite.positive().nullable().optional(),
		spinUpSource: string().min(1).optional(),
		aMaxDegPerMin: finite.positive().optional()
	}),
	spinUpSeconds: finite.positive().nullable().optional(),
	spinUpSource: string().min(1).optional(),
	axisSteps: object({
		xyPerMm: finite.positive(),
		zPerMm: finite.positive(),
		source: string().min(1)
	}).nullable(),
	maxRpm: finite.positive(),
	sensorOffsetFromAnchor1: vec2,
	changePositionExtraX: finite,
	sources: object({
		maxCutFeed: string().min(1),
		maxRpm: string().min(1),
		sensorOffsetFromAnchor1: string().min(1),
		changePositionExtraX: string().min(1)
	}),
	hasATC: boolean(),
	toolSlots: number().int().nonnegative(),
	toolRack: object({
		slots: array(vec2),
		z: finite,
		source: string().min(1)
	}).optional(),
	softEndstop: softEndstopSchema,
	capabilities: object({
		rotary: boolean(),
		laser: boolean(),
		air: boolean(),
		vacuum: boolean(),
		antistatic: boolean(),
		blow: boolean()
	}),
	dialect: object({
		acceptsArcs: boolean(),
		cannedCycles: boolean(),
		grblMode: boolean(),
		axisPrecision: number().int().positive(),
		feedPrecision: number().int().positive()
	}),
	anchor1: vec2,
	anchor2: vec2,
	toolChange: object({
		clearanceZ: finite,
		clearanceXY: vec2,
		changePosition: vec2,
		safeZ: finite,
		sensor: vec2,
		sensorZ: finite,
		probeFastFeed: finite.positive(),
		probeSlowFeed: finite.positive(),
		probeRetract: finite,
		sources: object({
			safeZ: string().min(1),
			probeFastFeed: string().min(1),
			probeSlowFeed: string().min(1),
			probeRetract: string().min(1)
		})
	}),
	holder: holderSchema.nullable(),
	headEnvelope: object({
		radiusMm: finite.positive(),
		source: string().min(1)
	}).optional(),
	rotary: rotarySchema.optional(),
	camera: object({
		port: number().int().positive(),
		path: string().regex(/^\//, "a camera path starts with /"),
		source: string().min(1)
	}).optional()
}).superRefine((profile, ctx) => {
	if (profile.hasATC && profile.toolSlots <= 0) ctx.addIssue({
		code: ZodIssueCode.custom,
		path: ["toolSlots"],
		message: "a machine with a tool changer states its slot count"
	});
	if (!profile.hasATC && profile.toolSlots !== 0) ctx.addIssue({
		code: ZodIssueCode.custom,
		path: ["toolSlots"],
		message: "a manual tool change lists no slots"
	});
});
/**
* A mill model with no controller frame yet (#773): the vendor row, and none of the positions.
* The `frameState` value is the whole point — a profile-shaped object cannot be mistaken for a
* model that carries a frame, and vice versa.
*/
const millModelSchema = object({
	id: string().min(1),
	name: string().min(1),
	process: literal("mill"),
	post: _enum(["z1", "grbl"]).optional(),
	frameState: _enum(["unread", "stated"]),
	workOrigin: _enum(["top-front-left", "top-centre"]).optional(),
	materials: array(_enum(STOCK_MATERIALS)),
	envelope: object({
		x: object({
			min: finite,
			max: finite
		}),
		y: object({
			min: finite,
			max: finite
		}),
		z: object({
			min: finite,
			max: finite
		})
	}),
	maxCutFeed: finite.positive(),
	maxRpm: finite.positive(),
	rapidEstimate: object({
		xyMmPerMin: finite.positive(),
		zMmPerMin: finite.positive(),
		accelMmPerS2: finite.positive(),
		source: string().min(1),
		spinUpSeconds: finite.positive().nullable().optional(),
		spinUpSource: string().min(1).optional(),
		aMaxDegPerMin: finite.positive().optional()
	}),
	spinUpSeconds: finite.positive().nullable().optional(),
	spinUpSource: string().min(1).optional(),
	hasATC: boolean(),
	toolSlots: number().int().nonnegative(),
	rotaryEnvelope: object({
		diameter: finite.positive(),
		length: finite.positive()
	}).optional(),
	sources: object({
		envelope: string().min(1),
		maxCutFeed: string().min(1),
		maxRpm: string().min(1),
		atc: string().min(1),
		rotaryEnvelope: string().min(1).optional()
	})
}).superRefine((model, ctx) => {
	if (model.hasATC && model.toolSlots <= 0) ctx.addIssue({
		code: ZodIssueCode.custom,
		path: ["toolSlots"],
		message: "a machine with a tool changer states its slot count"
	});
	if (!model.hasATC && model.toolSlots !== 0) ctx.addIssue({
		code: ZodIssueCode.custom,
		path: ["toolSlots"],
		message: "a manual tool change lists no slots"
	});
	if (model.post === "grbl" && model.hasATC) ctx.addIssue({
		code: ZodIssueCode.custom,
		path: ["hasATC"],
		message: "a GRBL machine changes tools by hand: Case Maker’s GRBL post writes no tool changer"
	});
});
const printerProfileSchema = object({
	id: string().min(1),
	name: string().min(1),
	process: literal("fdm"),
	buildVolume: object({
		x: finite.positive(),
		y: finite.positive(),
		z: finite.positive()
	}),
	nozzle: finite.positive()
});
/**
* Any machine. A plain union rather than `discriminatedUnion('process')` since #773: two arms are
* mills, and the discriminant that separates them is `frameState` — a framed profile parses first,
* and its required positions are what a model without a frame fails.
*/
const machineSchema = union([
	millProfileSchema,
	millModelSchema,
	printerProfileSchema
]);

// vendor/casemaker/casemaker-app/src/engine/compiler/fasteners.ts
/**
* Why only one machine-screw pilot is measured.
*
* One coupon has been printed and driven: `samples/pilot-coupon-m5.stl`, five
* diameters from 4.0 to 4.8 in both layer orientations. **4.8 held best** — the
* largest of the five, so the optimum is not even bracketed above.
*
* The 0.8 × major rule that suggested 4.0–4.3 is for thread-FORMING screws. A
* 60° metric machine screw at that diameter does not form a thread in PLA, it
* splits the boss: hoop stress rises faster than grip does, and the failure
* mode is the part cracking rather than the thread shearing.
*
* That makes the useful margin an ABSOLUTE one — how much material the screw
* has to displace radially — not a proportional one, so the other sizes are
* extrapolated at the same 0.2 mm. That extrapolation has exactly one data
* point behind it. Below M4 do not trust it without its own coupon: 0.1 mm of
* radial displacement is a far larger fraction of an M3 thread than an M5 one.
* `npm run pilot:coupon -- M3` prints one.
*/
const machinePilot = (major, source = "derived") => ({
	d: Math.round((major - .2) * 100) / 100,
	source
});
const FASTENERS = {
	M2: {
		major: 2,
		pitch: .4,
		minor: 1.567,
		clearance: {
			close: 2.2,
			normal: 2.4,
			free: 2.6
		},
		heads: {
			"socket-cap": {
				d: 3.8,
				h: 2
			},
			button: {
				d: 3.8,
				h: 1.1
			},
			countersunk: {
				d: 3.8,
				h: 1.2
			},
			pan: {
				d: 4,
				h: 1.6
			}
		},
		pilotMachine: machinePilot(2),
		pilotForming: 1.6
	},
	"M2.5": {
		major: 2.5,
		pitch: .45,
		minor: 2.013,
		clearance: {
			close: 2.7,
			normal: 2.9,
			free: 3.1
		},
		heads: {
			"socket-cap": {
				d: 4.5,
				h: 2.5
			},
			button: {
				d: 4.7,
				h: 1.3
			},
			countersunk: {
				d: 4.7,
				h: 1.5
			},
			pan: {
				d: 5,
				h: 2
			}
		},
		pilotMachine: machinePilot(2.5),
		pilotForming: 2
	},
	M3: {
		major: 3,
		pitch: .5,
		minor: 2.459,
		clearance: {
			close: 3.2,
			normal: 3.4,
			free: 3.6
		},
		heads: {
			"socket-cap": {
				d: 5.5,
				h: 3
			},
			button: {
				d: 5.7,
				h: 1.65
			},
			countersunk: {
				d: 6,
				h: 1.86
			},
			pan: {
				d: 5.6,
				h: 2.4
			}
		},
		pilotMachine: machinePilot(3),
		pilotForming: 2.4
	},
	M4: {
		major: 4,
		pitch: .7,
		minor: 3.242,
		clearance: {
			close: 4.3,
			normal: 4.5,
			free: 4.8
		},
		heads: {
			"socket-cap": {
				d: 7,
				h: 4
			},
			button: {
				d: 7.6,
				h: 2.2
			},
			countersunk: {
				d: 8,
				h: 2.48
			},
			pan: {
				d: 7.5,
				h: 3.1
			}
		},
		pilotMachine: machinePilot(4),
		pilotForming: 3.2
	},
	M5: {
		major: 5,
		pitch: .8,
		minor: 4.134,
		clearance: {
			close: 5.3,
			normal: 5.5,
			free: 5.8
		},
		heads: {
			"socket-cap": {
				d: 8.5,
				h: 5
			},
			button: {
				d: 9.5,
				h: 2.75,
				measured: {
					d: 9.2,
					h: 3
				}
			},
			countersunk: {
				d: 10,
				h: 3.1
			},
			pan: {
				d: 9.2,
				h: 3.8
			}
		},
		pilotMachine: machinePilot(5, "coupon"),
		pilotForming: 4
	},
	M6: {
		major: 6,
		pitch: 1,
		minor: 4.917,
		clearance: {
			close: 6.4,
			normal: 6.6,
			free: 7
		},
		heads: {
			"socket-cap": {
				d: 10,
				h: 6
			},
			button: {
				d: 10.5,
				h: 3.3
			},
			countersunk: {
				d: 12,
				h: 3.72
			},
			pan: {
				d: 11,
				h: 4.6
			}
		},
		pilotMachine: machinePilot(6),
		pilotForming: 4.8
	}
};
/**
* CaseMaker's own clearance fit, tighter than ISO 273 close on purpose.
*
* ISO close for M5 is 5.3; this gives 5.2. The tenth matters because these
* holes LOCATE as well as pass — the rack's accessories are held square by the
* screws through the side panels. Where a hole genuinely only has to pass a
* screw, ask for an ISO grade by name instead.
*/
const CLEARANCE_LOCATED_OVER = .2;
/** Diameter clearance added around a head so it drops into its recess. */
const HEAD_FIT = .6;
/** Minimum solid left under a head recess, so it never breaks through. */
const DEFAULT_FLOOR = 1;
/** Overshoot so a cutter punches cleanly through the face it starts on. */
const OVER$3 = .5;
/** Clearance-hole diameter for a size at a grade. */
function clearanceDiameter(size, grade = "located") {
	const spec = FASTENERS[size];
	if (grade === "located") return spec.major + CLEARANCE_LOCATED_OVER;
	return spec.clearance[grade];
}
function head(size, style) {
	const h = FASTENERS[size].heads[style];
	if (!h) throw new Error(`no ${style} head listed for ${size}`);
	return h;
}
/** Head diameter to design against — measured where we have measured. */
function headDiameter(size, style) {
	const h = head(size, style);
	return h.measured?.d ?? h.d;
}
/** Head height to design against — measured where we have measured. */
function headHeight(size, style) {
	const h = head(size, style);
	return h.measured?.h ?? h.h;
}
/** Recess diameter for a head: what it measures, plus a fit. */
function headRecessDiameter(size, style) {
	return Math.round((headDiameter(size, style) + HEAD_FIT) * 100) / 100;
}
/** Starter-hole diameter on the receiving part. */
function pilotDiameter(size, profile = "machine") {
	const spec = FASTENERS[size];
	return profile === "machine" ? spec.pilotMachine.d : spec.pilotForming;
}
/**
* Minimum thread engagement worth asking for, in mm of screw inside the
* receiving part. 2 × major is the usual rule for thermoplastic; below that the
* joint is holding on the first turn or two, which is where a plastic boss
* strips. Advice, not enforcement — a caller with 6 mm of material has 6 mm of
* material — so use it to decide whether to warn.
*/
function minEngagement(size) {
	return 2 * FASTENERS[size].major;
}
/**
* Radial clearance between the modelled thread and the screw.
*
* UNVERIFIED. Nothing has been printed at this figure, unlike the 4.8 pilot
* which a coupon settled. `npm run thread:coupon` prints a ladder of fits for
* exactly this reason, and until one comes back no structural joint should be
* switched from `self-tap` to `pre-threaded`. The last time a diameter here
* moved on arithmetic alone it was heading for a printed part.
*/
const THREAD_FIT = .15;
/**
* Can a modelled thread at this size actually print?
*
* The governing dimension is PITCH, not diameter: the female thread's crest is
* a wedge roughly a quarter-pitch wide at its tip, and below about two nozzle
* widths of pitch there is nothing for the slicer to lay down — the thread
* comes out as a smooth bore with texture on it. M5 (0.8) and M6 (1.0) clear a
* 0.4 nozzle; M4 (0.7) and everything below do not.
*
* This is why `pre-threaded` is an option rather than the default, and why
* asking for it on a small screw quietly gets you `self-tap` instead.
*/
function preThreadPrintable(size, nozzle = ASSUMED_NOZZLE) {
	return FASTENERS[size].pitch >= 2 * nozzle;
}
/** Which receiver a request actually resolves to, once printability is applied. */
function resolveReceiver(size, mode, nozzle = ASSUMED_NOZZLE) {
	return mode === "pre-threaded" && preThreadPrintable(size, nozzle) ? "pre-threaded" : "self-tap";
}
/** ISO 68-1: engaged thread depth is 5H/8 = 0.5413 × pitch. */
const ISO_DEPTH_FACTOR = .5413;
const TAN30 = Math.tan(Math.PI / 6);
/** Facets per turn of the helix. 24 measured indistinguishable from 32. */
const DEFAULT_THREAD_SEGMENTS = 24;
/**
* The solid a screw occupies — core plus helical ridge — to be SUBTRACTED from
* the receiving part. Runs along +z from z = 0.
*
* Subtracting the screw's own shape is what leaves a matching female thread:
* the tool's core takes the bore out to the minor diameter and the tool's ridge
* takes the groove, so the material left standing between successive turns of
* that ridge IS the female thread.
*
* Built as a twist extrusion, which needs no new primitive — `extrude` already
* carries `twistDegrees`, so a 2D profile of "circle at the minor radius, plus
* one tooth" traced through 360° per pitch sweeps the whole thread in one op.
* The tooth is drawn in POLAR form, angle standing for axial position at 360°
* per pitch, which is what makes the 60° flank exact rather than approximated:
* an axial half-width w at radius r is drawn at ±360 × w / pitch degrees.
*
* Handedness: `twistDegrees` POSITIVE gives a right-hand thread. A left-hand
* one passes every volume and bounding-box check ever written and is useless,
* so that sign is pinned by test, not by argument.
*/
function threadTool(size, length, opts = {}) {
	const { major, pitch } = FASTENERS[size];
	const fit = opts.fit ?? .15;
	const depthFactor = opts.depthFactor ?? ISO_DEPTH_FACTOR;
	const seg = opts.segmentsPerTurn ?? DEFAULT_THREAD_SEGMENTS;
	const rMaj = major / 2 + fit;
	const rMin = rMaj - depthFactor * pitch;
	const turns = length / pitch;
	const halfWidth = (r) => pitch / 16 + (rMaj - r) * TAN30;
	const steps = 6;
	const front = [];
	const back = [];
	for (let i = 0; i <= steps; i++) {
		const r = rMin + (rMaj - rMin) * i / steps;
		const a = Math.min(2 * Math.PI * halfWidth(r) / pitch, 170 * Math.PI / 180);
		front.push([r * Math.cos(a), r * Math.sin(a)]);
		back.push([r * Math.cos(-a), r * Math.sin(-a)]);
	}
	const tooth = poly([...front, ...back.reverse()]);
	const profile = pUnion([circleProfile(rMin, Math.max(24, seg)), tooth]);
	const helix = extrude(profile, length, {
		twistDegrees: 360 * turns,
		divisions: Math.max(2, Math.ceil(turns * seg))
	});
	if (opts.leadIn === false) return helix;
	return union$1([helix, {
		kind: "cylinder",
		height: pitch,
		radiusLow: rMaj,
		radiusHigh: rMin,
		segments: Math.max(24, seg)
	}]);
}
/**
* Rotate a +z-built feature so it runs along `axis`, then place it at `at`.
* Sign matters here in a way it does not for `axisCylinder`: a screw hole is
* directional, because the head is at one end of it.
*/
function orient(axis, op) {
	switch (axis) {
		case "+z": return op;
		case "-z": return rotate([
			180,
			0,
			0
		], op);
		case "+x": return rotate([
			0,
			90,
			0
		], op);
		case "-x": return rotate([
			0,
			-90,
			0
		], op);
		case "+y": return rotate([
			-90,
			0,
			0
		], op);
		case "-y": return rotate([
			90,
			0,
			0
		], op);
	}
}
/**
* Head recess + clearance hole, as one cutting op.
*
* The recess is always cut FROM the entry face — it is where the head sits, and
* the head is at the end the screw goes in. Which way the part prints is not
* this function's business: a counterbore whose ceiling faces down is a bridge,
* and only the caller knows which way up its part goes on the bed
* (`exportLayout`'s `PRINT_FLIP_NODE_IDS` is where that lives).
*/
function screwHole(o) {
	const seg = o.segments ?? 32;
	const rseg = o.recessSegments ?? seg;
	const style = o.head ?? "none";
	const clearD = o.clearanceD ?? clearanceDiameter(o.size, o.grade ?? "located");
	const cuts = [translate([
		0,
		0,
		-.5
	], cylinder(o.through + 2 * OVER$3, clearD / 2, seg))];
	if (style !== "none" && o.recess !== void 0 && o.recess !== "none") {
		const recessD = o.headD ?? headRecessDiameter(o.size, style);
		const floor = o.floor ?? DEFAULT_FLOOR;
		const limit = o.material !== void 0 ? Math.max(0, o.material - floor) : Infinity;
		if (style === "countersunk") {
			const coneDepth = Math.min((recessD - clearD) / 2, limit);
			if (coneDepth > 0) cuts.push(translate([
				0,
				0,
				-.5
			], {
				kind: "cylinder",
				height: coneDepth + OVER$3,
				radiusLow: clearD / 2 + coneDepth + OVER$3,
				radiusHigh: clearD / 2,
				segments: rseg
			}));
		} else {
			const wanted = o.recess === "flush" ? headHeight(o.size, style) : o.recess;
			const depth = Math.min(wanted, limit);
			if (depth > 0) cuts.push(translate([
				0,
				0,
				-.5
			], cylinder(depth + OVER$3, recessD / 2, rseg)));
		}
	}
	return translate(o.at, orient(o.axis ?? "+z", union$1(cuts)));
}
/**
* The receiving hole — the half of a screw joint that HOLDS.
*
* `self-tap` cuts a plain starter hole at the pilot diameter. `pre-threaded`
* subtracts a modelled thread instead, but falls back to `self-tap` wherever
* the pitch is too fine to print (see {@link preThreadPrintable}). That
* fallback is deliberate and not a nicety: a thread that fails to print is a
* smooth bore at the MAJOR diameter, which holds nothing at all — far worse
* than the starter hole it replaced. Callers that want to say so out loud
* should ask {@link resolveReceiver} first.
*/
function screwStarter(o) {
	const seg = o.segments ?? 24;
	const body = resolveReceiver(o.size, o.mode ?? "self-tap") === "pre-threaded" ? threadTool(o.size, o.depth + OVER$3, o.thread) : cylinder(o.depth + OVER$3, (o.pilotD ?? pilotDiameter(o.size, o.profile ?? "machine")) / 2, seg);
	return translate(o.at, orient(o.axis ?? "+z", translate([
		0,
		0,
		-.5
	], body)));
}
/** The pocket table. Every row is PROVISIONAL — see the note above. */
const MAGNETS = {
	"6x2": {
		d: 6,
		h: 2,
		pocket: {
			d: 6.5,
			h: 2.4
		},
		source: "derived"
	},
	"6x3": {
		d: 6,
		h: 3,
		pocket: {
			d: 6.5,
			h: 3.4
		},
		source: "derived"
	},
	"8x2": {
		d: 8,
		h: 2,
		pocket: {
			d: 8.5,
			h: 2.4
		},
		source: "derived"
	},
	"8x3": {
		d: 8,
		h: 3,
		pocket: {
			d: 8.5,
			h: 3.4
		},
		source: "derived"
	},
	"10x2": {
		d: 10,
		h: 2,
		pocket: {
			d: 10.5,
			h: 2.4
		},
		source: "derived"
	},
	"10x3": {
		d: 10,
		h: 3,
		pocket: {
			d: 10.5,
			h: 3.4
		},
		source: "derived"
	},
	"12x3": {
		d: 12,
		h: 3,
		pocket: {
			d: 12.5,
			h: 3.4
		},
		source: "derived"
	}
};
/**
* Diametral clearance of a PRESS pocket: disc Ø + 0.1. PROVISIONAL, and the
* reason is the printer, not the magnet: FDM holes print ~0.1–0.2 mm under
* their nominal Ø (the M5 pilot, #140, printed 4.8 to hold an M5), so a pocket
* modelled 0.1 over the disc lands as a light interference. The magnet coupon
* ladders −0.25 → +1.25 around the glue fit, so it brackets this number too.
*/
const MAGNET_PRESS_CLEARANCE = .1;
/** Pocket Ø for a retention: press = disc + `MAGNET_PRESS_CLEARANCE`; glue and
*  captured = the table's glue fit (a captured disc only has to drop in). */
function magnetPocketDiameterForRetention(size, retention = "glue") {
	const spec = MAGNETS[size];
	if (retention === "press") return Math.round((spec.d + MAGNET_PRESS_CLEARANCE) * 100) / 100;
	return spec.pocket.d;
}
/**
* Print-in-place capture (`retention: 'captured'`): the skin left between the
* entry face and the pocket, mm. 0.6 = three 0.2 mm layers, the usual minimum
* for a closed, non-porous printed surface. PROVISIONAL like the table: it has
* not been printed over a magnet here.
*/
const MAGNET_CAPTURE_SKIN = .6;
/** Layer height the pause heights are stated against, mm. */
const MAGNET_PAUSE_LAYER = .2;
/**
* Where to pause a print to drop a magnet into a captured pocket, for a part
* that prints with the pocket's ENTRY face on the bed (the case floor; the lid,
* which prints flipped): the skin, then the pocket's full depth, rounded UP to
* a whole layer. Pause after the layer that finishes at this Z, before the one
* that roofs the pocket.
*/
function magnetCapturePauseZ(size, skin = MAGNET_CAPTURE_SKIN, layer = MAGNET_PAUSE_LAYER, depth = MAGNETS[size].pocket.h) {
	const top = skin + depth;
	return Math.round(Math.ceil(top / layer - 1e-6) * layer * 100) / 100;
}
/** Pocket depth for a size at the table's glue fit, mm. */
function magnetPocketDepth(size) {
	return MAGNETS[size].pocket.h;
}
/**
* The blind pocket a disc magnet sits in — a cutting op to SUBTRACT.
*
* Unlike `screwHole`, there is no head/recess distinction: a magnet pocket is
* one cylinder and its whole job is to hold the disc. What it does share with
* `screwHole` is that the floor under it is a PRINT-ORIENTATION question, not
* this function's business: a pocket whose ceiling faces down is a bridge, and
* only the caller knows which way its part prints (see `exportLayout`'s
* `PRINT_FLIP_NODE_IDS`). A thin `floor` (below a couple of layers) is only
* sensible as a print-in-place capture membrane for exactly that reason.
*/
function magnetPocket(o) {
	const spec = MAGNETS[o.size];
	const seg = o.segments ?? 32;
	const d = o.diameter ?? spec.pocket.d;
	const floor = o.floor ?? DEFAULT_FLOOR;
	const skin = Math.max(0, o.skin ?? 0);
	const limit = o.material !== void 0 ? Math.max(0, o.material - floor - skin) : Infinity;
	const depth = Math.min(o.depth ?? spec.pocket.h, limit);
	if (depth <= 0) throw new Error(`magnetPocket: no room for a ${o.size} pocket — ${o.material} mm of material leaves less than the ${floor} mm floor`);
	const body = skin > 0 ? translate([
		0,
		0,
		skin
	], cylinder(depth, d / 2, seg)) : translate([
		0,
		0,
		-.5
	], cylinder(depth + OVER$3, d / 2, seg));
	return translate(o.at, orient(o.axis ?? "+z", body));
}
/**
* A solid cylinder around a pocket, to ADD where the material is thinner than
* the pocket needs (a 2 mm case wall under a 3.4 mm pocket). Runs from `start`
* to `start + length` along `axis` from `at` — the same frame as
* `magnetPocket`, so the two line up by construction.
*/
function magnetPocketBoss(o) {
	const body = translate([
		0,
		0,
		o.start
	], cylinder(o.length, o.diameter / 2, o.segments ?? 32));
	return translate(o.at, orient(o.axis, body));
}

// vendor/casemaker/casemaker-app/src/engine/compiler/mountingFeatures.ts
const NO_RESOLVE_DISPLAY$7 = () => void 0;
function num(params, key, fallback) {
	const v = params[key];
	return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
/**
* Generate a flanged screw tab extending outward from the chosen face with a
* single through-hole. The tab is positioned by (u, v) in the face's local
* frame.
*/
function generateScrewTab(feature, frame) {
	const tabLength = num(feature.params, "tabLength", 12);
	const tabWidth = num(feature.params, "tabWidth", 14);
	const tabThickness = num(feature.params, "tabThickness", 3);
	const holeDiameter = num(feature.params, "holeDiameter", 4.2);
	const outerLetter = frame.outwardLetter;
	const sx = outerLetter === "x" ? tabThickness : tabWidth;
	const sy = outerLetter === "y" ? tabThickness : outerLetter === "x" ? tabLength : tabWidth;
	const sz = outerLetter === "z" ? tabThickness : tabLength;
	const slab = cube([
		sx,
		sy,
		sz
	], false);
	const centerWorld = [
		frame.origin[0] + frame.uAxis[0] * feature.position.u + frame.vAxis[0] * feature.position.v,
		frame.origin[1] + frame.uAxis[1] * feature.position.u + frame.vAxis[1] * feature.position.v,
		frame.origin[2] + frame.uAxis[2] * feature.position.u + frame.vAxis[2] * feature.position.v
	];
	const slabPos = [
		centerWorld[0] - sx / 2,
		centerWorld[1] - sy / 2,
		centerWorld[2] - sz / 2
	];
	if (outerLetter === "x") slabPos[0] = centerWorld[0] + (frame.outwardSign === 1 ? 0 : -tabThickness);
	else if (outerLetter === "y") slabPos[1] = centerWorld[1] + (frame.outwardSign === 1 ? 0 : -tabThickness);
	else slabPos[2] = centerWorld[2] + (frame.outwardSign === 1 ? 0 : -tabThickness);
	const holeLength = tabThickness + .4;
	const holeRadius = holeDiameter / 2;
	const baseCyl = cylinder(holeLength, holeRadius, 24);
	let oriented = baseCyl;
	if (outerLetter === "x") oriented = rotate([
		0,
		frame.outwardSign === 1 ? 90 : -90,
		0
	], baseCyl);
	else if (outerLetter === "y") oriented = rotate([
		-frame.outwardSign * 90,
		0,
		0
	], baseCyl);
	else if (frame.outwardSign === -1) oriented = rotate([
		180,
		0,
		0
	], baseCyl);
	const holeStart = [
		centerWorld[0],
		centerWorld[1],
		centerWorld[2]
	];
	if (outerLetter === "x") holeStart[0] = centerWorld[0] - frame.outwardSign * .2;
	else if (outerLetter === "y") holeStart[1] = centerWorld[1] - frame.outwardSign * .2;
	else holeStart[2] = centerWorld[2] - frame.outwardSign * .2;
	return {
		additive: [translate(slabPos, slab)],
		subtractive: [translate(holeStart, oriented)]
	};
}
function generateZipTieSlot(feature, frame) {
	const slotLength = num(feature.params, "slotLength", 15);
	const slotWidth = num(feature.params, "slotWidth", 4);
	const wall = num(feature.params, "wallThickness", 2);
	const slot = cube([
		slotLength,
		slotWidth,
		wall + 2
	], false);
	const ux = frame.uAxis[0] * feature.position.u;
	const uy = frame.uAxis[1] * feature.position.u;
	const uz = frame.uAxis[2] * feature.position.u;
	const vx = frame.vAxis[0] * feature.position.v;
	const vy = frame.vAxis[1] * feature.position.v;
	const vz = frame.vAxis[2] * feature.position.v;
	const slotPos = [
		frame.origin[0] + ux + vx - slotLength / 2,
		frame.origin[1] + uy + vy - slotWidth / 2,
		frame.origin[2] + uz + vz - 1
	];
	return {
		additive: [],
		subtractive: [translate(slotPos, slot)]
	};
}
function generateVesaMount(feature, frame) {
	const pattern = num(feature.params, "patternSize", 75);
	const holeDiameter = num(feature.params, "holeDiameter", 5);
	const subs = [];
	const half = pattern / 2;
	const offsets = [
		[-half, -half],
		[half, -half],
		[-half, half],
		[half, half]
	];
	const holeRadius = holeDiameter / 2;
	const holeLength = 20;
	for (const [du, dv] of offsets) {
		const u = feature.position.u + du;
		const v = feature.position.v + dv;
		const ux = frame.uAxis[0] * u;
		const uy = frame.uAxis[1] * u;
		const uz = frame.uAxis[2] * u;
		const vx = frame.vAxis[0] * v;
		const vy = frame.vAxis[1] * v;
		const vz = frame.vAxis[2] * v;
		const outward = frame.outwardAxis;
		const facing = outward[2] === 1 ? "+z" : outward[2] === -1 ? "-z" : outward[1] === 1 ? "+y" : outward[1] === -1 ? "-y" : outward[0] === 1 ? "+x" : "-x";
		const hole = facing === "-z" ? cylinder(holeLength, holeRadius, 24) : axisCylinder(facing, holeLength, holeRadius, 24);
		const cx = frame.origin[0] + ux + vx - outward[0] * holeLength / 2;
		const cy = frame.origin[1] + uy + vy - outward[1] * holeLength / 2;
		const cz = frame.origin[2] + uz + vz - outward[2] * holeLength / 2;
		subs.push(translate([
			cx,
			cy,
			cz
		], hole));
	}
	return {
		additive: [],
		subtractive: subs
	};
}
/** The `Facing` an axis-aligned unit vector points along. */
function facingOf(v) {
	if (v[0] !== 0) return v[0] > 0 ? "+x" : "-x";
	if (v[1] !== 0) return v[1] > 0 ? "+y" : "-y";
	return v[2] > 0 ? "+z" : "-z";
}
/**
* Issue #151 — bolt holes for a T-nut captive in 20-series T-slot extrusion.
*
* The extrusion's slotted face lies flat against the case wall, which fixes the
* order of the joint and is worth stating plainly: the nut is captive in the
* slot OUTSIDE the wall, the screw comes from INSIDE the case, and a
* counterbored head therefore seats on the wall's INNER face. That is not an
* arbitrary choice — with the extrusion on the outside there is nowhere else
* for the head to go. It makes this a bench joint: base onto the frame first,
* board and lid after. Being a through-hole in a wall the user picks, it
* composes with any archetype that has walls.
*
* `count` holes lie on a line along one in-plane axis (`along`, default u) at
* `pitch`. One slot takes any spacing along it; a wide (2040/2060) face used
* across its slots wants `pitch` = {@link TSLOT_20_PITCH}, one bolt per slot
* line. Which of the two the user has is not something the feature can infer —
* the same 20 mm pair is "two bolts down one slot" on a 2020 and "a bolt in
* each slot" on a 2040.
*
* The counterbore is OFF by default and that default is the point:
*
*   • A plain clearance hole is symmetric, so it is right however the user ends
*     up assembling, and it costs no material and cuts nothing that prints as a
*     bridge.
*   • A flush button head wants its full 3.0 mm of head height, which a case
*     wall does not have. `screwHole` clamps the cut to `wallThickness − floor`
*     when it is handed `material`, so asking for flush on a thin wall leaves
*     the head PROUD rather than punching through the wall — a shallower seat
*     than asked for, never a hole in the part.
*   • On a downward-facing inner face that seat is a bridge. The panel says so;
*     the user asks for it knowingly.
*/
function generateExtrusionMount(feature, frame, caseParams) {
	const count = Math.max(1, Math.round(num(feature.params, "count", 2)));
	const pitch = Math.max(0, num(feature.params, "pitch", 20));
	const along = feature.params.along === "v" ? "v" : "u";
	const flush = num(feature.params, "flush", 0) !== 0;
	const wall = caseParams.wallThickness;
	const outward = facingOf(frame.outwardAxis);
	const subs = [];
	for (let i = 0; i < count; i++) {
		const offset = (i - (count - 1) / 2) * pitch;
		const u = along === "u" ? feature.position.u + offset : feature.position.u;
		const v = along === "v" ? feature.position.v + offset : feature.position.v;
		subs.push(screwHole({
			size: "M5",
			at: placeOnFace(frame, u, v, -wall),
			axis: outward,
			through: wall + 1,
			head: "button",
			recess: flush ? "flush" : "none",
			material: wall
		}));
	}
	return {
		additive: [],
		subtractive: subs
	};
}
function buildMountingFeatureOps(features, board, params, hats = [], resolveHat = () => void 0, display = null, resolveDisplay = NO_RESOLVE_DISPLAY$7) {
	const out = {
		additive: [],
		subtractive: []
	};
	if (!features || features.length === 0) return out;
	const dims = computeShellDims(board, params, hats, resolveHat, display, resolveDisplay);
	for (const feature of features) {
		if (!feature.enabled) continue;
		const frame = faceFrame(feature.face, dims.outerX, dims.outerY, dims.outerZ);
		let group;
		switch (feature.type) {
			case "screw-tab":
				group = generateScrewTab(feature, frame);
				break;
			case "end-flange":
				group = generateEndFlange(feature, frame, params);
				break;
			case "zip-tie-slot":
				group = generateZipTieSlot(feature, frame);
				break;
			case "vesa-mount":
				group = generateVesaMount(feature, frame);
				break;
			case "extrusion-mount":
				group = generateExtrusionMount(feature, frame, params);
				break;
			case "aligned-standoff":
			case "saddle": continue;
			default: continue;
		}
		out.additive.push(...group.additive);
		out.subtractive.push(...group.subtractive);
	}
	return out;
}
/**
* Hammond-style end-flange: rounded outboard end + reinforcing rib + M3
* clearance hole (issue #80). The flange is a horizontal plate that
* projects laterally from a side wall (±x or ±y); the rounded outboard
* end is a half-disc tangent to the rectangular plate body.
*
* Geometry assumptions:
*   • Wall is vertical (±x or ±y) — the plate top/bottom faces are
*     parallel to the wall's u-axis × outward-normal plane.
*   • Plate thickness extends along the face's v-axis (vertical).
*   • Bolt hole is parallel to v (the plate's thickness axis).
*
* For ±z faces the plate would be a vertical fin that doesn't make
* mechanical sense; falls back to an empty op group there.
*/
function generateEndFlange(feature, frame, caseParams) {
	if (frame.outwardLetter === "z") return {
		additive: [],
		subtractive: []
	};
	const projection = num(feature.params, "projection", 12);
	const width = num(feature.params, "width", 12);
	const thickness = num(feature.params, "thickness", Math.max(3, caseParams.wallThickness));
	const holeDiameter = num(feature.params, "holeDiameter", 3.4);
	const rectLen = projection - width / 2;
	frame.outwardLetter;
	frame.outwardSign;
	function worldSize(uVal, nVal, vVal) {
		return [
			Math.abs(frame.uAxis[0]) * uVal + Math.abs(frame.outwardAxis[0]) * nVal + Math.abs(frame.vAxis[0]) * vVal,
			Math.abs(frame.uAxis[1]) * uVal + Math.abs(frame.outwardAxis[1]) * nVal + Math.abs(frame.vAxis[1]) * vVal,
			Math.abs(frame.uAxis[2]) * uVal + Math.abs(frame.outwardAxis[2]) * nVal + Math.abs(frame.vAxis[2]) * vVal
		];
	}
	const vAnchor = thickness / 2;
	function localToWorld(uOff, nOff, vOff) {
		return [
			frame.origin[0] + frame.uAxis[0] * (feature.position.u + uOff) + frame.vAxis[0] * (vAnchor + vOff) + frame.outwardAxis[0] * nOff,
			frame.origin[1] + frame.uAxis[1] * (feature.position.u + uOff) + frame.vAxis[1] * (vAnchor + vOff) + frame.outwardAxis[1] * nOff,
			frame.origin[2] + frame.uAxis[2] * (feature.position.u + uOff) + frame.vAxis[2] * (vAnchor + vOff) + frame.outwardAxis[2] * nOff
		];
	}
	const rectSize = worldSize(width, rectLen, thickness);
	const rectCenter = localToWorld(0, rectLen / 2, 0);
	const rectCorner = [
		rectCenter[0] - rectSize[0] / 2,
		rectCenter[1] - rectSize[1] / 2,
		rectCenter[2] - rectSize[2] / 2
	];
	const rect = translate(rectCorner, cube(rectSize, false));
	const capRadius = width / 2;
	const capCyl = cylinder(thickness, capRadius, 32);
	const capCenter = localToWorld(0, rectLen, 0);
	capCenter[0] - capRadius - (frame.vAxis[0] !== 0 ? -capRadius : 0), capCenter[1] - capRadius - (frame.vAxis[1] !== 0 ? -capRadius : 0), capCenter[2];
	const capPos = [
		capCenter[0],
		capCenter[1],
		capCenter[2] - thickness / 2
	];
	const cap = translate(capPos, capCyl);
	const holeLen = thickness + .4;
	const hole = cylinder(holeLen, holeDiameter / 2, 24);
	const holePos = [
		capCenter[0],
		capCenter[1],
		capCenter[2] - holeLen / 2
	];
	const ribEnabled = num(feature.params, "ribEnabled", 1) !== 0;
	const additive = [rect, cap];
	if (ribEnabled) {
		const ribL = num(feature.params, "ribLength", projection * .7);
		const ribH = num(feature.params, "ribHeight", projection * .5);
		const ribT = num(feature.params, "ribThickness", Math.max(2, caseParams.wallThickness));
		const RIB_HOLE_CLEARANCE = .5;
		const uMin = holeDiameter / 2 + RIB_HOLE_CLEARANCE + ribT / 2;
		const uMax = width / 2 - ribT / 2;
		if (uMax >= uMin) {
			const uCenter = (uMin + uMax) / 2;
			additive.push(buildRibGusset(frame, feature, +uCenter, ribL, ribH, ribT, thickness));
			additive.push(buildRibGusset(frame, feature, -uCenter, ribL, ribH, ribT, thickness));
		} else if (width / 2 - ribT / 2 >= holeDiameter / 2 + RIB_HOLE_CLEARANCE + ribT / 2) {
			const uCenter = (uMin + width / 2 - ribT / 2) / 2;
			additive.push(buildRibGusset(frame, feature, +uCenter, ribL, ribH, ribT, thickness));
		}
	}
	return {
		additive,
		subtractive: [translate(holePos, hole)]
	};
}
/**
* Triangular-prism reinforcing rib that sits on top of the end-flange plate
* and leans against the wall. Issue #80 — stiffens the flange against bolt
* torque, mirroring the gusset on commercial enclosures (Hammond / Polycase).
*/
function buildRibGusset(frame, feature, uCenter, ribLength, ribHeight, ribThickness, plateThickness) {
	const vTop = plateThickness / 2;
	const tu = ribThickness / 2;
	const positions = [];
	const vAnchor = plateThickness / 2;
	function pushVert(uOff, nOff, vOff) {
		positions.push(frame.origin[0] + frame.uAxis[0] * (feature.position.u + uCenter + uOff) + frame.outwardAxis[0] * nOff + frame.vAxis[0] * (vAnchor + vOff), frame.origin[1] + frame.uAxis[1] * (feature.position.u + uCenter + uOff) + frame.outwardAxis[1] * nOff + frame.vAxis[1] * (vAnchor + vOff), frame.origin[2] + frame.uAxis[2] * (feature.position.u + uCenter + uOff) + frame.outwardAxis[2] * nOff + frame.vAxis[2] * (vAnchor + vOff));
	}
	pushVert(-tu, 0, vTop);
	pushVert(-tu, ribLength, vTop);
	pushVert(-tu, 0, vTop + ribHeight);
	pushVert(+tu, 0, vTop);
	pushVert(+tu, ribLength, vTop);
	pushVert(+tu, 0, vTop + ribHeight);
	return mesh(new Float32Array(positions), new Uint32Array([
		0,
		2,
		1,
		3,
		4,
		5,
		0,
		3,
		5,
		0,
		5,
		2,
		0,
		1,
		4,
		0,
		4,
		3,
		1,
		2,
		5,
		1,
		5,
		4
	]));
}

// vendor/casemaker/casemaker-app/src/engine/compiler/displays.ts
const NO_HATS$4 = [];
const NO_RESOLVE$4 = () => void 0;
/**
* Build the window cutout in the case top for the display's active area.
* Supported framings in this slice: 'top-window' and 'recessed-bezel'.
*/
function buildDisplayCutoutOps(board, params, placement, resolveDisplay, hats = NO_HATS$4, resolveHat = NO_RESOLVE$4) {
	if (!placement || !placement.enabled) return {
		additive: [],
		subtractive: []
	};
	const profile = resolveDisplay(placement.displayId);
	if (!profile) return {
		additive: [],
		subtractive: []
	};
	const dims = computeShellDims(board, params, hats, resolveHat);
	const origin = cavityOriginXY(params);
	const hostBaseX = origin.x + (placement.offset?.x ?? 0);
	const hostBaseY = origin.y + (placement.offset?.y ?? 0);
	const aaX = hostBaseX + profile.activeArea.offsetX;
	const aaY = hostBaseY + profile.activeArea.offsetY;
	const subtractive = [];
	const additive = [];
	if (placement.framing === "top-window" || placement.framing === "recessed-bezel") {
		const windowZBase = dims.outerZ - params.lidThickness - 1;
		const windowZSpan = params.lidThickness + 2;
		subtractive.push(translate([
			aaX,
			aaY,
			windowZBase
		], cube([
			profile.activeArea.x,
			profile.activeArea.y,
			windowZSpan
		], false)));
	}
	if (placement.framing === "recessed-bezel") {
		const inset = placement.bezelInset ?? .4;
		const pocketX = profile.pcb.size.x + 2 * inset;
		const pocketY = profile.pcb.size.y + 2 * inset;
		const pocketZ = profile.pcb.size.z + .5;
		const pocketBaseX = hostBaseX - inset;
		const pocketBaseY = hostBaseY - inset;
		const pocketBaseZ = dims.outerZ - pocketZ;
		subtractive.push(translate([
			pocketBaseX,
			pocketBaseY,
			pocketBaseZ
		], cube([
			pocketX,
			pocketY,
			pocketZ + .5
		], false)));
	}
	return {
		additive,
		subtractive
	};
}

// vendor/casemaker/casemaker-app/src/types/fan.ts
const FAN_SPECS$1 = {
	"30x30x10": {
		size: "30x30x10",
		faceMm: 30,
		depthMm: 10,
		screwSpacingMm: 24,
		screwHoleMm: 3.2,
		bladeRadiusMm: 13
	},
	"40x40x10": {
		size: "40x40x10",
		faceMm: 40,
		depthMm: 10,
		screwSpacingMm: 32,
		screwHoleMm: 3.2,
		bladeRadiusMm: 18
	},
	"40x40x20": {
		size: "40x40x20",
		faceMm: 40,
		depthMm: 20,
		screwSpacingMm: 32,
		screwHoleMm: 3.2,
		bladeRadiusMm: 18
	},
	"50x50x10": {
		size: "50x50x10",
		faceMm: 50,
		depthMm: 10,
		screwSpacingMm: 40,
		screwHoleMm: 3.2,
		bladeRadiusMm: 23
	},
	"60x60x15": {
		size: "60x60x15",
		faceMm: 60,
		depthMm: 15,
		screwSpacingMm: 50,
		screwHoleMm: 3.2,
		bladeRadiusMm: 28
	}
};

// vendor/casemaker/casemaker-app/src/engine/compiler/fans.ts
const NO_RESOLVE_DISPLAY$6 = () => void 0;
function generateGrille(spec, grille) {
	const r = spec.bladeRadiusMm;
	const segments = 48;
	switch (grille) {
		case "open": return [cylinder(spec.depthMm + 4, r, segments)];
		case "cross": {
			const opening = cylinder(spec.depthMm + 4, r, segments);
			const barWidth = 1.6;
			const bar1 = translate([
				-r,
				-1.6 / 2,
				-1
			], cube([
				2 * r,
				barWidth,
				spec.depthMm + 4
			]));
			const bar2 = translate([
				-1.6 / 2,
				-r,
				-1
			], cube([
				barWidth,
				2 * r,
				spec.depthMm + 4
			]));
			return [difference([
				opening,
				bar1,
				bar2
			])];
		}
		case "concentric": {
			const opening = cylinder(spec.depthMm + 4, r, segments);
			const ringWidth = 1.5;
			const rings = [];
			const innerR = r * .45;
			const midR = r * .7;
			rings.push(cylinder(spec.depthMm + 4, innerR + ringWidth, segments));
			rings.push(cylinder(spec.depthMm + 4, innerR, segments));
			rings.push(cylinder(spec.depthMm + 4, midR + ringWidth, segments));
			rings.push(cylinder(spec.depthMm + 4, midR, segments));
			return [difference([
				opening,
				difference([cylinder(spec.depthMm + 4, innerR + ringWidth, segments), cylinder(spec.depthMm + 4, innerR, segments)]),
				difference([cylinder(spec.depthMm + 4, midR + ringWidth, segments), cylinder(spec.depthMm + 4, midR, segments)])
			])];
		}
		case "honeycomb": {
			const hexR = 2;
			const pitchX = 4.6;
			const pitchY = Math.sqrt(3) * hexR + .6;
			const cols = Math.floor(2 * r / pitchX);
			const rows = Math.floor(2 * r / pitchY);
			const holes = [];
			for (let row = 0; row < rows; row++) {
				const yOff = -r + (row + .5) * pitchY;
				for (let col = 0; col < cols; col++) {
					const xOff = -r + (col + .5) * pitchX + (row % 2 === 0 ? 0 : pitchX / 2);
					if (Math.hypot(xOff, yOff) > r - hexR) continue;
					holes.push(translate([
						xOff,
						yOff,
						-1
					], cylinder(spec.depthMm + 4, hexR, 6)));
				}
			}
			return holes;
		}
		case "spiral": return [difference([
			cylinder(spec.depthMm + 4, r, segments),
			translate([
				-r,
				-1,
				-1
			], cube([
				2 * r,
				2,
				spec.depthMm + 4
			])),
			translate([
				-1,
				-r,
				-1
			], cube([
				2,
				2 * r,
				spec.depthMm + 4
			]))
		])];
	}
}
function buildFanMountOps(fans, board, params, hats = [], resolveHat = () => void 0, display = null, resolveDisplay = NO_RESOLVE_DISPLAY$6) {
	const out = {
		additive: [],
		subtractive: []
	};
	if (!fans || fans.length === 0) return out;
	const dims = computeShellDims(board, params, hats, resolveHat, display, resolveDisplay);
	for (const fan of fans) {
		if (!fan.enabled) continue;
		const spec = FAN_SPECS$1[fan.size];
		if (!spec) continue;
		const frame = faceFrame(fan.face, dims.outerX, dims.outerY, dims.outerZ);
		const [cx, cy, cz] = placeOnFace(frame, fan.position.u, fan.position.v);
		if (fan.face !== "+z" && fan.face !== "-z") {
			const opening = cylinder(spec.depthMm + 6, spec.bladeRadiusMm, 48);
			out.subtractive.push(translate([
				cx,
				cy,
				cz
			], opening));
			continue;
		}
		const grilleOps = generateGrille(spec, fan.grille);
		const baseZ = fan.face === "+z" ? cz - spec.depthMm - 1 : cz - 1;
		for (const op of grilleOps) out.subtractive.push(translate([
			cx,
			cy,
			baseZ
		], op));
		if (fan.bossesEnabled) {
			const half = spec.screwSpacingMm / 2;
			for (const [du, dv] of [
				[-half, -half],
				[half, -half],
				[-half, half],
				[half, half]
			]) {
				const sx = cx + du;
				const sy = cy + dv;
				const screwHole = cylinder(spec.depthMm + 4, spec.screwHoleMm / 2, 24);
				out.subtractive.push(translate([
					sx,
					sy,
					baseZ
				], screwHole));
			}
		}
	}
	return out;
}

// vendor/casemaker/casemaker-app/src/engine/compiler/curveFlatten.ts
/**
* Curve subdivision shared by every place that flattens a quadratic or cubic Bezier to a
* chord polyline (#217). Extracted verbatim from `glyphs.ts`, which had the only copy: the
* SVG outline importer needs the SAME subdivision counts so a traced logo flattens the way
* a glyph does, and "extract rather than duplicate" is the issue's instruction.
*
* The error model is the same the glyph rasteriser used: a quadratic's maximum deviation
* from its chord is |p0 − 2p1 + p2| / 4 and the polyline error shrinks as 1/n²; a cubic's
* second derivative is bounded by 6·max(|p0 − 2p1 + p2|, |p1 − 2p2 + p3|) and its error is
* bounded by max|B''| / (8n²). Both round the segment count UP, never below 1.
*
* The TOLERANCE is NOT here: it is `GLYPH_CHORD_TOLERANCE_MM` in `glyphs.ts`, kept there
* because /Fabrication.md and the glyph pipeline name it, and a caller in a different
* coordinate space divides it by that space's scale before passing it in.
*/
/** Subdivisions needed so a quadratic stays within `tol` of its chord polyline. */
function quadSegments(p0, p1, p2, tol) {
	const dev = Math.hypot(p0[0] - 2 * p1[0] + p2[0], p0[1] - 2 * p1[1] + p2[1]) / 4;
	return Math.max(1, Math.ceil(Math.sqrt(dev / tol)));
}
/** Same idea for a cubic: |B''| <= 6 * max(|p0-2p1+p2|, |p1-2p2+p3|), error <= max|B''| / (8 n^2). */
function cubicSegments(p0, p1, p2, p3, tol) {
	const d1 = Math.hypot(p0[0] - 2 * p1[0] + p2[0], p0[1] - 2 * p1[1] + p2[1]);
	const d2 = Math.hypot(p1[0] - 2 * p2[0] + p3[0], p1[1] - 2 * p2[1] + p3[1]);
	const dev = 3 / 4 * Math.max(d1, d2);
	return Math.max(1, Math.ceil(Math.sqrt(dev / tol)));
}
/**
* The points along a quadratic from `p0` to `p2`, EXCLUDING `p0` and INCLUDING `p2`,
* flattened within `tol` of the true curve. This is the loop `glyphs.ts` used inline.
*/
function flattenQuadratic(p0, p1, p2, tol) {
	const n = quadSegments(p0, p1, p2, tol);
	const out = [];
	for (let i = 1; i <= n; i++) {
		const t = i / n;
		const a = (1 - t) * (1 - t);
		const b = 2 * (1 - t) * t;
		const d = t * t;
		out.push([a * p0[0] + b * p1[0] + d * p2[0], a * p0[1] + b * p1[1] + d * p2[1]]);
	}
	return out;
}
/** The points along a cubic from `p0` to `p3`, EXCLUDING `p0` and INCLUDING `p3`, within `tol`. */
function flattenCubic(p0, p1, p2, p3, tol) {
	const n = cubicSegments(p0, p1, p2, p3, tol);
	const out = [];
	for (let i = 1; i <= n; i++) {
		const t = i / n;
		const u = 1 - t;
		const a = u * u * u;
		const b = 3 * u * u * t;
		const d = 3 * u * t * t;
		const e = t * t * t;
		out.push([a * p0[0] + b * p1[0] + d * p2[0] + e * p3[0], a * p0[1] + b * p1[1] + d * p2[1] + e * p3[1]]);
	}
	return out;
}

// vendor/casemaker/casemaker-app/src/engine/compiler/glyphs.ts
/** Chord error budget for flattening curves, in mm. Plenty at badge scale. */
const GLYPH_CHORD_TOLERANCE_MM = .02;
/**
* Cap height of `font` as a fraction of the em: OS/2.sCapHeight where the font
* records one, else the measured top of 'H'.
*/
function capHeightEm(font) {
	const upm = font.unitsPerEm || 1e3;
	const declared = font.tables.os2?.sCapHeight;
	if (typeof declared === "number" && declared > 0) return declared / upm;
	const h = font.getPath("H", 0, 0, upm);
	let top = 0;
	for (const c of h.commands) for (const y of [
		c.y,
		c.y1,
		c.y2
	]) if (y !== void 0 && -y > top) top = -y;
	return top > 0 ? top / upm : .7;
}
/**
* Typeset `text` in `font` as a single `Profile`: one `p-poly` whose contours
* are the flattened glyph outlines, baseline on v = 0, pen start on u = 0, in
* millimetres, v up.
*
* - Scaled by CAP height (`capHeightMm`), matching `TextLabel.size`, not by em.
* - opentype.js paths are y-down; v is flipped here so text is upright.
* - `fillRule: 'NonZero'`: fonts wind their outer and inner contours in
*   opposite directions, so holes (o, B) still cut, but glyphs built from
*   OVERLAPPING same-direction contours read as solid instead of even-odd holes.
* - Whitespace-only text yields an empty `p-poly` (no contours).
*/
function glyphProfile(text, font, capHeightMm, opts = {}) {
	const cap = capHeightEm(font);
	const emMm = cap > 0 ? capHeightMm / cap : capHeightMm;
	const path = font.getPath(text, 0, 0, emMm, {
		kerning: opts.kerning ?? true,
		letterSpacing: opts.letterSpacing ?? 0
	});
	const contours = [];
	let ring = [];
	let cur = [0, 0];
	const flush = () => {
		if (ring.length >= 3) contours.push(ring);
		ring = [];
	};
	const push = (x, y) => {
		const pt = [x, -y];
		const last = ring[ring.length - 1];
		if (!last || last[0] !== pt[0] || last[1] !== pt[1]) ring.push(pt);
		cur = [x, y];
	};
	for (const c of path.commands) switch (c.type) {
		case "M":
			flush();
			push(c.x, c.y);
			break;
		case "L":
			push(c.x, c.y);
			break;
		case "Q": {
			const pts = flattenQuadratic(cur, [c.x1, c.y1], [c.x, c.y], GLYPH_CHORD_TOLERANCE_MM);
			for (const [x, y] of pts) push(x, y);
			break;
		}
		case "C": {
			const pts = flattenCubic(cur, [c.x1, c.y1], [c.x2, c.y2], [c.x, c.y], GLYPH_CHORD_TOLERANCE_MM);
			for (const [x, y] of pts) push(x, y);
			break;
		}
		case "Z": flush();
	}
	flush();
	for (const r of contours) {
		const f = r[0];
		const l = r[r.length - 1];
		if (r.length > 3 && f[0] === l[0] && f[1] === l[1]) r.pop();
	}
	return {
		kind: "p-poly",
		contours,
		fillRule: "NonZero"
	};
}

// vendor/casemaker/stubs/unavailable.mjs
var unavailable_exports = /* @__PURE__ */ __exportAll({
	default: () => unavailable_default,
	load: () => load,
	parse: () => parse
});
const fail = () => {
	throw new Error("This part of CaseMaker is not included in this application's fork.");
};
var unavailable_default = new Proxy(fail, { get: () => fail });
const load = fail;
const parse = fail;

// vendor/casemaker/casemaker-app/src/engine/fonts/registry.ts
const BUNDLED_FONTS = [
	{
		id: "sans-default",
		label: "Barlow (sans)",
		family: "sans",
		regular: "Barlow-Regular",
		bold: "Barlow-Bold"
	},
	{
		id: "mono-default",
		label: "IBM Plex Mono (mono)",
		family: "mono",
		regular: "IBMPlexMono-Regular",
		bold: "IBMPlexMono-Bold"
	},
	{
		id: "serif-default",
		label: "IBM Plex Serif (serif)",
		family: "serif",
		regular: "IBMPlexSerif-Regular",
		bold: "IBMPlexSerif-Bold"
	}
];
const DEFAULT_FONT_ID = "sans-default";
/**
* opentype.js ships BOTH a UMD build (its CJS `main`) and an ESM build (`module`). Vite/rolldown
* and vitest resolve the ESM build with real named exports, but Node/tsx resolve the UMD one,
* where Node's CJS→ESM interop parks the whole API on `default` (the UMD wrapper hides the named
* exports from cjs-module-lexer) — so `import * as opentype` there has no `parse`. Pick whichever
* shape actually carries `parse`, so the browser/worker and the tsx scripts both work.
*/
const opentype = true ? unavailable_exports : unavailable_default;
/** Every bundled font-file key (regular + bold), in def order. */
const BUNDLED_FONT_KEYS = BUNDLED_FONTS.flatMap((d) => [d.regular, d.bold]);
function weightKey(def, weight) {
	return weight === "bold" ? def.bold : def.regular;
}
function decodeBase64(b64) {
	const bin = atob(b64);
	const bytes = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
	return bytes.buffer;
}
const parsedCache = /* @__PURE__ */ new Map();
/**
* #1035 item 9 — A REACTIVE SIGNAL FOR THE FACES LANDING. The Cut preflight reads the job as data
* and measures its labels through this cache; before a face is parsed, `inkBoxOf` answers with its
* documented UPPER-bound estimate — the fit path's placeholder. A gate that refused a cut from that
* box refused a cut that does not exist, and nothing told it when the real face arrived. A
* subscriber (the panel's preflight memo) re-runs its gate on each bump, so the estimate is never
* the last word.
*
* Every face that ENTERS the cache bumps it: a bundled fetch (the asynchronous case a gate waits
* for) and a custom face's first synchronous parse. The latter happens inside the measuring call
* itself and settles within that same render — one extra pass, never a loop.
*/
let facesEpoch = 0;
const faceListeners = /* @__PURE__ */ new Set();
function noteFaceParsed() {
	facesEpoch += 1;
	for (const listener of faceListeners) listener();
}
function parseCached(key, bytes) {
	let f = parsedCache.get(key);
	if (!f) {
		f = opentype.parse(bytes);
		parsedCache.set(key, f);
		noteFaceParsed();
	}
	return f;
}
/**
* Resolve a label's font id to a parsed font. Unknown ids (a custom font that was deleted, a
* hand-edited file) fall back to the default sans rather than dropping the label; a custom font
* that fails to parse also falls back.
*
* The bundled faces must already be loaded — `ensureFontsLoaded` is called once per compile at
* the entry points (`JobScheduler`, the sim worker's engrave preview) for exactly the keys the
* project's labels need. A cache miss means that wiring was skipped, so it throws loudly rather
* than silently typesetting the wrong face.
*/
function resolveFont(id, weight = "regular", customFonts = []) {
	const custom = customFonts.find((f) => f.id === id);
	if (custom) try {
		return parseCached(`custom:${id}:${custom.data.length}:${custom.data.slice(-24)}`, decodeBase64(custom.data));
	} catch {
		return resolveFont(DEFAULT_FONT_ID, weight);
	}
	const key = weightKey(BUNDLED_FONTS.find((f) => f.id === id) ?? BUNDLED_FONTS[0], weight);
	const parsed = parsedCache.get(key);
	if (!parsed) throw new Error(`bundled font "${key}" is not loaded — call ensureFontsLoaded() with the project's font keys before resolving it`);
	return parsed;
}

// vendor/casemaker/casemaker-app/src/engine/compiler/textLabels.ts
const NO_RESOLVE_DISPLAY$5 = () => void 0;
/** Overshoot past the face on engraves so the cut is never coplanar with the wall. */
const ENGRAVE_BREAKOUT_MM = .05;
/**
* How far an EMBOSS sinks below the face plane (mm). A raised label whose base
* sits exactly ON the surface is a zero-thickness coplanar contact; Manifold's
* union can leave it as a separate component (the same trap the hinge fairing
* and #121 document). Sinking the base a hair gives the union a volumetric
* overlap, so the letters fuse to the wall/lid in every lid mode. The visible
* protrusion is unchanged — the embedded sliver is inside the parent solid.
*/
const EMBOSS_EMBED_MM = .2;
/**
* Rotation (innermost first) taking the extrude frame (x = text right, y = text
* up, z = outward) onto a face, so every label reads correctly seen from OUTSIDE.
*
* `faceFrame`'s (u, v) is chosen for layout, not handedness; on -z, +y and -x
* the pair is left-handed about the outward normal, so mapping text-right to +u
* would print it mirrored. On those faces text therefore reads along -u.
*/
function faceRotations(face) {
	switch (face) {
		case "+z": return [];
		case "-z": return [[
			0,
			180,
			0
		]];
		case "-y": return [[
			90,
			0,
			0
		]];
		case "+y": return [[
			90,
			0,
			180
		]];
		case "+x": return [[
			0,
			0,
			90
		], [
			0,
			90,
			0
		]];
		case "-x": return [
			[
				0,
				0,
				90
			],
			[
				0,
				90,
				0
			],
			[
				0,
				0,
				180
			]
		];
	}
}
/**
* A line of text as a 2D outline centred on the origin: the ink centred
* horizontally, the CAP-height box centred vertically (so y = 0 is the middle
* of a capital letter). Null for whitespace. Shared with the nameplate
* (`magnets.ts`, issue #152), so plate text and face labels typeset alike.
*/
function centredTextOutline(text, fontId, weight, size, customFonts = []) {
	const font = resolveFont(fontId, weight, customFonts);
	const glyphs = glyphProfile(text, font, size);
	const box = aabbOfProfile(glyphs);
	if (!box) return null;
	const cx = (box.min[0] + box.max[0]) / 2;
	return {
		outline: pTranslate([-cx, -size / 2], glyphs),
		width: box.max[0] - box.min[0]
	};
}
function generateLabelOps(label, frame, customFonts) {
	const typeset = centredTextOutline(label.text, label.font, label.weight, label.size, customFonts);
	if (!typeset) return [];
	let outline = typeset.outline;
	if (label.rotation) outline = pRotate(label.rotation, outline);
	const engrave = label.mode === "engrave";
	const height = engrave ? label.depth + ENGRAVE_BREAKOUT_MM : label.depth + EMBOSS_EMBED_MM;
	let op = extrude(outline, height);
	if (engrave) op = translate([
		0,
		0,
		-label.depth
	], op);
	else op = translate([
		0,
		0,
		-.2
	], op);
	for (const r of faceRotations(label.face)) op = rotate(r, op);
	const at = placeOnFace(frame, label.position.u, label.position.v);
	return [translate(at, op)];
}
function buildTextLabelOps(labels, board, params, hats = [], resolveHat = () => void 0, display = null, resolveDisplay = NO_RESOLVE_DISPLAY$5, customFonts = []) {
	const out = {
		additive: [],
		subtractive: [],
		lidAdditive: [],
		lidSubtractive: []
	};
	if (!labels || labels.length === 0) return out;
	const dims = computeShellDims(board, params, hats, resolveHat, display, resolveDisplay);
	const lidTopLocalZ = computeLidDims(board, params, hats, resolveHat, display, resolveDisplay).z;
	for (const label of labels) {
		if (!label.enabled) continue;
		if (!label.text || label.text.length === 0) continue;
		const onLid = label.face === "+z";
		const ops = generateLabelOps(label, faceFrame(label.face, dims.outerX, dims.outerY, onLid ? lidTopLocalZ : dims.outerZ), customFonts);
		const engrave = label.mode === "engrave";
		if (onLid) {
			if (engrave) out.lidSubtractive.push(...ops);
			else out.lidAdditive.push(...ops);
		} else if (engrave) out.subtractive.push(...ops);
		else out.additive.push(...ops);
	}
	return out;
}

// vendor/casemaker/casemaker-app/src/engine/compiler/antennas.ts
const NO_HATS$3 = [];
const NO_RESOLVE$3 = () => void 0;
const NO_RESOLVE_DISPLAY$4 = () => void 0;
const COUNTERBORE_FLOOR = 1;
/**
* Find an antenna-connector component in a board profile, if present.
*/
function findAntennaConnector(board) {
	return board.components.find((c) => c.kind === "antenna-connector");
}
/**
* Pick the closest side wall (+x/-x/+y/-y) to a connector position on the PCB.
* Returns the facing direction and the world-frame coordinate along the chosen
* wall the antenna body should be centered at.
*/
function resolveFacingForConnector(connectorX, connectorY, pcbX, pcbY) {
	const dxMinus = connectorX;
	const dxPlus = pcbX - connectorX;
	const dyMinus = connectorY;
	const dyPlus = pcbY - connectorY;
	const m = Math.min(dxMinus, dxPlus, dyMinus, dyPlus);
	if (m === dxMinus) return {
		facing: "-x",
		uOffset: connectorY
	};
	if (m === dxPlus) return {
		facing: "+x",
		uOffset: connectorY
	};
	if (m === dyMinus) return {
		facing: "-y",
		uOffset: connectorX
	};
	return {
		facing: "+y",
		uOffset: connectorX
	};
}
/**
* Compile antenna placements into a list of subtractive cylindrical cutouts.
* Internal antennas produce no ops. External-mount and rpi-external produce
* a through-hole sized to the connector body, plus an inside-face counterbore
* for the retaining nut.
*/
function buildAntennaOps(antennas, board, params, hats = NO_HATS$3, resolveHat = NO_RESOLVE$3, display = null, resolveDisplay = NO_RESOLVE_DISPLAY$4) {
	if (!antennas || antennas.length === 0) return { subtractive: [] };
	const shell = computeShellDims(board, params, hats, resolveHat, display, resolveDisplay);
	const { wallThickness: wall, floorThickness: floor } = params;
	const cl = cavityClearance(params);
	const out = [];
	for (const ant of antennas) {
		if (!ant.enabled) continue;
		if (ant.type === "internal") continue;
		const connector = findAntennaConnector(board);
		const facing = ant.facing ?? (connector ? resolveFacingForConnector(connector.position.x, connector.position.y, board.pcb.size.x, board.pcb.size.y).facing : "+y");
		const uOffset = ant.uOffset ?? (connector ? facing === "+y" || facing === "-y" ? connector.position.x : connector.position.y : 0);
		const spec = ANTENNA_SPECS[ant.type];
		const overshoot = 1;
		const zCenter = floor + board.defaultStandoffHeight + board.pcb.size.z + Math.min(8, shell.cavityZ / 2);
		switch (facing) {
			case "+y": {
				const xCenter = wall + cl.xMin + uOffset;
				const yMin = wall + cl.yMin + board.pcb.size.y - overshoot;
				const cyl = cylinder(wall + 2, spec.holeDiameter / 2 + .2, 48);
				const rotated = rotate([
					-90,
					0,
					0
				], cyl);
				out.push(translate([
					xCenter,
					yMin,
					zCenter
				], rotated));
				if (spec.counterboreDiameter > 0) {
					const cbDepth = Math.max(0, wall - COUNTERBORE_FLOOR);
					if (cbDepth > 0) {
						const cb = cylinder(cbDepth + overshoot, spec.counterboreDiameter / 2, 48);
						const cbRot = rotate([
							-90,
							0,
							0
						], cb);
						out.push(translate([
							xCenter,
							wall + cl.yMin + board.pcb.size.y - overshoot,
							zCenter
						], cbRot));
					}
				}
				break;
			}
			case "-y": {
				const xCenter = wall + cl.xMin + uOffset;
				const yMin = -1;
				const cyl = cylinder(wall + 2, spec.holeDiameter / 2 + .2, 48);
				const rotated = rotate([
					-90,
					0,
					0
				], cyl);
				out.push(translate([
					xCenter,
					yMin,
					zCenter
				], rotated));
				break;
			}
			case "+x": {
				const yCenter = wall + cl.yMin + uOffset;
				const xMin = wall + cl.xMin + board.pcb.size.x - overshoot;
				const cyl = cylinder(wall + 2, spec.holeDiameter / 2 + .2, 48);
				const rotated = rotate([
					0,
					90,
					0
				], cyl);
				out.push(translate([
					xMin,
					yCenter,
					zCenter
				], rotated));
				break;
			}
			case "-x": {
				const yCenter = wall + cl.yMin + uOffset;
				const xMin = -1;
				const cyl = cylinder(wall + 2, spec.holeDiameter / 2 + .2, 48);
				const rotated = rotate([
					0,
					90,
					0
				], cyl);
				out.push(translate([
					xMin,
					yCenter,
					zCenter
				], rotated));
				break;
			}
		}
	}
	return { subtractive: out };
}

// vendor/casemaker/casemaker-app/src/engine/compiler/snapCatches.ts
/**
* Issue #75 / #90 / followup — inside-wall snap lip. Trapezoidal prism with
* a sloped outboard face that gives the lid arm a smooth lead-in: as the
* lid pushes down, the barb's leading edge contacts the slope and the
* slope translates downward force into outward force on the arm,
* flexing it past the lip without requiring the wall to flex. Once the
* barb clears the lip's bottom face (the catch face), the arm springs
* back and the barb sits below the lip.
*
* Cross-section in (n, z): trapezoid with vertices
*   (0, 0)             — wall-base
*   (protrusion, 0)    — outboard-base (full protrusion at the catch face)
*   (protrusion·k, H)  — outboard-top (narrowed by factor k)
*   (0, H)             — wall-top
* where k ≈ 0.2 gives a steep but printable insertion ramp.
*
* Coordinate convention: nOff > 0 is CAVITY-BOUND (so the lip protrudes
* INTO the cavity to engage the lid arm's barb). The local→world basis
* uses dn = -wallNormalSign · axis because wallNormalSign is the outward
* normal sign and cavity-bound is the opposite direction.
*
* Pre-fix bug: the lip was emitted in the OUTWARD direction (away from
* the cavity), with EMBED_INTO_WALL providing the only attachment to wall
* material. The lid arm's barb sat in the cavity with nothing to hook
* under — geometrically present but functionally non-engaging. AND the
* mesh winding was hard-coded for one (axis, sign) parity; the other half
* of the walls produced inverted-orientation triangles that manifold
* couldn't fuse, leaving loose-piece lips on the +x and -y walls of the
* snap-fit-test template (and any user case using those walls).
*/
function buildLipWedge(origin, wallAxis, wallNormalSign, protrusion, width, height) {
	const pMin = protrusion * .2;
	const positions = [];
	function pushVert(uOff, nOff, zOff) {
		const cavityBoundSign = -wallNormalSign;
		if (wallAxis === "x") {
			const dx = cavityBoundSign * nOff;
			positions.push(origin.x + dx, origin.y + uOff, origin.z + zOff);
		} else {
			const dy = cavityBoundSign * nOff;
			positions.push(origin.x + uOff, origin.y + dy, origin.z + zOff);
		}
	}
	pushVert(0, 0, 0);
	pushVert(width, 0, 0);
	pushVert(0, protrusion, 0);
	pushVert(width, protrusion, 0);
	pushVert(0, 0, height);
	pushVert(width, 0, height);
	pushVert(0, pMin, height);
	pushVert(width, pMin, height);
	const tris = [
		0,
		3,
		1,
		0,
		2,
		3,
		4,
		7,
		6,
		4,
		5,
		7,
		0,
		1,
		5,
		0,
		5,
		4,
		3,
		2,
		6,
		3,
		6,
		7,
		0,
		6,
		2,
		0,
		4,
		6,
		1,
		7,
		5,
		1,
		3,
		7
	];
	if (wallAxis === "x" && wallNormalSign === -1 || wallAxis === "y" && wallNormalSign === 1) for (let i = 0; i < tris.length; i += 3) {
		const swap = tris[i + 1];
		tris[i + 1] = tris[i + 2];
		tris[i + 2] = swap;
	}
	return mesh(new Float32Array(positions), new Uint32Array(tris));
}
/**
* Issue #69 / #90 — symmetric (diamond) lip for symmetric-ramp catches.
* Same primitive-cube fix as buildLipWedge — the original mesh pattern was
* the same fragile mesh-with-winding approach. Functional difference vs the
* hook lip is gone (both are now flat cubes); the symmetric-ramp BARB still
* provides the symmetric insertion/removal force on the lid side.
*/
function buildLipSymmetricPrism(origin, wallAxis, wallNormalSign, protrusion, width, height) {
	return buildLipWedge(origin, wallAxis, wallNormalSign, protrusion, width, height);
}
const HOOK_BARB_PROTRUSION = .8;
const HOOK_BARB_BODY_HEIGHT = 2.5;
const HOOK_BARB_TAPER_HEIGHT = 1.5;
const HOOK_ARM_INSET = .2;
const HOOK_RECESS_CATCH_GUARD = 1;
const HOOK_TAB_EMBED = .3;
function computeHookTabFrame(c, params, dims) {
	const { wallThickness: wall } = params;
	const lidPlateBottomZ_world = lidIsRecessed(params) ? dims.outerZ - params.lidThickness : dims.outerZ;
	const recessCatchGuard_local = (lidIsRecessed(params) ? dims.outerZ - (params.lidThickness + .5) : Infinity) - lidPlateBottomZ_world;
	const barbTopZ_local = Math.min(-1, recessCatchGuard_local - HOOK_RECESS_CATCH_GUARD);
	const barbBodyBotZ_local = barbTopZ_local - HOOK_BARB_BODY_HEIGHT;
	const barbTipBotZ_local = barbBodyBotZ_local - HOOK_BARB_TAPER_HEIGHT;
	const armBotZ_local = -SNAP_DEFAULTS.armLength;
	const armWidth = SNAP_DEFAULTS.armWidth;
	const armThickness = SNAP_DEFAULTS.armThickness;
	let wallAxis;
	let wallNormalSign;
	let armOriginX, armOriginY;
	let armSizeX, armSizeY;
	let barbBodyOriginX, barbBodyOriginY;
	let barbBodySizeX, barbBodySizeY;
	switch (c.wall) {
		case "-x":
			wallAxis = "x";
			wallNormalSign = -1;
			armOriginX = wall + HOOK_ARM_INSET;
			armOriginY = c.uPosition - armWidth / 2;
			armSizeX = armThickness;
			armSizeY = armWidth;
			barbBodyOriginX = armOriginX - HOOK_BARB_PROTRUSION;
			barbBodyOriginY = armOriginY;
			barbBodySizeX = HOOK_BARB_PROTRUSION;
			barbBodySizeY = armWidth;
			break;
		case "+x":
			wallAxis = "x";
			wallNormalSign = 1;
			armOriginX = dims.outerX - wall - HOOK_ARM_INSET - armThickness;
			armOriginY = c.uPosition - armWidth / 2;
			armSizeX = armThickness;
			armSizeY = armWidth;
			barbBodyOriginX = armOriginX + armThickness;
			barbBodyOriginY = armOriginY;
			barbBodySizeX = HOOK_BARB_PROTRUSION;
			barbBodySizeY = armWidth;
			break;
		case "-y": {
			wallAxis = "y";
			wallNormalSign = -1;
			const innerWallY = wall;
			armOriginX = c.uPosition - armWidth / 2;
			armOriginY = innerWallY + HOOK_ARM_INSET;
			armSizeX = armWidth;
			armSizeY = armThickness;
			barbBodyOriginX = armOriginX;
			barbBodyOriginY = armOriginY - HOOK_BARB_PROTRUSION;
			barbBodySizeX = armWidth;
			barbBodySizeY = HOOK_BARB_PROTRUSION;
			break;
		}
		case "+y": {
			wallAxis = "y";
			wallNormalSign = 1;
			const innerWallY = dims.outerY - wall;
			armOriginX = c.uPosition - armWidth / 2;
			armOriginY = innerWallY - HOOK_ARM_INSET - armThickness;
			armSizeX = armWidth;
			armSizeY = armThickness;
			barbBodyOriginX = armOriginX;
			barbBodyOriginY = armOriginY + armThickness;
			barbBodySizeX = armWidth;
			barbBodySizeY = HOOK_BARB_PROTRUSION;
			break;
		}
	}
	return {
		armOriginX,
		armOriginY,
		armSizeX,
		armSizeY,
		barbBodyOriginX,
		barbBodyOriginY,
		barbBodySizeX,
		barbBodySizeY,
		lidPlateBottomZ_world,
		armBotZ_local,
		barbTopZ_local,
		barbBodyBotZ_local,
		barbTipBotZ_local,
		wallAxis,
		wallNormalSign,
		barbProtrusion: HOOK_BARB_PROTRUSION
	};
}
/** Triangular prism for the tapered insertion ramp. The cross-section in
*  the (n, z) plane is a right triangle:
*    A = (n=0,                           z=barbBodyBotZ)  — arm-side, top of taper
*    B = (n=barbProtrusion·outwardSign,  z=barbBodyBotZ)  — outboard, top of taper
*    C = (n=0,                           z=barbTipBotZ)   — arm-side, tip
*  Extruded along the wall tangent for armWidth. The hypotenuse B-C is
*  the slope the inner wall surface rides up during insertion.
*  Winding parity is computed the same way as buildLipWedge — flip if the
*  local→world basis Jacobian is negative for the (axis, sign) pair. */
function buildHookTaperedTip(frame) {
	let normalAnchor;
	let tangentAnchor;
	let armWidth;
	if (frame.wallAxis === "x") {
		normalAnchor = frame.wallNormalSign === -1 ? frame.armOriginX : frame.armOriginX + frame.armSizeX;
		tangentAnchor = frame.armOriginY;
		armWidth = frame.armSizeY;
	} else {
		normalAnchor = frame.wallNormalSign === -1 ? frame.armOriginY : frame.armOriginY + frame.armSizeY;
		tangentAnchor = frame.armOriginX;
		armWidth = frame.armSizeX;
	}
	const outward = frame.wallNormalSign;
	const positions = [];
	function pushVert(uOff, nOff, z) {
		if (frame.wallAxis === "x") positions.push(normalAnchor + outward * nOff, tangentAnchor + uOff, z);
		else positions.push(tangentAnchor + uOff, normalAnchor + outward * nOff, z);
	}
	pushVert(0, -.3, frame.barbBodyBotZ_local + HOOK_TAB_EMBED);
	pushVert(0, frame.barbProtrusion, frame.barbBodyBotZ_local + HOOK_TAB_EMBED);
	pushVert(0, -.3, frame.barbTipBotZ_local);
	pushVert(armWidth, -.3, frame.barbBodyBotZ_local + HOOK_TAB_EMBED);
	pushVert(armWidth, frame.barbProtrusion, frame.barbBodyBotZ_local + HOOK_TAB_EMBED);
	pushVert(armWidth, -.3, frame.barbTipBotZ_local);
	const tris = [
		0,
		2,
		1,
		3,
		4,
		5,
		0,
		1,
		4,
		0,
		4,
		3,
		0,
		3,
		5,
		0,
		5,
		2,
		1,
		5,
		4,
		1,
		2,
		5
	];
	if (frame.wallAxis === "x" && frame.wallNormalSign === -1 || frame.wallAxis === "y" && frame.wallNormalSign === 1) for (let i = 0; i < tris.length; i += 3) {
		const swap = tris[i + 1];
		tris[i + 1] = tris[i + 2];
		tris[i + 2] = swap;
	}
	return mesh(new Float32Array(positions), new Uint32Array(tris));
}
/** Full lid-side tab: arm + barb body + tapered tip, unioned into one
*  build op. Result is in WORLD coords; ProjectCompiler offsets it to
*  lid-local before unioning into the lid mesh. */
function buildHookTab(frame) {
	const arm = translate([
		frame.armOriginX,
		frame.armOriginY,
		frame.armBotZ_local
	], cube([
		frame.armSizeX,
		frame.armSizeY,
		SNAP_DEFAULTS.armLength + HOOK_TAB_EMBED
	]));
	const intoArm = -frame.wallNormalSign;
	frame.wallAxis === "x" ? frame.barbBodyOriginX + (intoArm > 0 ? 0 : -.3) : frame.barbBodyOriginX;
	const body = (() => {
		let ox = frame.barbBodyOriginX;
		let oy = frame.barbBodyOriginY;
		let sx = frame.barbBodySizeX;
		let sy = frame.barbBodySizeY;
		if (frame.wallAxis === "x") {
			if (frame.wallNormalSign === -1) sx += HOOK_TAB_EMBED;
			else {
				ox -= HOOK_TAB_EMBED;
				sx += HOOK_TAB_EMBED;
			}
		} else if (frame.wallNormalSign === -1) sy += HOOK_TAB_EMBED;
		else {
			oy -= HOOK_TAB_EMBED;
			sy += HOOK_TAB_EMBED;
		}
		return translate([
			ox,
			oy,
			frame.barbBodyBotZ_local - HOOK_TAB_EMBED
		], cube([
			sx,
			sy,
			2.8
		]));
	})();
	const tip = buildHookTaperedTip(frame);
	return union$1([
		arm,
		body,
		tip
	]);
}
/**
* Issue #153 — inflate the TAB FRAME used for the wall SUBTRACT so the snap
* hole is relieved on the two engagement axes, and only those:
*
*   • LATERAL (wall tangent)  — the hole widens by `relief` (half each side),
*     giving the seated tab lateral play and easing insertion.
*   • PROTRUSION (wall normal) — the hole deepens INTO the wall by `relief`,
*     so the (unchanged) barb no longer bears on the hole floor.
*
* The Z extents are copied verbatim: `barbTopZ_local` must not move, or the
* catch face shifts and the click lands at a different height — the global
* scale failure this feature exists to avoid. Relief is applied to the CUT
* only, never to the lid tab (`buildHookTab` on the un-relieved frame), since
* relief on both printed halves cancels.
*
* `relief <= 0` returns the frame unchanged, so the default ('tight', and any
* legacy project) compiles byte-identically to pre-#153.
*/
function relieveFrame(frame, relief) {
	if (relief <= 0) return frame;
	const half = relief / 2;
	const next = { ...frame };
	if (frame.wallAxis === "x") {
		next.armOriginY = frame.armOriginY - half;
		next.armSizeY = frame.armSizeY + relief;
		next.barbBodyOriginY = frame.barbBodyOriginY - half;
		next.barbBodySizeY = frame.barbBodySizeY + relief;
		if (frame.wallNormalSign === -1) {
			next.barbBodyOriginX = frame.barbBodyOriginX - relief;
			next.barbBodySizeX = frame.barbBodySizeX + relief;
		} else next.barbBodySizeX = frame.barbBodySizeX + relief;
	} else {
		next.armOriginX = frame.armOriginX - half;
		next.armSizeX = frame.armSizeX + relief;
		next.barbBodyOriginX = frame.barbBodyOriginX - half;
		next.barbBodySizeX = frame.barbBodySizeX + relief;
		if (frame.wallNormalSign === -1) {
			next.barbBodyOriginY = frame.barbBodyOriginY - relief;
			next.barbBodySizeY = frame.barbBodySizeY + relief;
		} else next.barbBodySizeY = frame.barbBodySizeY + relief;
	}
	next.barbProtrusion = frame.barbProtrusion + relief;
	return next;
}
/** Subtract-from-shell volume = the full barb (body + taper) in seated
*  position. The arm itself is NOT subtracted — it stays in the cavity
*  during insertion via elastic flex. Subtracting the body+taper carves
*  the snap hole; the wall material above z=barbTopZ becomes the catch
*  ledge that engages the barb's flat top on retention. The cavity-side
*  portion of the body (between arm outer face and inner wall surface,
*  if any) is already empty so the subtraction is a no-op there.
*
*  Issue #153 — `relief` inflates the cut on the lateral + protrusion axes
*  (see {@link relieveFrame}); the lid tab is built from the un-relieved
*  frame so only the hole grows. */
function buildHookTabWallSubtract(frame, relief) {
	return translate([
		0,
		0,
		frame.lidPlateBottomZ_world
	], buildHookTab(relieveFrame(frame, relief)));
}
const NO_HATS$2 = [];
const NO_RESOLVE$2 = () => void 0;
const NO_RESOLVE_DISPLAY$3 = () => void 0;
/** Compute the world-coord U range a board-local port occupies on the named
*  wall. U is Y for ±x walls and X for ±y walls. Returns null if the port
*  doesn't face this wall. */
function portUOnWall(port, wall, params) {
	if (port.facing !== wall) return null;
	const cl = cavityClearance(params);
	if (wall === "+x" || wall === "-x") {
		const off = params.wallThickness + cl.yMin;
		return [port.position.y + off, port.position.y + port.size.y + off];
	}
	const off = params.wallThickness + cl.xMin;
	return [port.position.x + off, port.position.x + port.size.x + off];
}
/** Find the largest clear gaps along a 1D wall of length `wallLen` given
*  a list of blocked ranges. Returns gaps wider than `minWidth`, sorted by
*  width descending. Each gap is reported with its center and width. */
function findClearGaps(wallLen, blocked, minWidth, edgeInset) {
	const merged = [];
	const sorted = [...blocked].sort((a, b) => a[0] - b[0]);
	for (const [a, b] of sorted) if (merged.length === 0 || a > merged[merged.length - 1][1]) merged.push([a, b]);
	else if (b > merged[merged.length - 1][1]) merged[merged.length - 1][1] = b;
	const gaps = [];
	let cursor = edgeInset;
	for (const [a, b] of merged) {
		if (a > cursor) gaps.push({
			start: cursor,
			width: a - cursor,
			center: (cursor + a) / 2
		});
		cursor = Math.max(cursor, b);
	}
	if (wallLen - edgeInset > cursor) {
		const w = wallLen - edgeInset - cursor;
		gaps.push({
			start: cursor,
			width: w,
			center: cursor + w / 2
		});
	}
	return gaps.filter((g) => g.width >= minWidth).sort((a, b) => b.width - a.width);
}
/** Pick up to `wantCount` catch positions along the wall. If the widest
*  available gap can host all wantCount catches (each needs `minWidth`),
*  evenly distribute them within that gap. Otherwise fall back to placing
*  one catch per gap, biggest gaps first. */
function findCatchPositions(wallLen, blocked, wantCount, minWidth, edgeInset) {
	const gaps = findClearGaps(wallLen, blocked, minWidth, edgeInset);
	if (gaps.length === 0) return [];
	const widest = gaps[0];
	if (Math.floor(widest.width / minWidth) >= wantCount) {
		const positions = [];
		for (let i = 1; i <= wantCount; i++) positions.push(widest.start + widest.width * i / (wantCount + 1));
		return positions;
	}
	return gaps.slice(0, wantCount).map((g) => g.center);
}
/** Place snap catches on each wall, avoiding U-ranges blocked by tall
*  connectors (the lid arm hangs ~6mm down into the cavity and would
*  collide with anything taller). For each wall:
*    - Long wall (>80mm): try to place 2 catches in the two widest gaps.
*    - Short wall: 1 catch in the widest gap.
*    - Wall fully blocked: skip silently — the user will see fewer
*      catches but the lid still seats on the remaining ones. */
function defaultSnapCatchesForCase(board, params, hats = NO_HATS$2, resolveHat = NO_RESOLVE$2) {
	const dims = computeShellDims(board, params, hats, resolveHat);
	const out = [];
	const LONG_SIDE_THRESHOLD = 80;
	const ARM_CLEARANCE = SNAP_DEFAULTS.armWidth + 2;
	const EDGE_INSET = 4;
	const PER_WALL = [
		{
			wall: "-x",
			uMax: dims.outerY,
			idStem: "snap-mx"
		},
		{
			wall: "+x",
			uMax: dims.outerY,
			idStem: "snap-px"
		},
		{
			wall: "-y",
			uMax: dims.outerX,
			idStem: "snap-my"
		},
		{
			wall: "+y",
			uMax: dims.outerX,
			idStem: "snap-py"
		}
	];
	for (const { wall, uMax, idStem } of PER_WALL) {
		const blocked = [];
		for (const port of board.components) {
			const range = portUOnWall(port, wall, params);
			if (range) blocked.push(range);
		}
		const positions = findCatchPositions(uMax, blocked, uMax > LONG_SIDE_THRESHOLD ? 2 : 1, ARM_CLEARANCE, EDGE_INSET);
		positions.forEach((p, i) => {
			const id = positions.length > 1 ? `${idStem}-${i + 1}` : idStem;
			out.push({
				id,
				wall,
				uPosition: p,
				enabled: true,
				barbType: "hook"
			});
		});
	}
	return out;
}
function computeWallFrame(c, params, outerX, outerY, lipBottomZ) {
	const { wallThickness: wall } = params;
	const { armLength, armThickness, armWidth, barbProtrusion, barbLength, pocketWidth } = SNAP_DEFAULTS;
	const ARM_INSET = .3;
	const armZ = -armLength;
	switch (c.wall) {
		case "-x": {
			const armX = wall + barbProtrusion + ARM_INSET;
			return {
				lipOrigin: {
					x: wall,
					y: c.uPosition - pocketWidth / 2,
					z: lipBottomZ
				},
				wallAxis: "x",
				wallNormalSign: -1,
				armOrigin: {
					x: armX,
					y: c.uPosition - armWidth / 2,
					z: armZ
				},
				armSize: {
					n: armThickness,
					t: armWidth,
					z: armLength
				},
				barbOrigin: {
					x: armX - barbProtrusion,
					y: c.uPosition - armWidth / 2,
					z: armZ
				},
				barbSize: {
					n: barbProtrusion,
					t: armWidth,
					z: barbLength
				}
			};
		}
		case "+x": {
			const innerX = outerX - wall;
			const armX = innerX - barbProtrusion - ARM_INSET - armThickness;
			return {
				lipOrigin: {
					x: innerX,
					y: c.uPosition - pocketWidth / 2,
					z: lipBottomZ
				},
				wallAxis: "x",
				wallNormalSign: 1,
				armOrigin: {
					x: armX,
					y: c.uPosition - armWidth / 2,
					z: armZ
				},
				armSize: {
					n: armThickness,
					t: armWidth,
					z: armLength
				},
				barbOrigin: {
					x: armX + armThickness,
					y: c.uPosition - armWidth / 2,
					z: armZ
				},
				barbSize: {
					n: barbProtrusion,
					t: armWidth,
					z: barbLength
				}
			};
		}
		case "-y": {
			const armY = wall + barbProtrusion + ARM_INSET;
			return {
				lipOrigin: {
					x: c.uPosition - pocketWidth / 2,
					y: wall,
					z: lipBottomZ
				},
				wallAxis: "y",
				wallNormalSign: -1,
				armOrigin: {
					x: c.uPosition - armWidth / 2,
					y: armY,
					z: armZ
				},
				armSize: {
					n: armThickness,
					t: armWidth,
					z: armLength
				},
				barbOrigin: {
					x: c.uPosition - armWidth / 2,
					y: armY - barbProtrusion,
					z: armZ
				},
				barbSize: {
					n: barbProtrusion,
					t: armWidth,
					z: barbLength
				}
			};
		}
		case "+y": {
			const innerY = outerY - wall;
			const armY = innerY - barbProtrusion - ARM_INSET - armThickness;
			return {
				lipOrigin: {
					x: c.uPosition - pocketWidth / 2,
					y: innerY,
					z: lipBottomZ
				},
				wallAxis: "y",
				wallNormalSign: 1,
				armOrigin: {
					x: c.uPosition - armWidth / 2,
					y: armY,
					z: armZ
				},
				armSize: {
					n: armThickness,
					t: armWidth,
					z: armLength
				},
				barbOrigin: {
					x: c.uPosition - armWidth / 2,
					y: armY + armThickness,
					z: armZ
				},
				barbSize: {
					n: barbProtrusion,
					t: armWidth,
					z: barbLength
				}
			};
		}
	}
}
/** Build the cantilever arm and translate-place a pre-built barb mesh. */
function buildArm(frame) {
	const sz = frame.wallAxis === "x" ? [
		frame.armSize.n,
		frame.armSize.t,
		frame.armSize.z
	] : [
		frame.armSize.t,
		frame.armSize.n,
		frame.armSize.z
	];
	return translate([
		frame.armOrigin.x,
		frame.armOrigin.y,
		frame.armOrigin.z
	], cube(sz));
}
function buildHookBarb(frame) {
	const sz = frame.wallAxis === "x" ? [
		frame.barbSize.n,
		frame.barbSize.t,
		frame.barbSize.z
	] : [
		frame.barbSize.t,
		frame.barbSize.n,
		frame.barbSize.z
	];
	return translate([
		frame.barbOrigin.x,
		frame.barbOrigin.y,
		frame.barbOrigin.z
	], cube(sz));
}
/**
* Issue #81 — when the lip's wall-side face is exactly coplanar with the
* inner wall surface, manifold's union sometimes treats the two solids as
* non-overlapping (touching only). The result is a "loose" lip that the
* slicer drops to the build plate. Embedding the lip into the wall by
* EMBED_INTO_WALL guarantees a volumetric overlap so the union always
* produces a single connected component.
*/
const EMBED_INTO_WALL = 1;
/** Shift the wedge origin INTO the wall and add the same amount to the
*  protrusion so the inward tip stays at the same world location. */
function embedInWall(frame) {
	const { x, y, z } = frame.lipOrigin;
	if (frame.wallAxis === "x") return {
		origin: {
			x: x + frame.wallNormalSign * EMBED_INTO_WALL,
			y,
			z
		},
		extraProtrusion: EMBED_INTO_WALL
	};
	return {
		origin: {
			x,
			y: y + frame.wallNormalSign * EMBED_INTO_WALL,
			z
		},
		extraProtrusion: EMBED_INTO_WALL
	};
}
/**
* Issue #153 — `reliefMm` is taken off the lip's CAVITY-side protrusion, never
* off its height: the wedge tip moves back toward the wall by the relief, so
* the barb passes it with less flex while every Z face — the catch face that
* sets where the click lands — stays exactly where it was. The wall-side embed
* (`extraProtrusion`) is untouched for the same reason #81 put it there.
*/
function buildHookLip(frame, height, reliefMm) {
	const { barbProtrusion, pocketWidth } = SNAP_DEFAULTS;
	const { origin, extraProtrusion } = embedInWall(frame);
	return buildLipWedge(origin, frame.wallAxis, frame.wallNormalSign, barbProtrusion + extraProtrusion - reliefMm, pocketWidth, height);
}
function buildAsymmetricRampBarb(frame) {
	const sz = frame.wallAxis === "x" ? [
		frame.barbSize.n,
		frame.barbSize.t,
		frame.barbSize.z * .7
	] : [
		frame.barbSize.t,
		frame.barbSize.n,
		frame.barbSize.z * .7
	];
	return translate([
		frame.barbOrigin.x,
		frame.barbOrigin.y,
		frame.barbOrigin.z
	], cube(sz));
}
/** Triangular prism barb: full protrusion at center, tapered top + bottom. */
function buildSymmetricRampBarb(frame) {
	const nMax = frame.barbSize.n;
	const tLen = frame.barbSize.t;
	const h = frame.barbSize.z;
	const origin = frame.barbOrigin;
	const wallNormalSign = frame.wallNormalSign;
	const positions = [];
	function pushVert(uOff, nOff, zOff) {
		if (frame.wallAxis === "x") positions.push(origin.x - wallNormalSign * nOff, origin.y + uOff, origin.z + zOff);
		else positions.push(origin.x + uOff, origin.y - wallNormalSign * nOff, origin.z + zOff);
	}
	pushVert(0, 0, 0);
	pushVert(tLen, 0, 0);
	pushVert(0, nMax, h / 2);
	pushVert(tLen, nMax, h / 2);
	pushVert(0, 0, h);
	pushVert(tLen, 0, h);
	return mesh(new Float32Array(positions), new Uint32Array([
		0,
		1,
		5,
		0,
		5,
		4,
		0,
		2,
		3,
		0,
		3,
		1,
		2,
		4,
		5,
		2,
		5,
		3,
		0,
		4,
		2,
		1,
		3,
		5
	]));
}
function buildHalfRoundBarb(frame) {
	const radius = Math.max(frame.barbSize.n, frame.barbSize.z / 2);
	const length = frame.barbSize.t;
	const cyl = cylinder(length, radius, 24);
	const oriented = frame.wallAxis === "x" ? rotate([
		90,
		0,
		0
	], cyl) : rotate([
		0,
		90,
		0
	], cyl);
	const cz = frame.barbOrigin.z + frame.barbSize.z / 2;
	if (frame.wallAxis === "x") {
		const cx = frame.barbOrigin.x;
		const ty = frame.barbOrigin.y;
		return translate([
			cx,
			ty,
			cz
		], oriented);
	} else {
		const tx = frame.barbOrigin.x;
		const cy = frame.barbOrigin.y;
		return translate([
			tx,
			cy,
			cz
		], oriented);
	}
}
function buildBallSocketBarb(frame) {
	const radius = Math.min(frame.barbSize.t, frame.barbSize.z) / 3;
	const length = frame.barbSize.n;
	const cyl = cylinder(length, radius, 24);
	let oriented;
	if (frame.wallAxis === "x") oriented = rotate([
		0,
		frame.wallNormalSign * 90,
		0
	], cyl);
	else oriented = rotate([
		frame.wallNormalSign * -90,
		0,
		0
	], cyl);
	const cx = frame.wallAxis === "x" ? frame.barbOrigin.x : frame.barbOrigin.x + frame.barbSize.t / 2;
	const cy = frame.wallAxis === "y" ? frame.barbOrigin.y : frame.barbOrigin.y + frame.barbSize.t / 2;
	const cz = frame.barbOrigin.z + frame.barbSize.z / 2;
	return translate([
		cx,
		cy,
		cz
	], oriented);
}
/**
* Issue #77 — barb-type ↔ shell-geometry mapping.
*
*   hook + asymmetric-ramp: both flat-top barbs that engage the same flat
*     catch face — sharing buildHookLip is correct, not a bug. The shell
*     mesh is intentionally identical between these two; the difference
*     is in the BARB shape on the lid.
*   symmetric-ramp: triangular prism barb + matching prism lip.
*   half-round: half-cylinder barb still engages a flat catch face cleanly,
*     so it shares the hook lip.
*   ball-socket: detent design — NO lip; the wall has a circular pocket
*     drilled at the seated-ball Z so the ball clicks IN. This is the fix
*     for #77's "shell unchanged when ball-socket selected" symptom: the
*     old code shipped a hook-style lip that the ball just slid past with
*     nothing to retain it.
*/
const BARB_REGISTRY = {
	hook: {
		buildBarb: buildHookBarb,
		buildLip: buildHookLip
	},
	"asymmetric-ramp": {
		buildBarb: buildAsymmetricRampBarb,
		buildLip: buildHookLip
	},
	"symmetric-ramp": {
		buildBarb: buildSymmetricRampBarb,
		buildLip: (frame, lipHeight, reliefMm) => {
			const { barbProtrusion, pocketWidth } = SNAP_DEFAULTS;
			const { origin, extraProtrusion } = embedInWall(frame);
			return buildLipSymmetricPrism(origin, frame.wallAxis, frame.wallNormalSign, barbProtrusion + extraProtrusion - reliefMm, pocketWidth, lipHeight);
		}
	},
	"half-round": {
		buildBarb: buildHalfRoundBarb,
		buildLip: buildHookLip
	},
	"ball-socket": {
		buildBarb: buildBallSocketBarb,
		buildLip: () => null,
		buildWallPocket: buildBallSocketWallPocket
	}
};
/**
* Cylindrical pocket cut into the inside wall at the seated ball position.
* The cylinder axis runs along the wall outward normal so it bores INTO the
* wall; depth is chosen so the ball seats flush with the inside surface.
*/
function buildBallSocketWallPocket(frame, reliefMm) {
	const { barbLength, armWidth, barbProtrusion } = SNAP_DEFAULTS;
	const ballRadius = Math.min(armWidth, barbLength) / 3;
	const radius = ballRadius + .1 + reliefMm;
	const depth = ballRadius + .4;
	const ballCenterZ = frame.lipOrigin.z - barbLength / 2;
	const cyl = cylinder(depth, radius, 24);
	let oriented;
	let pocketOriginX;
	let pocketOriginY;
	const tInset = (SNAP_DEFAULTS.pocketWidth - armWidth) / 2;
	if (frame.wallAxis === "x") {
		oriented = rotate([
			0,
			frame.wallNormalSign * 90,
			0
		], cyl);
		pocketOriginX = frame.lipOrigin.x;
		pocketOriginY = frame.lipOrigin.y + tInset + armWidth / 2;
	} else {
		oriented = rotate([
			-frame.wallNormalSign * 90,
			0,
			0
		], cyl);
		pocketOriginX = frame.lipOrigin.x + tInset + armWidth / 2;
		pocketOriginY = frame.lipOrigin.y;
	}
	return translate([
		pocketOriginX,
		pocketOriginY,
		ballCenterZ
	], oriented);
}
function buildSnapCatch(c, board, params, hats = NO_HATS$2, resolveHat = NO_RESOLVE$2, display = null, resolveDisplay = NO_RESOLVE_DISPLAY$3) {
	if (!c.enabled) return null;
	const dims = computeShellDims(board, params, hats, resolveHat, display, resolveDisplay);
	const barbType = c.barbType ?? "hook";
	const relief = fitRelief(c.fit ?? params.fit);
	if (barbType === "hook") {
		const tabFrame = computeHookTabFrame(c, params, dims);
		return {
			lip: null,
			armBarb: buildHookTab(tabFrame),
			wallPocket: buildHookTabWallSubtract(tabFrame, relief)
		};
	}
	const { armLength, barbLength } = SNAP_DEFAULTS;
	const LIP_HEIGHT = armLength - barbLength;
	const lipBottomZ = (lidIsRecessed(params) ? dims.outerZ - params.lidThickness : dims.outerZ) - LIP_HEIGHT;
	const frame = computeWallFrame(c, params, dims.outerX, dims.outerY, lipBottomZ);
	const builders = BARB_REGISTRY[barbType];
	const lip = builders.buildLip(frame, LIP_HEIGHT, relief);
	const arm = buildArm(frame);
	const barb = builders.buildBarb(frame);
	const wallPocket = builders.buildWallPocket?.(frame, relief) ?? null;
	return {
		lip,
		armBarb: union$1([arm, barb]),
		wallPocket
	};
}
function buildSnapCatchOps(catches, board, params, hats = NO_HATS$2, resolveHat = NO_RESOLVE$2, display = null, resolveDisplay = NO_RESOLVE_DISPLAY$3) {
	if (!catches || params.joint !== "snap-fit") return {
		shellAdd: [],
		shellSubtract: [],
		lidAdd: []
	};
	const shellAdd = [];
	const shellSubtract = [];
	const lidAdd = [];
	for (const c of catches) {
		const g = buildSnapCatch(c, board, params, hats, resolveHat, display, resolveDisplay);
		if (!g) continue;
		if (g.lip) shellAdd.push(g.lip);
		if (g.wallPocket) shellSubtract.push(g.wallPocket);
		lidAdd.push(g.armBarb);
	}
	return {
		shellAdd,
		shellSubtract,
		lidAdd
	};
}

// vendor/casemaker/casemaker-app/src/engine/compiler/boardSnap.ts
const NO_HATS$1 = [];
const NO_RESOLVE$1 = () => void 0;
const NO_RESOLVE_DISPLAY$2 = () => void 0;
/**
* Board-retention snap fingers.
*
* When `boardRetention === 'snap'`, four small retainers are emitted on
* the cavity walls — one per wall, centered along the wall tangent —
* that overhang the PCB's top edge by FINGER_OVERHANG mm. The board is
* pressed DOWN into the cavity: its top edge first meets the finger's
* SLOPED TOP face (the insertion lead-in), which cams the finger/wall
* aside so the board slides past. Once the board top clears the finger,
* the wall springs back and the finger's FLAT BOTTOM face sits over the
* board edge — square to the pull-out direction, so removal is resisted.
* Ramp-in, catch-out: the taper favours insertion, not removal.
*
* No screws, no foam — just a snap-in board. The PCB still sits on
* standoffs (board.defaultStandoffHeight) for clearance underneath,
* and the fingers hold it from lifting out of the case.
*
* Geometry per finger (in cavity-local coords for the -y wall, with
* "n outward" meaning AWAY from the cavity = INTO the wall):
*
*      cavity-wall side    ┌╲            ← sloped TOP face (z: topZ at the
*                          │ ╲              wall, ramping DOWN to botZ at the
*                          │  ╲             interior tip). The descending
*                          │   ╲            board edge rides this ramp and
*                          │    ╲           flexes the wall outward.
*                          │     ╲
*                          └──────┘  ← flat BOTTOM face (z = botZ) — the
*      (interior end) ────────────↑    catch: square to pull-out, holds
*                                      the board down.
*                          ↑
*                        wall side embedded by EMBED for manifold fusion.
*/
const FINGER_W$1 = 10;
const FINGER_OVERHANG = 1.2;
const FINGER_THICKNESS = 1.6;
const FINGER_CLEARANCE_Z = .25;
const EMBED$1 = .5;
const CLIP_SHELF_T = 1.6;
/**
* Lateral gap between the clip's spine face and the PCB edge, mm — the number
* #153's fit relief is added to, and the one the board-snap fit coupon (#157)
* ladders and names, so it is exported rather than duplicated.
*/
const CLIP_FIT = .15;
const SHOULDER_FIT = .15;
const SHOULDER_FINGER_EXTRA = .4;
function buildBoardSnapOps(board, params, _hats = NO_HATS$1, _resolveHat = NO_RESOLVE$1, _display = null, _resolveDisplay = NO_RESOLVE_DISPLAY$2) {
	if (params.boardRetention !== "snap") return { caseAdditive: [] };
	const rf = board.retentionFootprint;
	const fpX = rf?.x ?? 0;
	const fpY = rf?.y ?? 0;
	const fpW = rf?.width ?? board.pcb.size.x;
	const fpH = rf?.height ?? board.pcb.size.y;
	const customClips = board.retentionClips?.length ? board.retentionClips : void 0;
	if (!customClips && (fpW < 14 || fpH < 14)) return { caseAdditive: [] };
	const wall = params.wallThickness;
	const cl = cavityClearance(params);
	const relief = fitRelief(params.fit);
	const clipFit = CLIP_FIT + relief;
	const shoulderFit = SHOULDER_FIT + relief;
	const origin = cavityOriginXY(params);
	const botZ = params.floorThickness + board.defaultStandoffHeight + board.pcb.size.z + FINGER_CLEARANCE_Z;
	const topZ = botZ + FINGER_THICKNESS;
	const shoulder = board.retentionShoulder === true;
	const overhang = FINGER_OVERHANG + (shoulder ? SHOULDER_FINGER_EXTRA : 0);
	const pcbXMin = origin.x + fpX;
	const pcbXMax = pcbXMin + fpW;
	const pcbYMin = origin.y + fpY;
	const pcbYMax = pcbYMin + fpH;
	const wallInnerYMin = wall;
	const wallInnerYMax = wall + board.pcb.size.y + cl.yMin + cl.yMax;
	const wallInnerXMin = wall;
	const wallInnerXMax = wall + board.pcb.size.x + cl.xMin + cl.xMax;
	const RIB_W = 2;
	const RIB_FILL_MAX = 4;
	const backLo = (edge, wallC) => edge - wallC <= RIB_FILL_MAX ? wallC : edge - RIB_W;
	const backHi = (edge, wallC) => wallC - edge <= RIB_FILL_MAX ? wallC : edge + RIB_W;
	const backXLo = backLo(pcbXMin, wallInnerXMin);
	const backXHi = backHi(pcbXMax, wallInnerXMax);
	const backYLo = backLo(pcbYMin, wallInnerYMin);
	const backYHi = backHi(pcbYMax, wallInnerYMax);
	const ops = [];
	const boardBotZ = params.floorThickness + board.defaultStandoffHeight;
	const shelfBotZ = Math.max(params.floorThickness, boardBotZ - CLIP_SHELF_T);
	const wantShelf = boardBotZ - params.floorThickness > .4;
	const spineZ0 = Math.max(0, params.floorThickness - EMBED$1);
	/** Emit one two-jaw clip on the given edge: spine (floor → finger top),
	* shelf (bottom jaw, board rests on it), finger (top jaw). Style 'shelf'
	* emits a support tab instead — a solid pedestal from the wall to `reach`
	* under the board, floor to board underside, no finger. Use it where
	* nothing may protrude above the board (e.g. under an antenna overhang). */
	const emitClip = (axis, sign, center, width, style = "clip", reach) => {
		const edgeN = axis === "y" ? sign < 0 ? pcbYMin : pcbYMax : sign < 0 ? pcbXMin : pcbXMax;
		const wallN = axis === "y" ? sign < 0 ? wallInnerYMin : wallInnerYMax : sign < 0 ? wallInnerXMin : wallInnerXMax;
		const back = sign < 0 ? backLo(edgeN, wallN) : backHi(edgeN, wallN);
		const outer = (sign < 0 ? back <= wallN + .001 : back >= wallN - .001) ? back + sign * EMBED$1 : back;
		const spineInner = edgeN + sign * clipFit;
		const jawInner = edgeN - sign * (reach ?? overhang);
		const t0 = center - width / 2;
		const box = (nA, nB, z0, z1) => {
			const nMin = Math.min(nA, nB);
			const nSize = Math.abs(nB - nA);
			return axis === "y" ? translate([
				t0,
				nMin,
				z0
			], cube([
				width,
				nSize,
				z1 - z0
			])) : translate([
				nMin,
				t0,
				z0
			], cube([
				nSize,
				width,
				z1 - z0
			]));
		};
		if (style === "shelf") {
			if (boardBotZ - spineZ0 < .4) return;
			ops.push(box(wallN + sign * EMBED$1, jawInner, spineZ0, boardBotZ));
			return;
		}
		if (Math.abs(spineInner - outer) > .2) ops.push(box(outer, spineInner, spineZ0, topZ));
		if (wantShelf) ops.push(box(outer, jawInner, shelfBotZ, boardBotZ));
		ops.push(axis === "y" ? buildFingerY(sign, center, back, jawInner, botZ, topZ, width) : buildFingerX(sign, center, back, jawInner, botZ, topZ, width));
	};
	if (customClips) for (const c of customClips) {
		const w = c.width ?? FINGER_W$1;
		const alongX = c.edge === "-y" || c.edge === "+y";
		const center = (alongX ? pcbXMin : pcbYMin) + c.offset + w / 2;
		emitClip(alongX ? "y" : "x", c.edge.startsWith("-") ? -1 : 1, center, w, c.style ?? "clip", c.reach);
	}
	else {
		const xCenter = (pcbXMin + pcbXMax) / 2;
		const yCenter = (pcbYMin + pcbYMax) / 2;
		emitClip("y", -1, xCenter, FINGER_W$1);
		emitClip("y", 1, xCenter, FINGER_W$1);
		emitClip("x", -1, yCenter, FINGER_W$1);
		emitClip("x", 1, yCenter, FINGER_W$1);
	}
	if (shoulder) {
		const z0 = params.floorThickness;
		const z1 = botZ;
		const openXLo = pcbXMin - shoulderFit;
		const openXHi = pcbXMax + shoulderFit;
		const openYLo = pcbYMin - shoulderFit;
		const openYHi = pcbYMax + shoulderFit;
		const eXLo = backXLo <= wallInnerXMin + .001 ? backXLo - EMBED$1 : backXLo;
		const eXHi = backXHi >= wallInnerXMax - .001 ? backXHi + EMBED$1 : backXHi;
		const eYLo = backYLo <= wallInnerYMin + .001 ? backYLo - EMBED$1 : backYLo;
		const eYHi = backYHi >= wallInnerYMax - .001 ? backYHi + EMBED$1 : backYHi;
		const box = (bxLo, bxHi, byLo, byHi) => translate([
			bxLo,
			byLo,
			z0
		], cube([
			bxHi - bxLo,
			byHi - byLo,
			z1 - z0
		]));
		ops.push(box(eXLo, openXLo, eYLo, eYHi));
		ops.push(box(openXHi, eXHi, eYLo, eYHi));
		ops.push(box(eXLo, eXHi, eYLo, openYLo));
		ops.push(box(eXLo, eXHi, openYHi, eYHi));
	}
	return { caseAdditive: ops };
}
/** Build a -y / +y wall finger as a tapered slab — the TOP face is sloped
*  (high at the wall, ramping DOWN to the interior tip) so the descending
*  board rides it and flexes the wall aside during insertion; the BOTTOM
*  face is flat (the catch, square to pull-out). Implemented as a
*  triangular-prism MESH so we get the slope cleanly without a difference. */
function buildFingerY(sign, tangentCenterX, outerNy, innerNy, botZ, topZ, width = FINGER_W$1) {
	const xMin = tangentCenterX - width / 2;
	const xMax = tangentCenterX + width / 2;
	const embeddedOuter = outerNy + sign * EMBED$1;
	return makeTriPrism([
		embeddedOuter,
		embeddedOuter,
		innerNy
	], [
		botZ,
		topZ,
		botZ
	], xMin, xMax, "y", sign);
}
/** ±x walls — finger uses X as the wall-normal axis, extruded along Y.
*  Mirror of buildFingerY with the axis swap baked into makeTriPrismX. */
function buildFingerX(sign, tangentCenterY, outerNx, innerNx, botZ, topZ, width = FINGER_W$1) {
	const yMin = tangentCenterY - width / 2;
	const yMax = tangentCenterY + width / 2;
	const embeddedOuter = outerNx + sign * EMBED$1;
	return makeTriPrismX([
		embeddedOuter,
		embeddedOuter,
		innerNx
	], [
		botZ,
		topZ,
		botZ
	], yMin, yMax, sign);
}
/** Triangular prism extruded along Y (for axis='x' walls). Cross-section
*  is the triangle in the (x, z) plane defined by 3 (x, z) pairs. */
function makeTriPrismX(xs, zs, yMin, yMax, sign) {
	const positions = [];
	for (let i = 0; i < 3; i++) positions.push(xs[i], yMin, zs[i]);
	for (let i = 0; i < 3; i++) positions.push(xs[i], yMax, zs[i]);
	const tris = [
		0,
		1,
		2,
		3,
		5,
		4,
		0,
		3,
		4,
		0,
		4,
		1,
		1,
		4,
		5,
		1,
		5,
		2,
		2,
		5,
		3,
		2,
		3,
		0
	];
	if (sign === -1) for (let i = 0; i < tris.length; i += 3) {
		const swap = tris[i + 1];
		tris[i + 1] = tris[i + 2];
		tris[i + 2] = swap;
	}
	return mesh(new Float32Array(positions), new Uint32Array(tris));
}
/** Triangular prism mesh extruded along the X axis (for axis='y'
*  walls). The cross-section is the triangle defined by 3 (y, z) pairs.
*  Winding is parity-flipped per (axis, sign) like the rugged ribs and
*  snap-fit lip wedges. */
function makeTriPrism(ys, zs, xMin, xMax, axis, sign) {
	const positions = [];
	for (let i = 0; i < 3; i++) positions.push(xMin, ys[i], zs[i]);
	for (let i = 0; i < 3; i++) positions.push(xMax, ys[i], zs[i]);
	const tris = [
		0,
		1,
		2,
		3,
		5,
		4,
		0,
		3,
		4,
		0,
		4,
		1,
		1,
		4,
		5,
		1,
		5,
		2,
		2,
		5,
		3,
		2,
		3,
		0
	];
	if (axis === "x" && sign === -1 || axis === "y" && sign === 1) for (let i = 0; i < tris.length; i += 3) {
		const swap = tris[i + 1];
		tris[i + 1] = tris[i + 2];
		tris[i + 2] = swap;
	}
	return mesh(new Float32Array(positions), new Uint32Array(tris));
}

// vendor/casemaker/casemaker-app/src/engine/compiler/secondaryMounts.ts
/**
* Snap-clip mounts for secondary boards (board.secondaryBoardMounts).
*
* A daughterboard (e.g. SlyTherm's MSR-2 mmWave module) is held above the case
* floor by thin cantilever clips — no screws, no holes. Each clip is a spring
* arm just outboard of a board edge, rising from the floor, with:
*   • a REST LEDGE at the board underside (z = floor + standoffHeight) that the
*     board drops onto, and
*   • a HOOK LIP at the board top (z = underside + thickness) that overhangs the
*     board edge inward and springs back over it after insertion.
* The board pushes in from above: its edge cams the hook outward, the arm flexes,
* and the hook snaps back to trap the board between ledge and hook.
*
*              arm ┃          ┃ hook lip (overhang mm inward, over board top)
*   (spring, floor┃──┐        ┃▔▔▔▔
*    → top)       ┃  │  board →┃    ] board thickness
*                 ┃──┘ rest    ┃▁▁▁▁ rest ledge (under board)
*                 ┃  ledge     ┃
*          floor ─┸────────────┸─
*/
const CLIP_W = 6;
const GAP = .15;
const LEDGE_D = 2;
const LEDGE_THK = 1.5;
const HOOK_THK = 1.2;
const DEFAULT_OVERHANG = 2;
const EMBED = .5;
function buildSecondaryMountOps(board, params) {
	const mounts = board.secondaryBoardMounts;
	if (!mounts || mounts.length === 0) return { caseAdditive: [] };
	const origin = cavityOriginXY(params);
	const floorTop = params.floorThickness;
	const ops = [];
	const box = (xLo, xHi, yLo, yHi, zLo, zHi) => translate([
		xLo,
		yLo,
		zLo
	], cube([
		xHi - xLo,
		yHi - yLo,
		zHi - zLo
	]));
	for (const m of mounts) {
		const bXMin = origin.x + m.position.x;
		const bXMax = bXMin + m.size.x;
		const bYMin = origin.y + m.position.y;
		const bYMax = bYMin + m.size.y;
		const boardBottomZ = floorTop + m.standoffHeight;
		const boardTopZ = boardBottomZ + m.size.z;
		const overhang = m.overhang ?? DEFAULT_OVERHANG;
		for (const clip of m.clips) ops.push(...buildClip(clip, bXMin, bXMax, bYMin, bYMax, boardBottomZ, boardTopZ, floorTop, overhang, box));
	}
	return { caseAdditive: ops };
}
function buildClip(clip, bXMin, bXMax, bYMin, bYMax, boardBottomZ, boardTopZ, floorTop, overhang, box) {
	const axis = clip.edge === "+x" || clip.edge === "-x" ? "x" : "y";
	const inwardSign = clip.edge === "-x" || clip.edge === "-y" ? 1 : -1;
	const boardEdge = clip.edge === "-x" ? bXMin : clip.edge === "+x" ? bXMax : clip.edge === "-y" ? bYMin : bYMax;
	const tCenter = axis === "x" ? bYMin + clip.offset : bXMin + clip.offset;
	const armInner = boardEdge - inwardSign * GAP;
	const armOuter = boardEdge - inwardSign * 1.95;
	const ledgeInner = boardEdge + inwardSign * LEDGE_D;
	const hookInner = boardEdge + inwardSign * overhang;
	const nr = (a, b) => [Math.min(a, b), Math.max(a, b)];
	const [armLo, armHi] = nr(armInner, armOuter);
	const [ledLo, ledHi] = nr(armInner, ledgeInner);
	const [hookLo, hookHi] = nr(armInner, hookInner);
	const w = clip.width ?? CLIP_W;
	const tLo = tCenter - w / 2;
	const tHi = tCenter + w / 2;
	const armZLo = floorTop - EMBED;
	const armZHi = boardTopZ + HOOK_THK;
	const mk = (nLo, nHi, zLo, zHi) => axis === "y" ? box(tLo, tHi, nLo, nHi, zLo, zHi) : box(nLo, nHi, tLo, tHi, zLo, zHi);
	return [
		mk(armLo, armHi, armZLo, armZHi),
		mk(ledLo, ledHi, boardBottomZ - LEDGE_THK, boardBottomZ),
		mk(hookLo, hookHi, boardTopZ, boardTopZ + HOOK_THK)
	];
}

// vendor/casemaker/casemaker-app/src/engine/compiler/hinges.ts
const NO_HATS = [];
const NO_RESOLVE = () => void 0;
const NO_RESOLVE_DISPLAY$1 = () => void 0;
const EMPTY_OPS = {
	caseAdditive: [],
	lidAdditive: [],
	subtractive: [],
	pinNode: null
};
/** Tolerance added to the through-hole radius beyond pinDiameter/2 (mm). */
const PIN_HOLE_TOLERANCE = .1;
/**
* Issue #114 — the screw the `hardware-screw` style is built around.
*
* The published design this style comes from (Whity's Rugged Box, Printables 258431) closes its
* hinge with two short M3 screws instead of one pin down the middle. Only M3 is in scope — #114
* defers M2.5 / M4 — so there is deliberately no `screwSize` field to hold a single value.
*
* `length` is the screw's under-head length: the two knuckles it closes plus `engage` of proud
* thread across the far face. Everything geometric about the style is derived from these three
* numbers, so the bores and the hardware list cannot drift apart.
*/
const HARDWARE_SCREW = {
	size: "M3",
	length: 8,
	engage: 1
};
/** Printable wall around the screw's clearance bore in a pivot boss (mm). */
const MIN_SCREW_BOSS_WALL = 1.5;
/**
* Map the face's u-axis to a rotation that aligns +Z (cylinder primitive
* axis) with that direction. cylinder() runs along +Z; we orient it along
* the in-plane u-direction of the chosen hinge face.
*
*  - ±y faces have uAxis = +x → rotate +Z to +X via rotate([0, 90, 0]).
*  - ±x faces have uAxis = +y → rotate +Z to +Y via rotate([-90, 0, 0]).
*
* Same convention as `axisCylinder()` for ±x / ±y, but inverted: the hinge
* axis is the face's TANGENT, not its normal.
*/
function orientAlongFaceU(op, face) {
	if (face === "+y" || face === "-y") return rotate([
		0,
		90,
		0
	], op);
	return rotate([
		-90,
		0,
		0
	], op);
}
/**
* Issue #110 — normalize HingeFeature based on style. Piano-continuous
* derives many tightly-spaced knuckles from hingeLength so the user's
* numKnuckles is overridden. Pip-pivot forces N=2 for the captive-pip
* mechanism. Other styles pass through.
*
* Done as a pure function so the existing computeAxisLayout +
* buildHingeOps loop body keeps working unchanged.
*/
function normalizeHingeForStyle(hinge) {
	if (hinge.style === "piano-continuous") {
		const targetPitch = hinge.knuckleOuterDiameter + Math.max(hinge.knuckleClearance, .4);
		const N = Math.max(5, Math.floor(hinge.hingeLength / targetPitch));
		const oddN = N % 2 === 0 ? N + 1 : N;
		return {
			...hinge,
			numKnuckles: oddN
		};
	}
	if (hinge.style === "pip-pivot") return {
		...hinge,
		numKnuckles: 3,
		pinMode: "separate"
	};
	if (hinge.style === "hardware-screw") {
		const minOD = FASTENERS[HARDWARE_SCREW.size].clearance.normal + 2 * MIN_SCREW_BOSS_WALL;
		return {
			...hinge,
			numKnuckles: 4,
			pinMode: "separate",
			knuckleOuterDiameter: Math.max(hinge.knuckleOuterDiameter, minOD)
		};
	}
	return hinge;
}
function computeAxisLayout(hinge, faceLen) {
	const N = Math.max(3, Math.floor(hinge.numKnuckles));
	const clearance = Math.max(0, hinge.knuckleClearance);
	if (hinge.style === "hardware-screw") {
		const perCluster = Math.max(1, Math.floor(N / 2));
		const knuckleLen = Math.max(1.5, (HARDWARE_SCREW.length - HARDWARE_SCREW.engage - (perCluster - 1) * clearance) / perCluster);
		const cluster = perCluster * knuckleLen + (perCluster - 1) * clearance;
		if (2 * perCluster === N && 2 * cluster + clearance <= faceLen) {
			const positions = [];
			for (let i = 0; i < perCluster; i++) positions.push(i * (knuckleLen + clearance));
			for (let i = 0; i < perCluster; i++) positions.push(faceLen - cluster + i * (knuckleLen + clearance));
			return {
				positions,
				knuckleLen,
				faceLen
			};
		}
	}
	const knuckleLen = Math.max(1, hinge.hingeLength - (N - 1) * clearance) / N;
	const pitch = knuckleLen + clearance;
	let uStart;
	switch (hinge.positioning) {
		case "continuous":
			uStart = 0;
			break;
		case "pair-at-ends":
			uStart = 0;
			break;
		default: uStart = (faceLen - hinge.hingeLength) / 2;
	}
	return {
		positions: Array.from({ length: N }, (_, i) => uStart + i * pitch),
		knuckleLen,
		faceLen
	};
}
/** Build a single knuckle solid placed at the given (x, y, z) origin —
*  the "start" face of the rotated cylinder along its axis. Caller decides
*  whether the origin is in WORLD or LID-LOCAL coordinates; this helper is
*  frame-agnostic. */
function buildKnuckle(hinge, origin, knuckleLen) {
	const radius = hinge.knuckleOuterDiameter / 2;
	const cyl = cylinder(knuckleLen, radius, 32);
	return translate(origin, orientAlongFaceU(cyl, hinge.face));
}
/** How far the #121/#263 fairings reach into the solid they are bridging to.
*  One millimetre is enough for manifold to fuse on rather than touch. */
const FAIRING_INTO_WALL = 1;
/** Issue #121 — small "fairing tab" cube that bridges the lid knuckle's
*  top arc with the lid plate's underside, giving manifold a volumetric
*  overlap to fuse instead of single-line contact. Returns null when the
*  geometry is degenerate.
*
*  The cube spans the knuckle's u-extent (knuckleLen), 2·knuckleR in the
*  outward normal (n) direction, and EMBED in z. It sits with its bottom
*  face 1 mm BELOW the lid plate underside (overlapping the cylinder
*  cross-section's top arc) and its top 0.5 mm ABOVE (overlapping the
*  lid plate). Net visual effect is a small fillet around each knuckle's
*  attachment to the lid plate — the kind a real hinge has anyway.
*/
function buildKnuckleLidFairing(hinge, origin, knuckleLen) {
	const knuckleR = hinge.knuckleOuterDiameter / 2;
	const FAIRING_BELOW = FAIRING_INTO_WALL;
	const fairingHeight = 1.5;
	const isPmY = hinge.face === "+y" || hinge.face === "-y";
	const cubeOp = isPmY ? cube([
		knuckleLen,
		2 * knuckleR,
		fairingHeight
	], false) : cube([
		2 * knuckleR,
		knuckleLen,
		fairingHeight
	], false);
	const zMin = origin[2] + knuckleR - FAIRING_BELOW;
	const nOffset = -knuckleR;
	const xOff = isPmY ? 0 : nOffset;
	const yOff = isPmY ? nOffset : 0;
	return translate([
		origin[0] + xOff,
		origin[1] + yOff,
		zMin
	], cubeOp);
}
/** Issue #263 — the case-side counterpart of the #121 fairing.
*
*  A case knuckle's centreline sits `knuckleR` out from the outer face, so the
*  cylinder's cross-section is TANGENT to the wall: the two share a line, not a
*  volume. On a clamshell that line falls inside the alignment flange and
*  manifold fuses them anyway; on a recessed lid the rim is a thin upstanding
*  band with nothing behind the knuckles, and the shell decomposes into a body
*  plus one loose knuckle per case position.
*
*  The fix is #121's shape: a cube spanning the knuckle's own u-extent, reaching
*  `depth` INTO the wall along the face normal and out to the knuckle axis. It
*  overlaps the wall by `depth` (≤ half the wall, so it can never break through
*  into the cavity) and the cylinder everywhere the circle is taller than the
*  cube's z-band. Most of the cube is buried in one or the other; what shows on
*  the print is a thin fillet where the knuckle meets the case, which is what a
*  real hinge looks like anyway.
*/
function buildKnuckleCaseFairing(hinge, origin, knuckleLen, frame, wallThickness) {
	const knuckleR = hinge.knuckleOuterDiameter / 2;
	const depth = Math.min(FAIRING_INTO_WALL, wallThickness / 2);
	if (depth <= .05) return null;
	const halfZ = Math.max(.5, knuckleR * .5);
	const zMin = Math.max(0, origin[2] - halfZ);
	const zMax = origin[2] + halfZ;
	if (zMax - zMin <= .2) return null;
	const out = frame.outwardAxis;
	const nIdx = out[0] !== 0 ? 0 : 1;
	const uIdx = nIdx === 0 ? 1 : 0;
	const size = [
		0,
		0,
		0
	];
	const minCorner = [
		0,
		0,
		0
	];
	const uEnd = origin[uIdx] + frame.uAxis[uIdx] * knuckleLen;
	minCorner[uIdx] = Math.min(origin[uIdx], uEnd);
	size[uIdx] = knuckleLen;
	const nFace = frame.origin[nIdx] - out[nIdx] * depth;
	const nAxis = origin[nIdx];
	minCorner[nIdx] = Math.min(nFace, nAxis);
	size[nIdx] = Math.abs(nAxis - nFace);
	minCorner[2] = zMin;
	size[2] = zMax - zMin;
	return translate(minCorner, cube(size, false));
}
/** Build the through-hole subtractive cylinder spanning the full hinge axis. */
function buildThroughHole(hinge, axisStart) {
	const radius = hinge.pinDiameter / 2 + PIN_HOLE_TOLERANCE;
	const length = hinge.hingeLength + 1;
	const cyl = cylinder(length, radius, 24);
	return translate([
		axisStart[0] - .5 * dirX(hinge.face),
		axisStart[1] - .5 * dirY(hinge.face),
		axisStart[2]
	], orientAlongFaceU(cyl, hinge.face));
}
/**
* For the print-in-place style: a centered pin solid sized to spin freely
* inside the through-hole. Diameter = pinDiameter - knuckleClearance so
* there's knuckleClearance/2 of slop on each side.
*
* The pin extends the full hingeLength and is placed coaxial with the
* through-hole. Slicers print this as a separate floating cylinder that the
* surrounding knuckles capture once the boolean union with the through-hole
* is applied (the hole is wider than the pin).
*/
function buildPrintInPlacePin(hinge, axisStart) {
	const radius = Math.max(.1, hinge.pinDiameter / 2 - hinge.knuckleClearance / 2);
	const cyl = cylinder(hinge.hingeLength, radius, 24);
	return translate(axisStart, orientAlongFaceU(cyl, hinge.face));
}
/**
* Issue #114 — the radius of the bore through one knuckle of a hardware-screw hinge.
*
* The two knuckles of a pair CANNOT both be threaded: a screw biting into the case knuckle and
* the lid knuckle alike would lock the lid shut, and there would be no hinge. The screw is
* driven from outside, so its head bears on the OUTER knuckle and its thread bites that same
* knuckle; the inner knuckle is a running clearance and the lid turns on the plain shank.
* Indices 0 and N-1 are the outer knuckles of the two pairs.
*/
function screwBoreRadius(index, N) {
	const outer = index === 0 || index === N - 1;
	const spec = FASTENERS[HARDWARE_SCREW.size];
	return (outer ? spec.pilotForming : spec.clearance.normal) / 2;
}
/** Issue #114 — a bore spanning exactly ONE knuckle, for the per-screw hinge. A
*  half-mm overshoot at each end gives the boolean a clean exit; for the shell's
*  case knuckles the overshoot lands in the gap beside the boss, which is air. */
function buildKnuckleBore(hinge, origin, knuckleLen, radius) {
	const overshoot = .5;
	const cyl = cylinder(knuckleLen + 2 * overshoot, radius, 24);
	return translate([
		origin[0] - overshoot * dirX(hinge.face),
		origin[1] - overshoot * dirY(hinge.face),
		origin[2]
	], orientAlongFaceU(cyl, hinge.face));
}
/** Sign of the u-axis in world X. +y/-y faces have uAxis = +x → 1; ±x → 0. */
function dirX(face) {
	return face === "+y" || face === "-y" ? 1 : 0;
}
function dirY(face) {
	return face === "+x" || face === "-x" ? 1 : 0;
}
function buildHingeOps(hingeRaw, board, params, hats = NO_HATS, resolveHat = NO_RESOLVE, display = null, resolveDisplay = NO_RESOLVE_DISPLAY$1) {
	if (!hingeRaw || !hingeRaw.enabled) return EMPTY_OPS;
	const dimsForScale = computeShellDims(board, params, hats, resolveHat, display, resolveDisplay);
	const hinge = normalizeHingeForStyle(clampHinge(hingeRaw, dimsForScale));
	const lidDims = computeLidDims(board, params, hats, resolveHat, display, resolveDisplay);
	const dims = dimsForScale;
	const frame = faceFrame(hinge.face, dims.outerX, dims.outerY, dims.outerZ);
	const layout = computeAxisLayout(hinge, hinge.face === "+x" || hinge.face === "-x" ? dims.outerY : dims.outerX);
	const knuckleR = hinge.knuckleOuterDiameter / 2;
	const axisZ = lidDims.zPosition - knuckleR;
	const outX = frame.outwardAxis[0] * knuckleR;
	const outY = frame.outwardAxis[1] * knuckleR;
	const caseAdditive = [];
	const lidAdditive = [];
	const subtractive = [];
	let pinNode = null;
	const N = Math.max(3, Math.floor(hinge.numKnuckles));
	const positions = layout.positions;
	const holeStartX = frame.origin[0] + frame.uAxis[0] * positions[0] + outX;
	const holeStartY = frame.origin[1] + frame.uAxis[1] * positions[0] + outY;
	const lidLocalAxisZ = axisZ - lidDims.zPosition;
	for (let i = 0; i < N; i++) {
		const uMin = positions[i];
		const startX = frame.origin[0] + frame.uAxis[0] * uMin + outX;
		const startY = frame.origin[1] + frame.uAxis[1] * uMin + outY;
		const startZ = axisZ;
		if (i % 2 === 0) {
			caseAdditive.push(buildKnuckle(hinge, [
				startX,
				startY,
				startZ
			], layout.knuckleLen));
			const caseFairing = buildKnuckleCaseFairing(hinge, [
				startX,
				startY,
				startZ
			], layout.knuckleLen, frame, params.wallThickness);
			if (caseFairing) caseAdditive.push(caseFairing);
		} else {
			const knuckle = buildKnuckle(hinge, [
				startX,
				startY,
				lidLocalAxisZ
			], layout.knuckleLen);
			const holeForLid = hinge.style === "hardware-screw" ? buildKnuckleBore(hinge, [
				startX,
				startY,
				lidLocalAxisZ
			], layout.knuckleLen, screwBoreRadius(i, N)) : buildThroughHole(hinge, [
				holeStartX,
				holeStartY,
				lidLocalAxisZ
			]);
			lidAdditive.push(difference([knuckle, holeForLid]));
			const fairingTab = buildKnuckleLidFairing(hinge, [
				startX,
				startY,
				lidLocalAxisZ
			], layout.knuckleLen);
			if (fairingTab) lidAdditive.push(fairingTab);
		}
	}
	if (hinge.style === "hardware-screw") for (let i = 0; i < N; i += 2) {
		const uMin = positions[i];
		subtractive.push(buildKnuckleBore(hinge, [
			frame.origin[0] + frame.uAxis[0] * uMin + outX,
			frame.origin[1] + frame.uAxis[1] * uMin + outY,
			axisZ
		], layout.knuckleLen, screwBoreRadius(i, N)));
	}
	else subtractive.push(buildThroughHole(hinge, [
		holeStartX,
		holeStartY,
		axisZ
	]));
	if ((hinge.style === "print-in-place" || hinge.pinMode === "print-in-place" && (hinge.style === "piano-continuous" || hinge.style === "piano-segmented")) && hinge.style !== "pip-pivot") pinNode = buildPrintInPlacePin(hinge, [
		holeStartX,
		holeStartY,
		axisZ
	]);
	return {
		caseAdditive,
		lidAdditive,
		subtractive,
		pinNode
	};
}

// vendor/casemaker/casemaker-app/src/engine/compiler/customCutouts.ts
const NO_RESOLVE_DISPLAY = () => void 0;
const CUTOUT_FACE_TO_CASE_FACE = {
	top: "+z",
	bottom: "-z",
	back: "+y",
	front: "-y",
	right: "+x",
	left: "-x"
};
/**
* Issue #76 — freeform user-placed cutouts. Each cutout becomes a single
* subtractive op (rect/slot → cube; round → cylinder oriented along the
* face normal). Reuses the centralized face-frame math from #50 so the
* (u, v) → world transform stays consistent with mounting features and
* fan mounts on the same face.
*/
function buildCustomCutouts(cutouts, board, params, hats = [], resolveHat = () => void 0, display = null, resolveDisplay = NO_RESOLVE_DISPLAY) {
	if (!cutouts || cutouts.length === 0) return [];
	const dims = computeShellDims(board, params, hats, resolveHat, display, resolveDisplay);
	const out = [];
	for (const c of cutouts) {
		if (!c.enabled) continue;
		const op = buildOneCutout(c, dims, params);
		if (op) out.push(op);
	}
	return out;
}
function wallThicknessForFace(face, params) {
	if (face === "top") return params.lidThickness;
	if (face === "bottom") return params.floorThickness;
	return params.wallThickness;
}
function buildOneCutout(cutout, dims, params) {
	const caseFace = CUTOUT_FACE_TO_CASE_FACE[cutout.face];
	const frame = faceFrame(caseFace, dims.outerX, dims.outerY, dims.outerZ);
	const cutThru = wallThicknessForFace(cutout.face, params) + 2;
	if (cutout.shape === "round") {
		const radius = cutout.width / 2;
		const cyl = cylinder(cutThru, radius, 32);
		let oriented = cyl;
		if (frame.outwardLetter === "x") oriented = rotate([
			0,
			frame.outwardSign === 1 ? 90 : -90,
			0
		], cyl);
		else if (frame.outwardLetter === "y") oriented = rotate([
			-frame.outwardSign * 90,
			0,
			0
		], cyl);
		const center = placeOnFace(frame, cutout.u, cutout.v, -1);
		return translate(center, oriented);
	}
	const sx = frame.outwardLetter === "x" ? cutThru : cutout.width;
	const sy = frame.outwardLetter === "y" ? cutThru : frame.outwardLetter === "x" ? cutout.width : cutout.height;
	const sz = frame.outwardLetter === "z" ? cutThru : cutout.height;
	const center = placeOnFace(frame, cutout.u, cutout.v, -1);
	const cornerOffset = (() => {
		if (frame.outwardLetter === "x") return [
			0,
			-cutout.width / 2,
			-cutout.height / 2
		];
		if (frame.outwardLetter === "y") return [
			-cutout.width / 2,
			0,
			-cutout.height / 2
		];
		return [
			-cutout.width / 2,
			-cutout.height / 2,
			0
		];
	})();
	const cubeOp = cube([
		sx,
		sy,
		sz
	], false);
	cutout.rotationDeg;
	return translate([
		center[0] + cornerOffset[0],
		center[1] + cornerOffset[1],
		center[2] + cornerOffset[2]
	], cubeOp);
}

// vendor/casemaker/casemaker-app/src/library/hatSchema.ts
const xyzSchema$1 = object({
	x: number().describe("X in millimetres."),
	y: number().describe("Y in millimetres."),
	z: number().describe("Z in millimetres.")
});
const mountingHoleSchema$1 = object({
	id: string().min(1).describe("Unique id for this hole within the HAT."),
	x: number().describe("Hole centre X, millimetres from the board origin."),
	y: number().describe("Hole centre Y, millimetres from the board origin."),
	diameter: number().positive().describe("Hole diameter in millimetres.")
});
const componentKindSchema$1 = _enum([
	"usb-c",
	"usb-a",
	"usb-b",
	"micro-usb",
	"hdmi",
	"micro-hdmi",
	"barrel-jack",
	"ethernet-rj45",
	"gpio-header",
	"sd-card",
	"flat-cable",
	"fan-mount",
	"text-label",
	"antenna-connector",
	"custom"
]);
const cutoutShapeSchema$1 = _enum(["rect", "round"]);
const facingSchema$1 = _enum([
	"+x",
	"-x",
	"+y",
	"-y",
	"+z"
]);
const componentSchema$1 = object({
	id: string().min(1).describe("Unique id for this component within the HAT."),
	kind: componentKindSchema$1.describe("What the component is; this chooses the cutout profile and how the picker draws it."),
	position: xyzSchema$1.describe("Component origin on the HAT, in millimetres."),
	size: xyzSchema$1.refine((s) => s.x > 0 && s.y > 0 && s.z > 0, { message: "component size must be positive on all axes" }).describe("Component extents in millimetres, before any cutout margin is added."),
	facing: facingSchema$1.optional().describe("Face the component sits on; omit for a top-side component."),
	cutoutMargin: number().nonnegative().optional().describe("Extra clearance around the cutout in millimetres; omit for none."),
	cutoutShape: cutoutShapeSchema$1.optional().describe("Cutout outline: a rounded rectangle or a circle; omit for the kind default."),
	fixtureId: string().min(1).optional().describe("Id of a bench fixture that documents how this component is held while probing.")
});
const mountingPositionSchema = object({
	id: string().min(1).describe("Unique id for this mounting position."),
	label: string().min(1).describe("Label shown in the placement picker."),
	offset: object({
		x: number().describe("X offset from the board centre, in millimetres."),
		y: number().describe("Y offset from the board centre, in millimetres.")
	}).describe("Where the HAT sits relative to the main board, in millimetres."),
	rotation: union([
		literal(0),
		literal(90),
		literal(180),
		literal(270)
	]).describe("Rotation of the HAT on the board, in degrees.")
});
const hatProfileSchema = object({
	id: string().min(1).describe("Stable id for the HAT profile."),
	name: string().min(1).describe("Human-readable HAT name."),
	manufacturer: string().min(1).describe("HAT maker."),
	pcb: object({ size: xyzSchema$1.refine((s) => s.x > 0 && s.y > 0 && s.z > 0, { message: "pcb size must be positive on all axes" }).describe("PCB extents in millimetres; Z is the board thickness.") }).describe("The bare HAT PCB."),
	mountingHoles: array(mountingHoleSchema$1).describe("Mounting holes on the HAT; may be empty."),
	headerHeight: number().positive().describe("Height of the stacking header between boards, in millimetres."),
	components: array(componentSchema$1).describe("Components on the HAT that need a cutout, opening or label."),
	compatibleBoards: array(string()).describe("Ids of the main boards this HAT's mounting positions are defined against."),
	mountingPositions: array(mountingPositionSchema).optional().describe("Named placements on a compatible board; omit when the HAT has none."),
	source: string().url().optional().describe("URL the HAT dimensions were taken from."),
	builtin: boolean().describe("True for a profile bundled with the app.")
});
const builtinHatProfileSchema = hatProfileSchema.refine((h) => h.builtin === true && typeof h.source === "string" && h.source.length > 0, { message: "builtin hat profiles must include a source URL for traceability" });

// vendor/casemaker/casemaker-app/src/library/hats/cqrobot-dmx-shield-max485.json
var cqrobot_dmx_shield_max485_default = {
	id: "cqrobot-dmx-shield-max485",
	name: "CQRobot DMX Shield (MAX485)",
	manufacturer: "CQRobot",
	pcb: { "size": {
		"x": 65,
		"y": 54,
		"z": 1.6
	} },
	mountingHoles: [
		{
			"id": "h1",
			"x": 13.97,
			"y": 2.54,
			"diameter": 3.2
		},
		{
			"id": "h2",
			"x": 62,
			"y": 7.62,
			"diameter": 3.2
		},
		{
			"id": "h3",
			"x": 62,
			"y": 35.56,
			"diameter": 3.2
		},
		{
			"id": "h4",
			"x": 15.24,
			"y": 51.4,
			"diameter": 3.2
		}
	],
	headerHeight: 8.5,
	components: [{
		"id": "dmx-xlr-female",
		"kind": "custom",
		"fixtureId": "xlr-3",
		"position": {
			"x": 0,
			"y": 3,
			"z": 1.6
		},
		"size": {
			"x": 20,
			"y": 23,
			"z": 23
		},
		"facing": "-x",
		"cutoutMargin": .2,
		"cutoutShape": "round"
	}, {
		"id": "dmx-xlr-male",
		"kind": "custom",
		"fixtureId": "xlr-3",
		"position": {
			"x": 0,
			"y": 27,
			"z": 1.6
		},
		"size": {
			"x": 20,
			"y": 23,
			"z": 23
		},
		"facing": "-x",
		"cutoutMargin": .2,
		"cutoutShape": "round"
	}],
	compatibleBoards: ["arduino-uno-r3", "arduino-giga-r1-wifi"],
	source: "https://www.halloweenfreak.de/arduino/pdfs/DMX_Shield_Arduino_CTC-DRA-10-R2.pdf",
	builtin: true
};

// vendor/casemaker/casemaker-app/src/library/hats/rpi-poe-plus.json
var rpi_poe_plus_default = {
	id: "rpi-poe-plus",
	name: "Raspberry Pi PoE+ HAT",
	manufacturer: "Raspberry Pi Ltd",
	pcb: { "size": {
		"x": 65,
		"y": 30.5,
		"z": 1.6
	} },
	mountingHoles: [
		{
			"id": "h1",
			"x": 3.5,
			"y": 3.5,
			"diameter": 2.75
		},
		{
			"id": "h2",
			"x": 3.5,
			"y": 27,
			"diameter": 2.75
		},
		{
			"id": "h3",
			"x": 61.5,
			"y": 3.5,
			"diameter": 2.75
		},
		{
			"id": "h4",
			"x": 61.5,
			"y": 27,
			"diameter": 2.75
		}
	],
	headerHeight: 8.5,
	components: [{
		"id": "fan",
		"kind": "custom",
		"position": {
			"x": 28,
			"y": 8,
			"z": 1.6
		},
		"size": {
			"x": 30,
			"y": 30,
			"z": 11
		},
		"facing": "+z"
	}],
	compatibleBoards: [
		"rpi-3b-plus",
		"rpi-4b",
		"rpi-5"
	],
	source: "https://datasheets.raspberrypi.com/poe-plus/poe-plus-hat-product-brief.pdf",
	builtin: true
};

// vendor/casemaker/casemaker-app/src/library/hats/rpi-sense-hat.json
var rpi_sense_hat_default = {
	id: "rpi-sense-hat",
	name: "Raspberry Pi Sense HAT",
	manufacturer: "Raspberry Pi Ltd",
	pcb: { "size": {
		"x": 65,
		"y": 56.5,
		"z": 1.6
	} },
	mountingHoles: [
		{
			"id": "h1",
			"x": 3.5,
			"y": 3.5,
			"diameter": 2.75
		},
		{
			"id": "h2",
			"x": 3.5,
			"y": 53,
			"diameter": 2.75
		},
		{
			"id": "h3",
			"x": 61.5,
			"y": 3.5,
			"diameter": 2.75
		},
		{
			"id": "h4",
			"x": 61.5,
			"y": 53,
			"diameter": 2.75
		}
	],
	headerHeight: 8.5,
	components: [{
		"id": "led-matrix",
		"kind": "custom",
		"position": {
			"x": 12,
			"y": 12,
			"z": 1.6
		},
		"size": {
			"x": 41,
			"y": 41,
			"z": 4
		},
		"facing": "+z"
	}],
	compatibleBoards: [
		"rpi-3b",
		"rpi-4b",
		"rpi-5",
		"rpi-zero-2w"
	],
	source: "https://datasheets.raspberrypi.com/sense-hat/sense-hat-product-brief.pdf",
	builtin: true
};

// vendor/casemaker/casemaker-app/src/library/hats/pimoroni-fan-shim.json
var pimoroni_fan_shim_default = {
	id: "pimoroni-fan-shim",
	name: "Pimoroni Fan SHIM",
	manufacturer: "Pimoroni",
	pcb: { "size": {
		"x": 64,
		"y": 17,
		"z": 1.6
	} },
	mountingHoles: [],
	headerHeight: 5,
	components: [{
		"id": "fan",
		"kind": "custom",
		"position": {
			"x": 24,
			"y": .5,
			"z": 1.6
		},
		"size": {
			"x": 16,
			"y": 16,
			"z": 6
		},
		"facing": "+z"
	}],
	compatibleBoards: [
		"rpi-3b",
		"rpi-4b",
		"rpi-5",
		"rpi-zero-2w"
	],
	source: "https://shop.pimoroni.com/products/fan-shim",
	builtin: true
};

// vendor/casemaker/casemaker-app/src/library/hats/arduino-ethernet-shield-2.json
var arduino_ethernet_shield_2_default = {
	id: "arduino-ethernet-shield-2",
	name: "Arduino Ethernet Shield 2",
	manufacturer: "Arduino",
	pcb: { "size": {
		"x": 68.6,
		"y": 53.4,
		"z": 1.6
	} },
	mountingHoles: [
		{
			"id": "h1",
			"x": 13.97,
			"y": 2.54,
			"diameter": 3.2
		},
		{
			"id": "h2",
			"x": 66.04,
			"y": 7.62,
			"diameter": 3.2
		},
		{
			"id": "h3",
			"x": 66.04,
			"y": 35.56,
			"diameter": 3.2
		},
		{
			"id": "h4",
			"x": 15.24,
			"y": 50.8,
			"diameter": 3.2
		}
	],
	headerHeight: 8.5,
	components: [{
		"id": "rj45",
		"kind": "ethernet-rj45",
		"position": {
			"x": 53,
			"y": 35,
			"z": 1.6
		},
		"size": {
			"x": 16,
			"y": 21,
			"z": 13.5
		},
		"facing": "+y",
		"cutoutMargin": .5
	}, {
		"id": "sd",
		"kind": "sd-card",
		"position": {
			"x": 53,
			"y": 0,
			"z": 1.6
		},
		"size": {
			"x": 12,
			"y": 11,
			"z": 1.6
		},
		"facing": "-y",
		"cutoutMargin": .7
	}],
	compatibleBoards: ["arduino-uno-r3", "arduino-giga-r1-wifi"],
	source: "https://docs.arduino.cc/hardware/ethernet-shield-rev2",
	builtin: true
};

// vendor/casemaker/casemaker-app/src/library/hats/index.ts
const validated$1 = [
	cqrobot_dmx_shield_max485_default,
	rpi_poe_plus_default,
	rpi_sense_hat_default,
	pimoroni_fan_shim_default,
	arduino_ethernet_shield_2_default
].map((raw) => {
	return builtinHatProfileSchema.parse(raw);
});
const builtinHats = Object.freeze(validated$1);
const byId$1 = new Map(builtinHats.map((h) => [h.id, h]));
function getBuiltinHat(id) {
	return byId$1.get(id);
}

// vendor/casemaker/casemaker-app/src/library/displaySchema.ts
const xyzSchema = object({
	x: number().describe("X in millimetres."),
	y: number().describe("Y in millimetres."),
	z: number().describe("Z in millimetres.")
});
const mountingHoleSchema = object({
	id: string().min(1).describe("Unique id for this hole within the display."),
	x: number().describe("Hole centre X, millimetres from the board origin."),
	y: number().describe("Hole centre Y, millimetres from the board origin."),
	diameter: number().positive().describe("Hole diameter in millimetres.")
});
const componentKindSchema = _enum([
	"usb-c",
	"usb-a",
	"usb-b",
	"micro-usb",
	"hdmi",
	"micro-hdmi",
	"barrel-jack",
	"ethernet-rj45",
	"gpio-header",
	"sd-card",
	"flat-cable",
	"fan-mount",
	"text-label",
	"antenna-connector",
	"custom"
]);
const cutoutShapeSchema = _enum(["rect", "round"]);
const facingSchema = _enum([
	"+x",
	"-x",
	"+y",
	"-y",
	"+z"
]);
const componentSchema = object({
	id: string().min(1).describe("Unique id for this component within the display."),
	kind: componentKindSchema.describe("What the component is; this chooses the cutout profile and how the picker draws it."),
	position: xyzSchema.describe("Component origin on the display board, in millimetres."),
	size: xyzSchema.describe("Component extents in millimetres."),
	facing: facingSchema.optional().describe("Face the component sits on; omit for a top-side component."),
	cutoutMargin: number().nonnegative().optional().describe("Extra clearance around the cutout in millimetres; omit for none."),
	cutoutShape: cutoutShapeSchema.optional().describe("Cutout outline: a rounded rectangle or a circle; omit for the kind default.")
});
const displayProfileSchema = object({
	id: string().min(1).describe("Stable id for the display profile."),
	name: string().min(1).describe("Human-readable display name."),
	manufacturer: string().min(1).describe("Display maker."),
	pcb: object({ size: xyzSchema.describe("PCB extents in millimetres; Z is the board thickness.") }).describe("The bare display PCB."),
	activeArea: object({
		x: number().positive().describe("Active area width, in millimetres."),
		y: number().positive().describe("Active area height, in millimetres."),
		offsetX: number().describe("Active area X offset from the PCB centre, in millimetres."),
		offsetY: number().describe("Active area Y offset from the PCB centre, in millimetres.")
	}).describe("The lit area of the display, in millimetres."),
	bezel: object({
		top: number().nonnegative().describe("Bezel width at the top, in millimetres."),
		right: number().nonnegative().describe("Bezel width on the right, in millimetres."),
		bottom: number().nonnegative().describe("Bezel width at the bottom, in millimetres."),
		left: number().nonnegative().describe("Bezel width on the left, in millimetres.")
	}).describe("Bezel widths around the active area, in millimetres."),
	overallHeight: number().positive().describe("Total height of the display assembly, in millimetres."),
	mounting: _enum([
		"gpio-mate",
		"shield",
		"standalone",
		"corner-screws"
	]).describe("How the display is mounted."),
	mountingHoles: array(mountingHoleSchema).describe("Mounting holes on the display; may be empty."),
	interface: _enum([
		"dsi",
		"hdmi",
		"spi",
		"i2c",
		"parallel-rgb"
	]).describe("Electrical interface the display uses."),
	touch: _enum([
		"none",
		"resistive",
		"capacitive-fts",
		"capacitive-ipt"
	]).describe("Touch technology, or none."),
	components: array(componentSchema).describe("Components on the display board that need a cutout or opening."),
	compatibleBoards: array(string()).describe("Ids of the main boards this display can be paired with."),
	source: string().url().optional().describe("URL the display dimensions were taken from."),
	builtin: boolean().describe("True for a profile bundled with the app.")
});
const builtinDisplayProfileSchema = displayProfileSchema.refine((d) => d.builtin === true && typeof d.source === "string" && d.source.length > 0, { message: "builtin display profiles must include a source URL for traceability" });

// vendor/casemaker/casemaker-app/src/library/displays/rpi-7-touch.json
var rpi_7_touch_default = {
	id: "rpi-7-touch",
	name: "Raspberry Pi 7\" Touch Display",
	manufacturer: "Raspberry Pi Ltd",
	pcb: { "size": {
		"x": 193,
		"y": 110,
		"z": 5
	} },
	activeArea: {
		"x": 154.21,
		"y": 85.92,
		"offsetX": 19.4,
		"offsetY": 12.04
	},
	bezel: {
		"top": 12.04,
		"right": 19.4,
		"bottom": 12.04,
		"left": 19.4
	},
	overallHeight: 11,
	mounting: "standalone",
	mountingHoles: [
		{
			"id": "h1",
			"x": 5,
			"y": 5,
			"diameter": 3.2
		},
		{
			"id": "h2",
			"x": 188,
			"y": 5,
			"diameter": 3.2
		},
		{
			"id": "h3",
			"x": 5,
			"y": 105,
			"diameter": 3.2
		},
		{
			"id": "h4",
			"x": 188,
			"y": 105,
			"diameter": 3.2
		}
	],
	"interface": "dsi",
	touch: "capacitive-fts",
	components: [],
	compatibleBoards: [],
	source: "https://datasheets.raspberrypi.com/display/7-inch-display-mechanical-drawing.pdf",
	builtin: true
};

// vendor/casemaker/casemaker-app/src/library/displays/hyperpixel-4.json
var hyperpixel_4_default = {
	id: "hyperpixel-4",
	name: "Pimoroni HyperPixel 4.0",
	manufacturer: "Pimoroni",
	pcb: { "size": {
		"x": 71.8,
		"y": 50.5,
		"z": 1.6
	} },
	activeArea: {
		"x": 84.7,
		"y": 50.8,
		"offsetX": -6.4,
		"offsetY": 0
	},
	bezel: {
		"top": 1.5,
		"right": 1.5,
		"bottom": 1.5,
		"left": 1.5
	},
	overallHeight: 12.5,
	mounting: "gpio-mate",
	mountingHoles: [
		{
			"id": "h1",
			"x": 3.5,
			"y": 3.5,
			"diameter": 2.75
		},
		{
			"id": "h2",
			"x": 3.5,
			"y": 47,
			"diameter": 2.75
		},
		{
			"id": "h3",
			"x": 61.5,
			"y": 3.5,
			"diameter": 2.75
		},
		{
			"id": "h4",
			"x": 61.5,
			"y": 47,
			"diameter": 2.75
		}
	],
	"interface": "spi",
	touch: "capacitive-fts",
	components: [],
	compatibleBoards: [
		"rpi-4b",
		"rpi-zero-2w",
		"rpi-5"
	],
	source: "https://shop.pimoroni.com/products/hyperpixel-4",
	builtin: true
};

// vendor/casemaker/casemaker-app/src/library/displays/index.ts
const validated = [rpi_7_touch_default, hyperpixel_4_default].map((raw) => {
	return builtinDisplayProfileSchema.parse(raw);
});
const builtinDisplays = Object.freeze(validated);
const byId = new Map(builtinDisplays.map((d) => [d.id, d]));
function getBuiltinDisplay(id) {
	return byId.get(id);
}

// vendor/casemaker/casemaker-app/src/engine/compiler/magnets.ts
/** Solid behind a case pocket (between its floor and the cavity), mm. */
const MAGNET_BACKING = 1;
/** Wall of the inside boss around a pocket, mm (four 0.4 mm perimeters). */
const MAGNET_BOSS_WALL = 1.6;
/** Default row pitch beyond the disc, mm. */
const MAGNET_ROW_GAP = 6;
/** Solid between a plate pocket's floor and the text (or the face), mm. */
const NAMEPLATE_FACE_SKIN = .6;
/** Pocket edge to plate edge, mm, when there are two or more magnets. */
const NAMEPLATE_EDGE = 3;
const INWARD = {
	"+x": "-x",
	"-x": "+x",
	"+y": "-y",
	"-y": "+y",
	"+z": "-z",
	"-z": "+z"
};
/** Human face names — UI text and the nameplate's node id. */
const FACE_NAME$1 = {
	"-y": "front",
	"+y": "back",
	"-x": "left",
	"+x": "right",
	"+z": "top",
	"-z": "bottom"
};
const NAMEPLATE_NODE_PREFIX = "nameplate-";
/** The nameplate's node id for a face, e.g. `nameplate-front`. */
function nameplateNodeId(face) {
	return `${NAMEPLATE_NODE_PREFIX}${FACE_NAME$1[face]}`;
}
/**
* Issue #850 — THE DELIBERATE VOIDS: a CAPTURED pocket (skin > 0) is a closed
* cavity inside the part, made on purpose. Each is tagged with the node it
* lands in and the cavity's centre, so the sealed-void report can stay quiet
* about it and speak only about the ones nobody asked for. An OPEN pocket
* (skin 0) cuts through to the face and seals nothing.
*/
function deliberateVoidsFor(pockets) {
	const V = {
		"+x": [
			1,
			0,
			0
		],
		"-x": [
			-1,
			0,
			0
		],
		"+y": [
			0,
			1,
			0
		],
		"-y": [
			0,
			-1,
			0
		],
		"+z": [
			0,
			0,
			1
		],
		"-z": [
			0,
			0,
			-1
		]
	};
	return pockets.filter((p) => p.skin > 0).map((p) => {
		const v = V[p.inward];
		const d = p.skin + p.depth / 2;
		return {
			node: p.face === "+z" ? "lid" : "shell",
			centreMm: [
				p.world[0] + v[0] * d,
				p.world[1] + v[1] * d,
				p.world[2] + v[2] * d
			]
		};
	});
}
function faceExtent(face, c) {
	if (face === "+z" || face === "-z") return [c.outerX, c.outerY];
	if (face === "+y" || face === "-y") return [c.outerX, c.outerZ];
	return [c.outerY, c.outerZ];
}
function wallFor(face, params) {
	if (face === "+z") return params.lidThickness;
	if (face === "-z") return params.floorThickness;
	return params.wallThickness;
}
const r2 = (v) => Math.round(v * 100) / 100;
/** A row of `count` offsets, `pitch` apart, centred on 0. */
function rowOffsets(count, pitch) {
	const n = Math.max(1, Math.floor(count));
	return Array.from({ length: n }, (_, i) => r2((i - (n - 1) / 2) * pitch));
}
/** Magnet offsets along a plate's width: one centred, or spread edge to edge. */
function nameplateOffsets(p) {
	const n = Math.max(1, Math.min(4, Math.floor(p.magnetCount)));
	if (n === 1) return [0];
	const inset = MAGNETS[p.magnetSize].pocket.d / 2 + 3;
	return rowOffsets(n, Math.max(0, p.width - 2 * inset) / (n - 1));
}
function resolveOne(sourceId, face, u, v, size, retention, params, c) {
	const cut = retention === "captured" && !(face === "+z" || face === "-z") ? "glue" : retention;
	const spec = MAGNETS[size];
	const diameter = magnetPocketDiameterForRetention(size, cut);
	const depth = spec.pocket.h;
	const skin = cut === "captured" ? MAGNET_CAPTURE_SKIN : 0;
	const wall = wallFor(face, params);
	const need = skin + depth + 1;
	const onLid = face === "+z";
	const frame = faceFrame(face, c.outerX, c.outerY, onLid ? c.lidTopLocal : c.outerZ);
	const at = placeOnFace(frame, u, v);
	const world = onLid ? [
		at[0],
		at[1],
		at[2] + c.lidZ
	] : at;
	const [fw, fh] = faceExtent(face, c);
	const rad = diameter / 2;
	return {
		sourceId,
		face,
		size,
		retention,
		cut,
		u,
		v,
		at,
		world,
		inward: INWARD[face],
		diameter,
		depth,
		skin,
		wall,
		boss: need > wall ? {
			diameter: r2(diameter + 2 * MAGNET_BOSS_WALL),
			length: r2(need)
		} : null,
		pauseZ: cut === "captured" ? magnetCapturePauseZ(size, skin, MAGNET_PAUSE_LAYER, depth) : null,
		offFace: u - rad < 0 || v - rad < 0 || u + rad > fw || v + rad > fh
	};
}
/**
* Resolve every pocket and the nameplate to numbers. Pure: no geometry.
*/
function resolveMagnets(board, params, hats = [], resolveHat = () => void 0, display = null, resolveDisplay = () => void 0, customFonts = []) {
	const out = {
		pockets: [],
		nameplate: null,
		notes: []
	};
	const list = (params.magnetPockets ?? []).filter((m) => m.enabled);
	const plate = params.nameplate?.enabled ? params.nameplate : null;
	if (list.length === 0 && !plate) return out;
	const dims = computeShellDims(board, params, hats, resolveHat, display, resolveDisplay);
	const lid = computeLidDims(board, params, hats, resolveHat, display, resolveDisplay);
	const c = {
		outerX: dims.outerX,
		outerY: dims.outerY,
		outerZ: dims.outerZ,
		lidTopLocal: lid.z,
		lidZ: lid.zPosition
	};
	for (const m of list) {
		const pitch = m.pitch ?? MAGNETS[m.size].d + 6;
		for (const du of rowOffsets(m.count ?? 1, pitch)) out.pockets.push(resolveOne(m.id, m.face, m.u + du, m.v, m.size, m.retention ?? "glue", params, c));
	}
	if (plate) {
		const offsets = nameplateOffsets(plate);
		const spec = MAGNETS[plate.magnetSize];
		const engraveDepth = plate.textMode === "engrave" ? plate.textDepth : 0;
		const neededThickness = r2(spec.pocket.h + NAMEPLATE_FACE_SKIN + engraveDepth);
		const plateDepth = r2(Math.min(spec.pocket.h, plate.thickness - NAMEPLATE_FACE_SKIN - engraveDepth));
		let typeset;
		try {
			typeset = plate.text.trim() ? centredTextOutline(plate.text, plate.font ?? "sans-default", plate.weight ?? "regular", plate.textSize, customFonts) : null;
		} catch {
			typeset = null;
		}
		for (const du of offsets) {
			const p = resolveOne("nameplate", plate.face, plate.u + du, plate.v, plate.magnetSize, plate.retention ?? "glue", params, c);
			out.pockets.push(p);
		}
		out.nameplate = {
			params: plate,
			nodeId: nameplateNodeId(plate.face),
			offsets,
			plateDepth,
			neededThickness,
			textWidth: typeset ? r2(typeset.width) : 0
		};
		if (plateDepth < spec.pocket.h) out.notes.push(plateDepth <= 0 ? `The nameplate is ${plate.thickness} mm thick; a ${plate.magnetSize} mm magnet needs ${neededThickness} mm, so its back is left without pockets.` : `The nameplate is ${plate.thickness} mm thick; a ${plate.magnetSize} mm magnet needs ${neededThickness} mm. Its pockets are cut ${plateDepth} mm deep, so the magnets stand ${r2(spec.h - plateDepth)} mm proud of the back.`);
		const room = plate.width - 4;
		if (typeset && typeset.width > room) out.notes.push(`The nameplate text is ${r2(typeset.width)} mm wide; the plate leaves ${r2(room)} mm for it. Widen the plate or shrink the text.`);
		if (offsets.length > 1 && offsets[1] - offsets[0] < spec.pocket.d + 1) out.notes.push(`${offsets.length} magnets of ${spec.d} mm do not fit side by side on a ${plate.width} mm plate; use fewer or widen it.`);
	}
	for (const p of out.pockets) {
		const who = p.sourceId === "nameplate" ? "A nameplate pocket" : "A magnet pocket";
		const where = FACE_NAME$1[p.face];
		if (p.offFace) {
			const [fw, fh] = faceExtent(p.face, c);
			out.notes.push(`${who} at u ${r2(p.u)} mm, v ${r2(p.v)} mm runs off the ${where} face (${r2(fw)} × ${r2(fh)} mm).`);
		}
		if (p.retention === "captured" && p.cut !== "captured") out.notes.push(`${who} on the ${where} wall cannot be captured: a side wall prints the pocket on edge, so a magnet cannot be dropped in mid-print. It is cut open for glue.`);
	}
	const pauses = /* @__PURE__ */ new Map();
	for (const p of out.pockets) if (p.pauseZ !== null) pauses.set(p.face === "+z" ? "lid" : "case body", p.pauseZ);
	for (const [part, z] of pauses) out.notes.push(`Captured magnets: pause the ${part} print at Z ${z.toFixed(2)} mm (${MAGNET_PAUSE_LAYER} mm layers, after the layer that finishes there) and drop the magnets in; a ${MAGNET_CAPTURE_SKIN} mm skin closes the face.`);
	return out;
}
function projectResolvers(project) {
	const customHats = new Map((project.customHats ?? []).map((h) => [h.id, h]));
	const customDisplays = new Map((project.customDisplays ?? []).map((d) => [d.id, d]));
	return {
		resolveHat: (id) => customHats.get(id) ?? getBuiltinHat(id),
		resolveDisplay: (id) => customDisplays.get(id) ?? getBuiltinDisplay(id)
	};
}
/** A case face's (u, v) extent, mm — for defaults that land mid-face. */
function faceSizeForProject(project, face) {
	const r = projectResolvers(project);
	const dims = computeShellDims(project.board, project.case, project.hats ?? [], r.resolveHat, project.display, r.resolveDisplay);
	return faceExtent(face, {
		outerX: dims.outerX,
		outerY: dims.outerY,
		outerZ: dims.outerZ,
		lidTopLocal: 0,
		lidZ: 0
	});
}
/** The inside boss for one resolved pocket, or null when the wall is thick
*  enough. Same frame as `pocketCutter` (WORLD for the shell, LID-LOCAL for
*  '+z'). Started 0.05 mm inside the face so it never shares the face's plane. */
function pocketBossOp(p) {
	if (!p.boss) return null;
	return magnetPocketBoss({
		at: p.at,
		axis: p.inward,
		start: .05,
		length: p.boss.length - .05,
		diameter: p.boss.diameter
	});
}
/** Cutter for one resolved case pocket (exported for the specs). */
function pocketCutter$1(p) {
	return magnetPocket({
		size: p.size,
		at: p.at,
		axis: p.inward,
		diameter: p.diameter,
		depth: p.depth,
		skin: p.skin,
		material: Math.max(p.wall, p.boss?.length ?? 0),
		floor: 1
	});
}
/** The nameplate as a solid, in the plate's own frame: centred on the origin
*  in x/y, back face at z = 0, front (text) face at z = thickness. */
function buildNameplateLocal(plate, resolved, customFonts = []) {
	const t = plate.thickness;
	const body = translate([
		-plate.width / 2,
		-plate.height / 2,
		0
	], roundedRectPrism(plate.width, plate.height, t, plate.cornerRadius ?? 2));
	const cuts = [];
	if (resolved.plateDepth > 0) for (const du of resolved.offsets) cuts.push(magnetPocket({
		size: plate.magnetSize,
		at: [
			du,
			0,
			0
		],
		axis: "+z",
		depth: resolved.plateDepth
	}));
	const typeset = plate.text.trim() ? centredTextOutline(plate.text, plate.font ?? "sans-default", plate.weight ?? "regular", plate.textSize, customFonts) : null;
	let solid = body;
	if (typeset) {
		if (plate.textMode === "engrave") cuts.push(translate([
			0,
			0,
			t - plate.textDepth
		], extrude(typeset.outline, plate.textDepth + .05)));
		else solid = union$1([body, translate([
			0,
			0,
			t - .2
		], extrude(typeset.outline, plate.textDepth + .2))]);
	}
	return cuts.length > 0 ? difference([solid, ...cuts]) : solid;
}
/**
* The ops for the case's magnets and the nameplate node. Every list is empty,
* and `nameplate` null, for a project with neither — the compiler then adds
* nothing, so such a project's plan is unchanged.
*/
function buildMagnetOps(board, params, hats = [], resolveHat = () => void 0, display = null, resolveDisplay = () => void 0, customFonts = []) {
	const facts = resolveMagnets(board, params, hats, resolveHat, display, resolveDisplay, customFonts);
	const out = {
		shellAdd: [],
		shellCut: [],
		lidAdd: [],
		lidCut: [],
		nameplate: null,
		facts
	};
	for (const p of facts.pockets) {
		const onLid = p.face === "+z";
		const boss = pocketBossOp(p);
		if (boss) (onLid ? out.lidAdd : out.shellAdd).push(boss);
		(onLid ? out.lidCut : out.shellCut).push(pocketCutter$1(p));
	}
	const np = facts.nameplate;
	if (np) {
		const plate = np.params;
		let op = buildNameplateLocal(plate, np, customFonts);
		for (const r of faceRotations(plate.face)) op = rotate(r, op);
		const onLid = plate.face === "+z";
		const dims = computeShellDims(board, params, hats, resolveHat, display, resolveDisplay);
		const lid = computeLidDims(board, params, hats, resolveHat, display, resolveDisplay);
		const frame = faceFrame(plate.face, dims.outerX, dims.outerY, onLid ? lid.z + lid.zPosition : dims.outerZ);
		out.nameplate = {
			id: np.nodeId,
			op: translate(placeOnFace(frame, plate.u, plate.v), op)
		};
	}
	return out;
}

// vendor/casemaker/casemaker-app/src/engine/compiler/holeGrid.ts
/** Nudge, so a lattice that fits exactly (`hi - lo` an exact multiple of `pitch`)
*  gets its last row rather than losing it to a floating-point 11.999…. */
function spanCount(lo, hi, pitch) {
	if (hi < lo) return 0;
	return Math.floor((hi - lo) / pitch + 1e-9) + 1;
}
/** The number of sockets a centred lattice fits across a half-span. Odd, so the
*  centre line carries one; see `HoleGridAnchor`. */
function centredCount(halfSpan, pitch) {
	if (halfSpan < 0) return 0;
	return 2 * Math.floor(halfSpan / pitch + 1e-9) + 1;
}
/**
* Socket centres, in the outline's own XY frame.
*
* `'bbox'` is ANCHORED at the outline's bounding box, not centred on it;
* `'centre'` is symmetric about the middle with an odd count. Which is right
* depends on whether the outline is a one-off cavity or one member of a family
* of sizes — the reasoning is on `HoleGridAnchor`.
*/
function holeGridCentres(outline, opts) {
	const { pitch, socket, margin, anchor = "bbox" } = opts;
	const b = aabbOfProfile(outline);
	if (!b) return [];
	const inset = margin + socket / 2;
	const out = [];
	if (anchor === "centre") {
		const midX = (b.min[0] + b.max[0]) / 2;
		const midY = (b.min[1] + b.max[1]) / 2;
		const cols = centredCount((b.max[0] - b.min[0]) / 2 - inset, pitch);
		const rows = centredCount((b.max[1] - b.min[1]) / 2 - inset, pitch);
		for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push([midX + (c - (cols - 1) / 2) * pitch, midY + (r - (rows - 1) / 2) * pitch]);
		return out;
	}
	const loX = b.min[0] + inset;
	const loY = b.min[1] + inset;
	const cols = spanCount(loX, b.max[0] - inset, pitch);
	const rows = spanCount(loY, b.max[1] - inset, pitch);
	for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push([loX + c * pitch, loY + r * pitch]);
	return out;
}
/**
* The POCKET that makes the grid: every socket as one profile, clipped to
* `pOffset(outline, -margin)` and minus the keep-outs.
*
* Cut it with `difference([slab, extrude(pocket, depth)])` for a blind grid, or
* omit the slab's floor for a through grid. The clip is a no-op for a
* rectangular outline and trims the outer sockets on a rounded one, so a
* rounded-corner cavity gets sockets whose corners follow the wall instead of
* four sockets hanging over a radius.
*
* Returns an empty region (an empty union) when the outline is too small for
* even one socket, or when a keep-out swallows the field.
*/
function holeGridPocket(outline, opts) {
	const { margin, socket, keepOut = [] } = opts;
	const centres = holeGridCentres(outline, opts);
	if (centres.length === 0) return pUnion([]);
	const sockets = pUnion(centres.map((c) => pTranslate(c, rectProfile(socket, socket, true))));
	const field = pOffset(outline, -margin, "miter");
	return pDifference([pIntersection([sockets, field]), ...keepOut]);
}

// vendor/casemaker/casemaker-app/src/engine/compiler/dividerPegs.ts
/**
* Issue #150 — the drop-in peg family that fits the `holeGrid` sockets.
*
* A peg is one wall plate with a square tenon under each end. Drop it in and it
* partitions the cavity; take it out and the floor is flat again. Widths are
* quoted in HOLE SPANS, which is how the reviewed system quotes them too, so a
* peg is described by the grid it lands in rather than by a millimetre figure
* that stops being true when the pitch changes.
*
* Everything here is in the PEG's own frame: X along the wall, Y across its
* thickness, Z up from the floor plane. The tenons hang BELOW z = 0, into the
* sockets — so the part sits in assembly orientation and a host can place it at
* the floor's Z with no further transform.
*/
/** End overhang past the outer tenon, per side, mm.
*
*  Measured, not chosen. ToolStack's pegs are 21.6 wide spanning 2 holes and
*  33.6 spanning 3 (`/Toolbox.md`, "Interface 3 of 3"), against a 12.0 pitch:
*  (21.6 − 12.0) / 2 = 4.8 and (33.6 − 24.0) / 2 = 4.8. The 5-hole peg measures
*  56.6, which the same rule would put at 57.6 — 1.0 mm adrift on a 56.6 mm
*  hand-measurement, so the rule is kept and the outlier recorded here rather
*  than averaged in. */
const PEG_WIDTH_EAR = 4.8;
/** Socket side minus tenon side, mm — the slip fit that lets a peg drop in.
*
*  PROVISIONAL: this is a FIT, and no peg has been printed here. It is the one
*  number in this module that is ours rather than measured, and #153's fit
*  variants are where it should get a measured value. A loose 0.4 will rattle;
*  a tight 0.2 will not drop in on a printer running wide. */
const PEG_TENON_FIT = .3;
/** How far the tenon stops short of the socket floor, mm.
*
*  PROVISIONAL, same reason. A gap keeps a stray blob or a bit of swarf from
*  holding the peg proud and rocking the divider. */
const PEG_TENON_BOTTOM_GAP = .4;
/**
* The wall's overall length for a peg spanning `spans` holes: the outer tenon
* centres are `(spans − 1)` pitches apart, plus the end overhang at each end.
*
* This is the rule `PEG_WIDTH_EAR` was derived from, and `tests/unit/
* dividerPegs.spec.ts` pins it against the three measured pegs so a change to
* the ear is caught here rather than in a print.
*/
function pegWidth(spans, pitch, ear = PEG_WIDTH_EAR) {
	return (spans - 1) * pitch + 2 * ear;
}
/** Why these numbers cannot make a peg, or null when they can. */
function dividerPegProblem(spec, ctx) {
	if (!(spec.spans >= 1)) return "A peg must span at least one hole";
	if (!Number.isInteger(spec.spans)) return `Peg ${spec.id}: ${spec.spans} holes is not a whole number of holes`;
	if (!(spec.height > 0)) return `Peg ${spec.id}: height must be greater than zero`;
	if (!(spec.thickness > 0)) return `Peg ${spec.id}: thickness must be greater than zero`;
	const fit = ctx.tenonFit ?? .3;
	if (!(ctx.grid.socket - fit > 0)) return `Peg ${spec.id}: a ${fit} mm fit leaves no tenon in a ${ctx.grid.socket} mm socket`;
	if (!(ctx.socketDepth - (ctx.bottomGap ?? .4) > 0)) return `Peg ${spec.id}: no tenon engages a ${ctx.socketDepth} mm socket`;
	return null;
}
/** One peg as a single connected solid, in assembly orientation (see header). */
function buildDividerPegOp(spec, ctx) {
	if (dividerPegProblem(spec, ctx)) return null;
	const { pitch, socket } = ctx.grid;
	const fit = ctx.tenonFit ?? .3;
	const gap = ctx.bottomGap ?? .4;
	const ear = ctx.ear ?? 4.8;
	const length = pegWidth(spec.spans, pitch, ear);
	const tenonSide = socket - fit;
	const reach = ctx.socketDepth - gap;
	const halfSpan = (spec.spans - 1) * pitch / 2;
	const wall = translate([
		-length / 2,
		-spec.thickness / 2,
		0
	], cube([
		length,
		spec.thickness,
		spec.height
	]));
	const tenons = (spec.spans === 1 ? [0] : [-halfSpan, halfSpan]).map((cx) => translate([
		cx - tenonSide / 2,
		-tenonSide / 2,
		-reach
	], cube([
		tenonSide,
		tenonSide,
		reach
	])));
	return union$1([wall, ...tenons]);
}

// vendor/casemaker/casemaker-app/src/engine/compiler/caseDividers.ts
/**
* Issue #150 — the case-floor host for the divider system: a blind socket grid
* in the floor of a board case, and drop-in dividers that plug into it, each
* printed as its own part.
*
* The primitives are `holeGrid.ts` (the lattice) and `dividerPegs.ts` (the
* wall-with-tenons); the toolbox (#155) is their other host. What this module
* adds is what a BOARD case needs and a toolbox does not:
*
*   - keep-outs. The board, its overhanging components, a mounted display and
*     every floor standoff/boss are taken out of the lattice, so a socket never
*     opens under something it cannot be used beside. Whole sockets only: a
*     socket that would touch a keep-out is dropped rather than clipped into a
*     sliver no tenon fits.
*   - the floor. A case floor defaults to 2 mm, so a socket can only go as deep
*     as leaves `GRID_FLOOR_UNDER` of floor beneath it. The panel offers to
*     thicken the floor rather than refusing the grid.
*   - the fit. The case's print-fit ladder (#153, `types/snap.ts`
*     `FIT_RELIEF_MM`: tight 0, standard 0.1, loose 0.25 mm) is added to the
*     SOCKET — the cut — never to the tenon, per the ladder's own rule. The
*     tenon is `socket − PEG_TENON_FIT` (0.3 mm, PROVISIONAL, `dividerPegs.ts`).
*     So the side clearance is 0.30 / 0.40 / 0.55 mm.
*
* Pure geometry: no Manifold. The panel and the compiler both read
* `caseDividerFacts`, so a divider the panel reports is exactly the one built.
*/
/** Socket edge to cavity wall, mm. Chosen so a divider ending in the outermost
*  socket still clears the wall: the ear runs `PEG_WIDTH_EAR − socket/2` = 2.3 mm
*  past the socket edge, leaving 0.7 mm to the wall. */
const GRID_WALL_MARGIN = 3;
/** Socket edge to the board, a standoff or a boss, mm. */
const GRID_KEEPOUT_GAP = 1;
/** Floor left under a socket, mm — the triage's `floorThickness ≥ depth + 1.2`. */
const GRID_FLOOR_UNDER = 1.2;
/** Shallowest socket worth cutting, mm: below this the tenon (which stops
*  `PEG_TENON_BOTTOM_GAP` short of the floor) has under 0.6 mm of grip. */
const GRID_MIN_DEPTH = 1;
/** Gap between a divider's top and the lid's underside, mm. */
const DIVIDER_TOP_CLEARANCE = 1;
/** A new divider's wall thickness, mm (the toolbox's divider wall). */
const DIVIDER_THICKNESS = 2.4;
/** Gap a divider keeps from the board or a boss before it counts as a clash, mm. */
const DIVIDER_CLASH_GAP = .5;
const DEFAULT_FLOOR_GRID = {
	enabled: true,
	pitch: 12,
	socket: 5,
	depth: 2
};
const round1 = (n) => Math.round(n * 10) / 10;
const mm = (n) => `${round1(n)} mm`;
function rectsOverlap$1(a, b) {
	return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
}
function rectHitsCircle(r, c) {
	const dx = c.x - Math.max(r.x0, Math.min(c.x, r.x1));
	const dy = c.y - Math.max(r.y0, Math.min(c.y, r.y1));
	return dx * dx + dy * dy < c.r * c.r;
}
function grow(r, g) {
	return {
		x0: r.x0 - g,
		y0: r.y0 - g,
		x1: r.x1 + g,
		y1: r.y1 + g
	};
}
/** Is the point inside a rounded rectangle (corner radius `rad`)? */
function inRoundedRect(x, y, r, rad) {
	if (x < r.x0 - 1e-9 || x > r.x1 + 1e-9 || y < r.y0 - 1e-9 || y > r.y1 + 1e-9) return false;
	if (rad <= 0) return true;
	const cx = Math.max(r.x0 + rad, Math.min(x, r.x1 - rad));
	const cy = Math.max(r.y0 + rad, Math.min(y, r.y1 - rad));
	return (x - cx) ** 2 + (y - cy) ** 2 <= rad * rad + 1e-9;
}
function rectInRoundedRect(inner, outer, rad) {
	return inRoundedRect(inner.x0, inner.y0, outer, rad) && inRoundedRect(inner.x1, inner.y0, outer, rad) && inRoundedRect(inner.x0, inner.y1, outer, rad) && inRoundedRect(inner.x1, inner.y1, outer, rad);
}
/** The board's footprint on the floor, world XY: the PCB plus anything that
*  overhangs it, plus a mounted display. */
function boardFootprint(board, params, display = null, resolveDisplay = () => void 0) {
	const o = cavityOriginXY(params);
	let x0 = 0;
	let y0 = 0;
	let x1 = board.pcb.size.x;
	let y1 = board.pcb.size.y;
	for (const c of board.components) {
		x0 = Math.min(x0, c.position.x);
		y0 = Math.min(y0, c.position.y);
		x1 = Math.max(x1, c.position.x + c.size.x);
		y1 = Math.max(y1, c.position.y + c.size.y);
	}
	if (display?.enabled) {
		const p = resolveDisplay(display.displayId);
		if (p) {
			x0 = Math.min(x0, display.offset.x);
			y0 = Math.min(y0, display.offset.y);
			x1 = Math.max(x1, display.offset.x + p.pcb.size.x);
			y1 = Math.max(y1, display.offset.y + p.pcb.size.y);
		}
	}
	return {
		x0: o.x + x0,
		y0: o.y + y0,
		x1: o.x + x1,
		y1: o.y + y1
	};
}
function resolvers(project) {
	const hatsById = new Map((project.customHats ?? []).map((h) => [h.id, h]));
	const displaysById = new Map((project.customDisplays ?? []).map((d) => [d.id, d]));
	return {
		resolveHat: (id) => hatsById.get(id) ?? getBuiltinHat(id),
		resolveDisplay: (id) => displaysById.get(id) ?? getBuiltinDisplay(id)
	};
}
const WIDEN_FACING = {
	xMin: "-x",
	xMax: "+x",
	yMin: "-y",
	yMax: "+y"
};
const WIDEN_SIDE_NAME = {
	xMin: "left (−X)",
	xMax: "right (+X)",
	yMin: "front (−Y)",
	yMax: "back (+Y)"
};
/**
* Everything the panel says and the compiler builds, from the project alone.
* Returns `enabled: false` (and nothing else of use) when the grid is off.
*/
function caseDividerFacts(project, opts = {}) {
	const { board, case: params } = project;
	const g = params.floorGrid;
	const fit = g?.fit ?? params.fit ?? "tight";
	const fitSource = g?.fit ? "grid" : "case";
	const pitch = g?.pitch ?? 12;
	const socket = g?.socket ?? 5;
	const socketCut = socket + fitRelief(fit);
	const tenon = socket - PEG_TENON_FIT;
	const depthWanted = g?.depth ?? DEFAULT_FLOOR_GRID.depth;
	const depth = Math.max(0, Math.min(depthWanted, params.floorThickness - GRID_FLOOR_UNDER));
	const { resolveHat, resolveDisplay } = resolvers(project);
	const dims = computeShellDims(board, params, project.hats ?? [], resolveHat, project.display, resolveDisplay);
	const wall = params.wallThickness;
	const cavity = {
		x0: wall,
		y0: wall,
		x1: wall + dims.cavityX,
		y1: wall + dims.cavityY
	};
	const innerR = Math.max(0, params.cornerRadius - wall);
	const facts = {
		enabled: g?.enabled === true,
		pitch,
		socket,
		socketCut,
		tenon,
		clearance: socketCut - tenon,
		fit,
		fitSource,
		depthWanted,
		depth,
		floorNeeded: depthWanted + GRID_FLOOR_UNDER,
		columns: [],
		rows: [],
		sockets: [],
		blocked: 0,
		dividerHeight: dims.cavityZ - 1,
		cavityHeight: dims.cavityZ,
		floorZ: params.floorThickness,
		dividers: [],
		notes: [],
		widen: null
	};
	if (!facts.enabled) return facts;
	if (!(pitch > 0) || !(socket > 0) || pitch < socket + 1) {
		facts.notes.push(`A ${mm(pitch)} pitch cannot hold ${mm(socket)} sockets with a wall between them — the pitch needs to be at least ${mm(socket + 1)}.`);
		return facts;
	}
	const outline = pTranslate([cavity.x0, cavity.y0], rectProfile(dims.cavityX, dims.cavityY));
	const centres = holeGridCentres(outline, {
		pitch,
		socket,
		margin: 3
	});
	const x0 = cavity.x0 + 3 + socket / 2;
	const y0 = cavity.y0 + 3 + socket / 2;
	const nCols = new Set(centres.map((c) => c[0])).size;
	const nRows = new Set(centres.map((c) => c[1])).size;
	facts.columns = Array.from({ length: nCols }, (_, i) => x0 + i * pitch);
	facts.rows = Array.from({ length: nRows }, (_, j) => y0 + j * pitch);
	const footprint = boardFootprint(board, params, project.display, resolveDisplay);
	const bosses = computeBossPlacements(board, params).filter((b) => b.position === "bottom").map((b) => ({
		x: b.x,
		y: b.y,
		r: b.outerDiameter / 2
	}));
	const field = grow(cavity, -3);
	const fieldR = Math.max(0, innerR - 3);
	const half = socketCut / 2;
	for (let row = 0; row < nRows; row++) for (let col = 0; col < nCols; col++) {
		const x = facts.columns[col];
		const y = facts.rows[row];
		const sq = {
			x0: x - half,
			y0: y - half,
			x1: x + half,
			y1: y + half
		};
		const h0 = socket / 2;
		if (rectInRoundedRect({
			x0: x - h0,
			y0: y - h0,
			x1: x + h0,
			y1: y + h0
		}, field, fieldR) && !rectsOverlap$1(grow(sq, 1), footprint) && !bosses.some((b) => rectHitsCircle(grow(sq, 1), b))) facts.sockets.push({
			col,
			row,
			x,
			y
		});
		else facts.blocked++;
	}
	if (depth < 1) facts.notes.push(`The floor is ${mm(params.floorThickness)}, which leaves room for only ${mm(depth)} of socket over the ${mm(GRID_FLOOR_UNDER)} kept under it — no sockets are cut. A ${mm(facts.floorNeeded)} floor takes the full ${mm(depthWanted)}.`);
	else if (depth < depthWanted) facts.notes.push(`The sockets are cut ${mm(depth)} deep, not ${mm(depthWanted)}: the ${mm(params.floorThickness)} floor keeps ${mm(GRID_FLOOR_UNDER)} under them. A ${mm(facts.floorNeeded)} floor takes the full depth.`);
	const liveRows = new Set(facts.sockets.map((k) => k.row)).size;
	const liveCols = new Set(facts.sockets.map((k) => k.col)).size;
	if (liveRows < 2 || liveCols < 2) {
		const ported = new Set((project.ports ?? []).filter((p) => p.enabled).map((p) => p.facing));
		const side = [
			"yMax",
			"xMax",
			"yMin",
			"xMin"
		].find((s) => !ported.has(WIDEN_FACING[s]));
		if (side && !opts.trial) {
			const t = params.clearanceTweaks ?? {
				xMin: 0,
				xMax: 0,
				yMin: 0,
				yMax: 0
			};
			for (let by = pitch / 2; by <= 8 * pitch; by += pitch / 2) {
				const trial = caseDividerFacts({
					...project,
					case: {
						...params,
						dividers: [],
						clearanceTweaks: {
							...t,
							[side]: (t[side] ?? 0) + by
						}
					}
				}, { trial: true });
				if (new Set(trial.sockets.map((k) => k.row)).size >= 2 && new Set(trial.sockets.map((k) => k.col)).size >= 2) {
					facts.widen = {
						side,
						by
					};
					break;
				}
			}
		}
		const offer = facts.widen ? ` Widening the ${WIDEN_SIDE_NAME[facts.widen.side]} side by ${mm(facts.widen.by)} makes a bay at least two sockets each way.` : "";
		facts.notes.push(facts.sockets.length === 0 ? `No socket fits: the cavity is sized to the board, and the ${mm(params.internalClearance)} clearance around it is narrower than a socket plus its ${mm(3)} wall margin.${offer}` : `The sockets beside the board make a single ${liveRows < 2 ? "row" : "column"}, so a divider can only run ${liveRows < 2 ? "along X" : "along Y"}.${offer}`);
	}
	const live = new Set(facts.sockets.map((s) => `${s.col},${s.row}`));
	const height = facts.dividerHeight;
	const place = (d, line) => {
		const along = d.axis === "x" ? facts.columns : facts.rows;
		const across = d.axis === "x" ? facts.rows : facts.columns;
		const first = d.start;
		const last = d.start + d.holes - 1;
		const problems = [];
		const lineName = d.axis === "x" ? "row" : "column";
		if (line < 0 || line >= across.length || first < 0 || last >= along.length) {
			problems.push(`it runs off the grid — the floor has ${along.length} ${d.axis === "x" ? "columns" : "rows"} and ${across.length} ${lineName}s`);
			return {
				rect: null,
				problems
			};
		}
		const t = d.thickness ?? 2.4;
		const a0 = along[first] - PEG_WIDTH_EAR;
		const a1 = along[last] + PEG_WIDTH_EAR;
		const c = across[line];
		const rect = d.axis === "x" ? {
			x0: a0,
			x1: a1,
			y0: c - t / 2,
			y1: c + t / 2
		} : {
			x0: c - t / 2,
			x1: c + t / 2,
			y0: a0,
			y1: a1
		};
		if (rectsOverlap$1(grow(rect, .5), footprint)) {
			const lo = d.axis === "x" ? Math.max(rect.x0, footprint.x0) : Math.max(rect.y0, footprint.y0);
			const hi = d.axis === "x" ? Math.min(rect.x1, footprint.x1) : Math.min(rect.y1, footprint.y1);
			const ax = d.axis === "x" ? "X" : "Y";
			problems.push(hi > lo ? `it runs into the board from ${ax} ${mm(lo)} to ${mm(hi)}` : `it stands within ${mm(DIVIDER_CLASH_GAP)} of the board`);
		} else if (bosses.some((b) => rectHitsCircle(grow(rect, .5), b))) problems.push("it runs into a board standoff");
		if (!rectInRoundedRect(rect, cavity, innerR)) problems.push("its end runs into the case wall");
		if (opts.extraClash) problems.push(...opts.extraClash(rect, d, {
			floorZ: facts.floorZ,
			depth,
			height
		}));
		for (const idx of [first, last]) {
			const key = d.axis === "x" ? `${idx},${line}` : `${line},${idx}`;
			if (!live.has(key)) problems.push(`its tenon at ${d.axis === "x" ? `column ${idx + 1}` : `row ${idx + 1}`} has no socket under it`);
		}
		return {
			rect,
			problems
		};
	};
	(params.dividers ?? []).forEach((d, i) => {
		const label = `Divider ${i + 1}`;
		if (!d.enabled) return;
		const length = pegWidth(d.holes, pitch);
		if (!(Number.isInteger(d.holes) && d.holes >= 2 && Number.isInteger(d.line) && Number.isInteger(d.start))) {
			facts.dividers.push({
				id: d.id,
				label,
				builds: false,
				length,
				height,
				rect: {
					x0: 0,
					y0: 0,
					x1: 0,
					y1: 0
				},
				clashes: [`${label} needs a whole number of sockets, at least 2, on a whole grid line — it is not built.`],
				moveTo: null,
				shortenTo: null,
				makeRoom: null
			});
			return;
		}
		const here = place(d, d.line);
		let moveTo = null;
		if (here.problems.length > 0) {
			const lines = (d.axis === "x" ? facts.rows : facts.columns).length;
			for (let k = 1; k < lines && moveTo === null; k++) for (const cand of [d.line - k, d.line + k]) if (cand >= 0 && cand < lines && place(d, cand).problems.length === 0) {
				moveTo = cand;
				break;
			}
		}
		facts.dividers.push({
			id: d.id,
			label,
			builds: height > 0 && depth >= 1 && facts.sockets.length > 0,
			length,
			height,
			rect: here.rect ?? {
				x0: 0,
				y0: 0,
				x1: 0,
				y1: 0
			},
			clashes: here.problems.map((p) => `${label}: ${p}.`),
			moveTo,
			shortenTo: null,
			makeRoom: null
		});
	});
	const placed = facts.dividers.filter((d) => d.builds && d.rect.x1 > d.rect.x0);
	const byId = new Map((params.dividers ?? []).map((d) => [d.id, d]));
	/** Every span of `d` on its own line with `holes` sockets, fewest dropped first. */
	const trims = (d) => {
		const out = [];
		for (let holes = d.holes - 1; holes >= 2; holes--) for (let start = d.start; start + holes <= d.start + d.holes; start++) out.push({
			start,
			holes
		});
		return out;
	};
	const clearOf = (rect, skip) => placed.every((o) => skip.includes(o.id) || !rectsOverlap$1(rect, o.rect));
	for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) if (rectsOverlap$1(placed[i].rect, placed[j].rect)) {
		const first = placed[i];
		const later = placed[j];
		later.clashes.push(`${later.label}: it crosses ${first.label} — only one can seat there.`);
		const d = byId.get(first.id);
		if (d && !later.makeRoom) for (const t of trims(d)) {
			const trial = place({
				...d,
				...t
			}, d.line);
			if (trial.rect && trial.problems.length === 0 && clearOf(trial.rect, [first.id])) {
				later.makeRoom = {
					id: first.id,
					label: first.label,
					...t
				};
				break;
			}
		}
	}
	for (const f of facts.dividers) {
		const d = byId.get(f.id);
		if (!d || f.moveTo !== null || f.clashes.length === 0 || !f.builds) continue;
		if (f.clashes.every((c) => c.includes("only one can seat there"))) continue;
		for (const t of trims(d)) {
			const trial = place({
				...d,
				...t
			}, d.line);
			if (trial.rect && trial.problems.length === 0 && clearOf(trial.rect, [f.id])) {
				f.shortenTo = t;
				break;
			}
		}
	}
	return facts;
}
/** The node id a case divider exports under. The axis is in the id because the
*  print table lays an X wall and a Y wall down with different turns. */
function caseDividerNodeId(d) {
	return `case-divider-${d.axis}-${d.id}`;
}
/**
* The shell's socket cut and the divider parts. Both empty for a project with
* no enabled grid, so its plan is unchanged.
*/
function buildCaseDividerOps(project) {
	if (!project.case.floorGrid?.enabled) return {
		floorCut: [],
		nodes: []
	};
	const f = caseDividerFacts(project);
	if (f.sockets.length === 0 || f.depth < 1) return {
		floorCut: [],
		nodes: []
	};
	const s = f.socketCut;
	const cutters = f.sockets.map((k) => translate([
		k.x - s / 2,
		k.y - s / 2,
		f.floorZ - f.depth
	], cube([
		s,
		s,
		f.depth + .01
	])));
	const floorCut = [cutters.length === 1 ? cutters[0] : union$1(cutters)];
	const nodes = [];
	const byId = new Map(f.dividers.map((d) => [d.id, d]));
	for (const d of project.case.dividers ?? []) {
		const fact = byId.get(d.id);
		if (!d.enabled || !fact?.builds) continue;
		const op = buildDividerPegOp({
			id: d.id,
			spans: d.holes,
			height: fact.height,
			thickness: d.thickness ?? 2.4,
			enabled: true
		}, {
			grid: {
				pitch: f.pitch,
				socket: f.socket
			},
			socketDepth: f.depth,
			tenonFit: PEG_TENON_FIT,
			bottomGap: PEG_TENON_BOTTOM_GAP
		});
		if (!op) continue;
		const r = fact.rect;
		const cx = (r.x0 + r.x1) / 2;
		const cy = (r.y0 + r.y1) / 2;
		nodes.push({
			id: caseDividerNodeId(d),
			op: translate([
				cx,
				cy,
				f.floorZ
			], d.axis === "y" ? rotate([
				0,
				0,
				90
			], op) : op)
		});
	}
	return {
		floorCut,
		nodes
	};
}

// vendor/casemaker/casemaker-app/src/engine/compiler/bedFit.ts
/**
* Does a p×q rectangle fit on an a×b bed, allowing 90° and diagonal
* rotation? Straight placement first; otherwise the classic rotated-
* rectangle bound: for p > a (long side over bed width), the rectangle
* fits at some angle iff
*   b ≥ (2·p·q·a + (p² − q²)·√(p² + q² − a²)) / (p² + q²).
*
* A LEAF module on purpose: the split machinery (splitPart) and the rack's
* own fit checks both need it, and `rackFit.ts` owns the rack's imports of
* `rack.ts` — keeping the predicate here stops that from becoming a cycle
* (#266). `rackFit` re-exports it for its existing callers.
*/
function rectFitsBed(p0, q0, a0, b0) {
	const p = Math.max(p0, q0);
	const q = Math.min(p0, q0);
	const a = Math.max(a0, b0);
	const b = Math.min(a0, b0);
	if (p <= a && q <= b) return true;
	if (q > b) return false;
	const d2 = p * p + q * q - a * a;
	return (2 * p * q * a + (p * p - q * q) * Math.sqrt(d2)) / (p * p + q * q) <= b + 1e-9;
}
/** A part's plan against a bed, the way every archetype asks it. */
function partFitsBed(w, d, printer) {
	return rectFitsBed(w, d, printer.x, printer.y);
}

// vendor/casemaker/casemaker-app/src/engine/compiler/splitPart.ts
/**
* Issue #148 — cut a part that is too big for the bed into pieces that fit,
* and drill the joint that puts it back together.
*
* This module is deliberately ARCHETYPE-BLIND. It is handed a solid already in
* its print orientation (XY is the bed plane), its bounds, the bed, and the
* regions a seam must not cross. It decides WHERE to cut, does the cutting, and
* places the fastener holes from the shared `fasteners.ts` table — it never
* learns whether it is cutting a case shell, a rack panel or a toolbox module.
* The material that hosts the joint (a flange, a rib, a boss) is the
* archetype's business, because only the archetype knows where its own
* material is.
*
* WHY THE SCREW COUNT IS COMPUTED, NOT CHOSEN. The reviewed systems do not use
* a constant: their own counts are 7 screws on a ≈250 mm housing seam, 7 on a
* lid, 10 on a wider drawer — the count tracks the seam. `seamScrewCount`
* encodes that as `ceil(length / SPLIT_SEAM_PITCH)` with a floor of two, so a
* 250 mm seam lands on the same 7 the source system used and a longer seam
* gets more. The pitch itself (40 mm) is CHOSEN and unmeasured — it is a
* starting point for a printed joint, to be settled by printing one, exactly as
* the M5 pilot (#140) and the magnet pockets (#152) are.
*
* WHAT THIS DOES NOT DO, and why (v1):
*  • It does not split along Z. A part taller than the bed has to be re-laid on
*    its side or redesigned, not sawn — and `planSeams` returns null rather
*    than pretending otherwise.
*  • It does not go past two seams (a quadrant). More pieces per axis needs a
*    grid of joints with interior seams, which is a different mechanism.
*  • It leaves nothing behind to hold the pieces: the caller unions its own
*    flange or rib material before subtracting these holes.
*/
/**
* Target spacing between seam screws, mm.
*
* CHOSEN, not measured. 40 mm makes the source systems' 7-screw, ≈250 mm seam
* come out right (`ceil(250/40) = 7`) and leaves a printable gap between
* bosses. A first print is what would move it.
*/
const SPLIT_SEAM_PITCH = 40;
/**
* Smallest piece this will cut, mm.
*
* A sliver is not a piece: it cannot hold a boss, it warps, and it usually
* means the part was barely over the bed to begin with. Below this we decline
* the split rather than hand back confetti.
*/
const MIN_PIECE_SPAN = 24;
/** How far a seam keeps clear of a keep-out region, mm. The cut has a kerf of
*  fit error on both sides in the real part, so separating them by a hair is
*  not enough — the seam has to miss the feature, not graze it. */
const KEEP_OUT_MARGIN = 2;
/**
* Where to cut `bounds` so every piece fits `printer`, or null.
*
* Null means one of three things, all of which the caller should report rather
* than work around: the part already fits (nothing to do), the part is taller
* than the bed (Z is not ours to cut), or no seam placement is possible (a
* quadrant still does not fit, or keep-outs block every position).
*
* Straight-bed reasoning only: `rectFitsBed` is used for its conservative
* answer, but each RESULTING piece is checked with it too, so a piece that
* only fitted diagonally is still accepted — which is the same treatment the
* rack's own fit check gives a part.
*/
function planSeams(bounds, printer, opts = {}) {
	const span = (i) => bounds.max[i] - bounds.min[i];
	const w = span(0);
	const d = span(1);
	if (bounds.max[2] - bounds.min[2] > printer.z) return null;
	if (rectFitsBed(w, d, printer.x, printer.y)) return null;
	const halfX = rectFitsBed(w / 2, d, printer.x, printer.y);
	const halfY = rectFitsBed(w, d / 2, printer.x, printer.y);
	const quarter = rectFitsBed(w / 2, d / 2, printer.x, printer.y);
	const axes = [];
	if (halfX && halfY) axes.push(w / printer.x >= d / printer.y ? 0 : 1);
	else if (halfX) axes.push(0);
	else if (halfY) axes.push(1);
	else if (quarter) axes.push(0, 1);
	else return null;
	const seams = [];
	for (const axis of axes) {
		const at = placeSeam(axis, bounds, opts);
		if (at === null) return null;
		seams.push({
			axis,
			at
		});
	}
	return seams;
}
/**
* The seam coordinate on one axis: the midpoint when it is free, otherwise the
* nearest legal offset that clears every keep-out.
*
* "Legal" means both pieces stay at least MIN_PIECE_SPAN long — a seam that
* clears a port by running through the end wall has not helped.
*/
function placeSeam(axis, bounds, opts) {
	const min = bounds.min[axis];
	const max = bounds.max[axis];
	const lo = min + 24;
	const hi = max - 24;
	if (hi < lo) return null;
	const mid = (min + max) / 2;
	const blocking = blockers(axis, bounds, opts);
	const legal = (t) => {
		if (t < lo || t > hi) return false;
		for (const b of blocking) if (t > b[0] && t < b[1]) return false;
		return true;
	};
	if (legal(mid)) return mid;
	const step = .5;
	for (let off = step; off <= (max - min) / 2; off += step) for (const t of [mid - off, mid + off]) if (legal(t)) return t;
	return null;
}
/** [lo, hi) spans along `axis` that the seam must stay out of, grown by the
*  margin. Only keep-outs whose other axes actually reach the part count. */
function blockers(axis, bounds, opts) {
	const margin = opts.margin ?? 2;
	const out = [];
	for (const b of opts.keepOut ?? []) {
		let reaches = true;
		for (const other of [
			0,
			1,
			2
		]) {
			if (other === axis) continue;
			if (b.max[other] < bounds.min[other] || b.min[other] > bounds.max[other]) reaches = false;
		}
		if (!reaches) continue;
		out.push([b.min[axis] - margin, b.max[axis] + margin]);
	}
	return out;
}
/**
* Cut `op` along the seams. Returns one piece per grid cell, in cell order
* (X outer, Y inner), whether or not the cell has any material — a caller that
* needs to know can look at the op it gets back.
*/
function splitBySeams(op, bounds, seams) {
	const cutsOn = (axis) => seams.filter((s) => s.axis === axis).map((s) => s.at).sort((a, b) => a - b);
	const edges = (axis) => {
		const cuts = cutsOn(axis);
		return [
			bounds.min[axis] - 1,
			...cuts,
			bounds.max[axis] + 1
		];
	};
	const xs = edges(0);
	const ys = edges(1);
	const zLo = bounds.min[2] - 1;
	const zHi = bounds.max[2] + 1;
	const out = [];
	for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < ys.length - 1; j++) {
		const x0 = xs[i];
		const x1 = xs[i + 1];
		const y0 = ys[j];
		const y1 = ys[j + 1];
		const slab = translate([
			x0,
			y0,
			zLo
		], cube([
			x1 - x0,
			y1 - y0,
			zHi - zLo
		]));
		out.push({
			cell: [i, j],
			ranges: {
				x: [x0, x1],
				y: [y0, y1]
			},
			op: intersection$1([op, slab])
		});
	}
	return out;
}
/**
* How many screws a seam of this length needs.
*
* Tracks the seam, the way the reviewed systems' own counts do (7 on a
* ≈250 mm housing seam, 10 on a wider drawer). Two is the floor: a single
* screw lets the pieces rotate about it, which is not a joint.
*/
function seamScrewCount(seamLength) {
	return Math.max(2, Math.ceil(seamLength / 40));
}
/**
* Where the screws sit along a seam, as offsets from `start`, evenly spaced
* and inset from both ends so the outermost screws are not on the corner.
*
* Inset is half a pitch (so the end screws are a full pitch apart, like the
* rest) capped at a quarter of the seam — a short seam must not have its
* half-pitch inset swallow the whole span.
*/
function seamScrewSites(start, end, count) {
	const length = end - start;
	if (count < 2 || length <= 0) return [];
	const inset = Math.min(40 / 2, length / 4);
	const span = length - 2 * inset;
	return Array.from({ length: count }, (_, i) => start + inset + span * i / (count - 1));
}
/** Axis name for a fastener hole that travels the way the seam normal does. */
function seamAxisFacing(axis, positive) {
	if (axis === 0) return positive ? "+x" : "-x";
	return positive ? "+y" : "-y";
}
/**
* The clearance half of a seam joint: a through-hole with an optional head
* seat, cut into the piece the screw ENTERS from.
*
* Both halves of every joint go through these two functions rather than
* calling `screwHole`/`screwStarter` directly, so the clearance, the pilot and
* the head are always the shared table's — the #140 lesson is that a hand-rolled
* hole is a hole nobody has printed.
*/
function jointClearanceHole(at, axis, length, size, head = "socket-cap") {
	return screwHole({
		size,
		at,
		axis,
		through: length,
		head,
		recess: "flush",
		material: length
	});
}
/** The receiving half of a seam joint: a starter hole in the far piece. */
function jointStarterHole(at, axis, depth, size) {
	return screwStarter({
		size,
		at,
		axis,
		depth
	});
}

// vendor/casemaker/casemaker-app/src/engine/compiler/shellSplit.ts
/**
* Issue #148 — the case shell's half of the split: WHERE the joint's material
* goes. `splitPart.ts` decides where to cut and drills the holes; this module
* supplies the laps that the holes go through, because only the case archetype
* knows which side of its own floor is free air.
*
* WHY THE LUGS HANG BELOW THE FLOOR. A case shell is a box; a seam through it
* is a vertical plane, so the screws cross that plane horizontally and each
* head needs ~6 mm of material around it in the vertical plane. Inside the
* cavity that space is the board's — the PCB sits on its standoffs a few mm
* above the floor, and the walls hold the board to within a hair. Under the
* floor is the only side of a shell that is always empty, whatever the board,
* the hats or the ports turn out to be. So the laps are a row of lugs on the
* underside, each a small block straddling the seam: the low piece carries a
* clearance hole with a head seat, the high piece a starter hole, and one
* M3×16 socket cap pulls them together.
*
* WHAT THAT COSTS, SAID PLAINLY (v1 — PROVISIONAL, pending a print):
*  • The printed piece sits 8 mm off the bed on its lugs, so the slicer builds
*    support in that gap and the floor's underside is a supported face. That is
*    the price of the joint; `printMetaForId` says so on the part's own row
*    rather than letting it be discovered on the plate.
*  • An assembled split shell stands on its lugs as well as its feet, 6 mm
*    prouder than the feet alone. Cosmetic and reversible (the split is an
*    OFFER, not a replacement), but it is real.
*  • It does not lock the pieces in shear: the laps are separate bodies joined
*    by screws through clearance holes, so there is the clearance's worth of
*    play along the seam until the screws are tight. That is why `planSeams`
*    keeps seams out of ports and other functional regions.
*  • A SEALED shell is refused outright (see `canSplitShell`) — cutting it
*    opens the gasket channel and gives away the drop resistance #107/#108
*    were for.
*
* The lid's joint is its own module (`lidSplit.ts`, #265): its underside faces
* the board, so "which side is free" has a different answer — one that depends
* on the lid's own mode, not on the board's height. `lugSitesFor` here is the
* shared arithmetic both splits use; only the Z band a lap occupies differs.
*/
/** How far the lug hangs below the floor's underside, mm.
*
* Set by the head it has to bury: an M3 socket cap is 5.5 across and 3.0 tall,
* so the seat needs ~6.1 of material around the screw axis, and a lug centred
* on that axis needs a shade over 6.1 of its own thickness. 8 leaves ~1 mm
* above and below the seat. CHOSEN — a first print settles it. */
const LUG_DROP = 8;
/** Width of one lug along the seam, mm. The head seat is 6.1 across; 12 leaves
*  ~3 mm of wall on each side of it. CHOSEN. */
const LUG_WIDTH = 12;
/** How far each lug laps its own side of the seam, mm — and therefore the
*  screw's engagement, since the screw threads the high piece's whole lap.
*  This is the number that makes an M3×16 the right screw (16 under the head =
*  8 through + 8 engaged), which is the length the source systems used on their
*  own 250 mm seams. */
const LUG_LAP = 8;
/** Solid left behind the end of the starter hole, mm, so the pilot is blind and
*  its end face is never coplanar with the lug's (coincident faces are what a
*  slicer reports as a repair). */
const LUG_BACKING = 3;
/** How far the lug reaches up into the floor, mm, so the union has real volume
*  to fuse rather than a coplanar face (the #119 lesson, same as the feet). */
const LUG_EMBED = .8;
/** Smallest lug worth keeping, mm — below this a clipped lug is a nub. */
const MIN_LUG_SPAN = 5;
/** The screw the joint is designed around. #140's table supplies every number
*  that follows from it; nothing here is hand-rolled. */
const DEFAULT_SPLIT_SCREW = "M3";
/**
* Decide the joint — seams, pieces, lug sites — or null if this shell cannot be
* split at all.
*
* Null is the answer for: a shell that already fits the bed, a shell taller
* than the bed (Z is not ours to cut), no legal seam placement, or a joint the
* chosen screw cannot make. Callers offer the split on a non-null result and
* say why on null.
*/
function planShellJoint(req) {
	const seams = planSeams(req.bounds, req.printer, { keepOut: req.keepOut });
	if (!seams) return null;
	const pieces = splitBySeams(req.shellOp, req.bounds, seams);
	const lugs = [];
	const screws = /* @__PURE__ */ new Set();
	pieces.forEach((piece, index) => {
		for (const seam of seams) for (const lug of lugSitesFor(index, piece, seam, req.bounds)) {
			lugs.push(lug);
			screws.add(lug.screwKey);
		}
	});
	if (screws.size === 0) return null;
	return {
		seams,
		pieces,
		lugs,
		screwCount: screws.size
	};
}
/**
* Every lug one piece needs on one seam, or none if this piece has no room for
* a lap there.
*
* Shared by the planner and the builder so the offer and the geometry can never
* disagree about where a screw goes.
*/
function lugSitesFor(piece, piece_, seam, bounds, widthAxis) {
	const axis = seam.axis;
	const otherAxis = widthAxis ?? (axis === 0 ? 1 : 0);
	if (otherAxis === axis) return [];
	const along = trueRange(axis === 0 ? piece_.ranges.x : piece_.ranges.y, bounds.min[axis], bounds.max[axis]);
	const other = trueRange(otherAxis === 0 ? piece_.ranges.x : otherAxis === 1 ? piece_.ranges.y : [bounds.min[2], bounds.max[2]], bounds.min[otherAxis], bounds.max[otherAxis]);
	const low = piece_.cell[axis] === 0;
	const bandLo = Math.max(low ? seam.at - 8 : seam.at, along[0]);
	const bandHi = Math.min(low ? seam.at : seam.at + 8 + 3, along[1]);
	if (bandHi - bandLo < 5) return [];
	const reach = low ? seam.at - bandLo : Math.min(8, bandHi - seam.at - 1);
	if (reach < 5) return [];
	const sites = seamScrewSites(other[0], other[1], seamScrewCount(other[1] - other[0]));
	const out = [];
	for (const site of sites) {
		const wLo = Math.max(site - 12 / 2, other[0]);
		const wHi = Math.min(site + 12 / 2, other[1]);
		if (wHi - wLo < 5) continue;
		out.push({
			piece,
			axis,
			widthAxis: otherAxis,
			band: [bandLo, bandHi],
			width: [wLo, wHi],
			at: site,
			mouth: low ? bandLo : seam.at,
			low,
			reach,
			screwKey: `${axis}:${seam.at}:${site.toFixed(3)}`
		});
	}
	return out;
}
/**
* Cut the shell and bolt it back together, or null if it should not be offered.
*
* The geometry half of `planShellJoint`. A caller that has already planned the
* joint (the compiler does, to decide what to offer) passes the plan in rather
* than paying for it twice.
*/
function buildShellSplit(req, plan) {
	const size = req.size ?? "M3";
	if (8 < minEngagement(size)) throw new Error(`shell split: a ${size} screw wants ${minEngagement(size)} mm of engagement, and a ${8} mm lap gives it ${8}`);
	const joint = plan ?? planShellJoint(req);
	if (!joint) return null;
	const { seams, pieces } = joint;
	const zTop = Math.max(LUG_EMBED, req.bounds.min[2] + LUG_EMBED);
	const zAxis = zTop - 8 / 2;
	const zLo = zTop - 8;
	const lugsByPiece = /* @__PURE__ */ new Map();
	for (const lug of joint.lugs) {
		const list = lugsByPiece.get(lug.piece);
		if (list) list.push(lug);
		else lugsByPiece.set(lug.piece, [lug]);
	}
	const nodes = pieces.map((piece, index) => {
		let op = piece.op;
		const holes = [];
		for (const lug of lugsByPiece.get(index) ?? []) {
			op = union$1([op, lugBox$1(lug.axis, lug.band[0], lug.band[1], lug.width[0], lug.width[1], zLo, zTop)]);
			const facing = seamAxisFacing(lug.axis, true);
			const at = lug.axis === 0 ? [
				lug.mouth,
				lug.at,
				zAxis
			] : [
				lug.at,
				lug.mouth,
				zAxis
			];
			holes.push(lug.low ? jointClearanceHole(at, facing, lug.reach, size) : jointStarterHole(at, facing, lug.reach, size));
		}
		if (holes.length > 0) op = difference([op, ...holes]);
		return {
			id: pieceId(piece.cell),
			op
		};
	});
	const screwLabel = `${size}×16 socket cap`;
	const label = `Shell split for a ${req.printer.x}×${req.printer.y} mm bed — ${nodes.length} pieces, ${joint.screwCount}× ${screwLabel}`;
	const variant = {
		replaces: ["shell"],
		label
	};
	for (const n of nodes) n.variant = variant;
	return {
		seams,
		pieces,
		nodes,
		screwCount: joint.screwCount,
		screwLabel,
		label
	};
}
/**
* Whether a shell should even be offered a split.
*
* A sealed shell is refused, not warned about: the seam cuts straight through
* the gasket channel and the rim that carries it (#107/#108), and a case that
* has given up its seal to fit on the bed has traded away the thing it was
* built for. Better to say no.
*/
function canSplitShell(sealed) {
	return !sealed;
}
/** Stable, legible node id for a grid cell: the X index as a letter, the Y
*  index 1-based — `shell-split-a1`, `shell-split-b2`. */
function pieceId(cell) {
	return `shell-split-${String.fromCharCode(97 + cell[0])}${cell[1] + 1}`;
}
/**
* A piece's cell, shrunk to the material that is really there.
*
* `splitBySeams` grows the outer edges 1 mm outward so the boundary pieces cut
* cleanly; a seam edge, by contrast, IS the face. Anything placed at the cell's
* edge has to know which of the two it is looking at, or a lug overlaps the
* neighbour across a seam.
*/
function trueRange(range, min, max) {
	return [range[0] < min ? min : range[0], range[1] > max ? max : range[1]];
}
/** One lug, as a box: `[aLo, aHi]` along the seam axis, `[oLo, oHi]` across it. */
function lugBox$1(axis, aLo, aHi, oLo, oHi, zLo, zHi) {
	return axis === 0 ? translate([
		aLo,
		oLo,
		zLo
	], cube([
		aHi - aLo,
		oHi - oLo,
		zHi - zLo
	])) : translate([
		oLo,
		aLo,
		zLo
	], cube([
		oHi - oLo,
		aHi - aLo,
		zHi - zLo
	]));
}

// vendor/casemaker/casemaker-app/src/engine/compiler/rackSplit.ts
/**
* #266 — THE RACK'S OWN PARTS and their split joint.
*
* #148's joint hangs laps under a case floor because a floor has one side that
* is always free air. A rack part has no such luxury: a plate has two faces and
* one of them is visible in the finished rack; a 5 mm plate cannot take a screw
* across its own thickness at all. So the archetype's half of the joint is a
* BUTT STRAP on the part's free face:
*
*   • the strap is a plate on the outside of the part, spanning the seam —
*     band {@link LUG_LAP} to each side, {@link LUG_WIDTH} across, and
*     {@link STRAP_DEPTH} proud of the face so the screw head has material in
*     the plane across the seam;
*   • the screws run ALONG the seam, through the strap's band, exactly as the
*     shell's laps carry theirs, and they are shared `fasteners.ts` parts;
*   • the strap does not thin the part: the plate keeps its 5 mm and the joint
*     adds material instead of relieving it. That is the issue's own reading —
*     "The plate is thin, so the screws want the strap, not the plate."
*
* WHICH FACE. The caller names the free face per part (`face`), because only
* the rack knows what is mounted where: the top plate's TOP, the bottom
* plate's underside (the rack's outside face), a side panel's OUTER side, an
* accessory's underside. The strap's face normal must not be the seam axis
* (a strap protruding along the cut is not a butt joint), so a seam on the
* face axis is refused — for a side panel (thin in X) that means cuts run up
* its depth, which is the only axis `planSeams` can choose there anyway.
*
* SCREW COUNT. The shared `seamScrewCount` — the same seam-length rule the
* body's laps use, floored at two — not a fixed pair: a 250 mm side panel is
* as long a seam as any case and would be under-screwed by two. The sites are
* spread along the strap's WIDTH axis, which for a side panel is its height.
*
* SEAM KEEP-OUTS are the caller's, in the part's own assembly frame. The rack's
* wiring derives the SIDE PANELS' from the same facts `validateRackFit`
* reports on — the accessory screw columns and the fan openings — so a panel
* seam can never slice a column or a fan hole. Plate and accessory seams carry
* none yet: their seams run mid-part and every piece keeps its own end rib
* (where the mounting screws are), and a face plate's slot pitch is a
* follow-up rather than a number this module can derive.
*
* WHAT IT COSTS (v1 — PROVISIONAL, pending a print, like every other joint
* number here): the strap stands proud of the rack's face by {@link STRAP_DEPTH}
* along the seam, on the outside of the finished rack. It is visible; it is
* never inside anything.
*/
/**
* How far the strap stands off the part's face, mm. The head seat needs ~6.1
* of material in the plane across the seam, so 8 — the same room the shell's
* laps are given (LUG_DROP), reused rather than re-chosen.
*/
const STRAP_DEPTH = 8;
/**
* The width axis for a seam given the strap's face: the axis that is neither
* the seam nor the face (the three are always distinct; a seam on the face
* axis is refused).
*/
function widthAxisFor(seam, face) {
	const used = /* @__PURE__ */ new Set([seam.axis, face.axis]);
	if (used.size < 2) return null;
	for (const a of [
		0,
		1,
		2
	]) if (!used.has(a)) return a;
	return null;
}
/**
* Decide the part's joint — seams and strap sites — or null when the part
* fits, is taller than the bed, has no legal seam, or the strap has no face to
* stand on. The plan is metadata arithmetic only; `buildRackPartSplit` is the
* geometry.
*/
function planRackPartSplit(req) {
	const seams = planSeams(req.bounds, req.printer, { keepOut: req.keepOut });
	if (!seams) return null;
	const axes = seams.map((s) => widthAxisFor(s, req.face));
	if (axes.some((a) => a === null)) return null;
	const pieces = splitBySeams(req.partOp, req.bounds, seams);
	const straps = [];
	const screws = /* @__PURE__ */ new Set();
	pieces.forEach((piece, index) => {
		seams.forEach((seam, i) => {
			for (const lug of lugSitesFor(index, piece, seam, req.bounds, axes[i])) {
				straps.push(lug);
				screws.add(lug.screwKey);
			}
		});
	});
	if (screws.size === 0) return null;
	return {
		seams,
		pieces,
		straps,
		screwCount: screws.size,
		widthAxis: axes[0]
	};
}
/** The strap's extents along the face axis: embedded into the part, proud of it. */
function strapDepthRange(req) {
	const { axis, sign } = req.face;
	const faceAt = sign > 0 ? req.bounds.max[axis] : req.bounds.min[axis];
	return sign > 0 ? [faceAt - LUG_EMBED, faceAt - LUG_EMBED + STRAP_DEPTH] : [faceAt + LUG_EMBED - STRAP_DEPTH, faceAt + LUG_EMBED];
}
/** One strap, as a box in the part's frame, from three per-axis extents. */
function strapBox(ext) {
	const size = [
		ext[0][1] - ext[0][0],
		ext[1][1] - ext[1][0],
		ext[2][1] - ext[2][0]
	];
	return translate([
		ext[0][0],
		ext[1][0],
		ext[2][0]
	], cube(size));
}
/**
* Cut the part, add one strap per screw per piece, and drill the joint. The
* nodes are in the part's own frame; the caller positions them as it does the
* whole part.
*/
/** The solid strip a seam runs through, across the part's far horizontal extent. */
function seamBandBox(seam, req, band) {
	const otherAxis = seam.axis === 0 ? 1 : 0;
	const ext = [
		[0, 0],
		[0, 0],
		[0, 0]
	];
	ext[seam.axis] = [Math.max(seam.at - band.width / 2, req.bounds.min[seam.axis]), Math.min(seam.at + band.width / 2, req.bounds.max[seam.axis])];
	ext[otherAxis] = [req.bounds.min[otherAxis], req.bounds.max[otherAxis]];
	ext[2] = band.z;
	return strapBox(ext);
}
function buildRackPartSplit(req, plan, idPrefix = "rack-part") {
	const size = req.size ?? "M3";
	if (8 < minEngagement(size)) throw new Error(`rack split: a ${size} screw wants ${minEngagement(size)} mm of engagement, and a ${8} mm lap gives it ${8}`);
	const joint = plan ?? planRackPartSplit(req);
	if (!joint) return null;
	const pieces = req.seamBand ? splitBySeams(union$1([req.partOp, ...joint.seams.map((seam) => seamBandBox(seam, req, req.seamBand))]), req.bounds, joint.seams) : joint.pieces;
	const depth = strapDepthRange(req);
	const depthMid = (depth[0] + depth[1]) / 2;
	const strapsByPiece = /* @__PURE__ */ new Map();
	for (const lug of joint.straps) {
		const list = strapsByPiece.get(lug.piece);
		if (list) list.push(lug);
		else strapsByPiece.set(lug.piece, [lug]);
	}
	const nodes = pieces.map((piece, index) => {
		let op = piece.op;
		const holes = [];
		for (const lug of strapsByPiece.get(index) ?? []) {
			const ext = [
				[0, 0],
				[0, 0],
				[0, 0]
			];
			ext[lug.axis] = lug.band;
			ext[lug.widthAxis] = lug.width;
			ext[req.face.axis] = depth;
			op = union$1([op, strapBox(ext)]);
			const facing = seamAxisFacing(lug.axis, true);
			const at = [
				0,
				0,
				0
			];
			at[lug.axis] = lug.mouth;
			at[lug.widthAxis] = lug.at;
			at[req.face.axis] = depthMid;
			holes.push(lug.low ? jointClearanceHole(at, facing, lug.reach, size) : jointStarterHole(at, facing, lug.reach, size));
		}
		if (holes.length > 0) op = difference([op, ...holes]);
		return {
			id: rackPieceId(idPrefix, piece.cell),
			op
		};
	});
	const screwLabel = `${size}×${8 * 2} socket cap`;
	const label = `${idPrefix} split for a ${req.printer.x}×${req.printer.y} mm bed — ${nodes.length} pieces, ${joint.screwCount}× ${screwLabel} through an outside butt strap`;
	const variant = {
		replaces: [idPrefix],
		label
	};
	for (const n of nodes) n.variant = variant;
	return {
		seams: joint.seams,
		pieces: joint.pieces,
		nodes,
		screwCount: joint.screwCount,
		screwLabel,
		label
	};
}
/** Stable, legible node id for a rack piece: `rack-top-split-a1`. */
function rackPieceId(partId, cell) {
	return `${partId}-split-${String.fromCharCode(97 + cell[0])}${cell[1] + 1}`;
}

// vendor/casemaker/casemaker-app/src/engine/compiler/rackUMount.ts
/** One rack unit: 44.45 mm (1.75″) — the 19″ racks' own height standard. */
const U_PITCH = 44.45;
/** The gear width the standard asks makers to keep within: around 210 mm (8.45″). */
const GEAR_WIDTH = 210;
/**
* EIA-310's hole pattern within one U, measured from the unit's base: 6.35 / 22.225 / 38.1 mm.
* The standard above says vertical spacing "must follow the same … 19″ rack specification".
*/
const HOLE_OFFSETS_IN_U = [
	6.35,
	22.225,
	38.1
];
/** The hole the rails print: ⌀6.2 takes an M6 bolt or a 10/32 screw; the standard leaves the shape to the maker. */
const RAIL_HOLE_D = 6.2;
/** Rail plate thickness across x. */
const RAIL_T = 12;
/** How far behind the front face the mounting holes sit along the depth. */
const RAIL_HOLE_Y = 15;
/** The deck under the rails: its thickness, and how far past the rails it runs at each side. */
const DECK_T = 6;
/** The 1U blank coupon: the ear beyond its hole, and the plate's thickness. */
const BLANK_EAR = 10;
const BLANK_T = 2.5;
function uMountDims(params) {
	const u = Math.min(12, Math.max(1, Math.trunc(params.u)));
	return {
		u,
		depth: params.depth,
		railH: u * U_PITCH,
		holeX: [12 / 2, 242.525],
		deckW: 260.525
	};
}
/** The hole Z positions for `u` units, from the deck's top face: every unit's three offsets. */
function uMountHoleZs(u) {
	const zs = [];
	for (let unit = 0; unit < u; unit += 1) for (const offset of HOLE_OFFSETS_IN_U) zs.push(unit * U_PITCH + offset);
	return zs;
}
function rail(dims) {
	const plate = roundedRectPrism(12, dims.depth, dims.railH, 2, 12);
	const cuts = [];
	for (const z of uMountHoleZs(dims.u)) cuts.push(translate([
		-1,
		15,
		z
	], axisCylinder("+x", 14, RAIL_HOLE_D / 2, 32)));
	return cuts.length === 0 ? plate : difference([plate, ...cuts]);
}
function deck(dims) {
	return roundedRectPrism(dims.deckW, dims.depth, 6, 3, 12);
}
/**
* The 1U blank: a plate one U tall whose BODY is the standard's 210 mm, with an ear each side
* reaching its rail's holes. The pair of holes on each side sits at the outer two EIA offsets, so
* the coupon proves the standard's positions and the gear width in one part.
*/
function blank1U() {
	const earRun = 10;
	const bodyW = 210;
	const earW = 46.52499999999998 / 2;
	const plate = union$1([
		translate([
			earW,
			0,
			0
		], cube([
			bodyW,
			BLANK_T,
			U_PITCH
		])),
		cube([
			earW,
			BLANK_T,
			U_PITCH
		]),
		translate([
			233.2625,
			0,
			0
		], cube([
			earW,
			BLANK_T,
			U_PITCH
		]))
	]);
	const cuts = [];
	const leftX = earRun;
	for (const x of [leftX, 246.525]) for (const z of [HOLE_OFFSETS_IN_U[0], HOLE_OFFSETS_IN_U[2]]) cuts.push(translate([
		x,
		-1,
		z
	], axisCylinder("+y", 4.5, RAIL_HOLE_D / 2, 32)));
	return difference([plate, ...cuts]);
}
/**
* The U-mount parts, as nodes: the two rails, the deck, and the 1U blank coupon. Ids carry the
* unit count (`-6u`) so the export list reads them as the standard's ("10″ rail — LEFT, 6U").
*/
function buildUMountNodes(params, _printer) {
	const dims = uMountDims(params);
	return [
		{
			id: `umount-rail-left-${dims.u}u`,
			op: translate([
				0,
				0,
				6
			], rail(dims))
		},
		{
			id: `umount-rail-right-${dims.u}u`,
			op: translate([
				dims.holeX[1] - 12 / 2,
				0,
				6
			], rail(dims))
		},
		{
			id: `umount-deck-${dims.u}u`,
			op: deck(dims)
		},
		{
			id: "umount-blank-1u",
			op: blank1U()
		}
	];
}

// vendor/casemaker/casemaker-app/src/engine/compiler/rack.ts
/**
* Parametric mini-rack assembly (emulates "Mini Rack" by Meuon, Printables
* 1307276, CC-BY 4.0 — measurements in /Mini-Rack.md). Every part is its own
* BuildNode so manifoldIntegrity's one-component-per-node contract holds and
* the export modal can save each STL separately.
*
* Assembly coords: x across the width (0..W), y front→back (0..D),
* z up (0 = underside of the stacking feet).
*
* THE INVARIANT: the 16.5 mm slot pitch and every fastener-facing dimension
* below are FIXED. Resizing changes width / depth / slot count only — a
* faceplate printed for a 252 mm rack never fits a 200 mm one, but both take
* the same screws, keystone jacks, and 3-slot shelves scaled to their width.
*/
const SLOT_PITCH = 16.5;
/** Side panel plate thickness (the lateral M5 screws pass through this). */
const SIDE_T = 15;
/** Height margin below the first / above the last slot. */
const END_MARGIN = 5.5;
/**
* Stacking feet under the side panels, mm. Exported because it is the plate's
* underside as well as the foot's top — the bottom plate tab lands on it — so
* the #157 fit coupon needs it to place its slice (see `rackTabCouponPlan`).
*/
const FOOT_H = 5;
const FOOT_LEN = 30;
const FOOT_INSET = 4;
/**
* The MID bearing pad is longer than an end foot, and deliberately so: the end
* tabs are each pulled down onto their foot by an M5, but the mid tab has no
* screw at all. Bearing is the only thing holding it, so the pad is sized to
* put a wide margin of material around the tab's footprint rather than the
* 4 mm of overhang a plain FOOT_LEN block left at each end.
*/
const MID_PAD_LEN = 46;
/**
* The rack's fastener is an M5 throughout, and no dimension of it is written
* out in this file any more — `screwHole({ size: 'M5' })` and
* `screwStarter({ size: 'M5' })` read the shared table in fasteners.ts
* (issue #140).
*
* What that gets us, concretely: clearance through the sides at the house
* 'located' fit of 5.2, deliberately tighter than ISO close because these holes
* hold the accessories square and slack in them is crookedness; receiving holes
* at the coupon-tested 4.8, the one number in that table that came from a
* printed part rather than a standard.
*/
/** Tie-wrap holes down the front band. */
const TIE_D = 4.5;
/** Accessory faceplate thickness (blank/keystone front plate). */
const FACE_T = 4;
/** Accessory end-rib: width across x, depth along y, front screw center. */
const RIB_W = 12;
/** Accessories mount RECESSED behind the sides' front faces so the front
*  columns stand proud and protect cables/switches — the original's
*  signature "extra column over the front". */
const FRONT_RECESS = 12;
/** Screw-column y centers. Accessory-local: FRONT_HOLE_Y / ACC_REAR_HOLE_Y
*  (from the accessory's front). Side-panel: add FRONT_RECESS. The rear
*  column adds support for long shelves (>= LONG_SHELF). */
const FRONT_HOLE_Y = 10;
const SIDE_FRONT_HOLE_Y = 22;
const REAR_HOLE_Y = 100;
const ACC_REAR_HOLE_Y = 88;
const LONG_SHELF = 112;
/** Deck thickness — a shelf's is thinner than a cable tray's. */
const SHELF_DECK_T = 3;
/**
* Upstand stiffening ribs across the shelf deck.
*
* A flat 3 mm deck over a ~197 mm span is a trampoline: measured I = 106 mm4,
* which is 23 mm of sag under 5 kg in PETG. PETG matters — it is about HALF the
* stiffness of PLA (E ~2.0 GPa against ~3.5), and every earlier figure in this
* file assumed PLA. Section depth is the only lever that works; closing the
* lattice back up only reached 14.5 mm.
*
* UPSTAND, not downstand, for two reasons: the shelf prints deck-down, so
* downstand ribs would print first and leave the deck bridging between them;
* and downstand ribs would steal headroom from the accessory below. Raised ribs
* also give a device airflow underneath, which is how most rack shelves work.
* They run ACROSS the span, tying the two end ribs together.
*/
const SHELF_RIB_H = 4;
const SHELF_RIB_W = 3;
const SHELF_RIB_PITCH = 30;
const TRAY_DECK_T = 4;
/**
* Rear anchor for a full-depth shelf, measured in from the rack's back face.
*
* 25, not 12. At 12 it sat 3 mm from the REAR TAB SCREW (which is at
* depth - 15) — radii summing 5.0 against a 3 mm separation, so the two holes
* ran into each other at slot 0 and slot 15. The tab screws cannot move: the
* front one is already as close to the foot's front edge as the tab allows, and
* the plate is symmetric, so the rear one is pinned opposite it. Moving the
* anchor is the only free variable, and 25 buys 10 mm of separation.
*
* A full shelf spans ~238 mm at sample size; the existing rear column sits
* only 88 mm back from its front edge, which would leave most of the shelf
* cantilevered. This gives it a screw at the actual back. The column is cut
* into the sides ONLY when a full-depth shelf is present, so an ordinary rack
* is not peppered with holes it will never use.
*/
const REAR_ANCHOR_INSET = 25;
/** Resolve a shelf's depth, expanding 'full' against the rack's own depth. */
function resolveShelfDepth(shelfDepth, rackDepth) {
	if (shelfDepth === "full") return rackDepth - 12;
	return shelfDepth ?? 123;
}
/** Does this rack carry a shelf that runs its whole depth? */
function hasFullDepthShelf(rack) {
	return (rack.accessories ?? []).some((a) => a.type === "shelf" && a.shelfDepth === "full");
}
/** Rack depth below which the sides have no mid rib (and thus no rear
*  screw column) — long/extra-deep shelves lose their middle-bar anchor. */
const MID_BAR_MIN_DEPTH = 132;
/** Side panel structure: solid front band (the cable-protecting column),
*  rear band, top/bottom rails, rib carrying the rear screw column. */
const FRONT_BAND = 34;
const REAR_BAND = 15;
const REAR_BAND_WALL = 25;
const RAIL = 14;
const REAR_RIB = [92, 108];
/** Lateral fit clearances. */
const SIDE_CLEAR = .3;
/** Boss kept full-thickness around each lateral screw hole. This is bearing
*  area for the M5 cap head (8.5 mm across), NOT thread — the screw threads
*  into the accessory's rib, so 10 mm leaves 2.4 mm of wall around the 5.2 mm
*  clearance hole and still supports the whole head. At 13 mm the bosses were
*  3.5 mm apart on the 16.5 pitch, which made each screw column a solid bar:
*  the two columns alone were 107 cm3 of a 330 cm3 panel. */
const SCREW_BOSS_D = 10;
/** Weight relief: solid margin kept around the panel edge and each keep-out,
*  and the collar left around a tie-wrap hole. */
const RELIEF_RIM = 3;
/** Accessory rib hollowing: C-channel wall thickness and the boss kept
*  around each thread hole so screw engagement stays full-width. */
const RIB_WALL = 5;
const RIB_BOSS_D = 12;
/** Side-panel fan mounts: strip margin beyond the fan frame, screw hole
*  (fan self-tappers bite plastic), and the standard bolt spacing /
*  opening per frame size. */
const FAN_BAND_MARGIN = 7;
/** Material outside the bolt circle on the fan pad. */
const FAN_BOLT_EDGE = 6;
/** Width of the rails that hang the pad off the frame. Deliberately
*  SCREW_BOSS_D: a rail crossing a screw column then leaves that hole exactly
*  the boss the panel's own lightening would have. */
const FAN_RAIL_W = 10;
const FAN_SCREW_D = 3.6;
/**
* Where a fan actually lands. Its configured position is clamped so the whole
* mounting band stays on the panel and the opening keeps clear of the rails —
* the validator has to warn about the clamped position, not the typed one.
*/
function fanCenter(fan, dims) {
	const spec = FAN_SPECS[fan.size] ?? FAN_SPECS[80];
	const half = fan.size / 2 + FAN_BAND_MARGIN;
	return {
		y: Math.min(Math.max(fan.y, half), dims.depth - half),
		z: 5 + Math.min(Math.max(fan.z, spec.opening / 2 + 3), dims.bodyH - spec.opening / 2 - 3)
	};
}
const FAN_SPECS = {
	40: {
		bolt: 32,
		opening: 36
	},
	60: {
		bolt: 50,
		opening: 55
	},
	80: {
		bolt: 71.5,
		opening: 73
	},
	92: {
		bolt: 82.5,
		opening: 84
	},
	120: {
		bolt: 105,
		opening: 112
	}
};
/**
* Top/bottom plates. Each plate lands in a blind rebate cut into the side
* panels' top and bottom rails.
*
* The seat occupies only the plate's INNER 3 mm, never its full thickness, so
* the rebate keeps solid material on its outboard z face. The full-thickness
* tab this replaces cut clean through the side body's bottom and top faces: it
* located the plates fore/aft and left them free in z, so on the first printed
* set the top plate lifted straight off and the bottom plate dropped out.
* Seats sit over the stacking feet, which puts the whole foot depth beneath
* the bottom rebate's floor.
*/
const PLATE_T = 5;
/**
* Corner tabs. Each tab is flush with the plate's OUTER face and reaches out
* over a side panel, dropping into a ledge cut in that panel's rail. An M5 is
* driven straight DOWN through the tab into the side.
*
* Flush with the OUTER face on purpose. That face points out of the rack in
* BOTH installs — the top plate is this same part turned over — so the tab
* fills its ledge at whichever end it lands, leaving the top stackable and the
* underside flat. It also means one counterbore serves the top plate's head;
* the bottom plate's head sits proud on the inner face, which is harmless
* because the tabs sit outboard of every accessory.
*
* This replaces a blind rebate + snap darts. Those held z perfectly well but
* could only be assembled plate-then-sides and could never come back out of a
* standing rack; the screws buy serviceability the snap could not.
*/
const TAB_REACH = 12;
const TAB_LEN = 22;
/**
* Tab thickness EQUALS the deck, so the plate is a flat slab with ears rather
* than a slab with lumps, which is what lets it be printed counterbore-UP.
* Printed the other way the counterbore opens onto the bed and its floor
* becomes an unsupported ceiling — a bridge — which is no seat for a screw
* head to bear on.
*
* The TAB gives up `TAB_Z_SHAVE` (#356) of that on its INNER face, so it is the
* deck that is `PLATE_T` thick and the tab one layer thinner. The OUTER face is
* the datum and stays flush with the plate's own face.
*/
const TAB_T = PLATE_T;
/**
* As-designed clearance between the plate tab and its ledge, mm — the number
* #153's fit relief is added to, and the one the rack-tab fit coupon (#157)
* ladders and names, so it is exported rather than duplicated. The tab is the
* same width and depth on both axes, so this one number is the whole gap.
*/
const TAB_SLACK = .3;
/** How far a tab overlaps the deck it grows out of, to avoid a coplanar seam. */
const TAB_MERGE = .5;
/**
* What a tab gives up of its thickness for `TAB_Z_SLACK`, mm — off the INNER
* face, and FIXED: the tab never moves with `fit`. The laddered share is the
* ledge's (`buildSide`), so the fit coupon can grade both the slot's width and
* its opening height against one printed tab.
*
* **One WHOLE LAYER (#356 review).** It was half of TAB_Z_SLACK — 0.1 — and
* that is half of a 0.2 mm first layer. The plates print counterbores UP, so
* the tab's inner face is the BED face, and the slicer samples layer 1 at
* z = 0.1: exactly on that face. A shave that shallow is not a face a slicer can
* keep — it rounds the tab's inner face away (leaving no thickness clearance at
* all) or starts the tab on layer 2 as a 12 mm cantilever floating over the bed.
* 0.2 is the maintainer's own hand fix on the bound rack, and it is a whole
* layer at the profile's layer height. Keep it one: a fraction of a layer is not
* a feature.
*/
const TAB_Z_SHAVE = .2;
/**
* The ledge's base z OPENING, mm: what is left of `TAB_Z_SLACK` after the tab's
* shave. `buildSide` opens each ledge by this plus #153's relief, so the joint's
* whole z clearance stays `TAB_Z_SLACK + fitRelief(rack.fit)` whatever the rung.
*/
const TAB_Z_OPEN = .09999999999999998;
/**
* The z clearance the plate-tab joint is COMPILED with, as `buildSide` and
* `buildPlate` take it: the tab's shave and the ledge's opening.
*
* `fused` compiles the joint NOMINAL — no shave, no opening — and that is what
* the one-piece export needs (#356 review). A part printed as a unit has no
* fitting to do: every other joint clearance in it is welded shut, and this one
* cannot be, because the welds bridge the SIDES and this gap is a 12 mm sheet of
* air over the tab's inner face with solid rail above it and the deck below —
* out of a weld's reach, and an internal crack in a part that is meant to be one
* solid. Compiling it nominal closes the joint outright, which is what removes
* the crack rather than hiding it.
*/
function tabZJoint(rack, fused = false) {
	return fused ? {
		shave: 0,
		open: 0
	} : {
		shave: TAB_Z_SHAVE,
		open: TAB_Z_OPEN + fitRelief(rack.fit)
	};
}
/**
* The tab screw is the SAME M5 as everything else in the rack, so it takes the
* same numbers. It used to carry its own: TAB_SCREW_CLEAR_D was a byte-identical
* duplicate of SCREW_CLEAR_D, and the head recess was a pair of magic numbers
* with a "provisional pending #140" comment on them. #140 has landed, and the
* recess is the MEASURED button head (9.2 across, 3.0 tall) plus the table's
* head fit, giving the same Ø9.8 x 3.0 as before.
*
* Only the HEIGHT survives as a named constant, because the tab's thickness is
* built from it (head height + a bearing floor) and the tests pin that.
*/
const TAB_SCREW_HEAD_H = headHeight("M5", "button");
/**
* Screw axis, measured INBOARD from the plate edge — not the centre of the
* tab. Centred, a Ø9.8 counterbore leaves 0.6 mm of wall each side, which is
* not a wall.
*
* The offset trades two walls directly against each other and both matter:
* moving the axis inboard fattens the tab's outboard wall but thins the side
* panel's inner wall, where the same screw threads a few millimetres from the
* open ledge. At an inset of 3.5 in an 11 mm tab that inner wall was 0.8 mm —
* a thread that would split straight out into the rack. 12 mm of reach at
* 4.3 balances them: 2.8 mm of tab outboard, 1.6 mm of panel inboard, and
* still 3 mm of rail left outboard of the ledge.
*/
const TAB_SCREW_INSET = 4.3;
/**
* Pilot depth from the ledge mouth, DERIVED from the screw (#371). A screw longer than its hole
* bottoms out and jacks the plate back up off its seat. When the screw is tight the plate is
* clamped onto the ledge face, so the head seat sits a bearing floor (tab thickness after the
* #356 shave, less the head's counterbore) above the mouth, and the pilot has to run the rest of
* the screw's length plus a spare. It used to be a literal 21, sized when the floor was 3 mm and
* the screw assumed shorter, and by #356 the top screw bottomed ~1.2 mm before it seated; the
* seated-screw probe in `rack.spec.ts` is what holds this now.
*/
const TAB_SCREW_BITE = 26 - (4.8 - TAB_SCREW_HEAD_H);
/** Solid column reserved around a tab screw in the side's lightening pocket. */
const TAB_COLUMN_D = 10;
/**
* How far in from the outer face a tab screw column is pocketed back to. The
* thread only needs material around itself, not a full-height lump: with the
* axis 4.3 mm in from the plate edge the screw spans x 8.6..13.4, so keeping
* material from x=8 inward covers it with room to spare.
*/
const COLUMN_FLOOR = 7;
/** Driver access up through a stacking foot to the bottom tab screw's head. */
const TAB_ACCESS_D = 10.8;
/** Keystone jack (industry standard, NEVER scaled): retention window in a
*  2 mm web the jack's latch clicks over (insert from the back), body
*  clearance behind, 30 mm jack pitch. */
const KS_WIN_W = 15;
const KS_WIN_H = 16.7;
const KS_WEB_T = 2;
const KS_BODY_W = 17.4;
const KS_BODY_H = 20.5;
const KS_PITCH = 30;
/** Wall mount — ears. */
const EAR_REACH = 28;
const EAR_T = 4;
/**
* The user's own wall fixings (#8 / 4 mm pan heads). Exported because the
* stand's pocket carrier (#151) hangs on the same screws: two carriers of the
* same weight on the same wall should want the same hole.
*/
const WALL_SCREW_D = 4.5;
const WALL_HEAD_D = 9.6;
const WALL_HEAD_RECESS = 2;
const GUSSET_T = 4;
/** Wall mount — french cleat. Chunky on purpose: the 15×40 profile keeps
*  the hook step and bevel legible at rack scale and adds bearing area. */
const CLEAT_D = 15;
const CLEAT_H = 40;
const CLEAT_FIT = .4;
/** Seat height below the panel top (hook block height + a little). */
const CLEAT_SEAT_DROP = 58;
/** Wall mount — keyhole hangers (flush): sized for #8 / 4 mm pan heads. */
const KEY_HEAD_D = 9.6;
const KEY_SLOT_W = 4.8;
const KEY_DEPTH = 9;
const KEY_TRAVEL = 14;
/** Cutter overshoot so booleans punch cleanly through faces. */
const OVER$2 = 1;
function computeRackDims(rack) {
	const width = Math.max(120, rack.width);
	const depth = Math.max(80, rack.depth);
	const slots = Math.max(2, Math.round(rack.slots));
	const bodyH = slots * SLOT_PITCH + 2 * END_MARGIN;
	const wallMounted = (rack.wallMount ?? "none") !== "none";
	return {
		width,
		depth,
		slots,
		bodyH,
		totalH: 5 + bodyH,
		plateW: width - 30 - 2 * SIDE_CLEAR,
		rearBand: wallMounted ? REAR_BAND_WALL : REAR_BAND,
		slotZ: (k) => 10.5 + k * SLOT_PITCH,
		holeZ: (k) => 10.5 + (k + .5) * SLOT_PITCH
	};
}
/** Accessory slot height with defaults applied. */
function accessorySlots(acc) {
	if (acc.type === "cable-tray") return 2;
	return Math.max(1, Math.round(acc.slots ?? (acc.type === "keystone" ? 2 : 3)));
}
/** Triangular prism extruded along Z — ear gussets. Vertices are (x, y)
*  pairs; winding is normalized so the solid always faces outward. */
function triPrismZ(tri, zMin, zMax) {
	const a = tri[0];
	let b = tri[1];
	let c = tri[2];
	if ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) < 0) {
		const swap = b;
		b = c;
		c = swap;
	}
	const positions = [];
	for (const [x, y] of [
		a,
		b,
		c
	]) positions.push(x, y, zMin);
	for (const [x, y] of [
		a,
		b,
		c
	]) positions.push(x, y, zMax);
	return mesh(new Float32Array(positions), new Uint32Array([
		0,
		2,
		1,
		3,
		4,
		5,
		0,
		1,
		4,
		0,
		4,
		3,
		1,
		2,
		5,
		1,
		5,
		4,
		2,
		0,
		3,
		2,
		3,
		5
	]));
}
/** Rounded-corner window piercing the full side-panel thickness along X. */
function xWindow(x0, y0, z0, yLen, zLen, r) {
	return translate([
		x0 - OVER$2,
		y0,
		z0 + zLen
	], rotate([
		0,
		90,
		0
	], roundedRectPrism(zLen, yLen, 17, r)));
}
/**
* One side panel. `mirror=false` builds the LEFT panel occupying x 0..SIDE_T;
* `mirror=true` maps every x range through (width - x) for the RIGHT panel.
* The two are true chiral parts (tab pockets open inward, ears point outward).
*/
function buildSide(rack, dims, mirror, fused = false) {
	const { width, depth, bodyH, rearBand } = dims;
	const H_TOP = 5 + bodyH;
	const xr = (a, b) => mirror ? [width - b, width - a] : [a, b];
	const box = (xa, xb, y, z, dy, dz) => {
		const [a, b] = xr(xa, xb);
		return translate([
			a,
			y,
			z
		], cube([
			b - a,
			dy,
			dz
		]));
	};
	const tabSlack = TAB_SLACK + fitRelief(rack.fit);
	const tabZOpen = tabZJoint(rack, fused).open;
	const solid = [
		box(0, 15, 0, 5, depth, bodyH),
		box(0, 15, 0, 0, 34, 6),
		box(0, 15, depth - FOOT_INSET - FOOT_LEN, 0, 34, 6)
	];
	if (depth >= 132) solid.push(box(0, 15, depth / 2 - MID_PAD_LEN / 2, 0, MID_PAD_LEN, 6));
	const cuts = [];
	const spans = [];
	const rearEdge = depth - rearBand;
	const windowRear = Math.min(rearEdge, depth - 15 - TAB_COLUMN_D / 2 - 3, ...hasFullDepthShelf(rack) ? [depth - 25 - 10 / 2 - 3] : []);
	if (depth >= 132) {
		spans.push([FRONT_BAND, REAR_RIB[0]]);
		spans.push([REAR_RIB[1], windowRear]);
	} else spans.push([FRONT_BAND, windowRear]);
	const windows = [];
	for (const [a, b] of spans) {
		let segs = [[a, b]];
		if (b - a > 130) {
			const mid = (a + b) / 2;
			segs = [[a, mid - 5], [mid + 5, b]];
		}
		for (const [sa, sb] of segs) {
			if (sb - sa < 24) continue;
			windows.push([
				sa + 4,
				sb - sa - 8,
				19,
				bodyH - 28
			]);
		}
	}
	for (const [wy, wdy, wz, wdz] of windows) cuts.push(xWindow(xr(0, 15)[0], wy, wz, wdy, wdz, 6));
	const [holeX] = xr(-1, 16);
	const holeLen = 17;
	const rearAnchorY = depth - 25;
	const wantsRearAnchor = hasFullDepthShelf(rack);
	for (let k = 0; k < dims.slots; k++) {
		const z = dims.holeZ(k);
		const column = (y) => screwHole({
			size: "M5",
			at: [
				holeX,
				y,
				z
			],
			axis: "+x",
			through: holeLen,
			segments: 24
		});
		cuts.push(column(22));
		if (depth >= 132) cuts.push(column(100));
		if (wantsRearAnchor) cuts.push(column(rearAnchorY));
	}
	for (let ty = 46; ty <= depth - rearBand - 8; ty += 33) {
		cuts.push(translate([
			holeX,
			ty,
			12
		], axisCylinder("+x", holeLen, TIE_D / 2, 16)));
		cuts.push(translate([
			holeX,
			ty,
			5 + bodyH - RAIL / 2
		], axisCylinder("+x", holeLen, TIE_D / 2, 16)));
	}
	const xAt = (v) => xr(v, v)[0];
	const tabAxis = xAt(11);
	const screwYs = new Set(plateScrewYs(depth));
	const ledgesAt = (ty) => {
		const y0 = ty - TAB_LEN / 2 - tabSlack;
		const dy = TAB_LEN + 2 * tabSlack;
		return [box(3.3000000000000007 - tabSlack, 16, y0, 5, dy, 5 + tabZOpen), box(3.3000000000000007 - tabSlack, 16, y0, H_TOP - 5 - tabZOpen, dy, 5 + tabZOpen + OVER$2)];
	};
	for (const ty of plateTabYs(depth)) {
		cuts.push(...ledgesAt(ty));
		if (!screwYs.has(ty)) continue;
		cuts.push(screwStarter({
			size: "M5",
			at: [
				tabAxis,
				ty,
				10 + tabZOpen
			],
			axis: "+z",
			depth: TAB_SCREW_BITE,
			segments: 24
		}));
		cuts.push(translate([
			tabAxis,
			ty,
			-1
		], cylinder(7, TAB_ACCESS_D / 2, 32)));
		cuts.push(screwStarter({
			size: "M5",
			at: [
				tabAxis,
				ty,
				H_TOP - 5 - tabZOpen
			],
			axis: "-z",
			depth: TAB_SCREW_BITE,
			segments: 24
		}));
	}
	const [pa, pb] = xr(-1, 12);
	const pocketDepthX = pb - pa;
	const yzRect = (y0, y1, z0, z1) => pTranslate([y0, z0], rectProfile(y1 - y0, z1 - z0));
	const webZ0 = 8;
	const webZ1 = H_TOP - RELIEF_RIM;
	const wallMounted = (rack.wallMount ?? "none") !== "none";
	const regions = [
		yzRect(RELIEF_RIM, 31, webZ0, webZ1),
		yzRect(RELIEF_RIM, depth - RELIEF_RIM, webZ0, 17),
		yzRect(RELIEF_RIM, depth - RELIEF_RIM, H_TOP - RAIL + 2, webZ1)
	];
	if (depth >= 132) regions.push(yzRect(REAR_RIB[0] + 2, REAR_RIB[1] - 2, webZ0, webZ1));
	if (!wallMounted) {
		const bandStart = depth - rearBand + RELIEF_RIM;
		regions.push(yzRect(wantsRearAnchor ? Math.min(bandStart, rearAnchorY - 10 / 2 - 4) : bandStart, depth - RELIEF_RIM, webZ0, webZ1));
	}
	const keepOut = [];
	const screwColumns = [];
	for (let k = 0; k < dims.slots; k++) {
		const z = dims.holeZ(k);
		keepOut.push(pTranslate([22, z], circleProfile(10 / 2, 20)));
		if (wantsRearAnchor) keepOut.push(pTranslate([rearAnchorY, z], circleProfile(10 / 2, 20)));
		if (depth >= 132) keepOut.push(pTranslate([100, z], circleProfile(10 / 2, 20)));
	}
	for (let ty = 46; ty <= depth - rearBand - 8; ty += 33) for (const z of [12, 5 + bodyH - RAIL / 2]) keepOut.push(pTranslate([ty, z], circleProfile(4.25, 16)));
	for (const yC of plateTabYs(depth)) {
		keepOut.push(yzRect(yC - TAB_LEN / 2 - 4, yC + TAB_LEN / 2 + 4, 3, 12));
		keepOut.push(yzRect(yC - TAB_LEN / 2 - 4, yC + TAB_LEN / 2 + 4, H_TOP - 5 - 2, H_TOP));
		if (!screwYs.has(yC)) continue;
		for (const [za, zb] of [[10 + tabZOpen, 10 + tabZOpen + TAB_SCREW_BITE + 2], [H_TOP - 5 - tabZOpen - TAB_SCREW_BITE - 2, H_TOP - 5 - tabZOpen]]) screwColumns.push(yzRect(yC - TAB_COLUMN_D / 2, yC + TAB_COLUMN_D / 2, za, zb));
	}
	cuts.push(translate([
		pa,
		0,
		0
	], extrudeX(pDifference([
		pUnion(regions),
		...keepOut,
		...screwColumns
	]), pocketDepthX)));
	if (screwColumns.length > 0) {
		const [ca, cb] = xr(-1, COLUMN_FLOOR);
		cuts.push(translate([
			ca,
			0,
			0
		], extrudeX(pDifference([pUnion(screwColumns), ...keepOut]), cb - ca)));
	}
	const wallMount = rack.wallMount ?? "none";
	if (wallMount === "ears") {
		const [ba, bb] = mirror ? [width - OVER$2, width + EAR_REACH] : [-28, OVER$2];
		solid.push(translate([
			ba,
			depth - EAR_T,
			5
		], cube([
			bb - ba,
			EAR_T,
			bodyH
		])));
		const screws = earScrewsPerSide(bodyH);
		const xC = mirror ? width + EAR_REACH / 2 : -14;
		const tipX = mirror ? width + EAR_REACH - 4 : -24;
		const rootX = mirror ? width - OVER$2 : OVER$2;
		/** Horizontal triangular gusset bracing the blade back to the panel. */
		const gusset = (zTop) => {
			solid.push(triPrismZ([
				[tipX, depth - EAR_T + .5],
				[rootX, depth - EAR_T + .5],
				[rootX, depth - EAR_T - 24]
			], zTop - GUSSET_T, zTop));
		};
		for (let i = 0; i < screws; i++) {
			const z = 5 + bodyH * (i + 1) / (screws + 1);
			cuts.push(screwHole({
				size: "M4",
				at: [
					xC,
					depth - EAR_T,
					z
				],
				axis: "+y",
				through: EAR_T,
				clearanceD: WALL_SCREW_D,
				head: "socket-cap",
				headD: WALL_HEAD_D,
				recess: 2,
				segments: 24,
				recessSegments: 32
			}));
			gusset(z - 8);
		}
		gusset(11);
		gusset(5 + bodyH - 2);
	} else if (wallMount === "cleat") {
		const notchD = 15.4;
		const seatZ = 5 + bodyH - CLEAT_SEAT_DROP;
		const [na, nb] = xr(-1, 16);
		const diag = 16.4 * Math.SQRT2;
		cuts.push(translate([
			na,
			depth - notchD,
			seatZ
		], rotate([
			45,
			0,
			0
		], translate([
			0,
			0,
			-diag
		], cube([
			nb - na,
			diag,
			diag
		])))));
		cuts.push(translate([
			na,
			depth - notchD,
			-1
		], cube([
			nb - na,
			16.4,
			seatZ + 2 + OVER$2
		])));
	} else if (wallMount === "keyhole") {
		const cx = mirror ? width - 15 / 2 : 15 / 2;
		for (const zEntry of [5 + bodyH - 30, 5 + bodyH * .45]) {
			cuts.push(translate([
				cx,
				depth + OVER$2,
				zEntry
			], rotate([
				90,
				0,
				0
			], cylinder(10, KEY_HEAD_D / 2, 32))));
			cuts.push(translate([
				cx - KEY_SLOT_W / 2,
				depth - KEY_DEPTH,
				zEntry - KEY_TRAVEL
			], cube([
				KEY_SLOT_W,
				10,
				KEY_TRAVEL
			])));
			cuts.push(translate([
				cx - KEY_HEAD_D / 2 - .5,
				depth - KEY_DEPTH,
				zEntry - KEY_TRAVEL
			], cube([
				10.6,
				5,
				KEY_TRAVEL
			])));
		}
	}
	const base = difference([union$1(solid), ...cuts]);
	const fans = (rack.fans ?? []).filter((f) => f.side === "left" === !mirror);
	if (fans.length === 0) return base;
	const strips = [];
	const fanCuts = [];
	for (let k = 0; k < dims.slots; k++) {
		const z = dims.holeZ(k);
		const column = (y) => screwHole({
			size: "M5",
			at: [
				holeX,
				y,
				z
			],
			axis: "+x",
			through: holeLen,
			segments: 24
		});
		fanCuts.push(column(22));
		if (depth >= 132) fanCuts.push(column(100));
		if (hasFullDepthShelf(rack)) fanCuts.push(column(depth - 25));
	}
	for (let ty = 46; ty <= depth - rearBand - 8; ty += 33) {
		fanCuts.push(translate([
			holeX,
			ty,
			12
		], axisCylinder("+x", holeLen, TIE_D / 2, 16)));
		fanCuts.push(translate([
			holeX,
			ty,
			5 + bodyH - RAIL / 2
		], axisCylinder("+x", holeLen, TIE_D / 2, 16)));
	}
	for (const ty of plateTabYs(depth)) fanCuts.push(...ledgesAt(ty));
	const [sx0, sx1] = xr(0, 15);
	for (const fan of fans) {
		const spec = FAN_SPECS[fan.size] ?? FAN_SPECS[80];
		const { y: yC, z: zC } = fanCenter(fan, dims);
		const padHalf = Math.max(spec.bolt / 2 + FAN_BOLT_EDGE, spec.opening / 2 + 3);
		const [padY0, padY1] = [yC - padHalf, yC + padHalf];
		const [padZ0, padZ1] = [zC - padHalf, zC + padHalf];
		strips.push(translate([
			sx0,
			padY0,
			padZ0
		], cube([
			sx1 - sx0,
			2 * padHalf,
			2 * padHalf
		])));
		const span = spans.find(([a, b]) => yC > a && yC < b);
		const gapY = span ? [Math.max(0, padY0 - span[0]), Math.max(0, span[1] - padY1)] : [0, 0];
		const gapZ = [Math.max(0, padZ0 - 19), Math.max(0, 5 + bodyH - RAIL - padZ1)];
		const runY = !span || Math.max(...gapY) <= Math.max(...gapZ);
		const railOff = padHalf - FAN_RAIL_W / 2;
		if (runY && span) for (const zr of [zC - railOff, zC + railOff]) for (const [a, b] of [[span[0] - 3, padY0], [padY1, span[1] + 3]]) {
			if (b - a <= 0) continue;
			strips.push(translate([
				sx0,
				a,
				zr - FAN_RAIL_W / 2
			], cube([
				sx1 - sx0,
				b - a,
				FAN_RAIL_W
			])));
		}
		else if (!runY) for (const yr of [yC - railOff, yC + railOff]) for (const [a, b] of [[16, padZ0], [padZ1, 5 + bodyH - RAIL + 3]]) {
			if (b - a <= 0) continue;
			strips.push(translate([
				sx0,
				yr - FAN_RAIL_W / 2,
				a
			], cube([
				sx1 - sx0,
				FAN_RAIL_W,
				b - a
			])));
		}
		fanCuts.push(translate([
			holeX,
			yC,
			zC
		], axisCylinder("+x", holeLen, spec.opening / 2, 64)));
		for (const sy of [-1, 1]) for (const sz of [-1, 1]) fanCuts.push(screwStarter({
			size: "M4",
			at: [
				holeX,
				yC + sy * spec.bolt / 2,
				zC + sz * spec.bolt / 2
			],
			axis: "+x",
			depth: holeLen,
			pilotD: FAN_SCREW_D,
			segments: 20
		}));
	}
	return difference([union$1([base, ...strips]), ...fanCuts]);
}
/**
* Seat centres along y. They sit over the stacking feet so the bottom rebate's
* floor is backed by the full foot depth, plus a mid seat on deep racks so the
* plate is not carried by its two ends alone. Symmetric about depth/2, which is
* what lets the top plate be the same printed part, flipped.
*/
/**
* Tab centres. Three constraints pin these, and they nearly conflict:
*  - symmetric about depth/2, so the flipped install lands on the same ledges;
*  - wholly over a stacking foot, which is what the bottom tab lands on;
*  - clear of the front accessory screw column at SIDE_FRONT_HOLE_Y. Centring
*    on the foot (y = 19) puts the tab screw 3 mm from that column, and with
*    radii summing to 4.7 the two holes break into each other — the tab screw
*    would run out into slot 0's clearance hole. Sitting the tab at the FRONT
*    of the foot instead opens that to 7 mm.
*/
function plateTabYs(depth) {
	const ys = [...plateScrewYs(depth)];
	if (depth >= 132) ys.push(depth / 2);
	return ys;
}
/** Tab centres that additionally take a screw: the two ends, where the panel
*  can give the thread a solid column without eating a vent window. */
function plateScrewYs(depth) {
	const yc = 15;
	return [yc, depth - yc];
}
/**
* Top/bottom plate: a vented deck spanning between the sides, carried by four
* corner tabs that drop into ledges in the side rails and are screwed down
* from outside. One printed part serves both ends — the top is this same plate
* turned over (see buildRackNodes), which is why every y feature is symmetric
* about depth/2 and the tabs sit on the face that points OUT of the rack.
*
* Print it COUNTERBORES UP (see the print table in `engine/exporters/parts.ts`):
* the tabs are flush with the OUTER face, so that face is one flat plane and
* lies on the bed either way up — the head seats are what choose, and printed
* the other way each seat is a downward-facing ceiling spanning its own bore
* that bridges and gives the head nothing flat to bear on. In assembly the
* bottom plate's counterbored face points down, so `rack-bottom` is the one
* that gets flipped (`buildRackNodes`) and `rack-top` is already correct as
* modelled. **The INNER face is therefore the BED face** — which is why
* TAB_Z_SHAVE is a whole layer: a shave of half a layer there is a face the
* slicer samples exactly on.
*
* `zShave` is that shave; the one-piece export compiles the plate with it zero
* (`tabZJoint`), because a joint inside one printed piece has no fit to hold
* open.
*/
function buildPlate(dims, notchSolid = [], floorRibs = false, zShave = TAB_Z_SHAVE) {
	const { plateW, depth } = dims;
	const x0 = 15.3;
	const plateOutline = pTranslate([x0, 0], rectProfile(plateW, depth));
	const tabKeepOut = [];
	for (const yC of plateTabYs(depth)) for (const nearLeft of [true, false]) {
		const a = nearLeft ? x0 : x0 + plateW - 12 - 8;
		tabKeepOut.push(pTranslate([a, yC - TAB_LEN / 2 - 4], rectProfile(20, 30)));
	}
	const ribProfiles = [];
	if (floorRibs) {
		ribProfiles.push(pDifference([plateOutline, pOffset(plateOutline, -FLOOR_RIB_W, "miter")]));
		for (let y = FLOOR_RIB_PITCH; y < depth - FLOOR_RIB_W; y += FLOOR_RIB_PITCH) ribProfiles.push(pTranslate([x0, y], rectProfile(plateW, FLOOR_RIB_W)));
	}
	if (ribProfiles.length > 0) {
		const access = [];
		for (const yC of plateScrewYs(depth)) for (const dir of [-1, 1]) {
			const edge = dir < 0 ? x0 : x0 + plateW;
			access.push(pTranslate([dir < 0 ? edge - TAB_SCREW_INSET : edge + TAB_SCREW_INSET, yC], circleProfile(TAB_ACCESS_D / 2, 32)));
		}
		for (let i = 0; i < ribProfiles.length; i++) ribProfiles[i] = pDifference([ribProfiles[i], ...access]);
	}
	const deck = pDifference([plateOutline, lightenPocket(plateOutline, {
		rim: 15,
		rib: 3.5,
		pitch: 14,
		keepOut: [
			...tabKeepOut,
			...notchSolid,
			...ribProfiles
		]
	})]);
	const solid = [extrude(deck, PLATE_T)];
	if (ribProfiles.length > 0) solid.push(translate([
		0,
		0,
		-FLOOR_RIB_D
	], extrude(pUnion(ribProfiles), FLOOR_RIB_D)));
	const cuts = [];
	const screwYs = new Set(plateScrewYs(depth));
	for (const yC of plateTabYs(depth)) for (const dir of [-1, 1]) {
		const edge = dir < 0 ? x0 : x0 + plateW;
		const xa = dir < 0 ? edge - 12 : edge - TAB_MERGE;
		solid.push(translate([
			xa,
			yC - TAB_LEN / 2,
			0
		], cube([
			12.5,
			TAB_LEN,
			5 - zShave
		])));
		if (!screwYs.has(yC)) continue;
		const axis = dir < 0 ? edge - TAB_SCREW_INSET : edge + TAB_SCREW_INSET;
		cuts.push(screwHole({
			size: "M5",
			at: [
				axis,
				yC,
				0
			],
			axis: "+z",
			through: 5 - zShave,
			head: "button",
			recess: "flush",
			segments: 24,
			recessSegments: 32
		}));
	}
	return difference([union$1(solid), ...cuts]);
}
/**
* Receiving hole in an accessory end rib — one per slot per side. This is the
* joint that holds the whole rack together: the M5 goes in from OUTSIDE the
* side panel, through its clearance column, and taps into this.
*
* Shared by the faceplate, the shelf and the cable tray, which had three
* copies of the same cylinder between them.
*/
function ribStarter(rx, y, z) {
	return screwStarter({
		size: "M5",
		at: [
			rx - OVER$2,
			y,
			z
		],
		axis: "+x",
		depth: 14,
		segments: 24
	});
}
/** Faceplate spanning BETWEEN the side panels (recessed behind their
*  protective front columns) + threaded end ribs — blank & keystone. */
function faceplateBase(dims, nSlots, plateDepth) {
	const { width, plateW } = dims;
	const h = nSlots * SLOT_PITCH - .5;
	const solid = [translate([
		15.3,
		0,
		0
	], cube([
		plateW,
		plateDepth,
		h
	]))];
	const ribX = [15.3, width - 15 - SIDE_CLEAR - RIB_W];
	const cuts = [];
	for (const rx of ribX) solid.push(translate([
		rx,
		plateDepth - OVER$2,
		0
	], cube([
		RIB_W,
		16 - plateDepth + OVER$2,
		h
	])));
	for (let k = 0; k < nSlots; k++) {
		const z = (k + .5) * SLOT_PITCH - .25;
		for (const rx of ribX) cuts.push(ribStarter(rx, FRONT_HOLE_Y, z));
	}
	return {
		solid,
		cuts,
		h
	};
}
/** N-slot blank faceplate (drill-it-yourself), 4 mm plate. */
function buildBlank(dims, nSlots) {
	const { solid, cuts } = faceplateBase(dims, nSlots, FACE_T);
	return difference([union$1(solid), ...cuts]);
}
/** Keystone patch plate: as many standard jacks as the width allows, plus a
*  cable pass-through when there's room. Jacks insert from the BACK; their
*  latch clicks over the 2 mm front web. */
/**
* #266 — the keystone row's layout, shared by the geometry and the split's
* seam keep-outs. The "anything that lines up with a pattern comes from the
* pattern's own function" rule (`lightenBars` says the same): a keep-out
* reconstructed beside `buildKeystone` would drift the first time a constant
* moved.
*/
function keystoneLayout(width) {
	const usable0 = 33.3;
	const usable1 = width - 15 - SIDE_CLEAR - RIB_W - 6;
	const count = Math.max(1, Math.floor((usable1 - usable0) / KS_PITCH));
	const rowW = count * KS_PITCH;
	const rowX0 = usable0 + (usable1 - usable0 - rowW) / 2;
	const jacksX = Array.from({ length: count }, (_, j) => rowX0 + KS_PITCH / 2 + j * KS_PITCH);
	const spareW = usable1 - (rowX0 + rowW);
	return {
		rowX0,
		rowW,
		jacksX,
		spare: spareW >= 55 ? {
			x: rowX0 + rowW + 6,
			w: spareW - 12
		} : null
	};
}
function buildKeystone(dims, nSlots) {
	const { width } = dims;
	const base = faceplateBase(dims, nSlots, FACE_T);
	const h = base.h;
	const { rowX0, rowW, jacksX, spare } = keystoneLayout(width);
	const jacks = jacksX.length;
	const zC = h / 2;
	const solid = [...base.solid];
	const cuts = [...base.cuts];
	solid.push(translate([
		rowX0 - 4,
		3,
		zC - KS_BODY_H / 2 - 4
	], cube([
		rowW + 8,
		7,
		28.5
	])));
	for (const cx of jacksX) {
		cuts.push(translate([
			cx - 15 / 2,
			-1,
			zC - KS_WIN_H / 2
		], cube([
			15,
			3,
			KS_WIN_H
		])));
		cuts.push(translate([
			cx - KS_BODY_W / 2,
			KS_WEB_T,
			zC - KS_BODY_H / 2
		], cube([
			KS_BODY_W,
			9,
			KS_BODY_H
		])));
	}
	if (spare !== null) cuts.push(translate([
		spare.x,
		-1,
		zC + 9
	], rotate([
		-90,
		0,
		0
	], roundedRectPrism(spare.w, 18, 12, 6))));
	return {
		op: difference([union$1(solid), ...cuts]),
		jacks
	};
}
/** Open-front vented shelf: end ribs the screws bite into + a low deck. */
function buildShelf(dims, nSlots, shelfDepth, opts = {}) {
	const { width, depth, plateW } = dims;
	const vented = opts.vented !== false;
	const h = nSlots * SLOT_PITCH - .5;
	const d = Math.min(Math.max(60, shelfDepth), depth - 12);
	const ribX = [15.3, width - 15 - SIDE_CLEAR - RIB_W];
	const solid = [];
	const cuts = [];
	for (const rx of ribX) solid.push(translate([
		rx,
		0,
		0
	], cube([
		RIB_W,
		d,
		h
	])));
	if (opts.frontPlate) solid.push(translate([
		15.3,
		0,
		0
	], cube([
		plateW,
		FACE_T,
		h
	])));
	const deckX0 = 16.3;
	const deckW = width - 2 * deckX0;
	solid.push(translate([
		deckX0,
		0,
		0
	], cube([
		deckW,
		d,
		3
	])));
	const shelfRibs = [];
	for (let y = SHELF_RIB_PITCH / 2; y < d - SHELF_RIB_W; y += SHELF_RIB_PITCH) shelfRibs.push(pTranslate([deckX0, y], rectProfile(deckW, SHELF_RIB_W)));
	const notch = opts.rearNotches;
	const notchKeep = notch ? notch.cx.map((cx) => pTranslate([cx - notch.w / 2 - 5, d - notch.d - 5], rectProfile(notch.w + 10, notch.d + 10))) : [];
	const deckOutline = pTranslate([deckX0, 0], rectProfile(deckW, d));
	const latticeOpts = {
		rim: 10,
		rib: 3,
		pitch: 14
	};
	if (vented) {
		const ribKeepOut = ribX.map((rx) => pTranslate([rx - 1, -1], rectProfile(14, d + 2))).concat(notchKeep, shelfRibs);
		cuts.push(translate([
			0,
			0,
			-1
		], extrude(lightenPocket(deckOutline, {
			...latticeOpts,
			keepOut: ribKeepOut
		}), 5)));
	}
	const backCandidate = depth - 25 - 12;
	const backAnchorY = d >= backCandidate + 4 ? backCandidate : void 0;
	for (let k = 0; k < nSlots; k++) {
		const z = (k + .5) * SLOT_PITCH - .25;
		for (const rx of ribX) {
			cuts.push(ribStarter(rx, FRONT_HOLE_Y, z));
			if (d >= 112) cuts.push(ribStarter(rx, ACC_REAR_HOLE_Y, z));
			if (backAnchorY !== void 0) cuts.push(ribStarter(rx, backAnchorY, z));
		}
	}
	if (shelfRibs.length > 0) {
		solid.push(translate([
			0,
			0,
			3
		], extrude(pUnion(shelfRibs), 4)));
		const family = lightenBars(deckOutline, latticeOpts)[0];
		if (family) {
			const clear = [pTranslate([15.3, -1], rectProfile(deckW + 2, 13)), ...notchKeep];
			solid.push(translate([
				0,
				0,
				3
			], extrude(pDifference([pIntersection([family, deckOutline]), ...clear]), 4)));
		}
	}
	if (notch) for (const cx of notch.cx) {
		const yInner = d - notch.d + notch.w / 2;
		const thru = 9;
		cuts.push(translate([
			cx - notch.w / 2,
			yInner,
			-1
		], cube([
			notch.w,
			d - yInner + OVER$2,
			thru
		])));
		cuts.push(translate([
			cx,
			yInner,
			-1
		], cylinder(thru, notch.w / 2, 32)));
	}
	cuts.push(...ribChannelCuts(width, ribX, d, h, nSlots, d >= 112, backAnchorY));
	if (vented) {
		const bossYs = [
			FRONT_HOLE_Y,
			...d >= 112 ? [ACC_REAR_HOLE_Y] : [],
			...backAnchorY !== void 0 ? [backAnchorY] : []
		];
		const bossZs = Array.from({ length: nSlots }, (_, k) => (k + .5) * SLOT_PITCH - .25);
		for (const rx of ribX) for (let vy = 22; vy <= d - 10; vy += 14) for (let vz = 12; vz <= h - 8; vz += 14) {
			if (bossYs.some((by) => Math.abs(vy - by) < 11) && bossZs.some((bz) => Math.abs(vz - bz) < 11)) continue;
			cuts.push(translate([
				rx - OVER$2,
				vy,
				vz
			], axisCylinder("+x", 14, 4, 20)));
		}
	}
	return difference([union$1(solid), ...cuts]);
}
/** Hollow accessory end ribs into C-channels: keep the outer wall (the
*  screw-bearing face against the side panel), front/rear posts, and a
*  bottom band tying into the deck; open the pocket to the TOP and the
*  inner face so nothing bridges when printed deck-down. Solid bosses stay
*  around every thread hole for full-width screw engagement. */
function ribChannelCuts(width, ribX, d, h, nSlots, rearHoles, backAnchorY) {
	const out = [];
	for (const rx of ribX) {
		const isLeft = rx < width / 2;
		const px0 = isLeft ? rx + RIB_WALL : rx - OVER$2;
		const px1 = isLeft ? rx + RIB_W + OVER$2 : rx + RIB_W - RIB_WALL;
		const bosses = [];
		for (let k = 0; k < nSlots; k++) {
			const z = (k + .5) * SLOT_PITCH - .25;
			bosses.push(translate([
				px0,
				FRONT_HOLE_Y,
				z
			], axisCylinder("+x", px1 - px0, RIB_BOSS_D / 2, 24)));
			if (rearHoles) bosses.push(translate([
				px0,
				ACC_REAR_HOLE_Y,
				z
			], axisCylinder("+x", px1 - px0, RIB_BOSS_D / 2, 24)));
			if (backAnchorY !== void 0) bosses.push(translate([
				px0,
				backAnchorY,
				z
			], axisCylinder("+x", px1 - px0, RIB_BOSS_D / 2, 24)));
		}
		out.push(difference([translate([
			px0,
			8,
			8
		], cube([
			px1 - px0,
			d - 16,
			h - 8 + OVER$2
		])), ...bosses]));
	}
	return out;
}
/** Cable tray: shelf-like ribs + a deck with tie-wrap comb fingers along the
*  front and rear edges. Occupies 2 slots. */
function buildCableTray(dims) {
	const { width, depth } = dims;
	const nSlots = 2;
	const h = nSlots * SLOT_PITCH - .5;
	const d = Math.min(104, depth - FRONT_BAND / 2);
	const ribX = [15.3, width - 15 - SIDE_CLEAR - RIB_W];
	const solid = [];
	const cuts = [];
	for (const rx of ribX) solid.push(translate([
		rx,
		0,
		0
	], cube([
		RIB_W,
		d,
		h
	])));
	const deckX0 = 16.3;
	const deckW = width - 2 * deckX0;
	solid.push(translate([
		deckX0,
		0,
		0
	], cube([
		deckW,
		d,
		4
	])));
	const fingerW = 5;
	const fingerGap = 12;
	const nf = Math.floor((deckW - 10) / 17);
	for (let i = 0; i < nf; i++) {
		const fx = 21.3 + (deckW - 10 - nf * 17 + fingerGap) / 2 + i * 17;
		solid.push(translate([
			fx,
			0,
			0
		], cube([
			fingerW,
			EAR_T,
			25
		])));
		solid.push(translate([
			fx,
			d - EAR_T,
			0
		], cube([
			fingerW,
			EAR_T,
			25
		])));
	}
	for (let k = 0; k < nSlots; k++) {
		const z = (k + .5) * SLOT_PITCH - .25;
		for (const rx of ribX) cuts.push(ribStarter(rx, FRONT_HOLE_Y, z));
	}
	cuts.push(...ribChannelCuts(width, ribX, d, h, nSlots, false));
	cuts.push(translate([
		0,
		0,
		-1
	], extrude(lightenPocket(pTranslate([deckX0, 0], rectProfile(deckW, d)), {
		rim: 10,
		rib: 3,
		pitch: 14
	}), 6)));
	return difference([union$1(solid), ...cuts]);
}
/** The separate french-cleat strip that screws to the wall (cleat mode). */
function buildWallCleat(dims) {
	const { width } = dims;
	const len = width - 2 * CLEAT_FIT;
	const diag = 16 * Math.SQRT2;
	const body = cube([
		len,
		CLEAT_D,
		CLEAT_H
	]);
	const cuts = [translate([
		-1,
		0,
		25
	], rotate([
		45,
		0,
		0
	], cube([
		len + 2,
		diag,
		diag
	])))];
	const screws = Math.max(3, Math.floor(width / 80));
	for (let i = 0; i < screws; i++) {
		const x = len * (i + 1) / (screws + 1);
		cuts.push(translate([
			x,
			-1,
			9
		], axisCylinder("+y", 17, WALL_SCREW_D / 2, 24)));
		cuts.push(translate([
			x,
			-1,
			9
		], axisCylinder("+y", 3, WALL_HEAD_D / 2, 32)));
	}
	return difference([body, ...cuts]);
}
/** Flat spacer strip for cleat mode — same depth as the cleat, mounted low
*  on the wall so the rack hangs plumb. */
function buildWallSpacer(dims) {
	const len = dims.width - 2 * CLEAT_FIT;
	const cuts = [];
	const screws = Math.max(3, Math.floor(dims.width / 80));
	for (let i = 0; i < screws; i++) {
		const x = len * (i + 1) / (screws + 1);
		cuts.push(translate([
			x,
			-1,
			10
		], axisCylinder("+y", 17, WALL_SCREW_D / 2, 24)));
		cuts.push(translate([
			x,
			-1,
			10
		], axisCylinder("+y", 3, WALL_HEAD_D / 2, 32)));
	}
	return difference([cube([
		len,
		CLEAT_D,
		20
	]), ...cuts]);
}
/**
* Wall-mount ear screws per side.
*
* A loaded rack hangs off these, and the load grows with the box: a 250 mm
* deep rack cantilevers hard off the wall, and the ear is the only thing
* carrying it. Two screws at a third and two thirds of the height — the old
* rule — is thin for anything of size.
*
* So: one screw per ~60 mm of blade and never fewer than four. Erring high is
* deliberate — extra holes cost almost nothing to print, and more of them up
* the blade gives more chances to land on a stud or on solid backing rather
* than bare plasterboard. At the sample height that is five a side.
*/
function earScrewsPerSide(bodyH) {
	return Math.max(4, Math.round(bodyH / 60));
}
/**
* Can the whole rack be printed in one piece on the selected printer?
*
* It is a box: it prints in its assembly orientation, so this is straight or
* turned 90 degrees on the bed, nothing diagonal, and the full height has to
* clear. Shared by the compiler and the panel so the offer and the checkbox
* can never disagree.
*/
function rackFitsWhole(rack, printerOverride) {
	const printer = printerOverride ?? rack.printer;
	if (!printer) return false;
	const { width, depth, totalH } = computeRackDims(rack);
	return (width <= printer.x && depth <= printer.y || depth <= printer.x && width <= printer.y) && totalH <= printer.z;
}
/**
* Downstand stiffening ribs under the floor plate.
*
* There is 5 mm of clear air beneath the plate doing nothing — the feet are
* under the SIDES, not under the deck — so ribs cost no space. 4 mm deep takes
* the section from 5 mm to 9 mm where it counts, and stiffness goes as depth
* cubed. 1 mm of ground clearance is left deliberately: ribs reaching the floor
* would help a freestanding rack and do nothing for a wall-mounted one, which
* is the case that needs them.
*
* The perimeter rib matters as much as the cross ribs. Only the END tabs bear
* downward — the mid tab has nothing under it and merely resists uplift — so
* the load runs to four corners, and the edge rib is the beam that gets it
* there.
*/
const FLOOR_RIB_D = 4;
const FLOOR_RIB_W = 3;
const FLOOR_RIB_PITCH = 45;
/** Plate span past which ribs default ON. */
const FLOOR_RIB_AUTO_SPAN = 260;
/** Ribs on? Explicit setting wins; otherwise on once the span gets wide. */
function floorRibsEnabled(rack) {
	if (rack.floorRibs !== void 0) return rack.floorRibs;
	return computeRackDims(rack).plateW >= FLOOR_RIB_AUTO_SPAN;
}
/** Minimum wall left between two adjacent notches. */
const NOTCH_GAP = 6;
/**
* Cable / power pass-throughs in a plate's REAR edge, cut in ASSEMBLY space.
*
* Assembly space matters: the top plate is the bottom one turned over, and
* that flip maps the authored rear edge to the front. Cutting here — after the
* flip — puts the notch at the back of whichever plate carries it, at the cost
* of the two plates no longer being one printed part. That trade is the user's
* to make, so notches are opt-in and the panel says so.
*
* Slots open at the rear edge and are rounded at their inner end: a square
* inside corner is where a loaded plate starts a crack, and a cable dragged
* over a sharp edge is a cable that eventually shorts.
*/
/**
* Where the cable notches sit, sized and clamped — resolved ONCE so the plates
* and any full-depth shelf cut the same slots at the same x. A cable dropping
* through a shelf has to line up with the plate opening below it, so these
* cannot be computed twice.
*/
function cableNotchGeometry(rack, dims) {
	const cfg = rack.cableNotches;
	if (!cfg || cfg.count < 1) return null;
	const span = dims.plateW - 36;
	if (span <= 0) return null;
	const w = Math.max(4, Math.min(cfg.width, span / cfg.count - NOTCH_GAP));
	if (w < 4) return null;
	const d = Math.max(4, Math.min(cfg.depth, dims.depth * .4));
	const cx = [];
	for (let i = 0; i < cfg.count; i++) cx.push(33.3 + span * (i + .5) / cfg.count);
	return {
		cx,
		w,
		d
	};
}
function plateNotchCuts(rack, dims, zBase, ribD = 0) {
	const g = cableNotchGeometry(rack, dims);
	if (!g) return [];
	const { w, d } = g;
	const cuts = [];
	const z0 = zBase - ribD - OVER$2;
	const thru = PLATE_T + ribD + 2;
	for (const cx of g.cx) {
		const yInner = dims.depth - d + w / 2;
		cuts.push(translate([
			cx - w / 2,
			yInner,
			z0
		], cube([
			w,
			dims.depth - yInner + OVER$2,
			thru
		])));
		cuts.push(translate([
			cx,
			yInner,
			z0
		], cylinder(thru, w / 2, 32)));
	}
	return cuts;
}
/**
* The same notches as flat footprints in the plate's OWN coordinates, so the
* deck's lattice can keep solid material around them.
*
* Without this the walls between notches land wherever the lattice happens to
* be open and come away as detached fingers — eight notches at the minimum
* spacing split the plate into NINE separate bodies. The flip is why this
* needs the plate argument: a rear notch is at authored y≈depth on the bottom
* plate and authored y≈0 on the top one.
*/
function notchKeepOut(rack, dims, which) {
	const cfg = rack.cableNotches;
	if (!cfg || cfg.plate !== "both" && cfg.plate !== which) return [];
	const g = cableNotchGeometry(rack, dims);
	if (!g) return [];
	const pad = 5;
	return g.cx.map((cx) => pTranslate([cx - g.w / 2 - pad, which === "bottom" ? dims.depth - g.d - pad : -5], rectProfile(g.w + 10, g.d + 10)));
}
/** Apply the rear cable notches to a plate, if this one carries them. */
function withNotches(op, rack, dims, which, zBase, ribD = 0) {
	const cfg = rack.cableNotches;
	if (!cfg || cfg.plate !== "both" && cfg.plate !== which) return op;
	const cuts = plateNotchCuts(rack, dims, zBase, ribD);
	return cuts.length > 0 ? difference([op, ...cuts]) : op;
}
/**
* Optional one-piece exports. Printing the rack fused is far stronger than
* bolting it together, at the cost of a very long print and heavy internal
* support — so these are OFFERED, never substituted for the separate parts,
* and only when the whole thing fits the selected printer.
*
* Two variants, because they are not the same gamble:
*  - FRAME: sides + plates, compiled with the plate-tab joint NOMINAL (#356) so
*    the two halves close on every face. Support stays in the open interior
*    where a hand can reach.
*  - ALL: accessories too. Those sit on SIDE_CLEAR and do NOT touch, so they
*    are welded to the sides deliberately. Shelf positions become permanent
*    and the support under each deck is sealed in, reachable only through the
*    side vent windows.
*/
function assembledNodes(rack, dims, built, accessoryOps, printer) {
	const { width, depth } = dims;
	if (!rack.assembledExport || !rackFitsWhole(rack, printer)) return [];
	const FRAME_IDS = [
		"rack-side-left",
		"rack-side-right",
		"rack-bottom",
		"rack-top"
	];
	const frameOps = frameParts(rack, dims, true).map((n) => n.op);
	const plateWelds = [];
	const wt = 1.1;
	for (const zPlate of [5, 5 + dims.bodyH - PLATE_T]) {
		plateWelds.push(translate([
			14.6,
			0,
			zPlate
		], cube([
			wt,
			depth,
			PLATE_T
		])));
		plateWelds.push(translate([
			width - 15 - SIDE_CLEAR - .4,
			0,
			zPlate
		], cube([
			wt,
			depth,
			PLATE_T
		])));
	}
	const out = [{
		id: "rack-assembled-frame",
		op: union$1([...frameOps, ...plateWelds]),
		variant: {
			replaces: FRAME_IDS,
			label: "Rack frame, welded — one piece"
		}
	}];
	if (accessoryOps.length > 0) {
		const welds = [];
		for (const op of accessoryOps) {
			const bb = aabbOfOp(op);
			if (!bb) continue;
			const y0 = bb.min[1];
			const dy = bb.max[1] - y0;
			const z0 = bb.min[2];
			const dz = bb.max[2] - z0;
			const t = 1.1;
			welds.push(translate([
				14.6,
				y0,
				z0
			], cube([
				t,
				dy,
				dz
			])));
			welds.push(translate([
				width - 15 - SIDE_CLEAR - .4,
				y0,
				z0
			], cube([
				t,
				dy,
				dz
			])));
		}
		out.push({
			id: "rack-assembled-all",
			op: union$1([
				...frameOps,
				...plateWelds,
				...accessoryOps,
				...welds
			]),
			variant: {
				replaces: [...FRAME_IDS, ...built.filter((n) => !FRAME_IDS.includes(n.id)).map((n) => n.id)],
				label: "Whole rack, welded — one piece"
			}
		});
	}
	return out;
}
/**
* The four structural parts — the two sides and the two plates — positioned in
* assembly space. The ONE copy of their construction: `buildRackNodes` emits
* these as the printed parts, and `assembledNodes` calls this again with
* `fused` for the one-piece export, so the two can never drift apart.
*
* `fused` compiles the plate-tab joint NOMINAL (`tabZJoint`): the sides keep
* the fitting on the width but lose it in z, and the plates lose the tab shave.
* See `tabZJoint` for why the one-piece export needs that.
*/
function frameParts(rack, dims, fused = false) {
	const floorRibs = floorRibsEnabled(rack);
	const { shave } = tabZJoint(rack, fused);
	return [
		{
			id: "rack-side-left",
			op: buildSide(rack, dims, false, fused)
		},
		{
			id: "rack-side-right",
			op: buildSide(rack, dims, true, fused)
		},
		{
			id: "rack-bottom",
			op: withNotches(translate([
				0,
				0,
				5
			], buildPlate(dims, notchKeepOut(rack, dims, "bottom"), floorRibs, shave)), rack, dims, "bottom", 5, floorRibs ? FLOOR_RIB_D : 0)
		},
		{
			id: "rack-top",
			op: withNotches(translate([
				0,
				dims.depth,
				5 + dims.bodyH
			], rotate([
				180,
				0,
				0
			], buildPlate(dims, notchKeepOut(rack, dims, "top"), false, shave))), rack, dims, "top", 5 + dims.bodyH - PLATE_T)
		}
	];
}
/** Compile the whole rack to one BuildNode per printable part, positioned in
*  assembly space so the viewport previews the assembled rack. */
function buildRackNodes(rack, printer) {
	if (rack.mode === "u-mount") return buildUMountNodes({
		u: rack.u ?? 6,
		depth: rack.depth
	}, printer);
	const dims = computeRackDims(rack);
	const nodes = frameParts(rack, dims);
	const accessoryOps = [];
	let cursor = 0;
	(rack.accessories ?? []).forEach((acc, i) => {
		const n = accessorySlots(acc);
		const z0 = dims.slotZ(Math.min(cursor, Math.max(0, dims.slots - n))) + .25;
		cursor += n;
		const placed = accessoryPlacedOp(rack, dims, acc, n, z0);
		accessoryOps.push(placed);
		nodes.push({
			id: `rack-${acc.type}-${i}`,
			op: placed
		});
	});
	nodes.push(...assembledNodes(rack, dims, nodes, accessoryOps, printer));
	if (rack.wallMount === "cleat") {
		const seatZ = 5 + dims.bodyH - CLEAT_SEAT_DROP;
		nodes.push({
			id: "rack-wall-cleat",
			op: translate([
				CLEAT_FIT,
				dims.depth - CLEAT_D,
				seatZ - CLEAT_H + CLEAT_D
			], buildWallCleat(dims))
		});
		nodes.push({
			id: "rack-wall-spacer",
			op: translate([
				CLEAT_FIT,
				dims.depth - CLEAT_D,
				5
			], buildWallSpacer(dims))
		});
	}
	return nodes;
}
/**
* One accessory's op, placed in assembly coordinates — shared by the node list
* and the split parts (#266) so the two can never build different accessories.
* Recessed behind the sides' protective front columns (FRONT_RECESS).
*/
function accessoryPlacedOp(rack, dims, acc, n, z0) {
	let op;
	if (acc.type === "blank") op = buildBlank(dims, n);
	else if (acc.type === "keystone") op = buildKeystone(dims, n).op;
	else if (acc.type === "shelf") op = buildShelf(dims, n, resolveShelfDepth(acc.shelfDepth, dims.depth), {
		frontPlate: acc.frontPlate,
		vented: acc.vented,
		rearNotches: acc.shelfDepth === "full" ? cableNotchGeometry(rack, dims) ?? void 0 : void 0
	});
	else op = buildCableTray(dims);
	return translate([
		0,
		12,
		z0
	], op);
}
/** #266 — the free face each rack part's split strap stands on. */
function strapFaceFor(id) {
	if (id === "rack-top") return {
		axis: 2,
		sign: 1
	};
	if (id === "rack-side-left") return {
		axis: 0,
		sign: -1
	};
	if (id === "rack-side-right") return {
		axis: 0,
		sign: 1
	};
	return {
		axis: 2,
		sign: -1
	};
}
/**
* #266 — where a SIDE PANEL's seam may not run: the accessory screw columns
* (every hole up the height at these Y values) and the fan openings. Both are
* the same facts `validateRackFit` reports on, read here as regions instead of
* warnings. The X span covers the whole width so the same list serves both
* panels.
*/
function sidePanelKeepOuts(rack, dims) {
	const out = [];
	for (const fan of rack.fans ?? []) {
		const spec = FAN_SPECS[fan.size] ?? FAN_SPECS[80];
		const { y, z } = fanCenter(fan, dims);
		const half = spec.opening / 2;
		out.push({
			min: [
				-1,
				y - half,
				z - half
			],
			max: [
				dims.width + 1,
				y + half,
				z + half
			]
		});
	}
	const columns = [22, ...dims.depth >= 132 ? [100] : []];
	for (const colY of columns) out.push({
		min: [
			-1,
			colY - 10 / 2,
			0
		],
		max: [
			dims.width + 1,
			colY + 10 / 2,
			dims.totalH
		]
	});
	return out;
}
/** #266 — the solid strip a shelf's or tray's seam runs through, mm along the
*  seam (the strap's own width, so the band and the strap agree). */
const SEAM_BAND_W = 12;
/**
* #266 — a KEYSTONE plate's seam keep-outs: the jack windows and the cable
* pass-through. The seam must land between whole jacks, or a piece loses half
* an opening and a jack stops fitting.
*/
function keystoneKeepOuts(dims, nSlots, z0) {
	const h = nSlots * SLOT_PITCH - .5;
	const zC = z0 + h / 2;
	const { jacksX, spare } = keystoneLayout(dims.width);
	const out = jacksX.map((cx) => ({
		min: [
			cx - 15 / 2,
			-1,
			zC - KS_WIN_H / 2
		],
		max: [
			cx + 15 / 2,
			dims.depth + 1,
			zC + KS_WIN_H / 2
		]
	}));
	if (spare !== null) {
		const sz = z0 + h / 2 + 9;
		out.push({
			min: [
				spare.x,
				-1,
				sz - 9
			],
			max: [
				spare.x + spare.w,
				dims.depth + 1,
				sz + 9
			]
		});
	}
	return out;
}
/** The parts a split would work on, rebuilt from the same builders the node
*  list uses, each with the face its strap stands on and its seam keep-outs. */
function rackSplitEntries(rack, dims) {
	const out = frameParts(rack, dims).map((n) => ({
		id: n.id,
		op: n.op,
		face: strapFaceFor(n.id),
		keepOut: n.id.startsWith("rack-side") ? sidePanelKeepOuts(rack, dims) : []
	}));
	let cursor = 0;
	(rack.accessories ?? []).forEach((acc, i) => {
		const n = accessorySlots(acc);
		const z0 = dims.slotZ(Math.min(cursor, Math.max(0, dims.slots - n))) + .25;
		cursor += n;
		const keepOut = acc.type === "keystone" ? keystoneKeepOuts(dims, n, z0) : [];
		const seamBand = acc.type === "shelf" ? {
			z: [z0, z0 + 3],
			width: SEAM_BAND_W
		} : acc.type === "cable-tray" ? {
			z: [z0, z0 + 4],
			width: SEAM_BAND_W
		} : void 0;
		out.push({
			id: `rack-${acc.type}-${i}`,
			op: accessoryPlacedOp(rack, dims, acc, n, z0),
			face: strapFaceOfAccessory(),
			keepOut,
			...seamBand !== void 0 ? { seamBand } : {}
		});
	});
	return out;
}
/** Accessories: the underside, the same face the bottom plate uses. */
function strapFaceOfAccessory() {
	return {
		axis: 2,
		sign: -1
	};
}
/**
* #266 — what a split can do for every rack part over the bed, part by part.
*
* The offer is the ENGINE's answer (bounds and seam arithmetic — no Manifold
* evaluation), so the panel and the exporter can show what would be built
* before anything is. `tooTall` is reported on its own: a vertical seam cannot
* help a part over the bed's height, and saying "blocked" would hide the real
* reason.
*/
function rackSplitOffers(rack, printerOverride) {
	const printer = printerOverride ?? rack.printer;
	if (!printer) return [];
	const dims = computeRackDims(rack);
	const offers = [];
	for (const part of rackSplitEntries(rack, dims)) {
		const bounds = aabbOfOp(part.op);
		if (!bounds) continue;
		const w = bounds.max[0] - bounds.min[0];
		const d = bounds.max[1] - bounds.min[1];
		if (bounds.max[2] - bounds.min[2] > printer.z) {
			offers.push({
				partId: part.id,
				state: "tooTall"
			});
			continue;
		}
		if (partFitsBed(w, d, printer)) continue;
		const plan = planRackPartSplit({
			partOp: part.op,
			bounds,
			printer,
			face: part.face,
			keepOut: part.keepOut,
			...part.seamBand !== void 0 ? { seamBand: part.seamBand } : {}
		});
		offers.push(plan ? {
			partId: part.id,
			state: "available",
			pieces: plan.pieces.length,
			screws: plan.screwCount,
			screwLabel: `${"M3"}×${8 * 2} socket cap`,
			seams: plan.seams
		} : {
			partId: part.id,
			state: "blocked"
		});
	}
	return offers;
}
/**
* #266 — the split PIECES for every rack part over the bed, as alternatives to
* the whole parts. Only called when the project asks for the split: the
* builder's cuts and straps are real Manifold work.
*/
function buildRackSplitNodes(rack, printerOverride) {
	const printer = printerOverride ?? rack.printer;
	if (!printer) return [];
	const dims = computeRackDims(rack);
	const out = [];
	for (const part of rackSplitEntries(rack, dims)) {
		const bounds = aabbOfOp(part.op);
		if (!bounds) continue;
		const split = buildRackPartSplit({
			partOp: part.op,
			bounds,
			printer,
			face: part.face,
			keepOut: part.keepOut,
			...part.seamBand !== void 0 ? { seamBand: part.seamBand } : {}
		}, void 0, part.id);
		if (split) out.push(...split.nodes);
	}
	return out;
}

// vendor/casemaker/casemaker-app/src/engine/compiler/stand.ts
/**
* Desk stand for a finished display module (BoardProfile.enclosure).
*
* Two fused features, printed as ONE part standing on its foot:
*
*   FRAME — a plate matching the module's outline. The module's rear body
*   passes THROUGH the frame's opening; its front flange seats on the frame's
*   front face; its mounting bosses sink into counterbored pockets so the
*   flange sits flush. Screws pass from the frame's BACK into the bosses.
*   The middle is open, so back-facing connectors (the Guition panel plugs its
*   USB-C straight out the back) stay reachable and nothing traps heat.
*
*   FOOT — a plate on the desk, braced to the frame by a gusset at each side.
*   The gussets live in the frame's side rims, keeping the area behind the
*   opening clear for cables.
*
* Print orientation: as modelled. Standing on the foot, the frame leans back
* by `tiltAngleDeg`, so its faces sit at (90 - tilt)° to the bed — 75° at the
* default 15°, comfortably self-supporting. The gussets taper to a point as
* they rise, so every layer lands on the one below.
*
* Frame-local coords (before the tilt is applied):
*   x: 0..W across the screen        y: 0..H up the screen
*   z: 0 = BACK face, z = T = FRONT face (the side the module seats against)
*/
/** Rise of the frame's bottom edge into the foot, so the two fuse manifold. */
const FOOT_EMBED = 2;
/** Gussets bite this far into the frame's back face, so they fuse. */
const GUSSET_BITE = 1.5;
/** Pocket clearance around a boss (per side, on the diameter). */
const BOSS_FIT = .4;
/** Screw-head counterbore on the frame's back face. */
const HEAD_CLEARANCE = 1.8;
/** Overshoot so cutters punch cleanly through faces. */
const OVER$1 = 1;
function computeStandDims(board, stand) {
	const t = stand.tiltAngleDeg * Math.PI / 180;
	const frameW = board.pcb.size.x + 2 * stand.bezelMargin;
	const frameH = board.pcb.size.y + 2 * stand.bezelMargin;
	const frameT = stand.frameThickness;
	const reach = frameH * Math.sin(t) + frameT * Math.cos(t);
	return {
		frameW,
		frameH,
		frameT,
		outerX: frameW,
		outerY: Math.max(stand.baseDepth, reach + 2),
		outerZ: stand.baseThickness - FOOT_EMBED + frameH * Math.cos(t) + frameT * Math.sin(t)
	};
}
/**
* Triangular prism extruded along X, from a triangle given in the (y, z)
* plane. Vertices are wound so the prism is a closed, outward-facing solid
* regardless of the caller's ordering.
*/
function triPrismX(tri, xMin, xMax) {
	const a = tri[0];
	let b = tri[1];
	let c = tri[2];
	if ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) < 0) {
		const swap = b;
		b = c;
		c = swap;
	}
	const positions = [];
	for (const [y, z] of [
		a,
		b,
		c
	]) positions.push(xMin, y, z);
	for (const [y, z] of [
		a,
		b,
		c
	]) positions.push(xMax, y, z);
	return mesh(new Float32Array(positions), new Uint32Array([
		0,
		2,
		1,
		3,
		4,
		5,
		0,
		1,
		4,
		0,
		4,
		3,
		1,
		2,
		5,
		1,
		5,
		4,
		2,
		0,
		3,
		2,
		3,
		5
	]));
}
/**
* Triangular prism extruded along Y, from a triangle given in the (x, z)
* plane. Same purpose as `triPrismX` (closed, outward-facing solid whatever
* the caller's vertex order) — but the caps are wound differently, because a
* triangle CCW in (x, z) has its natural normal along −y, not +y. Verified by
* volume in the pocket-carrier spec.
*/
function triPrismY(tri, yMin, yMax) {
	const a = tri[0];
	let b = tri[1];
	let c = tri[2];
	if ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) < 0) {
		const swap = b;
		b = c;
		c = swap;
	}
	const positions = [];
	for (const [x, z] of [
		a,
		b,
		c
	]) positions.push(x, yMin, z);
	for (const [x, z] of [
		a,
		b,
		c
	]) positions.push(x, yMax, z);
	return mesh(new Float32Array(positions), new Uint32Array([
		0,
		1,
		2,
		3,
		5,
		4,
		0,
		4,
		1,
		0,
		3,
		4,
		1,
		4,
		5,
		1,
		5,
		2,
		2,
		3,
		0,
		2,
		5,
		3
	]));
}
const WALL_DEFAULTS = {
	shroudDepth: 22,
	shroudWall: 4,
	plateThickness: 4,
	plateBorder: 12,
	drywallScrewDiameter: 4.4,
	drywallHeadDiameter: 8.5
};
/** Snap finger: a cantilever standing off the plate with an outward barb. */
const FINGER_H = 12;
const FINGER_T = 2.4;
const FINGER_W = 12;
const BARB_P = 1.5;
const BARB_H = 2.5;
/** Plate-to-shroud-cavity clearance, per side. */
const PLATE_FIT = .3;
/** Edge-protrusion channels: slack along the edge, and off the bump's tip. */
const CHANNEL_MARGIN = 1.5;
const CHANNEL_CLEAR = .6;
/** Thinner than this and a leftover rib isn't worth printing — take it out. */
const MIN_RIB = 1.2;
/**
* Board X → frame X. **The frame's X is MIRRORED relative to the board's.**
*
* Board coordinates are the module's BACK view (that's how the vendor drawing
* is dimensioned). The module seats FACE-TO-FACE against the frame: its flange
* rear touches the frame's front, so board +z points into the frame (= frame
* −z), while board +y still has to point up (the buttons are on the bottom
* edge). A rigid placement with z flipped and y kept must flip x — it's a 180°
* turn about the vertical axis. Turn a phone around to face you and a button on
* its back-LEFT ends up on your RIGHT.
*
* The bosses (108×60, centred) and the rear body are both symmetric in x, so
* they land correctly either way and hide this. The three soft buttons are not
* symmetric: get this wrong and their channels are cut on the wrong side.
*/
function mirrorX(board, stand, boardX) {
	return stand.bezelMargin + (board.pcb.size.x - boardX);
}
/**
* The frame plate, flat, in local coords (z: 0 = BACK, T = FRONT — the front
* is the face the module's flange seats against). Shared by both mounts.
*/
function buildFrameLocal(board, stand, W, H, T) {
	const enc = board.enclosure;
	const m = stand.bezelMargin;
	const outerR = Math.min(5, W / 4, H / 4);
	const cuts = [];
	const clr = stand.openingClearance;
	const openW = enc.body.width + 2 * clr;
	const openH = enc.body.height + 2 * clr;
	cuts.push(translate([
		mirrorX(board, stand, enc.body.x + enc.body.width) - clr,
		m + enc.body.y - clr,
		-1
	], roundedRectPrism(openW, openH, T + 2, Math.min(3, openW / 4, openH / 4))));
	const pocketDepth = enc.bossHeight + .2;
	for (const h of board.mountingHoles) {
		const hx = mirrorX(board, stand, h.x);
		const hy = m + h.y;
		cuts.push(translate([
			hx,
			hy,
			T - pocketDepth
		], cylinder(pocketDepth + OVER$1, (enc.bossDiameter + BOSS_FIT) / 2, 48)));
		cuts.push(translate([
			hx,
			hy,
			-1
		], cylinder(T + 2, stand.screwHoleDiameter / 2, 32)));
		cuts.push(translate([
			hx,
			hy,
			-1
		], cylinder(2.5, (stand.screwHoleDiameter + HEAD_CLEARANCE) / 2, 32)));
	}
	return difference([roundedRectPrism(W, H, T, outerR), ...cuts]);
}
/**
* Channels for anything standing proud of the rear body's side faces — the
* Guition panel's three soft buttons. Without these the frame's opening hugs
* the body and holds the buttons permanently pressed.
*
* Returned in FRAME-LOCAL coords, but they must be subtracted from the whole
* assembled part, not just the frame: the desk stand's frame sinks its bottom
* edge into the foot, and the buttons live exactly in that overlap — cut the
* frame alone and the foot fills the channel straight back in.
*
* Each channel runs through the frame's FULL thickness, so the button slides in
* along the insertion path and is never pressed in to reach a recess. It opens
* into the frame's opening, and if the rib left outboard of it would be thinner
* than MIN_RIB it is taken right out to the frame's edge — a sub-millimetre
* sliver of plastic there is neither printable nor useful.
*/
function buildEdgeChannels(board, stand, W, H, T) {
	const enc = board.enclosure;
	const m = stand.bezelMargin;
	const bx0 = mirrorX(board, stand, enc.body.x + enc.body.width);
	const bx1 = mirrorX(board, stand, enc.body.x);
	const by0 = m + enc.body.y;
	const by1 = by0 + enc.body.height;
	const zLo = -1;
	const zLen = T + 2;
	const out = [];
	for (const p of enc.edgeProtrusions ?? []) {
		const reach = p.depth + CHANNEL_CLEAR;
		if (p.edge === "-y" || p.edge === "+y") {
			const a = mirrorX(board, stand, Math.max(p.from, p.to)) - CHANNEL_MARGIN;
			const b = mirrorX(board, stand, Math.min(p.from, p.to)) + CHANNEL_MARGIN;
			let yLo = p.edge === "-y" ? by0 - reach : by1 - .5;
			let yHi = p.edge === "-y" ? by0 + .5 : by1 + reach;
			if (p.edge === "-y" && yLo < MIN_RIB) yLo = -1;
			if (p.edge === "+y" && H - yHi < MIN_RIB) yHi = H + OVER$1;
			out.push(translate([
				a,
				yLo,
				zLo
			], cube([
				b - a,
				yHi - yLo,
				zLen
			])));
		} else {
			const a = m + Math.min(p.from, p.to) - CHANNEL_MARGIN;
			const b = m + Math.max(p.from, p.to) + CHANNEL_MARGIN;
			const frameEdge = p.edge === "-x" ? "+x" : "-x";
			let xLo = frameEdge === "-x" ? bx0 - reach : bx1 - .5;
			let xHi = frameEdge === "-x" ? bx0 + .5 : bx1 + reach;
			if (frameEdge === "-x" && xLo < MIN_RIB) xLo = -1;
			if (frameEdge === "+x" && W - xHi < MIN_RIB) xHi = W + OVER$1;
			out.push(translate([
				xLo,
				a,
				zLo
			], cube([
				xHi - xLo,
				b - a,
				zLen
			])));
		}
	}
	return out;
}
/**
* Build the desk stand: frame + foot + gussets, fused into a single solid.
* Returns null when the board isn't a finished enclosure module (a stand has
* nothing to grip on a bare PCB).
*/
function buildStandOp(board, stand) {
	if (!board.enclosure) return null;
	const { frameW: W, frameH: H, frameT: T } = computeStandDims(board, stand);
	const t = stand.tiltAngleDeg * Math.PI / 180;
	const sinT = Math.sin(t);
	const cosT = Math.cos(t);
	const frameLocal = buildFrameLocal(board, stand, W, H, T);
	const rotated = rotate([
		90 - stand.tiltAngleDeg,
		0,
		0
	], frameLocal);
	const Ty = T * cosT + 2;
	const Tz = stand.baseThickness - FOOT_EMBED;
	const frame = translate([
		0,
		Ty,
		Tz
	], rotated);
	const baseDepth = Math.max(stand.baseDepth, H * sinT + T * cosT + 12);
	const foot = translate([
		0,
		0,
		0
	], roundedRectPrism(W, baseDepth, stand.baseThickness, Math.min(4, W / 6)));
	const backFaceY = (z) => Ty + (z - Tz) * (sinT / cosT) - GUSSET_BITE;
	const zBot = stand.baseThickness;
	const zTop = stand.baseThickness + stand.gussetHeightFraction * H * cosT;
	const yHeel = baseDepth - 2;
	const tri = [
		[backFaceY(zBot), zBot],
		[yHeel, zBot],
		[backFaceY(zTop), zTop]
	];
	const gussets = [];
	if (yHeel > backFaceY(zBot) + 4 && zTop > zBot + 4) {
		const gt = stand.gussetThickness;
		gussets.push(triPrismX(tri, 0, gt));
		gussets.push(triPrismX(tri, W - gt, W));
	}
	const BIG = 500;
	const frontHalfSpace = translate([
		0,
		Ty,
		Tz
	], rotate([
		90 - stand.tiltAngleDeg,
		0,
		0
	], translate([
		-500,
		-500,
		T
	], cube([
		W + 2 * BIG,
		H + 2 * BIG,
		BIG
	]))));
	const channels = buildEdgeChannels(board, stand, W, H, T).map((c) => translate([
		0,
		Ty,
		Tz
	], rotate([
		90 - stand.tiltAngleDeg,
		0,
		0
	], c)));
	return difference([
		union$1([
			foot,
			frame,
			...gussets
		]),
		frontHalfSpace,
		...channels
	]);
}
/** Axial fit: lip inner face ↔ wing underside, and wing top ↔ channel floor. */
const SLIDER_AXIAL_FIT = .3;
/** Foot in front of the device's bottom-front corner — the anti-tip reserve. */
const SLIDER_FRONT_MARGIN = 30;
/** Foot behind the column's top-back corner (gusset heel room). */
const SLIDER_BACK_MARGIN = 12;
/** Overlap embeds so the union fuses into one shell (see buildWallPlate). */
const SLIDER_EMBED = .8;
function computeSliderDims(board, stand) {
	const enc = board.enclosure;
	const ch = enc?.sliderChannel;
	if (!enc || !ch) return null;
	const t = stand.tiltAngleDeg * Math.PI / 180;
	const sinT = Math.sin(t);
	const cosT = Math.cos(t);
	const colT = stand.frameThickness;
	const colW = ch.cavityWidth + 2 * stand.bezelMargin;
	const Tz = stand.baseThickness - FOOT_EMBED;
	const colH = ch.topFromDeviceBottom + 8 / cosT;
	const devD = enc.flangeThickness + enc.body.depth;
	const yDevBot = colH - ch.topFromDeviceBottom;
	const TyCol = Math.max(5, SLIDER_FRONT_MARGIN + devD * cosT - yDevBot * sinT) + colT * cosT;
	const baseDepth = Math.max(stand.baseDepth, TyCol + colH * sinT + SLIDER_BACK_MARGIN);
	const footW = Math.max(colW + 2 * stand.gussetThickness + 20, .75 * board.pcb.size.x);
	const fit = stand.openingClearance;
	const wingT = ch.totalDepth - ch.lipDepth - 2 * SLIDER_AXIAL_FIT;
	if (wingT < .8) return null;
	return {
		colW,
		colH,
		colT,
		colX0: (footW - colW) / 2,
		footW,
		baseDepth,
		TyCol,
		Tz,
		throatW: ch.throatWidth - 2 * fit,
		wingW: ch.cavityWidth - 2 * fit,
		wingT,
		protrusion: ch.lipDepth + SLIDER_AXIAL_FIT + wingT,
		engagement: ch.length - 2,
		deviceBottomZ: Tz + yDevBot * cosT
	};
}
/**
* Build the slider bench stand: foot + tilted column + male T-bracket +
* gussets, fused into a single solid. Null when the board has no
* enclosure.sliderChannel (nothing to slide into).
*/
function buildSliderStandOp(board, stand) {
	const d = computeSliderDims(board, stand);
	if (!d) return null;
	const { colW: CW, colH: CH, colT: CT } = d;
	const t = stand.tiltAngleDeg * Math.PI / 180;
	const sinT = Math.sin(t);
	const cosT = Math.cos(t);
	const plate = roundedRectPrism(CW, CH, CT, Math.min(3, CW / 4));
	const yBot = CH - d.engagement;
	const P = d.protrusion;
	const ch = board.enclosure.sliderChannel;
	const throat = translate([
		(CW - d.throatW) / 2,
		yBot,
		CT - SLIDER_EMBED
	], cube([
		d.throatW,
		d.engagement,
		P + SLIDER_EMBED
	]));
	const wings = translate([
		(CW - d.wingW) / 2,
		yBot,
		CT + ch.lipDepth + SLIDER_AXIAL_FIT
	], cube([
		d.wingW,
		d.engagement,
		d.wingT
	]));
	const xCut0 = (CW - d.wingW) / 2 - 1;
	const xCut1 = (CW + d.wingW) / 2 + 1;
	const cutTop = triPrismX([
		[CH, CT],
		[CH - P - 1, CT + P + 1],
		[CH + P + 2, CT + P + 1]
	], xCut0, xCut1);
	const cutBot = triPrismX([
		[yBot, CT],
		[yBot + P + 1, CT + P + 1],
		[yBot - P - 2, CT + P + 1]
	], xCut0, xCut1);
	const columnLocal = difference([
		union$1([
			plate,
			throat,
			wings
		]),
		cutTop,
		cutBot
	]);
	const column = translate([
		d.colX0,
		d.TyCol,
		d.Tz
	], rotate([
		90 - stand.tiltAngleDeg,
		0,
		0
	], columnLocal));
	const foot = roundedRectPrism(d.footW, d.baseDepth, stand.baseThickness, Math.min(4, d.footW / 6));
	const backFaceY = (z) => d.TyCol + (z - d.Tz) * (sinT / cosT) - GUSSET_BITE;
	const zBot = stand.baseThickness - 1;
	const zTop = stand.baseThickness + stand.gussetHeightFraction * CH * cosT;
	const yHeel = d.baseDepth - 2;
	const gussets = [];
	if (yHeel > backFaceY(zBot) + 4 && zTop > zBot + 4) {
		const gt = stand.gussetThickness;
		const tri = [
			[backFaceY(zBot), zBot],
			[yHeel, zBot],
			[backFaceY(zTop), zTop]
		];
		gussets.push(triPrismX(tri, d.colX0, d.colX0 + gt));
		gussets.push(triPrismX(tri, d.colX0 + CW - gt, d.colX0 + CW));
	}
	return union$1([
		foot,
		column,
		...gussets
	]);
}
/**
* Wall mount — two parts that snap together.
*
*   WALL PLATE ("lid"): screws to the drywall. Big open middle so the cable
*   comes straight out of the wall into the cavity. Two counterbored screw
*   holes on the vertical centreline (two screws, not one, so it can't
*   rotate). Four cantilever fingers stand off it, each with an outward barb.
*
*   BODY: the same frame the module screws into, plus a shroud — a box of
*   walls standing off the frame's back that houses the USB plug and the wire
*   slack. Four windows through the shroud walls receive the plate's barbs.
*
* Assembly: plate to the wall first, then push the body on. The shroud's inner
* walls cam the fingers inward until the barbs spring out into the windows; the
* barbs' flat undersides then bear on the windows' lower edges and resist pull-
* off. The barbs show through the windows, so a small screwdriver in each
* window releases the body.
*
* Local Z for both parts: 0 = the wall, +z = out of the wall toward the viewer.
*/
function wallGeom(board, stand) {
	const enc = board.enclosure;
	const W = board.pcb.size.x + 2 * stand.bezelMargin;
	const H = board.pcb.size.y + 2 * stand.bezelMargin;
	const T = stand.frameThickness;
	const D = stand.shroudDepth ?? WALL_DEFAULTS.shroudDepth;
	const SW = stand.shroudWall ?? WALL_DEFAULTS.shroudWall;
	const P = stand.plateThickness ?? WALL_DEFAULTS.plateThickness;
	const cavW = W - 2 * SW;
	const cavH = H - 2 * SW;
	const plateW = cavW - 2 * PLATE_FIT;
	const plateH = cavH - 2 * PLATE_FIT;
	const plateX = SW + PLATE_FIT;
	return {
		enc,
		W,
		H,
		T,
		D,
		SW,
		P,
		cavW,
		cavH,
		plateW,
		plateH,
		plateX,
		plateY: SW + PLATE_FIT,
		barbZ0: P + FINGER_H - BARB_H,
		fingerXs: [plateX + plateW * .25 - FINGER_W / 2, plateX + plateW * .75 - FINGER_W / 2]
	};
}
function buildWallBody(board, stand) {
	const g = wallGeom(board, stand);
	const { W, H, T, D, SW, barbZ0, fingerXs } = g;
	const outerR = Math.min(5, W / 4, H / 4);
	const shroud = difference([roundedRectPrism(W, H, D, outerR), translate([
		SW,
		SW,
		-1
	], roundedRectPrism(g.cavW, g.cavH, D + 2, Math.max(.1, outerR - SW)))]);
	const frame = translate([
		0,
		0,
		D
	], buildFrameLocal(board, stand, W, H, T));
	const winZ0 = barbZ0 - .15;
	const winH = 4.5;
	const windows = [];
	for (const fx of fingerXs) {
		windows.push(translate([
			fx - 1,
			-1,
			winZ0
		], cube([
			14,
			SW + 2,
			winH
		])));
		windows.push(translate([
			fx - 1,
			H - SW - OVER$1,
			winZ0
		], cube([
			14,
			SW + 2,
			winH
		])));
	}
	const channels = buildEdgeChannels(board, stand, W, H, T).map((c) => translate([
		0,
		0,
		D
	], c));
	return difference([
		union$1([shroud, frame]),
		...windows,
		...channels
	]);
}
function buildWallPlate(board, stand) {
	const { P, plateW, plateH, plateX, plateY, barbZ0, fingerXs } = wallGeom(board, stand);
	const border = stand.plateBorder ?? WALL_DEFAULTS.plateBorder;
	const screwD = stand.drywallScrewDiameter ?? WALL_DEFAULTS.drywallScrewDiameter;
	const headD = stand.drywallHeadDiameter ?? WALL_DEFAULTS.drywallHeadDiameter;
	const plate = translate([
		plateX,
		plateY,
		0
	], roundedRectPrism(plateW, plateH, P, Math.min(4, plateW / 6)));
	const cuts = [];
	const openW = plateW - 2 * border;
	const openH = plateH - 2 * border;
	cuts.push(translate([
		plateX + border,
		plateY + border,
		-1
	], roundedRectPrism(openW, openH, P + 2, Math.min(6, openW / 6, openH / 6))));
	const cx = plateX + plateW / 2;
	const headDepth = Math.min(2.5, P - 1.5);
	for (const cy of [plateY + border / 2, plateY + plateH - border / 2]) {
		cuts.push(translate([
			cx,
			cy,
			-1
		], cylinder(P + 2, screwD / 2, 32)));
		cuts.push(translate([
			cx,
			cy,
			P - headDepth
		], cylinder(headDepth + OVER$1, headD / 2, 32)));
	}
	const plateBody = difference([plate, ...cuts]);
	const EMBED_F = .8;
	const parts = [plateBody];
	const yBot = plateY;
	const yTop = plateY + plateH;
	for (const fx of fingerXs) {
		parts.push(translate([
			fx,
			yBot,
			P - EMBED_F
		], cube([
			FINGER_W,
			FINGER_T,
			12.8
		])));
		parts.push(triPrismX([
			[yBot + EMBED_F, barbZ0],
			[yBot - BARB_P, barbZ0],
			[yBot + EMBED_F, barbZ0 + BARB_H]
		], fx, fx + FINGER_W));
		parts.push(translate([
			fx,
			yTop - FINGER_T,
			P - EMBED_F
		], cube([
			FINGER_W,
			FINGER_T,
			12.8
		])));
		parts.push(triPrismX([
			[yTop - EMBED_F, barbZ0],
			[yTop + BARB_P, barbZ0],
			[yTop - EMBED_F, barbZ0 + BARB_H]
		], fx, fx + FINGER_W));
	}
	return union$1(parts);
}
/** One gauge for the plate, walls, floor and ribs — the rack's ear/gusset
*  gauge (EAR_T). A pocket is not a place for a thickness knob. */
const POCKET_T = 4;
/** Nesting fit per side, when the caller asks for less than this. */
const POCKET_MIN_FIT = .3;
/** Pocket depth past the module's own thickness: finger room to lift it out. */
const POCKET_LIFT = 10;
/** 45° entry chamfer at the pocket mouth. */
const POCKET_LEAD = 3;
/** How far each ear reaches out past the side wall, for its wall screw. */
const POCKET_EAR_REACH = 18;
/** 45° rib leg, outboard of each side wall. Kept under the ear's own reach
*  (see the cap at its use) so a rib can never poke past the plate's edge. */
const POCKET_RIB_LEG = 16;
/** Overlap bites, so the ribs fuse to the plate, the wall AND the floor. */
const POCKET_BITE = 1;
/** Plate height at which an ear earns a second wall screw. One screw per ear
*  is a hinge; two spread up the plate cannot let the tray swing. */
const POCKET_TWO_SCREW_H = 60;
function computePocketDims(board, stand) {
	const enc = board.enclosure;
	if (!enc) return null;
	const fit = Math.max(POCKET_MIN_FIT, stand.openingClearance);
	const innerW = board.pcb.size.x + 2 * fit;
	const innerH = board.pcb.size.y + 2 * fit;
	const moduleD = enc.flangeThickness + Math.max(enc.body.depth, enc.bossHeight);
	const plateT = POCKET_T;
	const plateW = innerW + 44;
	const plateH = innerH + plateT;
	const n = plateH >= POCKET_TWO_SCREW_H ? 2 : 1;
	const earScrewYs = Array.from({ length: n }, (_, i) => plateH * (i + 1) / (n + 1));
	return {
		innerW,
		innerH,
		moduleD,
		pocketD: moduleD + POCKET_LIFT,
		plateT,
		earReach: POCKET_EAR_REACH,
		plateW,
		plateH,
		earScrewX: POCKET_EAR_REACH / 2,
		earScrewYs
	};
}
/**
* Build the pocket carrier: one wall shelf — back plate with a screw ear each
* side, a floor and two walls around the pocket, 45° lead-ins at the mouth,
* and a rib outboard of each wall. Null when the board isn't a finished
* module (there's no envelope to size a pocket from).
*/
function buildPocketOp(board, stand) {
	const d = computePocketDims(board, stand);
	if (!d) return null;
	const T = d.plateT;
	const mouth = T + d.pocketD;
	const plate = cube([
		d.plateW,
		d.plateH,
		T
	]);
	const wx0 = d.earReach;
	const trayW = d.innerW + 2 * T;
	const tray = translate([
		wx0,
		0,
		T - POCKET_BITE
	], cube([
		trayW,
		d.plateH,
		d.pocketD + POCKET_BITE
	]));
	const innerX0 = wx0 + T;
	const innerX1 = innerX0 + d.innerW;
	const cavity = translate([
		innerX0,
		T,
		T
	], cube([
		d.innerW,
		d.innerH,
		d.pocketD + OVER$1
	]));
	const lead = POCKET_LEAD;
	const leadTop = mouth + OVER$1;
	const leadLeft = triPrismY([
		[innerX0, mouth - lead],
		[innerX0, leadTop],
		[innerX0 - lead - OVER$1, leadTop]
	], T, d.plateH + OVER$1);
	const leadRight = triPrismY([
		[innerX1, mouth - lead],
		[innerX1, leadTop],
		[innerX1 + lead + OVER$1, leadTop]
	], T, d.plateH + OVER$1);
	const leadFloor = triPrismX([
		[T, mouth - lead],
		[T, leadTop],
		[T - lead - OVER$1, leadTop]
	], wx0, wx0 + trayW);
	const ribs = [];
	if (Math.min(...d.earScrewYs) - 9.6 / 2 > 2 * T + POCKET_BITE) {
		const B = POCKET_BITE;
		const leg = Math.min(POCKET_RIB_LEG, d.earReach - 2);
		const rib = (xWall, dir) => triPrismY([
			[xWall + dir * B, T - B],
			[xWall + dir * B, T + leg],
			[xWall - dir * leg, T - B]
		], 0, 2 * T);
		ribs.push(rib(wx0, 1), rib(wx0 + trayW, -1));
	}
	const cuts = [];
	for (const sx of [d.earScrewX, d.plateW - d.earScrewX]) for (const sy of d.earScrewYs) cuts.push(screwHole({
		size: "M4",
		at: [
			sx,
			sy,
			T
		],
		axis: "-z",
		through: T + OVER$1,
		clearanceD: WALL_SCREW_D,
		head: "socket-cap",
		headD: WALL_HEAD_D,
		recess: 2,
		material: T,
		segments: 24,
		recessSegments: 32
	}));
	return difference([
		union$1([
			plate,
			tray,
			...ribs
		]),
		cavity,
		leadLeft,
		leadRight,
		leadFloor,
		...cuts
	]);
}
/**
* The stand's print parts. Desk → one fused part. Wall → the body and the
* wall plate it snaps onto. Pocket → the wall shelf the module nests in.
* Null when the board isn't a finished module.
*/
function buildStandNodes(board, stand) {
	if (!board.enclosure) return null;
	const mount = stand.mount ?? "desk";
	if (mount === "wall") return [{
		id: "wall-body",
		op: buildWallBody(board, stand)
	}, {
		id: "wall-plate",
		op: buildWallPlate(board, stand)
	}];
	if (mount === "pocket") {
		const op = buildPocketOp(board, stand);
		return op ? [{
			id: "pocket-tray",
			op
		}] : null;
	}
	const op = mount === "slider" ? buildSliderStandOp(board, stand) : buildStandOp(board, stand);
	return op ? [{
		id: "stand",
		op
	}] : null;
}

// vendor/casemaker/casemaker-app/src/engine/compiler/rackFit.ts
/**
* The printer picker's rows. These machines now live on the machine profile (#184,
* `PRINTER_PROFILES` in `engine/cnc/machine.ts`); this is the flat shape the stored
* `rack.printer` and the panel already speak, derived so the bed volumes have ONE source.
* The ids and names are unchanged, so a saved project's `printer.preset` still resolves.
*/
const PRINTER_PRESETS = PRINTER_PROFILES.map((p) => ({
	id: p.id,
	name: p.name,
	x: p.buildVolume.x,
	y: p.buildVolume.y,
	z: p.buildVolume.z
}));
/**
* The bed a project starts on when the user enables the rack archetype and has
* not chosen one (issue #148).
*
* Read off the preset table rather than hard-coded, so the sample rack's
* 252 × 250 × 275 mm envelope (which needs the XL) and the numbers it is
* checked against can never drift apart. It lives here, next to the table,
* rather than in the picker component — a module that exports a component may
* not also export a value without breaking fast refresh.
*/
const DEFAULT_PRINTER = (() => {
	const p = PRINTER_PRESETS.find((x) => x.id === "prusa-xl") ?? PRINTER_PRESETS[0];
	return {
		preset: p.id,
		x: p.x,
		y: p.y,
		z: p.z
	};
})();
/**
* The bed this project is printed on, from either home.
*
* Issue #148 moved it to `Project.printer` so the shell and future archetypes
* can fit-check, not only the rack. Projects written before the move still
* carry it on `case.rack.printer`; read it through here so both work, and so
* there is exactly one place that knows about the old home.
*/
function resolvePrinter(project) {
	return project?.printer ?? project?.case?.rack?.printer;
}
/**
* The generic per-part bed check (extracted for #155): one `printer-fit` error
* for every part that does not fit the bed, straight or diagonally, or that is
* too tall. Shared by every assembly archetype, so the rack and the toolbox
* report the same way — and so a third one is a list of footprints, not a
* third copy of this loop.
*
* Not exported from the barrel: it is rackFit's, and archetype fit modules
* import it directly.
*/
function validateFootprints(footprints, printer) {
	const issues = [];
	for (const part of footprints) {
		const fitsBed = rectFitsBed(part.fx, part.fy, printer.x, printer.y);
		const fitsZ = part.fz <= printer.z;
		if (fitsBed && fitsZ) continue;
		issues.push({
			severity: "error",
			kind: "printer-fit",
			involves: [part.id],
			message: `${part.label} needs ${Math.ceil(part.fx)}×${Math.ceil(part.fy)}×${Math.ceil(part.fz)} mm but the printer bed is ${printer.x}×${printer.y}×${printer.z} mm${fitsBed ? "" : " (even placed diagonally)"}.`
		});
	}
	return issues;
}
/** Per-part print footprints for the current rack configuration. */
function rackPartFootprints(rack) {
	const dims = computeRackDims(rack);
	const wallMount = rack.wallMount ?? "none";
	const sideH = wallMount === "ears" ? 15 + 28 : 15;
	const out = [{
		id: "rack-side-left",
		label: "side panel",
		fx: dims.depth,
		fy: dims.totalH,
		fz: sideH
	}, {
		id: "rack-top",
		label: "top/bottom plate",
		fx: dims.plateW + 22,
		fy: dims.depth,
		fz: 5
	}];
	const accW = dims.plateW + 2;
	(rack.accessories ?? []).forEach((acc, i) => {
		const n = accessorySlots(acc);
		if (acc.type === "shelf") out.push({
			id: `rack-shelf-${i}`,
			label: `shelf (${n}-slot)`,
			fx: accW,
			fy: resolveShelfDepth(acc.shelfDepth, dims.depth),
			fz: n * SLOT_PITCH
		});
		else if (acc.type === "cable-tray") out.push({
			id: `rack-cable-tray-${i}`,
			label: "cable tray",
			fx: accW,
			fy: 104,
			fz: 33
		});
		else out.push({
			id: `rack-${acc.type}-${i}`,
			label: acc.type === "keystone" ? "keystone plate" : `blank faceplate (${n}-slot)`,
			fx: accW,
			fy: n * SLOT_PITCH,
			fz: acc.type === "keystone" ? 10 : 16
		});
	});
	if (wallMount === "cleat") out.push({
		id: "rack-wall-cleat",
		label: "wall cleat",
		fx: dims.width,
		fy: 40,
		fz: 15
	});
	return out;
}
/** Largest rack width whose widest part still fits. The governing part is
*  now the top/bottom plate (width − 2·SIDE_T + snap tabs ≈ width − 8).
*  Also drives the RackPanel width slider's upper bound. */
function maxRackWidthForBed(bedX, bedY) {
	let lo = 120;
	let hi = 600;
	for (let i = 0; i < 40; i++) {
		const mid = (lo + hi) / 2;
		if (rectFitsBed(mid - 8, 60, bedX, bedY)) lo = mid;
		else hi = mid;
	}
	return Math.floor(lo);
}
/** Largest slot count whose side panel still fits the bed.
*  Also drives the RackPanel height slider's upper bound. */
function maxRackSlotsForBed(depth, bedX, bedY) {
	for (let s = 40; s >= 2; s--) {
		const h = 5 + s * SLOT_PITCH + 11;
		if (rectFitsBed(depth, h, bedX, bedY)) return s;
	}
	return 0;
}
/**
* Fit-check every part against the configured printer. Returns banner-ready
* placement issues: one error per non-fitting part plus a summary suggestion,
* and the wall-mount load guidance when relevant.
*/
function validateRackFit(rack, printerOverride) {
	const issues = [];
	const dims = computeRackDims(rack);
	const totalSlots = (rack.accessories ?? []).reduce((s, a) => s + accessorySlots(a), 0);
	if (totalSlots > dims.slots) issues.push({
		severity: "warning",
		kind: "rack-config",
		involves: ["rack"],
		message: `Accessories occupy ${totalSlots} slots but the rack has ${dims.slots} — remove accessories or increase the rack height.`
	});
	if ((rack.accessories ?? []).some((a) => a.type === "shelf" && resolveShelfDepth(a.shelfDepth, dims.depth) >= 112) && dims.depth < 132) issues.push({
		severity: "warning",
		kind: "rack-config",
		involves: ["rack"],
		message: `Long/extra-deep shelves anchor into the sides' middle bar, which needs a rack depth of at least ${132} mm (currently ${Math.round(dims.depth)}) — deepen the rack or switch to short shelves.`
	});
	for (const fan of rack.fans ?? []) {
		const spec = FAN_SPECS[fan.size] ?? FAN_SPECS[80];
		const { y: yC, z: zC } = fanCenter(fan, dims);
		const reach = spec.opening / 2 + 10 / 2;
		const columns = [["front", 22], ...dims.depth >= 132 ? [["middle", 100]] : []];
		for (const [name, colY] of columns) {
			if (Math.abs(yC - colY) >= reach) continue;
			const lost = [];
			for (let k = 0; k < dims.slots; k++) if (Math.hypot(yC - colY, dims.holeZ(k) - zC) < reach) lost.push(k + 1);
			if (lost.length === 0) continue;
			issues.push({
				severity: "warning",
				kind: "rack-config",
				involves: ["rack"],
				message: `The ${fan.side} ${fan.size} mm fan sits over the ${name} screw column — slot${lost.length > 1 ? `s ${lost[0]}–${lost[lost.length - 1]}` : ` ${lost[0]}`} lose that fixing point. Move the fan ${Math.ceil(reach - Math.abs(yC - colY))} mm further ${yC >= colY ? "back" : "forward"} to clear it.`
			});
		}
	}
	const printer = printerOverride ?? rack.printer;
	if (!printer) return issues;
	const fitIssues = validateFootprints(rackPartFootprints(rack), printer);
	issues.push(...fitIssues);
	if (fitIssues.map((i) => i.message).length > 0) {
		const maxW = maxRackWidthForBed(printer.x, printer.y);
		const maxS = maxRackSlotsForBed(Math.min(dims.depth, maxW), printer.x, printer.y);
		issues.push({
			severity: "error",
			kind: "printer-fit",
			involves: ["rack"],
			message: `This printer could fit a rack up to ≈${maxW} mm wide/deep with up to ${maxS} slots — reduce width/depth/slots, or pick a larger printer preset.`
		});
	}
	return issues;
}

// vendor/casemaker/casemaker-app/src/engine/compiler/lidSplit.ts
/**
* The side the lid's laps take, from the lid's own mode. A cavity deep enough
* to bury the screw is the lid's free interior; anything else is a plate, and
* a plate's top face is the only side open air can reach along the seam.
*/
function lidJointSide(params) {
	return lidCavityHeight(params) >= 8 ? "cavity" : "top";
}
/** Whether a lid should even be offered a split (the sealed rule, as the shell's). */
function canSplitLid(sealed) {
	return !sealed;
}
/**
* Decide the lid's joint — seams, pieces, lap sites — or null when there is
* nothing honest to offer: the lid fits, is taller than the bed, no legal seam
* clears its features, or the chosen side cannot fit the screw.
*/
function planLidJoint(req) {
	if (!sideCanCarryTheScrew(req)) return null;
	const seams = planSeams(req.bounds, req.printer, { keepOut: req.keepOut });
	if (!seams) return null;
	const pieces = splitBySeams(req.lidOp, req.bounds, seams);
	const lugs = [];
	const screws = /* @__PURE__ */ new Set();
	pieces.forEach((piece, index) => {
		for (const seam of seams) for (const lug of lugSitesFor(index, piece, seam, req.bounds)) {
			lugs.push(lug);
			screws.add(lug.screwKey);
		}
	});
	if (screws.size === 0) return null;
	return {
		seams,
		pieces,
		lugs,
		screwCount: screws.size,
		side: req.side
	};
}
/** Where a lap's Z band sits: below the cavity's ceiling, or above the top face. */
function lugBandZ(req) {
	if (req.side === "cavity") {
		const zHi = req.cavityHeightMm + LUG_EMBED;
		const zLo = zHi - 8;
		if (zLo < .5) return null;
		return {
			zLo,
			zHi
		};
	}
	const zLo = req.bounds.max[2] - LUG_EMBED;
	return {
		zLo,
		zHi: zLo + 8
	};
}
/** Can the chosen side really bury the screw? The cavity must be deep enough. */
function sideCanCarryTheScrew(req) {
	return lugBandZ(req) !== null;
}
/**
* The geometry half: cut the lid, add one lap per screw per piece, and drill
* the joint. Nodes are in LID-LOCAL coordinates; the caller lifts them to the
* lid's assembled Z exactly as it lifts the whole lid.
*/
function buildLidSplit(req, plan) {
	const size = req.size ?? "M3";
	if (8 < minEngagement(size)) throw new Error(`lid split: a ${size} screw wants ${minEngagement(size)} mm of engagement, and a ${8} mm lap gives it ${8}`);
	const joint = plan ?? planLidJoint(req);
	if (!joint) return null;
	const band = lugBandZ(req);
	if (band === null) return null;
	const { zLo, zHi } = band;
	const zAxis = (zLo + zHi) / 2;
	const lugsByPiece = /* @__PURE__ */ new Map();
	for (const lug of joint.lugs) {
		const list = lugsByPiece.get(lug.piece);
		if (list) list.push(lug);
		else lugsByPiece.set(lug.piece, [lug]);
	}
	const nodes = joint.pieces.map((piece, index) => {
		let op = piece.op;
		const holes = [];
		for (const lug of lugsByPiece.get(index) ?? []) {
			op = union$1([op, lugBox(lug.axis, lug.band[0], lug.band[1], lug.width[0], lug.width[1], zLo, zHi)]);
			const facing = seamAxisFacing(lug.axis, true);
			const at = lug.axis === 0 ? [
				lug.mouth,
				lug.at,
				zAxis
			] : [
				lug.at,
				lug.mouth,
				zAxis
			];
			holes.push(lug.low ? jointClearanceHole(at, facing, lug.reach, size) : jointStarterHole(at, facing, lug.reach, size));
		}
		if (holes.length > 0) op = difference([op, ...holes]);
		return {
			id: lidPieceId(piece.cell),
			op
		};
	});
	const screwLabel = `${size}×${8 * 2} socket cap`;
	const sideWords = joint.side === "cavity" ? "lugs inside the lid’s cavity" : "pads proud of the lid’s top face";
	const label = `Lid split for a ${req.printer.x}×${req.printer.y} mm bed — ${nodes.length} pieces, ${joint.screwCount}× ${screwLabel}, ${sideWords}`;
	const variant = {
		replaces: ["lid"],
		label
	};
	for (const n of nodes) n.variant = variant;
	return {
		seams: joint.seams,
		pieces: joint.pieces,
		nodes,
		screwCount: joint.screwCount,
		screwLabel,
		label
	};
}
/** Stable, legible node id for a lid piece: `lid-split-a1`, `lid-split-b2`. */
function lidPieceId(cell) {
	return `lid-split-${String.fromCharCode(97 + cell[0])}${cell[1] + 1}`;
}
/** One lap, as a box: `[aLo, aHi]` along the seam axis, `[oLo, oHi]` across it. */
function lugBox(axis, aLo, aHi, oLo, oHi, zLo, zHi) {
	return axis === 0 ? translate([
		aLo,
		oLo,
		zLo
	], cube([
		aHi - aLo,
		oHi - oLo,
		zHi - zLo
	])) : translate([
		oLo,
		aLo,
		zLo
	], cube([
		oHi - oLo,
		aHi - aLo,
		zHi - zLo
	]));
}

// vendor/casemaker/casemaker-app/src/engine/compiler/badge.ts
/**
* Issue #167 — the two-colour name-badge blank, ported off
* `samples/badge-blank/make_badge.py` onto the Profile IR.
*
* The Python script built its outline as a hand-rolled triangle fan per corner
* (75 lines); here the whole part is the IR's `roundedRect` plus two
* `extrude`s. Frame is the oracle's, and is documented on `BadgeParams`:
*
*   - outline CENTRED on the XY origin;
*   - z = 0 is the BACK face, the one carrying the magnet pocket;
*   - the colour split is the plane z = splitHeight; the top colour runs from
*     there to z = thickness and is the face that gets engraved.
*
* TWO nodes, one per colour, printed separately and bonded at the split plane.
* They are the same outline, so their mating faces are congruent — the part
* only works if both compile from this one function.
*/
const BADGE_BOTTOM_NODE_ID = "badge-bottom";
const BADGE_TOP_NODE_ID = "badge-top";
/** Overshoot so the pocket cutter punches cleanly through the back face
*  instead of leaving a coplanar skin for the boolean to argue with. */
const POCKET_OVER = 1;
/**
* The blank is printed SOLID (decision 13, #166 item 2). It travels in the 3MF
* sidecar as an object-level `fill_density`, because the app's depth model
* assumes solid material under every pocket roof and under the engraved floor —
* a slicer left on its own infill percentage turns that assumption into air, and
* the failure is invisible until someone engraves deeper than the top skins.
*
* `samples/badge-blank/make_badge.py` is the reference for this sidecar's format
* and does NOT write this key: the sample generator is a one-off print, this is
* the app's own spec, and the divergence is recorded on #166. A change to the
* ONE format means changing both, and only if the maintainer says so.
*/
const BADGE_FILL_DENSITY = "100%";
/**
* The outline, centred on the origin (the oracle's convention, and the reason
* the `pTranslate` below exists — `roundedRect` is bbox-min-at-origin, so
* without it the part lands in the first quadrant and the oracle bbox check in
* `tests/unit/badge.spec.ts` fails).
*/
function badgeOutline(b) {
	return pTranslate([-b.width / 2, -b.height / 2], roundedRect(b.width, b.height, b.cornerRadius));
}
/**
* Is this badge buildable at all? The oracle makes the same two assertions
* (`make_badge.py:33-34`) and crashes; here the caller falls through to the
* normal shell so the viewport is never empty, and `badgeParamsProblem`
* says why. Returns `null` for the unbuildable case, mirroring the stand's
* `buildStandNodes` contract.
*/
function buildBadgeNodes(b) {
	if (!(b.thickness > 0) || !(b.splitHeight > 0) || b.splitHeight >= b.thickness) return null;
	if (!(b.width > 0) || !(b.height > 0)) return null;
	const outline = badgeOutline(b);
	const bottom = extrude(outline, b.splitHeight);
	const pocket = b.magnetPocket;
	const bottomOp = pocket ? difference([bottom, translate([
		0,
		0,
		-1
	], extrude(rectProfile(pocket.length, pocket.width, true), pocket.depth + POCKET_OVER))]) : bottom;
	return [{
		id: BADGE_BOTTOM_NODE_ID,
		op: bottomOp,
		material: {
			extruder: b.bottomExtruder,
			fillDensity: BADGE_FILL_DENSITY
		}
	}, {
		id: BADGE_TOP_NODE_ID,
		op: translate([
			0,
			0,
			b.splitHeight
		], extrude(outline, b.thickness - b.splitHeight)),
		material: {
			extruder: b.topExtruder,
			fillDensity: BADGE_FILL_DENSITY
		}
	}];
}

// vendor/casemaker/casemaker-app/src/engine/compiler/arcResolution.ts
/**
* Arc resolution for 2D profile ops (#190).
*
* Manifold picks a circular-segment count from the radius when you pass 0, and
* that default COLLAPSES at small radii because its minCircularEdgeLength is
* 1 mm: getCircularSegments(0.5) is 4. A "round" offset at r = 0.5 is therefore a
* square — `CrossSection.circle(0.5)` has area 0.500 against an exact 0.785 —
* with no error and a perfectly valid result.
*
* It does not touch anything that ships today (every circleProfile call passes
* its own segment count, every pOffset call uses a miter join, and roundedRect
* has no callers). It is latent: it bites the first caller that rounds a small
* radius, which is exactly what the CAM work does — tool-radius opening for the
* engravability check, and offset loops for pocketing.
*
* So the resolution is chosen from a chord-error TARGET rather than a segment
* count, which makes it radius-independent: the same 0.005 mm of sagitta at a
* 0.5 mm tool radius and a 25 mm fillet.
*/
/**
* Maximum sagitta (chord-to-arc distance) a profile arc may have, in mm.
*
* This is deliberately one named constant. The CAM design had four unrelated
* tolerances for one job — the sweep's caps, the default offset, simplify's
* epsilon, and glyph flattening — and the oracle band has to be DERIVED from
* them rather than hand-set (/Simulation.md §7). Whatever consumes arcs imports
* this, so the band can be computed instead of guessed.
*/
const ARC_CHORD_TOLERANCE_MM = .005;
const MIN_SEGMENTS = 8;
const MAX_SEGMENTS$1 = 512;
/**
* Segments per full circle so an inscribed polygon stays within `tolerance` of
* the true arc.
*
* Rounded UP to a multiple of 4 so that the points at 0°, 90°, 180° and 270° are
* vertices: an inscribed polygon then has exactly the circle's bounding box, so
* an axis-aligned extent never shrinks by a chord error.
*
* Bounded both ways. A degenerate radius gets MIN_SEGMENTS rather than the 4 that
* caused #190, and a huge one cannot ask for millions of vertices.
*/
function segmentsForRadius(radius, tolerance = ARC_CHORD_TOLERANCE_MM) {
	if (!Number.isFinite(radius) || radius <= 0 || !(tolerance > 0)) return MIN_SEGMENTS;
	if (tolerance >= radius) return MIN_SEGMENTS;
	const n = Math.ceil(Math.PI / Math.acos(1 - tolerance / radius));
	const up4 = Math.ceil(n / 4) * 4;
	return Math.min(MAX_SEGMENTS$1, Math.max(MIN_SEGMENTS, up4));
}

// vendor/casemaker/casemaker-app/src/engine/compiler/insert.ts
/**
* Issue #158 — the tool-insert holder archetype's geometry.
*
* One plate, pockets subtracted from its top face. The plate is generated in
* its OWN frame with the plan origin at a corner: X ∈ [0, width], Y ∈ [0,
* depth], Z ∈ [0, thickness], mouths up — the same convention `roundedRect`
* and `rectProfile` already use, so no translate is needed on the solid and a
* host can lay it on the bed as modelled.
*
* Pure op-tree construction (no wasm): the layout that decides WHERE the
* pockets go is a plain function of the parameters (`insertLayout`), so it can
* be asserted without an evaluator, and only the resulting solids need one.
*
* The numbers here are DEFAULTS, not standards. `pitchGap`, `clearance`,
* `chamfer` and `floor` are all the user's to change, and the panel exposes
* them; the friction fit is the one a coupon should settle (#157), exactly as
* #140 did for the M5 pilot.
*
* Issue #262 — `retention: 'magnet'` adds a disc pocket under every pocket,
* cut DOWNWARD from the pocket's floor with `fasteners.ts`'s `magnetPocket`
* (#152), so the disc finishes flush with the floor the tool rests on. The
* plate then has to carry pocket + disc + a web under that, which is the one
* new constraint the user can trip (`magnetFloorThickness`).
*/
/** Minimum material from a pocket's edge to the plate's side, mm. */
const WALL_EDGE = 3;
/** Solid left under a magnet pocket, mm. The same floor `fasteners.ts`
*  defaults to, passed explicitly so the two cannot drift apart: a thinner web
*  than this and the disc breaks through the plate's underside. */
const MAGNET_WEB = 1;
const SQRT3 = Math.sqrt(3);
/**
* The circumradius a pocket occupies, mm — the spacing and keep-in measure.
*
* For a round pocket that is half its diameter. For a hex pocket it is the
* circumradius (across-corners ÷ 2 = across-flats ÷ √3), NOT half its
* across-flats: a hexagon is wider corner-to-corner than flat-to-flat, and it
* is the corners that would collide with a neighbour.
*/
function pocketRadius(item, clearance) {
	const s = item.size + clearance;
	return item.shape === "round" ? s / 2 : s / SQRT3;
}
/** The retention in force. Absent = `friction`: the geometry every project
*  saved before #262 has, so an old file prints exactly what it always did. */
function retentionOf(insert) {
	return insert.retention ?? "friction";
}
/** The disc cut under each pocket when retention is `magnet`. */
function magnetSizeOf(insert) {
	return insert.magnetSize ?? "6x2";
}
/** How far the disc pocket reaches below each pocket's floor, mm — 0 when the
*  tools are held by friction alone. */
function magnetDepth(insert) {
	return retentionOf(insert) === "magnet" ? magnetPocketDepth(magnetSizeOf(insert)) : 0;
}
/** Regular hexagon profile with across-flats = `acrossFlats`, centred on the origin. */
function hexProfile(acrossFlats) {
	const R = acrossFlats / SQRT3;
	const pts = [];
	for (let i = 0; i < 6; i++) {
		const a = Math.PI / 6 + Math.PI / 3 * i;
		pts.push([R * Math.cos(a), R * Math.sin(a)]);
	}
	return poly(pts);
}
/**
* How many pockets of this set fit on the plate, and at what pitch.
*
* The pitch is uniform — sized to the LARGEST pocket — so mixed tool sets do
* not pack tightly. That is deliberate for v1: a per-size packing algorithm is
* a different feature (bin packing), and a predictable grid is what the
* reviewed generators expose and what the user can reason about.
*/
function insertGrid(insert) {
	const maxRadius = Math.max(0, ...insert.items.map((it) => pocketRadius(it, insert.clearance)));
	const pitch = 2 * maxRadius + insert.pitchGap;
	const edge = Math.max(WALL_EDGE, insert.chamfer);
	const margin = insert.cornerRadius + maxRadius + edge;
	const usableW = insert.width - 2 * margin;
	const usableD = insert.depth - 2 * margin;
	if (pitch <= 0) return {
		cols: 0,
		rows: 0,
		pitch: 0,
		margin,
		maxRadius
	};
	return {
		cols: usableW < 0 ? 0 : Math.floor(usableW / pitch + 1e-9) + 1,
		rows: usableD < 0 ? 0 : Math.floor(usableD / pitch + 1e-9) + 1,
		pitch,
		margin,
		maxRadius
	};
}
/**
* Where each item lands, centred on the plate, in placement order
* (left-to-right, wrapping to the next row).
*
* Returns [] when nothing fits. The used grid is centred rather than anchored,
* so adding the last item that completes a row shifts nothing already placed;
* a full row's worth is what moves.
*/
function insertLayout(insert) {
	const { cols, rows, pitch } = insertGrid(insert);
	if (cols < 1 || rows < 1 || insert.items.length === 0) return [];
	const usedCols = Math.min(cols, insert.items.length);
	const usedRows = Math.ceil(insert.items.length / cols);
	if (usedRows > rows) return [];
	const gridW = (usedCols - 1) * pitch;
	const gridH = (usedRows - 1) * pitch;
	const x0 = (insert.width - gridW) / 2;
	const y0 = (insert.depth - gridH) / 2;
	return insert.items.map((item, k) => {
		const col = k % cols;
		const row = Math.floor(k / cols);
		return {
			item,
			cx: x0 + col * pitch,
			cy: y0 + row * pitch
		};
	});
}
/**
* One ROUND pocket's cutting op, anchored at the pocket FLOOR on its own axis:
* the straight bore runs z ∈ [0, `depth`] and the entry flare caps it, rising
* 1:1 from the bore radius and reaching `radius + chamfer` at z = `depth`. A
* caller places it with a single `translate([cx, cy, floorZ], …)`.
*
* Exported because this is the INTERFACE, not an implementation detail. The fit
* coupons (#157) cut their ladder with the pocket the compiler ships — the same
* discipline `magnetPocket` and `buildBoardSnapOps` follow — so a coupon cannot
* certify a pocket this file no longer draws. It is also what a future pocket
* carrier (#151) needs to cut a tool footprint into a wall.
*
* The chamfer is clamped to the depth so a shallow pocket cannot have its flare
* eat the floor, and to zero because a negative flare is meaningless.
*/
function roundPocketCutter(diameter, depth, chamfer) {
	const r = diameter / 2;
	const c = Math.min(Math.max(chamfer, 0), depth);
	const bore = cylinder(depth, r, segmentsForRadius(r));
	if (c <= 0) return bore;
	const flare = extrude(circleProfile(r, segmentsForRadius(r)), c, { scaleTop: (r + c) / r });
	return union$1([bore, translate([
		0,
		0,
		depth - c
	], flare)]);
}
/**
* One pocket's cutting op at (cx, cy), in the plate's frame.
*
* Round pockets get their entry chamfer as a conical flare unioned onto the
* straight bore; hex pockets are cut straight, because a tapered hexagon is a
* different (rotational) fit and no bit needs one.
*/
function pocketCutter(item, insert, cx, cy) {
	const s = item.size + insert.clearance;
	const zBase = insert.thickness - item.depth;
	const body = item.shape === "round" ? roundPocketCutter(s, item.depth, insert.chamfer) : extrude(hexProfile(s), item.depth);
	return translate([
		cx,
		cy,
		zBase
	], body);
}
/**
* The finished plate as one solid, or null when the plate has no extent.
*
* Always returns a solid for a positive-width plate: items that are too big to
* fit are simply not cut, and the panel's `insertProblem` says so. Building
* the plate first and subtracting what fits is what keeps the archetype from
* vanishing to an empty viewport while the user is mid-edit.
*/
function buildInsertOp(insert) {
	if (!(insert.width > 0) || !(insert.depth > 0) || !(insert.thickness > 0)) return null;
	const outline = insert.cornerRadius > 0 ? roundedRect(insert.width, insert.depth, insert.cornerRadius) : rectProfile(insert.width, insert.depth);
	const plate = extrude(outline, insert.thickness);
	const placements = insertLayout(insert).filter(({ item }) => item.size > 0 && item.depth > 0);
	if (placements.length === 0) return plate;
	const cutters = placements.map(({ item, cx, cy }) => pocketCutter(item, insert, cx, cy));
	const disc = magnetDepth(insert);
	if (disc > 0) {
		const size = magnetSizeOf(insert);
		for (const { item, cx, cy } of placements) {
			const slab = insert.thickness - item.depth;
			if (slab - disc < .999999999) continue;
			cutters.push(magnetPocket({
				size,
				at: [
					cx,
					cy,
					slab
				],
				axis: "-z",
				material: slab,
				floor: MAGNET_WEB
			}));
		}
	}
	return difference([plate, ...cutters]);
}
/** The single `insert-plate` node, or null when the plate has no extent. */
function buildInsertNodes(insert) {
	const op = buildInsertOp(insert);
	return op ? [{
		id: "insert-plate",
		op
	}] : null;
}

// vendor/casemaker/casemaker-app/src/engine/compiler/blank.ts
/**
* Issue #280 — the bare blank: "just cut something".
*
* One part, no cavity, no lid, no board. The whole project is a single plate
* the Engrave panel drives, which is the entry point #274 found missing.
*
* Frame follows `BadgeParams` (see types/blank.ts): the outline is CENTRED on
* the XY origin and z = 0 is the back face, extruded up to `thickness`. The
* centring is not cosmetic — `engine/cnc/engrave/fromBlank.ts` maps a centred
* outline onto the job's stock rectangle, so a corner-at-origin blank would
* place every engraving in the wrong half of the stock.
*/
/** The single top-level node — the whole part is the blank. */
const BLANK_NODE_ID = "blank";
/**
* The outline, centred on the XY origin. `roundedRect` is bbox-min at the
* origin, so the `pTranslate` is what moves the part to centre — the same two
* lines `badgeOutline` uses. A zero or clamped-away radius falls back to a
* plain rectangle, which `roundedRect` already does internally.
*/
function blankOutline(b) {
	const outline = b.cornerRadius > 0 ? roundedRect(b.width, b.height, b.cornerRadius) : rectProfile(b.width, b.height);
	return pTranslate([-b.width / 2, -b.height / 2], outline);
}
/**
* The one `blank` node, or null when the plate would have no extent.
*
* `null` is the compiler's fall-through signal: like the badge and the stand,
* an unbuildable parameter set yields the normal shell rather than an empty
* viewport. `blankParamsProblem` (types/blank.ts) is what the panel shows the
* user instead of a blank screen.
*/
function buildBlankNodes(b) {
	if (!(b.width > 0) || !(b.height > 0) || !(b.thickness > 0)) return null;
	return [{
		id: BLANK_NODE_ID,
		op: extrude(blankOutline(b), b.thickness)
	}];
}

// vendor/casemaker/casemaker-app/src/engine/compiler/toolbox.ts
/**
* Issue #155 — the stacking-toolbox archetype: one module builder, used twice.
*
* PROVENANCE, and the reasoning behind the shape, are in `types/toolbox.ts` —
* read that header first. Two things worth repeating here because they explain
* every line below:
*
*   - clean-room except for the floor's socket interface: the module — foot,
*     ledge, flare, stacking joint — is ours, derived from the requirements in
*     `/Toolbox.md`; the floor grid is the MEASURED 5 × 5 on 12 mm lattice from
*     `holeGrid.ts`, reused on purpose (see that file's header, and
*     `types/toolbox.ts` for the licensing reasoning). No compatibility with
*     any reviewed product is claimed anywhere;
*   - the registration FOOT points up in print orientation. It is the module's
*     own flat base, inset `TOOLBOX_FOOT_INSET`, which drops into the module
*     below and lands on that module's seating LEDGE. A skirt hanging *below*
*     the floor — the obvious alternative, and the first draft — cannot be
*     printed in one piece at all.
*
* FRAME: the outline is CENTRED on the XY origin like `blankOutline`; `z = 0` is
* the seating plane AND the print-bed face, and the module rises from it to
* `height`. So the bounding box is `[-W/2, W/2] × [-D/2, D/2] × [0, height]`,
* and a stack of N modules is N copies at N offsets.
*
* HOW A STACK REGISTERS, with no connector at all:
*
*   Module B's foot drops into module A's opening, guided by its 45° nose and
*   squared by `TOOLBOX_FIT_CLEAR` of sliding clearance against A's wall. It
*   stops when the foot's bottom face meets A's seating ledge, which sits
*   `TOOLBOX_FOOT_H` below A's rim — so B's rim lands exactly `TOOLBOX_FOOT_H`
*   closer to A's than a bare rim-on-rim stack would put it. That is the whole
*   joint: no screw, no clip, no orientational key, and the last few millimetres
*   are forgiving enough to drop a loaded bin on by feel.
*/
/** The bin — the deep, open module with the floor grid. */
const TOOLBOX_BIN_NODE_ID = "toolbox-bin";
/** The lid — a shallow module that closes the bin and still carries a rim. */
const TOOLBOX_LID_NODE_ID = "toolbox-lid";
/**
* The z of the seating ledge, and its inner inset — the same for every module
* at a given height, so the panel and the builder cannot disagree.
*
* For a module only just taller than its own foot, the ledge IS the floor: the
* floor's top face is already at `TOOLBOX_FLOOR_T`, which the next foot can land
* on directly. Only a deeper module needs a ledge ring built above its floor.
*/
function seatingLedge(height) {
	const z = height - 12;
	return {
		z: Math.max(z, 4),
		innerInset: 3 + 6,
		ring: z > 4 + .5
	};
}
/**
* The lattice the bin's floor carries, as one `HoleGridOptions`.
*
* Kept in one place because four callers must agree on it exactly: the holes
* the panel counts, the pocket the floor is cut with, the limits a divider is
* checked against, and the context its tenons are built from. A second copy
* here is a second thing to keep in step.
*
* `anchor: 'centre'` is the toolbox's own requirement, not a default — see
* `toolboxGridHoles` and `HoleGridAnchor`.
*/
function toolboxGridOptions() {
	return {
		pitch: 12,
		socket: 5,
		margin: TOOLBOX_GRID_MARGIN,
		anchor: "centre"
	};
}
/**
* The socket centres in the bin's floor: symmetric about the module's centre,
* with an ODD count, so the lattice is anchored on the centre line at whole
* multiples of the pitch.
*
* Symmetric rather than corner-anchored (which is `holeGridCentres`' default,
* for a one-off cavity): the module is centred, so a corner-anchored grid would
* drift off-centre as the plan changes, and two modules of different sizes
* would stop sharing a common hole line — which is the whole point of a
* drop-in grid you can hang a partition from.
*
* Odd is the part that needs saying. An even count has no socket on the centre
* line, so its sockets sit at ±half a pitch: still square, but every one of
* them is half a pitch off the module's own centre, and two modules whose
* counts differed in parity would share no hole line at all. Odd keeps the
* lattice on the centre, at whole multiples of the pitch, which is what makes
* one divider fit two different-sized modules.
*/
function toolboxGridHoles(width, depth) {
	return holeGridCentres(centredRect(width, depth), toolboxGridOptions()).map(([x, y]) => ({
		x,
		y
	}));
}
/** A centred rectangle profile of the given plan. */
function centredRect(width, depth) {
	return rectProfile(width, depth, true);
}
/**
* A centred rectangle profile inset `inset` on every side.
*
* The whole module is expressed this way — every face is "so many mm in from
* the module's outer face" — which is why the geometry below reads as insets
* rather than as coordinates.
*/
function insetRect(width, depth, inset) {
	return centredRect(width - 2 * inset, depth - 2 * inset);
}
/**
* The registration FOOT: the module's bottom `TOOLBOX_FOOT_H` mm, inset
* `TOOLBOX_FOOT_INSET`, with a 45° nose on its bottom edge.
*
* A deliberate 1 mm more than the foot's nominal height, so it overlaps the
* outward flare above it by volume rather than meeting it face-to-face —
* touching faces union into one component but leave a zero-thickness seam,
* which is not a joint.
*
* EXPORTED for issue #157: a fit coupon must slice the compiler's own feature
* rather than redraw it (`fitCoupons.ts:13-23`), and this is that feature —
* `insert.ts`'s `roundPocketCutter` is the precedent.
*/
function toolboxFootOps(width, depth) {
	const noseInset = TOOLBOX_FOOT_INSET + 2;
	const outerW = width - 2 * TOOLBOX_FOOT_INSET;
	const outerD = depth - 2 * TOOLBOX_FOOT_INSET;
	const noseW = width - 2 * noseInset;
	const noseD = depth - 2 * noseInset;
	return union$1([extrude(centredRect(noseW, noseD), 2, { scaleTop: [outerW / noseW, outerD / noseD] }), translate([
		0,
		0,
		2
	], extrude(centredRect(outerW, outerD), 12 + 1 - 2))]);
}
/**
* The height over which the foot's outer face flares out to the module's full
* plan. Equal to the inset, so the flare is exactly 45° — the steepest an FDM
* printer will hold without supports.
*/
const FLARE = TOOLBOX_FOOT_INSET;
/** The outward solid: foot, flare, then the full-width box. */
function moduleOuterSolid(width, depth, height) {
	return union$1([
		toolboxFootOps(width, depth),
		translate([
			0,
			0,
			12
		], extrude(insetRect(width, depth, TOOLBOX_FOOT_INSET), FLARE, { scaleTop: [width / (width - 2 * FLARE), depth / (depth - 2 * FLARE)] })),
		translate([
			0,
			0,
			12 + FLARE
		], extrude(centredRect(width, depth), height - 12 - FLARE))
	]);
}
/**
* The cavity, as one cutter that follows the wall: narrow inside the foot,
* flaring with it, then full width.
*
* A single cutter rather than three, because Manifold fuses coplanar neighbours
* into one solid and the three sections share their end faces exactly — so the
* wall keeps its constant `TOOLBOX_WALL_T` thickness through the flare with no
* seam to leave a sliver at.
*/
function cavityCutter(width, depth, height) {
	const footCavW = width - 2 * TOOLBOX_FOOT_CAVITY_INSET;
	const footCavD = depth - 2 * TOOLBOX_FOOT_CAVITY_INSET;
	const cavW = width - 2 * 3;
	const cavD = depth - 2 * 3;
	return union$1([
		translate([
			0,
			0,
			4
		], extrude(centredRect(footCavW, footCavD), 12 - 4)),
		translate([
			0,
			0,
			12
		], extrude(centredRect(footCavW, footCavD), FLARE, { scaleTop: [cavW / footCavW, cavD / footCavD] })),
		translate([
			0,
			0,
			12 + FLARE
		], extrude(centredRect(cavW, cavD), height - 12 - FLARE))
	]);
}
/**
* The seating ledge: a 45° wedge growing in from the cavity wall, whose flat
* top at `z = seatingLedge(height).z` is what the module above's foot lands on.
*
* The 45° underside is not decoration — it is what makes the ledge printable
* pointing up. A square-shouldered ledge would be an unsupported inward
* overhang; the wedge starts at zero width against the wall and grows inward as
* it rises, which is the same "no support needed" rule as the module's own
* flare.
*
* The operand order matters and is easy to get backwards. It is a straight
* block MINUS an inward-tapering frustum: the block supplies the material, and
* the frustum carves away everything the ledge should not occupy — leaving the
* wedge the taper did not reach. Subtracting the other way round (a tapering
* block minus the straight cavity) gives a wedge that *shrinks* as it rises
* and vanishes entirely by the top, which is a 0.5 mm sliver at the wall and
* no ledge at all.
*
* The block's outer face sits `LEDGE_EMBED` inside the wall so the two are
* joined by volume rather than by a face, and the knife edge at the block's
* bottom corner is buried in the wall for the same reason.
*/
const LEDGE_EMBED = .5;
function seatingLedgeOps(width, depth, ledgeZ) {
	const cavW = width - 2 * 3;
	const cavD = depth - 2 * 3;
	const outerW = cavW + 2 * LEDGE_EMBED;
	const outerD = cavD + 2 * LEDGE_EMBED;
	const topW = cavW - 2 * 6 + 2 * LEDGE_EMBED;
	const topD = cavD - 2 * 6 + 2 * LEDGE_EMBED;
	return translate([
		0,
		0,
		ledgeZ - 6
	], difference([extrude(centredRect(outerW, outerD), 6), extrude(centredRect(outerW, outerD), 6, { scaleTop: [topW / outerW, topD / outerD] })]));
}
/**
* One module: foot, box, cavity, seating ledge, optionally the floor grid.
*
* `height` is separate from the params because the lid is the same module at
* `TOOLBOX_LID_H` — one builder, two callers. Returns `null` when the module
* would have no extent, which is the compiler's fall-through signal (the panel
* reports the reason from `toolboxParamsProblem` instead of a blank viewport).
*/
function buildToolboxModule(params, height, opts) {
	const { width, depth } = params;
	if (toolboxParamsProblem(params) !== null) return null;
	if (!(height >= 12 + FLARE)) return null;
	const ledge = seatingLedge(height);
	let op = difference([moduleOuterSolid(width, depth, height), cavityCutter(width, depth, height)]);
	if (ledge.ring) op = union$1([op, seatingLedgeOps(width, depth, ledge.z)]);
	if (opts.grid && toolboxGridHoles(width, depth).length > 0) {
		const pocket = holeGridPocket(centredRect(width, depth), toolboxGridOptions());
		op = difference([op, translate([
			0,
			0,
			4 - 2
		], extrude(pocket, 2))]);
	}
	return op;
}
/**
* How far from the module's centre a divider's END may reach, mm.
*
* NOT the same as the grid's own limit, and the difference is the foot. A
* socket only has to clear the wall with its own outline — but a peg's plate
* runs on `PEG_WIDTH_EAR` past its outer tenon before it ends, and at floor
* level the wall it has to clear is the FOOT CAVITY face at
* `TOOLBOX_FOOT_CAVITY_INSET`, not the thinner wall above the flare. So the
* outermost socket column takes a socket and not a divider: a peg hung there
* buries its end in the wall.
*
* The second bound is the seating ledge, which is what makes the LID's stack
* work: it reaches `TOOLBOX_LEDGE_W` in from the cavity wall at the rim, so a
* divider standing further out than its inner edge would foul the module above
* as it lands. Keeping the ends inboard of the ledge also means a divider can
* be as tall as the ledge — `toolboxPegProblem` allows exactly that — without
* ever meeting the ledge's 45° underside, because the ledge does not reach
* where the divider stands.
*
* On the default 300 × 200 floor neither bound costs anything: the ear still
* clears at the 11th column out and the lattice is 11 columns either side, so
* the grid count is unchanged. It bites on a small module, where a divider has
* to be shorter-waisted than the socket count alone would suggest.
*/
function pegReach(width, depth) {
	const keep = Math.max(TOOLBOX_FOOT_CAVITY_INSET + PEG_WIDTH_EAR + 1, 3 + 6 + 1);
	return {
		x: width / 2 - keep,
		y: depth / 2 - keep
	};
}
/** The furthest tenon offset from the centre, in whole pitches, that is still
*  in reach — the peg's own limit, not the lattice's. */
function maxPegIndex(reach) {
	return Math.floor(reach / 12 + 1e-9);
}
/**
* The highest a divider may stand above the bin's floor, mm — the cavity up to
* the seating ledge, which is as tall as the bin's interior actually is.
*
* Exported because the panel needs the same number to seed a new divider's
* height: the alternative is the panel deriving "the ledge, minus the floor"
* itself, which is the same formula written twice.
*/
function toolboxPegHeadroom(p) {
	return seatingLedge(p.height).z - 4;
}
/**
* Why one divider will not build, or `null` when it will.
*
* DELIBERATELY NOT folded into `toolboxParamsProblem`. That predicate gates the
* WHOLE module — a non-null result makes `buildToolboxModule` return null and
* the toolbox vanishes from the viewport. A divider with an impossible span
* must drop the DIVIDER, not the bin it stands in, so this is a second
* predicate, reported by the panel and consulted by `buildToolboxNodes` before
* it emits a node.
*/
function toolboxPegProblem(peg, p) {
	if (!p.grid) return "The floor grid is off, so a divider has no sockets to plug into";
	if (!(peg.spans >= 1)) return `Divider ${peg.id}: it must span at least one socket`;
	if (!Number.isInteger(peg.spans)) return `Divider ${peg.id}: ${peg.spans} sockets is not a whole number of sockets — its tenons would land between the holes`;
	const across = peg.axis === "x" ? "width" : "depth";
	const limit = maxPegIndex(pegReach(p.width, p.depth)[peg.axis]);
	if (Math.floor(peg.spans / 2) > limit) return `Divider ${peg.id}: ${peg.spans} sockets across the ${across} runs past the floor's usable sockets — at most ${2 * limit + 1} fit`;
	if (!(peg.height > 0)) return `Divider ${peg.id}: height must be greater than zero`;
	const headroom = toolboxPegHeadroom(p);
	if (peg.height > headroom) return `Divider ${peg.id}: ${peg.height} mm stands above the ${Math.round(headroom)} mm the bin holds under its seating ledge`;
	if (!(peg.thickness > 0)) return `Divider ${peg.id}: thickness must be greater than zero`;
	return null;
}
/**
* Where a divider sits in the bin, and whether it is turned across the width.
*
* The peg is built in its own frame with the wall along X and centred on the
* origin, so an `'x'` divider needs no turn and a `'y'` one takes a quarter
* turn about Z. Either way the placement is `TOOLBOX_FLOOR_T`, the floor's top
* face: the peg's wall starts at its own z = 0 and its tenons hang below it.
*
* The offset along the wall is the interesting part. The tenons sit
* `(spans - 1) / 2` pitches either side of the peg's own centre and the sockets
* are on whole pitches from the module's centre, so an ODD span centres the
* divider on the module and an EVEN one has no choice but to sit half a pitch
* off — that is the only position where both tenons find a socket. It looks
* like an off-by-one and is not, which is why it is written down.
*/
function pegPlacement(peg) {
	const spin = peg.axis === "y";
	const along = peg.spans % 2 === 1 ? 0 : 12 / 2;
	return {
		offset: spin ? [
			0,
			along,
			4
		] : [
			along,
			0,
			4
		],
		spin
	};
}
/**
* The parts a toolbox prints: the bin, a lid which is the SAME module at
* `TOOLBOX_LID_H`, and one free node per enabled divider.
*
* The lid is deliberately not a dead-flat cap. A cap has to present a seating
* surface for the next module up and a rim to square it against; a plain plate
* can do neither, and a stack with a flat lid simply stops registering there. A
* 16 mm module does both — and because the lid is barely taller than its own
* foot, its floor *is* its seating ledge, so it needs no ledge ring at all.
*
* `null` when the module is unbuildable, so the compiler falls through to the
* shell exactly as the badge and blank archetypes do.
*
* EMITTED IN ASSEMBLY SPACE, as `buildRackNodes` does. Each module is BUILT in
* its own print frame — `z = 0` is its own seating plane — but the lid is the
* module that seats on the bin, so it is placed at the bin's seating ledge
* rather than left at the origin. Without that, both parts occupy `z = 0..` and
* the lid renders buried inside the bin's foot, which is what a toolbox looked
* like before this: the picture said the lid was part of the bin.
*
* Placement only; no geometry moves. The print-ready layout re-lays every part
* by its own bounding box, so neither frame is what reaches the bed.
*/
function buildToolboxNodes(p) {
	const bin = buildToolboxModule(p, p.height, { grid: p.grid });
	const lid = buildToolboxModule(p, 16, { grid: false });
	if (!bin || !lid) return null;
	const nodes = [{
		id: TOOLBOX_BIN_NODE_ID,
		op: bin
	}, {
		id: TOOLBOX_LID_NODE_ID,
		op: translate([
			0,
			0,
			seatingLedge(p.height).z
		], lid)
	}];
	for (const peg of p.pegs ?? []) {
		if (!peg.enabled) continue;
		if (toolboxPegProblem(peg, p) !== null) continue;
		const op = buildDividerPegOp({
			id: peg.id,
			spans: peg.spans,
			height: peg.height,
			thickness: peg.thickness,
			enabled: true
		}, {
			grid: {
				pitch: 12,
				socket: 5
			},
			socketDepth: 2
		});
		if (!op) continue;
		const { offset, spin } = pegPlacement(peg);
		nodes.push({
			id: spin ? `divider-peg-y-${peg.id}` : `divider-peg-${peg.id}`,
			op: translate(offset, spin ? rotate([
				0,
				0,
				90
			], op) : op)
		});
	}
	return nodes;
}

// vendor/casemaker/casemaker-app/src/engine/compiler/interiorClash.ts
/** A clash is only a clash when the overlap is at least this thick, mm. */
const MIN_OVERLAP = .01;
/** Most sides a circle gets in the clash model. */
const MAX_SEGMENTS = 48;
const EPS$1 = 1e-7;
const sub = (a, b) => [
	a[0] - b[0],
	a[1] - b[1],
	a[2] - b[2]
];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
	a[1] * b[2] - a[2] * b[1],
	a[2] * b[0] - a[0] * b[2],
	a[0] * b[1] - a[1] * b[0]
];
function boxOfPoints(pts) {
	const min = [
		Infinity,
		Infinity,
		Infinity
	];
	const max = [
		-Infinity,
		-Infinity,
		-Infinity
	];
	let any = false;
	for (const p of pts) {
		any = true;
		for (let k = 0; k < 3; k++) {
			if (p[k] < min[k]) min[k] = p[k];
			if (p[k] > max[k]) max[k] = p[k];
		}
	}
	return any ? {
		min,
		max
	} : null;
}
function* facePoints(c) {
	for (const f of c.faces) yield* f;
}
function boxesMeet(a, b, tol = 0) {
	for (let k = 0; k < 3; k++) if (a.max[k] <= b.min[k] + tol || b.max[k] <= a.min[k] + tol) return false;
	return true;
}
function unionBox(a, b) {
	if (!a) return b;
	if (!b) return a;
	return {
		min: [
			Math.min(a.min[0], b.min[0]),
			Math.min(a.min[1], b.min[1]),
			Math.min(a.min[2], b.min[2])
		],
		max: [
			Math.max(a.max[0], b.max[0]),
			Math.max(a.max[1], b.max[1]),
			Math.max(a.max[2], b.max[2])
		]
	};
}
/**
* A convex polyhedron from its face polygons. Each face's plane comes from
* Newell's method and is turned to face away from the centroid, so a mirror in
* the transform chain cannot invert it. Degenerate faces are dropped.
*/
function convexOf(faces, exact) {
	const pts = faces.flat();
	if (pts.length < 4) return null;
	const c = [
		0,
		0,
		0
	];
	for (const p of pts) for (let k = 0; k < 3; k++) c[k] += p[k] / pts.length;
	const keptFaces = [];
	const planes = [];
	for (const f of faces) {
		if (f.length < 3) continue;
		let nx = 0;
		let ny = 0;
		let nz = 0;
		for (let i = 0; i < f.length; i++) {
			const a = f[i];
			const b = f[(i + 1) % f.length];
			nx += (a[1] - b[1]) * (a[2] + b[2]);
			ny += (a[2] - b[2]) * (a[0] + b[0]);
			nz += (a[0] - b[0]) * (a[1] + b[1]);
		}
		const len = Math.hypot(nx, ny, nz);
		if (len < 1e-12) continue;
		let n = [
			nx / len,
			ny / len,
			nz / len
		];
		let d = dot(n, f[0]);
		if (dot(n, c) > d) {
			n = [
				-n[0],
				-n[1],
				-n[2]
			];
			d = -d;
		}
		keptFaces.push(f);
		planes.push({
			n,
			d
		});
	}
	if (planes.length < 4) return null;
	const box = boxOfPoints(pts);
	if (!box) return null;
	return {
		faces: keptFaces,
		planes,
		box,
		exact
	};
}
function boxConvex(b, exact) {
	const [x0, y0, z0] = b.min;
	const [x1, y1, z1] = b.max;
	const v = (x, y, z) => [
		x,
		y,
		z
	];
	return convexOf([
		[
			v(x0, y0, z0),
			v(x0, y1, z0),
			v(x1, y1, z0),
			v(x1, y0, z0)
		],
		[
			v(x0, y0, z1),
			v(x1, y0, z1),
			v(x1, y1, z1),
			v(x0, y1, z1)
		],
		[
			v(x0, y0, z0),
			v(x1, y0, z0),
			v(x1, y0, z1),
			v(x0, y0, z1)
		],
		[
			v(x0, y1, z0),
			v(x0, y1, z1),
			v(x1, y1, z1),
			v(x1, y1, z0)
		],
		[
			v(x0, y0, z0),
			v(x0, y0, z1),
			v(x0, y1, z1),
			v(x0, y1, z0)
		],
		[
			v(x1, y0, z0),
			v(x1, y1, z0),
			v(x1, y1, z1),
			v(x1, y0, z1)
		]
	], exact);
}
/** Clip a convex polyhedron to the inside of `h` (n·p ≤ d). Null when nothing is left. */
function clipConvex(c, h) {
	let allIn = true;
	let allOut = true;
	for (const f of c.faces) for (const p of f) {
		const s = dot(h.n, p) - h.d;
		if (s > EPS$1) allIn = false;
		if (s < -1e-7) allOut = false;
	}
	if (allIn) return c;
	if (allOut) return null;
	const faces = [];
	const planes = [];
	const cut = [];
	for (let i = 0; i < c.faces.length; i++) {
		const f = c.faces[i];
		const out = [];
		for (let j = 0; j < f.length; j++) {
			const p = f[j];
			const q = f[(j + 1) % f.length];
			const sp = dot(h.n, p) - h.d;
			const sq = dot(h.n, q) - h.d;
			if (sp <= EPS$1) {
				out.push(p);
				if (sp >= -1e-7) cut.push(p);
			}
			if (sp < -1e-7 && sq > EPS$1 || sp > EPS$1 && sq < -1e-7) {
				const t = sp / (sp - sq);
				const x = [
					p[0] + (q[0] - p[0]) * t,
					p[1] + (q[1] - p[1]) * t,
					p[2] + (q[2] - p[2]) * t
				];
				out.push(x);
				cut.push(x);
			}
		}
		if (out.length >= 3) {
			faces.push(out);
			planes.push(c.planes[i]);
		}
	}
	const cap = orderOnPlane(dedupe(cut), h.n);
	if (cap.length >= 3) {
		faces.push(cap);
		planes.push(h);
	}
	if (faces.length < 4) return null;
	const box = boxOfPoints(facePoints({ faces }));
	if (!box) return null;
	return {
		faces,
		planes,
		box,
		exact: c.exact
	};
}
function dedupe(pts) {
	const out = [];
	for (const p of pts) if (!out.some((q) => Math.abs(q[0] - p[0]) < 1e-6 && Math.abs(q[1] - p[1]) < 1e-6 && Math.abs(q[2] - p[2]) < 1e-6)) out.push(p);
	return out;
}
/** Points on a plane with normal `n`, ordered counter-clockwise seen from +n. */
function orderOnPlane(pts, n) {
	if (pts.length < 3) return pts;
	const c = [
		0,
		0,
		0
	];
	for (const p of pts) for (let k = 0; k < 3; k++) c[k] += p[k] / pts.length;
	const ref = Math.abs(n[0]) < .9 ? [
		1,
		0,
		0
	] : [
		0,
		1,
		0
	];
	const u = cross(n, ref);
	const ul = Math.hypot(...u);
	const uu = [
		u[0] / ul,
		u[1] / ul,
		u[2] / ul
	];
	const vv = cross(n, uu);
	return pts.map((p) => {
		const r = sub(p, c);
		return {
			p,
			a: Math.atan2(dot(r, vv), dot(r, uu))
		};
	}).sort((x, y) => x.a - y.a).map((x) => x.p);
}
function flip(h) {
	return {
		n: [
			-h.n[0],
			-h.n[1],
			-h.n[2]
		],
		d: -h.d
	};
}
function thick(c) {
	return c.box.max[0] - c.box.min[0] >= .01 && c.box.max[1] - c.box.min[1] >= .01 && c.box.max[2] - c.box.min[2] >= .01;
}
function intersectConvex(a, b) {
	if (!boxesMeet(a.box, b.box)) return null;
	let p = a;
	for (const h of b.planes) {
		p = clipConvex(p, h);
		if (!p || !thick(p)) return null;
	}
	return p;
}
const MAX_PIECES = 256;
/**
* `pieces` minus the union of `group`, exactly: P∖C is the union over C's
* planes h_k of P ∩ inside(h_1..h_{k−1}) ∩ outside(h_k), disjoint pieces each
* convex. Returns null when the piece count runs away (the caller then keeps
* what it had, which over-covers rather than misses).
*/
function subtractGroup(pieces, group) {
	let cur = pieces;
	for (const c of group) {
		const next = [];
		for (const p of cur) {
			if (!boxesMeet(p.box, c.box)) {
				next.push(p);
				continue;
			}
			let rest = p;
			for (const h of c.planes) {
				if (!rest) break;
				const outside = clipConvex(rest, flip(h));
				if (outside && thick(outside)) next.push(outside);
				rest = clipConvex(rest, h);
			}
			if (next.length > MAX_PIECES) return null;
		}
		cur = next;
		if (cur.length === 0) break;
	}
	return cur;
}
const IDENTITY = [
	1,
	0,
	0,
	0,
	0,
	1,
	0,
	0,
	0,
	0,
	1,
	0
];
function compose(a, b) {
	const o = new Array(12);
	for (let r = 0; r < 3; r++) {
		for (let c = 0; c < 3; c++) o[r * 4 + c] = a[r * 4] * b[c] + a[r * 4 + 1] * b[4 + c] + a[r * 4 + 2] * b[8 + c];
		o[r * 4 + 3] = a[r * 4] * b[3] + a[r * 4 + 1] * b[7] + a[r * 4 + 2] * b[11] + a[r * 4 + 3];
	}
	return o;
}
function apply(m, p) {
	return [
		m[0] * p[0] + m[1] * p[1] + m[2] * p[2] + m[3],
		m[4] * p[0] + m[5] * p[1] + m[6] * p[2] + m[7],
		m[8] * p[0] + m[9] * p[1] + m[10] * p[2] + m[11]
	];
}
/** Manifold's rotate: about X, then Y, then Z. */
function rotation(deg) {
	const [ax, ay, az] = deg.map((d) => d * Math.PI / 180);
	const cx = Math.cos(ax), sx = Math.sin(ax);
	const cy = Math.cos(ay), sy = Math.sin(ay);
	const cz = Math.cos(az), sz = Math.sin(az);
	const rx = [
		1,
		0,
		0,
		0,
		0,
		cx,
		-sx,
		0,
		0,
		sx,
		cx,
		0
	];
	const ry = [
		cy,
		0,
		sy,
		0,
		0,
		1,
		0,
		0,
		-sy,
		0,
		cy,
		0
	];
	return compose([
		cz,
		-sz,
		0,
		0,
		sz,
		cz,
		0,
		0,
		0,
		0,
		1,
		0
	], compose(ry, rx));
}
function area2(p) {
	let a = 0;
	for (let i = 0; i < p.length; i++) {
		const [x0, y0] = p[i];
		const [x1, y1] = p[(i + 1) % p.length];
		a += x0 * y1 - x1 * y0;
	}
	return a / 2;
}
function ccw(p) {
	return area2(p) < 0 ? [...p].reverse() : p;
}
function isConvex2(p) {
	let sign = 0;
	for (let i = 0; i < p.length; i++) {
		const a = p[i];
		const b = p[(i + 1) % p.length];
		const c = p[(i + 2) % p.length];
		const z = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
		if (Math.abs(z) < 1e-12) continue;
		const s = Math.sign(z);
		if (sign === 0) sign = s;
		else if (s !== sign) return false;
	}
	return true;
}
/** Andrew's monotone chain, counter-clockwise. */
function hull2(points) {
	const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
	if (pts.length < 3) return pts;
	const crossZ = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
	const lower = [];
	for (const p of pts) {
		while (lower.length >= 2 && crossZ(lower[lower.length - 2], lower[lower.length - 1], p) <= 1e-12) lower.pop();
		lower.push(p);
	}
	const upper = [];
	for (let i = pts.length - 1; i >= 0; i--) {
		const p = pts[i];
		while (upper.length >= 2 && crossZ(upper[upper.length - 2], upper[upper.length - 1], p) <= 1e-12) upper.pop();
		upper.push(p);
	}
	lower.pop();
	upper.pop();
	return lower.concat(upper);
}
function circleSegments(r, asked) {
	if (asked && asked >= 3) return Math.min(asked, 96);
	return Math.max(12, Math.min(48, Math.ceil(r * 8)));
}
function circle2(r, segs) {
	return Array.from({ length: segs }, (_, i) => {
		const a = 2 * Math.PI * i / segs;
		return [r * Math.cos(a), r * Math.sin(a)];
	});
}
function mapRegion(r, f) {
	return {
		outer: ccw(r.outer.map(f)),
		holes: r.holes.map((h) => ccw(h.map(f))),
		exact: r.exact
	};
}
function regionOf(contour, exact = true) {
	if (isConvex2(contour)) return {
		outer: ccw(contour),
		holes: [],
		exact
	};
	return {
		outer: hull2(contour),
		holes: [],
		exact: false
	};
}
/** Grow a convex outline by `delta` (round joins). */
function offsetConvex(p, delta, round) {
	if (delta === 0) return p;
	if (delta > 0 && round) {
		const segs = circleSegments(delta);
		const pts = [];
		for (const v of p) for (const c of circle2(delta, segs)) pts.push([v[0] + c[0], v[1] + c[1]]);
		return hull2(pts);
	}
	const q = ccw(p);
	const lines = q.map((a, i) => {
		const b = q[(i + 1) % q.length];
		const dx = b[0] - a[0];
		const dy = b[1] - a[1];
		const l = Math.hypot(dx, dy) || 1;
		const nx = dy / l;
		const ny = -dx / l;
		return {
			a: [a[0] + nx * delta, a[1] + ny * delta],
			d: [dx, dy]
		};
	});
	const out = [];
	for (let i = 0; i < lines.length; i++) {
		const l1 = lines[(i + lines.length - 1) % lines.length];
		const l2 = lines[i];
		const den = l1.d[0] * l2.d[1] - l1.d[1] * l2.d[0];
		if (Math.abs(den) < 1e-12) {
			out.push(l2.a);
			continue;
		}
		const t = ((l2.a[0] - l1.a[0]) * l2.d[1] - (l2.a[1] - l1.a[1]) * l2.d[0]) / den;
		out.push([l1.a[0] + l1.d[0] * t, l1.a[1] + l1.d[1] * t]);
	}
	return area2(out) > 0 ? out : [];
}
/** A profile as convex regions with convex holes, or null when it cannot be read. */
function regionsOf(p) {
	switch (p.kind) {
		case "p-rect": {
			const [w, h] = p.size;
			const x0 = p.center ? -w / 2 : 0;
			const y0 = p.center ? -h / 2 : 0;
			return [{
				outer: [
					[x0, y0],
					[x0 + w, y0],
					[x0 + w, y0 + h],
					[x0, y0 + h]
				],
				holes: [],
				exact: true
			}];
		}
		case "p-circle": return [{
			outer: circle2(p.radius, circleSegments(p.radius, p.segments)),
			holes: [],
			exact: true
		}];
		case "p-poly": {
			const cs = p.contours.filter((c) => c.length >= 3);
			if (cs.length === 0) return [];
			if (p.fillRule && p.fillRule !== "EvenOdd") return [{
				outer: hull2(cs.flat()),
				holes: [],
				exact: false
			}];
			const outer = regionOf(cs[0]);
			for (const h of cs.slice(1)) if (isConvex2(h)) outer.holes.push(ccw(h));
			return [outer];
		}
		case "p-union": {
			const out = [];
			for (const c of p.children) {
				const r = regionsOf(c);
				if (!r) return null;
				out.push(...r);
			}
			return out;
		}
		case "p-difference": {
			const [first, ...rest] = p.children;
			if (!first) return [];
			const base = regionsOf(first);
			if (!base) return null;
			const holes = [];
			for (const c of rest) {
				const r = regionsOf(c);
				if (r) {
					for (const x of r) if (x.exact && x.holes.length === 0) holes.push(x.outer);
				}
			}
			return base.map((b) => ({
				...b,
				holes: [...b.holes, ...holes]
			}));
		}
		case "p-intersection": {
			const first = p.children[0];
			const r = first ? regionsOf(first) : [];
			return r ? r.map((x) => ({
				...x,
				exact: false
			})) : null;
		}
		case "p-hull": {
			const pts = [];
			let exact = true;
			for (const c of p.children) {
				const r = regionsOf(c);
				if (!r) return null;
				for (const x of r) {
					pts.push(...x.outer);
					exact = exact && x.exact;
				}
			}
			return pts.length >= 3 ? [{
				outer: hull2(pts),
				holes: [],
				exact
			}] : [];
		}
		case "p-offset": {
			const r = regionsOf(p.child);
			if (!r) return null;
			const round = (p.join ?? "round") === "round";
			return r.map((x) => ({
				outer: offsetConvex(x.outer, p.delta, round),
				holes: p.delta < 0 ? x.holes : [],
				exact: x.exact && (round || p.delta < 0 || (p.join ?? "round") === "miter")
			})).filter((x) => x.outer.length >= 3);
		}
		case "p-translate": {
			const r = regionsOf(p.child);
			const [dx, dy] = p.offset;
			return r ? r.map((x) => mapRegion(x, ([a, b]) => [a + dx, b + dy])) : null;
		}
		case "p-rotate": {
			const r = regionsOf(p.child);
			const a = p.degrees * Math.PI / 180;
			const c = Math.cos(a);
			const s = Math.sin(a);
			return r ? r.map((x) => mapRegion(x, ([u, v]) => [u * c - v * s, u * s + v * c])) : null;
		}
		case "p-scale": {
			const r = regionsOf(p.child);
			const [sx, sy] = p.scale;
			return r ? r.map((x) => mapRegion(x, ([u, v]) => [u * sx, v * sy])) : null;
		}
		case "p-mirror": {
			const r = regionsOf(p.child);
			const [nx, ny] = p.normal;
			const l = Math.hypot(nx, ny) || 1;
			const ux = nx / l;
			const uy = ny / l;
			return r ? r.map((x) => mapRegion(x, ([u, v]) => {
				const k = 2 * (u * ux + v * uy);
				return [u - k * ux, v - k * uy];
			})) : null;
		}
		default: return null;
	}
}
/** Faces of a frustum: `bottom` at z0 and `bottom` scaled by `topScale` at z1. */
function prismFaces(poly, z0, z1, topScale = 1) {
	const p = ccw(poly);
	const n = p.length;
	const lo = p.map(([x, y]) => [
		x,
		y,
		z0
	]);
	const hi = p.map(([x, y]) => [
		x * topScale,
		y * topScale,
		z1
	]);
	const faces = [[...lo].reverse(), hi];
	for (let i = 0; i < n; i++) {
		const j = (i + 1) % n;
		faces.push([
			lo[i],
			lo[j],
			hi[j],
			hi[i]
		]);
	}
	return faces;
}
function placed(faces, m, exact) {
	return convexOf(faces.map((f) => f.map((p) => apply(m, p))), exact);
}
function boundsPart(op, m) {
	const b = aabbOfOp(op);
	if (!b) return [];
	const corners = [];
	for (const x of [b.min[0], b.max[0]]) for (const y of [b.min[1], b.max[1]]) for (const z of [b.min[2], b.max[2]]) corners.push(apply(m, [
		x,
		y,
		z
	]));
	return [{
		body: boxConvex(boxOfPoints(corners), false),
		minus: []
	}];
}
const MAX_HULL_POINTS = 32;
/** Brute-force 3D hull for a handful of points: every triangle with all points on one side. */
function hull3(points) {
	const pts = dedupe(points);
	if (pts.length < 4 || pts.length > MAX_HULL_POINTS) return null;
	const faces = [];
	const n = pts.length;
	for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) for (let k = j + 1; k < n; k++) {
		const a = pts[i];
		const nn = cross(sub(pts[j], a), sub(pts[k], a));
		if (Math.hypot(...nn) < 1e-12) continue;
		let pos = false;
		let neg = false;
		for (const q of pts) {
			const s = dot(nn, sub(q, a));
			if (s > 1e-9) pos = true;
			else if (s < -1e-9) neg = true;
			if (pos && neg) break;
		}
		if (!(pos && neg)) faces.push([
			a,
			pts[j],
			pts[k]
		]);
	}
	return convexOf(faces, true);
}
function partsOf(op, m) {
	switch (op.kind) {
		case "cube": {
			const [x, y, z] = op.size;
			const o = op.center ? [
				-x / 2,
				-y / 2,
				-z / 2
			] : [
				0,
				0,
				0
			];
			const c = placed(prismFaces([
				[o[0], o[1]],
				[o[0] + x, o[1]],
				[o[0] + x, o[1] + y],
				[o[0], o[1] + y]
			], o[2], o[2] + z), m, true);
			return c ? [{
				body: c,
				minus: []
			}] : [];
		}
		case "cylinder": {
			const r0 = op.radiusLow;
			const r1 = op.radiusHigh ?? op.radiusLow;
			const r = Math.max(r0, r1);
			if (!(r > 0) || !(op.height > 0)) return [];
			const segs = circleSegments(r, op.segments);
			const z0 = op.center ? -op.height / 2 : 0;
			const base = r0 > 0 ? circle2(r0, segs) : circle2(r1, segs);
			const c = placed(r0 > 0 ? prismFaces(base, z0, z0 + op.height, r1 / r0) : prismFaces(base, z0 + op.height, z0, 0), m, true);
			return c ? [{
				body: c,
				minus: []
			}] : [];
		}
		case "extrude": {
			const regions = regionsOf(op.profile);
			const s = op.scaleTop ?? 1;
			const uniform = typeof s === "number" ? s : s[0] === s[1] ? s[0] : null;
			if (!regions || uniform === null || op.twistDegrees) return boundsPart(op, m);
			const z0 = op.center ? -op.height / 2 : 0;
			const z1 = z0 + op.height;
			const out = [];
			for (const r of regions) {
				const body = placed(prismFaces(r.outer, z0, z1, uniform), m, r.exact);
				if (!body) continue;
				const minus = [];
				for (const h of r.holes) {
					const pad = .01;
					const hc = placed(prismFaces(h, z0 - pad, z1 + pad, uniform), m, true);
					if (hc) minus.push([hc]);
				}
				out.push({
					body,
					minus
				});
			}
			return out;
		}
		case "translate": {
			const [x, y, z] = op.offset;
			return partsOf(op.child, compose(m, [
				1,
				0,
				0,
				x,
				0,
				1,
				0,
				y,
				0,
				0,
				1,
				z
			]));
		}
		case "rotate": return partsOf(op.child, compose(m, rotation(op.degrees)));
		case "scale": {
			const f = op.factor;
			return partsOf(op.child, compose(m, [
				f,
				0,
				0,
				0,
				0,
				f,
				0,
				0,
				0,
				0,
				f,
				0
			]));
		}
		case "union": return op.children.flatMap((c) => partsOf(c, m));
		case "difference": {
			const [first, ...rest] = op.children;
			if (!first) return [];
			const base = partsOf(first, m);
			const groups = [];
			for (const c of rest) {
				const ps = partsOf(c, m);
				if (ps.length > 0 && ps.every((p) => p.minus.length === 0 && p.body.exact)) groups.push(ps.map((p) => p.body));
			}
			return base.map((b) => ({
				body: b.body,
				minus: [...b.minus, ...groups]
			}));
		}
		case "intersection": {
			const first = op.children[0];
			return first ? partsOf(first, m).map((p) => ({
				body: {
					...p.body,
					exact: false
				},
				minus: p.minus
			})) : [];
		}
		case "hull": {
			const kids = op.children.flatMap((c) => partsOf(c, m));
			const pts = kids.flatMap((k) => [...facePoints(k.body)]);
			const h = kids.every((k) => k.body.exact) ? hull3(pts) : null;
			if (h) return [{
				body: h,
				minus: []
			}];
			const b = boxOfPoints(pts);
			return b ? [{
				body: boxConvex(b, false),
				minus: []
			}] : [];
		}
		case "mesh": {
			const pos = op.positions;
			const idx = op.indices;
			const v = (i) => [
				pos[i * 3],
				pos[i * 3 + 1],
				pos[i * 3 + 2]
			];
			const tris = [];
			for (let i = 0; i + 2 < idx.length; i += 3) tris.push([
				v(idx[i]),
				v(idx[i + 1]),
				v(idx[i + 2])
			]);
			const local = convexOf(tris, true);
			const verts = Array.from({ length: pos.length / 3 }, (_, i) => v(i));
			if (!(local !== null && local.planes.every((h) => verts.every((q) => dot(h.n, q) - h.d <= 1e-6 * (1 + Math.abs(h.d)))))) return boundsPart(op, m);
			const c = placed(tris, m, true);
			return c ? [{
				body: c,
				minus: []
			}] : [];
		}
		default: return boundsPart(op, m);
	}
}
function fnv(s) {
	let h1 = 2166136261;
	let h2 = 16777619 ^ s.length;
	for (let i = 0; i < s.length; i++) {
		const c = s.charCodeAt(i);
		h1 = Math.imul(h1 ^ c, 16777619);
		h2 = Math.imul(h2 ^ c, 1540483477);
	}
	return (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36) + s.length.toString(36);
}
function opKey(op) {
	return fnv(JSON.stringify(op, (_k, v) => v instanceof Float32Array || v instanceof Uint32Array ? `ta:${fnv(Array.from(v).join(","))}` : v));
}
const SHAPE_CACHE_SIZE = 512;
const PAIR_CACHE_SIZE = 4096;
const shapeCache = /* @__PURE__ */ new Map();
const pairCache = /* @__PURE__ */ new Map();
function lruGet(m, k) {
	const v = m.get(k);
	if (v !== void 0) {
		m.delete(k);
		m.set(k, v);
	}
	return v;
}
function lruSet(m, k, v, cap) {
	m.set(k, v);
	if (m.size > cap) m.delete(m.keys().next().value);
}
/** Counters for the timing spec and for tuning. */
const clashStats = {
	shapesBuilt: 0,
	pairsTested: 0,
	pairsCached: 0
};
function worst(a, b) {
	const rank = {
		footprint: 0,
		solid: 1,
		bounds: 2
	};
	return rank[a] >= rank[b] ? a : b;
}
/** The clash model of one op, cached by its content. */
function shapeOfOp(op, opts = {}) {
	const key = opKey(op);
	const hit = lruGet(shapeCache, key);
	if (hit) return hit;
	clashStats.shapesBuilt++;
	const parts = partsOf(op, IDENTITY);
	let box = null;
	let method = "solid";
	for (const p of parts) {
		box = unionBox(box, p.body.box);
		if (!p.body.exact) method = "bounds";
	}
	const shape = {
		key,
		parts,
		box,
		method,
		...opts.transient ? { transient: true } : {}
	};
	if (!opts.transient) lruSet(shapeCache, key, shape, SHAPE_CACHE_SIZE);
	return shape;
}
/** A flat feature: convex outlines in world XY, standing from z0 to z1. */
function footprintShape(polys, z0, z1) {
	const clean = polys.filter((p) => p.length >= 3).map((p) => isConvex2(p) ? ccw(p) : hull2(p));
	const key = fnv(`fp:${JSON.stringify(clean)}:${z0}:${z1}`);
	const hit = lruGet(shapeCache, key);
	if (hit) return hit;
	clashStats.shapesBuilt++;
	const parts = [];
	let box = null;
	for (const p of clean) {
		const c = convexOf(prismFaces(p, z0, z1), true);
		if (!c) continue;
		parts.push({
			body: c,
			minus: []
		});
		box = unionBox(box, c.box);
	}
	const shape = {
		key,
		parts,
		box,
		method: "footprint",
		footprint: {
			polys: clean,
			z0,
			z1
		}
	};
	lruSet(shapeCache, key, shape, SHAPE_CACHE_SIZE);
	return shape;
}
/** An axis-aligned rectangle footprint. */
function rectFootprint(x0, y0, x1, y1, z0, z1) {
	return footprintShape([[
		[x0, y0],
		[x1, y0],
		[x1, y1],
		[x0, y1]
	]], z0, z1);
}
function clip2(subject, clipper) {
	let out = subject;
	for (let i = 0; i < clipper.length && out.length > 0; i++) {
		const a = clipper[i];
		const b = clipper[(i + 1) % clipper.length];
		const side = (p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
		const inp = out;
		out = [];
		for (let j = 0; j < inp.length; j++) {
			const p = inp[j];
			const q = inp[(j + 1) % inp.length];
			const sp = side(p);
			const sq = side(q);
			if (sp >= -1e-7) out.push(p);
			if (sp < -1e-7 && sq > EPS$1 || sp > EPS$1 && sq < -1e-7) {
				const t = sp / (sp - sq);
				out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
			}
		}
	}
	return out;
}
function hitOf(box, method, pieces) {
	const size = [
		box.max[0] - box.min[0],
		box.max[1] - box.min[1],
		box.max[2] - box.min[2]
	];
	return {
		method,
		min: box.min,
		max: box.max,
		size,
		centre: [
			(box.min[0] + box.max[0]) / 2,
			(box.min[1] + box.max[1]) / 2,
			(box.min[2] + box.max[2]) / 2
		],
		pieces
	};
}
function footprintClash(a, b) {
	const z0 = Math.max(a.z0, b.z0);
	const z1 = Math.min(a.z1, b.z1);
	if (z1 - z0 < .01) return null;
	let box = null;
	const pieces = [];
	for (const p of a.polys) for (const q of b.polys) {
		const r = clip2(p, q);
		if (r.length < 3 || Math.abs(area2(r)) < .01 * .01) continue;
		const xs = r.map((v) => v[0]);
		const ys = r.map((v) => v[1]);
		const bx = {
			min: [
				Math.min(...xs),
				Math.min(...ys),
				z0
			],
			max: [
				Math.max(...xs),
				Math.max(...ys),
				z1
			]
		};
		if (bx.max[0] - bx.min[0] < .01 || bx.max[1] - bx.min[1] < .01) continue;
		box = unionBox(box, bx);
		pieces.push(bx);
	}
	return box ? hitOf(box, "footprint", pieces) : null;
}
function solidClash(a, b) {
	let box = null;
	const boxes = [];
	let method = "solid";
	for (const pa of a.parts) for (const pb of b.parts) {
		const p = intersectConvex(pa.body, pb.body);
		if (!p) continue;
		let pieces = [p];
		for (const g of [...pa.minus, ...pb.minus]) {
			const next = subtractGroup(pieces, g);
			if (next === null) {
				method = "bounds";
				continue;
			}
			pieces = next;
			if (pieces.length === 0) break;
		}
		for (const q of pieces) {
			box = unionBox(box, q.box);
			boxes.push(q.box);
		}
		if (pieces.length > 0 && (!pa.body.exact || !pb.body.exact)) method = "bounds";
	}
	return box ? hitOf(box, method, boxes) : null;
}
/** Do two shapes intersect, and if so where and how much. Cached by the pair. */
function shapesClash(a, b) {
	if (!a.box || !b.box || !boxesMeet(a.box, b.box, .01 / 2)) return null;
	const key = a.key < b.key ? `${a.key}|${b.key}` : `${b.key}|${a.key}`;
	const cached = pairCache.get(key);
	if (cached !== void 0) {
		clashStats.pairsCached++;
		return cached;
	}
	clashStats.pairsTested++;
	const hit = a.footprint && b.footprint ? footprintClash(a.footprint, b.footprint) : solidClash(a, b);
	if (!a.transient && !b.transient) lruSet(pairCache, key, hit, PAIR_CACHE_SIZE);
	return hit;
}
function feature(id, kind, label, shapes) {
	let box = null;
	for (const s of shapes) box = unionBox(box, s.box);
	return {
		id,
		kind,
		label,
		shapes,
		box
	};
}
function featureOfOps(id, kind, label, ops) {
	return feature(id, kind, label, ops.map((op) => shapeOfOp(op)));
}
/** Where two features meet, or null. The overlap box covers every shape pair that clashed. */
function interiorClash(a, b) {
	if (!a.box || !b.box || !boxesMeet(a.box, b.box, .01 / 2)) return null;
	let box = null;
	let method = null;
	const pieces = [];
	for (const sa of a.shapes) for (const sb of b.shapes) {
		const h = shapesClash(sa, sb);
		if (!h) continue;
		box = unionBox(box, {
			min: h.min,
			max: h.max
		});
		pieces.push(...h.pieces);
		method = method ? worst(method, h.method) : h.method;
	}
	return box && method ? hitOf(box, method, pieces) : null;
}
/** Every feature in `others` that `subject` runs into, with where. */
function clashesWith(subject, others) {
	const out = [];
	for (const o of others) {
		if (o.id === subject.id) continue;
		const hit = interiorClash(subject, o);
		if (hit) out.push({
			with: o,
			hit
		});
	}
	return out;
}
const r1$1 = (v) => `${Math.round(v * 10) / 10 || 0}`;
/** "1.2 × 0.8 × 3 mm around X 12.3, Y 4.5, Z 8 mm" — the overlap, in the panel's words. */
function describeOverlap(h) {
	return `${r1$1(h.size[0])} × ${r1$1(h.size[1])} × ${r1$1(h.size[2])} mm around X ${r1$1(h.centre[0])}, Y ${r1$1(h.centre[1])}, Z ${r1$1(h.centre[2])} mm`;
}

// vendor/casemaker/casemaker-app/src/engine/compiler/stackConnector.ts
/**
* Issue #149 — the stacking connector: dovetail sockets on the outside of the
* case walls, and the printed double-ended key that locks two parts together.
*
* PROVENANCE and every number: `types/stackConnector.ts`. Read its header
* first. This file is geometry only.
*
* ONE SOCKET, bottom to top, on a wall of exterior height H (the shell, plus
* the lid when the lid sits ON the rim rather than in it):
*
*   z = 0 .. capture+play      RECEIVING POCKET, open at the bottom. The key
*                              half standing proud of the part below slides up
*                              into it as this part is lowered on.
*   then STACK_STOP            the OVER-INSERTION STOP: solid pad.
*   then .. H                  STORAGE CHANNEL, open at the top, exactly one
*                              key long (+ end play). A key dropped in from the
*                              top parks half-proud on its detent; pushed home
*                              it bottoms on the stop with its top flush.
*
* Both open ends carry a 45° lead-in on the lips (forgiveness when a loaded
* case is set down by feel) and a SEAM NOTCH across the floor: two stacked
* parts' notches make one V-groove at the seam, which is where the key's bump
* clicks home. The notch is cut into the pad's backing, never the wall.
*
* The channel is VERTICAL, so it locks the two parts against sliding apart and
* against peeling off the wall, while lifting the upper part off is resisted
* only by the detent — the reviewed design's choice, and the reason a lid that
* the socket spans still lifts straight off. Registration (keeping a stack
* square) is not this feature's job; see the companion stack skirt/rim work.
*
* Frame inside this file: X = s (across the channel), Y = n (out of the wall,
* 0 on its outer face), Z = world z. `placeOnWall` turns that into the world.
*/
/** Small overlap so unions fuse and cutters clear the faces they open. */
const EPS = .01;
/** How far a cutter overshoots the face it opens, mm. */
const OVER = 1;
const SQRT2 = Math.SQRT2;
/**
* The dovetail region's half-width at height `y` (n), for a boundary moved
* `inset` mm perpendicular to the 45° flank (positive = into the channel, the
* key's side; negative = into the lip, a relieved socket).
*/
function flankHalfWidth(y, inset) {
	return 14 / 2 - (y - STACK_BACKING) - inset * SQRT2;
}
/** A trapezoid between two n levels, flanks inset by `inset`. */
function dovetailTrapezoid(yLow, yHigh, inset) {
	const lo = flankHalfWidth(yLow, inset);
	const hi = flankHalfWidth(yHigh, inset);
	return poly([
		[-lo, yLow],
		[lo, yLow],
		[hi, yHigh],
		[-hi, yHigh]
	]);
}
function rectXY(x0, x1, y0, y1) {
	return poly([
		[x0, y0],
		[x1, y0],
		[x1, y1],
		[x0, y1]
	]);
}
/** A box between two corners, in this file's frame. */
function box(min, max) {
	return translate(min, cube([
		max[0] - min[0],
		max[1] - min[1],
		max[2] - min[2]
	]));
}
/**
* The channel's cross-section as a list of CONVEX pieces (so each can be
* hulled for a lead-in): the dovetail under the lips, and the mouth between
* them out past the pad face. `relief` opens every engagement face that far —
* 0 for a real case, the ladder rung on the fit coupon.
*/
function socketSectionPieces(relief = 0) {
	const floorY = STACK_BACKING - relief;
	const lipY = STACK_BACKING + 3;
	return [dovetailTrapezoid(floorY, lipY, -relief), rectXY(-(8 / 2 + relief), 8 / 2 + relief, lipY - EPS, STACK_PAD_PROUD + OVER)];
}
/**
* The key's cross-section pieces at a per-face clearance `c`: the same
* dovetail moved `c` off every engagement face (floor and both flanks), and
* the web through the mouth, `c` off each lip, standing `STACK_WEB_PROUD`
* past the pad face as the grip.
*/
function keySectionPieces(c) {
	const baseY = STACK_BACKING + c;
	return [dovetailTrapezoid(baseY, STACK_BACKING + 3, c), rectXY(-(8 / 2 - c), 8 / 2 - c, baseY, STACK_PAD_PROUD + STACK_WEB_PROUD)];
}
/** The pad height a full socket needs for `variant`, mm. */
function socketFullHeight(variant) {
	return stackKeyLength(variant) + STACK_END_PLAY + 3 + 12 + STACK_END_PLAY;
}
/** The least height that still takes a storage channel one capture long, mm. */
function socketMinHeight() {
	return 12 + STACK_END_PLAY + 3;
}
/**
* Lay a socket out on a wall `height` mm tall, or null when even the storage
* channel does not fit. Priorities, in order: the storage channel (without
* it there is no socket), the receiving pocket (without it the part can only
* be the LOWER one of a stack), and last a storage channel deep enough to
* hold the key flush.
*/
function socketZLayout(height, variant) {
	const store = stackKeyLength(variant) + STACK_END_PLAY;
	const pocketTop = 12 + STACK_END_PLAY;
	if (height < socketMinHeight()) return null;
	const roomForPocket = height >= pocketTop + 3 + pocketTop;
	const floor = roomForPocket ? pocketTop + 3 : 3;
	const channelBottom = Math.max(floor, height - store);
	const depth = height - channelBottom;
	return {
		height,
		channel: [channelBottom, height],
		stop: [channelBottom - 3, channelBottom],
		pocket: roomForPocket ? [0, pocketTop] : null,
		flush: depth >= store - 1e-9,
		storedProud: Math.max(0, store - depth)
	};
}
function extrudeBetween(p, z0, z1) {
	return translate([
		0,
		0,
		z0
	], extrude(p, z1 - z0));
}
/**
* A 45° lead-in on the lips at an open end: each convex section piece hulled
* from `STACK_LEAD_IN` wider at the end plane to its own size `STACK_LEAD_IN`
* in. The floor is not widened — that is the notch's job.
*/
function leadIn(zEnd, dir, relief) {
	const L = 1;
	const nominal = socketSectionPieces(relief);
	const floorY = STACK_BACKING - relief;
	const lipY = STACK_BACKING + 3;
	const grown = [dovetailTrapezoid(floorY, lipY, -(relief + L)), rectXY(-(8 / 2 + relief + L), 8 / 2 + relief + L, lipY - EPS, STACK_PAD_PROUD + OVER)];
	const at = (z, thick, p) => dir > 0 ? extrudeBetween(p, z, z + thick) : extrudeBetween(p, z - thick, z);
	return nominal.map((piece, i) => hull([at(zEnd, OVER, grown[i]), at(zEnd - dir * L - dir * EPS, EPS, piece)]));
}
/**
* The seam notch at an open end: full depth for `STACK_NOTCH_FLAT` in from
* the end, then a 45° ramp out to the floor. Sized so the bump's 45° flanks
* clear it everywhere when the bump's tip is centred on the seam.
*/
function seamNotch(zEnd, dir, relief) {
	const floorY = STACK_BACKING - relief;
	const hw = 8 / 2;
	const deep = STACK_BACKING - 1;
	const flatEnd = zEnd - dir * STACK_NOTCH_FLAT;
	const rampEnd = zEnd - dir * (STACK_NOTCH_FLAT + 1);
	const zA = Math.min(flatEnd, zEnd + dir * OVER);
	const zB = Math.max(flatEnd, zEnd + dir * OVER);
	return hull([box([
		-hw,
		deep,
		zA
	], [
		hw,
		floorY + EPS,
		zB
	]), box([
		-hw,
		floorY - EPS,
		Math.min(rampEnd, rampEnd + dir * EPS)
	], [
		hw,
		floorY + EPS,
		Math.max(rampEnd, rampEnd + dir * EPS)
	])]);
}
/**
* The pad and cutters for one socket in the socket frame. `embed` is how far
* the pad sinks into the wall so the union fuses (half the wall: never into
* the cavity).
*/
function socketSolids(layout, embed, relief = 0) {
	const pieces = socketSectionPieces(relief);
	const cuts = [];
	const top = layout.height;
	for (const p of pieces) cuts.push(extrudeBetween(p, layout.channel[0], top + OVER));
	cuts.push(...leadIn(top, 1, relief), seamNotch(top, 1, relief));
	if (layout.pocket) {
		for (const p of pieces) cuts.push(extrudeBetween(p, -1, layout.pocket[1]));
		cuts.push(...leadIn(0, -1, relief), seamNotch(0, -1, relief));
	}
	return {
		pad: (z0, z1) => box([
			-22 / 2,
			-embed,
			z0
		], [
			22 / 2,
			STACK_PAD_PROUD,
			z1
		]),
		cuts
	};
}
/** Fit and engagement numbers for a key — pure, shared by the panel and the tests. */
function stackKeyDims(variant, fit = "tight") {
	const length = stackKeyLength(variant);
	const relief = fitRelief(fit);
	const c = STACK_SLIDE_CLEARANCE + relief;
	const bumps = [.../* @__PURE__ */ new Set([12, length - 12])];
	const w0 = Math.max(1.5, Math.min(...bumps) - 20 / 2);
	const span = Math.min(length - 1.5, Math.max(...bumps) + 20 / 2) - w0;
	const strain = 12 * 1 * STACK_BUMP / (span * span);
	return {
		variant,
		length,
		fit,
		relief,
		clearance: c,
		pullOutPlay: c * SQRT2,
		lipOverlap: 3 - c * (1 + SQRT2),
		engagedDepth: 3 - c,
		capture: 12,
		bumps,
		beamSpan: span,
		beamStrain: strain,
		width: 14 - 2 * c * (1 + SQRT2),
		thickness: 3 + STACK_WEB_PROUD + STACK_BUMP,
		source: `${STACK_SLIDE_CLEARANCE} mm sliding gap per face (our default, not yet printed) + ${relief} mm ${fit} relief on the key. Provisional until the stacking-connector fit coupon is printed.`
	};
}
/** Window z range along the key (the beam's free span). */
function windowRange(d) {
	const w0 = Math.max(1.5, Math.min(...d.bumps) - 20 / 2);
	return [w0, w0 + d.beamSpan];
}
/**
* The key in the SOCKET frame — X across, Y out of the wall (its floor-side
* face at `STACK_BACKING + clearance`), Z along it from 0 to its length. Built
* here so a test can drop it straight into a socket. `bump: false` leaves the
* detent bumps off (a key pushed home has its bump sprung flat on the floor,
* which a rigid mesh check cannot model).
*/
function buildStackKeyLocal(variant, fit = "tight", opts = {}) {
	const d = stackKeyDims(variant, fit);
	const c = opts.clearance ?? d.clearance;
	const L = d.length;
	const body = union$1(keySectionPieces(c).map((p) => extrude(p, L)));
	const [w0, w1] = windowRange(d);
	const baseY = STACK_BACKING + c;
	const ww = 5 / 2;
	const bw = 3 / 2;
	const window = box([
		-ww,
		baseY + 1,
		w0
	], [
		ww,
		baseY + 1 + 2,
		w1
	]);
	const slitA = box([
		bw,
		baseY - OVER,
		w0
	], [
		ww,
		baseY + 1 + EPS,
		w1
	]);
	const slitB = box([
		-ww,
		baseY - OVER,
		w0
	], [
		-bw,
		baseY + 1 + EPS,
		w1
	]);
	let key = difference([
		body,
		window,
		slitA,
		slitB
	]);
	if (opts.bump !== false) {
		const tipY = STACK_BACKING - STACK_BUMP;
		const rise = baseY - tipY;
		const bumps = d.bumps.map((zb) => hull([box([
			-bw,
			baseY - EPS,
			zb - STACK_BUMP_TIP / 2 - rise
		], [
			bw,
			baseY + .3,
			zb + STACK_BUMP_TIP / 2 + rise
		]), box([
			-bw,
			tipY,
			zb - STACK_BUMP_TIP / 2
		], [
			bw,
			tipY + EPS,
			zb + STACK_BUMP_TIP / 2
		])]));
		key = union$1([key, ...bumps]);
	}
	return key;
}
/** Height of the key lying flat, web face on the bed, before the bump, mm. */
const KEY_FLAT_TOP = STACK_PAD_PROUD + STACK_WEB_PROUD;
/**
* The key in PRINT orientation: web face on the bed (z = 0), the beam and the
* bump on top, length along +Y, centred on x = 0. Nothing overhangs — the
* dovetail flanks lean OUT going up at 45° and the beam bridges its window.
*/
function buildStackKeyPrint(variant, fit = "tight") {
	return translate([
		0,
		0,
		KEY_FLAT_TOP
	], rotate([
		-90,
		0,
		0
	], buildStackKeyLocal(variant, fit)));
}
/** Rotation about Z that turns the socket frame's +Y to the face's outward normal. */
function faceTurn(face) {
	switch (face) {
		case "+y": return 0;
		case "-y": return 180;
		case "+x": return -90;
		case "-x": return 90;
	}
}
/** Wall length along the face (the u extent), mm. */
function faceLength(face, outerX, outerY) {
	return face === "+y" || face === "-y" ? outerX : outerY;
}
/** World point on the face's outer plane at u = `u`, z = 0. */
function faceAnchor(face, u, outerX, outerY) {
	switch (face) {
		case "-y": return [
			u,
			0,
			0
		];
		case "+y": return [
			u,
			outerY,
			0
		];
		case "-x": return [
			0,
			u,
			0
		];
		case "+x": return [
			outerX,
			u,
			0
		];
	}
}
function placeOnWall(op, face, u, outerX, outerY) {
	return translate(faceAnchor(face, u, outerX, outerY), rotate([
		0,
		0,
		faceTurn(face)
	], op));
}
/** Largest |offset| that keeps the pad off the rounded corners, mm (may be < 0). */
function maxSocketOffset(face, outerX, outerY, cornerRadius) {
	return faceLength(face, outerX, outerY) / 2 - Math.max(0, cornerRadius) - 22 / 2;
}
/**
* What a socket occupies, as solids for the shared clash check: the pad (its
* half-wall embed included, so a port or a pocket cut through the wall under
* it is caught) and the key's grip standing out of the mouth. The channel cuts
* all lie inside the pad, so the pad is the socket's real extent.
*/
function socketClashOps(face, offset, height, wall, outerX, outerY, sweep = 0) {
	const u = faceLength(face, outerX, outerY) / 2 + offset;
	const embed = wall / 2;
	return SOCKET_BOXES.map(({ halfW, y0, y1 }) => placeOnWall(box([
		-(halfW + sweep),
		y0(embed),
		0
	], [
		halfW + sweep,
		y1,
		height
	]), face, u, outerX, outerY));
}
/** The socket's two boxes in its own frame: the pad, and the key's grip out of the mouth. */
const SOCKET_BOXES = [{
	halfW: 22 / 2,
	y0: (embed) => -embed,
	y1: STACK_PAD_PROUD
}, {
	halfW: 8 / 2,
	y0: () => STACK_PAD_PROUD,
	y1: STACK_PAD_PROUD + STACK_WEB_PROUD
}];
/** Side gap left between the pad and a cut-out through the brim or ribbing, mm. */
const PAD_CUTOUT_GAP = .5;
/** How far out from the wall a pad cut-out reaches, mm (past any brim or rib). */
const PAD_CUTOUT_REACH = 25;
/**
* The notch a socket with `cutThrough` takes out of the alignment brim and the
* rugged ribbing (WORLD coordinates): the pad's width plus a gap each side,
* from the pad's embed in the wall out past the brim, the full height of the
* socket. It is subtracted from the brim and rib ops only, never the shell, so
* the wall and the pad are untouched. Empty when no socket asks for one.
*/
function stackPadCutouts(params, geom) {
	if (!stackConnectorWanted(params)) return [];
	const out = [];
	const seen = /* @__PURE__ */ new Set();
	for (const s of params.sockets) {
		if (seen.has(s.face)) continue;
		seen.add(s.face);
		if (!s.cutThrough) continue;
		const limit = maxSocketOffset(s.face, geom.outerX, geom.outerY, geom.cornerRadius);
		if (limit < 0 || !socketZLayout(geom.top, params.key)) continue;
		const offset = Math.abs(s.offset) > limit ? Math.sign(s.offset) * limit : s.offset;
		const u = faceLength(s.face, geom.outerX, geom.outerY) / 2 + offset;
		const hw = 22 / 2 + PAD_CUTOUT_GAP;
		const notch = box([
			-hw,
			-(geom.wall / 2 + .05),
			0
		], [
			hw,
			PAD_CUTOUT_REACH,
			geom.top + OVER
		]);
		out.push(placeOnWall(notch, s.face, u, geom.outerX, geom.outerY));
	}
	return out;
}
const FACE_NAME = {
	"-y": "front",
	"+y": "back",
	"-x": "left",
	"+x": "right"
};
const fmt = (v) => `${Math.round(v * 10) / 10}`;
/**
* #854 item 4 — the base plate's floor thickness, mm. The plate is a shallow
* tray: its rim is exactly as tall as a socket's storage channel needs, so the
* PARKED key stands half-proud out of the rim and the case's bottom pocket
* receives it. The plate is the LOWER part of a stack by design — its sockets
* carry the storage channel, not the receiving pocket.
*/
const STACK_BASE_FLOOR = 3;
/** The base plate's node, when the project asks for one. */
function buildStackBasePlate(params, geom) {
	if (params?.basePlate !== true || !stackConnectorWanted(params)) return null;
	const h = socketMinHeight();
	if (h <= 5) return null;
	const cavityX = geom.outerX - 2 * geom.wall;
	const cavityY = geom.outerY - 2 * geom.wall;
	if (cavityX <= 4 || cavityY <= 4) return null;
	const outer = translate([
		0,
		0,
		0
	], roundedRectPrism(geom.outerX, geom.outerY, h, geom.cornerRadius));
	const cavity = translate([
		geom.wall,
		geom.wall,
		3
	], roundedRectPrism(cavityX, cavityY, h - 3 + 1, Math.max(0, geom.cornerRadius - geom.wall)));
	const solid = difference([outer, cavity]);
	const socketOps = buildStackConnector(params, {
		outerX: geom.outerX,
		outerY: geom.outerY,
		shellTop: h,
		top: h,
		wall: geom.wall,
		cornerRadius: geom.cornerRadius,
		...geom.caseFit !== void 0 ? { caseFit: geom.caseFit } : {}
	});
	let op = solid;
	if (socketOps.shellAdd.length > 0) op = union$1([op, ...socketOps.shellAdd]);
	if (socketOps.shellCut.length > 0) op = difference([op, ...socketOps.shellCut]);
	return {
		id: "stack-base",
		op
	};
}
/** True when the connector asks for anything at all. */
function stackConnectorWanted(p) {
	return !!p && (p.sockets.length > 0 || p.keys > 0);
}
/**
* Every offset along the wall at which the socket would clash, found in one
* intersection per keep-out: each of the socket's boxes is swept along the
* whole wall, intersected with the keep-out's real solid, and the overlap's
* pieces are projected back onto the wall. A box of half-width w at offset o
* meets a piece spanning [a, b] along the wall exactly when o lies in
* (a − c − w, b − c + w), c being the wall's centre — the same answer as
* testing the socket at every offset, at the cost of one test.
*/
function blockedOffsets(face, limit, geom, keepOuts) {
	const out = [];
	if (limit < 0) return out;
	const c = faceLength(face, geom.outerX, geom.outerY) / 2;
	const axis = face === "+y" || face === "-y" ? 0 : 1;
	const sweep = limit + 1;
	socketClashOps(face, 0, geom.top, geom.wall, geom.outerX, geom.outerY, sweep).forEach((op, i) => {
		const w = SOCKET_BOXES[i].halfW;
		const swept = feature(`socket-sweep:${face}:${i}`, "socket", "socket", [shapeOfOp(op)]);
		for (const { with: keep, hit } of clashesWith(swept, keepOuts)) for (const p of hit.pieces) {
			const a = p.min[axis];
			const b = p.max[axis];
			out.push({
				keep,
				from: a - c - w + MIN_OVERLAP,
				to: b - c + w - MIN_OVERLAP
			});
		}
	});
	return out;
}
/** The first offset nearest `from` (0.5 mm steps) clear of every blocked interval, or null. */
function clearOffset(from, limit, blocked, skip = () => false) {
	if (limit < 0) return null;
	const live = blocked.filter((b) => !skip(b.keep));
	const clear = (o) => live.every((b) => o <= b.from || o >= b.to);
	const steps = Math.ceil(2 * limit / .5) + 1;
	for (let i = 0; i <= steps; i++) for (const sign of [1, -1]) {
		const o = Math.round((from + sign * i * .5) * 2) / 2;
		if (Math.abs(o) <= limit + 1e-9 && clear(o)) return o;
	}
	return null;
}
function socketFeature(face, offset, geom) {
	return feature(`socket:${face}`, "socket", `the ${FACE_NAME[face]} socket`, socketClashOps(face, offset, geom.top, geom.wall, geom.outerX, geom.outerY).map((op) => shapeOfOp(op)));
}
/** Keep-outs a pad cut-out can go through. */
const CUTTABLE = /* @__PURE__ */ new Set(["brim", "ribbing"]);
/**
* Build the connector for one case. Returns empty arrays and a null report
* when the connector asks for nothing, so the caller can splice the arrays in
* unconditionally and an unconnected project's plan stays byte-identical.
*/
function buildStackConnector(params, geom, keepOuts = []) {
	const out = {
		shellAdd: [],
		shellCut: [],
		lidAdd: [],
		lidCut: [],
		keyNodes: [],
		report: null
	};
	if (!stackConnectorWanted(params)) return out;
	const fit = params.fit ?? geom.caseFit ?? "tight";
	const key = stackKeyDims(params.key, fit);
	const report = {
		sockets: [],
		notes: [],
		key,
		storage: null
	};
	const embed = geom.wall / 2;
	const seen = /* @__PURE__ */ new Set();
	for (const s of params.sockets) {
		const face = s.face;
		const name = FACE_NAME[face];
		if (seen.has(face)) {
			report.notes.push({
				face,
				kind: "duplicate",
				message: `The ${name} wall already has a socket; the second one is not cut.`
			});
			continue;
		}
		seen.add(face);
		const layout = socketZLayout(geom.top, params.key);
		if (!layout) {
			report.notes.push({
				face,
				kind: "too-short",
				message: `The ${name} wall is ${fmt(geom.top)} mm tall; a socket needs at least ${fmt(socketMinHeight())} mm, so none is cut there.`
			});
			continue;
		}
		const limit = maxSocketOffset(face, geom.outerX, geom.outerY, geom.cornerRadius);
		if (limit < 0) {
			report.notes.push({
				face,
				kind: "too-short",
				message: `The ${name} wall is ${fmt(faceLength(face, geom.outerX, geom.outerY))} mm long; a socket pad is ${fmt(22)} mm wide plus the corner rounding, so none is cut there.`
			});
			continue;
		}
		let offset = params.matchShifts === true && params.sockets.length > 0 ? params.sockets[0].offset : s.offset;
		if (Math.abs(offset) > limit) {
			const clamped = Math.sign(offset) * limit;
			report.notes.push({
				face,
				kind: "clamped",
				message: `The ${name} socket at ${fmt(offset)} mm would run off the rounded corner; it is cut at ${fmt(clamped)} mm instead.`
			});
			offset = clamped;
		}
		report.sockets.push({
			face,
			offset,
			layout
		});
		if (!layout.pocket) report.notes.push({
			face,
			kind: "no-pocket",
			message: `At ${fmt(geom.top)} mm tall the ${name} wall has room for the storage channel but not the receiving pocket under it (a full socket needs ${fmt(socketFullHeight(params.key))} mm): this case can be the lower part of a stack, not the upper.`
		});
		else if (report.storage === null) report.storage = {
			flush: layout.flush,
			storedProud: layout.storedProud,
			channelMm: layout.channel[1] - layout.channel[0]
		};
		const found = clashesWith(socketFeature(face, offset, geom), keepOuts);
		if (found.length > 0) {
			const hits = [...new Set(found.map((f) => f.with.label))];
			const method = found.reduce((m, f) => f.hit.method === "bounds" || m === "bounds" ? "bounds" : f.hit.method === "solid" ? "solid" : m, "footprint");
			const blocked = blockedOffsets(face, limit, geom, keepOuts);
			const move = clearOffset(offset, limit, blocked);
			const what = hits.length === 1 ? hits[0] : `${hits.slice(0, -1).join(", ")} and ${hits[hits.length - 1]}`;
			const pad = move === null && found.some((f) => CUTTABLE.has(f.with.kind)) ? clearOffset(offset, limit, blocked, (k) => CUTTABLE.has(k.kind)) : null;
			const first = found[0];
			const overlap = found.length === 1 ? ` (they overlap ${describeOverlap(first.hit)})` : "";
			let offer;
			if (move !== null) offer = `Moving it to ${fmt(move)} mm clears it.`;
			else if (pad !== null) {
				const cuttable = [...new Set(found.filter((f) => CUTTABLE.has(f.with.kind)).map((f) => f.with.label))];
				offer = `Every position along this wall runs into ${cuttable.join(" and ")}. ` + (pad === offset ? "A" : `At ${fmt(pad)} mm, a`) + ` pad cut-out through ${cuttable.length > 1 ? "them" : "it"}, ${fmt(22 + 2 * PAD_CUTOUT_GAP)} mm wide, makes room for the socket.`;
			} else offer = "No position along this wall clears it; the socket is cut as placed.";
			report.notes.push({
				face,
				kind: "clash",
				message: `The ${name} socket at ${fmt(offset)} mm runs into ${what}${overlap}. ${offer}`,
				method,
				...move !== null ? { suggestedOffset: move } : pad !== null ? {
					suggestedOffset: pad,
					padCutout: true
				} : {}
			});
		}
		if (s.cutThrough) report.notes.push({
			face,
			kind: "pad-cutout",
			message: `The ${name} socket has a pad cut-out, ${fmt(22 + 2 * PAD_CUTOUT_GAP)} mm wide, through the alignment brim and the ribbing; the wall and the seal inside the rim are not cut.`
		});
		const u = faceLength(face, geom.outerX, geom.outerY) / 2 + offset;
		const solids = socketSolids(layout, embed);
		const place = (op) => placeOnWall(op, face, u, geom.outerX, geom.outerY);
		out.shellAdd.push(place(solids.pad(0, geom.shellTop)));
		out.shellCut.push(...solids.cuts.map(place));
		if (geom.top > geom.shellTop + EPS) {
			out.lidAdd.push(place(solids.pad(geom.shellTop, geom.top)));
			out.lidCut.push(...solids.cuts.map(place));
		}
	}
	const keyCount = Math.max(0, Math.min(8, Math.floor(params.keys)));
	const pitch = key.width + 6;
	for (let i = 0; i < keyCount; i++) out.keyNodes.push({
		id: `stack-key-${i + 1}`,
		op: translate([
			geom.outerX + STACK_PAD_PROUD + 12 + i * pitch,
			0,
			0
		], buildStackKeyPrint(params.key, fit))
	});
	out.report = report;
	return out;
}

// vendor/casemaker/casemaker-app/src/engine/compiler/stackRegister.ts
/**
* Issue #854 item 2 — REGISTRATION, the companion of the stacking connector.
*
* The dovetail connector RETAINS: its key locks two parts together and resists
* sliding apart. It does not make a stack SQUARE, and #149's header says so.
* This is the other half: a telescoping pair that registers each case on the
* one below before any key goes in.
*
*   • The LID's top face carries a raised RIDGE ring, just inside the case
*     wall.
*   • The SHELL's floor underside carries a matching GROOVE ring — the
*     "skirt" is the floor and wall left OUTSIDE the groove — wide enough for
*     the ridge plus a sliding clearance on each side.
*
* The groove is slightly DEEPER than the ridge is tall, so a stacked case
* seats face-on-face (floor underside on the lid's top) and the ridge only
* ever squares it laterally. Registration gives no retention and no vertical
* clamping, exactly as the reviewed system separates the two (#149, behaviour
* 1): a stack still needs keys to stay together, and a registered stack is not
* held down by the skirt.
*
* PROVISIONAL, like every stacking number: the ridge width and the clearance
* are chosen, not measured; the stacking-connector coupon is where they would
* be settled. The ridge height follows the FLOOR, because that is what the
* groove is cut into — a thin floor gets a shallow ridge rather than a floor
* with its underside sliced through.
*/
/** Ridge thickness across the ring, mm. */
const STACK_RIDGE_W = 1.6;
/** Gap between the case wall and the ridge's outer face, mm. */
const STACK_RIDGE_INSET = .5;
/** Sliding clearance per side between ridge and groove, mm. */
const STACK_RIDGE_CLEARANCE = .2;
/** How much deeper the groove is than the ridge is tall, mm — the face datum. */
const STACK_GROOVE_RELIEF = .05;
/** Material the groove must leave under the floor's underside... i.e. keep the
*  floor whole: the groove is cut UP into the floor, so the floor's remaining
*  section is `floorThickness − depth`; never less than this, mm. */
const STACK_FLOOR_KEEP = .6;
/** Ridge height for a given floor thickness, mm — shallow on a thin floor. */
function stackRidgeHeight(floorThickness) {
	return Math.max(.5, Math.min(2, floorThickness - STACK_FLOOR_KEEP));
}
/** Groove depth for a given floor thickness, mm — the ridge plus the face datum. */
function stackGrooveDepth(floorThickness) {
	return stackRidgeHeight(floorThickness) + STACK_GROOVE_RELIEF;
}
/** True when the project asks for registration. */
function stackRegisterWanted(p) {
	return p?.register === true;
}
/**
* The ring's inner/outer rectangles, in case coordinates: the outer face sits
* `wallThickness + STACK_RIDGE_INSET` in from the envelope, the ring is
* `STACK_RIDGE_W` thick. `grow` widens it outward/inward by a clearance.
*/
function ringRects(f, grow = 0) {
	const o0 = f.wallThickness + STACK_RIDGE_INSET - grow;
	return {
		x0: o0,
		y0: o0,
		x1: f.outerX - o0,
		y1: f.outerY - o0,
		r: Math.max(0, f.cornerRadius - o0)
	};
}
/** One ring prism: outer rounded rect minus inner rounded rect, extruded z0..z1.
*  Null for a case too small to hold the ring — the caller skips it. */
function ring(outer, thickness, z0, z1) {
	const w = outer.x1 - outer.x0;
	const d = outer.y1 - outer.y0;
	if (w <= 2 * thickness || d <= 2 * thickness) return null;
	const ringOuter = translate([
		outer.x0,
		outer.y0,
		z0
	], roundedRectPrism(w, d, z1 - z0, outer.r));
	const ringInner = translate([
		outer.x0 + thickness,
		outer.y0 + thickness,
		z0 - 1
	], roundedRectPrism(w - 2 * thickness, d - 2 * thickness, z1 - z0 + 2, Math.max(0, outer.r - thickness)));
	return difference([ringOuter, ringInner]);
}
/** The lid's ridge, in LID-LOCAL coordinates (`lidTopZ` is the lid's own top). */
function buildStackRidge(f) {
	const h = stackRidgeHeight(f.floorThickness);
	return ring(ringRects(f), STACK_RIDGE_W, f.lidTopZ, f.lidTopZ + h);
}
/**
* The floor's groove, as a CUTTER in case coordinates: wider than the ridge by
* the clearance on each side, and deeper than the ridge by the face relief.
* Cut up from just under the floor's underside so the cut opens cleanly.
*/
function buildStackGroove(f) {
	const depth = stackGrooveDepth(f.floorThickness);
	return ring(ringRects(f, STACK_RIDGE_CLEARANCE), 2, -.5, depth);
}

// vendor/casemaker/casemaker-app/src/engine/compiler/caseClashes.ts
const r1 = (v) => `${Math.round(v * 10) / 10 || 0}`;
function overlapOf(h) {
	return {
		size: h.size.map((v) => Math.round(v * 100) / 100),
		centre: h.centre.map((v) => Math.round(v * 100) / 100)
	};
}
/**
* A lazily built set of the case's features, by kind. A kind is only turned
* into clash shapes the first time a check asks for it, so a case with magnets
* but no dividers never pays for its vents.
*/
var ClashEnv = class {
	defs = [];
	built = /* @__PURE__ */ new Map();
	/** One feature per op list; skipped when the list is empty. */
	add(kind, id, label, ops) {
		this.defs.push({
			kind,
			make: () => {
				const list = ops();
				return list.length > 0 ? [feature(id, kind, label, list.map((op) => shapeOfOp(op)))] : [];
			}
		});
		return this;
	}
	/** Any number of ready-made features of one kind. */
	addFeatures(kind, make) {
		this.defs.push({
			kind,
			make
		});
		return this;
	}
	of(...kinds) {
		const out = [];
		for (const k of kinds) {
			let list = this.built.get(k);
			if (!list) {
				list = this.defs.filter((d) => d.kind === k).flatMap((d) => d.make());
				this.built.set(k, list);
			}
			out.push(...list);
		}
		return out;
	}
};
/** How far a move offer looks along the face, mm. */
const MAGNET_MOVE_REACH = 40;
/** The order a move offer tries offsets in: along u, then along v, then both. */
function moveCandidates() {
	const out = [];
	for (let i = 1; i <= 40; i++) out.push([i, 0], [-i, 0]);
	for (let i = 1; i <= 40; i++) out.push([0, i], [0, -i]);
	const diag = [];
	for (let a = -40; a <= 40; a += 4) for (let b = -40; b <= 40; b += 4) if (a !== 0 && b !== 0) diag.push([a, b]);
	diag.sort((p, q) => Math.hypot(...p) - Math.hypot(...q));
	return out.concat(diag);
}
const CANDIDATES = moveCandidates();
const offerMemo = /* @__PURE__ */ new Map();
function pocketOps(p, lidZ, delta) {
	const lift = p.face === "+z" ? [
		delta[0],
		delta[1],
		delta[2] + lidZ
	] : delta;
	const move = (op) => lift[0] === 0 && lift[1] === 0 && lift[2] === 0 ? op : translate(lift, op);
	const boss = pocketBossOp(p);
	return {
		boss: boss ? move(boss) : null,
		pocket: move(pocketCutter$1(p))
	};
}
function pocketHits(p, input, delta) {
	const { boss, pocket } = pocketOps(p, input.lidZ, delta);
	const transient = delta[0] !== 0 || delta[1] !== 0 || delta[2] !== 0;
	const env = p.face === "+z" ? input.lidEnv : input.shellEnv;
	const out = [];
	if (boss) {
		const f = feature("magnet-boss", "magnet", "a magnet boss", [shapeOfOp(boss, { transient })]);
		for (const c of clashesWith(f, env)) out.push({
			part: "boss",
			...c
		});
	}
	const pf = feature("magnet-pocket", "magnet", "a magnet pocket", [shapeOfOp(pocket, { transient })]);
	for (const c of clashesWith(pf, [...env, ...p.face === "+z" ? [] : input.ports])) if (!out.some((o) => o.with.id === c.with.id)) out.push({
		part: "pocket",
		...c
	});
	return out;
}
/**
* Each magnet row (and the nameplate's pockets) against the case's other
* features, with an offer to move the row to the nearest clear spot.
*/
function magnetClashStatements(input) {
	const groups = /* @__PURE__ */ new Map();
	for (const p of input.facts.pockets) {
		const g = groups.get(p.sourceId) ?? [];
		g.push(p);
		groups.set(p.sourceId, g);
	}
	const out = [];
	for (const [source, pockets] of groups) {
		const hits = /* @__PURE__ */ new Map();
		for (const p of pockets) for (const h of pocketHits(p, input, [
			0,
			0,
			0
		])) if (!hits.has(h.with.id)) hits.set(h.with.id, {
			p,
			h
		});
		if (hits.size === 0) continue;
		const face = pockets[0].face;
		const frame = faceFrame(face, 0, 0, 0);
		const [fw, fh] = input.faceExtent(face);
		const origin = input.origin(source);
		let offer;
		const env = pockets[0].face === "+z" ? input.lidEnv : [...input.shellEnv, ...input.ports];
		const memoKey = pockets.map((p) => `${p.u},${p.v},${p.diameter},${p.depth},${p.skin},${p.boss?.length ?? 0},${p.boss?.diameter ?? 0}`).join(";") + `|${fw},${fh},${input.lidZ}|` + env.map((f) => f.shapes.map((x) => x.key).join(",")).join("/");
		const memo = offerMemo.get(memoKey);
		if (memo !== void 0) offer = memo === null || !origin ? void 0 : {
			...memo,
			source,
			u: origin[0] + memo.du,
			v: origin[1] + memo.dv
		};
		else if (origin) {
			for (const [du, dv] of CANDIDATES) {
				if (!pockets.every((p) => {
					const r = p.diameter / 2;
					return p.u + du - r >= 0 && p.v + dv - r >= 0 && p.u + du + r <= fw && p.v + dv + r <= fh;
				})) continue;
				const delta = [
					frame.uAxis[0] * du + frame.vAxis[0] * dv,
					frame.uAxis[1] * du + frame.vAxis[1] * dv,
					frame.uAxis[2] * du + frame.vAxis[2] * dv
				];
				if (pockets.every((p) => pocketHits(p, input, delta).length === 0)) {
					offer = {
						kind: "move-magnet",
						source,
						u: Math.round((origin[0] + du) * 100) / 100,
						v: Math.round((origin[1] + dv) * 100) / 100
					};
					break;
				}
			}
			if (offerMemo.size > 64) offerMemo.clear();
			offerMemo.set(memoKey, offer ? {
				kind: "move-magnet",
				du: offer.u - origin[0],
				dv: offer.v - origin[1]
			} : null);
		}
		const what = source === "nameplate" ? "nameplate" : pockets.length > 1 ? "row" : "pocket";
		const offerText = offer ? ` Moving the ${what} to u ${r1(offer.u)} mm, v ${r1(offer.v)} mm clears it.` : ` No spot within ${40} mm along the face clears it; it is cut as placed.`;
		for (const { p, h } of hits.values()) {
			const where = FACE_NAME$1[p.face];
			const plate = source === "nameplate";
			const who = h.part === "boss" ? `The boss behind ${plate ? "a nameplate magnet" : "a magnet pocket"} on the ${where} face` : `${plate ? "A nameplate pocket" : "A magnet pocket"} on the ${where} face`;
			const through = h.with.kind === "port" ? ", which is cut through it" : "";
			out.push({
				subject: "magnet",
				subjectId: source,
				against: h.with.kind,
				message: `${who} runs into ${h.with.label}${through} (they overlap ${describeOverlap(h.hit)}).${offerText}`,
				method: h.hit.method,
				overlap: overlapOf(h.hit),
				...offer ? { offer } : {}
			});
		}
	}
	return out;
}
function dividerFeature(rect, band) {
	return feature("divider", "divider", "a divider", [rectFootprint(rect.x0, rect.y0, rect.x1, rect.y1, band.floorZ - band.depth, band.floorZ + band.height)]);
}
/**
* Each divider against the lid's lip, the vents, HAT boards beyond the host's
* outline and the split-for-print seam. The offer is the nearest grid line
* that clears this and every other clash, or else the fewest sockets to drop.
*/
function dividerClashStatements(project, env) {
	if (env.length === 0) return [];
	const extraClash = (rect, _d, band) => clashesWith(dividerFeature(rect, band), env).map((c) => `it runs into ${c.with.label}`);
	const facts = caseDividerFacts(project, { extraClash });
	if (!facts.enabled) return [];
	const band = {
		floorZ: facts.floorZ,
		depth: facts.depth,
		height: facts.dividerHeight
	};
	const out = [];
	for (const f of facts.dividers) {
		if (!f.builds || f.rect.x1 <= f.rect.x0) continue;
		const found = clashesWith(dividerFeature(f.rect, band), env);
		if (found.length === 0) continue;
		const lineWord = (project.case.dividers ?? []).find((x) => x.id === f.id)?.axis === "x" ? "row" : "column";
		let offer;
		let offerText = " No grid line or shorter span clears it; it is built as placed.";
		if (f.moveTo !== null) {
			offer = {
				kind: "move-divider",
				id: f.id,
				line: f.moveTo
			};
			offerText = ` Moving it to ${lineWord} ${f.moveTo + 1} clears it.`;
		} else if (f.shortenTo) {
			offer = {
				kind: "shorten-divider",
				id: f.id,
				...f.shortenTo
			};
			offerText = ` Shortening it to ${f.shortenTo.holes} sockets, from socket ${f.shortenTo.start + 1}, clears it.`;
		}
		for (const c of found) out.push({
			subject: "divider",
			subjectId: f.id,
			against: c.with.kind,
			message: `${f.label}: it runs into ${c.with.label} (they overlap ${describeOverlap(c.hit)}).${offerText}`,
			method: c.hit.method,
			overlap: overlapOf(c.hit),
			...offer ? { offer } : {}
		});
	}
	return out;
}
/**
* A HAT board's footprint beyond the host board's outline, as up to four
* convex rectangles: the part over the host is the board's own clash.
*/
function hatBeyondHost(hat, host, z0, z1) {
	const pieces = [];
	const rect = (x0, y0, x1, y1) => {
		if (x1 - x0 > 1e-6 && y1 - y0 > 1e-6) pieces.push([
			[x0, y0],
			[x1, y0],
			[x1, y1],
			[x0, y1]
		]);
	};
	const ix0 = Math.max(hat.x0, host.x0);
	const ix1 = Math.min(hat.x1, host.x1);
	const iy0 = Math.max(hat.y0, host.y0);
	const iy1 = Math.min(hat.y1, host.y1);
	if (ix1 <= ix0 || iy1 <= iy0) rect(hat.x0, hat.y0, hat.x1, hat.y1);
	else {
		rect(hat.x0, hat.y0, ix0, hat.y1);
		rect(ix1, hat.y0, hat.x1, hat.y1);
		rect(ix0, hat.y0, ix1, iy0);
		rect(ix0, iy1, ix1, hat.y1);
	}
	return pieces.length > 0 ? [footprintShape(pieces, z0, z1)] : [];
}

// vendor/casemaker/casemaker-app/src/engine/compiler/archetype.ts
/**
* The archetype a project compiles to. Precedence is rack > stand > toolbox >
* badge > insert > blank > shell — each archetype is mutually exclusive by
* construction (only one `enabled` flag is ever set by the UI), so the order
* only matters for a hand-edited project that sets two.
*
* `toolbox` (#155) sits between the two established assemblies and the
* board-less parts: a stacking module is a full cavity-and-lid shape, so it
* beats badge/insert/blank, but rack and stand are richer multi-part
* assemblies and keep the top of the order.
*
* `blank` is checked LAST (#280) because it is the weakest claim on the
* project: "just cut something" carries no board, no cavity and no lid, so any
* richer shape a project also declares should win and the blank only takes
* over when it is the only flag set.
*
* Callers that need the stand's own fall-through — `buildStandNodes` returns
* `null` when the board is not a finished enclosure module, and the compiler
* then builds the normal shell rather than an empty viewport — keep doing so:
* this function reports the *requested* archetype, not whether the geometry
* can be built. Same for the badge, which falls through when its parameters
* are unbuildable (`badgeParamsProblem`).
*
* A null project (the welcome screen, a store that has not loaded yet) is
* `shell` — there is no archetype to report, and every caller's shell branch
* is the one that already handles "nothing to draw".
*/
function derivedKind(project) {
	const c = project?.case;
	if (c?.rack?.enabled) return "rack";
	if (c?.stand?.enabled) return "stand";
	if (c?.toolbox?.enabled) return "toolbox";
	if (c?.badge?.enabled) return "badge";
	if (c?.insert?.enabled) return "insert";
	if (c?.blank?.enabled) return "blank";
	return "shell";
}

// vendor/casemaker/casemaker-app/src/engine/compiler/toolboxFit.ts
/**
* Printer build-volume fit checking for the toolbox archetype (#155), the
* third caller of the generic per-part check `rackFit.ts` extracted.
*
* Footprints are in each part's PRINT orientation, which for this archetype is
* also its assembly orientation: a module is designed with `z = 0` as both the
* seating plane and the print-bed face, so it prints right way up with nothing
* to flip. That is why the print footprint of a module is simply its external
* plan `width × depth` and its print height is `height` — no `+ FOOT_H`, since
* the registration foot is *inside* that extent rather than hanging below it.
*
* The bin and the lid share a plan, so in practice one of them governs the bed
* check and the other governs the height; both are reported, because "the lid
* is the blocker" is a different fix from "the bin is".
*/
function toolboxPartFootprints(p) {
	return [{
		id: "toolbox-bin",
		label: "bin",
		fx: p.width,
		fy: p.depth,
		fz: p.height
	}, {
		id: "toolbox-lid",
		label: "lid",
		fx: p.width,
		fy: p.depth,
		fz: 16
	}];
}
/**
* Check the toolbox's two parts against the configured printer.
*
* A module bigger than the bed is not an error the compiler acts on — the
* geometry still builds and still exports — it is the app telling the user
* before they slice. Same contract as `validateRackFit`, and deliberately the
* same message wording, because `validateFootprints` builds both.
*/
function validateToolboxFit(p, printer) {
	const issues = [];
	if (!printer) return issues;
	if (toolboxParamsProblem(p) !== null) return issues;
	issues.push(...validateFootprints(toolboxPartFootprints(p), printer));
	return issues;
}

// vendor/casemaker/casemaker-app/src/engine/compiler/placementValidator.ts
const SIDE_FACES = [
	"+x",
	"-x",
	"+y",
	"-y"
];
function rectsOverlap(a, b) {
	if (a.uMax <= b.uMin || b.uMax <= a.uMin) return false;
	if (a.vMax <= b.vMin || b.vMax <= a.vMin) return false;
	return true;
}
/** Project a port onto its face, returning a 2D rect in (u, v) where u is
*  the in-wall horizontal axis (perpendicular to facing) and v is Z.
*  `inflate` is the per-edge expansion applied to the connector body — pass
*  the cutout margin to get the cut footprint, or 0 to get the body footprint
*  (used for body-overlap detection). */
function projectPortToFace(port, inflate) {
	if (!port.facing || port.facing === "+z" || port.facing === "-z") return null;
	let uMin;
	let uMax;
	if (port.facing === "+x" || port.facing === "-x") {
		uMin = port.position.y - inflate;
		uMax = port.position.y + port.size.y + inflate;
	} else {
		uMin = port.position.x - inflate;
		uMax = port.position.x + port.size.x + inflate;
	}
	const vMin = port.position.z - inflate;
	const vMax = port.position.z + port.size.z + inflate;
	return {
		id: port.id,
		source: "port",
		uMin,
		uMax,
		vMin,
		vMax,
		shape: port.cutoutShape
	};
}
const CONNECTOR_OVERHANG_BUDGET = 5;
const NON_OVERHANG_BUDGET = 1;
function validateBoardComponentBounds(board) {
	const issues = [];
	for (const c of board.components) {
		const cx = c.position.x + c.size.x / 2;
		const cy = c.position.y + c.size.y / 2;
		const facing = c.facing ?? null;
		const xMaxBudget = facing === "+x" ? CONNECTOR_OVERHANG_BUDGET : NON_OVERHANG_BUDGET;
		const xMinBudget = facing === "-x" ? CONNECTOR_OVERHANG_BUDGET : NON_OVERHANG_BUDGET;
		const yMaxBudget = facing === "+y" ? CONNECTOR_OVERHANG_BUDGET : NON_OVERHANG_BUDGET;
		const yMinBudget = facing === "-y" ? CONNECTOR_OVERHANG_BUDGET : NON_OVERHANG_BUDGET;
		if (cx < -xMinBudget || cx > board.pcb.size.x + xMaxBudget) issues.push({
			severity: "warning",
			kind: "off-pcb",
			involves: [c.id],
			message: `Component "${c.id}" centroid is outside the PCB X outline (cx=${cx.toFixed(1)} mm, PCB x=0..${board.pcb.size.x})`
		});
		if (cy < -yMinBudget || cy > board.pcb.size.y + yMaxBudget) issues.push({
			severity: "warning",
			kind: "off-pcb",
			involves: [c.id],
			message: `Component "${c.id}" centroid is outside the PCB Y outline (cy=${cy.toFixed(1)} mm, PCB y=0..${board.pcb.size.y})`
		});
	}
	return issues;
}
function validateMountingHoles(board) {
	const issues = [];
	for (const h of board.mountingHoles) if (h.x < 0 || h.x > board.pcb.size.x || h.y < 0 || h.y > board.pcb.size.y) issues.push({
		severity: "error",
		kind: "off-pcb",
		involves: [h.id],
		message: `Mounting hole "${h.id}" lies outside the PCB outline (${h.x.toFixed(1)}, ${h.y.toFixed(1)})`
	});
	for (let i = 0; i < board.mountingHoles.length; i++) for (let j = i + 1; j < board.mountingHoles.length; j++) {
		const a = board.mountingHoles[i];
		const b = board.mountingHoles[j];
		const dx = a.x - b.x;
		const dy = a.y - b.y;
		const dist = Math.sqrt(dx * dx + dy * dy);
		const minDist = Math.max(a.diameter, b.diameter) * 2;
		if (dist < minDist) issues.push({
			severity: "warning",
			kind: "misaligned",
			involves: [a.id, b.id],
			message: `Mounting holes "${a.id}" and "${b.id}" are ${dist.toFixed(1)} mm apart (< ${minDist.toFixed(1)} mm = 2 × max diameter)`
		});
	}
	return issues;
}
function validateFaceOverlaps(faceRects) {
	const issues = [];
	for (const face of SIDE_FACES) {
		const rects = faceRects.get(face) ?? [];
		for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
			const a = rects[i];
			const b = rects[j];
			if (a.source === b.source && a.source === "vent") continue;
			if (rectsOverlap(a, b)) issues.push({
				severity: "error",
				kind: "overlap",
				involves: [a.id, b.id],
				face,
				message: `Cutouts on the ${face} face overlap: "${a.id}" (${a.source}) and "${b.id}" (${b.source})`
			});
		}
	}
	return issues;
}
function validateRimMargin(faceRects, params, outerZ) {
	const issues = [];
	const rimMargin = params.lidThickness;
	const cavityTop = outerZ - params.lidThickness;
	for (const face of SIDE_FACES) for (const rect of faceRects.get(face) ?? []) {
		if (rect.source === "vent") continue;
		if (rect.vMax > cavityTop - rimMargin + .01) issues.push({
			severity: "warning",
			kind: "rim-margin",
			involves: [rect.id],
			face,
			message: `Cutout "${rect.id}" on ${face} reaches within ${rimMargin.toFixed(1)} mm of the rim — may collide with the lid pocket / snap catches`
		});
	}
	return issues;
}
function validateHatPlacements(project, resolveHat) {
	const issues = [];
	if (!project.hats || project.hats.length === 0) return issues;
	for (const placement of project.hats) {
		const profile = resolveHat(placement.hatId);
		if (!profile) continue;
		const matchesId = profile.compatibleBoards.includes(project.board.id);
		const matchesClonedFrom = project.board.clonedFrom !== void 0 && profile.compatibleBoards.includes(project.board.clonedFrom);
		if (profile.compatibleBoards.length > 0 && !matchesId && !matchesClonedFrom) issues.push({
			severity: "error",
			kind: "incompatible-hat",
			involves: [placement.id, profile.id],
			message: `HAT "${profile.name}" lists no compatibility with board "${project.board.id}"`
		});
		const offsetX = placement.offsetOverride?.x ?? 0;
		const offsetY = placement.offsetOverride?.y ?? 0;
		let supported = false;
		for (const hole of profile.mountingHoles) {
			const hx = hole.x + offsetX;
			const hy = hole.y + offsetY;
			if (hx >= 0 && hx <= project.board.pcb.size.x && hy >= 0 && hy <= project.board.pcb.size.y) {
				supported = true;
				break;
			}
		}
		if (!supported && profile.mountingHoles.length > 0) issues.push({
			severity: "error",
			kind: "unsupported-hat",
			involves: [placement.id],
			message: `HAT "${placement.id}" has no mounting hole inside the host PCB outline (offset x=${offsetX}, y=${offsetY})`
		});
	}
	const baseZ = computeHatBaseZ(project.board, project.case, project.hats, resolveHat);
	const ordered = [...project.hats].filter((p) => p.enabled).sort((a, b) => a.stackIndex - b.stackIndex);
	for (let i = 1; i < ordered.length; i++) {
		const prev = ordered[i - 1];
		const cur = ordered[i];
		const prevProfile = resolveHat(prev.hatId);
		const curBase = baseZ.get(cur.id);
		if (!prevProfile || curBase === void 0) continue;
		const prevBase = baseZ.get(prev.id);
		if (prevBase === void 0) continue;
		const prevTop = prevBase + prevProfile.components.reduce((m, c) => Math.max(m, c.position.z + c.size.z), prevProfile.pcb.size.z);
		if (curBase < prevTop - .01) issues.push({
			severity: "error",
			kind: "hat-stack-collision",
			involves: [prev.id, cur.id],
			message: `HATs "${prev.id}" and "${cur.id}" collide in Z: prev top ${prevTop.toFixed(1)} mm vs next base ${curBase.toFixed(1)} mm`
		});
	}
	return issues;
}
function buildFaceRects(project, resolveHat) {
	const map = /* @__PURE__ */ new Map();
	for (const f of SIDE_FACES) map.set(f, []);
	for (const port of project.ports) {
		if (!port.enabled) continue;
		const rect = projectPortToFace(port, 0);
		if (rect && port.facing && port.facing !== "+z" && port.facing !== "-z") map.get(port.facing).push(rect);
	}
	if (project.hats && project.hats.length > 0) {
		const baseZ = computeHatBaseZ(project.board, project.case, project.hats, resolveHat);
		for (const placement of project.hats) {
			if (!placement.enabled) continue;
			const profile = resolveHat(placement.hatId);
			if (!profile) continue;
			const z0 = baseZ.get(placement.id);
			if (z0 === void 0) continue;
			const offsetX = placement.offsetOverride?.x ?? 0;
			const offsetY = placement.offsetOverride?.y ?? 0;
			const ports = transformPlacementPorts(placement, profile);
			for (const port of ports) {
				if (!port.enabled || !port.facing || port.facing === "+z" || port.facing === "-z") continue;
				const rect = projectPortToFace({
					...port,
					position: {
						x: port.position.x + offsetX,
						y: port.position.y + offsetY,
						z: z0 + port.position.z - profile.pcb.size.z
					}
				}, 0);
				if (rect) {
					rect.id = `${placement.id}/${port.id}`;
					rect.source = "hat-port";
					map.get(port.facing).push(rect);
				}
			}
		}
	}
	return map;
}
function validatePlacements(project) {
	const kind = derivedKind(project);
	if (kind === "rack" && project.case.rack) {
		const issues = validateRackFit(project.case.rack, resolvePrinter(project));
		return {
			issues,
			errorCount: issues.filter((i) => i.severity === "error").length,
			warningCount: issues.filter((i) => i.severity === "warning").length
		};
	}
	if (kind === "badge" && project.case.badge) {
		const problem = badgeParamsProblem(project.case.badge);
		const issues = problem ? [{
			severity: "error",
			kind: "badge-config",
			involves: ["badge"],
			message: problem
		}] : [];
		return {
			issues,
			errorCount: issues.filter((i) => i.severity === "error").length,
			warningCount: issues.filter((i) => i.severity === "warning").length
		};
	}
	if (kind === "toolbox" && project.case.toolbox) {
		const toolbox = project.case.toolbox;
		const problem = toolboxParamsProblem(toolbox);
		const issues = problem ? [{
			severity: "error",
			kind: "toolbox-config",
			involves: ["toolbox"],
			message: problem
		}] : validateToolboxFit(toolbox, resolvePrinter(project));
		return {
			issues,
			errorCount: issues.filter((i) => i.severity === "error").length,
			warningCount: issues.filter((i) => i.severity === "warning").length
		};
	}
	if (kind === "blank" && project.case.blank) {
		const problem = blankParamsProblem(project.case.blank);
		const issues = problem ? [{
			severity: "error",
			kind: "blank-config",
			involves: ["blank"],
			message: problem
		}] : [];
		return {
			issues,
			errorCount: issues.filter((i) => i.severity === "error").length,
			warningCount: issues.filter((i) => i.severity === "warning").length
		};
	}
	const resolveHat = (id) => {
		const builtin = getBuiltinHat(id);
		if (builtin) return builtin;
		return project.customHats?.find((h) => h.id === id);
	};
	const resolveDisplay = (id) => {
		const builtin = getBuiltinDisplay(id);
		if (builtin) return builtin;
		return project.customDisplays?.find((d) => d.id === id);
	};
	const issues = [];
	issues.push(...validateBoardComponentBounds(project.board));
	issues.push(...validateMountingHoles(project.board));
	issues.push(...validateHatPlacements(project, resolveHat));
	const faceRects = buildFaceRects(project, resolveHat);
	issues.push(...validateFaceOverlaps(faceRects));
	const dims = computeShellDims(project.board, project.case, project.hats ?? [], resolveHat, project.display, resolveDisplay);
	issues.push(...validateRimMargin(faceRects, project.case, dims.outerZ));
	return {
		issues,
		errorCount: issues.filter((i) => i.severity === "error").length,
		warningCount: issues.filter((i) => i.severity === "warning").length
	};
}

// vendor/casemaker/casemaker-app/src/engine/compiler/ProjectCompiler.ts
function makeHatResolver(project) {
	const customById = new Map((project.customHats ?? []).map((h) => [h.id, h]));
	return (id) => customById.get(id) ?? getBuiltinHat(id);
}
function makeDisplayResolver(project) {
	const customById = new Map((project.customDisplays ?? []).map((d) => [d.id, d]));
	return (id) => customById.get(id) ?? getBuiltinDisplay(id);
}
function compileProject(project) {
	const { board, case: caseParams, ports, externalAssets, hats, mountingFeatures, display, fanMounts, textLabels, antennas } = project;
	const resolveHat = makeHatResolver(project);
	const resolveDisplay = makeDisplayResolver(project);
	const kind = derivedKind(project);
	if (kind === "rack" && caseParams.rack) {
		const rackPrinter = resolvePrinter(project);
		const rackNodes = buildRackNodes(caseParams.rack, rackPrinter);
		const rackOffers = rackSplitOffers(caseParams.rack, rackPrinter);
		if (caseParams.splitForPrint === true) rackNodes.push(...buildRackSplitNodes(caseParams.rack, rackPrinter));
		return {
			nodes: rackNodes,
			placementReport: validatePlacements(project),
			smartCutoutDecisions: [],
			rackSplitOffers: rackOffers
		};
	}
	if (kind === "stand" && caseParams.stand) {
		const standNodes = buildStandNodes(board, caseParams.stand);
		if (standNodes) return {
			nodes: standNodes,
			placementReport: validatePlacements(project),
			smartCutoutDecisions: []
		};
	}
	if (kind === "toolbox" && caseParams.toolbox) {
		const toolboxNodes = buildToolboxNodes(caseParams.toolbox);
		if (toolboxNodes) {
			const toolbox = caseParams.toolbox;
			const toolboxConnector = buildStackConnector(caseParams.stackConnector, {
				outerX: toolbox.width,
				outerY: toolbox.depth,
				shellTop: toolbox.height,
				top: toolbox.height,
				wall: 3,
				cornerRadius: 0,
				caseFit: caseParams.fit
			});
			const bin = toolboxNodes.find((n) => n.id === TOOLBOX_BIN_NODE_ID);
			if (bin && (toolboxConnector.shellAdd.length > 0 || toolboxConnector.shellCut.length > 0)) {
				let op = bin.op;
				if (toolboxConnector.shellAdd.length > 0) op = union$1([op, ...toolboxConnector.shellAdd]);
				if (toolboxConnector.shellCut.length > 0) op = difference([op, ...toolboxConnector.shellCut]);
				bin.op = op;
			}
			toolboxNodes.push(...toolboxConnector.keyNodes);
			return {
				nodes: toolboxNodes,
				placementReport: validatePlacements(project),
				smartCutoutDecisions: [],
				...toolboxConnector.report ? { connector: toolboxConnector.report } : {}
			};
		}
	}
	if (kind === "badge" && caseParams.badge) {
		const badgeNodes = buildBadgeNodes(caseParams.badge);
		if (badgeNodes) return {
			nodes: badgeNodes,
			placementReport: validatePlacements(project),
			smartCutoutDecisions: []
		};
	}
	if (kind === "insert" && caseParams.insert) {
		const insertNodes = buildInsertNodes(caseParams.insert);
		if (insertNodes) return {
			nodes: insertNodes,
			placementReport: validatePlacements(project),
			smartCutoutDecisions: []
		};
	}
	if (kind === "blank" && caseParams.blank) {
		const blankNodes = buildBlankNodes(caseParams.blank);
		if (blankNodes) return {
			nodes: blankNodes,
			placementReport: validatePlacements(project),
			smartCutoutDecisions: []
		};
	}
	const shellOuter = buildOuterShell(board, caseParams, hats ?? [], resolveHat, display, resolveDisplay);
	const bossPlacements = computeBossPlacements(board, caseParams);
	const bossOps = buildBossesUnion(bossPlacements);
	const assetOps = buildExternalAssetOps(externalAssets);
	const featureOps = buildMountingFeatureOps(mountingFeatures, board, caseParams, hats ?? [], resolveHat, display, resolveDisplay);
	const displayOps = buildDisplayCutoutOps(board, caseParams, display, resolveDisplay, hats ?? [], resolveHat);
	const fanOps = buildFanMountOps(fanMounts, board, caseParams, hats ?? [], resolveHat, display, resolveDisplay);
	const textOps = buildTextLabelOps(textLabels, board, caseParams, hats ?? [], resolveHat, display, resolveDisplay, project.customFonts ?? []);
	const antennaOps = buildAntennaOps(antennas, board, caseParams, hats ?? [], resolveHat, display, resolveDisplay);
	const snapOps = buildSnapCatchOps(caseParams.snapCatches, board, caseParams, hats ?? [], resolveHat, display, resolveDisplay);
	const latchOps = buildLatchOps(caseParams.latches, board, caseParams, hats ?? [], resolveHat, display, resolveDisplay);
	const flangeOps = { ...buildAlignmentFlange(board, caseParams, hats ?? [], resolveHat, display, resolveDisplay) };
	const boardSnapOps = buildBoardSnapOps(board, caseParams, hats ?? [], resolveHat, display, resolveDisplay);
	const secondaryMountOps = buildSecondaryMountOps(board, caseParams);
	const ruggedOps = buildRuggedOps(board, caseParams, hats ?? [], resolveHat, display, resolveDisplay);
	const connectorOn = stackConnectorWanted(caseParams.stackConnector);
	const shellDimsEarly = connectorOn ? computeShellDims(board, caseParams, hats ?? [], resolveHat, display, resolveDisplay) : null;
	const lidDimsEarly = computeLidDims(board, caseParams, hats ?? [], resolveHat, display, resolveDisplay);
	const connectorTop = shellDimsEarly ? lidIsRecessed(caseParams) ? shellDimsEarly.outerZ : lidDimsEarly.zPosition + lidDimsEarly.z : 0;
	const padCuts = shellDimsEarly ? stackPadCutouts(caseParams.stackConnector, {
		outerX: shellDimsEarly.outerX,
		outerY: shellDimsEarly.outerY,
		top: connectorTop,
		wall: caseParams.wallThickness,
		cornerRadius: caseParams.cornerRadius
	}) : [];
	if (padCuts.length > 0) {
		const toLid = padCuts.map((op) => translate([
			0,
			0,
			-lidDimsEarly.zPosition
		], op));
		if (flangeOps.caseAdditive) flangeOps.caseAdditive = difference([flangeOps.caseAdditive, ...padCuts]);
		if (flangeOps.lidAdditive) flangeOps.lidAdditive = difference([flangeOps.lidAdditive, ...toLid]);
		ruggedOps.caseAdditive = ruggedOps.caseAdditive.map((op) => difference([op, ...padCuts]));
		ruggedOps.lidAdditive = ruggedOps.lidAdditive.map((op) => difference([op, ...toLid]));
	}
	const hingeOps = buildHingeOps(caseParams.hinge, board, caseParams, hats ?? [], resolveHat, display, resolveDisplay);
	const magnetOps = buildMagnetOps(board, caseParams, hats ?? [], resolveHat, display, resolveDisplay, project.customFonts ?? []);
	const deliberateVoids = deliberateVoidsFor(magnetOps.facts.pockets);
	const dividerOps = buildCaseDividerOps(project);
	const additive = [
		shellOuter,
		...bossOps,
		...assetOps.unionOps,
		...featureOps.additive,
		...displayOps.additive,
		...fanOps.additive,
		...textOps.additive,
		...snapOps.shellAdd,
		...hingeOps.caseAdditive,
		...latchOps.caseAdditive,
		...ruggedOps.caseAdditive,
		...flangeOps.caseAdditive ? [flangeOps.caseAdditive] : [],
		...boardSnapOps.caseAdditive,
		...secondaryMountOps.caseAdditive,
		...magnetOps.shellAdd
	];
	const smartLayout = applySmartCutoutLayout(ports, board, caseParams, hats ?? [], resolveHat, display, resolveDisplay);
	const portCutOps = buildPortCutoutsForProject(smartLayout.ports, board, caseParams);
	const ventKeepOuts = portCutOps.map(aabbOfOp).filter((b) => b !== null);
	const ventCuts = buildVentilationCutouts(board, caseParams, hats ?? [], resolveHat, display, resolveDisplay, ventKeepOuts);
	const sealChannel = buildSealChannel(board, caseParams, hats ?? [], resolveHat, display, resolveDisplay);
	const customCutOps = buildCustomCutouts(caseParams.customCutouts, board, caseParams, hats ?? [], resolveHat, display, resolveDisplay);
	const cutoutOps = [
		...portCutOps,
		...ventCuts.shellCuts,
		...sealChannel ? [sealChannel] : [],
		...buildHatCutoutsForProject(board, caseParams, hats ?? [], resolveHat),
		...assetOps.subtractOps,
		...featureOps.subtractive,
		...displayOps.subtractive,
		...fanOps.subtractive,
		...textOps.subtractive,
		...antennaOps.subtractive,
		...snapOps.shellSubtract,
		...hingeOps.subtractive,
		...latchOps.caseSubtract,
		...customCutOps,
		...magnetOps.shellCut,
		...dividerOps.floorCut
	];
	const lidZ = lidDimsEarly.zPosition;
	const toWorld = (ops) => ops.map((op) => translate([
		0,
		0,
		lidZ
	], op));
	const magnetsOn = magnetOps.facts.pockets.length > 0;
	const dividersOn = caseParams.floorGrid?.enabled === true && (caseParams.dividers ?? []).some((d) => d.enabled);
	const baseLidOp = buildLid(board, caseParams, hats ?? [], resolveHat, display, resolveDisplay);
	const env = new ClashEnv();
	if (magnetsOn || dividersOn || connectorOn) {
		const enabledPorts = smartLayout.ports.filter((p) => p.enabled);
		env.addFeatures("board", () => {
			const o = cavityOriginXY(caseParams);
			const z = caseParams.floorThickness + board.defaultStandoffHeight;
			const pcb = board.pcb.size;
			const ops = [translate([
				o.x,
				o.y,
				z
			], cube([
				pcb.x,
				pcb.y,
				pcb.z
			]))];
			for (const c of board.components) ops.push(translate([
				o.x + c.position.x,
				o.y + c.position.y,
				z + c.position.z
			], cube([
				c.size.x,
				c.size.y,
				c.size.z
			])));
			return [featureOfOps("board", "board", "the board", ops)];
		}).add("standoff", "standoffs", "a board standoff", () => [...bossOps, ...buildLidBosses(bossPlacements, lidZ, caseParams.floorThickness + board.defaultStandoffHeight + board.pcb.size.z + .3)]).addFeatures("port", () => enabledPorts.flatMap((p) => {
			const op = buildPortCutoutOp(p, board, caseParams);
			return op ? [featureOfOps(`port:${p.id}`, "port", `the ${p.kind} cutout`, [op])] : [];
		})).add("latch", "latches", "a latch", () => [
			...latchOps.caseAdditive,
			...latchOps.caseSubtract,
			...latchOps.lidAdditive
		]).add("hinge", "hinge", "the hinge", () => [
			...hingeOps.caseAdditive,
			...hingeOps.subtractive,
			...toWorld(hingeOps.lidAdditive)
		]).add("lid", "lid", "the lid", () => toWorld([baseLidOp])).add("lid-lip", "lid-lip", "the lid's friction lip", () => {
			if (caseParams.joint !== "snap-fit" || caseParams.snapType !== "full-lid") return [];
			const lip = buildFullLidFrictionLip(board, caseParams, hats ?? [], resolveHat, display, resolveDisplay);
			return lip ? toWorld([lip]) : [];
		}).addFeatures("vent", () => {
			const floorTop = caseParams.floorThickness + 1.5;
			const bottom = ventCuts.shellCuts.filter((op) => (aabbOfOp(op)?.max[2] ?? Infinity) <= floorTop);
			const side = ventCuts.shellCuts.filter((op) => !bottom.includes(op));
			return [...bottom.length ? [featureOfOps("vents-bottom", "vent", "a bottom vent", bottom)] : [], ...side.length ? [featureOfOps("vents-side", "vent", "a side vent", side)] : []];
		}).addFeatures("hat", () => {
			const baseZ = computeHatBaseZ(board, caseParams, hats ?? [], resolveHat);
			const host = boardFootprint(board, caseParams, display, resolveDisplay);
			const o = cavityOriginXY(caseParams);
			const out = [];
			for (const h of hats ?? []) {
				const prof = resolveHat(h.hatId);
				const z0 = baseZ.get(h.id);
				if (!prof || z0 === void 0 || !h.enabled) continue;
				const pos = resolveMountingPosition(prof, h);
				const turned = pos.rotation === 90 || pos.rotation === 270;
				const w = turned ? prof.pcb.size.y : prof.pcb.size.x;
				const d = turned ? prof.pcb.size.x : prof.pcb.size.y;
				const cx = o.x + prof.pcb.size.x / 2 + pos.offset.x + (h.offsetOverride?.x ?? 0);
				const cy = o.y + prof.pcb.size.y / 2 + pos.offset.y + (h.offsetOverride?.y ?? 0);
				const tallest = prof.components.reduce((m, c) => Math.max(m, c.position.z + c.size.z), prof.pcb.size.z);
				const shapes = hatBeyondHost({
					x0: cx - w / 2,
					y0: cy - d / 2,
					x1: cx + w / 2,
					y1: cy + d / 2
				}, host, z0, z0 + tallest);
				if (shapes.length) out.push(feature(`hat:${h.id}`, "hat", `the ${prof.name} board`, shapes));
			}
			return out;
		}).add("magnet", "magnets", "a magnet pocket", () => [
			...magnetOps.shellAdd,
			...magnetOps.shellCut,
			...toWorld([...magnetOps.lidAdd, ...magnetOps.lidCut])
		]).add("nameplate", "nameplate", "the nameplate", () => magnetOps.nameplate ? [magnetOps.nameplate.op] : []).add("floor-grid", "floor-grid", "the floor grid", () => dividerOps.floorCut).add("brim", "brim", "the alignment brim", () => [...flangeOps.caseAdditive ? [flangeOps.caseAdditive] : [], ...flangeOps.lidAdditive ? toWorld([flangeOps.lidAdditive]) : []]).add("ribbing", "ribbing", "the rugged ribbing", () => [...ruggedOps.caseAdditive, ...toWorld(ruggedOps.lidAdditive)]).add("other", "mounting", "a mounting feature", () => [...featureOps.additive, ...featureOps.subtractive]).add("other", "fan", "a fan mount", () => [...fanOps.additive, ...fanOps.subtractive]).add("other", "display", "the display opening", () => [...displayOps.additive, ...displayOps.subtractive]).add("other", "label", "a label", () => [...textOps.additive, ...textOps.subtractive]).add("other", "antenna", "an antenna", () => antennaOps.subtractive).add("other", "snap", "a snap catch", () => [...snapOps.shellAdd, ...snapOps.shellSubtract]).add("other", "custom", "a custom cutout", () => customCutOps).add("other", "board-snap", "the board-snap clips", () => boardSnapOps.caseAdditive).add("other", "secondary", "a secondary-board mount", () => secondaryMountOps.caseAdditive);
	}
	const connector = (() => {
		if (!connectorOn || !shellDimsEarly) return buildStackConnector(void 0, {
			outerX: 0,
			outerY: 0,
			shellTop: 0,
			top: 0,
			wall: 0,
			cornerRadius: 0
		});
		const dims = shellDimsEarly;
		const keepOuts = [
			featureOfOps("k:ports", "port", "a port cutout", portCutOps),
			featureOfOps("k:vents", "vent", "a vent", [...ventCuts.shellCuts, ...toWorld(ventCuts.lidCuts)]),
			featureOfOps("k:bosses", "standoff", "a board boss", bossOps),
			...env.of("hinge", "latch", "brim", "ribbing", "magnet", "nameplate", "floor-grid", "other")
		].filter((k) => k.shapes.length > 0);
		return buildStackConnector(caseParams.stackConnector, {
			outerX: dims.outerX,
			outerY: dims.outerY,
			shellTop: dims.outerZ,
			top: connectorTop,
			wall: caseParams.wallThickness,
			cornerRadius: caseParams.cornerRadius,
			caseFit: caseParams.fit
		}, keepOuts);
	})();
	additive.push(...connector.shellAdd);
	cutoutOps.push(...connector.shellCut);
	const register = (() => {
		if (!stackRegisterWanted(caseParams.stackConnector)) return {
			ridge: null,
			groove: null
		};
		const dims = computeShellDims(board, caseParams, hats ?? [], resolveHat, display, resolveDisplay);
		const lidLocal = computeLidDims(board, caseParams, hats ?? [], resolveHat, display, resolveDisplay);
		const frame = {
			outerX: dims.outerX,
			outerY: dims.outerY,
			cornerRadius: caseParams.cornerRadius,
			wallThickness: caseParams.wallThickness,
			floorThickness: caseParams.floorThickness,
			lidTopZ: lidLocal.z
		};
		return {
			ridge: buildStackRidge(frame),
			groove: buildStackGroove(frame)
		};
	})();
	if (register.groove !== null) cutoutOps.push(register.groove);
	let shellOp = additive.length > 1 ? union$1(additive) : shellOuter;
	if (cutoutOps.length > 0) shellOp = difference([shellOp, ...cutoutOps]);
	const nodes = [{
		id: "shell",
		op: shellOp
	}];
	if (caseParams.stackConnector?.basePlate === true) {
		const dims = computeShellDims(board, caseParams, hats ?? [], resolveHat, display, resolveDisplay);
		const plate = buildStackBasePlate(caseParams.stackConnector, {
			outerX: dims.outerX,
			outerY: dims.outerY,
			wall: caseParams.wallThickness,
			cornerRadius: caseParams.cornerRadius,
			...caseParams.fit !== void 0 ? { caseFit: caseParams.fit } : {}
		});
		if (plate !== null) nodes.push(plate);
	}
	const splitPrinter = resolvePrinter(project);
	const shellBounds = splitPrinter ? aabbOfOp(shellOp) : null;
	let splitOffer;
	let splitJoint = null;
	if (shellBounds && splitPrinter) {
		const splitWidth = shellBounds.max[0] - shellBounds.min[0];
		const splitDepth = shellBounds.max[1] - shellBounds.min[1];
		const splitHeight = shellBounds.max[2] - shellBounds.min[2];
		const overBed = !rectFitsBed(splitWidth, splitDepth, splitPrinter.x, splitPrinter.y);
		if (splitHeight > splitPrinter.z) splitOffer = { state: "tooTall" };
		else if (overBed) {
			const keepOut = [
				...portCutOps,
				...ventCuts.shellCuts,
				...bossOps,
				...latchOps.caseAdditive,
				...hingeOps.caseAdditive,
				...hingeOps.subtractive,
				...latchOps.caseSubtract,
				...snapOps.shellAdd,
				...boardSnapOps.caseAdditive,
				...secondaryMountOps.caseAdditive,
				...featureOps.additive,
				...displayOps.additive,
				...displayOps.subtractive,
				...fanOps.additive,
				...fanOps.subtractive,
				...assetOps.unionOps,
				...magnetOps.shellAdd,
				...magnetOps.shellCut,
				...connector.shellAdd
			].map(aabbOfOp).filter((b) => b !== null);
			const request = {
				shellOp,
				bounds: shellBounds,
				printer: splitPrinter,
				keepOut
			};
			if (!canSplitShell(caseParams.seal?.enabled === true)) splitOffer = { state: "sealed" };
			else {
				const joint = planShellJoint(request);
				if (joint && caseParams.splitForPrint === true) splitJoint = joint;
				if (!joint) splitOffer = { state: "blocked" };
				else {
					const screwLabel = `${"M3"}×${8 * 2} socket cap`;
					splitOffer = {
						state: "available",
						pieces: joint.pieces.length,
						screws: joint.screwCount,
						screwLabel
					};
					if (caseParams.splitForPrint === true) {
						const split = buildShellSplit(request, joint);
						if (split) nodes.push(...split.nodes);
					}
				}
			}
		}
	}
	let lidOp = baseLidOp;
	if (register.ridge !== null) lidOp = union$1([lidOp, register.ridge]);
	const lidDims = computeLidDims(board, caseParams, hats ?? [], resolveHat, display, resolveDisplay);
	const lidUndersideWorldZ = lidDims.zPosition;
	const lidBossBottomZ = caseParams.floorThickness + board.defaultStandoffHeight + board.pcb.size.z + .3;
	const lidBossOps = buildLidBosses(bossPlacements, lidUndersideWorldZ, lidBossBottomZ);
	if (lidBossOps.length > 0) {
		const lidBossOpsLocal = lidBossOps.map((op) => translate([
			0,
			0,
			-lidDims.zPosition
		], op));
		lidOp = union$1([lidOp, ...lidBossOpsLocal]);
	}
	if (snapOps.lidAdd.length > 0) lidOp = union$1([lidOp, ...snapOps.lidAdd]);
	if (hingeOps.lidAdditive.length > 0) lidOp = union$1([lidOp, ...hingeOps.lidAdditive]);
	if (latchOps.lidAdditive.length > 0) {
		const lidLatchPartsLocal = latchOps.lidAdditive.map((op) => translate([
			0,
			0,
			-lidDims.zPosition
		], op));
		lidOp = union$1([lidOp, ...lidLatchPartsLocal]);
	}
	const sealTongue = buildSealTongue(board, caseParams, hats ?? [], resolveHat, display, resolveDisplay);
	if (sealTongue) {
		const tongueLocal = translate([
			0,
			0,
			-lidDims.zPosition
		], sealTongue);
		lidOp = union$1([lidOp, tongueLocal]);
	}
	if (ruggedOps.lidAdditive.length > 0) lidOp = union$1([lidOp, ...ruggedOps.lidAdditive]);
	if (flangeOps.lidAdditive) lidOp = union$1([lidOp, flangeOps.lidAdditive]);
	if (ventCuts.lidCuts.length > 0) lidOp = difference([lidOp, ...ventCuts.lidCuts]);
	if (textOps.lidAdditive.length > 0) lidOp = union$1([lidOp, ...textOps.lidAdditive]);
	if (textOps.lidSubtractive.length > 0) lidOp = difference([lidOp, ...textOps.lidSubtractive]);
	if (magnetOps.lidAdd.length > 0) lidOp = union$1([lidOp, ...magnetOps.lidAdd]);
	if (magnetOps.lidCut.length > 0) lidOp = difference([lidOp, ...magnetOps.lidCut]);
	if (flangeOps.lidSubtract) lidOp = difference([lidOp, flangeOps.lidSubtract]);
	if (connector.lidAdd.length > 0) {
		const toLid = (op) => translate([
			0,
			0,
			-lidDims.zPosition
		], op);
		lidOp = difference([union$1([lidOp, ...connector.lidAdd.map(toLid)]), ...connector.lidCut.map(toLid)]);
	}
	nodes.push({
		id: "lid",
		op: translate([
			0,
			0,
			lidDims.zPosition
		], lidOp)
	});
	let lidSplitOffer;
	if (splitPrinter) {
		const lidLocalBounds = aabbOfOp(lidOp);
		if (lidLocalBounds) {
			const lidW = lidLocalBounds.max[0] - lidLocalBounds.min[0];
			const lidD = lidLocalBounds.max[1] - lidLocalBounds.min[1];
			const lidHgt = lidLocalBounds.max[2] - lidLocalBounds.min[2];
			const lidKeepOut = [
				...snapOps.lidAdd,
				...hingeOps.lidAdditive,
				...latchOps.lidAdditive.map((op) => translate([
					0,
					0,
					-lidDims.zPosition
				], op)),
				...lidBossOps.map((op) => translate([
					0,
					0,
					-lidDims.zPosition
				], op))
			].map(aabbOfOp).filter((b) => b !== null);
			if (lidHgt > splitPrinter.z) lidSplitOffer = { state: "tooTall" };
			else if (!rectFitsBed(lidW, lidD, splitPrinter.x, splitPrinter.y)) {
				const request = {
					lidOp,
					bounds: lidLocalBounds,
					printer: splitPrinter,
					side: lidJointSide(caseParams),
					cavityHeightMm: lidCavityHeight(caseParams),
					keepOut: lidKeepOut
				};
				if (!canSplitLid(caseParams.seal?.enabled === true)) lidSplitOffer = { state: "sealed" };
				else {
					const joint = planLidJoint(request);
					if (!joint) lidSplitOffer = { state: "blocked" };
					else {
						lidSplitOffer = {
							state: "available",
							pieces: joint.pieces.length,
							screws: joint.screwCount,
							screwLabel: `${"M3"}×${8 * 2} socket cap`
						};
						if (caseParams.splitForPrint === true) {
							const split = buildLidSplit(request, joint);
							if (split !== null) for (const n of split.nodes) nodes.push({
								...n,
								op: translate([
									0,
									0,
									lidDims.zPosition
								], n.op)
							});
						}
					}
				}
			}
		}
	}
	if (hingeOps.pinNode) nodes.push({
		id: "hinge-pin",
		op: hingeOps.pinNode
	});
	if (magnetOps.nameplate) nodes.push(magnetOps.nameplate);
	const gasketBody = buildGasketBody(board, caseParams, hats ?? [], resolveHat, display, resolveDisplay);
	if (gasketBody) nodes.push({
		id: "gasket",
		op: gasketBody,
		material: { separateFile: true }
	});
	for (const arm of latchOps.armNodes) nodes.push(arm);
	for (const pin of latchOps.pinNodes) nodes.push(pin);
	for (const b of ruggedOps.bumperNodes) nodes.push(b);
	nodes.push(...connector.keyNodes);
	for (const d of dividerOps.nodes) nodes.push(d);
	const statements = [];
	if (magnetsOn) {
		const sideEnv = env.of("board", "standoff", "latch", "hinge", "lid");
		statements.push(...magnetClashStatements({
			facts: magnetOps.facts,
			lidZ,
			faceExtent: (face) => faceSizeForProject(project, face),
			origin: (source) => {
				if (source === "nameplate") return caseParams.nameplate ? [caseParams.nameplate.u, caseParams.nameplate.v] : null;
				const m = (caseParams.magnetPockets ?? []).find((x) => x.id === source);
				return m ? [m.u, m.v] : null;
			},
			shellEnv: sideEnv,
			lidEnv: env.of("board", "standoff", "latch", "hinge"),
			ports: env.of("port")
		}));
	}
	if (dividersOn) {
		const seams = splitJoint && shellBounds ? splitJoint.seams.map((seam) => {
			const b = shellBounds;
			const lo = [
				b.min[0],
				b.min[1],
				b.min[2]
			];
			const hi = [
				b.max[0],
				b.max[1],
				b.max[2]
			];
			lo[seam.axis] = seam.at - .5;
			hi[seam.axis] = seam.at + .5;
			const name = seam.axis === 0 ? "X" : "Y";
			return featureOfOps(`seam:${seam.axis}:${seam.at}`, "seam", `the split-for-print seam at ${name} ${Math.round(seam.at * 10) / 10} mm`, [translate(lo, cube([
				hi[0] - lo[0],
				hi[1] - lo[1],
				hi[2] - lo[2]
			]))]);
		}) : [];
		statements.push(...dividerClashStatements(project, [...env.of("lid-lip", "vent", "hat"), ...seams]));
	}
	return {
		nodes,
		placementReport: validatePlacements(project),
		smartCutoutDecisions: smartLayout.decisions,
		splitOffer,
		...connector.report ? { connector: connector.report } : {},
		...statements.length > 0 ? { clashes: { statements } } : {},
		lidSplitOffer,
		...deliberateVoids.length > 0 ? { deliberateVoids } : {}
	};
}

// vendor/casemaker/casemaker-app/src/workers/geometry/evaluateOp.ts
const JOIN_TYPE = {
	round: "Round",
	miter: "Miter",
	square: "Square"
};
/**
* Evaluate a 2D profile to a Clipper2-backed CrossSection. Intermediates are
* released as we go — CrossSection lives on the wasm heap just like Manifold.
*/
function executeProfile(tl, p) {
	const CS = tl.CrossSection;
	switch (p.kind) {
		case "p-poly": return CS.ofPolygons(p.contours, p.fillRule ?? "EvenOdd");
		case "p-rect": return CS.square(p.size, p.center ?? false);
		case "p-circle": return CS.circle(p.radius, p.segments ?? segmentsForRadius(p.radius));
		case "p-union":
		case "p-difference":
		case "p-intersection":
		case "p-hull": {
			const kids = p.children.map((c) => executeProfile(tl, c));
			let result;
			if (p.kind === "p-union") result = CS.union(kids);
			else if (p.kind === "p-difference") result = CS.difference(kids);
			else if (p.kind === "p-intersection") result = CS.intersection(kids);
			else result = CS.hull(kids);
			kids.forEach((k) => k.delete());
			return result;
		}
		case "p-offset": {
			const child = executeProfile(tl, p.child);
			const join = p.join ?? "round";
			const arcSegments = p.segments ?? (join === "round" ? segmentsForRadius(Math.abs(p.delta)) : 0);
			const result = child.offset(p.delta, JOIN_TYPE[join], p.miterLimit ?? 2, arcSegments);
			child.delete();
			return result;
		}
		case "p-translate": {
			const child = executeProfile(tl, p.child);
			const result = child.translate(p.offset);
			child.delete();
			return result;
		}
		case "p-rotate": {
			const child = executeProfile(tl, p.child);
			const result = child.rotate(p.degrees);
			child.delete();
			return result;
		}
		case "p-scale": {
			const child = executeProfile(tl, p.child);
			const result = child.scale(p.scale);
			child.delete();
			return result;
		}
		case "p-mirror": {
			const child = executeProfile(tl, p.child);
			const result = child.mirror(p.normal);
			child.delete();
			return result;
		}
	}
}
/**
* Async entry point kept for the worker's call signature. The evaluation is
* synchronous — `check()` is polled between steps, and awaiting between ops
* never let the worker receive a cancellation message anyway (that needs a
* macrotask), so there is nothing to yield to.
*/
async function executeOp(tl, op, check = () => {}) {
	return executeOpSync(tl, op, check);
}
function executeOpSync(tl, op, check = () => {}) {
	check();
	const Manifold = tl.Manifold;
	switch (op.kind) {
		case "cube": return Manifold.cube(op.size, op.center ?? false);
		case "cylinder": return Manifold.cylinder(op.height, op.radiusLow, op.radiusHigh ?? op.radiusLow, op.segments ?? 0, op.center ?? false);
		case "mesh": {
			for (let i = 0; i < op.positions.length; i++) if (!Number.isFinite(op.positions[i])) throw new Error(`cam: non-finite coordinate in a mesh build op at vertex ${Math.floor(i / 3)}`);
			const dedup = deduplicateMesh(op.positions, op.indices);
			return new Manifold(new tl.Mesh({
				numProp: 3,
				vertProperties: dedup.positions,
				triVerts: dedup.indices
			}));
		}
		case "translate": {
			const child = executeOpSync(tl, op.child, check);
			const result = child.translate(op.offset);
			child.delete();
			return result;
		}
		case "rotate": {
			const child = executeOpSync(tl, op.child, check);
			const result = child.rotate(op.degrees);
			child.delete();
			return result;
		}
		case "scale": {
			const child = executeOpSync(tl, op.child, check);
			const result = child.scale([
				op.factor,
				op.factor,
				op.factor
			]);
			child.delete();
			return result;
		}
		case "extrude": {
			const cs = executeProfile(tl, op.profile);
			const s = op.scaleTop ?? 1;
			const scaleTop = typeof s === "number" ? [s, s] : [s[0], s[1]];
			const result = Manifold.extrude(cs, op.height, op.divisions ?? 0, op.twistDegrees ?? 0, scaleTop, op.center ?? false);
			cs.delete();
			return result;
		}
		case "revolve": {
			const cs = executeProfile(tl, op.profile);
			const result = Manifold.revolve(cs, op.segments ?? 0, op.degrees ?? 360);
			cs.delete();
			return result;
		}
		case "union":
		case "difference":
		case "intersection":
		case "hull": {
			const children = [];
			for (const c of op.children) children.push(executeOpSync(tl, c, check));
			check();
			let result;
			if (op.kind === "union") result = Manifold.union(children);
			else if (op.kind === "difference") result = Manifold.difference(children);
			else if (op.kind === "intersection") result = Manifold.intersection(children);
			else result = Manifold.hull(children);
			children.forEach((c) => c.delete());
			return result;
		}
	}
}
const DEDUP_PRECISION = 1e5;
/**
* Weld coincident vertices in a hand-built mesh. Manifold rejects a mesh whose
* shared edges do not reference identical vertex indices, and generated
* triangle soup routinely emits the same corner more than once.
*/
function deduplicateMesh(positions, indices) {
	const map = /* @__PURE__ */ new Map();
	const newPos = [];
	const newIdx = new Uint32Array(indices.length);
	for (let i = 0; i < indices.length; i++) {
		const v = indices[i];
		const x = Math.round(positions[v * 3] * DEDUP_PRECISION) / DEDUP_PRECISION;
		const y = Math.round(positions[v * 3 + 1] * DEDUP_PRECISION) / DEDUP_PRECISION;
		const z = Math.round(positions[v * 3 + 2] * DEDUP_PRECISION) / DEDUP_PRECISION;
		const key = `${x},${y},${z}`;
		let id = map.get(key);
		if (id === void 0) {
			id = newPos.length / 3;
			newPos.push(x, y, z);
			map.set(key, id);
		}
		newIdx[i] = id;
	}
	return {
		positions: new Float32Array(newPos),
		indices: newIdx
	};
}

export { compileProject, computeShellDims, cube, cylinder, defaultSnapCatchesForCase, difference, executeOp, rotate, translate };