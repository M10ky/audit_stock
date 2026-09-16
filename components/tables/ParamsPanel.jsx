'use client'
import { useState } from 'react'
import {
  IconMapPin, IconPackage, IconDeviceLaptop, IconFiles,
  IconTruck, IconPlus, IconInfoCircle,
} from '@tabler/icons-react'
import { useDataStore } from '@/store/dataStore'
import { useAuthStore } from '@/store/authStore'
import { useUiStore } from '@/store/uiStore'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'

// 5e section ajoutée par rapport au Vanilla : dataStore.js charge déjà
// params.fournisseurs (consommé par ActifEditModal) mais aucune UI ne
// permettait de le gérer — jusqu'ici ajout/suppression nécessitaient un
// accès direct à la table `parametres` côté Supabase.
const SECTIONS = [
  { cle: 'destinations',  title: 'Destinations / Plateaux',  icon: IconMapPin,       color: 'var(--teal)',   placeholder: 'Ex: Plateau RH – 3ème étage…' },
  { cle: 'emplacements',  title: 'Emplacements de Stockage', icon: IconPackage,      color: '#6366f1',       placeholder: 'Ex: Stock Principal, Réserve B…' },
  { cle: 'categoriesIT',  title: 'Catégories IT',            icon: IconDeviceLaptop, color: 'var(--indigo)', placeholder: 'Nouvelle catégorie IT…' },
  { cle: 'categoriesFin', title: 'Catégories Finance',       icon: IconFiles,        color: 'var(--green)',  placeholder: 'Nouvelle catégorie Finance…' },
  { cle: 'fournisseurs',  title: 'Fournisseurs',             icon: IconTruck,        color: 'var(--amber)',  placeholder: 'Nom du fournisseur…' },
]

export default function ParamsPanel() {
  const supabase = createClient()
  const { params, addParam, removeParam } = useDataStore()
  const allProfiles = useAuthStore(s => s.allProfiles)
  const produits = useDataStore(s => s.produits)
  const { showToast } = useUiStore()

  const [inputs, setInputs] = useState({
    destinations: '', emplacements: '', categoriesIT: '', categoriesFin: '', fournisseurs: '',
  })
  const setInput = (cle, val) => setInputs(s => ({ ...s, [cle]: val }))

  const handleAdd = async (cle) => {
    const val = (inputs[cle] || '').trim()
    if (!val) return
    if (params[cle]?.includes(val)) return showToast('Valeur déjà existante', 'error')
    const { error } = await addParam(supabase, cle, val)
    if (error) return showToast('Erreur : ' + error.message, 'error')
    setInput(cle, '')
    showToast('Ajouté avec succès')
  }

  const handleRemove = async (cle, val) => {
    const { error } = await removeParam(supabase, cle, val)
    if (error) return showToast('Erreur : ' + error.message, 'error')
    showToast('Supprimé')
  }

  // Mirrors js/settings.js renderParams() (section « Informations système ») :
  // les 5 stats du Vanilla, dont Fournisseurs (ST.params.fournisseurs) — couleur
  // #0ea5e9 de la source de vérité (pas de variable CSS dédiée ici).
  const stats = [
    { label: 'Produits IT',      val: produits.filter(p => p.dept === 'IT').length,       color: 'var(--indigo)' },
    { label: 'Produits Finance', val: produits.filter(p => p.dept === 'Finance').length,  color: 'var(--green)' },
    { label: 'Utilisateurs',     val: allProfiles.length,                                 color: 'var(--amber)' },
    { label: 'Destinations',     val: (params.destinations || []).length,                 color: 'var(--teal)' },
    { label: 'Fournisseurs',     val: (params.fournisseurs || []).length,                 color: '#0ea5e9' },
  ]

  return (
    <>
      {SECTIONS.map(sec => {
        const items = params[sec.cle] || []
        const Icon = sec.icon
        return (
          <div key={sec.cle} className="param-section">
            <div className="param-title"><Icon size={16} style={{ color: sec.color }} /> {sec.title}</div>
            <div className="tag-list">
              {items.length === 0 && (
                <span className="text-muted" style={{ fontSize: 12 }}>Aucune valeur configurée</span>
              )}
              {items.map(v => (
                <div key={v} className="tag-item">
                  {v}
                  <span className="del" onClick={() => handleRemove(sec.cle, v)}>×</span>
                </div>
              ))}
            </div>
            <div className="tag-add-row">
              <input
                className="form-input"
                value={inputs[sec.cle]}
                onChange={e => setInput(sec.cle, e.target.value)}
                placeholder={sec.placeholder}
                onKeyDown={e => { if (e.key === 'Enter') handleAdd(sec.cle) }}
              />
              <Button style={{ background: sec.color, borderColor: sec.color }} icon={IconPlus} onClick={() => handleAdd(sec.cle)}>
                Ajouter
              </Button>
            </div>
          </div>
        )
      })}

      <div className="param-section" style={{ background: '#fafbff' }}>
        <div className="param-title"><IconInfoCircle size={16} style={{ color: '#6366f1' }} /> Informations système</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 10 }}>
          {stats.map((s, i) => (
            <div key={i} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 9, padding: 12, textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.val}</div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}