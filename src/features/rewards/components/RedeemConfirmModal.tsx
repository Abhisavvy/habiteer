import { View, Text, StyleSheet } from "react-native";
import { Modal, ModalIcon, ModalTitle, ModalBody, ModalActions, ModalButton } from "@/components/Modal";
import { theme } from "@/constants/theme";
import { fonts } from "@/constants/fonts";

export function RedeemConfirmModal({
  visible,
  name,
  emoji,
  cost,
  balance,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  name: string;
  emoji: string;
  cost: number;
  balance: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal visible={visible} onRequestClose={onCancel}>
      <ModalIcon emoji={emoji} />
      <ModalTitle>Redeem {name}?</ModalTitle>
      <View style={styles.costRow}>
        <Text style={styles.costDelta}>−{cost} 🪙</Text>
        <Text style={styles.costLeft}>
          {balance} → {balance - cost} left
        </Text>
      </View>
      <ModalBody>You've earned it. Coins are spent the moment you confirm.</ModalBody>
      <ModalActions>
        <ModalButton label="Cancel" variant="cancel" onPress={onCancel} />
        <ModalButton label="Redeem" variant="jade" onPress={onConfirm} />
      </ModalActions>
    </Modal>
  );
}

const styles = StyleSheet.create({
  costRow: { flexDirection: "row", gap: 14, marginVertical: 4 },
  costDelta: { fontWeight: "700", fontSize: 13, color: theme.color.violet, fontFamily: fonts.mono700 },
  costLeft: { fontWeight: "700", fontSize: 13, color: "rgba(26,21,35,0.55)", fontFamily: fonts.mono700 },
});
