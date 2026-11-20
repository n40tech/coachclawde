/**
 * Where tapping a rest alert takes the athlete: their workout, opened at the
 * exercise that's up next (`/session/<id>/next/<exerciseId>`, a route of the
 * Session page that expands and scrolls to it).
 *
 * A path, not a query or hash: the rest-alarm function only accepts URLs
 * made of word characters, `-`, `.` and `/` (handler.ts parsePayload), so
 * ids outside that fall back to the plain workout (or `fallback`).
 */
const SAFE = /^[\w.-]{1,80}$/

export function restAlertUrl(sessionId: string | undefined, nextExerciseId: string | undefined, fallback: string): string {
  if (!sessionId || !SAFE.test(sessionId)) return fallback
  const session = `/session/${sessionId}`
  return nextExerciseId && SAFE.test(nextExerciseId) ? `${session}/next/${nextExerciseId}` : session
}

/** The same check the rest-alarm function applies (handler.ts parsePayload). */
export const isAcceptedAlertUrl = (url: string) => /^\/[\w\-/.]{0,199}$/.test(url)
