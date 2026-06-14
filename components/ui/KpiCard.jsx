// 'use client'
// // TODO: Phase 3 — KpiCard
// export default function KpiCard() { return null }

'use client'
export default function KpiCard({ icon: Icon, color = 'teal', value, label, sub }) {
  return (
    <div className="kpi">
      {Icon && (
        <div className={`kpi-icon ${color}`}>
          <Icon size={22} />
        </div>
      )}
      <div className="kpi-info">
        <div className="kpi-val">{value}</div>
        <div className="kpi-label">{label}{sub ? ` · ${sub}` : ''}</div>
      </div>
    </div>
  )
}