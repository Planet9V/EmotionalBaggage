#!/usr/bin/env node
// Turns the new sign-in (accounts, workspaces, two-step sign-in) on or off, or says whether it is on. For the first
// switch-over, when nobody is the platform administrator yet, so Admin cannot do it:
//
//   docker compose exec web node scripts/sign-in.mjs on        (and: off, status)
//
// It connects with the database connection the app itself uses (DATABASE_URL, which docker-compose.yml supplies to the
// container; the owner's connection, not the request role's), writes the stored switch in auth2_settings, records it
// in the audit log, and says what happens next. Nothing else is needed: the running app reads the switch within a few
// seconds, without a restart. Afterwards the platform administrator turns it off or on in Admin, Sign-in.
import pg from "pg";

const usage = "Use: node scripts/sign-in.mjs on | off | status";
const cmd = (process.argv[2] ?? "").toLowerCase();
if (!["on", "off", "status"].includes(cmd)) {
  console.error(usage);
  process.exit(2);
}
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Run this inside the app's container, where it is: docker compose exec web node scripts/sign-in.mjs " + cmd);
  process.exit(2);
}

const client = new pg.Client({ connectionString: url });
try {
  await client.connect();
  const table = await client.query("SELECT to_regclass('auth2_settings') IS NOT NULL AS ok");
  if (!table.rows[0].ok) {
    console.error("The database is not up to date yet (no auth2_settings table). Start the app once, so it brings the database up to date, then run this again.");
    process.exit(1);
  }
  const read = async () => (await client.query("SELECT value FROM auth2_settings WHERE key = 'auth2.enabled'")).rows[0]?.value === true;
  if (cmd === "status") {
    console.log(`The new sign-in is ${(await read()) ? "on" : "off"}.`);
    if (process.env.AUTH2) console.log(`Note: AUTH2=${process.env.AUTH2} is set in this environment; if the app has it too, it overrides the stored switch.`);
    process.exit(0);
  }
  const on = cmd === "on";
  await client.query("BEGIN");
  await client.query(
    `INSERT INTO auth2_settings (key, value, updated_at, updated_by) VALUES ('auth2.enabled', $1, now(), 'command line')
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now(), updated_by = EXCLUDED.updated_by`,
    [JSON.stringify(on)]
  );
  await client.query(
    "INSERT INTO audit_log (actor, action, summary, detail) VALUES ('', 'auth2.switch', $1, $2)",
    [`Turned the new sign-in ${on ? "on" : "off"} from the command line (scripts/sign-in.mjs)`, JSON.stringify({ enabled: on })]
  );
  // Turning it on ends every session of the old sign-in (cut-over review F3), so turning it off later does not
  // bring them back: people sign in the old way again.
  const ended = on ? (await client.query("DELETE FROM sessions")).rowCount ?? 0 : 0;
  await client.query("COMMIT");
  if (!on) {
    console.log("The new sign-in is off. Within a few seconds the app signs in the old way again. Accounts and workspaces are kept.");
    console.log("The old shared sign-in is back, including demo / demo on a public site if its password was never changed. Everyone signs in again.");
    process.exit(0);
  }
  console.log(`Ended ${ended} session${ended === 1 ? "" : "s"} of the old sign-in.`);
  const owner = await client.query(`SELECT EXISTS (SELECT 1 FROM "user" WHERE "platformAdmin") AS has`);
  console.log("The new sign-in is on. Within a few seconds every page asks for an account; the old shared sign-in stops working.");
  if (owner.rows[0].has) {
    console.log("A platform administrator exists: sign in at /auth/sign-in.");
  } else {
    console.log("Next: open the app in a browser. It asks you to create the owner (the platform administrator).");
    console.log("It also asks for a one-time set-up code. The app prints it to its log when that page is first opened:");
    console.log("  docker compose logs web | grep 'set-up code'");
  }
  process.exit(0);
} catch (e) {
  await client.query("ROLLBACK").catch(() => undefined);
  console.error(`The switch could not be changed: ${e.message}`);
  process.exit(1);
} finally {
  await client.end().catch(() => undefined);
}
