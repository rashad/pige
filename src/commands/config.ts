import { input, select, checkbox, password, confirm } from "@inquirer/prompts";
import { loadConfig, saveConfig, configPath } from "../config/store.js";
import { defaultConfig, type Client, type ColorKey } from "../config/schema.js";
import { setToken, getToken } from "../config/keychain.js";
import { createSolidtimeClient } from "../solidtime/client.js";
import { accent, dim } from "../render/palette.js";
import { type Locale, createT, normalizeLocale, detectSystemLocale } from "../i18n.js";

const COLORS: ColorKey[] = ["blue", "green", "amber", "pink", "cyan", "purple"];

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24);
}

export async function runConfig(): Promise<void> {
  // Detect initial locale
  const existingCfgEarly = await loadConfig();
  let locale: Locale = existingCfgEarly
    ? normalizeLocale(existingCfgEarly.locale)
    : detectSystemLocale();

  const langChoice = await select({
    message: "Language / Langue ?",
    default: locale,
    choices: [
      { name: "Français", value: "fr" as Locale },
      { name: "English",  value: "en" as Locale },
    ],
  });
  locale = langChoice;
  let t = createT(locale);

  console.log(accent(t("config.title")));
  console.log();

  const existing = await getToken();
  let token: string | null = existing;
  if (existing) {
    const reuse = await confirm({ message: t("config.tokenReuse"), default: true });
    if (!reuse) token = null;
  }
  if (!token) {
    token = await password({ message: t("config.tokenInput"), mask: "•" });
    const stored = await setToken(token);
    console.log(dim(t("config.tokenStored", { backend: stored.backend })));
  }

  const tmpClient = createSolidtimeClient({
    baseUrl: "https://app.solidtime.io/api",
    token: token!,
    organizationId: "PLACEHOLDER",
  });

  let me: Awaited<ReturnType<typeof tmpClient.getMe>> | undefined;
  try {
    me = await tmpClient.getMe();
  } catch (e: unknown) {
    console.error(t("config.tokenRejected", { msg: (e as Error).message }));
    process.exit(1);
  }
  if (!me) process.exit(1);
  console.log(dim(t("config.connected", { email: me.email })));

  const orgs = await tmpClient.listOrganizations();
  if (orgs.length === 0) {
    console.error(t("config.noOrgs"));
    process.exit(1);
  }
  const orgId =
    orgs.length === 1
      ? orgs[0]!.id
      : await select({
          message: t("config.org"),
          default: existingCfgEarly?.solidtime.organizationId,
          choices: orgs.map((o) => ({ name: o.name, value: o.id })),
        });

  const realClient = createSolidtimeClient({
    baseUrl: "https://app.solidtime.io/api",
    token: token!,
    organizationId: orgId,
  });
  const projects = await realClient.listProjects();
  if (projects.length === 0) {
    console.error(t("config.noProjects"));
    process.exit(1);
  }

  const existingCfg = existingCfgEarly ?? defaultConfig(orgId);

  const clients: Client[] = existingCfg.clients.map((c) => ({ ...c }));
  const mappedIds = new Set(clients.flatMap((c) => c.solidtimeProjectIds));
  const remaining = projects.filter((p) => !mappedIds.has(p.id));

  if (clients.length > 0) {
    console.log(dim(t("config.existingClients", { labels: clients.map((c) => c.label).join(", ") })));
  }

  while (remaining.length > 0) {
    const addMore =
      clients.length === 0
        ? true
        : await confirm({ message: t("config.addClient"), default: false });
    if (!addMore) break;

    const picked: string[] = await checkbox({
      message: t("config.pickProjects"),
      choices: remaining.map((p) => ({ name: p.name, value: p.id })),
    });
    if (picked.length === 0) continue;

    const firstPickedId = picked[0]!;
    const defaultLabel = projects.find((p) => p.id === firstPickedId)?.name ?? t("config.clientDefault");
    const label = await input({
      message: t("config.clientLabel"),
      default: defaultLabel,
    });
    const color = (await select({
      message: t("config.color"),
      choices: COLORS.map((c) => ({ name: c, value: c })),
    })) as ColorKey;
    const targetStr = await input({
      message: t("config.target"),
      default: "2.5",
      validate: (s) => !Number.isNaN(parseFloat(s)) || t("config.validate.number"),
    });

    clients.push({
      id: slugify(label) || `c${clients.length + 1}`,
      solidtimeProjectIds: picked,
      label,
      color,
      targetDaysPerWeek: parseFloat(targetStr),
    });
    for (const id of picked) {
      const i = remaining.findIndex((p) => p.id === id);
      if (i >= 0) remaining.splice(i, 1);
    }
  }

  const hoursStr = await input({
    message: t("config.hoursPerDay"),
    default: String(existingCfg.conversion.hoursPerDay),
    validate: (s) => parseFloat(s) > 0 || t("config.validate.positive"),
  });

  const cfg = {
    ...existingCfg,
    solidtime: { ...existingCfg.solidtime, organizationId: orgId },
    conversion: { hoursPerDay: parseFloat(hoursStr) },
    clients,
    locale,
  };
  await saveConfig(configPath(), cfg);
  console.log();
  console.log(`${accent("✓")} ${t("config.saved", { path: configPath() })}`);
}
