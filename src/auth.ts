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

export const getAdminKey = (): string | null => {
  const envValue = Bun.env.DERBY_ADMIN_KEY;
  if (!envValue) return null;
  if (envValue === "auto") return resolveAutoKey();
  return envValue;
};

export const getViewerKey = (): string | null => {
  return Bun.env.DERBY_VIEWER_KEY || null;
};

export const isPublicMode = (): boolean => {
  return getAdminKey() === null;
};

export const isPrivateMode = (): boolean => {
  return getViewerKey() !== null;
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

const ADMIN_COOKIE = "derby_admin";
const VIEWER_COOKIE = "derby_viewer";
const ADMIN_PURPOSE = "derby_admin_session";
const VIEWER_PURPOSE = "derby_viewer_session";
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
  const key = getAdminKey();
  if (!key) return;
  const hmac = await computeHmac(key, ADMIN_PURPOSE);
  setCookie(headers, ADMIN_COOKIE, hmac, COOKIE_MAX_AGE);
};

export const setViewerCookie = async (headers: Headers): Promise<void> => {
  const key = getViewerKey();
  if (!key) return;
  const hmac = await computeHmac(key, VIEWER_PURPOSE);
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
  const key = getAdminKey();
  if (!key) return false;
  const expected = await computeHmac(key, ADMIN_PURPOSE);
  return cookies[ADMIN_COOKIE] === expected;
};

const validateViewerCookie = async (
  cookies: Record<string, string>
): Promise<boolean> => {
  const key = getViewerKey();
  if (!key) return false;
  const expected = await computeHmac(key, VIEWER_PURPOSE);
  return cookies[VIEWER_COOKIE] === expected;
};

// ===== MIDDLEWARE WRAPPERS =====

type Handler = (req: any, server: any) => Response | Promise<Response>;

const respondJson = (payload: unknown, status = 200) => {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
};

export const adminOnly = (handler: Handler): Handler => {
  return async (req, server) => {
    if (isPublicMode()) {
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
    if (isPublicMode()) {
      return handler(req, server);
    }

    if (!isPrivateMode()) {
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
  const pub = isPublicMode();
  const priv = isPrivateMode();

  if (pub) {
    return { admin: true, viewer: true, publicMode: true, privateMode: false };
  }

  const cookies = parseCookies(req);
  const admin = await validateAdminCookie(cookies);
  const viewer = admin || (priv && (await validateViewerCookie(cookies)));

  return { admin, viewer, publicMode: false, privateMode: priv };
};

// ===== STARTUP LOGGING =====

export const logAuthConfig = (): void => {
  const adminKey = getAdminKey();
  if (!adminKey) {
    console.log("Auth: PUBLIC MODE (no DERBY_ADMIN_KEY set)");
    return;
  }

  console.log(`Auth: Admin key configured (${adminKey.length} chars)`);
  console.log(`Auth: Admin key: ${adminKey}`);

  if (isPrivateMode()) {
    console.log("Auth: PRIVATE MODE (viewer password required for reads)");
  } else {
    console.log("Auth: Standard mode (reads are public, mutations require admin)");
  }
};
