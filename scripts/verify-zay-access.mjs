import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
const creds = JSON.parse(
  await readFile(
    new URL("../../entregables/Accesos-Zay.private.json", import.meta.url),
    "utf8",
  ),
);
const env = Object.fromEntries(
  (await readFile(".env.local", "utf8"))
    .split("\n")
    .filter((x) => x.includes("="))
    .map((x) => {
      const i = x.indexOf("=");
      return [x.slice(0, i), x.slice(i + 1).replace(/^['"]|['"]$/g, "")];
    }),
);
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const clients = [];
const owner = creds.users.find((u) => u.username === "zayris").id;
for (const account of creds.users) {
  const client = createClient(url, key, opts);
  const { data, error } = await client.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  });
  if (error)
    throw Error("Falló acceso " + account.username + ": " + error.message);
  assert.equal(data.user.app_metadata.zay_workspace, owner);
  assert.equal(data.user.app_metadata.zay_access, true);
  clients.push(client);
}
const existing = await clients[0]
  .from("zay_accounts")
  .select("user_id,state")
  .maybeSingle();
if (existing.error) throw existing.error;
if (existing.data) {
  const other = await clients[1]
    .from("zay_accounts")
    .select("user_id")
    .maybeSingle();
  assert.equal(other.data?.user_id, owner);
  console.log("Ambos usuarios leen el patrimonio existente. No se alteró.");
} else {
  const name = "Verificación temporal " + randomUUID().slice(0, 8);
  const d = new Date();
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const state = {
    version: 1,
    name,
    currency: "MXN",
    opening: 0,
    openingDate: date,
    movements: [],
    lots: [],
    plans: [],
    audit: [],
  };
  const saved = await clients[0].rpc("zay_save_account", {
    p_state: state,
    p_expected_revision: 0,
  });
  if (saved.error) throw saved.error;
  const other = await clients[1]
    .from("zay_accounts")
    .select("user_id,state")
    .maybeSingle();
  if (other.error) throw other.error;
  assert.equal(other.data.user_id, owner);
  assert.equal(other.data.state.name, name);
  const denied = await createClient(url, key, opts)
    .from("zay_accounts")
    .select("user_id");
  assert.ok(denied.error, "El acceso anónimo debe estar denegado.");
  const admin = createClient(
    url,
    (await readFile(process.argv[2], "utf8")).trim(),
    opts,
  );
  const removed = await admin
    .from("zay_accounts")
    .delete()
    .eq("user_id", owner)
    .eq("state->>name", name)
    .select("user_id");
  if (removed.error) throw removed.error;
  assert.equal(
    removed.data.length,
    1,
    "No se modifica una cuenta que cambió durante la prueba.",
  );
  const versions = await admin
    .from("zay_account_versions")
    .delete()
    .eq("user_id", owner)
    .eq("state->>name", name);
  if (versions.error) throw versions.error;
  console.log(
    "Login de ambos usuarios, patrimonio compartido y denegación anónima verificados. Prueba temporal retirada.",
  );
}
for (const client of clients) await client.auth.signOut({ scope: "local" });
