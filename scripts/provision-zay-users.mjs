// Ejecutar solo localmente con una clave administrativa temporal, nunca en el cliente.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
const keyPath = process.argv[2];
if (!keyPath) throw Error("Falta la ruta de la clave temporal.");
const key = (await readFile(keyPath, "utf8")).trim();
const admin = createClient("https://lkwuyrowslitxbftkbqx.supabase.co", key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const credentialsPath = new URL(
  "../../entregables/Accesos-Zay.private.json",
  import.meta.url,
);
await mkdir(new URL("../../entregables/", import.meta.url), {
  recursive: true,
});
let data;
try {
  data = JSON.parse(await readFile(credentialsPath, "utf8"));
} catch (e) {
  if (e.code !== "ENOENT") throw e;
  data = {
    createdAt: new Date().toISOString(),
    users: ["zayris", "uriel"].map((username) => ({
      username,
      email: username + "@finanzas-zay.invalid",
      password: randomBytes(18).toString("base64url"),
    })),
  };
  await writeFile(credentialsPath, JSON.stringify(data, null, 2), {
    mode: 0o600,
    flag: "wx",
  });
}
for (const account of data.users) {
  if (account.id) continue;
  const { data: created, error } = await admin.auth.admin.createUser({
    email: account.email,
    password: account.password,
    email_confirm: true,
    user_metadata: {
      name: account.username === "zayris" ? "Zayris" : "Uriel",
      app: "zay",
    },
    app_metadata: { zay_access: true },
  });
  if (error)
    throw Error("No se pudo crear " + account.username + ": " + error.message);
  account.id = created.user.id;
  await writeFile(credentialsPath, JSON.stringify(data, null, 2), {
    mode: 0o600,
  });
  console.log("Usuario creado:", account.username);
}
const owner = data.users.find((x) => x.username === "zayris").id;
for (const account of data.users) {
  const { error } = await admin.auth.admin.updateUserById(account.id, {
    app_metadata: { zay_access: true, zay_workspace: owner },
  });
  if (error)
    throw Error(
      "No se pudo vincular " + account.username + ": " + error.message,
    );
}
await writeFile(credentialsPath, JSON.stringify(data, null, 2), {
  mode: 0o600,
});
console.log(
  "Dos usuarios vinculados al mismo patrimonio. Credenciales guardadas fuera del repositorio.",
);
