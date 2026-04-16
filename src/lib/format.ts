export function formatCurrencyCr(value: number) {
  return `₹${value.toFixed(1)} Cr`
}

export function formatCurrencyLakh(value: number) {
  return `₹${value.toFixed(1)} L`
}

export function formatCompactNumber(value: number) {
  return new Intl.NumberFormat('en-IN', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

export function formatDate(value?: string) {
  if (!value) return 'NA'

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

export function formatDateTime(value?: string) {
  if (!value) return 'NA'

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function titleCase(value: string) {
  return value
    .split(' ')
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ')
}
