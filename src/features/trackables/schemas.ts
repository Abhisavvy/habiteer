import { z } from "zod";
import { createInsertSchema, createUpdateSchema } from "drizzle-zod";
import { trackables } from "@/lib/db/schema";

const FORM_FIELDS = ["kind", "name", "emoji", "difficulty", "coinValue", "goalType", "weekdays", "period", "quota", "dueOn", "reminderTime"] as const;

const refinements = {
  kind: z.enum(["habit", "task"]),
  name: (schema: z.ZodString) => schema.trim().min(1).max(28),
  difficulty: z.enum(["easy", "medium", "hard"]),
  coinValue: (schema: z.ZodNumber) => schema.int().positive(),
  goalType: z.enum(["build", "reduce"]),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1).nullable(),
  period: z.enum(["day", "week", "month"]).nullable(),
  quota: (schema: z.ZodNumber) => schema.int().positive(),
  dueOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(), // tasks: ISO date or null (always due)
  reminderTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(), // "HH:MM" 24h or null (no reminder)
};

/** Validates the add-trackable form (`userId` is derived in api.ts, not user input). */
export const insertTrackableSchema = createInsertSchema(trackables, refinements).pick(
  Object.fromEntries(FORM_FIELDS.map((f) => [f, true])) as Record<(typeof FORM_FIELDS)[number], true>
);

/** Same fields, all optional — for editing an existing trackable. */
export const updateTrackableSchema = createUpdateSchema(trackables, refinements).pick(
  Object.fromEntries(FORM_FIELDS.map((f) => [f, true])) as Record<(typeof FORM_FIELDS)[number], true>
);

export type TrackableFormValues = z.infer<typeof insertTrackableSchema>;
export type TrackableUpdateValues = z.infer<typeof updateTrackableSchema>;
