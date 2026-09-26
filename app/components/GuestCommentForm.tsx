'use client'

import { useState, useEffect } from 'react'
import { TextInput, Textarea, Button } from '@mantine/core'
import { useForm, hasLength } from '@mantine/form'
import { notifications } from '@mantine/notifications'
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
  const [token, setToken] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [slug, setSlug] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  const form = useForm({
    initialValues: { name: '', text: '' },
    validate: {
      name: hasLength({ min: 1, max: 50 }, 'Name must be 1-50 characters'),
      text: hasLength({ min: 1, max: 2000 }, 'Comment must be 1-2000 characters'),
    },
    validateInputOnBlur: true,
  })

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
    if (form.validate().hasErrors) return
    const { name, text } = { name: form.values.name.trim(), text: form.values.text.trim() }
    if (!name || !text || (CAPTCHA_REQUIRED && !token)) {
      if (CAPTCHA_REQUIRED && !token) {
        notifications.show({ color: 'red', title: 'Verification required', message: 'Please complete the captcha.' })
      }
      return
    }
    setSending(true)
    try {
      const res = await fetch('/api/news/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, text, token, slug }),
      })
      const data = await res.json()
      if (!res.ok) {
        notifications.show({ color: 'red', title: 'Failed to post comment', message: data.error ?? 'Failed to post comment' })
        return
      }
      setComments((prev) => [...prev, data.comment])
      form.reset()
      setToken(null)
      setRefreshKey((k) => k + 1)
      notifications.show({ color: 'green', title: 'Comment posted', message: 'Thanks for your comment.' })
    } catch {
      notifications.show({ color: 'red', title: 'Network error', message: 'Could not post comment. Try again.' })
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

      <form onSubmit={handleSubmit} className="space-y-3 pt-4 border-t border-zinc-800" noValidate>
        <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Leave a guest comment</h3>
        <TextInput
          label="Your name"
          placeholder="Your name"
          maxLength={50}
          required
          {...form.getInputProps('name')}
        />
        <Textarea
          label="Comment"
          placeholder="Write a comment..."
          maxLength={2000}
          required
          rows={3}
          {...form.getInputProps('text')}
        />
        <Turnstile onToken={setToken} refreshKey={refreshKey} />
        <Button
          type="submit"
          loading={sending}
          disabled={sending || !form.values.name.trim() || !form.values.text.trim() || (CAPTCHA_REQUIRED && !token)}
        >
          {sending ? 'Posting...' : 'Post comment'}
        </Button>
      </form>
    </div>
  )
}
