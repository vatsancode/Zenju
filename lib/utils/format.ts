export const formatINR = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Manual "DD Mon YYYY" formatter — avoids Intl.DateTimeFormat('en-IN', ...),
// whose output (e.g. "16-Jul-2026" vs "16 Jul 2026") can differ between the
// server's ICU data and the browser's, causing React hydration mismatches.
export const formatDateShort = (
  input: string | Date,
  opts: { withYear?: boolean; padDay?: boolean } = {}
): string => {
  const { withYear = true, padDay = true } = opts
  const d = typeof input === 'string' ? new Date(input) : input
  const day = padDay ? String(d.getDate()).padStart(2, '0') : String(d.getDate())
  const month = MONTHS_SHORT[d.getMonth()]
  return withYear ? `${day} ${month} ${d.getFullYear()}` : `${day} ${month}`
}
