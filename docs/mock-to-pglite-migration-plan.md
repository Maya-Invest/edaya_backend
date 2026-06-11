# Plan de migration — mocks webapp → PGLite

Transférer les données de démo du front (`apps/webapp/src/lib/data/`) vers la base **PGLite** de l'API (`DATABASE_URL=pglite`), via le seed de développement.

**Objectif :** après `bun dev`, un utilisateur connecté voit les **mêmes données** que les mocks, servies par `/api/core/*`.

**Dernière mise à jour :** 2026-06-11

---

## Tableau de bord

| Indicateur | Valeur |
|------------|--------|
| **Progression globale** | **8 / 16 domaines** complets · **~50 %** |
| **Prochaine étape** | PR 4 — Planning (phase 4) |
| **Bloquant webapp** | Finance, planning, évaluations, vie scolaire, bulletins (voir [plan webapp](./webapp-mock-migration-plan.md)) |

```
[██████████░░░░░░░░░░]  8/16 domaines
 Fait ──►              Reste
```

### Comment lire ce document

1. **§ Tracker** — source de vérité : une ligne = un domaine, colonnes = étapes (dataset → seed → permissions → tests).
2. **§ Terminé** — récapitulatif de ce qui est livré (ne pas recocher ici, le tracker suffit).
3. **§ Backlog** — liste ordonnée de ce qu'il reste à faire, avec cases à cocher actionnables.
4. **§ Détails par phase** — détail technique uniquement pour les phases **non terminées**.
5. À chaque PR seed : mettre à jour le **tracker**, cocher le **backlog**, actualiser la date en tête.

| Symbole | Signification |
|---------|---------------|
| ✅ | Terminé |
| 🟡 | Partiel |
| ⬜ | À faire |
| — | Non applicable / en attente décision produit |

---

## Tracker (source de vérité)

Une ligne = un domaine mock. Cocher **toutes** les colonnes d'une ligne avant de passer la ligne en ✅.

| # | Domaine | `SEED_*` | `run-dev-seed` | Permissions | Test seed | Statut |
|---|---------|:--------:|:--------------:|:-----------:|:---------:|:------:|
| 0a | École, années, trimestres, niveaux, classes | ✅ | ✅ | ✅ | ✅ | ✅ |
| 0b | Créneaux horaires (`period-definitions`) | ✅ | ✅ | ✅ | ✅ | ✅ |
| 1a | Élèves + inscriptions | ✅ | ✅ | ✅ | ✅ | ✅ |
| 1b | Tuteurs + liens | ✅ | ✅ | ✅ | ✅ | ✅ |
| 1c | Staff (st1–st7, rôles, affectations) | ✅ | ✅ | ✅ | ✅ | ✅ |
| 2 | Matières + programme + offerings classe 6a | ✅ | ✅ | ✅ | ✅ | 🟡 |
| 3a | Catalogue frais | ✅ | ✅ | ✅ | ✅ | ✅ |
| 3b | Facturation élève (`student-fees`) | ✅ | ✅ | ✅ | ✅ | ✅ |
| 3c | Paiements | ✅ | ✅ | ✅ | ✅ | ✅ |
| 4 | Ressources + emploi du temps + sessions | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 5 | Évaluations + résultats | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 6a | Calendrier scolaire | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 6b | Incidents & discipline | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 6c | Absences / présences | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 7 | Santé + notes pédagogiques élève | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 8 | Bulletins (barèmes, modèles, résultats) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 9 | Accès & auth (comptes + permissions dev) | 🟡 | 🟡 | 🟡 | 🟡 | 🟡 |
| 10 | Activités / devoirs (sans entité API) | — | — | — | — | — |

**Légende colonnes**

| Colonne | Fichier / action |
|---------|------------------|
| `SEED_*` | Constantes dans `testing/dev-fixtures/src/dataset.ts` |
| `run-dev-seed` | Insertion via commandes métier dans `apps/api/src/lib/seed/run-dev-seed.ts` |
| Permissions | `apps/api/src/lib/seed/run-dev-access-seed.ts` |
| Test seed | Assertion liste non vide dans `apps/api/tests/seed/` |

**Notes tracker**

- **Phase 2 🟡** : offerings 6a/6b OK ; reste `assignMatterToClassSubject` + matières autres niveaux (5a).
- **Phase 9 🟡** : 4 comptes staff + 1 tuteur ; permissions finance/assessment/attendance/discipline/report-card à ajouter au fil des phases.

---

## Terminé

Résumé consolidé — le détail historique est dans le tracker ci-dessus.

### Fondations (phase 0a)

- École `sch-edaya-central`, année `2025`, 7 niveaux, 3 classes (6a, 6b, 5a), 3 trimestres
- `registerSchool`, `createAcademicYear`, périodes publiées, `createClassGroup` + prof principal 6a (`st3`)
- Tests : list schools / years / classes

### Créneaux horaires (phase 0b)

- 11 créneaux journaliers (`pd-1`…`pd-8` + récréations + pause déjeuner), alignés sur les horaires du mock `planning[]`
- Décision **C2** : les libellés trimestre du mock restent dans `academic-periods`, pas dans `period-definitions`
- Test : `period-definitions/list` ≥ 11

### Finance (phases 3a–3c)

- 6 frais catalogue (`f1`–`f6`), 6 factures élèves (`b1`–`b6`, s1–s6), 13 paiements
- `billing[]` mock s9/s10 exclus (élèves non seedés)
- Test : `fees/list` ≥ 6, `student-fees/list` ≥ 6, `payments/list` ≥ 13

### Personnes (phase 1)

- 8 élèves (`s1`–`s8`), 6 tuteurs, 7 staff (`st1`–`st7`, dont st4 Cheng et st6 Klein)
- Inscriptions, liens tuteur–élève, `StaffRoleAssignment`, `role-director` pour st5, affectations classe/matière
- Tests : `students/list`, `guardians/list` ≥ 6, `staff-members/count` = 7

### Pédagogie — matières (phase 2, cœur)

- Catalogue 6 matières, programme (`SEED_SUBJECT_MATTERS`), 8 offerings classe 6a/6b avec enseignants
- Test : `class-subjects/list` ≥ 8

### Auth de base (phase 9, partiel)

| Compte | Entité | Statut |
|--------|--------|--------|
| c.moreau@school.edu | st5 (directeur) | ✅ |
| m.dupont@school.edu | st1 (prof) | ✅ |
| m.leon@school.edu | st3 (prof principal) | ✅ |
| t.evrard@school.edu | st7 (éducateur) | ✅ |
| c.laurent@mail.com | g1 (tuteur) | ✅ |

- Rôles dev : `role-teacher`, `role-coordinator`, `role-educator`, `role-director`

### Décisions actées

- **C3** — Staff st4, st6 seedés depuis mock
- **C4** — Directeur st5 : `role-director` + owner école

### Constantes seed existantes (`dataset.ts`)

`SEED_SCHOOL_*`, `SEED_GRADE_LEVELS`, `SEED_CLASSES`, `SEED_ACADEMIC_PERIODS`, `SEED_PERIOD_DEFINITIONS`, `SEED_FEES`, `SEED_STUDENT_FEES`, `SEED_PAYMENTS`, `SEED_STAFF`, `SEED_STUDENTS`, `SEED_GUARDIANS`, `SEED_SUBJECT_CATALOG`, `SEED_SUBJECT_MATTERS`, `SEED_CLASS_SUBJECTS`, `DEV_AUTH_*`

---

## Backlog (à faire, dans l'ordre)

Cocher au fur et à mesure. Chaque item = une PR ou une sous-tâche d'une PR.

### PR 2 — Créneaux horaires (phase 0b) ✅

- [x] `SEED_PERIOD_DEFINITIONS` ← grille horaire journalière (11 créneaux, pas les libellés trimestre mock)
- [x] Seed via `baseService.periodDefinitions.save`
- [x] Permissions (`QUERY_WORKSPACE_READ` via shell) + test `period-definitions/list`
- [ ] (Optionnel) Deuxième école mock `sch-edaya-nord`

### PR 3 — Finance (phases 3a–3c) ✅

- [x] `SEED_FEES` ← `fees[]` + `createFee`
- [x] `SEED_STUDENT_FEES` ← `billing[]` (s1–s6) + `assignFeeToStudent`
- [x] `SEED_PAYMENTS` ← échéances payées + `recordPayment`
- [x] `DEV_WEBAPP_FINANCE_READ_PERMISSIONS` dans access seed (rôle directeur)
- [x] Tests : `fees/list`, `student-fees/list`, `payments/list`

### PR 4 — Planning (phase 4)

- [ ] `SEED_RESOURCES` ← `resources[]`
- [ ] `SEED_SCHEDULES` + sessions classe 6a (`createSchedule`, `createSession`)
- [ ] Lier sessions → class-subjects, staff, resources
- [ ] `recordSessionProgress` (échantillon) — prérequis `teachingLog.ts`
- [ ] Permissions scheduling + test `sessions/list`

### PR 5 — Évaluations (phase 5)

- [ ] `SEED_ASSESSMENTS` ← `evaluations[]`
- [ ] `SEED_ASSESSMENT_RESULTS` — notes partielles élèves 6a
- [ ] `DEV_WEBAPP_ASSESSMENT_READ_PERMISSIONS`
- [ ] Tests : `assessments/list`, `assessment-results/list`

### PR 6 — Vie scolaire (phases 6a–6c)

- [ ] Calendrier ← `schoolYearEvents[]`
- [ ] Incidents ← `incidents[]` + involvements
- [ ] Absences ← `absences[]`
- [ ] Permissions attendance / discipline / calendrier
- [ ] Tests list par entité

### PR 7 — Élève 360° (phase 7)

- [ ] Santé ← `healthRecords`
- [ ] Notes ← `pedagogicalNotes[]`
- [ ] Tests : `student-health-profiles`, `student-notes/list`

### PR 8 — Bulletins (phase 8)

- [ ] Barèmes ← `report-cards.ts` `gradeScales[]`
- [ ] Modèles + sections
- [ ] Résultats trimestre 1 classe 6a
- [ ] `DEV_WEBAPP_REPORT_CARD_READ_PERMISSIONS`
- [ ] Tests : `grade-scales`, `report-card-definitions`, `report-card-results`

### PR 9 — Auth & accès restants (phase 9)

- [ ] Compte st2 (`m.garnier@school.edu`)
- [ ] Comptes tuteurs g2–g6
- [ ] Matrice UI `/configuration/roles` alignée sur `access-roles` seedés

### PR 10 — Décisions produit (phase 10)

- [ ] Décision : `activities[]`, `deadlines[]`, deuxième école
- [ ] Implémenter ou marquer « mock permanent » dans `school.ts`

### Finitions transversales (phase 2 + champs UI-only)

- [ ] `assignMatterToClassSubject` (progression par classe)
- [ ] Matières classes 5a / autres niveaux
- [ ] Documenter champs UI-only non persistés (`Student.attendance`, `StaffMember.initials`, etc.)

---

## Détails par phase (phases ouvertes uniquement)

---

---

### Phase 4 — Emploi du temps & ressources ⬜

**Source mock :** `school.ts` — `planning[]`, `resources[]`  
**Entités API :** `schedules`, `sessions`, `resources`, `resource-assignments`

**Écrans débloqués :** `/classes/[id]/timetable`, `/classes/[id]/teaching`  
**Prérequis journal :** `teachingLog.ts` = dérivé de `subjects` + `sessions` (décision **C6**)

---

### Phase 5 — Évaluations ⬜

**Source mock :** `school.ts` — `evaluations[]`  
**Entités API :** `assessments`, `assessment-results`

**Écrans débloqués :** `/classes/[id]/evaluations`

---

### Phase 6 — Vie scolaire ⬜

**Source mock :** `school.ts` — `schoolYearEvents`, `incidents`, `absences`

| Sous-domaine | Commande typique |
|--------------|------------------|
| Calendrier | `createCalendarEvent` |
| Incidents | `recordIncident` + involvements |
| Absences | `recordAttendance` / `recordDailyAttendance` |

**Écrans débloqués :** `/school/calendar`, `/school/events`, onglets élève

---

### Phase 7 — Élève 360° ⬜

**Source mock :** `school.ts` — `healthRecords`, `pedagogicalNotes`  
**Écrans :** drawers `StudentDetailsDialog` (santé, notes)

---

### Phase 8 — Bulletins ⬜

**Source mock :** `report-cards.ts` — `gradeScales`, définitions, sections, résultats

**Écrans débloqués :** `/configuration/grade-scales`, `/configuration/report-cards`, `/classes/[id]/report-cards`

---

### Phase 9 — Accès & auth (reste) 🟡

**Comptes manquants**

| Compte | Entité | Statut |
|--------|--------|--------|
| m.garnier@school.edu | st2 | ⬜ |
| tuteurs g2–g6 | g2–g6 | ⬜ |

**Groupes permissions à créer au fil des PRs**

- [x] `DEV_WEBAPP_FINANCE_READ_PERMISSIONS`
- [ ] `DEV_WEBAPP_ASSESSMENT_READ_PERMISSIONS`
- [ ] `DEV_WEBAPP_ATTENDANCE_READ_PERMISSIONS`
- [ ] `DEV_WEBAPP_DISCIPLINE_READ_PERMISSIONS`
- [ ] `DEV_WEBAPP_REPORT_CARD_READ_PERMISSIONS`

---

### Phase 10 — Sans entité API ⬜

**Décision produit requise** (voir [webapp-mock-migration-plan §8](./webapp-mock-migration-plan.md)).

| Mock | Lignes | Options |
|------|--------|---------|
| `activities[]` | ~5 activités | (A) nouvelle entité (B) `calendar-events` typés (C) mock permanent |
| `deadlines[]` | devoirs | (A) `assessments` typés (B) nouvelle entité (C) mock permanent |
| Deuxième école | `schools[1]` | seed multi-école ou UI seule |

---

## Annexe

### Architecture cible

```
school.ts (mock)          testing/dev-fixtures/dataset.ts
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

### Recette standard (chaque domaine du backlog)

**Données**

- [ ] Extraire mock → `SEED_<DOMAINE>` dans `dataset.ts`
- [ ] Commenter les champs UI-only non persistés
- [ ] Insertion dans `run-dev-seed.ts` via commandes métier
- [ ] Idempotence : second `bun seed` → `skipped` sans doublon

**Accès dev**

- [ ] Permissions dans `run-dev-access-seed.ts`
- [ ] Attribution au rôle dev concerné

**Auth** (si compte démo requis)

- [ ] Entrée dans `DEV_AUTH_STAFF_ACCOUNTS` ou `DEV_AUTH_GUARDIAN_ACCOUNTS`

**Tests & suivi**

- [ ] Assertion dans `apps/api/tests/seed/`
- [ ] `bun test apps/api/tests/seed/` vert
- [ ] Mettre à jour **§ Tracker** et **§ Backlog** de ce document
- [ ] Mettre à jour [webapp-mock-migration-plan §7](./webapp-mock-migration-plan.md)

### Décisions transversales ouvertes

| ID | Sujet | Statut |
|----|-------|--------|
| C1 | IDs seed lisibles vs UUID | ⬜ |
| C2 | Mapping `periodDefinitions` mock → API | ✅ grille horaire seedée ; trimestres restent dans `academic-periods` |
| C5 | Activités / devoirs sans entité | ⬜ Phase 10 |
| C6 | `teachingLog.ts` après sessions seedées | ⬜ Phase 4 |

### Validation globale (fin de migration)

- [ ] `DATABASE_URL=pglite` dans `apps/api/.env`
- [ ] `bun seed` → `Dev database seeded` sans erreur
- [ ] `bun dev` → API auto-seed au démarrage
- [ ] Connexion `m.dupont@school.edu` / `DevPassword1!` → écrans migrés non vides
- [ ] `bun test apps/api/tests/seed/` vert
- [ ] Aucun écran connecté vide après seed frais

### Métriques

| Métrique | Actuel | Cible |
|----------|--------|-------|
| Domaines seed complets | 8 / 16 | 16 / 16 |
| Constantes `SEED_*` | 15 | ~25 |
| Couverture mock `school.ts` | ~40 % | 100 % (hors UI-only) |
| Tests seed (assertions list) | 5 scénarios | 1 par domaine |
| Groupes permissions dev | 4 | ~8 |

### Docs & fichiers

| Ressource | Chemin |
|-----------|--------|
| Mocks webapp | `apps/webapp/src/lib/data/school.ts` |
| Mocks bulletins | `apps/webapp/src/lib/data/report-cards.ts` |
| Dataset seed | `testing/dev-fixtures/src/dataset.ts` |
| Seed entités | `apps/api/src/lib/seed/run-dev-seed.ts` |
| Seed permissions | `apps/api/src/lib/seed/run-dev-access-seed.ts` |
| Seed auth | `apps/api/src/lib/seed/run-dev-auth-seed.ts` |
| Tests seed | `apps/api/tests/seed/` |
| Commandes métier | `packages/core/src/services/school-service.ts` |
| Plan branchement webapp | [webapp-mock-migration-plan.md](./webapp-mock-migration-plan.md) |
| PGLite & comptes dev | [done/local-dev.md](./done/local-dev.md) |

**Règle de maintenance :** à chaque PR seed → tracker + backlog + date en tête.
