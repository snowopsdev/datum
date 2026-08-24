'use client'

import React from 'react'

import {
  type BrandVoiceContent,
  brandVoiceSlug,
  brandVoiceToGuideMarkdown,
  TONE_DIALS,
} from '../../lib/brandVoice'
import type { BrandVoiceDTO } from './brandVoiceTypes'

type Props = {
  content: BrandVoiceContent
  record: Pick<BrandVoiceDTO, 'status' | 'activatedAt' | 'activatedBy'> | null
}

const Empty = () => <p className="datum-ops__guide-empty">Not defined yet.</p>

function downloadMarkdown(content: BrandVoiceContent, record: Props['record']) {
  const markdown = brandVoiceToGuideMarkdown(content, {
    status: record?.status ?? 'draft',
    activatedAt: record?.activatedAt ?? null,
    activatedBy: record?.activatedBy ?? null,
  })
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `brand-voice-${brandVoiceSlug(content.name)}.md`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function BrandVoiceGuide({ content, record }: Props) {
  const aud = content.audience
  return (
    <div className="datum-ops__guide">
      <div className="datum-ops__guide-head">
        <div>
          <h2>{content.name || 'Untitled'} — Brand &amp; Voice Guide</h2>
          {content.essence.oneLiner ? <blockquote>{content.essence.oneLiner}</blockquote> : null}
        </div>
        <button
          type="button"
          className="datum-ops__btn"
          onClick={() => downloadMarkdown(content, record)}
        >
          Export markdown
        </button>
      </div>

      <section>
        <h3>Mission</h3>
        {content.essence.mission ? <p>{content.essence.mission}</p> : <Empty />}
      </section>

      <section>
        <h3>Core values</h3>
        {content.coreValues.length ? (
          <dl>
            {content.coreValues.map((v, i) => (
              <React.Fragment key={`${v.value}-${i}`}>
                <dt>{v.value}</dt>
                <dd>{v.description || '—'}</dd>
              </React.Fragment>
            ))}
          </dl>
        ) : (
          <Empty />
        )}
      </section>

      <section>
        <h3>Who we’re talking to</h3>
        {aud.description || aud.languageLevel || aud.interests || aud.needs ? (
          <>
            {aud.description ? <p>{aud.description}</p> : null}
            <ul>
              {aud.languageLevel ? (
                <li>
                  <strong>Language level:</strong> {aud.languageLevel}
                </li>
              ) : null}
              {aud.interests ? (
                <li>
                  <strong>Interests:</strong> {aud.interests}
                </li>
              ) : null}
              {aud.needs ? (
                <li>
                  <strong>Needs and pain points:</strong> {aud.needs}
                </li>
              ) : null}
            </ul>
          </>
        ) : (
          <Empty />
        )}
      </section>

      <section>
        <h3>Our brand as a person</h3>
        {content.persona ? <p>{content.persona}</p> : <Empty />}
      </section>

      <section>
        <h3>How we sound</h3>
        {content.voiceAdjectives.length ? (
          <div className="datum-ops__guide-table">
            <table>
              <thead>
                <tr>
                  <th>Adjective</th>
                  <th>What it means</th>
                  <th>Do</th>
                  <th>Don’t</th>
                </tr>
              </thead>
              <tbody>
                {content.voiceAdjectives.map((a, i) => (
                  <tr key={`${a.adjective}-${i}`}>
                    <td>
                      <strong>{a.adjective}</strong>
                    </td>
                    <td>{a.description || '—'}</td>
                    <td>{a.doExample || '—'}</td>
                    <td>{a.dontExample || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty />
        )}
        {content.voiceInOwnWords ? (
          <>
            <h4>In our own words</h4>
            <p>{content.voiceInOwnWords}</p>
          </>
        ) : null}
      </section>

      <section>
        <h3>What we are not</h3>
        {content.notTraits.length ? (
          <ul>
            {content.notTraits.map((t, i) => (
              <li key={`${t.trait}-${i}`}>
                <strong>{t.trait}</strong>
                {t.boundaryNote ? ` — ${t.boundaryNote}` : ''}
              </li>
            ))}
          </ul>
        ) : (
          <Empty />
        )}
      </section>

      <section>
        <h3>Tone dials</h3>
        <ul className="datum-ops__guide-dials">
          {TONE_DIALS.map((d) => {
            const value = content.tone[d.key]
            return (
              <li key={d.key}>
                <span>{d.low}</span>
                <span className="datum-ops__guide-dots" aria-label={`${d.label} ${value} of 5`}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <i key={n} className={n <= value ? 'is-on' : undefined} />
                  ))}
                </span>
                <span>{d.high}</span>
              </li>
            )
          })}
        </ul>
      </section>

      <section>
        <h3>Words we use</h3>
        {content.preferredWords.length ? (
          <ul>
            {content.preferredWords.map((w, i) => (
              <li key={`${w.word}-${i}`}>
                <strong>{w.word}</strong>
                {w.note ? ` — ${w.note}` : ''}
              </li>
            ))}
          </ul>
        ) : (
          <Empty />
        )}
      </section>

      <section>
        <h3>Words we avoid</h3>
        {content.bannedWords.length ? (
          <ul>
            {content.bannedWords.map((w, i) => (
              <li key={`${w.word}-${i}`}>
                <s>{w.word}</s>
                {w.note ? ` — ${w.note}` : ''}
              </li>
            ))}
          </ul>
        ) : (
          <Empty />
        )}
      </section>

      <section>
        <h3>Writing samples</h3>
        {content.samples.length ? (
          content.samples.map((s, i) => (
            <figure key={`${s.title}-${i}`}>
              <figcaption>{s.title || `Sample ${i + 1}`}</figcaption>
              <blockquote>{s.text}</blockquote>
            </figure>
          ))
        ) : (
          <Empty />
        )}
      </section>

      {record ? (
        <p className="datum-ops__guide-footer">
          Status: {record.status}
          {record.activatedAt ? ` · Activated ${record.activatedAt}` : ''}
          {record.activatedBy ? ` by ${record.activatedBy}` : ''}
        </p>
      ) : null}
    </div>
  )
}
