import { IconCheck, IconHome } from "../ui/Icons";
import styles from "./QuietClose.module.css";

export function QuietClose(props: { onClose: () => void }) {
  return (
    <div class={styles.view}>
      <div class={styles.icon}>
        <IconCheck size={40} />
      </div>
      <h1 class={styles.title}>Your garden is watered for today.</h1>
      <p class={styles.sub}>Rest well. The seeds you tend will grow.</p>
      <button class={styles.button} onClick={props.onClose}>
        <IconHome size={16} /> Return to Threshold
      </button>
    </div>
  );
}
