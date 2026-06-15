import {
  randomUUID,
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createCipheriv,
  createDecipheriv,
  createHash,
} from "node:crypto";
import { q1, run } from "./db.server";

export const now = () => Date.now();
export const uid = () => randomUUID();

// ---------- errors surfaced to the client ----------
export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppError";
  }
}
export const fail = (msg: string): never => {
  throw new AppError(msg);
};

// ---------- passwords ----------
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  return timingSafeEqual(candidate, Buffer.from(hash, "hex"));
}

// ---------- stock encryption (AES-256-GCM at rest) ----------
function getStockKey(): Buffer {
  const rawKey = process.env.STOCK_ENCRYPTION_KEY;
  if (!rawKey) {
    throw new Error(
      "STOCK_ENCRYPTION_KEY env var is not set. " +
        "Add a long random string to your .env file. " +
        "See .env.example. Refusing to encrypt/decrypt with an unset key — " +
        "stock items would be encrypted under a public constant, exposing all sold goods.",
    );
  }
  return createHash("sha256").update(rawKey).digest();
}

export function encryptStock(plaintext: string): string {
  const key = getStockKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return `${iv.toString("hex")}.${cipher.getAuthTag().toString("hex")}.${enc.toString("hex")}`;
}

export function decryptStock(stored: string): string {
  const key = getStockKey();
  const [iv, tag, data] = stored.split(".");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "hex"));
  decipher.setAuthTag(Buffer.from(tag, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(data, "hex")), decipher.final()]).toString(
    "utf8",
  );
}

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

// ---------- identifiers ----------
export function makeOrderNo(): string {
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = randomBytes(3).toString("hex").toUpperCase();
  return `ORD-${ymd}-${rand}`;
}

export function makePayAddress(network: string): string {
  // Simulated gateway deposit address; a real integration gets this from the
  // payment provider (NOWPayments etc.) per order.
  const body = randomBytes(17).toString("hex").slice(0, 33);
  if (network === "TRC20") return `T${body.toUpperCase().slice(0, 33)}`;
  return `0x${randomBytes(20).toString("hex")}`;
}

export function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
  return `${base}-${randomBytes(2).toString("hex")}`;
}

// ---------- notifications / audit ----------
export async function notify(
  userId: string,
  type: string,
  title: string,
  body: string,
  link?: string,
) {
  await run(
    `insert into notifications (id, user_id, type, title, body, link, created_at) values (?,?,?,?,?,?,?)`,
    [uid(), userId, type, title, body, link ?? null, now()],
  );
}

export async function audit(
  actorId: string | null,
  action: string,
  entity?: string,
  entityId?: string,
  meta?: unknown,
) {
  await run(
    `insert into audit_logs (actor_id, action, entity, entity_id, meta, created_at) values (?,?,?,?,?,?)`,
    [actorId, action, entity ?? null, entityId ?? null, meta ? JSON.stringify(meta) : null, now()],
  );
}

// ---------- settings ----------
export interface SiteSettings {
  default_commission_pct: number;
  withdrawal_fee_cents: number;
  min_withdrawal_cents: number;
  auto_confirm_hours: number;
  payment_window_minutes: number;
  maintenance_mode: number;
  announcement: string | null;
  credit_withdrawal_fee_pct: number;
  credit_withdrawal_min_fee_cents: number;
  attachment_max_mb: number;
  presence_ping_seconds: number;
  low_stock_threshold: number;
  dispute_sla_hours: number;
  chat_rate_limit_per_min: number;
  automod_severity: string;
}

// Settings are read on nearly every server function (banner, getMe, money,
// chat rate-limit). Cache in-isolate for 30s to avoid round-tripping a small
// constant row on every request — admin updates clear it via clearSettingsCache().
let _settingsCache: { v: SiteSettings; at: number } | null = null;
const SETTINGS_TTL_MS = 30_000;

export async function getSettings(): Promise<SiteSettings> {
  const now_ = Date.now();
  if (_settingsCache && now_ - _settingsCache.at < SETTINGS_TTL_MS) {
    return _settingsCache.v;
  }
  const v = (await q1<SiteSettings>(`select * from site_settings where id = 1`))!;
  _settingsCache = { v, at: now_ };
  return v;
}

export function clearSettingsCache() {
  _settingsCache = null;
}

// ---------- chat helpers ----------
const AUTOMOD_PATTERNS: Array<[RegExp, string]> = [
  [/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i, "email address"],
  [/(\+?\d[\d\s().-]{7,}\d)/, "phone number"],
  [
    /\b(telegram|t\.me|whatsapp|wa\.me|discord\.gg|discord\.com\/invite|signal\.me|signal|viber|wechat|kakao|line\.me|skype|snapchat|instagram|facebook|messenger|m\.me|twitter|x\.com|t\.co)\b/i,
    "external messenger / social",
  ],
  [/(@[a-z0-9_]{4,}\b|#\d{4}\b)/i, "external handle (Telegram / Discord tag)"],
  [
    /\b(paypal|venmo|cashapp|cash\.app|zelle|western union|moneygram|bank transfer|wire transfer|iban|swift|btc address|bitcoin address|usdt address|0x[a-f0-9]{20,})\b/i,
    "off-platform payment",
  ],
  [/\bpay(ing)?\s+(me\s+)?(outside|directly|off[- ]?site|in[- ]?person)\b/i, "fee circumvention"],
  [
    /\b(meet[- ]?up|in person|street address|zip\s?code|postal code)\b/i,
    "physical contact / address",
  ],
  [
    /https?:\/\/(?!(?:[\w-]+\.)*(?:warm-trade-space\.lovable\.app|x-?vault\.[a-z]{2,}))\S+/i,
    "external link",
  ],
];

export function automodCheck(body: string): string | null {
  for (const [re, reason] of AUTOMOD_PATTERNS) {
    if (re.test(body)) return reason;
  }
  return null;
}

export async function systemMessage(conversationId: string, body: string) {
  await run(
    `insert into messages (id, conversation_id, sender_id, body, is_system, created_at) values (?,?,null,?,1,?)`,
    [uid(), conversationId, body, now()],
  );
  await run(`update conversations set last_message_at = ? where id = ?`, [now(), conversationId]);
}

export async function getOrCreateOrderConversation(orderId: string): Promise<string> {
  const existing = await q1<{ id: string }>(`select id from conversations where order_id = ?`, [
    orderId,
  ]);
  if (existing) return existing.id;
  const o = (await q1<{ buyer_id: string; seller_id: string; product_id: string }>(
    `select buyer_id, seller_id, product_id from orders where id = ?`,
    [orderId],
  ))!;
  const id = uid();
  await run(
    `insert into conversations (id, order_id, product_id, buyer_id, seller_id, created_at) values (?,?,?,?,?,?)`,
    [id, orderId, o.product_id, o.buyer_id, o.seller_id, now()],
  );
  return id;
}
