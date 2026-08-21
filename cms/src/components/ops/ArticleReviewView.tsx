import type { AdminViewServerProps } from 'payload'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import { notFound, redirect } from 'next/navigation'
import React from 'react'

import type { Article, Template } from '../../payload-types'
import { ArticleReview } from './ArticleReview'
import { toBoardArticle } from './articleStatus'

export async function ArticleReviewView(props: AdminViewServerProps) {
  const { initPageResult, params, searchParams } = props
  const { req, visibleEntities, permissions, locale } = initPageResult

  if (!req.user) {
    redirect('/admin/login')
  }

  const segments = Array.isArray(params?.segments) ? params.segments : []
  const idSegment = segments[2]
  if (!idSegment || Array.isArray(idSegment)) {
    notFound()
  }

  const id = Number(idSegment)
  if (!Number.isFinite(id)) {
    notFound()
  }

  let article: Article
  try {
    article = (await req.payload.findByID({
      collection: 'articles',
      id,
      depth: 1,
      user: req.user,
      overrideAccess: false,
    })) as Article
  } catch {
    notFound()
  }

  const { docs: templateDocs } = await req.payload.find({
    collection: 'templates',
    depth: 0,
    limit: 50,
    pagination: false,
    sort: 'name',
    user: req.user,
    overrideAccess: false,
  })

  const templates = (templateDocs as Template[]).map((t) => ({ id: t.id, name: t.name }))

  return (
    <DefaultTemplate
      i18n={req.i18n}
      locale={locale}
      params={params}
      payload={req.payload}
      permissions={permissions}
      searchParams={searchParams as Record<string, string | string[] | undefined>}
      user={req.user}
      visibleEntities={visibleEntities}
    >
      <Gutter>
        <ArticleReview
          article={toBoardArticle(article)}
          templates={templates}
          editHref={`/admin/collections/articles/${article.id}`}
        />
      </Gutter>
    </DefaultTemplate>
  )
}
