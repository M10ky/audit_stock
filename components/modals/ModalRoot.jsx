'use client'
import { useUiStore } from '@/store/uiStore'
import MouvementModal from './MouvementModal'
import ProduitAddModal from './ProduitAddModal'
import ProduitEditModal from './ProduitEditModal'
import DemandeModal from './DemandeModal'
import ActifEditModal from './ActifEditModal'
import ActifHistoriqueModal from './ActifHistoriqueModal'
import ActifTransferModal from './ActifTransferModal'
import PretModal from './PretModal'
import DemandeAttributionModal from './DemandeAttributionModal'

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
    case 'edit-actif':
      return <ActifEditModal actif={modal.actif} />
    case 'actif-historique':
      return <ActifHistoriqueModal actif={modal.actif} />
    case 'actif-transfer':
      return <ActifTransferModal actif={modal.actif} />
    case 'pret':
      return <PretModal dept={modal.dept} />
    case 'dem-attribution':
      return <DemandeAttributionModal demande={modal.demande} produit={modal.produit} dept={modal.dept} />
    default:
      return null
  }
}