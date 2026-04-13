import { IconCheck, IconHome } from "../ui/Icons";
import { ICON_PX } from "../ui/icon-sizes";
import styles from "./QuietClose.module.css";

export function QuietClose(props: { onClose: () => void }) {
  return (
    <div class={styles.view}>
      <div class={styles.icon}>
        <IconCheck size={ICON_PX.celebration} />
      </div>
      <h1 class={styles.title}>Your garden is watered for today.</h1>
      <p class={styles.sub}>Rest well. The seeds you tend will grow.</p>
      <button class={styles.button} onClick={props.onClose}>
        <IconHome size={ICON_PX.inline} /> Back home
      </button>
    </div>
  );
}
