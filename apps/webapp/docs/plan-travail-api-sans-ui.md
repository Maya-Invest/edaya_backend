# Plan de travail — Couvrir l'API sans écran UI (mode mocks)

**Stratégie :** construire d'abord **tous les écrans manquants** avec les **mocks du front** (`src/lib/data/school.ts`).  
**Pas de connexion API** dans ce plan — le branchement back-end viendra **après**, dans la phase Z.  
**Référence métier :** [rapport-comparaison-ui-api.md](./rapport-comparaison-ui-api.md) (section 4 — ce que l'API prévoit)  
**Convention :** cocher `- [x]` au fur et à mesure. Une tâche = finie quand l'écran fonctionne en `npm run dev` **sans `.env`**.

**Dernière mise à jour :** juin 2026

---

## État actuel du repo

| Élément | Statut |
|---|---|
| Données | 100 % mocks — `src/lib/data/school.ts` |
| `+page.server.ts` | Aucun (supprimés) |
| `src/lib/api/` | Supprimé (client, resources, mappers) |
| Auth / `.env` | Absents |
| OpenAPI dans le repo | Retiré du code actif (spec décrite dans le rapport) |
| Élèves / staff | Composants importent directement les mocks |
| Dépendances API | Retirées (`openapi-fetch`, `better-auth`, etc.) |
| `@internationalized/date` | Présent (peer dep `bits-ui`) |

**Prochaine étape immédiate :** Phase 3 — Annonces & messagerie.

---

## Principe

```
Aujourd'hui                          Plus tard (hors plan)
─────────────────                    ─────────────────────
school.ts (mocks)  →  Composants  →  resources/*.ts  →  API Maya
     ↑                      ↑              ↑
  types alignés         navigation      mappers
  sur l'OpenAPI         i18n            +page.server.ts
```

Les types mock peuvent **s'inspirer** des schémas OpenAPI (noms de champs, statuts) pour faciliter la future connexion — sans appeler le réseau.

**Couche API :** retirée du projet. Ne pas la réintroduire avant la phase Z.

**UI (juin 2026) :** libellés **français uniquement** pour les nouvelles features (clés i18n `fr` ; langue par défaut `fr`). Bilingue EN/FR reporté à plus tard.

---

## Légende statut

| Symbole | Signification |
|---|---|
| ⬜ | Non commencé |
| 🟡 | En cours |
| ✅ | Terminé |

---

## Vue d'ensemble des phases

| Phase | Domaine | Priorité | Statut |
|---|---|---|---|
| 0 | Fondations UX (login mock, navigation) | Haute | ✅ |
| 1 | Cycle scolaire & structure | Haute | ✅ |
| 2 | Bulletins & barèmes | Haute | 🟡 |
| 3 | Annonces & messagerie | Haute | ⬜ |
| 4 | Pièces jointes | Moyenne | ⬜ |
| 5 | Programme & progression (chapitres) | Moyenne | ⬜ |
| 6 | Discipline avancée | Moyenne | ⬜ |
| 7 | KPI & tableaux de bord | Moyenne | ⬜ |
| 8 | Formulaires d'action (mock) | Haute | ⬜ |
| 9 | Permissions & rôles (mock enrichi) | Haute | ⬜ |
| **Z** | *Connexion API (futur)* | *Différé* | ⬜ |

---

## Définition de « done » (mode mock)

Pour chaque feature :

- [ ] **Types + données** — types et tableaux dans `src/lib/data/school.ts` (ou `school/{domaine}.ts` si fichier trop gros)
- [ ] **Composant(s)** — liste, détail, drawer, formulaires
- [ ] **Route** — `+page.svelte` (+ `+page.ts` si redirect uniquement ; **pas** de `+page.server.ts` API)
- [ ] **Navigation** — entrée dans `navigation.ts` si nouvel écran
- [ ] **i18n** — clés FR + EN dans `dictionaries.ts`
- [ ] **Actions UI** — boutons / formulaires mettent à jour l'état local ou simulent l'action (toast « enregistré »)
- [ ] **Permissions mock** — `permissions.ts` : afficher / masquer selon rôle simulé
- [ ] **Test manuel** — parcours complet en `npm run dev`, sans `.env`

**Hors scope immédiat :** `resources/`, `mappers/`, `createApiClient`, Better Auth, `.env`.

---

## Phase 0 — Fondations UX

### 0.1 Connexion (mock)

- [x] Page `/login` (UI seulement — pas d'appel réseau)
- [x] Liste de comptes démo (directeur, prof, éducateur…) → sélection → redirect app
- [x] Stocker l'utilisateur choisi (`sessionStorage` via `authSession`)
- [x] `(app)/+layout.svelte` — redirect vers `/login` si personne connecté
- [x] Bouton déconnexion dans le header
- [x] Remplacer l'affichage fixe « Tom Évrard » par l'utilisateur mock choisi

### 0.2 Contexte établissement (mock)

- [x] Type `School` mock (id, name, timeZone, city…)
- [x] Données `schools` mock (2 établissements démo)
- [x] Sélecteur d'école dans le header (`SchoolSelector.svelte`)
- [x] Campus affiché dans la sidebar

### 0.3 Qualité transversale

- [x] Pattern composant : props `data` depuis la page, pas d'import direct de mocks dans les vues (facilite l'API plus tard)
- [x] États vides / loading / erreur (UI seulement) — `DataState.svelte`, `loaders.ts`, `?demo=loading|empty|error`
- [x] Aucun `+page.server.ts` — **100 % mocks** (élèves, staff, reste de l'app)
- [x] Couche `src/lib/api/` retirée
- [x] Dépendances API retirées du `package.json`
- [x] Pages élèves / staff sans prop `data` API — retour aux imports mock dans les composants

**Statut phase 0 :** ✅

---

## Phase 1 — Cycle scolaire & structure

> Équivalent API futur : `academic-years`, `academic-periods`, `period-definitions`, `class-groups`, `grade-levels`.

### 1.1 Données mock

- [x] Enrichir `academicYears`, `academicPeriods` (statut brouillon / publié)
- [x] Type `PeriodDefinition` mock
- [x] Type `GradeLevel` mock (cycle, ordre)
- [x] Lier `classes` aux niveaux (`gradeLevelId` simulé)

**Statut phase 1 :** 🟡 *(données mock faites ; UI 1.2 restante)*

### 1.2 UI

- [x] `AcademicHeader.svelte` — sélecteurs branchés sur mocks (années/périodes publiées via `academicContext`)
- [x] Page `/configuration/academic` — **Année scolaire** (gestion années & périodes, formulaires mock)
- [x] Actions mock : créer année, publier période (état local + toast)
- [x] Page ou section **Classes & niveaux** — CRUD mock `ClassNode` (`/configuration/classes`)

**Statut phase 1 :** ✅

---

## Phase 2 — Bulletins & barèmes de notes

> Équivalent API futur : `grade-scales`, `report-card-definitions`, `sections`, `results`.

### 2.1 Données mock

- [x] Type `GradeScale` + `gradeScales[]`
- [x] Type `ReportCardDefinition` + sections
- [x] Type `ReportCardResult` (moyennes, rang, commentaires prof/principal)

**Statut phase 2 :** ✅ *(données mock + UI bulletins & barèmes)*

### 2.2 UI

- [x] Page `/configuration/grade-scales` — liste + création mock
- [x] Page `/configuration/report-cards` — modèles de bulletin
- [x] Détail modèle (sections, coefficients)
- [x] Page `/classes/[classId]/report-cards` — bulletins par classe / période
- [x] Fiche élève — onglet **Bulletin**
- [x] Actions mock : générer bulletin, publier (changement statut local)

---

## Phase 3 — Annonces & messagerie

> Équivalent API futur : `announcements`, `announcement-targets`, `message-deliveries`.

### 3.1 Données mock

- [ ] Type `Announcement` (titre, contenu, statut, priorité, cibles)
- [ ] Type `AnnouncementTarget` (classe, rôle, individu…)
- [ ] Type `MessageDelivery` (lu / non lu, destinataire)
- [ ] Jeu de données `announcements[]`, `deliveries[]`

### 3.2 UI

- [ ] Entrée nav **Annonces** (module School)
- [ ] Page `/school/announcements` — onglets brouillon / publié / archivé
- [ ] Page `/school/announcements/new` — rédaction + choix des cibles
- [ ] Page ou drawer **Suivi des envois**
- [ ] Bandeau / badge actualités (header ou dashboard éducateur)
- [ ] Actions mock : publier, ajouter cible

**Statut phase 3 :** ⬜

---

## Phase 4 — Pièces jointes

> Équivalent API futur : `attachments`.

### 4.1 Données mock

- [ ] Type `Attachment` (id, fileName, ownerKind, ownerId, taille, date)
- [ ] `attachments[]` liés aux élèves, incidents, paiements, devoirs

### 4.2 UI

- [ ] Composant réutilisable `AttachmentList.svelte` (liste, ajout simulé, suppression locale)
- [ ] Intégration fiche élève
- [ ] Intégration incident / discipline
- [ ] Intégration finance / facturation
- [ ] Intégration bulletin (lien PDF fictif)
- [ ] Remplacer les `{ name, size }` des devoirs par `Attachment`

**Statut phase 4 :** ⬜

---

## Phase 5 — Programme & progression (chapitres)

> Équivalent API futur : `subject-matters`, `class-subject-matters`, `class-subject-progress`.

### 5.1 Données mock

- [ ] Type `SubjectMatter` (chapitre catalogue)
- [ ] Type `ClassSubjectProgress` (% avancement par matière/classe)
- [ ] Données chapitres par matière config + par classe

### 5.2 UI

- [ ] Enrichir `/configuration/subjects` — chapitres par matière
- [ ] Brancher `SubjectChaptersRow.svelte` sur mocks
- [ ] Onglet matière (classe) — barre de progression
- [ ] `TeachingLogView` — chapitre couvert par séance (mock)
- [ ] Action mock : enregistrer avancement séance

**Statut phase 5 :** ⬜

---

## Phase 6 — Discipline avancée

> Équivalent API futur : `disciplinary-actions`, `student-disciplinary-actions`, workflow incident.

### 6.1 Données mock

- [ ] Type `DisciplinaryAction` (type, durée, statut)
- [ ] Type `StudentDisciplinaryAction` (lien élève ↔ sanction)
- [ ] Enrichir `Incident` (workflow : ouvert → résolu, impliqués multiples)

### 6.2 UI

- [ ] Formulaire **Créer incident** (`SchoolEventsView`)
- [ ] Drawer incident — impliquer plusieurs élèves, appliquer sanction
- [ ] Action mock : résoudre incident, changer statut sanction
- [ ] Fiche élève — section **Sanctions** (historique)

**Statut phase 6 :** ⬜

---

## Phase 7 — KPI & tableaux de bord

> Équivalent API futur : queries `get-overdue-fee-count`, `get-published-report-card-count`.

### 7.1 Données mock

- [ ] Fonctions dérivées ou constantes : `overdueFeeCount`, `publishedReportCardCount`
- [ ] Calcul possible depuis `billing[]` et `reportCardResults[]` mock

### 7.2 UI

- [ ] Widget **Frais en retard** (dashboard éducateur ou `/dashboard`)
- [ ] Widget **Bulletins publiés**
- [ ] Bandeau alerte module Finance si retard > 0
- [ ] Cartes KPI cohérentes avec le reste de l'UI (tones, i18n)

**Statut phase 7 :** ⬜

---

## Phase 8 — Formulaires d'action (mock)

> Chaque action = formulaire ou bouton qui **simule** la command API (état local, pas de réseau).  
> Cocher quand l'UI existe et réagit (même si les données ne persistent qu'en session).

### 8.1 École & structure

- [ ] Créer / modifier établissement (mock)
- [ ] Créer année scolaire, activer année
- [ ] Créer / publier période
- [ ] Créer / modifier classe

### 8.2 Personnel

- [ ] Ajouter membre staff (`StaffForm`)
- [ ] Activer / désactiver staff
- [ ] Affecter staff → classe / matière / séance

### 8.3 Ressources

- [ ] Type `ResourceAssignment` mock
- [ ] Réserver ressource sur `ResourcesView` (classe ou séance)

### 8.4 Élèves & parcours

- [ ] Inscrire nouvel élève
- [ ] Affecter à une classe (`ChangeClassButton` fonctionnel en mock)
- [ ] Promouvoir / transférer / diplômer (modals)
- [ ] Clôturer inscription, décision de passage

### 8.5 Responsables

- [ ] Ajouter responsable, lier à élève(s)
- [ ] Modifier contacts / lien

### 8.6 Santé & notes

- [ ] Éditer profil santé (fiche élève)
- [ ] Créer / éditer note pédagogique

### 8.7 Pédagogie

- [ ] Offrir matière à une classe
- [ ] Créer évaluation, saisir notes
- [ ] Clôturer évaluation

### 8.8 Présences

- [ ] Saisie présence (`AttendanceFlow` persistant en mock)
- [ ] Justifier / valider absence

### 8.9 Emploi du temps

- [ ] Créer créneau EDT, séance
- [ ] Générer séances (simulation batch mock)
- [ ] Créer événement calendrier

### 8.10 Finance

- [ ] Créer frais, affecter à élève
- [ ] Enregistrer paiement, annuler, ajuster
- [ ] Formulaires `FeeForm`, `PaymentsView` fonctionnels en mock

**Statut phase 8 :** ⬜  
**Progression :** 0 / ~45 actions UI mock

---

## Phase 9 — Permissions & rôles (mock enrichi)

> Équivalent API futur : `access-roles`, permissions granulaires.

### 9.1 Données mock

- [ ] Type `AccessRole` (nom, permissions[], systemRoleKey)
- [ ] `accessRoles[]` — au-delà des 4 rôles actuels
- [ ] Matrice permissions (liste des codes type `STUDENT_READ`, `ATTENDANCE_RECORD`…)

### 9.2 UI

- [ ] Refonte `/configuration/roles` — liste rôles mock API-like
- [ ] Détail rôle — matrice permissions (lecture)
- [ ] Assigner rôle à un staff (mock)
- [ ] `permissions.ts` — checks basés sur la matrice mock
- [ ] Masquer boutons CRUD selon permissions simulées

**Statut phase 9 :** ⬜

---

## Phase Z — Connexion API *(hors plan actuel — à cocher plus tard)*

> **Ne pas commencer** tant que les phases 0–9 mock ne sont pas suffisamment avancées.

- [ ] Réimporter la spec OpenAPI (`openapi/edaya_open_api.json`) + `npm run generate:api`
- [ ] Recréer `src/lib/api/` (client, resources, mappers)
- [ ] `.env` + auth Better Auth
- [ ] Remplacer mocks par `+page.server.ts` écran par écran
- [ ] Commands réelles à la place des toasts mock
- [ ] CORS / cookies / déploiement Cloudflare

Référence technique : [rapport-comparaison-ui-api.md](./rapport-comparaison-ui-api.md).

---

## Journal d'avancement

| Date | Phase | Tâche cochée | Notes |
|---|---|---|---|
| juin 2026 | 0.1–0.2 | Login mock + contexte école | `/login`, `authSession`, `SchoolSelector`, 2 campus |
| juin 2026 | 0.3 | Retrait branchement API | Suppression `+page.server.ts`, `src/lib/api/`, deps API |
| | | | |

---

## Ordre recommandé (sprints mock)

### Sprint 1 — Parcours & structure
1. Phase 0.1–0.2 (login mock + contexte école)
2. Phase 1 (structure scolaire)

### Sprint 2 — Communication & visibilité
3. Phase 3 (annonces)
4. Phase 7 (KPI dashboard)

### Sprint 3 — Pédagogie officielle
5. Phase 2 (bulletins + barèmes)
6. Phase 5 (chapitres)

### Sprint 4 — Opérations
7. Phase 8.8–8.10 (présences, EDT, finance)
8. Phase 6 (discipline)

### Sprint 5 — Gouvernance & finition
9. Phase 9 (permissions)
10. Phase 4 (attachments)
11. Phase 8 restant

---

## Hors scope (même en mock — décision produit)

- [ ] Activités extrascolaires — pas d'entité API (écran mock déjà présent)
- [ ] Devoirs avec rendus — pas d'entité API (écran mock déjà présent)
- [ ] Statuts honor / warning — badges UI uniquement

---

## Compteur global

```
Phases mock terminées : 0 / 10  (phase 0 en cours)
Tâches phase 0         : 10 / 11 cochées
Écrans nouveaux        : 0 / ~12
Actions UI mock        : 0 / ~45
Connexion API          : différée (phase Z) — code retiré
```

*Mettre à jour en fin de sprint.*

---

## Rappel pour l'équipe

| Question | Réponse (plan actuel) |
|---|---|
| Faut-il un `.env` ? | **Non** |
| Faut-il le back-end ? | **Non** |
| Où sont les données ? | `src/lib/data/school.ts` |
| Couche API dans le code ? | **Non** — retirée |
| Quand brancher l'API ? | Phase Z, après les écrans mock |
