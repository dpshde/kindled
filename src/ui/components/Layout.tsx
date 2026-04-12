import type { JSX } from "solid-js";
import styles from "./Layout.module.css";

export function Container(props: { children: JSX.Element }) {
  return <div class={styles.container}>{props.children}</div>;
}
