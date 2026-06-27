# Webapp Shell Improvements — Sprint Plan

> **Status:** Phases 1–2, 7 validées UX · Phase 6 implémentée (seed local en cours) · prochaine : Phase 3  
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
- [ ] **Phase 3** — Permissions menu
- [ ] **Phase 4** — États vides + audit boutons
- [ ] **Phase 5** — Templates notifications + invitations
- [ ] **Phase 6** — Seeding élèves étendu
- [x] **Phase 7** — Configuration école
- [ ] **Phase 8** — Pagination API (default 50) + webapp

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

**Effort estimé :** 4–8 h  
**PR suggérée :** inclure dans `feature/nav-permissions` ou PR dédiée

**État actuel :** `PermissionGate` sur les actions, pas sur la navigation.

- [ ] Ajouter `permission?: PermissionCode` (ou tableau) sur `ContextItem` dans `navigation.ts`
- [ ] Mapper les permissions par entrée (ex. `STUDENT_READ`, `STAFF_READ`, `ACCESS_CONTROL_READ`, `SCHOOL_LIFECYCLE_MANAGE`, …)
- [ ] Filtrer les items dans `AppSidebar.svelte` via `hasPermission()` (`permissions.ts`)
- [ ] Masquer un module entier si aucun sous-item visible
- [ ] Dashboard toujours visible
- [ ] Tests manuels : rôle professeur vs directeur — menus cohérents
- [ ] (Optionnel) helper `canAccessNavItem(item)` dans `permissions.ts`

**Fichiers clés :** `navigation.ts`, `AppSidebar.svelte`, `permissions.ts`

---

## Phase 4 — États vides + audit boutons

**Effort estimé :** 1–2 jours  
**Dépend de :** rien (mais l’audit boutons profite de la correction empty state)

### 4.1 États vides : conserver header + CTA

**Problème :** `DataState` remplace tout le contenu quand `status === 'empty'`, masquant `ListPageHeader` et le bouton Ajouter — contraire à `app-shell-spec.md` § UX risks.

- [ ] Déplacer `ListPageHeader` **hors** de `DataState` sur les pages liste concernées
- [ ] Réserver `DataState` à la zone collection uniquement
- [ ] En empty : message + CTA « Ajouter » visible (`PermissionGate`)
- [ ] (Alternative) Ajouter snippet `emptyActions` à `DataState.svelte` si refactor central préféré
- [ ] Pages auditées et corrigées :
  - [ ] `configuration/subjects/[[id]]`
  - [ ] `finance/billing/[[id]]`
  - [ ] `classes/[classId]/evaluations/[[id]]`
  - [ ] `configuration/grade-scales`
  - [ ] `dashboard`
  - [ ] Autres routes `PageQuery` + `DataState` (liste exhaustive documentée en fin de phase)

### 4.2 Audit boutons Ajouter / Modifier

Spec : CTA liste → modal create ; drawer → Edit → modal.

| Module | CTA create | Edit drawer | Corrigé |
|--------|------------|-------------|---------|
| Élèves (école + classe) | | | [ ] |
| Responsables | | | [ ] |
| Staff | | | [ ] |
| Annonces, activités, événements | | | [ ] |
| Finance (frais, facturation) | | | [ ] |
| Config (matières, classes, rôles, bulletins) | | | [ ] |
| Classe (devoirs, évaluations, emploi du temps) | | | [ ] |

- [ ] Corrections ciblées listées dans une section « Fixes » en bas de ce fichier (au fil de l’audit)

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
- [ ] `bun run` seed dev local OK + badge count sidebar réaliste (1000)

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

### 8.1 API

- [ ] Constante `DEFAULT_LIST_LIMIT = 50` dans `apps/api/src/lib/school-api/`
- [ ] Appliquer quand `$limit` absent sur endpoints `list`
- [ ] Vérifier / uniformiser `$skip` ou cursor pagination
- [ ] Tests API : list sans limit → max 50 ; avec limit explicite → respecté
- [ ] Mettre à jour GraphiQL example si pertinent

### 8.2 Webapp

- [ ] Helper `paginatedList({ limit: 50, skip })` dans `entity-list-filters.ts`
- [ ] Composant `ListPagination` ou extension `InfiniteList`
- [ ] Migrer listes principales (ordre suggéré) :
  - [ ] Élèves école
  - [ ] Responsables
  - [ ] Staff
  - [ ] Facturation
  - [ ] Autres collections scalables (liste finalisée en fin de phase)
- [ ] Filtres URL : `?page=2` ou cursor
- [ ] Smoke test avec seed Phase 6 : scroll / pages, perf acceptable

---

## Regroupement PRs

| PR | Phases | Description |
|----|--------|-------------|
| 1 | Phase 1 | Navigation cleanup |
| 2 | Phase 2 | Modale profil |
| 3 | Phase 3 + 4 | Permissions + empty states + audit |
| 4 | Phase 5 | Templates notifications |
| 5 | Phase 6 + 8 | Seeding puis pagination |
| 6 | Phase 7 | Config école ✅ |

---

## Notes & fixes (à compléter au fil de l’eau)

_Espace pour noter les corrections découvertes pendant l’audit Phase 4._

---

**Last updated:** 2026-06-27
