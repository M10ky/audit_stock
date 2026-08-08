'use client'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { useUiStore } from '@/store/uiStore'
import { useDataStore } from '@/store/dataStore'
import { fmtDTSplit, fmt } from '@/lib/helpers'
import { getHistoriqueActif } from '@/lib/actifs'
import ActifStatutBadge from '@/components/ui/badges/ActifStatutBadge'
import TypeBadge from '@/components/ui/badges/TypeBadge'

export default function ActifHistoriqueModal({ actif }) {
  const { closeModal } = useUiStore()
  const mouvements = useDataStore(s => s.mouvements)
  // TODO Étape F : passer les vrais prêts une fois le module disponible.
  const hist = getHistoriqueActif(actif, mouvements, [])

  const badgeFor = (h) => {
    if (h.kind === 'pret') {
      return <span className="badge" style={{ background: 'var(--indigo-l)', color: 'var(--indigo)' }}>{h.label}</span>
    }
    return <TypeBadge type={h.label} />
  }

  return (
    <Modal
      title={<>🕘 Historique — <code className="cell-mono">{actif.id}</code></>}
      size="lg"
      onClose={closeModal}
      footer={<Button variant="outline" onClick={closeModal}>Fermer</Button>}
    >
      <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>
        {actif.produit_nom} · Statut actuel : <ActifStatutBadge statut={actif.statut} />
        {actif.observation && (
          <div style={{ marginTop: 8, padding: '8px 10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11, whiteSpace: 'pre-line' }}>
            {actif.observation}
          </div>
        )}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="table">
          <thead>
            <tr><th>Date & Heure</th><th>Action</th><th>Qté</th><th>Valeur</th><th>Empl./Dest.</th><th>Agent</th><th>Détail</th></tr>
          </thead>
          <tbody>
            {hist.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 20, color: 'var(--text3)' }}>Aucun historique enregistré pour cet actif</td></tr>
            )}
            {hist.map((h, i) => {
              const { date, time } = fmtDTSplit(h.created_at)
              return (
                <tr key={i}>
                  <td className="col-date"><div className="dt-date">{date}</div><div className="dt-time">{time}</div></td>
                  <td>{badgeFor(h)}</td>
                  <td style={{ fontWeight: 600 }}>{h.qty ?? '—'}</td>
                  <td style={{ fontWeight: 700 }}>{h.valeur != null ? `${fmt(h.valeur)} MGA` : '—'}</td>
                  <td className="text-muted">{h.lieu || '—'}</td>
                  <td className="text-muted">{h.user || '—'}</td>
                  <td className="text-muted" style={{ maxWidth: 140, fontSize: 12 }}>{h.detail || ''}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Modal>
  )
}