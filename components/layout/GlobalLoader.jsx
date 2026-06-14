'use client'
export default function GlobalLoader() {
  return (
    <div className="loader-overlay">
      <div className="spinner" style={{ width: 44, height: 44, borderWidth: 4 }} />
      <div className="loader-brand">Connecteo Stock</div>
      <div className="loader-sub">Chargement en cours…</div>
    </div>
  )
}