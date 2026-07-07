'use client'

import { useState, useEffect, useRef } from 'react'

declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, options: {
        sitekey: string
        callback: (token: string) => void
        'expired-callback': () => void
        theme?: 'light' | 'dark' | 'auto'
      }) => string
      reset: (widgetId: string) => void
      remove: (widgetId: string) => void
    }
    onloadTurnstileCallback?: () => void
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ''

interface GuestComment {
  id: string
  name: string
  text: string
  date: string
}

export default function GuestCommentForm() {
  const [comments, setComments] = useState<GuestComment[]>([])
  const [name, setName] = useState('')
  const [text, setText] = useState('')
  const [token, setToken] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [slug, setSlug] = useState('')
  const widgetRef = useRef<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const path = window.location.pathname.replace(/^\/news\//, '')
    setSlug(path)
    const controller = new AbortController()
    fetch(`/api/news/comments?slug=${encodeURIComponent(path)}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => { if (!controller.signal.aborted) setComments(data.comments ?? []) })
      .catch(() => {})
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!SITE_KEY || !containerRef.current) return
    const id = 'turnstile-guest-' + Math.random().toString(36).slice(2, 9)
    function render() {
      if (!window.turnstile || !containerRef.current) return
      widgetRef.current = window.turnstile.render(containerRef.current, {
        sitekey: SITE_KEY,
        callback: (t: string) => setToken(t),
        'expired-callback': () => setToken(null),
        theme: 'dark',
      })
    }
    containerRef.current.id = id
    if (window.turnstile) {
      render()
    } else {
      window.onloadTurnstileCallback = render
      if (!document.querySelector('script[src*="turnstile"]')) {
        const script = document.createElement('script')
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstileCallback&render=explicit'
        script.async = true
        script.defer = true
        document.head.appendChild(script)
      }
    }
    return () => {
      if (widgetRef.current && window.turnstile) {
        window.turnstile.remove(widgetRef.current)
      }
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !text.trim() || !token) return
    setSending(true)
    setError('')
    try {
      const res = await fetch('/api/news/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), text: text.trim(), token, slug }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to post comment')
        return
      }
      setComments((prev) => [...prev, data.comment])
      setName('')
      setText('')
      setToken(null)
      if (widgetRef.current && window.turnstile) {
        window.turnstile.reset(widgetRef.current)
      }
    } catch {
      setError('Network error')
    } finally {
      setSending(false)
    }
  }

  function avatarUrl(name: string): string {
    return `https://api.dicebear.com/9.x/fun-emoji/svg?seed=${encodeURIComponent(name)}&size=40`
  }

  function formatDate(iso: string): string {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="mt-8 space-y-6">
      {comments.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Guest comments ({comments.length})</h3>
          {comments.map((c) => (
            <div key={c.id} className="flex gap-3">
              <img
                src={avatarUrl(c.name)}
                alt=""
                className="w-8 h-8 rounded-full flex-shrink-0 bg-zinc-800"
                width={32}
                height={32}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium text-zinc-200">{c.name}</span>
                  <span className="text-xs text-zinc-500">{formatDate(c.date)}</span>
                </div>
                <p className="text-sm text-zinc-400 mt-0.5 whitespace-pre-wrap break-words">{c.text}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3 pt-4 border-t border-zinc-800">
        <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Leave a guest comment</h3>
        <input
          type="text"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={50}
          required
          className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
        />
        <textarea
          placeholder="Write a comment..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={2000}
          required
          rows={3}
          className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 resize-none"
        />
        <div ref={containerRef} className="min-h-[65px]" />
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={sending || !name.trim() || !text.trim() || !token}
          className="px-4 py-1.5 text-sm font-medium bg-zinc-200 text-zinc-900 rounded hover:bg-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {sending ? 'Posting...' : 'Post comment'}
        </button>
      </form>
    </div>
  )
}
