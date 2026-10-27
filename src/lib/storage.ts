import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { State, validate } from "./finance";
export type Saved = {
  state: State;
  revision: number;
  remoteRevision: number;
  dirty: boolean;
};
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase: SupabaseClient | null =
  url && key
    ? (import.meta.hot?.data.supabase ??
      createClient(url, key, { auth: { storageKey: "zay-auth-v1" } }))
    : null;
if (import.meta.hot) import.meta.hot.data.supabase = supabase;
function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const q = indexedDB.open("zay-v1", 1);
    q.onupgradeneeded = () => q.result.createObjectStore("accounts");
    q.onsuccess = () => resolve(q.result);
    q.onerror = () => reject(q.error);
  });
}
export async function read(scope: string): Promise<Saved | null> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction("accounts", "readonly");
    const q = t.objectStore("accounts").get(scope);
    q.onsuccess = () => resolve(q.result ?? null);
    q.onerror = () => reject(q.error);
    t.oncomplete = () => d.close();
  });
}
export async function write(
  scope: string,
  state: State,
  expected: number,
  remoteRevision: number,
  dirty = true,
): Promise<Saved> {
  validate(state);
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction("accounts", "readwrite");
    const o = t.objectStore("accounts");
    const q = o.get(scope);
    let result: Saved;
    let conflict = false;
    q.onsuccess = () => {
      if ((q.result?.revision ?? 0) !== expected) {
        conflict = true;
        t.abort();
        return;
      }
      result = { state, revision: expected + 1, remoteRevision, dirty };
      o.put(result, scope);
    };
    t.oncomplete = () => {
      d.close();
      resolve(result);
    };
    t.onabort = () => {
      d.close();
      reject(
        Error(
          conflict
            ? "Otra pestaña actualizó tus datos. Recarga antes de continuar."
            : "No se pudo guardar. Revisa el espacio del dispositivo.",
        ),
      );
    };
    t.onerror = () => reject(t.error);
  });
}
export async function pull() {
  if (!supabase) throw Error("Supabase no está configurado.");
  const { data, error } = await supabase
    .from("zay_accounts")
    .select("state, revision")
    .maybeSingle();
  if (error) throw error;
  return data as { state: State; revision: number } | null;
}
export async function push(state: State, revision: number) {
  if (!supabase) throw Error("Supabase no está configurado.");
  const { data, error } = await supabase.rpc("zay_save_account", {
    p_state: state,
    p_expected_revision: revision,
  });
  if (error)
    throw Error(
      error.message.includes("ZAY_CONFLICT")
        ? "Hay cambios en otro dispositivo. Descarga el respaldo y resuelve el conflicto desde Ajustes."
        : error.message,
    );
  return Number(data);
}
export function download(state: State) {
  const b = new Blob(
    [
      JSON.stringify(
        { app: "Zay", exportedAt: new Date().toISOString(), state },
        null,
        2,
      ),
    ],
    { type: "application/json" },
  );
  const a = document.createElement("a");
  a.href = URL.createObjectURL(b);
  a.download = `zay-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}
export async function photo(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw Error("Elige una imagen.");
  if (file.size > 20000000) throw Error("La imagen supera 20 MB.");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1000 / Math.max(bitmap.width, bitmap.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bitmap.width * scale);
  c.height = Math.round(bitmap.height * scale);
  c.getContext("2d")!.drawImage(bitmap, 0, 0, c.width, c.height);
  bitmap.close();
  const data = c.toDataURL("image/jpeg", 0.75);
  if (data.length > 800000)
    throw Error("Esta foto pesa demasiado. Prueba otra imagen.");
  return data;
}
