import { describe, it, expect } from 'vitest'
import { requestModels, failureDetail } from '../scripts/check-workspace-models.mjs'

describe('check-workspace-models', () => {
  it('passes the API key as a discrete curl argument without a shell', () => {
    let captured
    requestModels('secret-key', (cmd, args, opts) => {
      captured = { cmd, args, opts }
      return { status: 0, stdout: '{"data":[]}', stderr: '' }
    })

    expect(captured.cmd).toBe('curl')
    expect(Array.isArray(captured.args)).toBe(true)
    expect(captured.args.filter((a) => a.includes('secret-key'))).toEqual([
      'authorization: Bearer secret-key',
    ])
    expect(captured.opts).not.toHaveProperty('shell')
  })

  it('reports only stderr on failure, never the key or the full command', () => {
    const result = {
      status: 22,
      stderr: 'curl: (22) The requested URL returned error: 401\n',
      error: new Error('secret-key'),
    }

    expect(failureDetail(result)).toBe('curl: (22) The requested URL returned error: 401')
    expect(failureDetail({ status: null, stderr: '', error: new Error('ENOENT') })).toBe('')
  })
})
