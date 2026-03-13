import { describe, expect, it } from "bun:test";
import { computeHmac } from "../src/auth";

const port = Bun.env.PORT ?? "3000";
const baseUrl = `http://localhost:${port}`;

const ADMIN_KEY = "test-secret";
const VIEWER_KEY = "test-viewer";

const getAdminCookie = async () => {
  const hmac = await computeHmac(ADMIN_KEY, "derby_admin_session");
  return `derby_admin=${hmac}`;
};

const getViewerCookie = async () => {
  const hmac = await computeHmac(VIEWER_KEY, "derby_viewer_session");
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
    it("POST /admin/login with correct password → 200 + Set-Cookie", async () => {
      const res = await fetch(`${baseUrl}/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: ADMIN_KEY }),
      });
      expect(res.status).toBe(200);
      const cookies = extractSetCookies(res);
      const adminCookie = cookies.find((c) => c.startsWith("derby_admin="));
      expect(adminCookie).toBeDefined();
      expect(adminCookie).toContain("HttpOnly");
    });

    it("POST /admin/login with wrong password → 401", async () => {
      const res = await fetch(`${baseUrl}/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "wrong" }),
      });
      expect(res.status).toBe(401);
    });

    it("GET /admin/login?token=<correct> → 302 + Set-Cookie", async () => {
      const res = await fetch(
        `${baseUrl}/admin/login?token=${ADMIN_KEY}`,
        { redirect: "manual" }
      );
      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe("/");
      const cookies = extractSetCookies(res);
      const adminCookie = cookies.find((c) => c.startsWith("derby_admin="));
      expect(adminCookie).toBeDefined();
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
    it("POST /viewer/login with correct password → 200 + Set-Cookie", async () => {
      const res = await fetch(`${baseUrl}/viewer/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: VIEWER_KEY }),
      });
      expect(res.status).toBe(200);
      const cookies = extractSetCookies(res);
      const viewerCookie = cookies.find((c) => c.startsWith("derby_viewer="));
      expect(viewerCookie).toBeDefined();
    });

    it("POST /viewer/login with wrong password → 401", async () => {
      const res = await fetch(`${baseUrl}/viewer/login`, {
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
});
