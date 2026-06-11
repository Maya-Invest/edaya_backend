# Plan de migration — mocks webapp → PGLite

Plan vivant pour transférer les données de démo du front (`apps/webapp/src/lib/data/`) vers la base **PGLite** de l'API (`DATABASE_URL=pglite`), via le seed de développement.

**Objectif :** après `bun dev`, un utilisateur connecté voit les **mêmes données** que les mocks, servies par `/api/core/*`.

**Docs liées**

- [Webapp mock → API migration plan](./webapp-mock-migration-plan.md) — branchement des écrans (loaders, mappers)
- [Local dev](./done/local-dev.md) — PGLite, `bun seed`, comptes Better Auth
- Source mocks : `apps/webapp/src/lib/data/school.ts`, `report-cards.ts`, `teachingLog.ts`
- Cible seed : `apps/api/src/lib/seed/dataset.ts`, `run-dev-seed.ts`, `run-dev-access-seed.ts`

**Dernière mise à jour :** 2026-06-11

---

## Légende

| Symbole | Signification |
|---------|---------------|
| `- [x]` | Terminé |
| `- [ ]` | À faire |
| `- [~]` | Partiel (détaillé dans la section) |

---

## Vue d'ensemble

| Phase | Domaine | Jeux de données mock | Statut global |
|-------|---------|----------------------|---------------|
| 0 | Fondations & structure scolaire | `schools`, `gradeLevels`, `academicYears`, `academicPeriods`, `classes` | ✅ |
| 1 | Personnes | `students`, `guardians`, `staff` | ✅ |
| 2 | Pédagogie — matières | `subjects`, programme | ✅ |
| 3 | Finance | `fees`, `billing` | ⬜ |
| 4 | Emploi du temps & sessions | `planning`, `resources` | ⬜ |
| 5 | Évaluations | `evaluations` | ⬜ |
| 6 | Vie scolaire | `schoolYearEvents`, `incidents`, `absences` | ⬜ |
| 7 | Élève 360° | `healthRecords`, `pedagogicalNotes` | ⬜ |
| 8 | Bulletins | `report-cards.ts` | ⬜ |
| 9 | Accès & auth | rôles UI, comptes démo | 🟡 partiel |
| 10 | Domaines sans entité API | `activities`, `deadlines` | ⬜ décision produit |

**Progression seed :** 7 / 16 domaines complets · **~44 %**

---

## Architecture cible

```
school.ts (mock)          dataset.ts (constantes)
       │                          │
       └──────── aligner IDs ─────┘
                    │
                    ▼
           run-dev-seed.ts  ──►  PGLite (via SchoolService)
                    │
           run-dev-access-seed.ts  ──►  permissions dev
                    │
           run-dev-auth-seed.ts  ──►  comptes Better Auth
                    │
                    ▼
           /api/core/entities/*/list  ──►  webapp (loaders API)
```

**Règle d'or :** les IDs du seed (`6a`, `s1`, `st5`…) restent **identiques** aux mocks tant que la stratégie UUID n'est pas adoptée (voir [webapp-mock-migration-plan § C4](./webapp-mock-migration-plan.md)).

---

## Recette standard (par tranche)

Cocher chaque item pour **chaque** domaine migré :

### Données

- [ ] Extraire les lignes mock → `SEED_<DOMAINE>` dans `dataset.ts` (IDs, champs, relations)
- [ ] Documenter les champs UI-only non persistés (commentaire dans `dataset.ts`)
- [ ] Implémenter l'insertion dans `run-dev-seed.ts` via **commandes métier** (`service.create*`, `service.register*`, etc.)
- [ ] Vérifier l'idempotence : second `bun seed` → `skipped` sans doublon

### Accès dev

- [ ] Ajouter les `Permission.*` nécessaires dans `run-dev-access-seed.ts`
- [ ] Attribuer les permissions au rôle dev concerné (`role-teacher`, `role-coordinator`, `role-educator`, futur `role-director`)

### Auth (si compte démo requis)

- [ ] Ajouter l'entrée dans `DEV_AUTH_STAFF_ACCOUNTS` ou `DEV_AUTH_GUARDIAN_ACCOUNTS`
- [ ] Vérifier connexion : email + `DevPassword1!`

### Tests

- [ ] Assertion liste non vide dans `apps/api/tests/seed/test-dev-access-seed.test.ts`
- [ ] `bun test apps/api/tests/seed/` vert
- [ ] Smoke manuel : `bun seed` puis `POST /api/core/entities/<entity>/list` avec cookie session

### Suivi

- [ ] Mettre à jour **§ Tracker domaines** ci-dessous
- [ ] Mettre à jour [webapp-mock-migration-plan §7](./webapp-mock-migration-plan.md) (seed tracker)

---

## Décisions transversales

- [ ] **C1 — IDs seed** : conserver les IDs lisibles (`6a`, `s1`) vs migrer vers UUID (impact filtres API)
- [ ] **C2 — `periodDefinitions`** : le mock mélange créneaux horaires et libellés trimestre ; l'API `period-definitions` = créneaux (`08:00`–`09:00`). Décider mapping shell
- [x] **C3 — Staff manquants** : `st4`, `st6` présents dans `school.ts` — seedés (2026-06-11)
- [x] **C4 — Directeur (`st5`)** : rôle `role-director` + owner école (2026-06-11)
- [ ] **C5 — Activités / devoirs** : pas d'entité API dédiée → voir Phase 10
- [ ] **C6 — `teachingLog.ts`** : données dérivées de `subjects` + `sessions` ; seed après Phase 4

---

## Phase 0 — Fondations & structure scolaire ✅

**Source mock :** `school.ts` — `schools`, `gradeLevels`, `academicYears`, `academicPeriods`, `classes`, `hierarchy`

| Tâche | Statut |
|-------|--------|
| `SEED_SCHOOL_ID`, `SEED_ACADEMIC_YEAR_ID` | [x] |
| `SEED_GRADE_LEVELS` (7 niveaux) | [x] |
| `SEED_CLASSES` (6a, 6b, 5a) | [x] |
| `SEED_ACADEMIC_PERIODS` (3 trimestres) | [x] |
| `registerSchool` + `createAcademicYear` + périodes publiées | [x] |
| `createClassGroup` + prof principal 6a (`st3`) | [x] |
| Test shell : list schools / years / classes | [x] |

**Reste ouvert (shell complet) :**

- [ ] `SEED_PERIOD_DEFINITIONS` — créneaux horaires alignés mock `periodDefinitions[]`
- [ ] `period-definitions` seedés via service
- [ ] Deuxième école mock (`sch-edaya-nord`) — optionnel, UI a 2 écoles

---

## Phase 1 — Personnes ✅

**Source mock :** `school.ts` — `students`, `guardians`, `staff`

### Élèves & inscriptions

| Tâche | Statut |
|-------|--------|
| `SEED_STUDENTS` (8 élèves, ids `s1`–`s8`) | [x] |
| `registerStudent` + `enrollStudent` par classe | [x] |
| Test : `students/list` ≥ 8 | [x] |

### Tuteurs & liens

| Tâche | Statut |
|-------|--------|
| `SEED_GUARDIANS` (6 tuteurs) | [x] |
| `registerGuardian` + `linkGuardianToStudent` | [x] |
| Test : `guardians/list` ≥ 6 | [x] |

### Personnel

| Tâche | Statut |
|-------|--------|
| `SEED_STAFF` — st1–st7 (7 membres) | [x] |
| st4 (M. Cheng), st6 (Sarah Klein) depuis mock | [x] |
| `StaffRoleAssignment` pour tous les staff seedés | [x] |
| `role-director` pour st5 | [x] |
| `StaffAssignment` classe + class-subject | [x] |
| Test : `staff-members/list` ≥ 7 | [x] |

### Champs UI-only (non seedés — documentés)

- [ ] `Student.attendance`, `Student.average`, badges `honor` / `warning`
- [ ] `StaffMember.initials`, `department`, `classes[]`, `subjectsTaught[]` (dérivés ou mock fallback)

---

## Phase 2 — Pédagogie : matières ✅

**Source mock :** `school.ts` — `subjects` (catalogue + offerings classe 6a/6b)

| Tâche | Statut |
|-------|--------|
| `SEED_SUBJECT_CATALOG` (6 matières) | [x] |
| `SEED_SUBJECT_MATTERS` (programme / chapitres) | [x] |
| `SEED_CLASS_SUBJECTS` (8 offerings + enseignants) | [x] |
| `offerSubjectToClass` + matters | [x] |
| Assignations enseignant → `run-dev-access-seed` | [x] |
| Test : `class-subjects/list` ≥ 8 | [x] |
| `assignMatterToClassSubject` (progression par classe) | [ ] |
| Matières classes 5a / autres niveaux (mock partiel) | [ ] |

---

## Phase 3 — Finance ⬜

**Source mock :** `school.ts` — `fees`, `billing`  
**Commandes API :** `createFee`, `assignFeeToStudent`, `recordPayment`

### Catalogue des frais

- [ ] `SEED_FEES` ← `fees[]` (ids, libellés, montants, échéances)
- [ ] `createFee` dans `run-dev-seed.ts`
- [ ] Permissions `FEE_READ` / finance query → `run-dev-access-seed.ts`
- [ ] Test : `fees/list` non vide

### Facturation élève (`student-fees`)

- [ ] `SEED_STUDENT_FEES` ← `billing[]` (élève, fee, montant, statut, échéances)
- [ ] `assignFeeToStudent` pour chaque ligne mock
- [ ] Permissions billing read
- [ ] Test : `student-fees/list` non vide

### Paiements

- [ ] `SEED_PAYMENTS` ← lignes `billing` avec statut payé
- [ ] `recordPayment` pour chaque paiement mock
- [ ] Permissions `PAYMENT_READ`
- [ ] Test : `payments/list` non vide

**Écrans débloqués :** `/finance/fees`, `/finance/billing`, `/finance/payment`

---

## Phase 4 — Emploi du temps & ressources ⬜

**Source mock :** `school.ts` — `planning[]`, `resources[]`  
**Entités API :** `schedules`, `sessions`, `resources`, `resource-assignments`

### Ressources (salles)

- [ ] `SEED_RESOURCES` ← `resources[]`
- [ ] Persistance ressources + `resource-assignments` si applicable
- [ ] Test : `resources/list`

### Emploi du temps

- [ ] `SEED_SCHEDULES` — grille hebdo classe `6a`
- [ ] `createSchedule` + `createSession` (ou `generateSessions`)
- [ ] Lier sessions → `class-subjects`, staff, resources
- [ ] Permissions scheduling read
- [ ] Test : `sessions/list` pour classe `6a`

### Journal de classe (prérequis Phase 4)

- [ ] `recordSessionProgress` / `class-subject-progress` pour quelques sessions
- [ ] Aligner `teachingLog.ts` (données dérivées)

**Écrans débloqués :** `/classes/[id]/timetable`, `/classes/[id]/teaching`

---

## Phase 5 — Évaluations ⬜

**Source mock :** `school.ts` — `evaluations[]`  
**Entités API :** `assessments`, `assessment-results`

- [ ] `SEED_ASSESSMENTS` ← `evaluations[]` (titre, date, matière, classe, barème)
- [ ] `createAssessment` par évaluation mock
- [ ] `SEED_ASSESSMENT_RESULTS` — notes partielles (`graded` / `total` du mock)
- [ ] `recordAssessmentResult` pour un échantillon d'élèves `6a`
- [ ] Permissions `GRADE_READ` / assessment query
- [ ] Test : `assessments/list` + `assessment-results/list`

**Écrans débloqués :** `/classes/[id]/evaluations`

---

## Phase 6 — Vie scolaire ⬜

**Source mock :** `school.ts` — `schoolYearEvents`, `incidents`, `absences`

### Calendrier scolaire

- [ ] `SEED_CALENDAR_EVENTS` ← `schoolYearEvents[]`
- [ ] `createCalendarEvent` (cérémonies, vacances, réunions)
- [ ] Permissions calendrier read
- [ ] Test : `calendar-events/list`

### Incidents & discipline

- [ ] `SEED_INCIDENTS` ← `incidents[]`
- [ ] `recordIncident` + `student-incident-involvements`
- [ ] `disciplinary-actions` si présents dans mock
- [ ] Permissions `DISCIPLINE_READ`
- [ ] Test : `incidents/list`

### Absences / présences

- [ ] `SEED_ATTENDANCE` ← `absences[]`
- [ ] `recordAttendance` ou `recordDailyAttendance`
- [ ] Permissions `ATTENDANCE_READ`
- [ ] Test : `attendance/list`

**Écrans débloqués :** `/school/calendar`, `/school/events`, onglets élève (absences, incidents)

---

## Phase 7 — Élève 360° ⬜

**Source mock :** `school.ts` — `healthRecords`, `pedagogicalNotes`

### Profils santé

- [ ] `SEED_STUDENT_HEALTH` ← `healthRecords` (par `studentId`)
- [ ] Persistance `student-health-profiles`
- [ ] Test : `student-health-profiles/list` ou `one`

### Notes pédagogiques

- [ ] `SEED_STUDENT_NOTES` ← `pedagogicalNotes[]`
- [ ] `createStudentNote`
- [ ] Test : `student-notes/list`

**Écrans débloqués :** drawers `StudentDetailsDialog` (onglets santé, notes)

---

## Phase 8 — Bulletins ⬜

**Source mock :** `report-cards.ts` — `gradeScales`, définitions, sections, résultats

### Barèmes

- [ ] `SEED_GRADE_SCALES` ← `gradeScales[]`
- [ ] `createGradeScale`
- [ ] Test : `grade-scales/list`

### Modèles de bulletin

- [ ] `SEED_REPORT_CARD_DEFINITIONS` + sections
- [ ] `createReportCardDefinition` + `createReportCardDefinitionSection`
- [ ] Test : `report-card-definitions/list`

### Résultats

- [ ] `SEED_REPORT_CARD_RESULTS` — échantillon trimestre 1, classe `6a`
- [ ] `generateReportCardResult` (+ `publish` si requis)
- [ ] Permissions `REPORT_CARD_*`
- [ ] Test : `report-card-results/list`

**Écrans débloqués :** `/configuration/grade-scales`, `/configuration/report-cards`, `/classes/[id]/report-cards`

---

## Phase 9 — Accès & auth 🟡

**Source mock :** rôles UI (`StaffRole`), matrice permissions, comptes login

### Comptes Better Auth

| Compte | Entité | Statut |
|--------|--------|--------|
| c.moreau@school.edu | st5 (directeur) | [x] |
| m.dupont@school.edu | st1 (prof) | [x] |
| m.leon@school.edu | st3 (prof principal) | [x] |
| t.evrard@school.edu | st7 (éducateur) | [x] |
| c.laurent@mail.com | g1 (tuteur) | [x] |
| m.garnier@school.edu | st2 | [ ] |
| Comptes tuteurs g2–g6 | g2–g6 | [ ] |

### Rôles & permissions API

- [x] `role-teacher`, `role-coordinator`, `role-educator`
- [x] `role-director` pour st5 (permissions admin / finance / config)
- [ ] `DEV_WEBAPP_FINANCE_READ_PERMISSIONS`
- [ ] `DEV_WEBAPP_ASSESSMENT_READ_PERMISSIONS`
- [ ] `DEV_WEBAPP_ATTENDANCE_READ_PERMISSIONS`
- [ ] `DEV_WEBAPP_DISCIPLINE_READ_PERMISSIONS`
- [ ] `DEV_WEBAPP_REPORT_CARD_READ_PERMISSIONS`
- [ ] Matrice UI `/configuration/roles` alignée sur `access-roles` seedés

---

## Phase 10 — Domaines sans entité API ⬜

**Décision produit requise** avant seed (voir [webapp-mock-migration-plan §8](./webapp-mock-migration-plan.md)).

| Mock | Lignes | Options |
|------|--------|---------|
| `activities[]` | ~5 activités parascolaires | (A) nouvelle entité (B) `calendar-events` typés (C) garder mock |
| `deadlines[]` | devoirs / échéances | (A) `assessments` typés (B) nouvelle entité (C) garder mock |
| Deuxième école | `schools[1]` | seed multi-école ou UI seule |

- [ ] Décision produit documentée
- [ ] Implémentation seed (si option A ou B)
- [ ] Sinon : marquer « mock permanent » dans `school.ts`

---

## Tracker domaines (récapitulatif)

| Domaine mock | Constante seed | `run-dev-seed` | Permissions | Test seed | Webapp API |
|--------------|----------------|----------------|-------------|-----------|------------|
| École, années, trimestres, niveaux, classes | ✅ | ✅ | ✅ | ✅ | ✅ shell |
| Élèves + inscriptions | ✅ | ✅ | ✅ | ✅ | ✅ |
| Tuteurs + liens | ✅ | ✅ | ✅ | ✅ | ✅ |
| Staff | ✅ | ✅ | ✅ | ✅ | ✅ |
| Matières + programme + offerings | ✅ | ✅ | ✅ | ✅ | ✅ |
| Créneaux horaires (`period-definitions`) | [ ] | [ ] | [ ] | [ ] | partiel |
| Frais | [ ] | [ ] | [ ] | [ ] | mock |
| Facturation élève | [ ] | [ ] | [ ] | [ ] | mock |
| Paiements | [ ] | [ ] | [ ] | [ ] | mock |
| Ressources & planning | [ ] | [ ] | [ ] | [ ] | mock |
| Évaluations & notes | [ ] | [ ] | [ ] | [ ] | mock |
| Calendrier scolaire | [ ] | [ ] | [ ] | [ ] | mock |
| Incidents | [ ] | [ ] | [ ] | [ ] | mock |
| Absences | [ ] | [ ] | [ ] | [ ] | mock |
| Santé & notes élève | [ ] | [ ] | [ ] | [ ] | mock |
| Bulletins (barèmes, modèles, résultats) | [ ] | [ ] | [ ] | [ ] | mock |
| Rôles / accès complets | 🟡 | 🟡 | 🟡 | partiel | mock |
| Activités / devoirs | — | — | — | — | mock |

---

## Séquence de PRs suggérée

Ordre optimisé pour débloquer le [plan webapp](./webapp-mock-migration-plan.md) :

```
PR 1  ✅ Phase 1 — compléter staff (st4, st6) + role-director st5
PR 2  Phase 0 — period-definitions (créneaux horaires)
PR 3   Phase 3 — finance (fees → student-fees → payments)
PR 4   Phase 4 — resources + schedules/sessions (classe 6a)
PR 5   Phase 5 — assessments + results
PR 6   Phase 6 — calendar-events + incidents + attendance
PR 7   Phase 7 — health profiles + student notes
PR 8   Phase 8 — grade scales + report cards
PR 9   Phase 9 — auth accounts restants + permissions groups
PR 10  Phase 10 — activités / devoirs (si décidé)
```

Chaque PR : **seed + permissions + test + mise à jour de ce document**.

---

## Validation globale

Cocher quand l'environnement dev est complet :

- [ ] `DATABASE_URL=pglite` dans `apps/api/.env`
- [ ] `bun seed` → `Dev database seeded` sans erreur
- [ ] `bun dev` → API auto-seed au démarrage
- [ ] Connexion `m.dupont@school.edu` / `DevPassword1!` → écrans migrés non vides
- [ ] `bun test apps/api/tests/seed/` vert
- [ ] Aucun écran connecté vide après seed frais (règle « no empty logged-in screens »)

---

## Métriques

| Métrique | Baseline (2026-06-11) | Cible |
|----------|----------------------|-------|
| Domaines seed complets | 6 / 16 | 16 / 16 (+ décisions Phase 10) |
| Entrées `SEED_*` dans `dataset.ts` | 11 constantes | ~25 |
| Lignes mock couvertes (`school.ts`) | ~40 % | 100 % (hors UI-only) |
| Tests seed (assertions list) | 2 | 1 par domaine migré |
| Groupes permissions dev | 3 | ~8 |

---

## Références

| Ressource | Chemin |
|-----------|--------|
| Mocks webapp | `apps/webapp/src/lib/data/school.ts` |
| Mocks bulletins | `apps/webapp/src/lib/data/report-cards.ts` |
| Dataset seed | `apps/api/src/lib/seed/dataset.ts` |
| Seed entités | `apps/api/src/lib/seed/run-dev-seed.ts` |
| Seed permissions | `apps/api/src/lib/seed/run-dev-access-seed.ts` |
| Seed auth | `apps/api/src/lib/seed/run-dev-auth-seed.ts` |
| Tests seed | `apps/api/tests/seed/test-dev-access-seed.test.ts` |
| Commandes métier | `packages/core/src/services/school-service.ts` |
| Registry entités API | `apps/api/src/lib/school-api/registry/index.ts` |

**Règle de maintenance :** à chaque PR seed, cocher les cases correspondantes et mettre à jour la date en tête de document.
