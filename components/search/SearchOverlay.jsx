'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  IconSearch, IconPackage, IconArrowsExchange,
  IconClipboardList, IconDeviceLaptop, IconCash, IconX,
} from '@tabler/icons-react'
import { useUiStore } from '@/store/uiStore'
import { useSearch, highlight } from '@/hooks/useSearch'
import { fmtDate } from '@/lib/helpers'
import SearchResultItem from './SearchResultItem'

const FILTERS = [
  { id: 'all',        label: 'Tout',        icon: null },
  { id: 'produits',   label: 'Produits',    icon: <IconPackage size={12} /> },
  { id: 'mouvements', label: 'Mouvements',  icon: <IconArrowsExchange size={12} /> },
  { id: 'demandes',   label: 'Demandes',    icon: <IconClipboardList size={12} /> },
  'sep',
  { id: 'it',         label: 'IT',          icon: <IconDeviceLaptop size={12} /> },
  { id: 'fin',        label: 'Finance',     icon: <IconCash size={12} /> },
]

function getStockStatus(p) {
  if (p.stock === 0)         return { label: 'Rupture', color: '#dc2626', bg: '#fef2f2' }
  if (p.stock <= p.seuil)    return { label: 'Critique', color: '#d97706', bg: '#fffbeb' }
  return { label: 'Dispo', color: '#16a34a', bg: '#f0fdf4' }
}

const SH_LABEL = {
  padding: '6px 14px 4px',
  fontSize: 10, fontWeight: 700, color: 'var(--text3)',
  textTransform: 'uppercase', letterSpacing: '.08em',
  background: 'var(--bg)',
  borderBottom: '1px solid var(--border)',
  borderTop: '1px solid var(--border)',
  display: 'flex', alignItems: 'center', gap: 8,
  position: 'sticky', top: 0, zIndex: 1,
}

export default function SearchOverlay() {
  const router = useRouter()
  const {
    searchOpen, closeSearch,
    searchQuery, setSearchQuery,
    searchFilter, setSearchFilter,
    setInlineQuery,
  } = useUiStore()

  const { runSearch } = useSearch()

  const [results, setResults] = useState({ produits: [], mouvements: [], demandes: [], total: 0 })
  const [selectedIdx, setSelectedIdx] = useState(-1)
  const inputRef    = useRef(null)
  const debounceRef = useRef(null)
  const totalItems  = useRef(0)

  // Focus input when overlay opens
  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
      setSelectedIdx(-1)
    }
  }, [searchOpen])

  // Debounced search
  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const r = runSearch(searchQuery, searchFilter)
      setResults(r)
      totalItems.current = Math.min(r.produits.length, 8)
        + Math.min(r.mouvements.length, 6)
        + Math.min(r.demandes.length, 6)
      setSelectedIdx(-1)
    }, 120)
    return () => clearTimeout(debounceRef.current)
  }, [searchQuery, searchFilter]) // eslint-disable-line

  const handleClose = useCallback(() => closeSearch(), [closeSearch])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') { handleClose(); return }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx(i => Math.min(i + 1, totalItems.current - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      const items = document.querySelectorAll('.search-result-item[data-result]')
      const cur = selectedIdx
      if (cur >= 0 && items[cur]) items[cur].click()
    }
  }, [handleClose, selectedIdx])

  // Scroll selected item into view
  useEffect(() => {
    const items = document.querySelectorAll('.search-result-item[data-result]')
    if (selectedIdx >= 0 && items[selectedIdx]) {
      items[selectedIdx].scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIdx])

  const goTo = useCallback((path, pageKey, inlineQ) => {
    handleClose()
    if (pageKey && inlineQ) {
      setInlineQuery(pageKey, inlineQ)
    }
    router.push(path)
  }, [handleClose, router, setInlineQuery])

  if (!searchOpen) return null

  const q     = searchQuery
  const prods = results.produits.slice(0, 8)
  const mvts  = results.mouvements.slice(0, 6)
  const dems  = results.demandes.slice(0, 6)
  const isEmpty = results.total === 0

  // Flat index counters for keyboard selection
  let fi = -1
  const nextIdx = () => { fi++; return fi }

  return (
    <div className="search-overlay" onClick={handleClose}>
      <div className="search-box" onClick={e => e.stopPropagation()}>

        {/* ─── Input ─── */}
        <div className="search-input-wrap">
          <IconSearch size={18} style={{ color: 'var(--text3)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Rechercher produit, mouvement, demande…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            spellCheck={false}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ border: 'none', background: 'none', color: 'var(--text3)', cursor: 'pointer', padding: '2px 4px', borderRadius: 4 }}
              title="Effacer"
            >
              <IconX size={14} />
            </button>
          )}
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            {[['↑↓', 'naviguer'], ['Esc', 'fermer']].map(([k, l]) => (
              <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'var(--text3)' }}>
                <kbd style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 3, padding: '1px 5px', fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 600 }}>{k}</kbd>
                <span style={{ fontSize: 9 }}>{l}</span>
              </span>
            ))}
          </div>
        </div>

        {/* ─── Filtres ─── */}
        <div className="search-filters">
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', marginRight: 4 }}>
            Filtres :
          </span>
          {FILTERS.map((f, i) => {
            if (f === 'sep') return (
              <div key={i} style={{ width: 1, height: 18, background: 'var(--border)', alignSelf: 'center', flexShrink: 0 }} />
            )
            return (
              <button
                key={f.id}
                className={`search-chip${searchFilter === f.id ? ' active' : ''}`}
                onClick={() => setSearchFilter(f.id)}
              >
                {f.icon && <span style={{ display: 'inline-flex' }}>{f.icon}</span>}
                {f.label}
              </button>
            )
          })}
          {results.total > 0 && (
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--teal)', fontWeight: 700 }}>
              {results.total} résultat{results.total > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* ─── Résultats ─── */}
        <div className="search-results">

          {/* État vide initial */}
          {!q && searchFilter === 'all' && (
            <div className="search-empty">
              <IconSearch size={32} style={{ opacity: .3, display: 'block', margin: '0 auto 8px' }} />
              <p style={{ fontWeight: 500 }}>Tapez pour rechercher</p>
              <p style={{ fontSize: 12, marginTop: 4 }}>Produits · Mouvements · Demandes · Catégories · Emplacements</p>
            </div>
          )}

          {/* Aucun résultat */}
          {(q || searchFilter !== 'all') && isEmpty && (
            <div className="search-empty">
              <IconSearch size={32} style={{ opacity: .3, display: 'block', margin: '0 auto 8px' }} />
              <p style={{ fontWeight: 500 }}>Aucun résultat pour &quot;{q}&quot;</p>
              <p style={{ fontSize: 12, marginTop: 4 }}>Essayez un terme différent ou changez le filtre</p>
            </div>
          )}

          {/* ── Produits ── */}
          {prods.length > 0 && (
            <>
              <div style={SH_LABEL}>
                <IconPackage size={12} style={{ color: 'var(--teal)' }} />
                Produits
                <span style={{ background: 'var(--teal)', color: '#fff', borderRadius: 20, padding: '1px 7px', fontSize: 9 }}>
                  {results.produits.length}
                </span>
              </div>
              {prods.map(p => {
                const idx = nextIdx()
                const st  = getStockStatus(p)
                const dColor = p.dept === 'IT' ? '#4f46e5' : '#10b981'
                const dBg    = p.dept === 'IT' ? '#eef2ff' : '#f0fdf4'
                return (
                  <SearchResultItem
                    key={p.id}
                    data-result
                    iconEl={<IconPackage size={15} style={{ color: dColor }} />}
                    iconBg={dBg}
                    title={p.nom}
                    sub={`${p.categorie} · ${p.emplacement || '—'} · ID: ${p.id}`}
                    rightTop={<span style={{ color: p.stock === 0 ? 'var(--red)' : 'var(--text)' }}>×{p.stock}</span>}
                    rightBadgeLabel={st.label}
                    rightBadgeColor={st.color}
                    rightBadgeBg={st.bg}
                    query={q}
                    selected={selectedIdx === idx}
                    onClick={() => goTo(`/stock/${p.dept === 'IT' ? 'it' : 'fin'}`, `stock-${p.dept === 'IT' ? 'it' : 'fin'}`, p.nom)}
                  />
                )
              })}
              {results.produits.length > 8 && (
                <div style={{ padding: '6px 16px', fontSize: 11, color: 'var(--text3)', background: 'var(--bg)' }}>
                  … et {results.produits.length - 8} autre(s)
                </div>
              )}
            </>
          )}

          {/* ── Mouvements ── */}
          {mvts.length > 0 && (
            <>
              <div style={SH_LABEL}>
                <IconArrowsExchange size={12} style={{ color: '#4f46e5' }} />
                Mouvements
                <span style={{ background: 'var(--teal)', color: '#fff', borderRadius: 20, padding: '1px 7px', fontSize: 9 }}>
                  {results.mouvements.length}
                </span>
              </div>
              {mvts.map(m => {
                const idx = nextIdx()
                const tc  = m.type === 'Entrée' ? '#16a34a' : '#dc2626'
                const tb  = m.type === 'Entrée' ? '#dcfce7' : '#fee2e2'
                return (
                  <SearchResultItem
                    key={m.id}
                    data-result
                    iconEl={<IconArrowsExchange size={15} style={{ color: tc }} />}
                    iconBg={tb}
                    title={m.produit_nom}
                    sub={`${m.type} · ${fmtDate(m.created_at || m.date)} · ${m.user_name}${m.destination ? ' → ' + m.destination : ''}`}
                    rightTop={<span>×{m.qty}</span>}
                    rightBadgeLabel={m.type}
                    rightBadgeColor={tc}
                    rightBadgeBg={tb}
                    query={q}
                    selected={selectedIdx === idx}
                    onClick={() => goTo(`/mouvements/${m.dept === 'IT' ? 'it' : 'fin'}`, `mvt-${m.dept === 'IT' ? 'it' : 'fin'}`, m.produit_nom)}
                  />
                )
              })}
              {results.mouvements.length > 6 && (
                <div style={{ padding: '6px 16px', fontSize: 11, color: 'var(--text3)', background: 'var(--bg)' }}>
                  … et {results.mouvements.length - 6} autre(s)
                </div>
              )}
            </>
          )}

          {/* ── Demandes ── */}
          {dems.length > 0 && (
            <>
              <div style={SH_LABEL}>
                <IconClipboardList size={12} style={{ color: '#f59e0b' }} />
                Demandes
                <span style={{ background: 'var(--teal)', color: '#fff', borderRadius: 20, padding: '1px 7px', fontSize: 9 }}>
                  {results.demandes.length}
                </span>
              </div>
              {dems.map(d => {
                const idx = nextIdx()
                const sc  = d.statut === 'Validé' ? '#16a34a' : d.statut === 'Refusé' ? '#dc2626' : '#d97706'
                const sb  = d.statut === 'Validé' ? '#dcfce7' : d.statut === 'Refusé' ? '#fee2e2' : '#fef3c7'
                return (
                  <SearchResultItem
                    key={d.id}
                    data-result
                    iconEl={<IconClipboardList size={15} style={{ color: sc }} />}
                    iconBg={sb}
                    title={d.produit}
                    sub={`${d.demandeur} · ×${d.qty} · ${fmtDate(d.created_at || d.date)} · ${(d.motif || '').slice(0, 40)}`}
                    rightBadgeLabel={d.statut}
                    rightBadgeColor={sc}
                    rightBadgeBg={sb}
                    query={q}
                    selected={selectedIdx === idx}
                    onClick={() => goTo(`/demandes/${d.dept === 'IT' ? 'it' : 'fin'}`, `dem-${d.dept === 'IT' ? 'it' : 'fin'}`, d.produit)}
                  />
                )
              })}
              {results.demandes.length > 6 && (
                <div style={{ padding: '6px 16px', fontSize: 11, color: 'var(--text3)', background: 'var(--bg)' }}>
                  … et {results.demandes.length - 6} autre(s)
                </div>
              )}
            </>
          )}
        </div>

        {/* ─── Footer ─── */}
        <div style={{
          padding: '9px 16px',
          borderTop: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--bg)',
        }}>
          <div style={{ display: 'flex', gap: 14, fontSize: 10, color: 'var(--text3)' }}>
            <span>
              <kbd style={{ background: '#f1f5f9', border: '1px solid var(--border)', borderRadius: 3, padding: '1px 5px', fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 600 }}>Ctrl</kbd>
              +
              <kbd style={{ background: '#f1f5f9', border: '1px solid var(--border)', borderRadius: 3, padding: '1px 5px', fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 600 }}>K</kbd>
              {' '}pour ouvrir
            </span>
          </div>
          <button
            onClick={handleClose}
            style={{ border: 'none', background: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font)' }}
          >
            ✕ Fermer
          </button>
        </div>
      </div>
    </div>
  )
}