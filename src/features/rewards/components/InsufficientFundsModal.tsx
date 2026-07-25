import { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { Modal, ModalIcon, ModalTitle, ModalBody, ModalActions, ModalButton } from "@/components/Modal";
import { theme } from "@/constants/theme";
import { feedbackWarning } from "@/features/feedback/feedback";

export function InsufficientFundsModal({
  visible,
  name,
  cost,
  balance,
  onClose,
}: {
  visible: boolean;
  name: string;
  cost: number;
  balance: number;
  onClose: () => void;
}) {
  // Fires when the blocked-action modal appears — same pattern as ConnectionToast's warning haptic.
  useEffect(() => {
    if (visible) feedbackWarning();
  }, [visible]);

  const toGo = Math.max(0, cost - balance);
  const pct = Math.max(0, Math.min(100, (balance / cost) * 100));
  return (
    <Modal visible={visible} onRequestClose={onClose}>
      <ModalIcon emoji="😅" />
      <ModalTitle color={theme.color.danger}>{toGo} coins to go</ModalTitle>
      <ModalBody>
        "{name}" costs {cost} 🪙. Complete a couple more habits today to unlock it.
      </ModalBody>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>
      <ModalActions>
        <ModalButton label="Keep earning" variant="violet" full onPress={onClose} />
      </ModalActions>
    </Modal>
  );
}

const styles = StyleSheet.create({
  track: {
    width: "100%",
    height: 14,
    backgroundColor: "#fff",
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    borderRadius: 999,
    overflow: "hidden",
    marginVertical: 4,
  },
  fill: { height: "100%", backgroundColor: theme.color.yellow, borderRightWidth: theme.border, borderRightColor: theme.color.ink },
});
