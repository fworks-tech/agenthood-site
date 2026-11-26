/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import MarkdownRenderer from '@/app/components/MarkdownRenderer'
import MessageBubble from '@/app/(main)/studio/_components/MessageBubble'
import WorkspaceTurnCard from '@/app/(main)/studio/workspaces/_components/WorkspaceTurnCard'

// Mantine reads the color scheme via matchMedia, which jsdom lacks.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})

const wrapper = MantineProvider

describe('markdown renderers fail closed on javascript: urls', () => {
  it('MarkdownRenderer renders unsafe hrefs as text, not links', () => {
    const { container } = render(
      <MarkdownRenderer>{'[click](javascript:alert(1))'}</MarkdownRenderer>,
      { wrapper },
    )
    expect(container.querySelector('a[href^="javascript:"]')).toBeNull()
    expect(container.textContent).toContain('click')
  })

  it('MarkdownRenderer keeps relative docs links as links', () => {
    const { container } = render(
      <MarkdownRenderer basePath="docs/architecture">{'[guide](../adr/ADR-001.md)'}</MarkdownRenderer>,
      { wrapper },
    )
    expect(container.querySelector('a')).not.toBeNull()
    expect(container.querySelector('a[href^="javascript:"]')).toBeNull()
  })

  it('MessageBubble renders unsafe hrefs as text, not links', () => {
    const { container } = render(
      <MessageBubble
        message={{ id: 'm1', role: 'assistant', content: '[click](javascript:alert(1))' }}
      />,
      { wrapper },
    )
    expect(container.querySelector('a[href^="javascript:"]')).toBeNull()
    expect(container.textContent).toContain('click')
  })

  it('WorkspaceTurnCard renders unsafe hrefs as text, not links', () => {
    const { container } = render(
      <WorkspaceTurnCard memberId="the-builder" content="[click](JaVaScRiPt:alert(1))" turnIndex={0} />,
      { wrapper },
    )
    expect(container.querySelector('a[href]')).toBeNull()
    expect(container.textContent).toContain('click')
  })
})
