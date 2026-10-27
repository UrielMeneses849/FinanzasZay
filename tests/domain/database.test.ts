import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";
import { demo } from "../../src/lib/finance.ts";
test("migración SQL, privacidad por usuario, versiones y control de concurrencia", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;insert into auth.users values('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002');`,
    );
    await db.exec(
      await readFile("supabase/migrations/202610270001_zay.sql", "utf8"),
    );
    await db.exec(
      `set role authenticated;set request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';`,
    );
    const save = async (s: unknown, rev: number) =>
      db.query<{ revision: number }>(
        "select public.zay_save_account($1::jsonb,$2::bigint) as revision",
        [JSON.stringify(s), rev],
      );
    const s = demo();
    const first = await save(s, 0);
    assert.equal(Number(first.rows[0].revision), 1);
    assert.equal(
      (await db.query("select * from public.zay_accounts")).rows.length,
      1,
    );
    await assert.rejects(() => save(s, 0), /ZAY_CONFLICT/);
    s.name = "Zay prueba";
    assert.equal(Number((await save(s, 1)).rows[0].revision), 2);
    assert.equal(
      (await db.query("select * from public.zay_account_versions")).rows.length,
      1,
    );
    await assert.rejects(
      () => db.query("delete from public.zay_accounts"),
      /permission denied/,
    );
    const invalid = structuredClone(s);
    invalid.lots[0].sales[0].units = 99;
    await assert.rejects(() => save(invalid, 2), /ZAY_INSUFFICIENT_STOCK/);
    const invalidMoney = structuredClone(s);
    invalidMoney.movements.push({
      id: "bad",
      date: s.openingDate,
      concept: "error",
      category: "Otros",
      amount: 1.5,
    });
    await assert.rejects(() => save(invalidMoney, 2), /ZAY_INVALID_MOVEMENT/);
    await db.exec(
      `set request.jwt.claim.sub='00000000-0000-4000-8000-000000000002';`,
    );
    assert.equal(
      (await db.query("select * from public.zay_accounts")).rows.length,
      0,
    );
    assert.equal(
      (await db.query("select * from public.zay_account_versions")).rows.length,
      0,
    );
    assert.equal(Number((await save(demo(), 0)).rows[0].revision), 1);
    await db.exec(`set request.jwt.claim.sub='';`);
    await assert.rejects(() => save(s, 0), /ZAY_UNAUTHORIZED/);
    await db.exec("set role anon;");
    await assert.rejects(
      () => db.query("select * from public.zay_accounts"),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});
