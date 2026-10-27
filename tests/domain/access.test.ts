import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { blank, today } from "../../src/lib/finance.ts";
import { workspaceOf, loginEmail } from "../../src/lib/access.ts";
test("solo admite los dos nombres de acceso y claims administrativas válidas", () => {
  assert.equal(loginEmail(" ZAYRIS "), "zayris@finanzas-zay.invalid");
  assert.equal(loginEmail("uriel"), "uriel@finanzas-zay.invalid");
  assert.throws(() => loginEmail("otro"));
  assert.equal(
    workspaceOf({
      app_metadata: {
        zay_access: false,
        zay_workspace: "00000000-0000-4000-8000-000000000001",
      },
    }),
    null,
  );
  assert.equal(
    workspaceOf({
      app_metadata: { zay_access: true, zay_workspace: "incorrecto" },
    }),
    null,
  );
});
test("dos usuarios autorizados comparten cuenta, otros usuarios y anon quedan fuera", async () => {
  const db = new PGlite();
  const ids = [1, 2, 3].map((n) => "00000000-0000-4000-8000-00000000000" + n);
  try {
    await db.exec(
      `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)$$;grant usage on schema auth to authenticated,anon;`,
    );
    for (const id of ids)
      await db.query("insert into auth.users values($1)", [id]);
    await db.exec(
      await readFile("supabase/migrations/202610270001_zay.sql", "utf8"),
    );
    await db.exec(
      await readFile(
        "supabase/migrations/202610270002_shared_private_access.sql",
        "utf8",
      ),
    );
    await db.exec("set role authenticated");
    const session = async (index: number, allowed: boolean) =>
      db.query(
        `select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)`,
        [
          ids[index],
          JSON.stringify({
            sub: ids[index],
            app_metadata: allowed
              ? { zay_access: true, zay_workspace: ids[0] }
              : {},
            user_metadata: { zay_access: true, zay_workspace: ids[0] },
          }),
        ],
      );
    const save = (s: unknown, revision: number) =>
      db.query("select public.zay_save_account($1::jsonb,$2::bigint)", [
        JSON.stringify(s),
        revision,
      ]);
    const state = blank("Zayris", 100000, today());
    await session(0, true);
    await save(state, 0);
    await session(1, true);
    const read = await db.query<{ user_id: string; state: typeof state }>(
      "select user_id,state from public.zay_accounts",
    );
    assert.equal(read.rows.length, 1);
    assert.equal(read.rows[0].user_id, ids[0]);
    assert.equal(read.rows[0].state.opening, 100000);
    state.name = "Zayris compartido";
    await save(state, 1);
    await assert.rejects(() => save(state, 1), /ZAY_CONFLICT/);
    await session(0, true);
    const updated = await db.query<{ revision: number }>(
      "select revision from public.zay_accounts",
    );
    assert.equal(Number(updated.rows[0].revision), 2);
    await session(2, false);
    assert.equal(
      (await db.query("select * from public.zay_accounts")).rows.length,
      0,
    );
    assert.equal(
      (await db.query("select * from public.zay_account_versions")).rows.length,
      0,
    );
    await assert.rejects(() => save(state, 0), /ZAY_UNAUTHORIZED/);
    await db.exec("set role anon");
    await assert.rejects(
      () => db.query("select * from public.zay_accounts"),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});
