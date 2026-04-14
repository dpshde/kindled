import { html, type ArrowTemplate } from "@arrow-js/core";
import * as paths from "./paths";

export type IconProps = { size?: number; class?: string; color?: string };

function phosphorIcon(pathD: string, props: IconProps): ArrowTemplate {
  const size = props.size ?? 20;
  const color = props.color;
  const style = color
    ? `width:${size}px;height:${size}px;color:${color}`
    : `width:${size}px;height:${size}px`;
  return html`<span class="phosphor-icon-wrap" style="${style}">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="${size}"
      height="${size}"
      fill="currentColor"
      viewBox="0 0 256 256"
      class="${props.class ?? ""}"
      aria-hidden="true"
    >
      <path d="${pathD}"></path>
    </svg>
  </span>`;
}

export const IconArrowLeft = (p: IconProps = {}) => phosphorIcon(paths.ARROW_LEFT, p);
export const IconX = (p: IconProps = {}) => phosphorIcon(paths.X, p);
export const IconCheck = (p: IconProps = {}) => phosphorIcon(paths.CHECK, p);
export const IconFire = (p: IconProps = {}) => phosphorIcon(paths.FIRE, p);
export const IconSparkle = (p: IconProps = {}) => phosphorIcon(paths.SPARKLE, p);
export const IconDrop = (p: IconProps = {}) => phosphorIcon(paths.DROP, p);
export const IconArrowUp = (p: IconProps = {}) => phosphorIcon(paths.ARROW_UP, p);
export const IconCheckCircle = (p: IconProps = {}) => phosphorIcon(paths.CHECK_CIRCLE, p);
export const IconNotePencil = (p: IconProps = {}) => phosphorIcon(paths.PENCIL_SIMPLE, p);
export const IconPlus = (p: IconProps = {}) => phosphorIcon(paths.PLUS, p);
export const IconBookOpen = (p: IconProps = {}) => phosphorIcon(paths.BOOK_OPEN, p);
export const IconMagnifyingGlass = (p: IconProps = {}) =>
  phosphorIcon(paths.MAGNIFYING_GLASS, p);
export const IconHome = (p: IconProps = {}) => phosphorIcon(paths.HOUSE, p);
export const IconWarning = (p: IconProps = {}) => phosphorIcon(paths.WARNING, p);
export const IconUser = (p: IconProps = {}) => phosphorIcon(paths.USER, p);
export const IconMapPin = (p: IconProps = {}) => phosphorIcon(paths.MAP_PIN, p);
export const IconTrash = (p: IconProps = {}) => phosphorIcon(paths.TRASH, p);
export const IconClock = (p: IconProps = {}) => phosphorIcon(paths.CLOCK, p);
export const IconLink = (p: IconProps = {}) => phosphorIcon(paths.LINK, p);
export const IconCaretDown = (p: IconProps = {}) => phosphorIcon(paths.CARET_DOWN, p);
export const IconInfo = (p: IconProps = {}) => phosphorIcon(paths.INFO, p);

/** Same glyph as primary “Begin” flame (`paths.FIRE`). */
export const BeginFireIcon = (p: IconProps = {}) => phosphorIcon(paths.FIRE, p);

export function IconArrowsClockwise(props: IconProps = {}): ArrowTemplate {
  return phosphorIcon(paths.ARROWS_CLOCKWISE, props);
}
