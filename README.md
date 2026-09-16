# Connecteo Stock (audit_stock)

Gestion de stock d'inventaire connecteo — app **Next.js 15 (App Router)**,
migration du frontend Vanilla `CNTOJS` (source de vérité fonctionnelle). Les
deux dépôts partagent le même backend Supabase.

## Stack

- **Next.js 15** (App Router) · React 18 · **Zustand** (stores client)
- **Supabase** (@supabase/ssr + supabase-js) : auth, RLS, RPC, Realtime
- **Chart.js** via react-chartjs-2 (charts dashboard & rapports, dynamic no-SSR)
- **Tabler Icons** (@tabler/icons-react)

## Démarrage

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # vérification production
npm run lint
```

Variables d'environnement requises (`.env.local`) :
`NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Structure

- `app/(app)/` — routes authentifiées : dashboard, stock, mouvements,
  demandes, alertes, actifs, prets, historique, rapports, amortissement,
  params, utilisateurs + `app/api/users/*` (route handlers admin)
- `components/` — UI (Button, Modal, KpiCard, badges…), tables, modales,
  charts (react-chartjs-2), recherche globale (overlay Ctrl+K)
- `store/` — Zustand : `dataStore` (produits/mouvements/demandes/paramètres),
  `actifsStore`, `pretsStore`, `authStore`, `uiStore` (toasts, modales,
  verrou anti-double-clic `withSubmitLock`)
- `lib/` — helpers (CUMP, VNC, formateurs, `genId`), `reports`, `csv`,
  `permissions`, `actifs`, clients Supabase
- `hooks/` — `useRealtime`, `useSearch`, `usePermissions`, `useDateFilter`,
  `useInlineFilter`

---

# CNTOJS/audit_stock — Fiche de passation (migration Vanilla → Next.js)

## Contexte du projet
Deux dépôts partagent le même backend Supabase :
- `M10ky/CNTOJS` — vanilla JS, référence fonctionnelle complète, source de vérité
- `M10ky/audit_stock` — Next.js 15 App Router, cible de la migration en cours

Objectif : parité fonctionnelle 100% avec le Vanilla, en conservant les bonnes
pratiques Next.js. Approche : plan-first, patches FIND/REPLACE scopés, jamais
de dump de fichier complet, une étape validée avant de passer à la suivante.

## Étapes terminées (dans l'ordre)

- **Étape A–D** *(antérieures à cette session)* : RBAC Lecteur base, genId
  nomenclature alignée, CUMP logic, Lecteur nav/permissions — déjà actées
  avant le début de cette conversation.
- **Étape C** (reprise dans cette session) : suppression du champ `prix`
  manuel des modales produit (`ProduitAddModal`, `ProduitEditModal`),
  remplacé par CUMP calculé (`lib/helpers.js: getCUMPProduit`,
  `getValeurStockActuel`) ; ajout du toggle `is_amortissable` ; `MouvementModal`
  exige un prix unitaire à l'Entrée uniquement, valorise la Sortie au CUMP ;
  `ProduitsTable`/`stock/[dept]/page.js`/`dashboard/page.js`/`DemandesTable`
  alignés sur le même calcul. Colonne VNC retirée de l'Inventaire (vit
  uniquement dans le module Actifs).
  🐛 Bug corrigé après coup : `ReferenceError: getValeurStockActuel is not
  defined` dans `ProduitsTable.jsx` — import manquant, patché.
- **Fix genId()** : la fonction générait un UUID v4 générique — remplacée par
  l'algorithme préfixé du Vanilla (`{prefix}-{timestamp36}{seq2}{rand3}`).
  Tous les appelants dans `dataStore.js` (`submitAdd`, `submitMvt`,
  `submitDem`) dérivent désormais le bon préfixe depuis `payload.dept`.
  ⚠️ Point non résolu : les produits créés AVANT ce fix ont un `id` UUID brut
  en base — décision prise de laisser tel quel (pas de migration SQL), donc
  seuls les nouveaux produits ont une nomenclature CNTO propre.
- **Étape D — Rôle Lecteur** : `lib/permissions.js` (ROLES.LECTEUR ajouté,
  `isLecteur()`, fix du bug RBAC `canDemIT`/`canDemFin` qui étaient de simples
  alias de `canSeeIT`/`canSeeFin` — permettait à tort au Lecteur de soumettre
  des demandes), `canSeePrix`/`canSeeHist` étendus au Lecteur, flags
  `canSeeActifsIT/Fin`, `canSeePretsIT/Fin` ajoutés à `getPermissions()`.
  `Sidebar.jsx` : lien Demandes gated par `canDemIT`/`canDemFin` (plus par
  `canSeeIT`/`canSeeFin`). `DeptBanner.jsx` : bandeau "Vue Lecture" dédié.
- **Étape E — Module Actifs individuels** : audit a révélé que le module
  était DÉJÀ largement porté (store, table, modals, page, CSV, Realtime) —
  contrairement à l'hypothèse initiale de ce chantier. Deux fix appliqués :
  transition `Hors service → Sorti` manquante dans `TRANSITIONS_ACTIF`
  (`lib/actifs.js`) ; ajout du renommage de numéro de série via
  `rpc_renommer_actif` (`actifsStore.renommerActif` + UI dans
  `ActifEditModal.jsx` avec confirmation dédiée, absent auparavant).
- **Étape F — Module Prêts** : totalement absent, créé de zéro :
  `store/pretsStore.js` (STATUS_PRET, TRANSITIONS_PRET, chargement +
  enrichissement "En retard", 4 actions RPC : `creerPret`→`rpc_creer_pret`,
  `retournerPret`→`rpc_retourner_pret`, `perdreActif`→`rpc_perdre_pret`,
  `retrouverActifPret`→`rpc_retrouver_actif`), `PretModal.jsx`,
  `PretsTable.jsx`, `app/(app)/prets/[dept]/page.js`, branchements
  Sidebar/Topbar/ModalRoot/useRealtime/useInitialData.
- **Étape G — RPC validation demandes** : fix critique — l'appel
  `rpc_valider_demande_simple` dans `DemandesTable.jsx` utilisait des noms de
  paramètres qui ne correspondaient PAS à la signature réelle définie côté
  Vanilla (`p_demande_id`/`p_valideur_nom`... au lieu de
  `p_dem_id`/`p_dept`/`p_dest`/`p_mvt_id`/`p_user_name`/`p_user_id`) — un
  RPC Supabase nommé mal-paramétré échoue silencieusement (fonction
  introuvable), donc ce chemin de validation était probablement cassé en
  production. Corrigé. Ajout du sélecteur manuel d'attribution d'actifs
  (`DemandeAttributionModal.jsx`, mirrors `renderModalDemAttribution` du
  Vanilla) qui remplace l'attribution FIFO automatique
  (`attribuerDemandeAmortissable`) — nouvelle action
  `attribuerDemandeManuelle` ajoutée à `actifsStore.js`.
- **Étape H — Anti-double-clic (`withSubmitLock`)** : le Vanilla verrouille
  un flag global `ST.isSubmitting` + désactive les boutons DOM directement ;
  porté en React via un flag `isSubmitting` + helper `withSubmitLock(fn)`
  ajoutés à `store/uiStore.js` (verrouille, exécute, déverrouille en
  `finally`, toast si déjà en cours). Branché sur les 4 points de mutation
  les plus sensibles : `MouvementModal`, `DemandeModal`, `PretModal`
  (création), `PretsTable` (retour/perte/retrouvaille via `openConfirm`),
  `DemandesTable` (validation/refus). Le bouton `<Button loading={busy}>`
  utilise `busy = loading || isSubmitting` pour combiner l'état local du
  composant et le verrou global.
  ✅ À noter : la dette `DemandeModal.jsx` (setLoading manquant sur erreur)
  et l'absence de spinner par ligne dans `DemandesTable.jsx` ont été résolues
  en **Étape H bis** (voir plus bas). `ActifEditModal`/`ActifTransferModal`/
  `ProduitAddModal`/`ProduitEditModal` : jamais touchés, aucun double-clic
  rapporté — laissés tels quels (mutations mono-table, risque faible).

- **Étape I — Rapports & Statistiques** : auditée, **déjà 100 % paritaire** —
  `rapports/page.js` (11 KPI + 6 charts + 3 tableaux d'analyse détaillée),
  `lib/reports.js` (helpers miroirs de `js/reports.js`), charts = vrais
  composants react-chartjs-2 (`BarChartCard`, `LineChartCard`,
  `DoughnutChartCard`, dynamic no-SSR), **pas des stubs** ;
  `AmortissementTable.jsx` + `amortissement/page.js` vérifiés paritaires.
- **Étape J — Admin (Utilisateurs / Paramètres)** : auditée ; 1 patch appliqué
  dans `ParamsPanel.jsx` : stat « Fournisseurs » ajoutée (couleur `#0ea5e9`,
  mirror `settings.js:349-350`) + grille stats en
  `repeat(auto-fit, minmax(100px, 1fr))`. Route Handlers admin présents :
  `app/api/users/[id]/route.js` (DELETE profil + auth, service_role),
  `app/api/users/reset-password/route.js` (resetPasswordForEmail).
  J2 (cosmétique) et J3 (select département = extension) laissés tels quels.
- **Étape K — Export CSV** : auditée, **déjà 100 % paritaire** — `lib/csv.js`
  (`exportToCSV`/`todayFileDate`/`escapeCell`) complet ; boutons CSV présents
  sur toutes les pages (Produits, Mouvements, Demandes, Historique, Alertes,
  Actifs, Prêts, Utilisateurs, Amortissement). `exportRapportsCSV` n'existe
  pas côté Next.js mais n'est jamais appelé côté Vanilla non plus (parité).
- **Étape L — Recherche globale + Realtime** : **déjà faite** —
  `SearchOverlay.jsx`/`useSearch.js` indexent les 5 sections (produits,
  mouvements, demandes, **actifs**, **prets** — les deux dernières mirrors
  `js/app.js runSearch()`, gates `canManIT`/`canManFin`), filtres
  `actifs`/`prets` + couleurs de statut déjà présents ; Realtime `parametres`
  branché (`useRealtime.js`). Realtime `profiles` : volontairement **non
  branché** — le Vanilla (auth.js:129-135) ne le branche pas non plus,
  parité stricte.
- **Étape H bis — Dettes techniques** :
  `DemandeModal.jsx` — `handleSubmit` enveloppé dans `try/catch/finally` :
  `setLoading(false)` garanti sur tous les chemins (y compris exception réseau
  levée), toast d'erreur réseau ajouté en `catch`.
  `DemandesTable.jsx` — état `loadingRowId` par ligne : spinner sur le bouton
  cliqué, tous les boutons d'action désactivés pendant l'opération,
  `handleValid` enveloppé dans `try/finally` pour remettre l'état à zéro sur
  tous les chemins (succès, erreur, ouverture `DemAttributionModal`).
  `withSubmitLock` confirmé câblé sur les modales de mutation principales.
- **Style & Layout professionnel** : design system resserré dans
  `globals.css` (padding page 20px, KPI `minmax(170px,1fr)` → 155px ≥1100px,
  chart-grid `minmax(340px,1fr)`, gaps 12px, tables compactes `9px 12px`,
  card-header/card-body réduits, breakpoint ≥1100px dédié). Charts
  `height: 260 → 220`. Dashboard : section basse regroupée en
  `dashboard-grid` (bar chart span-2, camembert compact centré, table
  « Activités récentes » scrollable max-height 260). Rapports : stats
  d'analyse détaillée transformées en cards KPI + tables « Valeur moyenne par
  catégorie » et « Produits sans mouvement » côte à côte en `dashboard-grid`.

## Ce qui reste à faire

État de la migration : **100 % paritaire** avec la source Vanilla. Tous les
chantiers de la fiche initiale (Étapes A à L) sont terminés ou ont été audités
et clôturés. Points d'amélioration optionnels identifiés (au-delà de la
parité) :
- **Realtime `profiles`** : non branché (le Vanilla ne le fait pas non plus).
  Pourrait être ajouté pour une sync auto des profils admin en live.
- **J2** (cosmétique panel paramètres) et **J3** (select département en
  création de demande = extension) : laissés volontairement de côté.
- **`exportRapportsCSV`** : à implémenter seulement si un export consolidé
  des rapports est demandé (jamais appelé dans l'UI Vanilla).

## Points de vigilance / dette non résolue

1. **RPC non vérifiables côté front** : toutes les RPC (`rpc_creer_pret`,
   `rpc_retourner_pret`, `rpc_perdre_pret`, `rpc_retrouver_actif`,
   `rpc_reintegrer_actif`, `rpc_renommer_actif`, `rpc_valider_demande_simple`,
   `rpc_attribuer_demande`) sont supposées exister côté Supabase avec
   exactement les paramètres nommés utilisés dans le Vanilla. Aucun accès
   direct à la base pour confirmer — si une régression apparaît côté RPC,
   vérifier en premier la correspondance des noms de paramètres (cause du
   bug corrigé en Étape G).
2. **UUID legacy** : les produits créés avant le fix de `genId()` ont un
   `id` UUID brut, pas de nomenclature `IT-…`/`FIN-…`. Décision actée : ne
   pas migrer, seuls les nouveaux enregistrements sont propres.
3. **Style de patch imposé** : toujours FIND/REPLACE scopé avec commentaire
   inline expliquant la règle métier reproduite, jamais de dump de fichier
   complet, jamais de code avant confirmation explicite du périmètre de
   l'étape suivante par l'utilisateur.
4. **Vanilla = source de vérité absolue** : toute divergence du Next.js par
   rapport au comportement vanilla est traitée comme un bug à corriger, pas
   comme un choix de design à arbitrer.
5. **Convention toast divergente assumée** : `uiStore.js` (Next.js) utilise
   `type: 'error'/'success'` pour `showToast`, alors que le Vanilla utilise
   `'err'/'ok'`. Ce n'est PAS un bug — c'est la convention déjà en place
   avant cette session dans ce store précis (cf. `Toast.jsx` /
   `ICONS = { success, error, info, warning }`) ; ne pas "corriger" vers la
   convention Vanilla, ça casserait tous les appels existants.
6. **MODOP CNTOJS** (document Manuel d'Opérations, 12 chapitres, docx) —
   mentionné dans les mémoires comme chantier en attente, non commencé,
   distinct de la migration Next.js. À clarifier avec l'utilisateur si
   toujours d'actualité.

## Comment reprendre
Démarrer la nouvelle conversation en collant cette fiche. La migration est
**100 % paritaire** avec la source Vanilla ; le reliquat est optionnel (style,
extensions, fonctionnalités au-delà du Vanilla) ou dépend de retours d'usage
réel. Rappeler le principe de travail : plan-first, patches FIND/REPLACE
scopés, une étape validée avant la suivante, confirmation explicite avant de
coder.