// Single home for route validation bounds. workspaces, synthesize, chat and
// tools/execute previously copied these literals; drift between the turn and
// synthesize caps already caused one test bug.
export const MAX_ID_LENGTH = 128;
export const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
// Glob/key-injection characters. workspaceId is a Redis key suffix, never a
// file path, so this stays a denylist: `/ : .` remain allowed for legacy ids.
export const UNSAFE_ID_CHARS = /[\s*{}\[\]]/;

export function isBoundedId(value: string): boolean {
  const id = value.trim();
  return (
    id.length > 0 &&
    id.length <= MAX_ID_LENGTH &&
    !CONTROL_CHARS.test(id) &&
    !UNSAFE_ID_CHARS.test(id)
  );
}

export const MAX_THREAD_MESSAGES = 200;
export const MAX_MESSAGE_CHARS = 20_000;
export const MAX_THREAD_TOTAL_CHARS = 100_000;
export const MAX_MEMBER_IDS = 20;
