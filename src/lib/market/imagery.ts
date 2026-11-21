// The shots a listing and ads need (plan 8.7). A fixed starting list: nothing here is generated.
// "render" marks the shots the 3D model can supply; the rest are photographs the user takes.
// No stock or generated photos of people.
export type ShotTemplate = {
  key: string;
  title: string;
  purpose: string;
  usedIn: string[];
  render: boolean;
};

export const SHOTS: ShotTemplate[] = [
  { key: "hero-white", title: "Hero on white", purpose: "The product alone on a plain white background, filling most of the frame. The first image anyone sees.", usedIn: ["Listing main image", "Landing page", "Search ads"], render: true },
  { key: "in-use", title: "In use", purpose: "Someone using it the way a buyer would, so the job it does is clear without reading.", usedIn: ["Listing", "Landing page", "Social ads"], render: false },
  { key: "scale", title: "Scale", purpose: "Its size against a hand or an everyday object, with the dimensions stated.", usedIn: ["Listing", "Landing page"], render: false },
  { key: "detail", title: "Detail", purpose: "A close view of the part buyers ask about: a button, a port, a finish.", usedIn: ["Listing", "Landing page"], render: true },
  { key: "packaging", title: "Packaging", purpose: "The box and what is inside it, laid out as the buyer will open it.", usedIn: ["Listing", "Unboxing posts"], render: false },
  { key: "lifestyle", title: "Lifestyle", purpose: "The product in a setting like the buyer's own. Photographed, not stock and not generated.", usedIn: ["Social ads", "Landing page"], render: false },
  { key: "infographic", title: "Infographic", purpose: "Three or four features called out over a clean image, with the numbers that matter.", usedIn: ["Listing", "Social ads"], render: true },
];

export const shotByKey = (key: string) => SHOTS.find((s) => s.key === key);
