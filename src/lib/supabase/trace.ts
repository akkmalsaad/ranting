/**
 * Opt-in Supabase request timing (`SUPABASE_TRACE=1`, server-only). Logs the endpoint path,
 * status and duration only: never query strings, headers or bodies, which can carry ids,
 * search terms or tokens.
 */
export function tracedFetch(label: string): typeof fetch | undefined {
  if (process.env.SUPABASE_TRACE !== "1") return undefined;
  return async (input, init) => {
    const started = performance.now();
    const response = await fetch(input, init);
    const url = new URL(input instanceof Request ? input.url : String(input));
    console.info(`[supabase] ${label} ${init?.method ?? "GET"} ${url.pathname} ${response.status} ${Math.round(performance.now() - started)}ms`);
    return response;
  };
}
