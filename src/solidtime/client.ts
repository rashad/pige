import type { SolidtimeProject, SolidtimeMe, TimeEntry } from "./types.js";

export type SolidtimeClientOptions = {
  baseUrl: string;
  token: string;
  organizationId: string;
};

export type SolidtimeClient = {
  getMe(): Promise<SolidtimeMe>;
  listOrganizations(): Promise<{ id: string; name: string }[]>;
  listProjects(): Promise<SolidtimeProject[]>;
  fetchTimeEntries(fromYmd: string, toYmd: string): Promise<TimeEntry[]>;
};

export function createSolidtimeClient(opts: SolidtimeClientOptions): SolidtimeClient {
  async function req<T>(path: string): Promise<T> {
    const url = `${opts.baseUrl}${path}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${opts.token}`,
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Solidtime ${res.status} on ${path}: ${body.slice(0, 200)}`);
    }
    const json = (await res.json()) as { data: T };
    return json.data;
  }

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
    async listProjects() {
      return req<SolidtimeProject[]>(`/v1/organizations/${opts.organizationId}/projects`);
    },
    async fetchTimeEntries(fromYmd: string, toYmd: string) {
      const qs = new URLSearchParams({ start: fromYmd, end: toYmd, per_page: "1000" }).toString();
      const raw = await req<Array<{
        id: string; start: string; end: string | null; duration: number | null;
        project_id: string; description?: string; billable?: boolean;
      }>>(`/v1/organizations/${opts.organizationId}/time-entries?${qs}`);
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
