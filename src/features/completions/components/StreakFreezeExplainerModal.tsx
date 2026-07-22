import { Text, StyleSheet } from "react-native";
import { Modal, ModalIcon, ModalTitle, ModalBody, ModalActions, ModalButton } from "@/components/Modal";
import { HardShadow } from "@/components/HardShadow";
import { theme } from "@/constants/theme";
import { fonts } from "@/constants/fonts";
import { FREEZE_TOKEN_LEVEL_INTERVAL } from "@/features/gamification/constants";

export function StreakFreezeExplainerModal({
  visible,
  balance,
  onClose,
}: {
  visible: boolean;
  balance: number;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} onRequestClose={onClose}>
      <ModalIcon emoji="❄️" />
      <ModalTitle>Streak freeze</ModalTitle>
      <ModalBody>
        Miss a day and a freeze token auto-spends to keep your streak alive. You earn one every{" "}
        {FREEZE_TOKEN_LEVEL_INTERVAL} levels.
      </ModalBody>
      <HardShadow style={styles.chip}>
        <Text style={styles.chipText}>You have ❄️ {balance}</Text>
      </HardShadow>
      <ModalActions>
        <ModalButton label="Got it" variant="violet" full onPress={onClose} />
      </ModalActions>
    </Modal>
  );
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: "#fff",
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    borderRadius: 10,
    padding: 9,
    marginVertical: 4,
    shadowColor: theme.color.ink,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  chipText: { fontWeight: "700", fontSize: 15, color: theme.color.ink, fontFamily: fonts.mono700 },
});
