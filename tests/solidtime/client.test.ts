import { afterEach, describe, expect, it, vi } from "vitest";
import { createAuthClient, createOrgClient } from "../../src/solidtime/client.js";

const ORG = "org-uuid";
const BASE = "https://app.solidtime.io/api";

afterEach(() => vi.unstubAllGlobals());

function stubFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      return await handler(url, init);
    }),
  );
}

describe("AuthClient", () => {
  it("getMe sends bearer token and parses payload", async () => {
    stubFetch((url, init) => {
      expect(url).toContain("/users/me");
      expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer tok");
      return new Response(JSON.stringify({ data: { id: "u1", name: "Rashad", email: "x@y.z" } }), {
        status: 200,
      });
    });
    const c = createAuthClient({ baseUrl: BASE, token: "tok" });
    const me = await c.getMe();
    expect(me.id).toBe("u1");
  });

  it("listOrganizations flattens memberships", async () => {
    stubFetch(
      () =>
        new Response(
          JSON.stringify({
            data: [
              { organization: { id: "o1", name: "Acme Inc" } },
              { organization: { id: "o2", name: "Globex" } },
            ],
          }),
          { status: 200 },
        ),
    );
    const c = createAuthClient({ baseUrl: BASE, token: "tok" });
    const orgs = await c.listOrganizations();
    expect(orgs).toEqual([
      { id: "o1", name: "Acme Inc" },
      { id: "o2", name: "Globex" },
    ]);
  });

  it("throws on 401 without retrying", async () => {
    let calls = 0;
    stubFetch(() => {
      calls++;
      return new Response(JSON.stringify({ message: "unauthenticated" }), { status: 401 });
    });
    const c = createAuthClient({ baseUrl: BASE, token: "bad", retryDelayMs: 0 });
    await expect(c.getMe()).rejects.toThrow(/401|unauth/i);
    expect(calls).toBe(1);
  });
});

describe("OrgClient", () => {
  it("listProjects hits the org-scoped endpoint", async () => {
    stubFetch((url) => {
      expect(url).toContain(`/organizations/${ORG}/projects`);
      return new Response(
        JSON.stringify({
          data: [
            { id: "p1", name: "Acme website" },
            { id: "p2", name: "Globex CRM" },
          ],
        }),
        { status: 200 },
      );
    });
    const c = createOrgClient({ baseUrl: BASE, token: "tok", organizationId: ORG });
    const projects = await c.listProjects();
    expect(projects).toHaveLength(2);
    expect(projects[0]!.id).toBe("p1");
  });

  it("fetchTimeEntries normalises to camelCase and uses ISO-Z datetimes", async () => {
    stubFetch((url) => {
      expect(url).toContain(`/organizations/${ORG}/time-entries`);
      expect(url).toContain("start=2026-05-01T00%3A00%3A00Z");
      expect(url).toContain("end=2026-05-31T23%3A59%3A59Z");
      return new Response(
        JSON.stringify({
          data: [
            {
              id: "e1",
              start: "2026-05-13T08:00:00Z",
              end: "2026-05-13T15:00:00Z",
              duration: 25200,
              project_id: "p1",
              description: "dev",
              billable: true,
            },
          ],
        }),
        { status: 200 },
      );
    });
    const c = createOrgClient({ baseUrl: BASE, token: "tok", organizationId: ORG });
    const entries = await c.fetchTimeEntries("2026-05-01", "2026-05-31");
    expect(entries[0]!.projectId).toBe("p1");
    expect(entries[0]!.duration).toBe(25200);
  });
});

describe("transport retry behaviour", () => {
  it("retries once on 503 then succeeds", async () => {
    let calls = 0;
    stubFetch(() => {
      calls++;
      if (calls === 1) return new Response("upstream", { status: 503 });
      return new Response(JSON.stringify({ data: { id: "u1", name: "x", email: "x@y.z" } }), { status: 200 });
    });
    const c = createAuthClient({ baseUrl: BASE, token: "tok", retryDelayMs: 0 });
    const me = await c.getMe();
    expect(calls).toBe(2);
    expect(me.id).toBe("u1");
  });

  it("does NOT retry on 4xx", async () => {
    let calls = 0;
    stubFetch(() => {
      calls++;
      return new Response(JSON.stringify({ message: "bad request" }), { status: 400 });
    });
    const c = createOrgClient({ baseUrl: BASE, token: "tok", organizationId: ORG, retryDelayMs: 0 });
    await expect(c.listProjects()).rejects.toThrow(/400/);
    expect(calls).toBe(1);
  });

  it("gives up after one retry on persistent 5xx", async () => {
    let calls = 0;
    stubFetch(() => {
      calls++;
      return new Response("still bad", { status: 503 });
    });
    const c = createAuthClient({ baseUrl: BASE, token: "tok", retryDelayMs: 0 });
    await expect(c.getMe()).rejects.toThrow(/503/);
    expect(calls).toBe(2);
  });
});
