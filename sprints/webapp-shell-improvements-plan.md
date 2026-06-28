# Webapp Shell Improvements — Sprint Plan

> **Status:** Phases 1–2, 4, 6–9 validées · prochaine : Phase 3  
> **Created:** 2026-06-27  
> **Last updated:** 2026-06-27  
> **Branch suggérée:** `feature/webapp-shell-improvements`  
> **Scope:** Navigation, compte connecté, permissions menu, templates notifications, config école, seeding, pagination, états vides  
> **Related docs:** [`specs/app-shell-spec.md`](../specs/app-shell-spec.md), [`specs/design-language-spec.md`](../specs/design-language-spec.md), [`sprints/done/app-shell-gap-closure-plan.md`](./done/app-shell-gap-closure-plan.md)

---

## Progress tracker

Cocher quand la phase (ou sous-phase) est terminée et mergée.

- [x] **Phase 1** — Navigation (Matières classe, Staff → École)
- [x] **Phase 2** — Compte connecté (modale profil)
- [ ] **Phase 3** — Permissions menu (3.0 ✅ · 3.2 professeur ✅ · 3.1/3.3–3.5 restants)
- [x] **Phase 4** — États vides + audit boutons
- [x] **Phase 9** — CRUD complet (ajout / modification / suppression)
- [ ] **Phase 5** — Templates notifications + invitations
- [x] **Phase 6** — Seeding élèves étendu
- [x] **Phase 7** — Configuration école
- [x] **Phase 8** — Pagination API (default 50) + webapp

---

## Phase 1 — Navigation

**Effort estimé :** 1–2 h  
**PR suggérée :** `feature/nav-menu-cleanup`

### 1.1 Retirer l’onglet « Matières » du menu Classe

Redondant avec « Enseignements » (`tab.teaching`).

- [x] Supprimer l’entrée `subjects` de `CLASS_ITEMS` dans `apps/webapp/src/lib/navigation.ts`
- [x] Redirect `/classes/[classId]/subjects` → `/classes/[classId]/teaching` (`+page.ts`)
- [x] Vérifier qu’aucun lien interne ne pointe encore vers l’onglet Matières (`detail-hrefs.classSubject` → teaching)
- [x] Smoke test : navigation Classe → Enseignements OK

**Fichiers clés :** `navigation.ts`, `app-navigation.ts`, `routes/(app)/classes/[classId]/subjects/`

> **Note :** le catalogue matières en **Configuration** (`config.subjects`) reste — seul l’onglet **classe** est retiré.

### 1.2 Déplacer « Staff » de Configuration → menu École

- [x] Retirer `{ key: 'staff', … }` de `CONFIG_ITEMS`
- [x] Ajouter l’entrée staff dans `SCHOOL_ITEMS` (libellé + icône + href)
- [x] Href par défaut Configuration inchangé (`configuration/subjects`)
- [x] Route migrée vers `school/staff/[[id]]` ; redirect legacy `configuration/staff/[[id]]`
- [x] Mettre à jour `detail-hrefs.ts`, `detail-routes.ts`, `detail-route-patterns.ts`
- [x] Smoke test : accès staff depuis menu École, drawer et modals OK

**Fichiers clés :** `navigation.ts`, `detail-hrefs.ts`, routes staff

---

## Phase 2 — Compte connecté (modale profil)

**Effort estimé :** 4–6 h  
**PR suggérée :** `feature/account-profile-modal`

**État actuel :** zone profil cliquable → `AccountProfileModal` ; retour modale après sauvegarde notifications (`?return=profile`).

### 2.1 Zone cliquable dans le header

- [x] Remplacer le `<div>` profil par un `<button>` cliquable (hover, focus, `cursor-pointer`)
- [x] Ouvrir une modale au clic (pas de navigation full-page)

### 2.2 Modale `AccountProfileModal`

- [x] Créer `apps/webapp/src/lib/components/account/AccountProfileModal.svelte`
- [x] Section **Profil** : nom, rôle, département (read-only pour l’instant)
- [x] **Email de connexion** : `authSession.loginEmail` — seul champ **grisé** (`text-muted-foreground`, `bg-secondary/30`, non éditable)
- [x] Email métier / notification : affiché normalement si distinct du login
- [x] Raccourcis : boîte de réception, préférences notifications
- [x] Action déconnexion (réutiliser la logique `logout` du layout)
- [x] i18n : clés FR/EN pour les libellés modale
- [x] Retour modale profil après sauvegarde email notification (sans refresh)

### 2.3 Intégration layout

- [x] Brancher la modale dans `(app)/+layout.svelte`
- [x] Icônes inbox/settings **retirées** du header (raccourcis dans la modale profil uniquement)
- [x] Vérifier rendu staff et guardian (`authSession.accountActor`)
- [x] Smoke test : ouverture modale, email login grisé, liens inbox/notifications

**Données :** `authSession.accountActor`, `authSession.loginEmail`, `authSession.userProfile`, `authSession.guardianSettings`

---

## Phase 3 — Menu selon permissions

**Effort estimé :** 4–8 h (découpé par profil)  
**PR suggérée :** `feature/nav-permissions`

**Objectif :** chaque utilisateur connecté ne voit et n’accède qu’aux entrées autorisées par ses droits effectifs (`authSession.grants`).

### 3.0 — Infrastructure (partagée)

- [x] `permissions?: PermissionCode[]` (any-of) sur `ContextItem` dans `navigation.ts`
- [x] Mapper les permissions par entrée sidebar (aligné domaine API + seed dev)
- [x] `nav-permissions.ts` — `canAccessNavItem`, `filterNavItems`, `visibleNavModules`, `canAccessPath`
- [x] Filtrer items + modules dans `AppSidebar.svelte`
- [x] Masquer un module entier si aucun sous-item visible
- [x] Dashboard + compte toujours accessibles
- [x] Garde route dans `(app)/+layout.svelte` (redirect dashboard si URL interdite)
- [x] Tests unitaires `nav-permissions.test.ts`

**Fichiers :** `navigation.ts`, `navigation/nav-permissions.ts`, `AppSidebar.svelte`, `(app)/+layout.svelte`

### 3.1 — Directeur / owner (`isElevated`)

- [x] Aucun code spécifique — `hasPermission` retourne `true` pour tout si `grants.isElevated`
- [ ] Test manuel : `c.moreau@school.edu` — menu complet

### 3.2 — Professeur (`role-teacher`) ✅ premier profil livré

Compte dev : `m.dupont@school.edu` (st1)

**Menu attendu :**

| Zone | Visible |
|------|---------|
| Dashboard | ✅ |
| École — élèves, responsables, calendrier, activités, incidents | ✅ |
| École — staff, annonces | ❌ |
| Classe — tous les onglets | ✅ |
| Finance | ❌ (module entier) |
| Configuration | ❌ (module entier) |

- [x] Filtrage sidebar + garde route validés par tests unitaires (permissions seed `role-teacher`)
- [ ] Test manuel connecté en professeur

### 3.3 — Prof principal (`role-coordinator`)

Compte dev : `m.leon@school.edu` (st3)

- [ ] Valider menu : école élargie + staff + config partielle (sans finance complète si absent des droits)
- [ ] Ajuster mappings si écart seed / UX

### 3.4 — Éducateur (`role-educator`)

Compte dev : `t.evrard@school.edu` (st7)

- [ ] Menu discipline / présence / élèves — pas finance ni config admin

### 3.5 — Tuteur (`sessionKind === 'guardian'`)

Compte dev : `c.laurent@mail.com` (g1)

- [ ] Shell guardian distinct (sidebar réduite ou layout dédié) — hors scope 3.0–3.2

**État actuel :** `PermissionGate` sur les actions ; navigation filtrée depuis 3.0 + profil professeur (3.2).

---

## Phase 4 — États vides + audit boutons

**Effort estimé :** 1–2 jours  
**Dépend de :** rien (mais l’audit boutons profite de la correction empty state)

### 4.1 États vides : conserver header + CTA

**Problème :** `DataState` remplace tout le contenu quand `status === 'empty'`, masquant `ListPageHeader` et le bouton Ajouter — contraire à `app-shell-spec.md` § UX risks.

**Solution livrée :** prop `preserveShell` sur `DataState.svelte` + helper `listPageHasItems()` dans `page-status.ts` pour que les routes liste passent en `ready` après load même sans items ; états vides in-collection dans les vues.

- [x] `DataState.svelte` — prop `preserveShell` (empty rend quand même `children()`)
- [x] `page-status.ts` — `listPageHasItems()` pour queries liste
- [x] Queries migrées : `people`, `subjects`, `school-life`, `finance`, `academic`, `assessments`, `homework`, `access`, `report-cards`, `notification-templates`
- [x] `preserveShell` sur **24 routes liste** (voir liste ci-dessous)
- [x] États vides in-collection : `GradeScalesView`, `FinanceView` (billing + fees) ; autres vues déjà OK
- [x] Exclu volontairement : `dashboard`, `configuration/school`, `account/inbox`, `account/notifications`

**Routes `preserveShell` :**

| Zone | Routes |
|------|--------|
| École | `school/students`, `guardians`, `staff`, `calendar`, `activities`, `announcements`, `events` |
| Classe | `classes/[classId]/students`, `evaluations`, `homework`, `teaching`, `timetable`, `report-cards` |
| Config | `configuration/subjects`, `subjects/level`, `classes`, `academic`, `grade-scales`, `roles`, `report-cards`, `notifications` |
| Finance | `finance/fees`, `billing`, `payment` |

**Test :** `?demo=empty` sur une route liste → header + CTA visibles, message vide in-collection.

### 4.2 Audit boutons Ajouter / Modifier

Spec : CTA liste → modal create ; drawer → Edit → modal.

| Module | CTA create | Edit drawer | Conforme |
|--------|------------|-------------|----------|
| Élèves (école + classe) | Modal (`StudentCreateModal`) | Modal (`StudentProfileEditModal`) | ✅ |
| Responsables | Modal (`GuardianCreateModal`) | Modal (`GuardianEditModal`) | ✅ |
| Staff | Modal (`StaffCreateModal`) | Modal (`StaffProfileEditModal`) | ✅ |
| Annonces, activités, événements | Modal (`*FormModal`) | Modal dans drawer | ✅ |
| Finance (frais, facturation) | Modal (`FeeFormModal`, `AssignFeeFormModal`) | Drawer facturation | ✅ |
| Config (matières, classes, rôles, bulletins) | Modal sauf catalogue matières (lecture) et rôles (fixes) | Drawer / inline selon écran | ⚠️ voir écarts |
| Classe (devoirs, évaluations, emploi du temps) | Modal (`EvaluationCreateModal`, `PlanningFormModal`, …) | Modal dans drawer | ✅ |

**Écarts documentés (pas de fix Phase 4 — comportement métier ou Phase 5+) :**

- `ConfigSubjectsView` : catalogue config en lecture ; création matière au niveau **classe** (`SubjectsView`).
- `RolesMatrixView` : rôles fixes, pas de CTA create.
- `ReportCardDefinitionsView` : pas encore de CTA « Nouveau modèle » (hors scope empty state).
- `PaymentsView` : pas de create liste ; enregistrement via facturation.
- `NotificationTemplatesView` : édition par carte, refactor liste Phase 5.

---

## Phase 5 — Templates notifications + invitations

**Effort estimé :** 1–2 jours  
**Related :** [`sprints/done/notification-templates-plan.md`](./done/notification-templates-plan.md)

**État actuel :** `NotificationTemplatesView.svelte` — grille de cartes, pas le pattern liste + drawer de la spec.

### 5.1 Conformité app-shell

- [ ] Refactor en **liste** (`ListPageHeader` + table/cards)
- [ ] **Drawer read-only** pour aperçu d’un template
- [ ] **Modal edit** : réutiliser / adapter `NotificationTemplateEditModal.svelte`
- [ ] Bouton « Réinitialiser tout » dans header ou menu « Plus »
- [ ] `PermissionGate` : `SCHOOL_LIFECYCLE_MANAGE`

### 5.2 Templates par défaut (seed / bootstrap)

- [ ] Vérifier présence des defaults au bootstrap école (toutes clés du catalogue)
- [ ] Ajouter / compléter le seed si manquant (`account_invitation`, annonces, notes, etc.)
- [ ] Test : école neuve → templates éditables sans erreur

### 5.3 Templates invitations (workflows)

Gérer le contenu des workflows d’invitation via la clé `account_invitation` du catalogue.

- [ ] Section ou filtre **Invitations** mise en avant dans l’écran
- [ ] Variables documentées : `schoolName`, `inviteeName`, `inviteUrl`, `expiresAt`, `actorKind`
- [ ] Aperçu rendu (email subject/body) fonctionnel
- [ ] Smoke test : édition + reset template invitation

**Fichiers clés :** `NotificationTemplatesView.svelte`, `notification-templates/catalog.ts`, seeding communications, `notification-templates.mutations.ts`

---

## Phase 6 — Seeding élèves étendu

**Effort estimé :** 4–8 h

**État actuel :** ~30 élèves narratifs + **970 élèves bulk générés** = **1000 total** (`population-generator.ts`).

- [x] Définir cible (**1000 élèves** répartis sur classes narrative + bulk)
- [x] Générer programmatically dans `dev-fixtures` (`population-generator.ts`)
- [x] Ajouter guardians associés par lot (1 tuteur / élève bulk, g22–g991)
- [x] `population/workflow.ts` inchangé (itère `SEED_STUDENTS` / `SEED_GUARDIANS`)
- [x] Mettre à jour `seed-validation-harness` + tests
- [x] Narratif s1–s30 conservé (finance, notes, présences, bulletins)
- [x] `bun run` seed dev local OK + badges sidebar (élèves, tuteurs, personnel)

**Fichiers clés :** `testing/dev-fixtures/src/population-seed.ts`, `testing/seeding/src/population/`

---

## Phase 7 — Configuration école

**Effort estimé :** 2–3 jours  
**Dépend de :** Phase 3 (permissions menu) recommandée

**État actuel :** route `configuration/school` livrée ; fiche read-only + modal edit ; `authSession.school` alimenté depuis l’API via `academicContext` (plus de mock). Champs API : nom, type, ville, pays, fuseau (`America/Toronto` / Ottawa) — pas de logo ni contacts côté API.

- [x] Route `configuration/school` + entrée menu Configuration (`config.school`)
- [x] Fiche unique : nom, nom court dérivé, type, ville, pays, fuseau horaire
- [x] Chargement : `schools.get` (profil école courante)
- [x] Sauvegarde : mutation `schools/save` + toast
- [x] Modal edit (spec app-shell) — `PermissionGate` `SCHOOL_LIFECYCLE_MANAGE`
- [x] Alimenter `authSession.school` et `SchoolSelector` depuis l’API (`academicContext.updateSchool`)
- [x] i18n FR/EN
- [x] Smoke test : modification nom école visible dans header/sidebar

**Fichiers clés :** `SchoolSettingsView.svelte`, `configuration/school/+page.svelte`, `school-data.ts`, `school.mutations.ts`, `school.queries.ts`, `shell-data.ts`, `session.svelte.ts`, `navigation.ts`

---

## Phase 8 — Pagination API (default 50) + webapp

**Effort estimé :** 3–5 jours  
**Dépend de :** Phase 6 recommandée (volume de test)  
**État :** livré pour les listes people (école). Facturation et autres collections volumineuses : reportées (voir §8.2).

### 8.1 API

- [x] Constante `DEFAULT_LIST_LIMIT = 50` dans `apps/api/src/lib/school-api/pagination.ts`
- [x] Appliqué dans `executeEntityList` quand `$limit` absent (cap à 500)
- [x] Offset via `$offset` (pas de cursor)
- [x] Fix tri Postgres : `asc(col)` / `desc(col)` dans `postgres-store.ts` (Drizzle 0.39)
- [x] Tests API : `test-entity-list-pagination.test.ts`
- [x] Exemple GraphiQL : `limit: 50`, `offset: 0`, `orderBy` lastName/firstName

### 8.2 Webapp

- [x] Helper `paginatedList({ limit, offset, orderBy })` dans `entity-list-filters.ts`
- [x] Hook `useOffsetPaginatedList` + composant `ListPagination` (50/page, URL `?page=`)
- [x] i18n pagination (`list.pageRange`, `list.previousPage`, …)
- [x] Listes migrées (pagination par pages, plus de scroll infini) :
  - [x] Élèves école (`SchoolStudentsView`)
  - [x] Responsables (`GuardiansView`)
  - [x] Personnel (`StaffView`)
  - [ ] Facturation — volume seed modéré ; KPI agrégés + modale assignation nécessitent encore chargement groupé
  - [ ] Autres collections scalables (annonces, activités, config matières…) — hors scope sprint
- [x] Badges sidebar : totaux élèves / tuteurs / personnel (`shell-data` + `AppSidebar`)
- [x] Validation seed via `/count` (plus via list length)
- [x] Smoke test seed 1000 : pagination 20 pages, total header + badges sidebar cohérents

**Fichiers clés :** `use-paginated-list.svelte.ts`, `ListPagination.svelte`, `list-url-filters.ts` (`page`), `shell-data.ts`, `AppSidebar.svelte`, `postgres-store.ts`, `graphiql.ts`

---

## Phase 9 — CRUD complet (Ajouter / Modifier / Supprimer)

**Effort estimé :** 2–3 jours  
**Dépend de :** Phase 4 (audit boutons)

**Objectif :** garantir que chaque entité liste/drawer expose les actions CRUD attendues par `app-shell-spec.md` (CTA create en liste, edit + delete en drawer, confirm modal pour suppression).

### 9.1 Infrastructure

- [x] `DeleteEntityButton.svelte` + `ConfirmModal` (style destructif)
- [x] `delete-entity.mutations.ts` — mutations API `entities.*.delete` + rollback store
- [x] `navigate-after-delete.ts` — fermeture drawer URL après suppression
- [x] i18n `common.delete`, confirm/toast par module

### 9.2 Boutons Ajouter (écarts Phase 4)

- [x] `ReportCardDefinitionsView` — CTA « Nouveau modèle » + `ReportCardDefinitionFormModal`
- [x] `createReportCardDefinitionMutation` dans `report-cards.mutations.ts`

### 9.3 Boutons Supprimer (drawers + listes)

| Entité | Drawer / vue | Mutation | Permission |
|--------|--------------|----------|------------|
| Tuteur | `GuardianDetail` | `deleteGuardianMutation` | `PARENT_UPDATE` |
| Staff | `StaffTabs` | `deleteStaffMemberMutation` | `STAFF_UPDATE` |
| Frais | `FeeDetail` | `deleteFeeMutation` | `FINANCIAL_CONFIG_CONFIGURE` |
| Facture | `BillingDetail` | `deleteStudentFeeMutation` | `FINANCIAL_CONFIG_CONFIGURE` |
| Devoir | `DeadlineDetail` | `deleteHomeworkMutation` | `GRADE_INPUT` |
| Évaluation | `EvaluationDetail` | `deleteAssessmentMutation` | `GRADE_INPUT` |
| Séance | `PlanningDetail` | `deleteSessionMutation` | `TIMETABLE_UPDATE` |
| Activité | `ActivityDetail` | `deleteActivityMutation` | `DISCIPLINE_CREATE` |
| Annonce (brouillon) | `AnnouncementDetail` | `deleteAnnouncementMutation` | `COMMUNICATION_CREATE` |
| Incident | `IncidentDetail` | `deleteIncidentMutation` | `DISCIPLINE_UPDATE` |
| Matière classe | `SubjectTabs` | `deleteClassSubjectMutation` | — |
| Modèle bulletin (brouillon) | `ReportCardDefinitionDetail` | `deleteReportCardDefinitionMutation` | `REPORT_CARD_CONFIGURE` |
| Barème | `GradeScalesView` (carte) | `deleteGradeScaleMutation` | `REPORT_CARD_CONFIGURE` |
| Événement calendrier | `SchoolYearEventDetail` | `deleteSchoolYearEventMutation` | `TIMETABLE_UPDATE` |

### 9.4 Hors scope / limitations connues

- **Classes** : suppression API non exposée (`classGroups.deleteUnsupported` conservé).
- **Catalogue matières config** : lecture seule ; création au niveau classe.
- **Rôles** : liste fixe, pas de CRUD.
- **Paiements** : enregistrement via facturation, pas de delete liste.
- **Élèves** : pas de delete drawer (données liées / règles métier API).
- **Templates notifications** : Phase 5.

**Test :** ouvrir un drawer → Supprimer → confirm modal → toast → retour liste ; barèmes/modèles bulletin testables en config.

**Fichiers clés :** `DeleteEntityButton.svelte`, `delete-entity.mutations.ts`, `navigate-after-delete.ts`, drawers `*Detail.svelte`, `ReportCardDefinitionFormModal.svelte`

---

## Regroupement PRs

| PR | Phases | Description |
|----|--------|-------------|
| 1 | Phase 1 | Navigation cleanup |
| 2 | Phase 2 | Modale profil |
| 3 | Phase 3 + 4 + 9 | Permissions + empty states + CRUD |
| 4 | Phase 5 | Templates notifications |
| 5 | Phase 6 + 8 | Seeding puis pagination ✅ |
| 6 | Phase 7 | Config école ✅ |

---

## Notes & fixes (à compléter au fil de l’eau)

### Phase 8 — correctifs livrés

- **API `$orderBy`** : `col.asc()` → `asc(col)` dans `@edaya/adaptor-postgres` (erreur 500 sur listes paginées).
- **Dev reload** : `apps/api` watch inclut `postgres-store.ts` ; redémarrer `bun dev` après changement packages workspace.
- **UX** : pagination par boutons (50/page) plutôt que scroll infini sur élèves, tuteurs, personnel.

_Espace pour noter les corrections découvertes pendant l’audit Phase 4._

### Phase 4 — correctifs livrés

- **`DataState.preserveShell`** + **`listPageHasItems`** : listes vides conservent header + CTA (spec app-shell § UX risks).
- **24 routes** `+page.svelte` avec `preserveShell` ; dashboard / config école / compte exclus.
- **Vues** : empty in-collection ajouté sur `GradeScalesView`, `FinanceView` (onglets billing et fees).
- **Queries** : `academic`, `assessments`, `homework`, `access`, `report-cards`, `notification-templates` migrées vers `listPageHasItems`.
- **Audit boutons** : pattern modal create + modal edit drawer OK sur modules principaux ; écarts documentés ci-dessus (catalogue matières config, modèles bulletin, templates Phase 5).

### Phase 9 — correctifs livrés

- **`DeleteEntityButton`** + **`delete-entity.mutations.ts`** : suppression fonctionnelle via API avec confirm modal, toast, navigation retour liste.
- **14 entités** couvertes (drawers + barèmes en liste).
- **Create manquant** : CTA « Nouveau modèle » sur `ReportCardDefinitionsView`.
- **`removeSubject`** ajouté au store détail pour rollback matière classe.

---

**Last updated:** 2026-06-27
