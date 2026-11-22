// Two jobs (as in the trial):
// 1. Proves migrations/0030_better_auth.sql holds everything Better Auth needs for the configuration in
//    src/lib/auth2/auth.ts: against the migrated test database its own planner finds nothing to create or add. After
//    a library upgrade or a new plugin this fails and names the table or column; the difference is the next migration.
// 2. With AUTH2_SCHEMA_DB set to an EMPTY database and AUTH2_SCHEMA_OUT to a file, writes the SQL Better Auth would
//    run there. That is how the migration file was made; its CLI was not used.
import { writeFileSync } from "node:fs";
import { Pool } from "pg";
import { expect, test } from "vitest";
import { getMigrations } from "better-auth/db/migration";
import { auth2Options } from "@/lib/auth2/auth";

const planFor = (db: Pool) => getMigrations(auth2Options(db, { secret: "s".repeat(40), baseURL: "http://localhost:3322" }).options, { throwOnUnsafe: false });

test("the migration file covers Better Auth's whole schema for this configuration", async () => {
  const { ownerPool, ready } = await import("@/lib/db");
  await ready();
  const plan = await planFor(ownerPool());
  expect(plan.toBeCreated.map((t) => t.table)).toEqual([]);
  expect(plan.toBeAdded.map((t) => `${t.table}: ${Object.keys(t.fields).join(", ")}`)).toEqual([]);
  expect(plan.toBeAddedIndexes.map((i) => i.name)).toEqual([]);
  expect(plan.schemaProblems).toEqual([]);
});

test.skipIf(!process.env.AUTH2_SCHEMA_DB)("writes the SQL for an empty database", async () => {
  const db = new Pool({ connectionString: process.env.AUTH2_SCHEMA_DB });
  try {
    const sql = await (await planFor(db)).compileMigrations();
    writeFileSync(process.env.AUTH2_SCHEMA_OUT ?? "/tmp/auth2-schema.sql", sql);
    expect(sql).toContain("create table");
  } finally {
    await db.end();
  }
});
