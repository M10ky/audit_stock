'use client'
import { useUiStore } from '@/store/uiStore'
import MouvementModal from './MouvementModal'
import ProduitAddModal from './ProduitAddModal'
import ProduitEditModal from './ProduitEditModal'
import DemandeModal from './DemandeModal'

export default function ModalRoot() {
  const modal = useUiStore(s => s.modal)
  if (!modal) return null

  switch (modal.type) {
    case 'entree':
    case 'sortie':
      return <MouvementModal mvtType={modal.type} dept={modal.dept} prodId={modal.prodId} />
    case 'add-produit':
      return <ProduitAddModal dept={modal.dept} />
    case 'edit-produit':
      return <ProduitEditModal dept={modal.dept} produit={modal.prod} />
    case 'demande':
      return <DemandeModal dept={modal.dept} />
    default:
      return null
  }
}