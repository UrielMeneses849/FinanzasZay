export function asset(path: string) {
  return path.startsWith("data:")
    ? path
    : import.meta.env.BASE_URL + path.replace(/^\/+/, "");
}
