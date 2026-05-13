export type ColorKey = "blue" | "green" | "amber" | "pink" | "cyan" | "purple";

export type ClientId = string;

export type Client = {
  id: ClientId;
  solidtimeProjectIds: string[];
  label: string;
  color: ColorKey;
  targetDaysPerWeek: number;
};

export type Config = {
  version: 1;
  solidtime: {
    baseUrl: string;
    organizationId: string;
  };
  conversion: {
    hoursPerDay: number;
  };
  clients: Client[];
  locale: string;
  holidaysRegion: string;
};

export const CONFIG_VERSION = 1 as const;

export function defaultConfig(orgId: string): Config {
  return {
    version: CONFIG_VERSION,
    solidtime: { baseUrl: "https://app.solidtime.io/api", organizationId: orgId },
    conversion: { hoursPerDay: 7 },
    clients: [],
    locale: "fr-FR",
    holidaysRegion: "FR",
  };
}
