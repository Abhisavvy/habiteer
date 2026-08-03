import { supabase } from "@/lib/supabase/client";
import type { ISODate } from "@/features/gamification/dates";

/** A pledge. `goals` is SELECT-only since Phase P — every field below is
 * written exclusively by a security-definer RPC, so the client reads them and
 * never PATCHes them. A client-side write of `checkpointsBanked` would
 * otherwise be re-bank-forever. */
export type Goal = {
  id: string;
  trackableId: string;
  targetCount: number;
  startsOn: ISODate;
  endsOn: ISODate; // inclusive
  stakedCoins: number;
  state: "active" | "kept" | "forfeited";
  checkpointsBanked: number;
};

export type GoalFormValues = {
  trackableId: string;
  targetCount: number;
  startsOn: ISODate;
  endsOn: ISODate;
  stakedCoins: number;
};

/** What a pledge RPC hands back. Every one of them returns the post-call
 * balance so the caller can settle the coin HUD without a second round trip. */
export type PledgeResult = {
  payout?: number;
  bonus?: number;
  forfeited?: number;
  banked?: number;
  kept?: boolean;
  state?: string;
  alreadySettled?: boolean;
  balance: number;
};

function mapRow(row: Record<string, unknown>): Goal {
  return {
    id: row.id as string,
    trackableId: row.trackable_id as string,
    targetCount: row.target_count as number,
    startsOn: row.starts_on as string,
    endsOn: row.ends_on as string,
    stakedCoins: (row.staked_coins as number) ?? 0,
    state: (row.state as Goal["state"]) ?? "active",
    checkpointsBanked: (row.checkpoints_banked as number) ?? 0,
  };
}

/** The caller's own pledges, terminal ones included — a settled pledge is a
 * settlement record, never deleted, so history stays answerable. */
export async function fetchGoals(): Promise<Goal[]> {
  const { data, error } = await supabase.from("goals").select("*");
  if (error) throw error;
  return data.map(mapRow);
}

/** Stakes coins and opens a pledge. The server re-checks everything the form
 * checks (balance, minimum stake/target/window, own non-archived habit, no
 * overlapping active pledge) — the form's guards are courtesy, not enforcement. */
export async function createPledge(
  values: GoalFormValues
): Promise<{ id: string; staked: number; balance: number }> {
  const { data, error } = await supabase.rpc("fn_create_pledge", {
    p_trackable_id: values.trackableId,
    p_target_count: values.targetCount,
    p_starts_on: values.startsOn,
    p_ends_on: values.endsOn,
    p_staked_coins: values.stakedCoins,
  });
  if (error) throw error;
  return data;
}

/** Claims every checkpoint reached since the last claim. Progress is recounted
 * server-side, so a stale client count can't over-pay. */
export async function bankCheckpoint(id: string): Promise<PledgeResult> {
  const { data, error } = await supabase.rpc("fn_bank_goal_checkpoint", { p_id: id });
  if (error) throw error;
  return data;
}

/** Closes out a pledge whose window has passed: banks what was earned, then
 * forfeits only the remainder. Safe to call repeatedly — an already-settled
 * pledge returns `alreadySettled` with no second payout. */
export async function settleGoal(id: string): Promise<PledgeResult> {
  const { data, error } = await supabase.rpc("fn_settle_goal", { p_id: id });
  if (error) throw error;
  return data;
}

/** Gives up mid-window. Replaces the old `deleteGoal` — deleting a staked
 * pledge would be a full refund, i.e. a free undo of the commitment. */
export async function abandonPledge(id: string): Promise<PledgeResult> {
  const { data, error } = await supabase.rpc("fn_abandon_pledge", { p_id: id });
  if (error) throw error;
  return data;
}
