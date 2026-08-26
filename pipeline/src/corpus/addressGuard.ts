/**
 * Which hosts and IP addresses the crawler refuses to talk to.
 *
 * SERP URLs are low-trust input: a ranking page (or a redirect from one) that
 * points at `169.254.169.254`, `localhost`, or an RFC1918 address would turn a
 * pipeline run into a request against our own infrastructure, and the response
 * body is stored in Postgres and fed to an LLM. `fetchPage` therefore resolves
 * every hop's hostname before it is fetched and rejects it here.
 *
 * Everything in this file is pure — no network, no DNS, no clock — so the
 * ranges can be tested exhaustively. It is deliberately fail-closed: an address
 * or hostname we cannot parse is blocked rather than trusted.
 */

/** Dotted-quad octets, or null when `value` is not an IPv4 literal. */
function parseIPv4(value: string): number[] | null {
  const parts = value.split('.')
  if (parts.length !== 4) return null
  const octets: number[] = []
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null
    const octet = Number(part)
    if (octet > 255) return null
    octets.push(octet)
  }
  return octets
}

/**
 * The eight 16-bit groups of an IPv6 literal, or null when `value` is not one.
 * Handles `::` compression and a trailing embedded IPv4 (`::ffff:127.0.0.1`).
 */
function parseIPv6(value: string): number[] | null {
  let text = value.toLowerCase()
  // A zone id (`fe80::1%eth0`) is routing information, not part of the address.
  const zone = text.indexOf('%')
  if (zone !== -1) text = text.slice(0, zone)
  if (text.length === 0 || !text.includes(':')) return null

  // An embedded dotted-quad tail becomes the last two groups.
  let tail: number[] = []
  const lastColon = text.lastIndexOf(':')
  const maybeV4 = text.slice(lastColon + 1)
  if (maybeV4.includes('.')) {
    const octets = parseIPv4(maybeV4)
    if (!octets) return null
    tail = [(octets[0] << 8) | octets[1], (octets[2] << 8) | octets[3]]
    text = text.slice(0, lastColon + 1)
    // `::ffff:1.2.3.4` now reads `::ffff:`; drop the trailing separator unless
    // it is the compression marker itself.
    if (text.endsWith('::')) text = text.slice(0, -1)
    else if (text.endsWith(':')) text = text.slice(0, -1)
  }

  const halves = text.split('::')
  if (halves.length > 2) return null
  const groupsOf = (part: string): number[] | null => {
    if (part.length === 0) return []
    const out: number[] = []
    for (const group of part.split(':')) {
      if (!/^[0-9a-f]{1,4}$/.test(group)) return null
      out.push(Number.parseInt(group, 16))
    }
    return out
  }
  const head = groupsOf(halves[0] ?? '')
  const rest = halves.length === 2 ? groupsOf(halves[1] ?? '') : []
  if (head === null || rest === null) return null

  const explicit = [...head, ...rest, ...tail]
  if (halves.length === 1) return explicit.length === 8 ? explicit : null
  if (explicit.length >= 8) return null
  const zeros = new Array(8 - explicit.length).fill(0) as number[]
  return [...head, ...zeros, ...rest, ...tail]
}

/** True for an IPv4 address no public web server should ever be reached at. */
function isBlockedIPv4(octets: number[]): boolean {
  const [a = 0, b = 0] = octets
  if (a === 0) return true // 0.0.0.0/8 "this network", incl. the unspecified address
  if (a === 10) return true // RFC1918
  if (a === 127) return true // loopback
  if (a === 100 && b >= 64 && b <= 127) return true // 100.64/10 carrier-grade NAT
  if (a === 169 && b === 254) return true // link-local, incl. cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true // RFC1918
  if (a === 192 && b === 168) return true // RFC1918
  if (a === 192 && b === 0 && (octets[2] ?? 0) === 0) return true // 192.0.0/24 IETF protocol assignments
  if (a === 198 && (b === 18 || b === 19)) return true // 198.18/15 benchmarking
  if (a >= 224) return true // multicast, reserved, and 255.255.255.255
  return false
}

/**
 * Whether an IP address is one the crawler must not reach: loopback, private,
 * link-local, unique-local, unspecified, multicast/reserved, or an IPv6 form
 * that maps onto any of those. Unparseable input is blocked.
 */
export function isBlockedAddress(ip: string): boolean {
  const v4 = parseIPv4(ip.trim())
  if (v4) return isBlockedIPv4(v4)

  const v6 = parseIPv6(ip.trim())
  if (!v6) return true

  const [g0 = 0, g1 = 0] = v6
  const isZeroPrefix = v6.slice(0, 5).every((group) => group === 0)
  // ::ffff:a.b.c.d (mapped) and ::a.b.c.d (deprecated compatible) are IPv4
  // addresses wearing a different hat; judge the embedded address.
  if (isZeroPrefix && (v6[5] === 0xffff || v6[5] === 0)) {
    const embedded = [v6[6] ?? 0, v6[7] ?? 0]
    const asV4 = [embedded[0] >> 8, embedded[0] & 0xff, embedded[1] >> 8, embedded[1] & 0xff]
    // `::` and `::1` fall out of this as 0.0.0.0 and 0.0.0.1, both blocked by
    // the 0/8 rule, so the unspecified and loopback addresses need no special case.
    return isBlockedIPv4(asV4)
  }
  if ((g0 & 0xfe00) === 0xfc00) return true // fc00::/7 unique-local
  if ((g0 & 0xffc0) === 0xfe80) return true // fe80::/10 link-local
  if ((g0 & 0xff00) === 0xff00) return true // ff00::/8 multicast
  if (g0 === 0x64 && g1 === 0xff9b) return true // 64:ff9b::/96 NAT64 onto v4 space
  return false
}

/** Hostname suffixes that only ever name something inside a private network. */
const INTERNAL_SUFFIXES = ['.localhost', '.local', '.internal', '.intranet', '.home.arpa']

/**
 * The hostname as the guard should judge it: lower-cased, IPv6 brackets and any
 * trailing root dot removed. Exported so `fetchPage` and its tests agree on it.
 */
export function normaliseHostname(hostname: string): string {
  let host = hostname.trim().toLowerCase()
  if (host.startsWith('[') && host.endsWith(']')) host = host.slice(1, -1)
  while (host.endsWith('.')) host = host.slice(0, -1)
  return host
}

/**
 * Whether a *name* is refused before DNS is even consulted: an intranet suffix,
 * or a single-label host, which cannot be a public FQDN. IP literals are not
 * judged here — they go to `isBlockedAddress`, which the resolver step reaches
 * anyway because `dns.lookup` returns a literal unchanged.
 */
export function isBlockedHostname(hostname: string): boolean {
  const host = normaliseHostname(hostname)
  if (host.length === 0) return true
  // An IP literal: let the address rules decide, not the name rules.
  if (host.includes(':') || parseIPv4(host)) return isBlockedAddress(host)
  if (host === 'localhost') return true
  if (INTERNAL_SUFFIXES.some((suffix) => host.endsWith(suffix))) return true
  if (!host.includes('.')) return true
  return false
}
