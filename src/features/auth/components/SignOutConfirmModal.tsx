import { Modal, ModalIcon, ModalTitle, ModalBody, ModalActions, ModalButton } from "@/components/Modal";

export function SignOutConfirmModal({
  visible,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal visible={visible} onRequestClose={onCancel}>
      <ModalIcon emoji="👋" badge={{ shape: "circle", bg: "#EDE7FF" }} />
      <ModalTitle>Sign out?</ModalTitle>
      <ModalBody>Your progress is saved to your account — you'll pick up right where you left off.</ModalBody>
      <ModalActions>
        <ModalButton label="Stay" variant="cancel" onPress={onCancel} />
        <ModalButton label="Sign out" variant="ink" onPress={onConfirm} />
      </ModalActions>
    </Modal>
  );
}
