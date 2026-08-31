import { useEffect } from "react";
import { Modal, ModalIcon, ModalTitle, ModalBody, ModalActions, ModalButton } from "@/components/Modal";
import { feedbackWarning } from "@/features/feedback/feedback";

/**
 * Confirms giving up on a staked pledge.
 *
 * This existed nowhere before: "Give up" went straight to the RPC, so one
 * mis-tap permanently forfeited the unearned part of a real stake. The app
 * already confirmed *archiving a habit*, which costs nothing by comparison.
 *
 * The copy states both halves of the outcome with real numbers, because the
 * fairness rule is the whole point and is genuinely reassuring: what you earned
 * comes back, only the rest is lost. A generic "are you sure?" would hide the
 * one fact that makes the decision informed.
 */
export function AbandonPledgeModal({
  visible,
  name,
  keeping,
  forfeiting,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  name: string;
  /** Coins that come back — every checkpoint genuinely earned. */
  keeping: number;
  /** Coins lost — only the part never earned. */
  forfeiting: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  // Same warning haptic every destructive confirm in the app fires.
  useEffect(() => {
    if (visible) feedbackWarning();
  }, [visible]);

  return (
    <Modal visible={visible} onRequestClose={onCancel}>
      <ModalIcon emoji="🤝" badge={{ shape: "rounded", bg: "#FFDBD1" }} />
      <ModalTitle>Give up on "{name}"?</ModalTitle>
      <ModalBody>
        {forfeiting > 0
          ? keeping > 0
            ? `You'll get back the 🪙 ${keeping} you've earned. The remaining 🪙 ${forfeiting} is forfeited, and this can't be undone.`
            : `You'll forfeit 🪙 ${forfeiting} — you haven't reached a checkpoint yet. This can't be undone.`
          : `You've already earned your whole stake back, so nothing is forfeited. This closes the pledge for good.`}
      </ModalBody>
      <ModalActions>
        <ModalButton label="Keep going" variant="cancel" onPress={onCancel} />
        <ModalButton label="Give up" variant="fire" onPress={onConfirm} />
      </ModalActions>
    </Modal>
  );
}
