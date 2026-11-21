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
//   Bambu serial number: https://wiki.bambulab.com/en/general/find-sn (15 or 18 characters; Bambu Studio, the printer screen or the
//              QR code) and the community notes https://github.com/Doridian/OpenBambuAPI (the topic is device/<serial>/report).
//   PrusaLink  https://www.home-assistant.io/integrations/prusalink (Settings, Network, PrusaLink; the user name may be fixed to maker;
//              the password entry may be called API key); an API key alone is accepted for the X-Api-Key header.
//   Creality, Elegoo: no Moonraker documentation from either maker was found. Their Klipper machines are driven through the
//              Moonraker adapter and labelled experimental; the model list (src/lib/printers/models.ts) says which models.
//
// The field named "address" is stored in the printers.address column; every other field is kept in printers.access.

type PrinterFieldKind = "url" | "host" | "text";

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
  /** supported: an adapter exists (built to the maker's documentation, checked against a stand-in, not yet on a real printer).
   *  planned: can be saved, cannot be tested or driven yet. */
  status: "supported" | "planned";
  /** built on documentation the maker did not publish for this use; shown with an "experimental" label */
  experimental?: boolean;
  /** a sentence shown on screen next to the form, when something the person should know applies to the connection */
  notice?: string;
  fields: PrinterField[];
  /** what must be switched on at the printer for this app to reach it */
  atPrinter: string;
  /** where the field list came from */
  source: string;
};

/** Names ending in .local (mDNS, such as octopi.local) do not resolve inside the app's container, so the form asks for the IP address. */
const MDNS_HINT = "Use the printer's IP address: names ending in .local do not resolve inside the app's container.";

const address = (hint: string): PrinterField => ({ name: "address", label: "Address", secret: false, required: true, kind: "url", hint: `${hint}. ${MDNS_HINT}` });

export const PRINTER_FAMILIES: PrinterFamily[] = [
  {
    id: "octoprint",
    label: "OctoPrint",
    status: "supported",
    experimental: false,
    fields: [
      address("For example http://192.168.1.40"),
      { name: "apiKey", label: "API key", secret: true, required: true, kind: "text", hint: "Made in OctoPrint under Settings, Application Keys or API." },
    ],
    atPrinter: "OctoPrint running and reachable from this machine, with an API key made for this app.",
    source: "https://docs.octoprint.org/en/main/api/general.html",
  },
  {
    id: "moonraker",
    label: "Klipper (Moonraker)",
    status: "supported",
    experimental: false,
    fields: [
      address("For example http://192.168.1.41:7125"),
      { name: "apiKey", label: "API key", secret: true, required: false, kind: "text", hint: "Only if Moonraker is set to require one." },
    ],
    atPrinter: "Moonraker reachable from this machine. If its authorization is on, this machine's address must be trusted or an API key given.",
    source: "https://moonraker.readthedocs.io/en/latest/external_api/authorization/",
  },
  {
    id: "prusalink",
    label: "Prusa (PrusaLink)",
    status: "supported",
    experimental: false,
    fields: [
      address("For example http://192.168.1.50"),
      { name: "username", label: "User name", secret: false, required: false, kind: "text", hint: "Leave empty if the printer does not show one: it is then maker." },
      { name: "password", label: "Password", secret: true, required: false, kind: "text", hint: "Settings, Network, PrusaLink on the printer. On some models it is called API key." },
      { name: "apiKey", label: "API key (older PrusaLink)", secret: true, required: false, kind: "text", hint: "Only if you have an API key and no password: sent in the X-Api-Key header." },
    ],
    atPrinter: "PrusaLink on at the printer (Settings, Network, PrusaLink). Current firmware signs in with HTTP digest: the password shown there and the user name if one is shown (it is fixed to maker on some models). The v1 interface needs firmware 4.7.0 or later, and 5.1.0 or later on the MINI.",
    source: "https://github.com/prusa3d/Prusa-Link-Web/blob/master/spec/openapi.yaml",
  },
  {
    id: "duet",
    label: "Duet (RepRapFirmware)",
    status: "supported",
    experimental: false,
    fields: [
      address("For example http://192.168.1.42"),
      { name: "password", label: "Machine password", secret: true, required: false, kind: "text", hint: "Only if a machine password is set; RepRapFirmware uses \"reprap\" when none is sent." },
    ],
    atPrinter: "The Duet's network and web server switched on. Standalone boards and boards with a single-board computer (SBC) answer different interfaces; the app asks the board which it is.",
    source: "https://github.com/Duet3D/RepRapFirmware/wiki/HTTP-requests",
  },
  {
    id: "bambu",
    label: "Bambu Lab",
    status: "supported",
    experimental: false,
    notice:
      "The printer's certificate is self-signed by Bambu, so for this one connection to the printer on your local network the certificate check is skipped. Nothing else in the app does that. Anyone on the same network who could answer as the printer could read the access code.",
    fields: [
      { name: "address", label: "Printer IP address", secret: false, required: true, kind: "host", hint: `On the same local network as this machine. ${MDNS_HINT}` },
      { name: "accessCode", label: "Access code", secret: true, required: true, kind: "text", hint: "Shown on the printer once LAN Only mode is on." },
      { name: "serial", label: "Serial number", secret: false, required: true, kind: "text", hint: "15 or 18 characters: Bambu Studio under Device, Update, or the printer screen." },
    ],
    atPrinter:
      "LAN Only mode and Developer Mode switched on at the printer. Developer Mode opens the MQTT channel, live stream and FTP, and stops the printer using Bambu Cloud. Without Developer Mode, current firmware wants Bambu Connect for control, so this app can only try to read status. X1 series needs a microSD card to start a print from the network.",
    source: "https://wiki.bambulab.com/en/knowledge-sharing/enable-developer-mode",
  },
  {
    id: "creality",
    label: "Creality (experimental)",
    status: "supported",
    experimental: true,
    fields: [
      address("For example http://192.168.1.60:7125"),
      { name: "apiKey", label: "API key", secret: true, required: false, kind: "text", hint: "Only if Moonraker is set to require one." },
    ],
    atPrinter:
      "Experimental. Only the Klipper machines (the K1 series in the model list) can be reached, and only if their Moonraker answers on your network, usually on port 7125. Creality does not document that. Press Test: if nothing answers, use File only.",
    source: "https://github.com/CrealityOfficial/K1_Series_Klipper",
  },
  {
    id: "elegoo",
    label: "Elegoo (experimental)",
    status: "supported",
    experimental: true,
    fields: [
      address("For example http://192.168.1.61:7125"),
      { name: "apiKey", label: "API key", secret: true, required: false, kind: "text", hint: "Only if Moonraker is set to require one." },
    ],
    atPrinter:
      "Experimental. Only the Neptune 4 series, which Elegoo says runs a customized Klipper, can be reached, and only if its Moonraker answers on your network, usually on port 7125. Elegoo does not document that. The Centauri models are File only: no local interface from Elegoo was found.",
    source: "https://wiki.elegoo.com/neptune/neptune-4-series-mcu-rpi-shutdown-force-shutdown-command",
  },
  {
    id: "file-only",
    label: "File only (print by hand)",
    status: "supported",
    experimental: false,
    fields: [],
    atPrinter: "Nothing. You download the file and start the print yourself.",
    source: "this app",
  },
];

export const FAMILY_IDS = PRINTER_FAMILIES.map((f) => f.id);

export function printerFamily(id: string): PrinterFamily | undefined {
  return PRINTER_FAMILIES.find((f) => f.id === id);
}
