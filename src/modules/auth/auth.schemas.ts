import { z } from "zod";
import {
  normalizeDisplayName,
  normalizeEmail
} from "../../utils/normalization.js";

const emailSchema = z
  .string()
  .trim()
  .email("Enter a valid email address.")
  .max(320)
  .transform(normalizeEmail);

const displayNameSchema = z
  .string()
  .trim()
  .min(
    2,
    "Display name must contain at least 2 characters."
  )
  .max(
    40,
    "Display name cannot exceed 40 characters."
  )
  .transform(normalizeDisplayName);

const passwordSchema = z
  .string()
  .min(
    10,
    "Password must contain at least 10 characters."
  )
  .max(
    128,
    "Password cannot exceed 128 characters."
  );

const refreshTokenSchema = z
  .string()
  .trim()
  .min(
    32,
    "Refresh token is invalid."
  )
  .max(
    256,
    "Refresh token is invalid."
  );

export const registerSchema = z
  .object({
    email: emailSchema,
    displayName: displayNameSchema,
    password: passwordSchema
  })
  .strict();

export const loginSchema = z
  .object({
    email: emailSchema,
    password: z
      .string()
      .min(1, "Password is required.")
      .max(128)
  })
  .strict();

export const refreshSchema = z
  .object({
    refreshToken: refreshTokenSchema
  })
  .strict();

export const logoutSchema = z
  .object({
    refreshToken: refreshTokenSchema
  })
  .strict();

export type RegisterInput = z.infer<
  typeof registerSchema
>;

export type LoginInput = z.infer<
  typeof loginSchema
>;
