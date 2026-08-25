/**
 * Plain-text extraction for uploaded brand guides. Server-only (pdf-parse and
 * mammoth are Node libraries; both are listed in `serverExternalPackages`).
 */

export type ExtractedKind = 'md' | 'txt' | 'pdf' | 'docx'

export interface ExtractedText {
  text: string
  kind: ExtractedKind
  /** True when the source exceeded `MAX_EXTRACT_CHARS` and was cut. */
  truncated: boolean
  sourceChars: number
}

/** Enough for a long brand guide while keeping one extraction call well inside the model's context. */
export const MAX_EXTRACT_CHARS = 80_000

export const SUPPORTED_UPLOAD_EXTENSIONS = ['.md', '.txt', '.pdf', '.docx'] as const

export class UnsupportedUploadError extends Error {
  constructor(filename: string, mimetype: string) {
    super(
      `Unsupported file "${filename}" (${mimetype || 'unknown type'}). Upload ${SUPPORTED_UPLOAD_EXTENSIONS.join(', ')}.`,
    )
    this.name = 'UnsupportedUploadError'
  }
}

const MIME_KINDS: Record<string, ExtractedKind> = {
  'text/markdown': 'md',
  'text/x-markdown': 'md',
  'text/plain': 'txt',
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
}

/** Extension first (browsers report inconsistent mimetypes for .md), mimetype second. */
export function detectKind(filename: string, mimetype: string): ExtractedKind | null {
  const ext = filename.toLowerCase().match(/\.[a-z0-9]+$/)?.[0]
  if (ext === '.md' || ext === '.markdown') return 'md'
  if (ext === '.txt') return 'txt'
  if (ext === '.pdf') return 'pdf'
  if (ext === '.docx') return 'docx'
  return MIME_KINDS[mimetype.toLowerCase().split(';')[0].trim()] ?? null
}

function normalise(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * pdf.js refuses to start its worker when `Array.prototype` carries enumerable
 * extras ("unexpected enumerable property"), and `drizzle-kit` — loaded by
 * Payload's Postgres adapter in dev for schema push — assigns
 * `Array.prototype.random`. Hiding such additions keeps them functional while
 * satisfying pdf.js. Idempotent and only touches configurable own properties.
 */
function hideArrayPrototypePollution(): void {
  for (const key of Object.keys(Array.prototype)) {
    const descriptor = Object.getOwnPropertyDescriptor(Array.prototype, key)
    if (descriptor?.configurable) {
      Object.defineProperty(Array.prototype, key, { ...descriptor, enumerable: false })
    }
  }
}

async function pdfToText(buffer: Buffer): Promise<string> {
  hideArrayPrototypePollution()
  const { PDFParse } = await import('pdf-parse')
  const parser = new PDFParse({ data: buffer })
  try {
    const result = await parser.getText()
    return result.text
  } finally {
    await parser.destroy()
  }
}

async function docxToText(buffer: Buffer): Promise<string> {
  const mammoth = await import('mammoth')
  const result = await mammoth.extractRawText({ buffer })
  return result.value
}

export async function extractText(
  buffer: Buffer,
  mimetype: string,
  filename: string,
): Promise<ExtractedText> {
  const kind = detectKind(filename, mimetype)
  if (!kind) throw new UnsupportedUploadError(filename, mimetype)

  let raw: string
  switch (kind) {
    case 'pdf':
      raw = await pdfToText(buffer)
      break
    case 'docx':
      raw = await docxToText(buffer)
      break
    default:
      raw = buffer.toString('utf8')
  }

  const text = normalise(raw)
  const truncated = text.length > MAX_EXTRACT_CHARS
  return {
    text: truncated ? text.slice(0, MAX_EXTRACT_CHARS) : text,
    kind,
    truncated,
    sourceChars: text.length,
  }
}
