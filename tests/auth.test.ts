import { describe, expect, it } from "bun:test";
import {
  computeHmac,
  parseCookies,
  getAdminKey,
  getViewerKey,
  isPublicMode,
  isPrivateMode,
  adminOnly,
  viewerRequired,
} from "../src/auth";

// Auth module caches keys at import time. These tests assume no keys are set.
// If DERBY_ADMIN_KEY or DERBY_VIEWER_KEY are in the environment (e.g., from another
// test script), the cached-key and public-mode assertions will fail.
const keysSet = !!(process.env.DERBY_ADMIN_KEY || process.env.DERBY_VIEWER_KEY);

describe.skipIf(keysSet)("Auth Module", () => {

  describe("computeHmac", () => {
    it("should produce consistent hex output", async () => {
      const result1 = await computeHmac("test-key", "test-purpose");
      const result2 = await computeHmac("test-key", "test-purpose");
      expect(result1).toBe(result2);
      expect(result1).toMatch(/^[0-9a-f]+$/);
      expect(result1.length).toBe(64); // SHA-256 = 32 bytes = 64 hex chars
    });

    it("should produce different output for different keys", async () => {
      const result1 = await computeHmac("key-a", "purpose");
      const result2 = await computeHmac("key-b", "purpose");
      expect(result1).not.toBe(result2);
    });

    it("should produce different output for different purposes", async () => {
      const result1 = await computeHmac("key", "purpose-a");
      const result2 = await computeHmac("key", "purpose-b");
      expect(result1).not.toBe(result2);
    });
  });

  describe("parseCookies", () => {
    it("should parse a single cookie", () => {
      const req = new Request("http://localhost", {
        headers: { cookie: "name=value" },
      });
      expect(parseCookies(req)).toEqual({ name: "value" });
    });

    it("should parse multiple cookies", () => {
      const req = new Request("http://localhost", {
        headers: { cookie: "a=1; b=2; c=3" },
      });
      expect(parseCookies(req)).toEqual({ a: "1", b: "2", c: "3" });
    });

    it("should return empty object for no cookie header", () => {
      const req = new Request("http://localhost");
      expect(parseCookies(req)).toEqual({});
    });

    it("should handle cookies with = in value", () => {
      const req = new Request("http://localhost", {
        headers: { cookie: "token=abc=def=ghi" },
      });
      expect(parseCookies(req)).toEqual({ token: "abc=def=ghi" });
    });

    it("should trim whitespace around names and values", () => {
      const req = new Request("http://localhost", {
        headers: { cookie: "  name  =  value  " },
      });
      expect(parseCookies(req)).toEqual({ name: "value" });
    });
  });

  // Keys are cached at module load. Tests run without DERBY_ADMIN_KEY / DERBY_VIEWER_KEY.
  describe("getAdminKey (cached at load)", () => {
    it("should return null when env was not set at import time", () => {
      expect(getAdminKey()).toBeNull();
    });
  });

  describe("getViewerKey (cached at load)", () => {
    it("should return null when env was not set at import time", () => {
      expect(getViewerKey()).toBeNull();
    });
  });

  describe("isPublicMode (cached at load)", () => {
    it("should return true when no admin key at import time", () => {
      expect(isPublicMode()).toBe(true);
    });
  });

  describe("isPrivateMode (cached at load)", () => {
    it("should return false when no viewer key at import time", () => {
      expect(isPrivateMode()).toBe(false);
    });
  });

  // Tests run without keys → public mode → wrappers pass through unconditionally.
  // Auth-enforcement paths are covered by integration tests (test:integration:auth).
  describe("adminOnly (public mode pass-through)", () => {
    it("should call the wrapped handler and return its response", async () => {
      const inner = () => new Response("ok", { status: 200 });
      const wrapped = adminOnly(inner);
      const req = new Request("http://localhost");
      const res = await wrapped(req, null);
      expect(res.status).toBe(200);
      expect(await res.text()).toBe("ok");
    });

    it("should forward request and server args to the handler", async () => {
      let receivedReq: any;
      let receivedServer: any;
      const inner = (req: any, server: any) => {
        receivedReq = req;
        receivedServer = server;
        return new Response("ok");
      };
      const wrapped = adminOnly(inner);
      const req = new Request("http://localhost/test");
      const server = { fake: true };
      await wrapped(req, server);
      expect(receivedReq).toBe(req);
      expect(receivedServer).toBe(server);
    });
  });

  describe("viewerRequired (public mode pass-through)", () => {
    it("should call the wrapped handler and return its response", async () => {
      const inner = () => new Response("viewer ok", { status: 200 });
      const wrapped = viewerRequired(inner);
      const req = new Request("http://localhost");
      const res = await wrapped(req, null);
      expect(res.status).toBe(200);
      expect(await res.text()).toBe("viewer ok");
    });
  });
});
