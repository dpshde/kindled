import { html, type ArrowTemplate } from "@arrow-js/core";
import { IconCheck, IconHome } from "../ui/icons/icons";
import { ICON_PX } from "../ui/icon-sizes";
import { hapticTrigger } from "../haptics";
import styles from "./QuietClose.module.css";

export function quietCloseView(props: { onClose: () => void }): ArrowTemplate {
  return html`<div class="${styles.view}">
    <div class="${styles.icon}">${IconCheck({ size: ICON_PX.celebration })}</div>
    <h1 class="${styles.title}">You've fed the flame for today.</h1>
    <p class="${styles.sub}">Rest well. What you return to burns brighter.</p>
    <button
      type="button"
      class="${styles.button}"
      @click="${() => {
        hapticTrigger();
        props.onClose();
      }}"
    >
      ${IconHome({ size: ICON_PX.inline })} Back home
    </button>
  </div>`;
}
