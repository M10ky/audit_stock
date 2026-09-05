This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
# audit_stock



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
  🐛 Dette identifiée en passant (non corrigée, hors périmètre de l'étape) :
  `DemandeModal.jsx` a un `return showToast('Erreur: ...')` sur échec réseau
  SANS `setLoading(false)` avant — le bouton resterait bloqué en spinner
  local après une erreur serveur (le verrou global se libère bien via le
  `finally` du wrapper, mais l'état `loading` local du composant, lui, reste
  à `true`). À corriger si on retouche ce fichier.
  ⚠️ Non couvert par cette étape (mutations mono-table jugées moins critiques,
  pas de RPC multi-table) : `ActifEditModal`, `ActifTransferModal`,
  `ProduitAddModal`, `ProduitEditModal`. Candidats mineurs pour une passe
  ultérieure si des doubles-clics y sont rapportés en usage réel.
  ⚠️ `DemandesTable.jsx` : le verrou global bloque bien la double-soumission
  logique sur validation/refus, mais AUCUN indicateur visuel de spinner par
  ligne n'a été ajouté (contrairement aux modales) — le tableau a un bouton
  par ligne, pas un unique bouton de soumission ; ajouter un état de
  chargement par ligne (ex: `loadingRowId`) si un retour visuel est demandé.

## Ce qui reste à faire (ordre proposé, non encore validé avec l'utilisateur)

- **Étape I** : page Rapports (`app/(app)/rapports/page.js` est un stub TODO)
  — reconstruire les ~11 KPI + 6 charts + 3 tableaux d'analyse détaillée
  (`js/reports.js: renderRapports()`). Fix aussi `AmortissementTable.jsx` qui
  semble déjà basé sur `ST.actifs` côté composant fourni — À REVÉRIFIER
  ligne par ligne contre `js/reports.js: renderAmortissement()` avant de
  clore ce point (le composant fourni dans ce fil a l'air correct mais n'a
  pas été audité aussi finement que les autres modules).
- **Étape J** : pages Utilisateurs et Paramètres (actuellement des stubs
  TODO) — admin uniquement, CRUD profils + rôles + listes de paramètres
  métier (destinations, catégories, emplacements, fournisseurs).
- **Étape K** : export CSV générique — `lib/csv.js` existe déjà (utilisé par
  `ActifsTable`/`PretsTable`) mais aucun bouton CSV sur Stock/Mouvements/
  Demandes/Alertes/Historique côté Next.js (le Vanilla en a partout via
  `js/export.js`).
- **Étape L** : recherche globale — `SearchOverlay.jsx`/`useSearch.js`
  n'indexent que produits/mouvements/demandes ; ajouter les sections Actifs
  et Prêts (le Vanilla a `sf-actifs`/`sf-prets` dans les filtres de
  l'overlay Ctrl+K). Realtime pour `parametres` et `profiles` à vérifier
  aussi (seuls `produits`/`mouvements`/`demandes`/`actifs_individuels`/
  `prets` sont branchés à ce stade).
- **Charts.js** : tous les composants `components/charts/ChartX.jsx` fournis
  retournent `null` (stubs TODO explicites "dynamic import no-SSR
  obligatoire") — aucun graphique Chart.js n'est réellement rendu nulle
  part dans le Next.js actuel, y compris dans le Dashboard existant. Ce
  chantier recoupe l'Étape I (Rapports) mais concerne aussi le Dashboard.
- **Étape H bis (optionnelle)** : étendre `withSubmitLock` à
  `ActifEditModal`/`ActifTransferModal`/`ProduitAddModal`/`ProduitEditModal`
  si jugé nécessaire, + corriger la dette `DemandeModal.jsx` (`setLoading`
  manquant sur la branche d'erreur), + indicateur visuel par ligne dans
  `DemandesTable.jsx` si demandé.

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
Démarrer la nouvelle conversation en collant cette fiche + redemander à
l'utilisateur quelle étape il souhaite traiter (I, J, K, L, ou H bis), en
rappelant le principe : plan-first, une étape à la fois, confirmation avant
de coder.