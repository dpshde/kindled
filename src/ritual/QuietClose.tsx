import { IconCheck, IconHome } from "../ui/Icons";
import { ICON_PX } from "../ui/icon-sizes";
import { hapticTrigger } from "../haptics";
import styles from "./QuietClose.module.css";

export function QuietClose(props: { onClose: () => void }) {
  return (
    <div class={styles.view}>
      <div class={styles.icon}>
        <IconCheck size={ICON_PX.celebration} />
      </div>
      <h1 class={styles.title}>You've fed the flame for today.</h1>
      <p class={styles.sub}>Rest well. What you return to burns brighter.</p>
      <button
        class={styles.button}
        onClick={() => {
          hapticTrigger();
          props.onClose();
        }}
      >
        <IconHome size={ICON_PX.inline} /> Back home
      </button>
    </div>
  );
}
