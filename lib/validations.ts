import { z } from "zod";

// ── Order creation ────────────────────────────────────────────────────────────
export const CreateOrderSchema = z.object({
  gameSlug:      z.string().min(1).max(80).regex(/^[a-z0-9-]+$/, "Invalid game slug"),
  productId:     z.string().uuid("Invalid product ID"),
  playerUid:     z.string().min(1).max(100).regex(/^[a-zA-Z0-9_\-\.]+$/, "Invalid player UID"),
  serverId:      z.string().max(50).regex(/^[a-zA-Z0-9_\-]*$/).optional().nullable(),
  paymentMethod: z.enum(["KHQR", "ABA", "ACLEDA", "WING"]),
  promoCode:     z.string().max(30).optional().nullable(),
});

// ── Promo code validation ─────────────────────────────────────────────────────
export const ValidatePromoSchema = z.object({
  code:      z.string().min(1).max(30).regex(/^[A-Z0-9_\-]+$/i, "Invalid promo code"),
  productId: z.string().uuid("Invalid product ID"),
});

// ── Admin login ───────────────────────────────────────────────────────────────
export const AdminLoginSchema = z.object({
  username: z.string().min(1).max(50),
  password: z.string().min(8).max(100),
});

// ── Game create/update ────────────────────────────────────────────────────────
export const GameSchema = z.object({
  name:        z.string().min(1).max(100),
  slug:        z.string().min(1).max(80).regex(/^[a-z0-9-]+$/),
  description: z.string().max(2000).optional(),
  imageUrl:    z.string().url().optional().nullable(),
  active:      z.boolean().optional(),
  sortOrder:   z.number().int().min(0).optional(),
});

// ── Product create/update ─────────────────────────────────────────────────────
export const ProductSchema = z.object({
  gameId:      z.string().uuid(),
  name:        z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  amountUsd:   z.number().positive().max(10_000),
  diamonds:    z.number().int().min(1).optional(),
  active:      z.boolean().optional(),
  sortOrder:   z.number().int().min(0).optional(),
});

// ── Banner ────────────────────────────────────────────────────────────────────
export const BannerSchema = z.object({
  title:    z.string().min(1).max(200),
  imageUrl: z.string().url(),
  linkUrl:  z.string().url().optional().nullable(),
  active:   z.boolean().optional(),
});

// ── Promo code create ─────────────────────────────────────────────────────────
export const PromoCodeSchema = z.object({
  code:           z.string().min(3).max(30).regex(/^[A-Z0-9_\-]+$/i),
  discountType:   z.enum(["PERCENT", "FIXED"]),
  discountValue:  z.number().positive().max(100),
  maxUses:        z.number().int().positive().optional().nullable(),
  expiresAt:      z.string().datetime().optional().nullable(),
  active:         z.boolean().optional(),
});

// ── Order lookup ──────────────────────────────────────────────────────────────
export const OrderLookupSchema = z.object({
  orderNumber: z
    .string()
    .min(1)
    .max(30)
    .regex(/^[A-Z0-9\-]+$/, "Invalid order number format"),
  playerUid: z.string().min(1).max(100).optional(),
});

// ── Helper: validate and return data or throw a formatted error ───────────────
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const messages = result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`);
    throw new ValidationError(messages.join(", "));
  }
  return result.data;
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}