/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import StudioHubPage, { generateMetadata } from '@/app/(main)/studio/page'
import { agentRegistry } from '@/app/(main)/studio/_data/registry.generated'

// MantineProvider reads the color scheme via matchMedia, which jsdom lacks.
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

const renderPage = () => render(<StudioHubPage />, { wrapper: MantineProvider })

describe('Studio hub member count', () => {
  it('derives the hero copy from the generated registry, not a hardcoded number', () => {
    renderPage()
    expect(
      screen.getByText(new RegExp(`Select any of the ${agentRegistry.length} AI agent members`)),
    ).toBeTruthy()
  })

  it('derives the feature-grid copy from the generated registry', () => {
    renderPage()
    expect(
      screen.getByText(new RegExp(`Each of the ${agentRegistry.length} Society members`)),
    ).toBeTruthy()
  })

  it('derives the metadata description from the generated registry', () => {
    const metadata = generateMetadata()
    expect(metadata.description).toContain(`${agentRegistry.length} specialized AI agents`)
  })
})
