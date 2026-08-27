import { redirect } from 'next/navigation'

/** Keyword-first discovery lived here. "New content" replaced it; bookmarks still land. */
export async function TopicDiscoveryView() {
  redirect('/admin/ops/new')
}
