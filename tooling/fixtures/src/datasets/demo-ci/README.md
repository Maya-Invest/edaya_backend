# Dataset démo Côte d'Ivoire (compact)

Fixtures typées pour une école collège ivoirienne (Abidjan), entièrement en français.

Import : `demoCiDataset` depuis `@edaya/fixtures` ou `@edaya/fixtures/datasets/demo-ci`.

```text
demo-ci/
├── index.ts    # demoCiDataset (12 élèves — smoke / tests)
├── school.ts   # école, trimestres, niveaux collège, matières MENA-CI
├── people.ts   # élèves, personnel, parents (noms ivoiriens)
└── domains/
    └── scheduling.ts  # emploi du temps Mme Touré (ci-st1)
```

| Élément | Valeur |
|---------|--------|
| École | École Edaya — Cocody |
| Ville / pays | Abidjan, Côte d'Ivoire |
| Fuseau | `Africa/Abidjan` |
| Niveaux | 6ème → 3ème (Collège) |
| Classes | 6ème A, 6ème B, 5ème A |
| Élèves | 12 |
| Personnel | 7 |

## Seed dev local (défaut)

Le seed dev utilise **`demoCiDataset`** par défaut (`sch-edaya-ci-cocody`, 12 élèves, comptes `@ecole-ci.edaya.dev`) :

| Compte | Rôle |
|--------|------|
| `a.kone@ecole-ci.edaya.dev` | Propriétaire (ci-st8) |
| `j.aka@ecole-ci.edaya.dev` | Directeur (ci-st5) |
| `a.toure@ecole-ci.edaya.dev` | Enseignante (ci-st1) — maths en 6ème A et 5ème A |

Mot de passe : `DevPassword1!`

```bash
cd edaya_backend && bun seed:clean --yes
bun dev          # terminal 1
bun seed:init    # terminal 2, once API is ready
```

Pour le bulk ivoirien (1000 élèves) : `SEED_DATASET=ci`. Pour Ottawa : `SEED_DATASET=central` dans `apps/api/.env`.
