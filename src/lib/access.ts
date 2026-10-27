export const LOGIN_EMAILS: Record<string, string> = {
  zayris: "zayris@finanzas-zay.invalid",
  uriel: "uriel@finanzas-zay.invalid",
};
export function loginEmail(username: string) {
  const email = LOGIN_EMAILS[username.trim().toLowerCase()];
  if (!email) throw Error("Usa tu usuario zayris o uriel.");
  return email;
}
export function workspaceOf(
  user: { app_metadata?: Record<string, unknown> } | null | undefined,
) {
  const metadata = user?.app_metadata;
  const id = metadata?.zay_workspace;
  return metadata?.zay_access === true &&
    typeof id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    ? id
    : null;
}
