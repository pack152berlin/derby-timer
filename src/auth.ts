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
  writeFileSync(keyPath, key, { encoding: "utf-8", mode: 0o600 });
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
export const ADMIN_LOGIN_PURPOSE = "derby_admin_login";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

// Precompute expected HMACs at startup — keys never change at runtime
const _expectedAdminHmac = _adminKey ? await computeHmac(_adminKey, ADMIN_PURPOSE) : null;
const _expectedViewerHmac = _viewerKey ? await computeHmac(_viewerKey, VIEWER_PURPOSE) : null;
const _expectedAdminLoginHmac = _adminKey ? await computeHmac(_adminKey, ADMIN_LOGIN_PURPOSE) : null;

export const isSecureRequest = (req: Request): boolean => {
  if (new URL(req.url).protocol === "https:") return true;
  const proto = req.headers.get("x-forwarded-proto");
  return proto === "https";
};

const setCookie = (
  headers: Headers,
  name: string,
  value: string,
  maxAge: number,
  secure: boolean = false
) => {
  let cookie = `${name}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
  if (secure) cookie += "; Secure";
  headers.append("Set-Cookie", cookie);
};

export const setAdminCookie = (headers: Headers, secure: boolean = false): void => {
  if (!_expectedAdminHmac) return;
  setCookie(headers, ADMIN_COOKIE, _expectedAdminHmac, COOKIE_MAX_AGE, secure);
};

export const setViewerCookie = (headers: Headers, secure: boolean = false): void => {
  if (!_expectedViewerHmac) return;
  setCookie(headers, VIEWER_COOKIE, _expectedViewerHmac, COOKIE_MAX_AGE, secure);
};

export const clearAdminCookie = (headers: Headers): void => {
  setCookie(headers, ADMIN_COOKIE, "", 0);
};

export const clearViewerCookie = (headers: Headers): void => {
  setCookie(headers, VIEWER_COOKIE, "", 0);
};

// ===== COOKIE VALIDATION =====

const validateAdminCookie = (
  cookies: Record<string, string>
): boolean => {
  if (!_expectedAdminHmac) return false;
  const cookie = cookies[ADMIN_COOKIE];
  if (!cookie) return false;
  return timingSafeEqual(cookie, _expectedAdminHmac);
};

const validateViewerCookie = (
  cookies: Record<string, string>
): boolean => {
  if (!_expectedViewerHmac) return false;
  const cookie = cookies[VIEWER_COOKIE];
  if (!cookie) return false;
  return timingSafeEqual(cookie, _expectedViewerHmac);
};

export const hasViewerAccess = (req: Request): boolean => {
  if (_publicMode) return true;
  if (!_privateMode) return true;
  const cookies = parseCookies(req);
  if (validateAdminCookie(cookies)) return true;
  if (validateViewerCookie(cookies)) return true;
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
    if (!validateAdminCookie(cookies)) {
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
    if (validateAdminCookie(cookies)) {
      return handler(req, server);
    }

    if (validateViewerCookie(cookies)) {
      return handler(req, server);
    }

    return respondJson({ error: "Unauthorized" }, 401);
  };
};

// ===== AUTH STATUS =====

export const getAuthStatus = (
  req: Request
): {
  admin: boolean;
  viewer: boolean;
  publicMode: boolean;
  privateMode: boolean;
} => {
  if (_publicMode) {
    return { admin: true, viewer: true, publicMode: true, privateMode: false };
  }

  const cookies = parseCookies(req);
  const admin = validateAdminCookie(cookies);
  const viewer = admin || (_privateMode && validateViewerCookie(cookies));

  return { admin, viewer, publicMode: false, privateMode: _privateMode };
};

// ===== LOGIN TOKEN VALIDATION =====

export const validateLoginToken = (token: string): boolean => {
  if (!_expectedAdminLoginHmac) return false;
  return timingSafeEqual(token, _expectedAdminLoginHmac);
};

// ===== LOGIN RATE LIMITING =====

const LOGIN_RATE_LIMIT = 10;
const LOGIN_RATE_WINDOW_MS = 60_000;
const _loginAttempts = new Map<string, number[]>();

const getClientIp = (req: Request): string => {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "direct";
};

export const checkLoginRateLimit = (req: Request): boolean => {
  const ip = getClientIp(req);
  const now = Date.now();
  const attempts = _loginAttempts.get(ip);
  const recent = attempts ? attempts.filter((t) => now - t < LOGIN_RATE_WINDOW_MS) : [];

  if (recent.length >= LOGIN_RATE_LIMIT) {
    _loginAttempts.set(ip, recent);
    return false;
  }

  recent.push(now);
  _loginAttempts.set(ip, recent);
  return true;
};

// Periodic cleanup to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now();
  for (const [ip, attempts] of _loginAttempts) {
    const recent = attempts.filter((t) => now - t < LOGIN_RATE_WINDOW_MS);
    if (recent.length === 0) _loginAttempts.delete(ip);
    else _loginAttempts.set(ip, recent);
  }
}, LOGIN_RATE_WINDOW_MS).unref();

// ===== STARTUP LOGGING =====

export const logAuthConfig = (): void => {
  if (!_adminKey) {
    if (_viewerKey) {
      console.warn("Auth: DERBY_VIEWER_KEY is set but DERBY_ADMIN_KEY is not — viewer key ignored");
    }
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
