export type Locale = "fr" | "en";

type Params = Record<string, string | number>;

const fr = {
  // menu
  "menu.prompt": "Que veux-tu voir ?",
  "menu.today": "Aujourd'hui",
  "menu.week": "Semaine en cours",
  "menu.cal": "Calendrier du mois",
  "menu.sync": "Synchroniser maintenant",
  "menu.config": "Configurer",
  "menu.status": "Statut",
  "menu.quit": "Quitter",
  "menu.back": "Retour au menu ?",
  "menu.brand": "pige",

  // today
  "today.title": "Aujourd'hui",
  "today.nothing": "Rien enregistré aujourd'hui.",
  "today.total": "Total :",

  // week-detail
  "week.title": "Semaine {week}",
  "week.empty": "—",

  // summary (month + week sections)
  "summary.monthTitle": "Ce mois",
  "summary.weekTitle": "Semaine en cours (S{week})",
  "summary.weekTotal": "Total semaine :",
  "summary.ok": "  ✓ ok ",

  // calendar
  "calendar.daysHud": "{worked} / {business} jours",

  // sync
  "sync.start": "Synchronisation…",
  "sync.done": "{n} entries synced.",

  // status
  "status.title": "pige · statut",
  "status.config": "Config :",
  "status.org": "Org    :",
  "status.clients": "Clients :",
  "status.token": "Token  :",
  "status.cache": "Cache  :",
  "status.tokenAbsent": "❌ absent",
  "status.tokenValid": "✓ valide ({email})",
  "status.tokenRejected": "❌ rejeté par Solidtime",
  "status.cacheEntries": "{n} entries, sync il y a {min} min",
  "status.cacheEmpty": "vide",

  // config wizard
  "config.title": "pige · configuration",
  "config.tokenReuse": "Un token est déjà stocké. Garder ce token ?",
  "config.tokenInput": "Token API Solidtime :",
  "config.tokenStored": "   → stocké via {backend}",
  "config.connected": "   ✓ connecté en tant que {email}",
  "config.tokenRejected": "❌ Token rejeté par Solidtime : {msg}",
  "config.noOrgs": "❌ Aucune organisation Solidtime trouvée.",
  "config.org": "Organisation :",
  "config.noProjects": "❌ Aucun projet dans cette organisation.",
  "config.addClient": "Ajouter un autre client ?",
  "config.pickProjects": "Quels projets Solidtime appartiennent à ce client ?",
  "config.clientLabel": "Nom court du client :",
  "config.clientDefault": "Client",
  "config.color": "Couleur :",
  "config.target": "Objectif jours / semaine :",
  "config.hoursPerDay": "Heures par jour facturé (règle 7h=1j) :",
  "config.saved": "Configuration sauvegardée dans {path}",
  "config.validate.number": "Nombre attendu",
  "config.validate.positive": "Nombre positif attendu",

  // errors / bootstrap
  "errors.tokenAbsent": "Token Solidtime absent. Lance `pige config`.",
  "errors.tokenAbsentPrefixed": "❌ Token Solidtime absent. Lance `pige config`.",
  "errors.offline": "⚠ Mode hors-ligne, données du {timestamp}",
  "errors.unknownCmd": "Commande inconnue : {cmd}",
  "errors.noConfig": "Aucune configuration. Lancement du wizard…",
} as const;

const en: Record<keyof typeof fr, string> = {
  // menu
  "menu.prompt": "What do you want to see?",
  "menu.today": "Today",
  "menu.week": "Current week",
  "menu.cal": "Monthly calendar",
  "menu.sync": "Sync now",
  "menu.config": "Configure",
  "menu.status": "Status",
  "menu.quit": "Quit",
  "menu.back": "Back to menu?",
  "menu.brand": "pige",

  // today
  "today.title": "Today",
  "today.nothing": "Nothing logged today.",
  "today.total": "Total:",

  // week-detail
  "week.title": "Week {week}",
  "week.empty": "—",

  // summary
  "summary.monthTitle": "This month",
  "summary.weekTitle": "Current week (W{week})",
  "summary.weekTotal": "Week total:",
  "summary.ok": "  ✓ ok ",

  // calendar
  "calendar.daysHud": "{worked} / {business} days",

  // sync
  "sync.start": "Syncing…",
  "sync.done": "{n} entries synced.",

  // status
  "status.title": "pige · status",
  "status.config": "Config :",
  "status.org": "Org    :",
  "status.clients": "Clients:",
  "status.token": "Token  :",
  "status.cache": "Cache  :",
  "status.tokenAbsent": "❌ missing",
  "status.tokenValid": "✓ valid ({email})",
  "status.tokenRejected": "❌ rejected by Solidtime",
  "status.cacheEntries": "{n} entries, synced {min} min ago",
  "status.cacheEmpty": "empty",

  // config wizard
  "config.title": "pige · configuration",
  "config.tokenReuse": "A token is already stored. Keep it?",
  "config.tokenInput": "Solidtime API token:",
  "config.tokenStored": "   → stored via {backend}",
  "config.connected": "   ✓ logged in as {email}",
  "config.tokenRejected": "❌ Token rejected by Solidtime: {msg}",
  "config.noOrgs": "❌ No Solidtime organization found.",
  "config.org": "Organization:",
  "config.noProjects": "❌ No project in this organization.",
  "config.addClient": "Add another client?",
  "config.pickProjects": "Which Solidtime projects belong to this client?",
  "config.clientLabel": "Short client name:",
  "config.clientDefault": "Client",
  "config.color": "Color:",
  "config.target": "Target days per week:",
  "config.hoursPerDay": "Hours per billed day (7h=1d default):",
  "config.saved": "Configuration saved at {path}",
  "config.validate.number": "Number expected",
  "config.validate.positive": "Positive number expected",

  // errors / bootstrap
  "errors.tokenAbsent": "Solidtime token missing. Run `pige config`.",
  "errors.tokenAbsentPrefixed": "❌ Solidtime token missing. Run `pige config`.",
  "errors.offline": "⚠ Offline mode, data from {timestamp}",
  "errors.unknownCmd": "Unknown command: {cmd}",
  "errors.noConfig": "No configuration. Starting wizard…",
};

const DICTS: Record<Locale, Record<keyof typeof fr, string>> = { fr, en };

export type TranslationKey = keyof typeof fr;
export type T = (key: TranslationKey, params?: Params) => string;

export const MONTHS: Record<Locale, readonly string[]> = {
  fr: ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};

export const WEEKDAYS: Record<Locale, readonly string[]> = {
  fr: ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"],
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
};

export function createT(locale: Locale): T {
  const dict = DICTS[locale];
  return (key, params) => {
    let val: string = dict[key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        val = val.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
      }
    }
    return val;
  };
}

export function normalizeLocale(s: string | undefined | null): Locale {
  if (!s) return "en";
  return s.toLowerCase().startsWith("fr") ? "fr" : "en";
}

export function detectSystemLocale(): Locale {
  const raw = process.env.LANG ?? process.env.LC_ALL ?? process.env.LC_MESSAGES ?? "";
  return normalizeLocale(raw);
}
