# Plan de migration — mocks webapp → PGLite

Transférer les données de démo du front (`apps/webapp/src/lib/data/`) vers la base **PGLite** de l'API (`DATABASE_URL=pglite`), via le seed de développement.

**Objectif :** après `bun dev`, un utilisateur connecté voit les **mêmes données** que les mocks, servies par `/api/core/*`.

**Dernière mise à jour :** 2026-06-11

---

## Tableau de bord

| Indicateur | Valeur |
|------------|--------|
| **Progression globale** | **16 / 16 domaines** complets · **100 %** |
| **Prochaine étape** | PR 10 — Décisions produit |
| **Bloquant webapp** | Aucun (decisions produit phase 10 uniquement) |

```
[████████████████████]  16/16 domaines
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
| 2 | Matières + programme + offerings classe 6a/6b/5a | ✅ | ✅ | ✅ | ✅ | ✅ |
| 3a | Catalogue frais | ✅ | ✅ | ✅ | ✅ | ✅ |
| 3b | Facturation élève (`student-fees`) | ✅ | ✅ | ✅ | ✅ | ✅ |
| 3c | Paiements | ✅ | ✅ | ✅ | ✅ | ✅ |
| 4 | Ressources + emploi du temps + sessions | ✅ | ✅ | ✅ | ✅ | ✅ |
| 5 | Évaluations + résultats | ✅ | ✅ | ✅ | ✅ | ✅ |
| 6a | Calendrier scolaire | ✅ | ✅ | ✅ | ✅ | ✅ |
| 6b | Incidents & discipline | ✅ | ✅ | ✅ | ✅ | ✅ |
| 6c | Absences / présences | ✅ | ✅ | ✅ | ✅ | ✅ |
| 7 | Santé + notes pédagogiques élève | ✅ | ✅ | ✅ | ✅ | ✅ |
| 8 | Bulletins (barèmes, modèles, résultats) | ✅ | ✅ | ✅ | ✅ | ✅ |
| 9 | Accès & auth (comptes + permissions dev) | ✅ | ✅ | ✅ | ✅ | ✅ |
| 10 | Activités / devoirs (sans entité API) | — | — | — | — | — |

**Légende colonnes**

| Colonne | Fichier / action |
|---------|------------------|
| `SEED_*` | Constantes dans `testing/dev-fixtures/src/dataset.ts` |
| `run-dev-seed` | Insertion via commandes métier dans `apps/api/src/lib/seed/run-dev-seed.ts` |
| Permissions | `apps/api/src/lib/seed/run-dev-access-seed.ts` |
| Test seed | Assertion liste non vide dans `apps/api/tests/seed/` |

**Notes tracker**

- **Phase 2 ✅** : offerings 6a/6b/5a ; `assignMatterToClassSubject` pour toutes les offerings ; `recordSessionProgress` échantillon sur sess-p1.
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

### Pédagogie — matières (phase 2)

- Catalogue 6 matières, programme (`SEED_SUBJECT_MATTERS`), offerings 6a/6b/5a avec enseignants
- `SEED_CLASS_SUBJECT_MATTERS` + `assignMatterToClassSubject` pour chaque offering
- Test : `class-subjects/list` ≥ 14

### Planning (phase 4)

- 7 ressources (`SEED_RESOURCES`), 8 créneaux récurrents + 8 sessions concrètes classe 6a
- Liens staff / ressources sur sessions ; `recordSessionProgress` échantillon (maths sess-p1)
- Permissions `DEV_WEBAPP_SCHEDULING_READ_PERMISSIONS` ; test `sessions/list` ≥ 8

### Évaluations (phase 5)

- 11 assessments classe 6a (`SEED_ASSESSMENTS`), 54 résultats partiels (`SEED_ASSESSMENT_RESULT_SCORES`)
- Coefficients entiers en seed (mock `0.5` / `1.5` arrondis — colonne DB integer)
- Permissions `DEV_WEBAPP_ASSESSMENT_READ_PERMISSIONS` ; tests `assessments/list`, `assessment-results/list`

### Vie scolaire (phases 6a–6c)

- 10 événements calendrier (`SEED_CALENDAR_EVENTS`, yc5 → 3 entrées par classe)
- 3 incidents + involvements (`SEED_INCIDENTS`) ; 8 absences (`SEED_ABSENCE_RECORDS`) + sessions dédiées
- Permissions calendrier / discipline / attendance ; test `test-dev-school-life-seed.test.ts`
- Webapp : `school-life-data.ts`, `/school/calendar`, `/school/events`, onglets élève absences/incidents

### Élève 360° (phase 7)

- 3 profils santé (`SEED_STUDENT_HEALTH_PROFILES`) ; 7 notes pédagogiques (`SEED_PEDAGOGICAL_NOTES`)
- Permissions `DEV_WEBAPP_STUDENT_360_READ_PERMISSIONS` ; test `test-dev-student-360-seed.test.ts`
- Webapp : `student-360-data.ts`, onglets élève (profil santé, notes), `StudentDetailsDialog`

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

`SEED_SCHOOL_*`, `SEED_GRADE_LEVELS`, `SEED_CLASSES`, `SEED_ACADEMIC_PERIODS`, `SEED_PERIOD_DEFINITIONS`, `SEED_FEES`, `SEED_STUDENT_FEES`, `SEED_PAYMENTS`, `SEED_STAFF`, `SEED_STUDENTS`, `SEED_GUARDIANS`, `SEED_SUBJECT_CATALOG`, `SEED_SUBJECT_MATTERS`, `SEED_CLASS_SUBJECTS`, `SEED_CLASS_SUBJECT_MATTERS`, `SEED_RESOURCES`, `SEED_PLANNING_SLOTS`, `SEED_SESSION_PROGRESS`, `SEED_ASSESSMENTS`, `SEED_ASSESSMENT_RESULT_SCORES`, `SEED_CALENDAR_EVENTS`, `SEED_INCIDENTS`, `SEED_ABSENCE_RECORDS`, `SEED_STUDENT_HEALTH_PROFILES`, `SEED_PEDAGOGICAL_NOTES`, `DEV_AUTH_*`

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

### PR 4 — Planning (phase 4) ✅

- [x] `SEED_RESOURCES` ← `resources[]`
- [x] `SEED_PLANNING_SLOTS` + sessions classe 6a (`createSchedule`, `createSession`)
- [x] Lier sessions → class-subjects, staff, resources
- [x] `recordSessionProgress` (échantillon sess-p1 / maths)
- [x] `DEV_WEBAPP_SCHEDULING_READ_PERMISSIONS` + test `sessions/list`

### PR 5 — Évaluations (phase 5) ✅

- [x] `SEED_ASSESSMENTS` ← `evaluations[]` (classe 6a, 11 entrées)
- [x] `SEED_ASSESSMENT_RESULT_SCORES` — notes partielles élèves s1–s6
- [x] `DEV_WEBAPP_ASSESSMENT_READ_PERMISSIONS`
- [x] Tests : `assessments/list`, `assessment-results/list`

### PR 6 — Vie scolaire (phases 6a–6c) ✅

- [x] Calendrier ← `schoolYearEvents[]`
- [x] Incidents ← `incidents[]` + involvements
- [x] Absences ← `absences[]`
- [x] Permissions attendance / discipline / calendrier
- [x] Tests list par entité
- [x] Webapp : `/school/calendar`, `/school/events`, onglets élève (absences / incidents)

### PR 7 — Élève 360° (phase 7) ✅

- [x] Santé ← `healthRecords`
- [x] Notes ← `pedagogicalNotes[]`
- [x] Tests : `student-health-profiles`, `student-notes/list`
- [x] Webapp : onglets élève (profil santé, notes), `StudentDetailsDialog`

### PR 8 — Bulletins (phase 8)

- [x] Barèmes ← `report-cards.ts` `gradeScales[]`
- [x] Modèles + sections
- [x] Résultats trimestre 1 classe 6a
- [x] `DEV_WEBAPP_REPORT_CARD_READ_PERMISSIONS`
- [x] Tests : `grade-scales`, `report-card-definitions`, `report-card-results`
- [x] Webapp : `report-cards-data.ts`, layout + `reportCardsContext.hydrateFromServer()`

### PR 9 — Auth & accès restants (phase 9)

- [x] Compte st2 (`m.garnier@school.edu`)
- [x] Comptes tuteurs g2–g6
- [x] Matrice UI `/configuration/roles` alignée sur `access-roles` seedés
- [x] Tests : auth seed (st2, g2), access-roles list

### PR 10 — Décisions produit (phase 10)

- [ ] Décision : `activities[]`, `deadlines[]`, deuxième école
- [ ] Implémenter ou marquer « mock permanent » dans `school.ts`

### Finitions transversales (phase 2 + champs UI-only)

- [x] `assignMatterToClassSubject` (progression par classe)
- [x] Matières classes 5a / autres niveaux
- [ ] Documenter champs UI-only non persistés (`Student.attendance`, `StaffMember.initials`, etc.)

---

## Détails par phase (phases ouvertes uniquement)

---

---

### Phase 4 — Emploi du temps & ressources ✅

**Source mock :** `school.ts` — `planning[]`, `resources[]`  
**Entités API :** `schedules`, `sessions`, `resources`, `resource-assignments`

**Écrans débloqués :** `/classes/[id]/timetable`, `/classes/[id]/teaching`  
**Prérequis journal :** `teachingLog.ts` = dérivé de `subjects` + `sessions` (décision **C6**)

---

### Phase 5 — Évaluations ✅

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

### Phase 7 — Élève 360° ✅

**Source mock :** `school.ts` — `healthRecords`, `pedagogicalNotes`  
**Écrans :** drawers `StudentDetailsDialog` (santé, notes), onglets élève

---

### Phase 8 — Bulletins ✅

**Source mock :** `report-cards.ts` — `gradeScales`, définitions, sections, résultats

**Écrans débloqués :** `/configuration/grade-scales`, `/configuration/report-cards`, `/classes/[id]/report-cards`

---

### Phase 9 — Accès & auth ✅

**Comptes seedés**

| Compte | Entité | Statut |
|--------|--------|--------|
| m.garnier@school.edu | st2 | ✅ |
| tuteurs g2–g6 | g2–g6 | ✅ |

**Groupes permissions créés**

- [x] `DEV_WEBAPP_FINANCE_READ_PERMISSIONS`
- [x] `DEV_WEBAPP_ASSESSMENT_READ_PERMISSIONS`
- [x] `DEV_WEBAPP_ATTENDANCE_READ_PERMISSIONS`
- [x] `DEV_WEBAPP_DISCIPLINE_READ_PERMISSIONS`
- [x] `DEV_WEBAPP_REPORT_CARD_READ_PERMISSIONS`

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
| C6 | `teachingLog.ts` après sessions seedées | ✅ sessions + progress seedés ; branchement webapp teaching à faire |

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
| Domaines seed complets | 11 / 16 | 16 / 16 |
| Constantes `SEED_*` | 22 | ~25 |
| Couverture mock `school.ts` | ~60 % | 100 % (hors UI-only) |
| Tests seed (assertions list) | 7 scénarios | 1 par domaine |
| Groupes permissions dev | 6 | ~8 |

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
