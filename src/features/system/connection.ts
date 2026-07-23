/**
 * True when an error looks like the server being unreachable / a dropped
 * network — as opposed to a normal validation or business error from the API.
 * Drives the "couldn't reach the server — your change wasn't saved" indicator.
 *
 * Deliberately message-based (fetch/network failures carry a recognizable
 * message) plus AbortError, rather than trusting `name === "TypeError"` alone
 * — so an unrelated programming TypeError isn't misreported as "offline".
 */
export function isConnectionError(err: unknown): boolean {
  if (!err) return false;
  const e = err as { message?: unknown; name?: unknown };
  if (e.name === "AbortError") return true;
  const msg = (typeof e.message === "string" ? e.message : String(err)).toLowerCase();
  return (
    msg.includes("network request failed") ||
    msg.includes("failed to fetch") ||
    msg.includes("network error") ||
    msg.includes("fetch failed") ||
    msg.includes("load failed") ||
    msg.includes("timed out") ||
    msg.includes("timeout")
  );
}
