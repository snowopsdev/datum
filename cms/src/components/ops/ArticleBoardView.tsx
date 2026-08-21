import type { AdminViewServerProps } from 'payload'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import { redirect } from 'next/navigation'
import React from 'react'

import type { Article } from '../../payload-types'
import { ArticleBoard } from './ArticleBoard'
import { toBoardArticle } from './articleStatus'

export async function ArticleBoardView(props: AdminViewServerProps) {
  const { initPageResult, params, searchParams } = props
  const { req, visibleEntities, permissions, locale } = initPageResult

  if (!req.user) {
    redirect('/admin/login')
  }

  const { docs } = await req.payload.find({
    collection: 'articles',
    depth: 1,
    limit: 500,
    pagination: false,
    sort: '-updatedAt',
    user: req.user,
    overrideAccess: false,
  })

  const articles = (docs as Article[]).map(toBoardArticle)

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
        <ArticleBoard articles={articles} />
      </Gutter>
    </DefaultTemplate>
  )
}
