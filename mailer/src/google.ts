import { fromFsFields } from "./logic";

const enc = new TextEncoder();

function b64urlToBytes(s: string): Uint8Array {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function bytesToB64url(b: ArrayBuffer | Uint8Array): string {
  const u = b instanceof Uint8Array ? b : new Uint8Array(b);
  let s = "";
  for (const x of u) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export interface IdTokenClaims {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  firebase?: { sign_in_provider?: string };
}

const JWKS_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
let jwksCache: { keys: (JsonWebKey & { kid: string })[]; at: number } | null = null;

async function getJwks() {
  if (jwksCache && Date.now() - jwksCache.at < 3_600_000) return jwksCache.keys;
  const res = await fetch(JWKS_URL);
  if (!res.ok) throw new Error("Could not load Google signing keys");
  const body = (await res.json()) as { keys: (JsonWebKey & { kid: string })[] };
  jwksCache = { keys: body.keys, at: Date.now() };
  return body.keys;
}

/** Verify a Firebase ID token (RS256) and return its claims, or null if invalid. */
export async function verifyIdToken(token: string, projectId: string): Promise<IdTokenClaims | null> {
  try {
    const [h, p, s] = token.split(".");
    if (!h || !p || !s) return null;
    const header = JSON.parse(new TextDecoder().decode(b64urlToBytes(h))) as { alg: string; kid: string };
    if (header.alg !== "RS256") return null;
    const jwk = (await getJwks()).find((k) => k.kid === header.kid);
    if (!jwk) return null;
    const key = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const ok = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      b64urlToBytes(s),
      enc.encode(`${h}.${p}`)
    );
    if (!ok) return null;
    const c = JSON.parse(new TextDecoder().decode(b64urlToBytes(p))) as IdTokenClaims & {
      iss: string;
      aud: string;
      exp: number;
      iat: number;
    };
    const now = Math.floor(Date.now() / 1000);
    if (c.iss !== `https://securetoken.google.com/${projectId}`) return null;
    if (c.aud !== projectId) return null;
    if (c.exp < now || c.iat > now + 300) return null;
    if (!c.sub) return null;
    return c;
  } catch {
    return null;
  }
}

interface ServiceAccount {
  client_email: string;
  private_key: string;
}
let tokenCache: { token: string; exp: number } | null = null;

/** OAuth access token for the Firebase service account (cached ~50 min). */
export async function accessToken(saJson: string): Promise<string> {
  if (tokenCache && tokenCache.exp > Date.now() + 60_000) return tokenCache.token;
  const sa = JSON.parse(saJson) as ServiceAccount;
  const now = Math.floor(Date.now() / 1000);
  const head = bytesToB64url(enc.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const claim = bytesToB64url(
    enc.encode(
      JSON.stringify({
        iss: sa.client_email,
        scope: "https://www.googleapis.com/auth/cloud-platform",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
      })
    )
  );
  const pem = sa.private_key.replace(/-----[A-Z ]+-----/g, "").replace(/\s+/g, "");
  const key = await crypto.subtle.importKey(
    "pkcs8",
    Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(`${head}.${claim}`));
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${head}.${claim}.${bytesToB64url(sig)}`,
    }),
  });
  if (!res.ok) throw new Error(`Service account token request failed (${res.status})`);
  const body = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = { token: body.access_token, exp: Date.now() + body.expires_in * 1000 };
  return body.access_token;
}

const FS = (project: string) =>
  `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;

/** Read one document; null if it does not exist. */
export async function getDoc(
  project: string,
  token: string,
  path: string
): Promise<Record<string, unknown> | null> {
  const res = await fetch(`${FS(project)}/${path}`, { headers: { authorization: `Bearer ${token}` } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Firestore read failed (${res.status})`);
  const d = (await res.json()) as { fields?: Record<string, Record<string, unknown>> };
  return fromFsFields(d.fields ?? {});
}

/** List the documents in a collection (first 300 is plenty for one poll). */
export async function listDocs(
  project: string,
  token: string,
  path: string
): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${FS(project)}/${path}?pageSize=300`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Firestore list failed (${res.status})`);
  const d = (await res.json()) as {
    documents?: { fields?: Record<string, Record<string, unknown>> }[];
  };
  return (d.documents ?? []).map((x) => fromFsFields(x.fields ?? {}));
}

/** Set a single string field on a document, leaving everything else alone. */
export async function setStringField(
  project: string,
  token: string,
  path: string,
  field: string,
  value: string
): Promise<void> {
  const res = await fetch(`${FS(project)}/${path}?updateMask.fieldPaths=${field}`, {
    method: "PATCH",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ fields: { [field]: { stringValue: value } } }),
  });
  if (!res.ok) throw new Error(`Firestore write failed (${res.status})`);
}

/** The email of a Firebase user, or null (anonymous users have none). */
export async function userEmail(project: string, token: string, uid: string): Promise<string | null> {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:lookup`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ localId: [uid] }),
  });
  if (!res.ok) return null;
  const d = (await res.json()) as { users?: { email?: string }[] };
  return d.users?.[0]?.email ?? null;
}

/** Document paths (relative to the database root) in a collection. */
export async function listDocNames(project: string, token: string, path: string): Promise<string[]> {
  const res = await fetch(`${FS(project)}/${path}?pageSize=300&mask.fieldPaths=__name__`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Firestore list failed (${res.status})`);
  const d = (await res.json()) as { documents?: { name: string }[] };
  const prefix = `projects/${project}/databases/(default)/documents/`;
  return (d.documents ?? []).map((x) => x.name.replace(prefix, ""));
}

/** Polls created before `beforeMs`, oldest first (one page, so a daily job drains the backlog). */
export async function pollsCreatedBefore(
  project: string,
  token: string,
  beforeMs: number,
  limit: number
): Promise<{ id: string; data: Record<string, unknown> }[]> {
  const res = await fetch(`${FS(project)}:runQuery`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: "polls" }],
        where: {
          fieldFilter: { field: { fieldPath: "createdAt" }, op: "LESS_THAN", value: { integerValue: String(beforeMs) } },
        },
        orderBy: [{ field: { fieldPath: "createdAt" }, direction: "ASCENDING" }],
        limit,
      },
    }),
  });
  if (!res.ok) throw new Error(`Firestore query failed (${res.status})`);
  const rows = (await res.json()) as { document?: { name: string; fields?: Record<string, Record<string, unknown>> } }[];
  return rows
    .filter((r) => r.document)
    .map((r) => ({
      id: r.document!.name.split("/").pop()!,
      data: fromFsFields(r.document!.fields ?? {}),
    }));
}

export async function deleteDocPath(project: string, token: string, path: string): Promise<void> {
  const res = await fetch(`${FS(project)}/${path}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 404) throw new Error(`Firestore delete failed (${res.status})`);
}
