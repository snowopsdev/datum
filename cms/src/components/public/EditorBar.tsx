'use client'

import React, { useEffect, useState } from 'react'

/**
 * "Edit in Datum" strip for signed-in editors. A client island on purpose: the
 * article route is ISR-cached, so the server cannot read cookies to decide
 * whether to show it. The cached HTML is identical for every reader and this
 * only appears after hydration for someone who has a session.
 */
export function EditorBar({ articleId }: { articleId: number }) {
  const [signedIn, setSignedIn] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/users/me', { credentials: 'same-origin', signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { user?: unknown } | null) => setSignedIn(Boolean(data?.user)))
      .catch(() => setSignedIn(false))
    return () => controller.abort()
  }, [])

  if (!signedIn) return null

  return (
    <div className="datum-public__editor-bar" role="region" aria-label="Editor tools">
      <span>You are signed in</span>
      <a href={`/admin/ops/articles/${articleId}`}>Edit in Datum</a>
    </div>
  )
}
