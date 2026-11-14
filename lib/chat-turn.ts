/**
 * Turn identity shared by every server surface.
 *
 * A turn id is client input that becomes a Firestore document id, so it is
 * validated once here rather than by a copy of the pattern in each route. Only a
 * UUID is a turn id: AI SDK generated ids and legacy Firestore ids must never
 * enter the outbox, because the outbox reserves the id for the user document and
 * `{turnId}-a` for the answer.
 */
export const TURN_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isTurnId(value: unknown): value is string {
  return typeof value === "string" && TURN_ID_PATTERN.test(value);
}
