'use client'
import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { useActifsStore } from '@/store/actifsStore'
import { useDataStore } from '@/store/dataStore'
import { useAuthStore } from '@/store/authStore'
import { useUiStore } from '@/store/uiStore'
import { createClient } from '@/lib/supabase/client'
import { buildActifNote } from '@/lib/actifs'

export default function ActifTransferModal({ actif }) {
  const supabase = createClient()
  const { closeModal, showToast } = useUiStore()
  const profile = useAuthStore(s => s.profile)
  const params = useDataStore(s => s.params)
  const changerEmplacementActif = useActifsStore(s => s.changerEmplacementActif)
  const loadActifs = useActifsStore(s => s.loadActifs)
  const emplacements = params.emplacements?.length ? params.emplacements : ['Stock Principal']
  const color = actif.dept === 'IT' ? 'var(--indigo)' : 'var(--green)'

  const [nouvel, setNouvel] = useState(actif.emplacement || emplacements[0])
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!nouvel || nouvel === actif.emplacement) return closeModal()
    setLoading(true)
    const note = buildActifNote(actif, `Transfert : ${actif.emplacement || '—'} → ${nouvel}`, profile?.name)
    const { error } = await changerEmplacementActif(supabase, actif.id, nouvel, note)
    setLoading(false)
    if (error) return showToast('Erreur : ' + error.message, 'error')
    showToast(`"${actif.id}" transféré vers ${nouvel}`)
    await loadActifs(supabase)
    closeModal()
  }

  return (
    <Modal
      title={`Changer l'emplacement de "${actif.id}"`}
      size="sm"
      onClose={closeModal}
      footer={
        <>
          <Button variant="outline" onClick={closeModal}>Annuler</Button>
          <Button loading={loading} style={{ background: color, borderColor: color }} onClick={handleSubmit}>✓ Transférer</Button>
        </>
      }
    >
      <div className="form-group">
        <label className="form-label">Emplacement actuel</label>
        <input className="form-input" value={actif.emplacement || '—'} disabled />
      </div>
      <div className="form-group">
        <label className="form-label">Nouvel emplacement</label>
        <select className="form-select" value={nouvel} onChange={e => setNouvel(e.target.value)}>
          {emplacements.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>
    </Modal>
  )
}