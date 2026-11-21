// The enclosure's own vocabulary is a set of roles, derived from the one list of part kinds by a mapping.
import { describe, expect, it } from "vitest";
import { PART_KIND_IDS } from "@/lib/parts/kinds";
import { ENCLOSURE_ROLE_OF_KIND } from "@/lib/enclosure/spec";
import { ENCLOSURE_ROLES, OPENING_ROLES } from "@/lib/enclosure/types";
import { PIN_ROLES } from "@/lib/ai/drafts/generators/design";

describe("enclosure roles", () => {
  it("maps only kinds in the shared list, to roles in the enclosure's list", () => {
    for (const [kind, role] of Object.entries(ENCLOSURE_ROLE_OF_KIND)) {
      expect(PART_KIND_IDS, kind).toContain(kind);
      expect(ENCLOSURE_ROLES, `${kind} -> ${role}`).toContain(role);
    }
  });
  it("gives a role to every kind the enclosure can use, and every opening role has a kind or a words rule", () => {
    for (const r of OPENING_ROLES) expect(ENCLOSURE_ROLES).toContain(r);
    for (const r of ["speaker", "display", "button", "switch", "led", "connector", "sensor", "microphone"]) expect(ENCLOSURE_ROLE_OF_KIND[r]).toBe(r);
  });
});

describe("pin roles asked of a model", () => {
  it("are the pin kind labels in lower case, as they always were", () => {
    expect(PIN_ROLES).toEqual(["power in", "power out", "ground", "input", "output", "bidirectional", "passive", "not connected"]);
  });
});
