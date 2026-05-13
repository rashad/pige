import type { SolidtimeProject, SolidtimeMe, TimeEntry } from "./types.js";

export type AuthClient = {
  getMe(): Promise<SolidtimeMe>;
  listOrganizations(): Promise<{ id: string; name: string }[]>;
};

export type OrgClient = {
  listProjects(): Promise<SolidtimeProject[]>;
  fetchTimeEntries(fromYmd: string, toYmd: string): Promise<TimeEntry[]>;
};

type TransportOptions = {
  baseUrl: string;
  token: string;
  /** Override the 5xx-retry delay (default 500ms). Tests can pass 0. */
  retryDelayMs?: number;
};

function createTransport(opts: TransportOptions) {
  const retryDelayMs = opts.retryDelayMs ?? 500;

  async function req<T>(path: string): Promise<T> {
    const url = `${opts.baseUrl}${path}`;
    let attempt = 0;
    while (true) {
      attempt++;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${opts.token}`,
          Accept: "application/json",
        },
      });
      if (res.ok) {
        const json = (await res.json()) as { data: T };
        return json.data;
      }
      // Retry once on 5xx; never retry 4xx (client error, won't change).
      if (res.status >= 500 && attempt < 2) {
        if (retryDelayMs > 0) await new Promise((r) => setTimeout(r, retryDelayMs));
        continue;
      }
      const body = await res.text().catch(() => "");
      throw new Error(`Solidtime ${res.status} on ${path}: ${body.slice(0, 200)}`);
    }
  }

  return { req };
}

export function createAuthClient(opts: TransportOptions): AuthClient {
  const { req } = createTransport(opts);
  return {
    async getMe() {
      return req<SolidtimeMe>(`/v1/users/me`);
    },
    async listOrganizations() {
      const memberships = await req<Array<{ organization: { id: string; name: string } }>>(
        `/v1/users/me/memberships`,
      );
      return memberships.map((m) => m.organization);
    },
  };
}

export function createOrgClient(opts: TransportOptions & { organizationId: string }): OrgClient {
  const { req } = createTransport(opts);
  const orgId = opts.organizationId;
  return {
    async listProjects() {
      return req<SolidtimeProject[]>(`/v1/organizations/${orgId}/projects`);
    },
    async fetchTimeEntries(fromYmd: string, toYmd: string) {
      // Solidtime requires the Y-m-d\TH:i:s\Z format (UTC), not bare dates.
      const startIso = `${fromYmd}T00:00:00Z`;
      const endIso   = `${toYmd}T23:59:59Z`;
      const qs = new URLSearchParams({ start: startIso, end: endIso, per_page: "1000" }).toString();
      const raw = await req<Array<{
        id: string; start: string; end: string | null; duration: number | null;
        project_id: string; description?: string; billable?: boolean;
      }>>(`/v1/organizations/${orgId}/time-entries?${qs}`);
      return raw.map((e) => ({
        id: e.id,
        start: e.start,
        end: e.end,
        duration: e.duration,
        projectId: e.project_id,
        description: e.description ?? "",
        billable: e.billable ?? true,
      }));
    },
  };
}
