'use client'

import { useState, useEffect } from 'react'
import Turnstile from './Turnstile'

const CAPTCHA_REQUIRED =
  process.env.NEXT_PUBLIC_TURNSTILE_ENABLED !== "false" &&
  !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

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
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const path = window.location.pathname.replace(/^\/news\//, '')
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSlug(path)
    const controller = new AbortController()
    fetch(`/api/news/comments?slug=${encodeURIComponent(path)}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => { if (!controller.signal.aborted) setComments(data.comments ?? []) })
      .catch(() => {})
    return () => controller.abort()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !text.trim() || (CAPTCHA_REQUIRED && !token)) return
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
      setRefreshKey((k) => k + 1)
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
              {/* next/image would need remotePatterns for the seed-based dicebear URL on a decorative 32px avatar */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
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
        <Turnstile onToken={setToken} refreshKey={refreshKey} />
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={sending || !name.trim() || !text.trim() || (CAPTCHA_REQUIRED && !token)}
          className="px-4 py-1.5 text-sm font-medium bg-zinc-200 text-zinc-900 rounded hover:bg-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {sending ? 'Posting...' : 'Post comment'}
        </button>
      </form>
    </div>
  )
}
