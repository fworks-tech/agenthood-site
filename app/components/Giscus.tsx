'use client'

import { useEffect, useRef, useState } from 'react'
import GuestCommentForm from './GuestCommentForm'

export default function Giscus() {
  const [mode, setMode] = useState<'github' | 'guest'>('github')
  const ref = useRef<HTMLDivElement>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (mode !== 'github' || loaded || !ref.current) return
    if (ref.current.hasChildNodes()) return

    const script = document.createElement('script')
    script.src = 'https://giscus.app/client.js'
    script.setAttribute('data-repo', 'fworks-tech/agenthood-site')
    script.setAttribute('data-repo-id', 'R_kgDOSyjBGQ')
    script.setAttribute('data-category', 'Announcements')
    script.setAttribute('data-category-id', 'DIC_kwDOSyjBGc4DApdy')
    script.setAttribute('data-mapping', 'pathname')
    script.setAttribute('data-strict', '0')
    script.setAttribute('data-reactions-enabled', '1')
    script.setAttribute('data-emit-metadata', '0')
    script.setAttribute('data-input-position', 'top')
    script.setAttribute('data-theme', 'dark_dimmed')
    script.setAttribute('data-lang', 'en')
    script.setAttribute('crossorigin', 'anonymous')
    script.async = true
    ref.current.appendChild(script)
    setLoaded(true)
  }, [mode, loaded])

  return (
    <div className="mt-16 pt-8 border-t border-zinc-800">
      <div className="flex gap-1 mb-6 bg-zinc-900 rounded-lg p-1 w-fit">
        <button
          onClick={() => setMode('github')}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            mode === 'github' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Sign in with GitHub
        </button>
        <button
          onClick={() => setMode('guest')}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            mode === 'guest' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Guest
        </button>
      </div>

      {mode === 'github' ? (
        <div ref={ref} />
      ) : (
        <GuestCommentForm />
      )}
    </div>
  )
}
