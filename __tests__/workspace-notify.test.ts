import { describe, it, expect, vi, beforeEach } from 'vitest'
import { shouldNotify, notifyWorkspace } from '../app/(main)/studio/_lib/workspace-notify'

describe('workspace-notify', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('notifies only when enabled and the tab is hidden', () => {
    expect(shouldNotify({ enabled: true, hidden: true })).toBe(true)
    expect(shouldNotify({ enabled: false, hidden: true })).toBe(false)
    expect(shouldNotify({ enabled: true, hidden: false })).toBe(false)
  })

  it('stays silent without a Notification API or permission', () => {
    expect(notifyWorkspace({ enabled: true, hidden: true, title: 't', body: 'b' })).toBe(false)
    vi.stubGlobal('Notification', { permission: 'default' })
    expect(notifyWorkspace({ enabled: true, hidden: true, title: 't', body: 'b' })).toBe(false)
  })

  it('fires when enabled, hidden, and granted', () => {
    const Ctor = vi.fn()
    vi.stubGlobal('Notification', Object.assign(Ctor, { permission: 'granted' }))
    expect(notifyWorkspace({ enabled: true, hidden: true, title: 't', body: 'b' })).toBe(true)
    expect(Ctor).toHaveBeenCalledWith('t', { body: 'b' })
  })
})
