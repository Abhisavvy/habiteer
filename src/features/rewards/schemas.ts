import { z } from "zod";
import { createInsertSchema, createUpdateSchema } from "drizzle-zod";
import { rewards } from "@/lib/db/schema";

const FORM_FIELDS = ["name", "emoji", "cost"] as const;

const refinements = {
  name: (schema: z.ZodString) => schema.trim().min(1).max(28),
  cost: (schema: z.ZodNumber) => schema.int().positive(),
};

/** Validates the add-reward form (`kind`/`userId`/`groupId` are derived in api.ts, not user input). */
export const insertRewardSchema = createInsertSchema(rewards, refinements).pick(
  Object.fromEntries(FORM_FIELDS.map((f) => [f, true])) as Record<(typeof FORM_FIELDS)[number], true>
);

/** Same fields, all optional — for editing an existing reward. */
export const updateRewardSchema = createUpdateSchema(rewards, refinements).pick(
  Object.fromEntries(FORM_FIELDS.map((f) => [f, true])) as Record<(typeof FORM_FIELDS)[number], true>
);

export type RewardFormValues = z.infer<typeof insertRewardSchema>;
export type RewardUpdateValues = z.infer<typeof updateRewardSchema>;
