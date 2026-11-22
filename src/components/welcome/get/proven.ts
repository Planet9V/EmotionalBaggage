import type { MarketData } from "../storyData";

/** How far a kind of proof row has got: "0 of 37 verified", "0 of 5 passing", "8 written". */
export const GET_PROVEN = (p: MarketData["positioning"]["pool"][number]) => (p.label === "Requirements" ? `${p.count} written` : `${p.proven} of ${p.count} ${p.label === "Claims" ? "verified" : "passing"}`);
