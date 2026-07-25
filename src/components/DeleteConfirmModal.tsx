import { useEffect } from "react";
import { Modal, ModalIcon, ModalTitle, ModalBody, ModalActions, ModalButton } from "@/components/Modal";
import { feedbackWarning } from "@/features/feedback/feedback";

export function DeleteConfirmModal({
  visible,
  name,
  streakDays,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  name: string;
  streakDays: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  // Fires when the destructive-confirm modal appears — same pattern as ConnectionToast's warning haptic.
  useEffect(() => {
    if (visible) feedbackWarning();
  }, [visible]);

  return (
    <Modal visible={visible} onRequestClose={onCancel}>
      <ModalIcon emoji="🗑" badge={{ shape: "rounded", bg: "#FFDBD1" }} />
      <ModalTitle>Delete "{name}"?</ModalTitle>
      <ModalBody>
        {streakDays > 0
          ? `Your ${streakDays}-day streak and its history will be lost. This can't be undone.`
          : "This can't be undone."}
      </ModalBody>
      <ModalActions>
        <ModalButton label="Cancel" variant="cancel" onPress={onCancel} />
        <ModalButton label="Delete" variant="fire" onPress={onConfirm} />
      </ModalActions>
    </Modal>
  );
}
