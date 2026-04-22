import type { JSX } from "solid-js";
import * as paths from "./paths";

export type IconProps = { size?: number; class?: string; color?: string };

function phosphorIcon(pathD: string, props: IconProps): JSX.Element {
  const size = () => props.size ?? 20;
  const style = () =>
    props.color
      ? `width:${size()}px;height:${size()}px;color:${props.color}`
      : `width:${size()}px;height:${size()}px`;
  return (
    <span class="phosphor-icon-wrap" style={style()}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size()}
        height={size()}
        fill="currentColor"
        viewBox="0 0 256 256"
        class={props.class ?? ""}
        aria-hidden="true"
      >
        <path d={pathD} />
      </svg>
    </span>
  );
}

function phosphorStrokeIcon(
  children: JSX.Element | JSX.Element[],
  props: IconProps,
): JSX.Element {
  const size = () => props.size ?? 20;
  const style = () =>
    props.color
      ? `width:${size()}px;height:${size()}px;color:${props.color}`
      : `width:${size()}px;height:${size()}px`;
  return (
    <span class="phosphor-icon-wrap" style={style()}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size()}
        height={size()}
        fill="none"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="16"
        viewBox="0 0 256 256"
        class={props.class ?? ""}
        aria-hidden="true"
      >
        {children}
      </svg>
    </span>
  );
}

export const IconArrowLeft = (p: IconProps = {}) => phosphorIcon(paths.ARROW_LEFT, p);
export const IconArrowSquareUpRight = (p: IconProps = {}) =>
  phosphorIcon(paths.ARROW_SQUARE_UP_RIGHT, p);
export const IconX = (p: IconProps = {}) => phosphorIcon(paths.X, p);
export const IconCheck = (p: IconProps = {}) => phosphorIcon(paths.CHECK, p);
export const IconFire = (p: IconProps = {}) => phosphorIcon(paths.FIRE, p);
export const IconSparkle = (p: IconProps = {}) => phosphorIcon(paths.SPARKLE, p);
export const IconDrop = (p: IconProps = {}) => phosphorIcon(paths.DROP, p);
export const IconArrowUp = (p: IconProps = {}) => phosphorIcon(paths.ARROW_UP, p);
export const IconCheckCircle = (p: IconProps = {}) => phosphorIcon(paths.CHECK_CIRCLE, p);
export const IconNotePencil = (p: IconProps = {}) => phosphorIcon(paths.PENCIL_SIMPLE, p);
export function IconPencilSimple(props: IconProps = {}): JSX.Element {
  return phosphorStrokeIcon(
    <>
      <path d="M92.69,216H48a8,8,0,0,1-8-8V163.31a8,8,0,0,1,2.34-5.65L165.66,34.34a8,8,0,0,1,11.31,0L221.66,79a8,8,0,0,1,0,11.31L98.34,213.66A8,8,0,0,1,92.69,216Z" />
      <line x1="136" y1="64" x2="192" y2="120" />
    </>,
    props,
  );
}
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

/** Same glyph as primary "Begin" flame (`paths.FIRE`). */
export const BeginFireIcon = (p: IconProps = {}) => phosphorIcon(paths.FIRE, p);

export function IconArrowsClockwise(props: IconProps = {}): JSX.Element {
  return phosphorIcon(paths.ARROWS_CLOCKWISE, props);
}

export const IconCloud = (p: IconProps = {}) => phosphorIcon(paths.CLOUD, p);
export function IconFloppyDisk(props: IconProps = {}): JSX.Element {
  return phosphorStrokeIcon(
    <>
      <path d="M216,83.31V208a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V48a8,8,0,0,1,8-8H172.69a8,8,0,0,1,5.65,2.34l35.32,35.32A8,8,0,0,1,216,83.31Z" />
      <path d="M80,216V152a8,8,0,0,1,8-8h80a8,8,0,0,1,8,8v64" />
      <line x1="152" y1="72" x2="96" y2="72" />
    </>,
    props,
  );
}
export const IconMinimize = (p: IconProps = {}) => phosphorIcon(paths.MINUS, p);
export const IconMaximize = (p: IconProps = {}) => phosphorIcon(paths.CORNERS_OUT, p);
export const IconClose = (p: IconProps = {}) => phosphorIcon(paths.X, p);

export const IconDownload = (p: IconProps = {}) => phosphorIcon(paths.DOWNLOAD, p);
export const IconFileText = (p: IconProps = {}) => phosphorIcon(paths.FILE_TEXT, p);
export const IconCopy = (p: IconProps = {}) => phosphorIcon(paths.COPY, p);
export const IconGear = (p: IconProps = {}) => phosphorIcon(paths.GEAR_SIX, p);

/** Phosphor regular sun (stroke icon) */
export function IconSun(props: IconProps = {}): JSX.Element {
  return phosphorStrokeIcon(
    <>
      <circle cx="128" cy="128" r="56" />
      <line x1="128" y1="40" x2="128" y2="16" />
      <line x1="128" y1="240" x2="128" y2="216" />
      <line x1="16" y1="128" x2="40" y2="128" />
      <line x1="216" y1="128" x2="240" y2="128" />
      <line x1="48" y1="48" x2="64" y2="64" />
      <line x1="192" y1="192" x2="208" y2="208" />
      <line x1="48" y1="208" x2="64" y2="192" />
      <line x1="192" y1="64" x2="208" y2="48" />
    </>,
    props,
  );
}

/** Phosphor regular moon (stroke icon) */
export function IconMoon(props: IconProps = {}): JSX.Element {
  return phosphorStrokeIcon(
    <path d="M108.11,28.11A96.09,96.09,0,0,0,227.89,147.89,96,96,0,1,1,108.11,28.11Z" />,
    props,
  );
}

/** File + cloud stroke icon (from file-cloud.svg). Multi-element, stroke-based. */
export function IconFileCloud(props: IconProps = {}): JSX.Element {
  const size = () => props.size ?? 20;
  const style = () =>
    props.color
      ? `width:${size()}px;height:${size()}px;color:${props.color}`
      : `width:${size()}px;height:${size()}px`;
  return (
    <span class="phosphor-icon-wrap" style={style()}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size()}
        height={size()}
        fill="none"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="16"
        viewBox="0 0 256 256"
        class={props.class ?? ""}
        aria-hidden="true"
      >
        <polyline points="152 32 152 88 208 88" />
        <path d="M176,224h24a8,8,0,0,0,8-8V88L152,32H56a8,8,0,0,0-8,8v88" />
        <path d="M65.66,168H60a28,28,0,0,0,0,56h48a44,44,0,1,0-43.82-48" />
      </svg>
    </span>
  );
}
