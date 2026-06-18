'use client'
import { highlight } from '@/hooks/useSearch'

export default function SearchResultItem({
  iconEl, iconBg, title, sub, rightTop, rightBadgeBg, rightBadgeColor, rightBadgeLabel,
  query, onClick, selected,
}) {
  return (
    <div
      className="search-result-item"
      style={selected ? { background: 'var(--teal-xl)', outline: '2px solid var(--teal)', outlineOffset: -2 } : {}}
      onClick={onClick}
    >
      <div className="search-result-icon" style={{ background: iconBg }}>
        {iconEl}
      </div>
      <div className="search-result-main">
        <div className="search-result-name" dangerouslySetInnerHTML={highlight(title, query)} />
        <div className="search-result-sub" dangerouslySetInnerHTML={highlight(sub, query)} />
      </div>
      {(rightTop || rightBadgeLabel) && (
        <div style={{ flexShrink: 0, textAlign: 'right' }}>
          {rightTop && (
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', lineHeight: 1.2 }}>
              {rightTop}
            </div>
          )}
          {rightBadgeLabel && (
            <span
              className="badge"
              style={{
                background: rightBadgeBg || 'var(--bg)',
                color: rightBadgeColor || 'var(--text3)',
                marginTop: rightTop ? 3 : 0,
                display: 'inline-flex',
              }}
            >
              {rightBadgeLabel}
            </span>
          )}
        </div>
      )}
    </div>
  )
}