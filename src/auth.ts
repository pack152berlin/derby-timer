import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

// ===== KEY MANAGEMENT =====

const getKeyFilePath = (): string => {
  const dbPath = Bun.env.DERBY_DB_PATH;
  if (dbPath) {
    return join(dirname(dbPath), ".derby_admin_key");
  }
  return ".derby_admin_key";
};

const resolveAutoKey = (): string => {
  const keyPath = getKeyFilePath();
  if (existsSync(keyPath)) {
    return readFileSync(keyPath, "utf-8").trim();
  }

  const key = crypto.randomUUID();
  const dir = dirname(keyPath);
  if (dir !== "." && !existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(keyPath, key, "utf-8");
  return key;
};

const resolveAdminKey = (): string | null => {
  const envValue = Bun.env.DERBY_ADMIN_KEY;
  if (!envValue) return null;
  if (envValue === "auto") return resolveAutoKey();
  return envValue;
};

// Cache at module load — env vars don't change at runtime
const _adminKey = resolveAdminKey();
const _viewerKey = Bun.env.DERBY_VIEWER_KEY || null;
const _publicMode = _adminKey === null;
const _privateMode = _viewerKey !== null;

export const getAdminKey = (): string | null => _adminKey;
export const getViewerKey = (): string | null => _viewerKey;
export const isPublicMode = (): boolean => _publicMode;
export const isPrivateMode = (): boolean => _privateMode;

// ===== TIMING-SAFE COMPARISON =====

import { timingSafeEqual as _tsEqual } from "node:crypto";

export const timingSafeEqual = (a: string, b: string): boolean => {
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);
  if (bufA.byteLength !== bufB.byteLength) return false;
  return _tsEqual(bufA, bufB);
};

// ===== SHARED HTTP HELPER =====

export const respondJson = (payload: unknown, status = 200) => {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
};

// ===== HMAC COOKIE =====

export const computeHmac = async (
  key: string,
  purpose: string
): Promise<string> => {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    encoder.encode(purpose)
  );
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

// ===== COOKIE HELPERS =====

export const parseCookies = (req: Request): Record<string, string> => {
  const header = req.headers.get("cookie");
  if (!header) return {};

  const cookies: Record<string, string> = {};
  for (const pair of header.split(";")) {
    const eqIndex = pair.indexOf("=");
    if (eqIndex === -1) continue;
    const name = pair.slice(0, eqIndex).trim();
    const value = pair.slice(eqIndex + 1).trim();
    if (name) cookies[name] = value;
  }
  return cookies;
};

export const ADMIN_COOKIE = "derby_admin";
export const VIEWER_COOKIE = "derby_viewer";
export const ADMIN_PURPOSE = "derby_admin_session";
export const VIEWER_PURPOSE = "derby_viewer_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

const setCookie = (
  headers: Headers,
  name: string,
  value: string,
  maxAge: number
) => {
  headers.append(
    "Set-Cookie",
    `${name}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}`
  );
};

export const setAdminCookie = async (headers: Headers): Promise<void> => {
  if (!_adminKey) return;
  const hmac = await computeHmac(_adminKey, ADMIN_PURPOSE);
  setCookie(headers, ADMIN_COOKIE, hmac, COOKIE_MAX_AGE);
};

export const setViewerCookie = async (headers: Headers): Promise<void> => {
  if (!_viewerKey) return;
  const hmac = await computeHmac(_viewerKey, VIEWER_PURPOSE);
  setCookie(headers, VIEWER_COOKIE, hmac, COOKIE_MAX_AGE);
};

export const clearAdminCookie = (headers: Headers): void => {
  setCookie(headers, ADMIN_COOKIE, "", 0);
};

export const clearViewerCookie = (headers: Headers): void => {
  setCookie(headers, VIEWER_COOKIE, "", 0);
};

// ===== COOKIE VALIDATION =====

const validateAdminCookie = async (
  cookies: Record<string, string>
): Promise<boolean> => {
  if (!_adminKey) return false;
  const expected = await computeHmac(_adminKey, ADMIN_PURPOSE);
  return cookies[ADMIN_COOKIE] === expected;
};

const validateViewerCookie = async (
  cookies: Record<string, string>
): Promise<boolean> => {
  if (!_viewerKey) return false;
  const expected = await computeHmac(_viewerKey, VIEWER_PURPOSE);
  return cookies[VIEWER_COOKIE] === expected;
};

export const hasViewerAccess = async (req: Request): Promise<boolean> => {
  if (_publicMode) return true;
  if (!_privateMode) return true;
  const cookies = parseCookies(req);
  if (await validateAdminCookie(cookies)) return true;
  if (await validateViewerCookie(cookies)) return true;
  return false;
};

// ===== MIDDLEWARE WRAPPERS =====

type Handler = (req: any, server: any) => Response | Promise<Response>;

export const adminOnly = (handler: Handler): Handler => {
  return async (req, server) => {
    if (_publicMode) {
      return handler(req, server);
    }

    const cookies = parseCookies(req);
    const isAdmin = await validateAdminCookie(cookies);
    if (!isAdmin) {
      return respondJson({ error: "Unauthorized" }, 401);
    }

    return handler(req, server);
  };
};

export const viewerRequired = (handler: Handler): Handler => {
  return async (req, server) => {
    if (_publicMode) {
      return handler(req, server);
    }

    if (!_privateMode) {
      return handler(req, server);
    }

    const cookies = parseCookies(req);

    // Admin cookie implicitly satisfies viewer check
    const isAdmin = await validateAdminCookie(cookies);
    if (isAdmin) {
      return handler(req, server);
    }

    const isViewer = await validateViewerCookie(cookies);
    if (isViewer) {
      return handler(req, server);
    }

    return respondJson({ error: "Unauthorized" }, 401);
  };
};

// ===== AUTH STATUS =====

export const getAuthStatus = async (
  req: Request
): Promise<{
  admin: boolean;
  viewer: boolean;
  publicMode: boolean;
  privateMode: boolean;
}> => {
  if (_publicMode) {
    return { admin: true, viewer: true, publicMode: true, privateMode: false };
  }

  const cookies = parseCookies(req);
  const admin = await validateAdminCookie(cookies);
  const viewer = admin || (_privateMode && (await validateViewerCookie(cookies)));

  return { admin, viewer, publicMode: false, privateMode: _privateMode };
};

// ===== STARTUP LOGGING =====

export const logAuthConfig = (): void => {
  if (!_adminKey) {
    console.log("Auth: PUBLIC MODE (no DERBY_ADMIN_KEY set)");
    return;
  }

  const masked = _adminKey.length <= 8
    ? `${"*".repeat(_adminKey.length)}`
    : `${_adminKey.slice(0, 4)}..${_adminKey.slice(-4)}`;
  console.log(`Auth: Admin key configured (${_adminKey.length} chars, ${masked})`);

  if (_privateMode) {
    console.log("Auth: PRIVATE MODE (viewer password required for reads)");
  } else {
    console.log("Auth: Standard mode (reads are public, mutations require admin)");
  }
};
