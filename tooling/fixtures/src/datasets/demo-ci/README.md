# Dataset démo Côte d'Ivoire (compact)

Fixtures typées pour une école collège ivoirienne (Abidjan), entièrement en français.

Import : `demoCiDataset` depuis `@edaya/fixtures` ou `@edaya/fixtures/datasets/demo-ci`.

```text
demo-ci/
├── index.ts    # demoCiDataset (12 élèves — smoke / tests)
├── school.ts   # école, trimestres, niveaux collège, matières MENA-CI
├── people.ts   # élèves, personnel, parents (noms ivoiriens)
├── teachers.ts # enseignants portail (Teacher + TeacherAssignment)
└── domains/
    └── scheduling.ts  # emploi du temps Mme Touré (ci-t1)
```

| Élément | Valeur |
|---------|--------|
| École | École Edaya — Cocody |
| Ville / pays | Abidjan, Côte d'Ivoire |
| Fuseau | `Africa/Abidjan` |
| Niveaux | 6ème → 3ème (Collège) |
| Classes | 6ème A, 6ème B, 5ème A |
| Élèves | 12 |
| Personnel | 5 |
| Enseignants portail | 2 (`ci-t1`, `ci-t2`) |

## Seed dev local (défaut)

Le seed dev utilise **`demoCiDataset`** par défaut (`sch-edaya-ci-cocody`, 12 élèves, comptes `@ecole-ci.edaya.dev`) :

| Compte | Rôle |
|--------|------|
| `a.kone@ecole-ci.edaya.dev` | Propriétaire (ci-st8) |
| `j.aka@ecole-ci.edaya.dev` | Directeur (ci-st5) |
| `f.assi@ecole-ci.edaya.dev` | Professeur principal / coord. (ci-st3) |
| `a.toure@ecole-ci.edaya.dev` | Enseignante portail (ci-t1) — maths en 6ème A et 5ème A |
| `k.diomande@ecole-ci.edaya.dev` | Enseignant portail (ci-t2) — PP 6ème B |

Mot de passe : `DevPassword1!`

```bash
cd edaya_backend && bun seed:clean --yes
bun dev          # terminal 1
bun seed:init    # terminal 2, once API is ready
```

Pour le bulk ivoirien (1000 élèves) : `SEED_DATASET=ci`. Pour Ottawa : `SEED_DATASET=central` dans `apps/api/.env`.
