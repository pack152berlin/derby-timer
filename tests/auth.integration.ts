import { describe, expect, it } from "bun:test";
import { computeHmac, ADMIN_PURPOSE, VIEWER_PURPOSE, ADMIN_LOGIN_PURPOSE } from "../src/auth";

const port = Bun.env.PORT ?? "3000";
const baseUrl = `http://localhost:${port}`;

const ADMIN_KEY = "test-secret";
const VIEWER_KEY = "test-viewer";

const getAdminCookie = async () => {
  const hmac = await computeHmac(ADMIN_KEY, ADMIN_PURPOSE);
  return `derby_admin=${hmac}`;
};

const getViewerCookie = async () => {
  const hmac = await computeHmac(VIEWER_KEY, VIEWER_PURPOSE);
  return `derby_viewer=${hmac}`;
};

const extractSetCookies = (res: Response): string[] => {
  const cookies: string[] = [];
  res.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") {
      cookies.push(value);
    }
  });
  return cookies;
};

describe("Auth Integration Tests", () => {
  describe("Admin Login", () => {
    it("POST /auth/login with admin password → 200 + admin role + Set-Cookie", async () => {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: ADMIN_KEY }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.role).toBe("admin");
      const cookies = extractSetCookies(res);
      const adminCookie = cookies.find((c) => c.startsWith("derby_admin="));
      expect(adminCookie).toBeDefined();
      expect(adminCookie).toContain("HttpOnly");
    });

    it("POST /auth/login with wrong password → 401", async () => {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "wrong" }),
      });
      expect(res.status).toBe(401);
    });

    it("GET /admin/login?token=<hmac> → 302 + Set-Cookie", async () => {
      const hmac = await computeHmac(ADMIN_KEY, ADMIN_LOGIN_PURPOSE);
      const res = await fetch(
        `${baseUrl}/admin/login?token=${hmac}`,
        { redirect: "manual" }
      );
      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe("/");
      const cookies = extractSetCookies(res);
      const adminCookie = cookies.find((c) => c.startsWith("derby_admin="));
      expect(adminCookie).toBeDefined();
    });

    it("GET /admin/login?token=<raw-key> → 401 (raw key rejected)", async () => {
      const res = await fetch(
        `${baseUrl}/admin/login?token=${ADMIN_KEY}`,
        { redirect: "manual" }
      );
      expect(res.status).toBe(401);
    });

    it("GET /admin/login?token=wrong → 401", async () => {
      const res = await fetch(
        `${baseUrl}/admin/login?token=wrong`,
        { redirect: "manual" }
      );
      expect(res.status).toBe(401);
    });
  });

  describe("Viewer Login", () => {
    it("POST /auth/login with viewer password → 200 + viewer role + Set-Cookie", async () => {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: VIEWER_KEY }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.role).toBe("viewer");
      const cookies = extractSetCookies(res);
      const viewerCookie = cookies.find((c) => c.startsWith("derby_viewer="));
      expect(viewerCookie).toBeDefined();
    });

    it("POST /auth/login with wrong password → 401", async () => {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "wrong" }),
      });
      expect(res.status).toBe(401);
    });
  });

  describe("Admin Status", () => {
    it("GET /admin/status without cookies → not admin, not viewer", async () => {
      const res = await fetch(`${baseUrl}/admin/status`);
      expect(res.status).toBe(200);
      const status = await res.json();
      expect(status.admin).toBe(false);
      expect(status.viewer).toBe(false);
      expect(status.publicMode).toBe(false);
      expect(status.privateMode).toBe(true);
    });

    it("GET /admin/status with admin cookie → admin=true, viewer=true", async () => {
      const cookie = await getAdminCookie();
      const res = await fetch(`${baseUrl}/admin/status`, {
        headers: { cookie },
      });
      expect(res.status).toBe(200);
      const status = await res.json();
      expect(status.admin).toBe(true);
      expect(status.viewer).toBe(true);
    });

    it("GET /admin/status with viewer cookie → admin=false, viewer=true", async () => {
      const cookie = await getViewerCookie();
      const res = await fetch(`${baseUrl}/admin/status`, {
        headers: { cookie },
      });
      expect(res.status).toBe(200);
      const status = await res.json();
      expect(status.admin).toBe(false);
      expect(status.viewer).toBe(true);
    });
  });

  describe("Protected Mutations (adminOnly)", () => {
    it("POST /api/events without cookie → 401", async () => {
      const res = await fetch(`${baseUrl}/api/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Test", date: "2026-01-01" }),
      });
      expect(res.status).toBe(401);
    });

    it("POST /api/events with admin cookie → 201", async () => {
      const cookie = await getAdminCookie();
      const res = await fetch(`${baseUrl}/api/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify({
          name: "Auth Test Event",
          date: "2026-01-01",
          lane_count: 4,
        }),
      });
      expect(res.status).toBe(201);
      const event = await res.json();
      expect(event.name).toBe("Auth Test Event");
    });

    it("POST /api/events with viewer cookie → 401", async () => {
      const cookie = await getViewerCookie();
      const res = await fetch(`${baseUrl}/api/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify({ name: "Test", date: "2026-01-01" }),
      });
      expect(res.status).toBe(401);
    });
  });

  describe("Protected Reads (viewerRequired in private mode)", () => {
    it("GET /api/events without cookie → 401", async () => {
      const res = await fetch(`${baseUrl}/api/events`);
      expect(res.status).toBe(401);
    });

    it("GET /api/events with viewer cookie → 200", async () => {
      const cookie = await getViewerCookie();
      const res = await fetch(`${baseUrl}/api/events`, {
        headers: { cookie },
      });
      expect(res.status).toBe(200);
      const events = await res.json();
      expect(Array.isArray(events)).toBe(true);
    });

    it("GET /api/events with admin cookie → 200", async () => {
      const cookie = await getAdminCookie();
      const res = await fetch(`${baseUrl}/api/events`, {
        headers: { cookie },
      });
      expect(res.status).toBe(200);
    });
  });

  describe("Admin Logout", () => {
    it("POST /admin/logout clears the admin cookie", async () => {
      const res = await fetch(`${baseUrl}/admin/logout`, {
        method: "POST",
      });
      expect(res.status).toBe(200);
      const cookies = extractSetCookies(res);
      const adminCookie = cookies.find((c) => c.startsWith("derby_admin="));
      expect(adminCookie).toBeDefined();
      expect(adminCookie).toContain("Max-Age=0");
    });
  });

  describe("Viewer Logout", () => {
    it("POST /viewer/logout clears the viewer cookie", async () => {
      const res = await fetch(`${baseUrl}/viewer/logout`, {
        method: "POST",
      });
      expect(res.status).toBe(200);
      const cookies = extractSetCookies(res);
      const viewerCookie = cookies.find((c) => c.startsWith("derby_viewer="));
      expect(viewerCookie).toBeDefined();
      expect(viewerCookie).toContain("Max-Age=0");
    });
  });

  describe("Rate Limiting", () => {
    // NOTE: All requests from this test file share the same IP ("direct").
    // This test must run last — once the rate limit is hit, subsequent login
    // attempts from this IP will also be rejected until the 60s window expires.
    it("11 rapid login attempts → 429", async () => {
      for (let i = 0; i < 10; i++) {
        await fetch(`${baseUrl}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: "wrong" }),
        });
      }
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "wrong" }),
      });
      expect(res.status).toBe(429);
    });
  });
});
