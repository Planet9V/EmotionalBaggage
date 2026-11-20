// Printer families Admin can add (decisions D4, D14). Each family names the fields its `access` object takes,
// what must be switched on at the printer, and whether a working connection test exists.
//
// Field lists come from each maker's own documentation, read 20 Nov 2026:
//   OctoPrint  https://docs.octoprint.org/en/main/api/general.html (key in X-Api-Key) and .../api/version.html
//   Moonraker  https://moonraker.readthedocs.io/en/latest/external_api/authorization/ (optional X-Api-Key)
//              https://moonraker.readthedocs.io/en/latest/external_api/printer/ (GET /printer/info)
//   PrusaLink  https://github.com/prusa3d/Prusa-Link-Web/blob/master/spec/openapi.yaml
//              (securitySchemes: digestAuth, type http, scheme digest: a user name and a password)
//   Duet       https://github.com/Duet3D/RepRapFirmware/wiki/HTTP-requests
//              (rr_connect takes an optional password, "defaults to reprap"; with no machine password set a session
//               is created on any request)
//   Bambu Lab  https://wiki.bambulab.com/en/knowledge-sharing/enable-lan-mode (LAN Only mode shows an Access Code
//              on the printer) and https://wiki.bambulab.com/en/knowledge-sharing/enable-developer-mode (Developer
//              Mode opens the MQTT channel, live stream and FTP). Neither page names a serial number, port or protocol
//              detail, so none is listed here.
//   Creality, Elegoo: no protocol documentation from the maker was found, so their field lists are empty.
//
// The field named "address" is stored in the printers.address column; every other field is kept in printers.access.

export type PrinterFieldKind = "url" | "host" | "text";

export type PrinterField = {
  name: string;
  label: string;
  secret: boolean;
  required: boolean;
  /** url: an http or https address; host: a host name or IP address; text: anything */
  kind: PrinterFieldKind;
  /** a short hint for the form */
  hint?: string;
};

export type PrinterFamily = {
  id: string;
  label: string;
  /** supported: a working connection test exists. planned: can be saved, cannot be tested or driven yet. */
  status: "supported" | "planned";
  fields: PrinterField[];
  /** what must be switched on at the printer for this app to reach it */
  atPrinter: string;
  /** where the field list came from */
  source: string;
};

const address = (hint: string): PrinterField => ({ name: "address", label: "Address", secret: false, required: true, kind: "url", hint });

export const PRINTER_FAMILIES: PrinterFamily[] = [
  {
    id: "octoprint",
    label: "OctoPrint",
    status: "supported",
    fields: [
      address("For example http://octopi.local"),
      { name: "apiKey", label: "API key", secret: true, required: true, kind: "text", hint: "Made in OctoPrint under Settings, Application Keys or API." },
    ],
    atPrinter: "OctoPrint running and reachable from this machine, with an API key made for this app.",
    source: "https://docs.octoprint.org/en/main/api/general.html",
  },
  {
    id: "moonraker",
    label: "Klipper (Moonraker)",
    status: "supported",
    fields: [
      address("For example http://mainsailos.local:7125"),
      { name: "apiKey", label: "API key", secret: true, required: false, kind: "text", hint: "Only if Moonraker is set to require one." },
    ],
    atPrinter: "Moonraker reachable from this machine. If its authorization is on, this machine's address must be trusted or an API key given.",
    source: "https://moonraker.readthedocs.io/en/latest/external_api/authorization/",
  },
  {
    id: "prusalink",
    label: "Prusa (PrusaLink)",
    status: "planned",
    fields: [
      address("For example http://192.168.1.50"),
      { name: "username", label: "User name", secret: false, required: true, kind: "text" },
      { name: "password", label: "Password", secret: true, required: true, kind: "text" },
    ],
    atPrinter: "PrusaLink switched on at the printer. It signs in with HTTP digest authentication: a user name and a password.",
    source: "https://github.com/prusa3d/Prusa-Link-Web/blob/master/spec/openapi.yaml",
  },
  {
    id: "duet",
    label: "Duet (RepRapFirmware)",
    status: "planned",
    fields: [
      address("For example http://duet.local"),
      { name: "password", label: "Machine password", secret: true, required: false, kind: "text", hint: "Only if a machine password is set; RepRapFirmware uses \"reprap\" when none is sent." },
    ],
    atPrinter: "The Duet's network and web server switched on.",
    source: "https://github.com/Duet3D/RepRapFirmware/wiki/HTTP-requests",
  },
  {
    id: "bambu",
    label: "Bambu Lab",
    status: "planned",
    fields: [
      { name: "address", label: "Printer IP address", secret: false, required: true, kind: "host", hint: "On the same local network as this machine." },
      { name: "accessCode", label: "Access code", secret: true, required: true, kind: "text", hint: "Shown on the printer once LAN Only mode is on." },
    ],
    atPrinter: "LAN Only mode and Developer Mode switched on at the printer. Developer Mode opens the MQTT channel, live stream and FTP, and stops the printer using Bambu Cloud.",
    source: "https://wiki.bambulab.com/en/knowledge-sharing/enable-developer-mode",
  },
  {
    id: "creality",
    label: "Creality",
    status: "planned",
    fields: [],
    atPrinter: "Not known yet: no connection documentation from Creality was found. Use file-only for now.",
    source: "none found",
  },
  {
    id: "elegoo",
    label: "Elegoo",
    status: "planned",
    fields: [],
    atPrinter: "Not known yet: no connection documentation from Elegoo was found. Use file-only for now.",
    source: "none found",
  },
  {
    id: "file-only",
    label: "File only (print by hand)",
    status: "supported",
    fields: [],
    atPrinter: "Nothing. You download the file and start the print yourself.",
    source: "this app",
  },
];

export const FAMILY_IDS = PRINTER_FAMILIES.map((f) => f.id);

export function printerFamily(id: string): PrinterFamily | undefined {
  return PRINTER_FAMILIES.find((f) => f.id === id);
}
