import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, it, expect } from "vitest";
import { comboMultiplier } from "@/features/gamification/combo";
import { taskCoins } from "@/features/gamification/coins";
import {
  testClient,
  signInTestUser,
  makeTrackable,
  cleanupTrackable,
  cleanupLedgerByRefId,
  makeReward,
  cleanupReward,
  ledgerBalance,
  todayUTC,
  seedHistoricalCompletion,
} from "./testClient";

beforeAll(async () => {
  await signInTestUser();
});

describe("fn_complete_trackable — habit", () => {
  it("pays base xp/coins with streak 1 on a fresh habit", async () => {
    const t = await makeTrackable({ kind: "habit", difficulty: "easy", coinValue: 10 });
    try {
      const { data, error } = await testClient.rpc("fn_complete_trackable", { p_id: t.id });
      expect(error).toBeNull();
      expect(data.xp).toBe(10); // easy base, no combo
      expect(data.coins).toBe(10); // flat coin_value
      expect(data.streak_after).toBe(1);
      expect(data.level.level).toBeGreaterThanOrEqual(1);
    } finally {
      await cleanupTrackable(t.id);
    }
  });

  it("is idempotent — completing twice the same day doesn't double-pay", async () => {
    const t = await makeTrackable({ kind: "habit", difficulty: "medium", coinValue: 20 });
    try {
      const first = await testClient.rpc("fn_complete_trackable", { p_id: t.id });
      expect(first.error).toBeNull();

      const { data: completions } = await testClient
        .from("completions")
        .select("id")
        .eq("trackable_id", t.id);
      expect(completions?.length).toBe(1);
      const completionId = completions![0].id;

      const { data: ledgerBefore } = await testClient
        .from("coin_ledger")
        .select("id")
        .eq("ref_id", completionId);
      expect(ledgerBefore?.length).toBe(1);

      const second = await testClient.rpc("fn_complete_trackable", { p_id: t.id });
      expect(second.error).toBeNull();
      expect(second.data.xp).toBe(first.data.xp);
      expect(second.data.coins).toBe(first.data.coins);
      expect(second.data.streak_after).toBe(first.data.streak_after);

      const { data: completionsAfter } = await testClient
        .from("completions")
        .select("id")
        .eq("trackable_id", t.id);
      expect(completionsAfter?.length).toBe(1); // no duplicate row

      const { data: ledgerAfter } = await testClient
        .from("coin_ledger")
        .select("id")
        .eq("ref_id", completionId);
      expect(ledgerAfter?.length).toBe(1); // no duplicate ledger entry
    } finally {
      await cleanupTrackable(t.id);
    }
  });

  it("applies the combo multiplier once a streak qualifies", async () => {
    const t = await makeTrackable({ kind: "habit", difficulty: "medium", coinValue: 20 });
    try {
      for (let i = 6; i >= 1; i--) {
        await seedHistoricalCompletion(t.id, todayUTC(-i), 20, 20, 7 - i);
      }
      const { data, error } = await testClient.rpc("fn_complete_trackable", { p_id: t.id });
      expect(error).toBeNull();
      expect(data.streak_after).toBe(7);
      expect(data.xp).toBe(Math.round(20 * comboMultiplier(7))); // 30
    } finally {
      await cleanupTrackable(t.id);
    }
  });

  it("skips unscheduled weekdays without breaking the streak", async () => {
    const todayDow = new Date(todayUTC() + "T00:00:00Z").getUTCDay();
    const t = await makeTrackable({ kind: "habit", difficulty: "easy", weekdays: [todayDow] });
    try {
      // Prior occurrence of the same weekday is 7 days back; every day in between is unscheduled.
      await seedHistoricalCompletion(t.id, todayUTC(-7), 10, 10, 1);
      const { data, error } = await testClient.rpc("fn_complete_trackable", { p_id: t.id });
      expect(error).toBeNull();
      expect(data.streak_after).toBe(2);
    } finally {
      await cleanupTrackable(t.id);
    }
  });

  it("rejects completing an archived trackable", async () => {
    const t = await makeTrackable({ kind: "habit" });
    try {
      await testClient.from("trackables").update({ archived_at: new Date().toISOString() }).eq("id", t.id);
      const { error } = await testClient.rpc("fn_complete_trackable", { p_id: t.id });
      expect(error).not.toBeNull();
    } finally {
      await cleanupTrackable(t.id);
    }
  });
});

describe("fn_complete_trackable — task", () => {
  it("pays the fixed task discount, no xp, and archives itself", async () => {
    const t = await makeTrackable({ kind: "task", difficulty: "hard" });
    try {
      const { data, error } = await testClient.rpc("fn_complete_trackable", { p_id: t.id });
      expect(error).toBeNull();
      expect(data.xp).toBe(0);
      expect(data.coins).toBe(taskCoins("hard")); // 26
      const { data: row } = await testClient.from("trackables").select("archived_at").eq("id", t.id).single();
      expect(row?.archived_at).not.toBeNull();
    } finally {
      await cleanupTrackable(t.id);
    }
  });

  it("replaying a same-day task completion doesn't error on the archived guard", async () => {
    const t = await makeTrackable({ kind: "task", difficulty: "easy" });
    try {
      const first = await testClient.rpc("fn_complete_trackable", { p_id: t.id });
      expect(first.error).toBeNull();
      const second = await testClient.rpc("fn_complete_trackable", { p_id: t.id });
      expect(second.error).toBeNull();
      expect(second.data.coins).toBe(first.data.coins);
    } finally {
      await cleanupTrackable(t.id);
    }
  });
});

describe("fn_undo_completion", () => {
  it("reverses a habit completion and restores the balance", async () => {
    const t = await makeTrackable({ kind: "habit", difficulty: "easy", coinValue: 10 });
    try {
      const before = await ledgerBalance();
      await testClient.rpc("fn_complete_trackable", { p_id: t.id });
      const afterComplete = await ledgerBalance();
      expect(afterComplete).toBe(before + 10);

      // capture before undo deletes the completions row — its id is the ledger ref_id
      const { data: preUndo } = await testClient.from("completions").select("id").eq("trackable_id", t.id);
      const completionId = preUndo![0].id;

      const { error } = await testClient.rpc("fn_undo_completion", { p_id: t.id });
      expect(error).toBeNull();

      const { data: completions } = await testClient.from("completions").select("id").eq("trackable_id", t.id);
      expect(completions?.length).toBe(0);

      const afterUndo = await ledgerBalance();
      expect(afterUndo).toBe(before);

      await cleanupLedgerByRefId(completionId);
    } finally {
      await cleanupTrackable(t.id);
    }
  });

  it("un-archives a task on undo", async () => {
    const t = await makeTrackable({ kind: "task" });
    try {
      await testClient.rpc("fn_complete_trackable", { p_id: t.id });
      const { data: preUndo } = await testClient.from("completions").select("id").eq("trackable_id", t.id);
      const completionId = preUndo![0].id;

      await testClient.rpc("fn_undo_completion", { p_id: t.id });
      const { data: row } = await testClient.from("trackables").select("archived_at").eq("id", t.id).single();
      expect(row?.archived_at).toBeNull();

      await cleanupLedgerByRefId(completionId);
    } finally {
      await cleanupTrackable(t.id);
    }
  });

  it("errors when there's nothing to undo today", async () => {
    const t = await makeTrackable({ kind: "habit" });
    try {
      const { error } = await testClient.rpc("fn_undo_completion", { p_id: t.id });
      expect(error).not.toBeNull();
    } finally {
      await cleanupTrackable(t.id);
    }
  });
});

describe("fn_redeem_reward", () => {
  it("redeems with sufficient balance and deducts coins", async () => {
    const funding = await makeTrackable({ kind: "task", difficulty: "hard" }); // +26 coins
    const reward = await makeReward(10);
    try {
      await testClient.rpc("fn_complete_trackable", { p_id: funding.id });
      const before = await ledgerBalance();

      const { data, error } = await testClient.rpc("fn_redeem_reward", { p_id: reward.id });
      expect(error).toBeNull();
      expect(data.balance).toBe(before - 10);

      const { data: row } = await testClient.from("rewards").select("completed_at").eq("id", reward.id).single();
      expect(row?.completed_at).not.toBeNull();
    } finally {
      await cleanupReward(reward.id);
      await cleanupTrackable(funding.id);
    }
  });

  it("rejects redeeming with insufficient balance", async () => {
    const reward = await makeReward(999999);
    try {
      const before = await ledgerBalance();
      const { error } = await testClient.rpc("fn_redeem_reward", { p_id: reward.id });
      expect(error).not.toBeNull();
      const after = await ledgerBalance();
      expect(after).toBe(before); // no partial deduction
    } finally {
      await cleanupReward(reward.id);
    }
  });

  it("rejects redeeming the same reward twice", async () => {
    const funding = await makeTrackable({ kind: "task", difficulty: "hard" });
    const reward = await makeReward(5);
    try {
      await testClient.rpc("fn_complete_trackable", { p_id: funding.id });
      const first = await testClient.rpc("fn_redeem_reward", { p_id: reward.id });
      expect(first.error).toBeNull();
      const second = await testClient.rpc("fn_redeem_reward", { p_id: reward.id });
      expect(second.error).not.toBeNull();
    } finally {
      await cleanupReward(reward.id);
      await cleanupTrackable(funding.id);
    }
  });
});

describe("ownership / RLS", () => {
  it("hides another user's trackable — treated as not found", async () => {
    const otherEmail = `habiteer.rpctest.other.${Date.now()}@gmail.com`;
    const otherClient = createClient(
      process.env.EXPO_PUBLIC_SUPABASE_URL!,
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { error: signUpErr } = await otherClient.auth.signUp({ email: otherEmail, password: "OtherUser!2026" });
    expect(signUpErr).toBeNull();
    const { data: userData } = await otherClient.auth.getUser();
    const { data: otherTrackable, error: insertErr } = await otherClient
      .from("trackables")
      .insert({
        user_id: userData.user!.id,
        kind: "habit",
        name: "[TEST] other user's habit",
        emoji: "🔒",
        difficulty: "easy",
        coin_value: 10,
        period: "day",
        quota: 1,
      })
      .select()
      .single();
    expect(insertErr).toBeNull();

    try {
      const { error } = await testClient.rpc("fn_complete_trackable", { p_id: otherTrackable!.id });
      expect(error).not.toBeNull();
    } finally {
      await otherClient.from("trackables").delete().eq("id", otherTrackable!.id);
    }
  });
});
