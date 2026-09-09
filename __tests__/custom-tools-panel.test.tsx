/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import CustomToolsPanel from '@/app/(main)/studio/_components/CustomToolsPanel'

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

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserverStub

const STORAGE_KEY = 'agenthood-studio-custom-tools'

beforeEach(() => {
  localStorage.clear()
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

const renderPanel = () => render(<CustomToolsPanel />, { wrapper: MantineProvider })

describe('CustomToolsPanel', () => {
  it('renders empty state when no tools exist', () => {
    renderPanel()
    expect(screen.getByText('No custom tools yet. Add one to extend agent capabilities.')).toBeTruthy()
  })

  it('toggles the section open', () => {
    renderPanel()
    const header = screen.getByRole('button', { name: /Custom Tools/ })
    fireEvent.click(header)
    expect(screen.getByText('No custom tools yet. Add one to extend agent capabilities.')).toBeTruthy()
  })

  it('shows the add tool form when clicking Add Tool', () => {
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: /Custom Tools/ }))
    fireEvent.click(screen.getByText('Add Tool'))
    expect(screen.getByLabelText('Tool Name')).toBeTruthy()
    expect(screen.getByLabelText('Description')).toBeTruthy()
    expect(screen.getByLabelText('Execution Type')).toBeTruthy()
  })

  it('registers a custom tool and displays it in the list', async () => {
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: /Custom Tools/ }))
    fireEvent.click(screen.getByText('Add Tool'))

    fireEvent.change(screen.getByLabelText('Tool Name'), {
      target: { value: 'custom_weather' },
    })
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'Get weather for a city' },
    })
    fireEvent.change(screen.getByLabelText('Webhook URL'), {
      target: { value: 'https://api.example.com/weather' },
    })

    fireEvent.click(screen.getByText('Add Tool'))

    await waitFor(() => {
      expect(screen.getByText('custom_weather')).toBeTruthy()
    })
    expect(screen.getByText('Get weather for a city')).toBeTruthy()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    expect(stored).toHaveLength(1)
    expect(stored[0].name).toBe('custom_weather')
  })

  it('rejects invalid tool names', async () => {
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: /Custom Tools/ }))
    fireEvent.click(screen.getByText('Add Tool'))

    fireEvent.change(screen.getByLabelText('Tool Name'), {
      target: { value: 'invalid-name' },
    })
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'test' },
    })

    fireEvent.click(screen.getByText('Add Tool'))

    await waitFor(() => {
      expect(screen.getByText(/Invalid tool name/)).toBeTruthy()
    })
  })

  it('rejects invalid webhook URL', async () => {
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: /Custom Tools/ }))
    fireEvent.click(screen.getByText('Add Tool'))

    fireEvent.change(screen.getByLabelText('Tool Name'), {
      target: { value: 'custom_weather' },
    })
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'Get weather' },
    })
    fireEvent.change(screen.getByLabelText('Webhook URL'), {
      target: { value: 'not-a-url' },
    })

    fireEvent.click(screen.getByText('Add Tool'))

    await waitFor(() => {
      expect(screen.getByText('Webhook URL must be a valid URL')).toBeTruthy()
    })
  })

  it('deletes a custom tool after confirmation', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          name: 'custom_weather',
          description: 'Get weather',
          inputSchema: { type: 'object', properties: {} },
          executionType: 'webhook',
        },
      ]),
    )

    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: /Custom Tools/ }))

    const deleteButton = screen.getByRole('button', { name: 'Delete custom_weather', hidden: true } as any)
    fireEvent.click(deleteButton)

    expect(window.confirm).toHaveBeenCalledWith('Delete custom tool "custom_weather"?')

    await waitFor(() => {
      expect(screen.getByText('No custom tools yet. Add one to extend agent capabilities.', { hidden: true } as any)).toBeTruthy()
    })
  })

  it('skips deletion when confirmation is declined', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          name: 'custom_weather',
          description: 'Get weather',
          inputSchema: { type: 'object', properties: {} },
          executionType: 'webhook',
        },
      ]),
    )

    vi.spyOn(window, 'confirm').mockReturnValue(false)

    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: /Custom Tools/ }))

    const deleteButton = screen.getByRole('button', { name: 'Delete custom_weather', hidden: true } as any)
    fireEvent.click(deleteButton)

    expect(window.confirm).toHaveBeenCalledWith('Delete custom tool "custom_weather"?')
    expect(screen.getByText('custom_weather', { hidden: true } as any)).toBeTruthy()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    expect(stored).toHaveLength(1)
  })

  it('cancels the form when clicking Cancel', () => {
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: /Custom Tools/ }))
    fireEvent.click(screen.getByText('Add Tool'))
    expect(screen.getByLabelText('Tool Name')).toBeTruthy()

    fireEvent.click(screen.getByText('Cancel'))
    expect(screen.queryByLabelText('Tool Name')).toBeNull()
  })
})
