import { input, select, checkbox, password, confirm } from "@inquirer/prompts";
import { loadConfig, saveConfig, configPath } from "../config/store.js";
import { defaultConfig, type Client, type ColorKey } from "../config/schema.js";
import { setToken, getToken } from "../config/keychain.js";
import { createSolidtimeClient } from "../solidtime/client.js";
import { accent, dim } from "../render/palette.js";

const COLORS: ColorKey[] = ["blue", "green", "amber", "pink", "cyan", "purple"];

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24);
}

export async function runConfig(): Promise<void> {
  console.log(accent("freelance-cal · configuration"));
  console.log();

  const existing = await getToken();
  let token: string | null = existing;
  if (existing) {
    const reuse = await confirm({ message: "Un token est déjà stocké. Garder ce token ?", default: true });
    if (!reuse) token = null;
  }
  if (!token) {
    token = await password({ message: "Token API Solidtime :", mask: "•" });
    const stored = await setToken(token);
    console.log(dim(`   → stocké via ${stored.backend}`));
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
    console.error(`❌ Token rejeté par Solidtime : ${(e as Error).message}`);
    process.exit(1);
  }
  if (!me) process.exit(1);
  console.log(dim(`   ✓ connecté en tant que ${me.email}`));

  const orgs = await tmpClient.listOrganizations();
  if (orgs.length === 0) {
    console.error("❌ Aucune organisation Solidtime trouvée.");
    process.exit(1);
  }
  const orgId =
    orgs.length === 1
      ? orgs[0]!.id
      : await select({
          message: "Organisation :",
          choices: orgs.map((o) => ({ name: o.name, value: o.id })),
        });

  const realClient = createSolidtimeClient({
    baseUrl: "https://app.solidtime.io/api",
    token: token!,
    organizationId: orgId,
  });
  const projects = await realClient.listProjects();
  if (projects.length === 0) {
    console.error("❌ Aucun projet dans cette organisation.");
    process.exit(1);
  }

  const existingCfg = (await loadConfig()) ?? defaultConfig(orgId);

  const clients: Client[] = [];
  const remaining = [...projects];

  while (remaining.length > 0) {
    const addMore =
      clients.length === 0
        ? true
        : await confirm({ message: "Ajouter un autre client ?", default: false });
    if (!addMore) break;

    const picked: string[] = await checkbox({
      message: "Quels projets Solidtime appartiennent à ce client ?",
      choices: remaining.map((p) => ({ name: p.name, value: p.id })),
    });
    if (picked.length === 0) continue;

    const firstPickedId = picked[0]!;
    const defaultLabel = projects.find((p) => p.id === firstPickedId)?.name ?? "Client";
    const label = await input({
      message: "Nom court du client :",
      default: defaultLabel,
    });
    const color = (await select({
      message: "Couleur :",
      choices: COLORS.map((c) => ({ name: c, value: c })),
    })) as ColorKey;
    const targetStr = await input({
      message: "Objectif jours / semaine :",
      default: "2.5",
      validate: (s) => !Number.isNaN(parseFloat(s)) || "Nombre attendu",
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
    message: "Heures par jour facturé (règle 7h=1j) :",
    default: String(existingCfg.conversion.hoursPerDay),
    validate: (s) => parseFloat(s) > 0 || "Nombre positif attendu",
  });

  const cfg = {
    ...existingCfg,
    solidtime: { ...existingCfg.solidtime, organizationId: orgId },
    conversion: { hoursPerDay: parseFloat(hoursStr) },
    clients,
  };
  await saveConfig(configPath(), cfg);
  console.log();
  console.log(`${accent("✓")} Configuration sauvegardée dans ${dim(configPath())}`);
}
