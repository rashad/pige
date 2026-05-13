import { describe, it, expect, vi, afterEach } from "vitest";
import { createSolidtimeClient } from "../../src/solidtime/client.js";

const ORG = "org-uuid";
const BASE = "https://app.solidtime.io/api";

afterEach(() => vi.unstubAllGlobals());

function stubFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    return await handler(url, init);
  }));
}

describe("solidtime client", () => {
  it("getMe sends bearer token and parses payload", async () => {
    stubFetch((url, init) => {
      expect(url).toContain("/users/me");
      expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer tok");
      return new Response(JSON.stringify({ data: { id: "u1", name: "Rashad", email: "x@y.z" } }), { status: 200 });
    });
    const c = createSolidtimeClient({ baseUrl: BASE, token: "tok", organizationId: ORG });
    const me = await c.getMe();
    expect(me.id).toBe("u1");
  });

  it("listProjects returns array", async () => {
    stubFetch((url) => {
      expect(url).toContain(`/organizations/${ORG}/projects`);
      return new Response(JSON.stringify({ data: [
        { id: "p1", name: "Acme website" },
        { id: "p2", name: "Globex CRM" },
      ]}), { status: 200 });
    });
    const c = createSolidtimeClient({ baseUrl: BASE, token: "tok", organizationId: ORG });
    const projects = await c.listProjects();
    expect(projects).toHaveLength(2);
    expect(projects[0]!.id).toBe("p1");
  });

  it("fetchTimeEntries normalises to camelCase", async () => {
    stubFetch((url) => {
      expect(url).toContain(`/organizations/${ORG}/time-entries`);
      expect(url).toContain("start=2026-05-01");
      expect(url).toContain("end=2026-05-31");
      return new Response(JSON.stringify({ data: [
        { id: "e1", start: "2026-05-13T08:00:00Z", end: "2026-05-13T15:00:00Z",
          duration: 25200, project_id: "p1", description: "dev", billable: true },
      ]}), { status: 200 });
    });
    const c = createSolidtimeClient({ baseUrl: BASE, token: "tok", organizationId: ORG });
    const entries = await c.fetchTimeEntries("2026-05-01", "2026-05-31");
    expect(entries[0]!.projectId).toBe("p1");
    expect(entries[0]!.duration).toBe(25200);
  });

  it("throws on 401", async () => {
    stubFetch(() => new Response(JSON.stringify({ message: "unauthenticated" }), { status: 401 }));
    const c = createSolidtimeClient({ baseUrl: BASE, token: "bad", organizationId: ORG });
    await expect(c.getMe()).rejects.toThrow(/401|unauth/i);
  });
});
