# freelance-cal — Design

**Date:** 2026-05-13
**Status:** Draft, awaiting user review
**Owner:** Rashad

## 1. Contexte

L'utilisateur facture en freelance 2–3 clients en parallèle. Le tracking horaire fin se fait déjà dans **Solidtime** (cloud, `app.solidtime.io`), qui donne des heures par projet. Le manque : une **vue calendrier mensuelle** consolidée pour vérifier la répartition entre clients et s'assurer qu'aucun n'est lésé, plus un **résumé daily rapide** dans le terminal.

Pas besoin d'un nouveau tracker — Solidtime reste la source de vérité. `freelance-cal` est une couche de lecture / agrégation / rendu au-dessus.

## 2. Objectifs

- Convertir les heures Solidtime en **jours facturés** (règle linéaire : 7 h = 1 j).
- Afficher un **calendrier mensuel** terminal lisible d'un coup d'œil (heatmap couleur dominante par jour).
- Afficher une **vue semaine** avec écart par rapport à un objectif `j/semaine` par client.
- Permettre un usage purement **interactif** (menu sans rien retenir) tout en gardant des sous-commandes directes pour les power users.
- Tenir entièrement dans le terminal (pas de surface web).

## 3. Non-objectifs

- Pas de saisie / modification du tracking (on n'écrit pas dans Solidtime).
- Pas de génération de factures PDF.
- Pas d'analytics historique long terme (mois/trimestre/an cumulés au-delà du strict nécessaire).
- Pas de multi-utilisateur.
- Pas de notifications push / email proactives.

## 4. Parcours utilisateur

### 4.1 Usage quotidien

```
$ freelance
  ╭─ freelance ─────────────────────────────────────╮
  │  Que veux-tu voir ?                             │
  │  ❯ Aujourd'hui              (t)                 │
  │    Semaine en cours         (w)                 │
  │    Calendrier du mois       (c)                 │
  │    ──────────────                               │
  │    Synchroniser maintenant  (s)                 │
  │    Configurer               (g)                 │
  │    Statut                   (i)                 │
  │    Quitter                  (q)                 │
  ╰─────────────────────────────────────────────────╯
```

Navigation flèches **ou** raccourci clavier direct (lettre entre parenthèses). Après affichage d'une vue : `↩ Entrée` revient au menu, `q` quitte.

### 4.2 Premier lancement

Si pas de config :

1. Wizard `freelance config` se déclenche automatiquement.
2. Demande le token API Solidtime, le valide (un appel `GET /me`), le stocke dans le macOS Keychain (fallback : `~/.config/freelance-cal/config.json` avec `chmod 0600` si keytar échoue).
3. Liste les projets Solidtime de l'utilisateur.
4. Pour chaque projet à suivre : nom court, couleur (palette pré-définie), objectif jours/semaine.
5. Confirme et fait un premier `sync`.

### 4.3 Sous-commandes directes (power user)

| Commande              | Comportement                                                                    |
|-----------------------|---------------------------------------------------------------------------------|
| `freelance`           | Menu interactif (défaut).                                                       |
| `freelance today`     | Résumé d'aujourd'hui + semaine en cours.                                        |
| `freelance week`      | Vue semaine détaillée (un jour par ligne). `--week 20`, `--year 2026`.          |
| `freelance cal`       | Calendrier mensuel heatmap. `--month 2026-04`.                                  |
| `freelance sync`      | Force un fetch complet, réécrit le cache.                                       |
| `freelance config`    | Wizard de (re)configuration. Idempotent.                                        |
| `freelance status`    | Token OK, dernière sync, version, chemin config.                                |
| `--fresh`             | Flag global : ignore le cache pour cette commande.                              |

## 5. Architecture

```
┌──────────────────────────────────────────────────────────┐
│  cli.ts (entry point, route)                             │
└────────────┬─────────────────────────────────────────────┘
             ▼
┌──────────────────────────────────────────────────────────┐
│  commands/ : menu, today, week, cal, sync, config, status│
└────────────┬─────────────────────────────────────────────┘
             ▼
┌──────────────────────────────────────────────────────────┐
│  domain/ : aggregate, convert, holidays, week            │
│  ↑                                                       │
│  cache/ : store (read/write JSON, TTL)                   │
│  ↑                                                       │
│  solidtime/ : client (fetch entries, projects)           │
│  ↑                                                       │
│  config/ : store, schema, keychain                       │
└────────────┬─────────────────────────────────────────────┘
             ▼
┌──────────────────────────────────────────────────────────┐
│  render/ : palette, bars, calendar, summary, box         │
│  (pure, prend un modèle agrégé → string ANSI)            │
└──────────────────────────────────────────────────────────┘
```

**Principes :**
- `render/*` est totalement pur : reçoit un modèle de données, retourne une string. Aucune dépendance vers `solidtime/*` ou `config/*`. Permet les snapshot tests sans réseau.
- `domain/*` ne sait rien du rendu. Sortie : structures normalisées.
- `solidtime/*` est la seule couche qui parle HTTP.
- `commands/*` orchestre : config → cache → fetch → aggregate → render → print.

### 5.1 Arborescence cible

```
freelance-cal/
├── package.json
├── tsconfig.json
├── src/
│   ├── cli.ts
│   ├── config/
│   │   ├── schema.ts
│   │   ├── store.ts
│   │   └── keychain.ts
│   ├── solidtime/
│   │   ├── client.ts
│   │   └── types.ts
│   ├── domain/
│   │   ├── aggregate.ts
│   │   ├── convert.ts
│   │   ├── holidays.ts
│   │   └── week.ts
│   ├── cache/
│   │   └── store.ts
│   ├── render/
│   │   ├── palette.ts
│   │   ├── bars.ts
│   │   ├── calendar.ts
│   │   ├── summary.ts
│   │   └── box.ts
│   └── commands/
│       ├── menu.ts
│       ├── today.ts
│       ├── week.ts
│       ├── cal.ts
│       ├── sync.ts
│       ├── config.ts
│       └── status.ts
├── tests/
│   ├── unit/
│   └── snapshots/
└── docs/
    └── superpowers/
        └── specs/
            └── 2026-05-13-freelance-cal-design.md
```

## 6. Stack technique

- **Runtime :** Node.js ≥ 20 (fetch natif, top-level await).
- **Langage :** TypeScript (strict).
- **Build :** `tsup` → bundle ESM unique avec shebang, exposé via `bin` dans `package.json`.
- **Dev loop :** `tsx src/cli.ts <args>`.
- **Package manager :** `npm` (par défaut ; `pnpm` ou `bun` également compatibles, choix laissé au dev).
- **Dépendances runtime :**
  - `chalk` (truecolor ANSI)
  - `@inquirer/prompts` (menu, wizard)
  - `date-holidays` (fériés FR, locale `fr`)
  - `keytar` *ou* fallback fichier (voir §10)
- **Tests :** `vitest`.

## 7. Data flow

```
                          ┌──────────────────┐
freelance <cmd>  ───────▶ │  load config     │
                          └────────┬─────────┘
                                   │ no config? → wizard
                                   ▼
                          ┌──────────────────┐
                          │  read cache      │
                          └────────┬─────────┘
                                   │
                ┌──────────────────┴──────────────────┐
                │                                     │
            cache OK                               cache miss
            (< TTL, period covered)                or --fresh
                │                                     │
                │                                     ▼
                │                          ┌──────────────────┐
                │                          │ solidtime.fetch  │
                │                          │ (period)         │
                │                          └────────┬─────────┘
                │                                   │
                │                                   ▼
                │                          ┌──────────────────┐
                │                          │ cache.write      │
                │                          └────────┬─────────┘
                │                                   │
                └─────────────────┬─────────────────┘
                                  ▼
                          ┌──────────────────┐
                          │ aggregate +      │
                          │ convert h → j    │
                          └────────┬─────────┘
                                   ▼
                          ┌──────────────────┐
                          │ render → stdout  │
                          └──────────────────┘
```

**Modèle agrégé (sortie de `domain/aggregate.ts`) :**

```ts
type AggregatedDay = {
  date: string;                       // ISO yyyy-mm-dd
  weekday: 0..6;                      // 0 = lundi
  isWeekend: boolean;
  isHoliday: boolean;
  holidayName?: string;
  perClient: Map<ClientId, number>;   // jours décimaux
  totalDays: number;
  dominantClient?: ClientId;          // null si WE/férié/vide
  isMixed: boolean;                   // ≥ 2 clients ce jour
};
```

## 8. Cache

- Fichier : `~/.config/freelance-cal/cache.json`
- TTL : **5 minutes**. Au-delà, refetch automatique.
- Stratégie : on cache les **entries brutes Solidtime** sur une fenêtre glissante de 90 jours, pas les agrégats — l'agrégation est rapide et déterministe.
- Schéma :
  ```json
  {
    "version": 1,
    "fetchedAt": "2026-05-13T10:22:31Z",
    "windowFrom": "2026-02-13",
    "windowTo": "2026-05-13",
    "entries": [ /* TimeEntry[] */ ]
  }
  ```
- `--fresh` ignore le cache.
- Mode hors-ligne : si fetch échoue **et** un cache (même expiré) existe, on l'utilise avec un warning `⚠ Mode hors-ligne, données du <timestamp>`.

## 9. Config

`~/.config/freelance-cal/config.json` :

```json
{
  "version": 1,
  "solidtime": {
    "baseUrl": "https://app.solidtime.io/api",
    "organizationId": "<uuid>"
  },
  "conversion": {
    "hoursPerDay": 7
  },
  "clients": [
    {
      "id": "acme",
      "solidtimeProjectIds": ["<uuid-1>"],
      "label": "Acme",
      "color": "blue",
      "targetDaysPerWeek": 3.0
    },
    {
      "id": "globex",
      "solidtimeProjectIds": ["<uuid-2>", "<uuid-3>"],
      "label": "Globex",
      "color": "green",
      "targetDaysPerWeek": 2.0
    }
  ],
  "locale": "fr-FR",
  "holidaysRegion": "FR"
}
```

- Un client peut mapper **plusieurs** projets Solidtime (utile si le client a sous-projets).
- Les projets non mappés tombent dans une catégorie "Autres" (gris, pas d'objectif).
- `color` : clé symbolique (`blue`, `green`, `amber`, `pink`, `cyan`, `purple`) → palette Catppuccin-like résolue dans `render/palette.ts`.

## 10. Sécurité & secrets

- **Token Solidtime** stocké dans le **macOS Keychain** via `keytar` (service: `freelance-cal`, account: `solidtime-token`).
- **Fallback** si keytar indisponible (par ex. dépendance native qui casse) : variable d'env `FREELANCE_SOLIDTIME_TOKEN`, sinon fichier `~/.config/freelance-cal/token` avec `chmod 0600`. Le wizard affiche un avertissement clair dans ce cas.
- Aucun token n'apparaît dans les logs ou les messages d'erreur (sanitization explicite).

## 11. Rendu visuel

Voir mockup détaillé dans la conversation. Principes :

- **Truecolor 24-bit** (fond coloré par jour, palette Catppuccin-like).
- Cellule jour = ` NN ` (3 colonnes) avec couleur de fond du client dominant.
- Jour mixte (≥ 2 clients) : couleur de fond du client majoritaire + petit marqueur (étoile / point) pour signaler le mix ; détail visible dans la vue semaine.
- Week-ends et fériés : fond gris très discret + numéro en gris clair.
- Barres de progression : blocs Unicode fractionnaires (`▏▎▍▌▋▊▉█`) pour rendu smooth.
- Bordures arrondies `╭ ╮ ╰ ╯`, séparateurs `──`.
- Détection du support couleur via `chalk` ; en absence de truecolor, fallback ANSI 256 puis 16.
- Largeur cible : 60 colonnes, dégrade proprement en dessous.

## 12. Erreurs

| Cas                                   | Comportement                                                                 |
|---------------------------------------|------------------------------------------------------------------------------|
| Pas de config                         | Bascule sur le wizard `config` automatiquement.                              |
| Token invalide (401)                  | Message clair, suggère `freelance config`. Exit 1, pas de stacktrace.        |
| Réseau indisponible                   | Fallback sur cache même expiré, warning visible.                             |
| Projet Solidtime supprimé             | Affiché "(archivé)" dans config/status, exclu des totaux.                    |
| Aucune entrée sur la période          | Message neutre, pas une erreur.                                              |
| Permissions Keychain refusées         | Suggère le fallback env var ou fichier 0600.                                 |
| Terminal sans support couleur         | Dégrade en ANSI 256 ou monochrome (lisibilité préservée).                    |
| Largeur terminal < 60 colonnes        | Layout compact (légende sur 2 lignes, totaux empilés).                       |

## 13. Tests

- **Unitaires (vitest)** sur tous les modules de `domain/` et `cache/`. Cas limites : 0 h, fractions, journées de 14 h, fuseaux, ISO week autour du nouvel an, Pâques mobile.
- **Snapshot tests** sur `render/*` : mois fixture → ANSI capturé → comparé. `FORCE_COLOR=3` en CI pour stabilité.
- **Mock HTTP** pour `solidtime/client.ts` (`msw` ou stub `fetch`).
- Pas de tests E2E — la combinaison cli → render via snapshot couvre l'essentiel.

## 14. Open questions / Future work

- **Vue trimestre/année** (cumulé par client) — pas dans la v1, à ajouter si le besoin se confirme après quelques mois d'usage.
- **Export CSV** des jours facturés par client/mois (utile pour comptable) — à considérer après v1.
- **Publication npm** ou usage purement local via `npm link` — décision laissée à l'implémentation (par défaut : local, pas de publication).
- **Cron / launchd** pour synchroniser le cache en arrière-plan — hors scope v1, l'utilisateur synchronise à la demande.
- **Multi-organisation Solidtime** : la v1 suppose une seule `organizationId` ; à élargir si besoin.
