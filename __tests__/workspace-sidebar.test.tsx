/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import WorkspaceSidebar from '../app/(main)/studio/workspaces/_components/WorkspaceSidebar'

const base = {
  selected: ['the-builder'],
  statusMap: {},
}

describe('WorkspaceSidebar checkpoint and notify', () => {
  it('shows no checkpoint or notify toggle by default', () => {
    render(<WorkspaceSidebar {...base} />)
    expect(screen.queryByText('Human checkpoint')).toBeNull()
    expect(screen.queryByLabelText('Browser notifications')).toBeNull()
    expect(screen.getByText('The Builder')).toBeTruthy()
  })

  it('exposes Continue and Stop as labeled buttons that fire handlers', () => {
    const onContinue = vi.fn()
    const onStop = vi.fn()
    render(<WorkspaceSidebar {...base} handoff={{ memberId: 'the-builder', reason: 'needs input' }} onContinue={onContinue} onStop={onStop} />)
    const cont = screen.getByRole('button', { name: 'Continue' })
    const stop = screen.getByRole('button', { name: 'Stop' })
    expect(cont.className).toMatch(/focus-visible:outline/)
    fireEvent.click(cont)
    fireEvent.click(stop)
    expect(onContinue).toHaveBeenCalledTimes(1)
    expect(onStop).toHaveBeenCalledTimes(1)
    expect(screen.getByText('needs input')).toBeTruthy()
  })

  it('exposes the notify toggle with an accessible label', () => {
    const onNotifyChange = vi.fn()
    render(<WorkspaceSidebar {...base} notifyEnabled={false} onNotifyChange={onNotifyChange} />)
    const box = screen.getByLabelText('Browser notifications') as HTMLInputElement
    expect(box.checked).toBe(false)
    fireEvent.click(box)
    expect(onNotifyChange).toHaveBeenCalledWith(true)
  })

  it('is keyboard reachable: controls are native buttons and inputs', () => {
    render(
      <WorkspaceSidebar
        {...base}
        handoff={{ memberId: 'the-builder', reason: 'r' }}
        onContinue={() => {}}
        onStop={() => {}}
        notifyEnabled
        onNotifyChange={() => {}}
      />,
    )
    for (const el of [
      screen.getByRole('button', { name: 'Continue' }),
      screen.getByRole('button', { name: 'Stop' }),
      screen.getByLabelText('Browser notifications'),
    ]) {
      expect(['BUTTON', 'INPUT'].includes(el.tagName)).toBe(true)
    }
  })
})
