'use client'
import { useEffect, useState } from 'react'
import { useAuthStore }   from '@/store/authStore'
import { useDataStore }   from '@/store/dataStore'
import { useActifsStore } from '@/store/actifsStore'
import { usePretsStore }  from '@/store/pretsStore'
import { useAuth }        from '@/hooks/useAuth'
import { useRealtime }    from '@/hooks/useRealtime'
import { useInitialData } from '@/hooks/useInitialData'
import Sidebar          from './Sidebar'
import Topbar           from './Topbar'
import AppLoader        from '@/components/AppLoader'
import Toast            from '@/components/ui/Toast'
import ConfirmDialog    from '@/components/ui/ConfirmDialog'
import ModalRoot        from '@/components/modals/ModalRoot'
import SearchOverlay    from '@/components/search/SearchOverlay'

export default function AppLayout({ children }) {
  useAuth()
  useInitialData()
  useRealtime()

  const authLoading = useAuthStore(s => s.loading)
  const profile = useAuthStore(s => s.profile)

  const loadingProduits = useDataStore(s => s.loadingProduits)
  const loadingMouvements = useDataStore(s => s.loadingMouvements)
  const loadingDemandes = useDataStore(s => s.loadingDemandes)
  const loadingParams = useDataStore(s => s.loadingParams)
  const loadingMouvementsEntrees = useDataStore(s => s.loadingMouvementsEntrees)
  const loadingActifs = useActifsStore(s => s.loadingActifs)
  const loadingPrets = usePretsStore(s => s.loadingPrets)

  const [showLoader, setShowLoader] = useState(true)
  const [dataStarted, setDataStarted] = useState(false)
  const [seenLoads, setSeenLoads] = useState({})

  useEffect(() => {
    if (profile) setDataStarted(true)
  }, [profile])

  useEffect(() => {
    if (!dataStarted) return
    // mémorise les chargements observés : barre réelle, sans toucher aux stores
    setSeenLoads(prev => ({
      produits: prev.produits || loadingProduits,
      mouvements: prev.mouvements || loadingMouvements,
      demandes: prev.demandes || loadingDemandes,
      params: prev.params || loadingParams,
      entrees: prev.entrees || loadingMouvementsEntrees,
      actifs: prev.actifs || loadingActifs,
      prets: prev.prets || loadingPrets,
    }))
  }, [dataStarted, loadingProduits, loadingMouvements, loadingDemandes,
    loadingParams, loadingMouvementsEntrees, loadingActifs, loadingPrets])

  const activeLoads = [loadingProduits, loadingMouvements, loadingDemandes,
    loadingParams, loadingMouvementsEntrees, loadingActifs, loadingPrets]
  const dataReady = dataStarted && !activeLoads.some(Boolean)
  const ready = !authLoading && (!profile || dataReady)

  const seenCount = Object.values(seenLoads).filter(Boolean).length
  const progress = authLoading
    ? 12
    : !profile
      ? 100
      : !dataStarted
        ? 28
        : ready
          ? 100
          : Math.min(92, 28 + Math.round((seenCount / 7) * 64))

  const label = authLoading
    ? 'Initialisation…'
    : profile && !dataReady
      ? 'Synchronisation des données…'
      : 'Prêt'

  return (
    <>
      {showLoader && (
        <AppLoader
          label={label}
          progress={progress}
          ready={ready}
          onExited={() => setShowLoader(false)}
        />
      )}

      {!authLoading && (
        <div className="app-shell" aria-hidden={showLoader || undefined}>
          <Sidebar />
          <div className="main-content">
            <Topbar />
            <main className="page-body">{children}</main>
          </div>

          <Toast />
          <ConfirmDialog />
          <ModalRoot />
          <SearchOverlay />
        </div>
      )}
    </>
  )
}