import type { PropsWithChildren, ReactNode } from 'react'

type StatCardProps = {
  label: string
  value: string
  tone?: 'default' | 'good' | 'warn'
  trend?: string
}

export function StatCard({ label, value, tone = 'default' }: StatCardProps) {
  return (
    <article className={`stat-card ${tone !== 'default' ? 'stat-card-' + tone : ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </article>
  )
}

export function Section({
  title,
  subtitle,
  children,
}: PropsWithChildren<{ title: string; subtitle?: string; action?: ReactNode }>) {
  return (
    <section style={{ marginBottom: '32px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>{title}</h2>
        {subtitle && <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{subtitle}</p>}
      </div>
      {children}
    </section>
  )
}

export function Badge({
  children,
  tone = 'default',
}: PropsWithChildren<{ tone?: 'default' | 'good' | 'warn' | 'critical' }>) {
  const toneMap: Record<string, string> = {
    good: 'qualified',
    warn: 'pending',
    critical: 'rejected',
    default: 'pending'
  }
  return <span className={`badge badge-${toneMap[tone] || 'pending'}`}>{children}</span>
}

export function MetricList({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <div className="onboarding-side" style={{ border: 'none', background: 'transparent', padding: 0 }}>
      {items.map((item) => (
        <div key={item.label} className="meta-item" style={{ marginBottom: '16px' }}>
          <span className="label" style={{ fontSize: '0.7rem' }}>{item.label}</span>
          <span className="value" style={{ fontSize: '0.95rem' }}>{item.value}</span>
        </div>
      ))}
    </div>
  )
}

export function JourneySteps({ steps, active }: { steps: string[]; active: string }) {
  const activeIndex = Math.max(steps.findIndex((step) => step === active), 0)

  return (
    <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
      {steps.map((step, index) => (
        <div
          key={step}
          style={{
            padding: '6px 12px',
            borderRadius: '999px',
            fontSize: '0.75rem',
            fontWeight: 600,
            background: index <= activeIndex ? 'var(--primary)' : '#f3f4f6',
            color: index <= activeIndex ? 'white' : 'var(--text-muted)',
            transition: 'all 0.2s'
          }}
        >
          {step}
        </div>
      ))}
    </div>
  )
}

export function Table({
  columns,
  rows,
}: {
  columns: string[]
  rows: Array<Array<ReactNode>>
}) {
  return (
    <div className="table-card">
      <div className="table-container">
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function EmptyState({
  title,
  detail,
}: {
  title: string
  detail: string
}) {
  return (
    <div className="table-card" style={{ padding: '64px 32px', textAlign: 'center' }}>
      <div style={{ fontSize: '2rem', marginBottom: '16px' }}>📂</div>
      <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px' }}>{title}</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{detail}</p>
    </div>
  )
}
