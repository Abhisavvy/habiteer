import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { beforeAll, afterAll, beforeEach, describe, it, expect } from "vitest";
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
  setFreezeBalance,
  getFreezeBalance,
  seedXp,
  makeOtherUser,
  makeGroup,
  cleanupGroup,
  makeSharedReward,
  cleanupSharedReward,
} from "./testClient";

beforeAll(async () => {
  await signInTestUser();
});

// freeze_tokens is global per-user mutable state, not scoped to any one
// trackable — reset it before every test so a leftover balance from an
// earlier test (or an earlier failed run) can never silently leak in.
// Tests that actually exercise freeze tokens set their own balance explicitly.
beforeEach(async () => {
  await setFreezeBalance(0);
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
    const t = await makeTrackable({ kind: "habit", difficulty: "medium", coinValue: 20, createdAt: todayUTC(-10) });
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
    const t = await makeTrackable({
      kind: "habit",
      difficulty: "easy",
      weekdays: [todayDow],
      createdAt: todayUTC(-10),
    });
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

describe("freeze tokens", () => {
  it("grants a token when a completion crosses a level boundary", async () => {
    // Level 5 starts at exactly 1369 total XP (sum of reqFor(1..4)). Fund the
    // user to 1359 via a throwaway trackable, then a 10-XP easy habit tips
    // the total to 1369 — crossing level 4 -> 5 exactly, granting 1 token.
    const funding = await makeTrackable({ kind: "habit", difficulty: "easy" });
    const t = await makeTrackable({ kind: "habit", difficulty: "easy" });
    await setFreezeBalance(0);
    try {
      await seedHistoricalCompletion(funding.id, todayUTC(-100), 1359, 0, 0);
      const { data, error } = await testClient.rpc("fn_complete_trackable", { p_id: t.id });
      expect(error).toBeNull();
      expect(data.level.level).toBe(5);
      expect(data.freeze_tokens).toBe(1);
      expect(await getFreezeBalance()).toBe(1);
    } finally {
      await cleanupTrackable(t.id);
      await cleanupTrackable(funding.id);
    }
  });

  it("bridges a missed scheduled day when a token is available", async () => {
    const todayDow = new Date(todayUTC() + "T00:00:00Z").getUTCDay();
    const t = await makeTrackable({
      kind: "habit",
      difficulty: "easy",
      weekdays: [todayDow],
      createdAt: todayUTC(-20),
    });
    await setFreezeBalance(1);
    try {
      // Two occurrences back (14 days, since this habit only occurs on todayDow):
      // completed. One occurrence back (7 days): missed — the gap to bridge.
      await seedHistoricalCompletion(t.id, todayUTC(-14), 10, 10, 1);
      const { data, error } = await testClient.rpc("fn_complete_trackable", { p_id: t.id });
      expect(error).toBeNull();
      expect(data.streak_after).toBe(3); // -14 counted, -7 bridged, today counted
      expect(data.freeze_tokens).toBe(0); // the one token was spent
    } finally {
      await cleanupTrackable(t.id);
    }
  });

  it("still breaks the streak on a gap when no tokens are available", async () => {
    const todayDow = new Date(todayUTC() + "T00:00:00Z").getUTCDay();
    const t = await makeTrackable({
      kind: "habit",
      difficulty: "easy",
      weekdays: [todayDow],
      createdAt: todayUTC(-20),
    });
    await setFreezeBalance(0);
    try {
      await seedHistoricalCompletion(t.id, todayUTC(-14), 10, 10, 1);
      const { data, error } = await testClient.rpc("fn_complete_trackable", { p_id: t.id });
      expect(error).toBeNull();
      expect(data.streak_after).toBe(1); // no token to bridge the -7 gap
      expect(data.freeze_tokens).toBe(0);
    } finally {
      await cleanupTrackable(t.id);
    }
  });

  it("undo revokes a token granted by the completion it reverses", async () => {
    const funding = await makeTrackable({ kind: "habit", difficulty: "easy" });
    const t = await makeTrackable({ kind: "habit", difficulty: "easy" });
    await setFreezeBalance(0);
    try {
      await seedHistoricalCompletion(funding.id, todayUTC(-100), 1359, 0, 0);
      const complete = await testClient.rpc("fn_complete_trackable", { p_id: t.id });
      expect(complete.data.freeze_tokens).toBe(1);

      const undo = await testClient.rpc("fn_undo_completion", { p_id: t.id });
      expect(undo.error).toBeNull();
      expect(undo.data.freeze_tokens).toBe(0);
      expect(await getFreezeBalance()).toBe(0);
    } finally {
      await cleanupTrackable(t.id);
      await cleanupTrackable(funding.id);
    }
  });

  it("undo refunds a token spent by the completion it reverses", async () => {
    const todayDow = new Date(todayUTC() + "T00:00:00Z").getUTCDay();
    const t = await makeTrackable({
      kind: "habit",
      difficulty: "easy",
      weekdays: [todayDow],
      createdAt: todayUTC(-20),
    });
    await setFreezeBalance(1);
    try {
      await seedHistoricalCompletion(t.id, todayUTC(-14), 10, 10, 1);
      const complete = await testClient.rpc("fn_complete_trackable", { p_id: t.id });
      expect(complete.data.freeze_tokens).toBe(0);

      const undo = await testClient.rpc("fn_undo_completion", { p_id: t.id });
      expect(undo.error).toBeNull();
      expect(undo.data.freeze_tokens).toBe(1);
      expect(await getFreezeBalance()).toBe(1);
    } finally {
      await cleanupTrackable(t.id);
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

describe("fn_join_group", () => {
  let fundingId: string;
  beforeAll(async () => {
    const { trackableId } = await seedXp(400); // comfortably level 3+, required to create a group
    fundingId = trackableId;
  });
  afterAll(async () => {
    await cleanupTrackable(fundingId);
  });

  it("adds membership with a valid code", async () => {
    const group = await makeGroup("join-valid");
    const other = await makeOtherUser();
    try {
      const { data, error } = await other.client.rpc("fn_join_group", { p_code: group.invite_code });
      expect(error).toBeNull();
      expect(data.id).toBe(group.id);
      const { data: membership } = await testClient
        .from("group_members")
        .select("*")
        .eq("group_id", group.id)
        .eq("user_id", other.userId);
      expect(membership?.length).toBe(1);
    } finally {
      await cleanupGroup(group.id);
    }
  });

  it("rejects an invalid code", async () => {
    const { error } = await testClient.rpc("fn_join_group", { p_code: "NOPE99" });
    expect(error).not.toBeNull();
  });

  it("is idempotent when joining twice", async () => {
    const group = await makeGroup("join-twice");
    const other = await makeOtherUser();
    try {
      const first = await other.client.rpc("fn_join_group", { p_code: group.invite_code });
      expect(first.error).toBeNull();
      const second = await other.client.rpc("fn_join_group", { p_code: group.invite_code });
      expect(second.error).toBeNull();
      const { data: memberships } = await testClient
        .from("group_members")
        .select("*")
        .eq("group_id", group.id)
        .eq("user_id", other.userId);
      expect(memberships?.length).toBe(1); // no duplicate row
    } finally {
      await cleanupGroup(group.id);
    }
  });
});

describe("fn_contribute_to_reward", () => {
  let fundingId: string;
  beforeAll(async () => {
    const { trackableId } = await seedXp(400);
    fundingId = trackableId;
  });
  afterAll(async () => {
    await cleanupTrackable(fundingId);
  });

  it("rejects a contribution from a non-member", async () => {
    const group = await makeGroup("contrib-nonmember");
    const reward = await makeSharedReward(group.id, 100);
    const other = await makeOtherUser();
    try {
      const { error } = await other.client.rpc("fn_contribute_to_reward", { p_reward_id: reward.id, p_amount: 10 });
      expect(error).not.toBeNull();
    } finally {
      await cleanupSharedReward(reward.id);
      await cleanupGroup(group.id);
    }
  });

  it("deducts the contributor's balance and unlocks at target", async () => {
    const group = await makeGroup("contrib-unlock");
    const reward = await makeSharedReward(group.id, 20);
    const funding = await makeTrackable({ kind: "task", difficulty: "hard" }); // +26 coins
    try {
      await testClient.rpc("fn_complete_trackable", { p_id: funding.id });
      const before = await ledgerBalance();

      const { data, error } = await testClient.rpc("fn_contribute_to_reward", {
        p_reward_id: reward.id,
        p_amount: 20,
      });
      expect(error).toBeNull();
      expect(data.unlocked).toBe(true);
      expect(data.totalContributed).toBe(20);
      const after = await ledgerBalance();
      expect(after).toBe(before - 20);

      const { data: row } = await testClient.from("rewards").select("completed_at").eq("id", reward.id).single();
      expect(row?.completed_at).not.toBeNull();
    } finally {
      await cleanupSharedReward(reward.id);
      await cleanupTrackable(funding.id);
      await cleanupGroup(group.id);
    }
  });

  it("leaves it un-unlocked when below target", async () => {
    const group = await makeGroup("contrib-partial");
    const reward = await makeSharedReward(group.id, 1000);
    const funding = await makeTrackable({ kind: "task", difficulty: "hard" });
    try {
      await testClient.rpc("fn_complete_trackable", { p_id: funding.id });
      const { data, error } = await testClient.rpc("fn_contribute_to_reward", {
        p_reward_id: reward.id,
        p_amount: 10,
      });
      expect(error).toBeNull();
      expect(data.unlocked).toBe(false);
      const { data: row } = await testClient.from("rewards").select("completed_at").eq("id", reward.id).single();
      expect(row?.completed_at).toBeNull();
    } finally {
      await cleanupSharedReward(reward.id);
      await cleanupTrackable(funding.id);
      await cleanupGroup(group.id);
    }
  });

  it("rejects contributing more than the caller's balance, with no partial row", async () => {
    const group = await makeGroup("contrib-insufficient");
    const reward = await makeSharedReward(group.id, 999999);
    try {
      const { error } = await testClient.rpc("fn_contribute_to_reward", {
        p_reward_id: reward.id,
        p_amount: 999999,
      });
      expect(error).not.toBeNull();
      const { data: contributions } = await testClient
        .from("reward_contributions")
        .select("id")
        .eq("reward_id", reward.id);
      expect(contributions?.length).toBe(0);
    } finally {
      await cleanupSharedReward(reward.id);
      await cleanupGroup(group.id);
    }
  });
});
