import { describe, it, expect } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getInstalled, collectStatus, shouldFail } from '../scripts/check-deps.mjs'

describe('check-deps', () => {
  it('reads node_modules/<name>/package.json directly even when exports hides it', () => {
    const dir = mkdtempSync(join(tmpdir(), 'check-deps-'))
    const pkgDir = join(dir, 'node_modules', 'agenthood')
    mkdirSync(pkgDir, { recursive: true })
    writeFileSync(
      join(pkgDir, 'package.json'),
      JSON.stringify({
        name: 'agenthood',
        version: '0.0.0-fixture',
        exports: { '.': './index.js' },
      }),
    )

    expect(getInstalled('agenthood', dir)).toBe('0.0.0-fixture')
  })

  it('returns null when the package is not installed', () => {
    expect(getInstalled('not-installed-fixture', join(tmpdir(), 'check-deps-missing'))).toBeNull()
  })

  it('counts a dependency as unresolved when either version cannot be resolved', () => {
    const result = collectStatus(
      [{ name: 'agenthood', critical: true }],
      () => null,
      () => '4.4.0',
    )

    expect(result.unresolved).toBe(1)
    expect(result.lines[0]).toContain('could not resolve')
  })

  it('fails strict mode on unresolved dependencies even when none are outdated', () => {
    expect(shouldFail(true, { outdated: 0, unresolved: 1 })).toBe(true)
    expect(shouldFail(false, { outdated: 0, unresolved: 1 })).toBe(false)
    expect(shouldFail(true, { outdated: 0, unresolved: 0 })).toBe(false)
  })

  it('still detects an outdated critical dependency', () => {
    const result = collectStatus(
      [{ name: 'agenthood', critical: true }],
      () => '3.55.1',
      () => '4.4.0',
    )

    expect(result.outdated).toBe(1)
    expect(result.criticalOutdated).toBe(1)
    expect(result.lines[0]).toContain('CRITICAL')
  })
})
