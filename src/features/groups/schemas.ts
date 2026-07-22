import { z } from "zod";
import { createInsertSchema } from "drizzle-zod";
import { groups } from "@/lib/db/schema";

/** Validates the create-group form (`inviteCode`/`createdBy` are derived in api.ts, not user input). */
export const insertGroupSchema = createInsertSchema(groups, {
  name: (schema: z.ZodString) => schema.trim().min(1).max(40),
}).pick({ name: true });

export type GroupFormValues = z.infer<typeof insertGroupSchema>;
