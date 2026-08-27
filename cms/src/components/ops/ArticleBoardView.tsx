import { redirect } from 'next/navigation'

/** The kanban board lived here. The content list replaced it; bookmarks still land somewhere. */
export async function ArticleBoardView() {
  redirect('/admin/ops/content')
}
