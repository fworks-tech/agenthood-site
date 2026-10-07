// Local browser notifications for watch-by-default workspaces. Pure decision
// plus a guarded fire — never throws, never prompts for permission itself.

export function shouldNotify(opts: { enabled: boolean; hidden: boolean }): boolean {
  return opts.enabled && opts.hidden
}

export function notifyWorkspace(opts: { enabled: boolean; hidden: boolean; title: string; body: string }): boolean {
  if (!shouldNotify(opts)) return false
  try {
    const N = (globalThis as unknown as { Notification?: { permission: string } & (new (t: string, o?: { body?: string }) => unknown) })
      .Notification
    if (!N || N.permission !== 'granted') return false
    new N(opts.title, { body: opts.body })
    return true
  } catch {
    return false
  }
}

const PREF_KEY = 'agenthood-workspace-notify'

export function loadNotifyPref(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) === '1'
  } catch {
    return false
  }
}

export function saveNotifyPref(on: boolean): void {
  try {
    localStorage.setItem(PREF_KEY, on ? '1' : '0')
  } catch {
    // private mode etc. — notification stays a best-effort enhancement
  }
}

export async function requestNotifyPermission(): Promise<boolean> {
  try {
    const N = (globalThis as unknown as { Notification?: { requestPermission?: () => Promise<string> } }).Notification
    if (!N?.requestPermission) return false
    return (await N.requestPermission()) === 'granted'
  } catch {
    return false
  }
}
