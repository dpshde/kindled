// Inline SVG icons — no dependency issues, consistent sizing
// Based on Phosphor Icons (https://phosphoricons.com/)

import type { JSX } from "solid-js";

interface IconProps {
  size?: number;
  class?: string;
  color?: string;
}

function svgProps(props: IconProps): JSX.SvgSVGAttributes<SVGSVGElement> {
  const s = props.size ?? 20;
  return {
    width: s,
    height: s,
    fill: "currentColor",
    "aria-hidden": "true",
    style: { display: "block", color: props.color },
  };
}

// Navigation
export function IconArrowLeft(props: IconProps) {
  return (
    <svg {...svgProps(props)} viewBox="0 0 256 256">
      <path d="M224 128a8 8 0 01-8 8H59.31l58.35 58.34a8 8 0 11-11.32 11.32l-72-72a8 8 0 010-11.32l72-72a8 8 0 0111.32 11.32L59.31 120H216a8 8 0 018 8z" />
    </svg>
  );
}

export function IconX(props: IconProps) {
  return (
    <svg {...svgProps(props)} viewBox="0 0 256 256">
      <path d="M205.66 194.34a8 8 0 01-11.32 11.32L128 139.31l-66.34 66.35a8 8 0 01-11.32-11.32L116.69 128 50.34 61.66a8 8 0 0111.32-11.32L128 116.69l66.34-66.35a8 8 0 0111.32 11.32L139.31 128z" />
    </svg>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <svg {...svgProps(props)} viewBox="0 0 256 256">
      <path d="M173.66 98.34a8 8 0 010 11.32l-56 56a8 8 0 01-11.32 0l-24-24a8 8 0 0111.32-11.32L112 148.69l50.34-50.35a8 8 0 0111.32 0z" />
    </svg>
  );
}

// Garden/Plant icons
export function IconSeedling(props: IconProps) {
  return (
    <svg {...svgProps(props)} viewBox="0 0 256 256">
      <path d="M216 120v32a16 16 0 01-16 16h-16v16a16 16 0 01-16 16H88a16 16 0 01-16-16v-16H56a16 16 0 01-16-16v-32a16 16 0 0116-16h16V96a48 48 0 0148-48 16 16 0 0116 16v24a16 16 0 01-16 16 16 16 0 00-16 16v8h48a16 16 0 0116 16z" />
    </svg>
  );
}

export function IconPlant(props: IconProps) {
  return (
    <svg {...svgProps(props)} viewBox="0 0 256 256">
      <path d="M208 32h-32a16 16 0 00-16 16v16a16 16 0 01-16 16h-32a16 16 0 00-16 16v24H80a16 16 0 00-16 16v24a16 16 0 01-16 16H16a8 8 0 000 16h32a32 32 0 0032-32v-24h40a32 32 0 0032-32v-24h32a32 32 0 0032-32V40a8 8 0 00-8-8zm-8 32a16 16 0 0116 16v16h-32V64a16 16 0 0116-16z" />
    </svg>
  );
}

export function IconTree(props: IconProps) {
  return (
    <svg {...svgProps(props)} viewBox="0 0 256 256">
      <path d="M128 16a72.08 72.08 0 00-72 72 71.68 71.68 0 0024 53.94V192a16 16 0 0016 16h64a16 16 0 0016-16v-50.06A71.68 71.68 0 00200 88a72.08 72.08 0 00-72-72zm32 168H96v-28h64zm13.6-48.09A8 8 0 01176 144v16H80v-16a8 8 0 01-2.4-8.09 56 56 0 1148.4 0A8 8 0 01128 144a8 8 0 011.6-8.09 56 56 0 1148.4 0z" />
    </svg>
  );
}

export function IconLeaf(props: IconProps) {
  return (
    <svg {...svgProps(props)} viewBox="0 0 256 256">
      <path d="M223.45 40.07a8 8 0 00-7.52-7.52C139.8 28.08 78.82 51 52.82 94a46 46 0 00-12.14 36c.26 1.46.57 2.88.91 4.28l-26.58 26.57a8 8 0 0011.32 11.32l26.57-26.58c1.4.34 2.82.65 4.28.91A46 46 0 0092 145.33c34.51-23.81 59.17-66.55 70.64-125a8 8 0 10-15.74-2.71c-10.83 55.29-34 95.57-66 118.47A29.87 29.87 0 0175 132.06c7.8-61.82 64.2-91.36 137.61-88.63a8 8 0 007.52-7.52c2.73-73.41-26.81-129.81-88.63-137.61a30 30 0 01-13.48 38.21c-27 17.33-44.84 42.47-54 76.88a8 8 0 0015.45 4.08c8.1-30.4 23.62-52.43 47-67.56a14 14 0 006.28-17.87 111.75 111.75 0 00-8-14.72c46.56 11.76 75.73 49.84 88.37 107.87z" />
    </svg>
  );
}

export function IconFire(props: IconProps) {
  return (
    <svg {...svgProps(props)} viewBox="0 0 256 256">
      <path d="M208 144a80 80 0 01-160 0c0-32.64 20.36-60.36 48.72-73.6a48 48 0 1180.56 0C205.64 83.64 208 113 208 144zm-80-48a32 32 0 00-32 32 8 8 0 01-16 0 48 48 0 0148-48 8 8 0 010 16z" />
    </svg>
  );
}

export function IconSparkle(props: IconProps) {
  return (
    <svg {...svgProps(props)} viewBox="0 0 256 256">
      <path d="M197.65 60.49l14.21-28.43a8 8 0 00-14.32-7.16l-14.2 28.44a48 48 0 01-21.44 21.44l-28.44 14.21a8 8 0 007.16 14.32l28.43-14.21a48 48 0 0121.44-21.44zM115.63 106.34l-48 24a8 8 0 01-7.16-14.32l48-24a8 8 0 117.16 14.32zM256 128a8 8 0 01-8 8h-16v16a8 8 0 01-16 0v-16h-16a8 8 0 010-16h16v-16a8 8 0 0116 0v16h16a8 8 0 018 8zM80 56a8 8 0 01-8-8V32H56a8 8 0 010-16h16V0a8 8 0 0116 0v16h16a8 8 0 010 16H96v16a8 8 0 01-8 8z" />
    </svg>
  );
}

// Actions
export function IconDrop(props: IconProps) {
  return (
    <svg {...svgProps(props)} viewBox="0 0 256 256">
      <path d="M128 216a32 32 0 0032-32c0-17.64-21.5-46.55-32-60.89-10.5 14.34-32 43.25-32 60.89a32 32 0 0032 32zm0-104c14.39 18.41 48 56.64 48 72a48 48 0 01-96 0c0-15.36 33.61-53.59 48-72z" />
    </svg>
  );
}

export function IconArrowUp(props: IconProps) {
  return (
    <svg {...svgProps(props)} viewBox="0 0 256 256">
      <path d="M205.66 117.66a8 8 0 01-11.32 0L136 59.31V216a8 8 0 01-16 0V59.31l-58.34 58.35a8 8 0 01-11.32-11.32l72-72a8 8 0 0111.32 0l72 72a8 8 0 010 11.32z" />
    </svg>
  );
}

export function IconCheckCircle(props: IconProps) {
  return (
    <svg {...svgProps(props)} viewBox="0 0 256 256">
      <path d="M173.66 98.34a8 8 0 010 11.32l-56 56a8 8 0 01-11.32 0l-24-24a8 8 0 0111.32-11.32L112 148.69l50.34-50.35a8 8 0 0111.32 0zM232 128A104 104 0 11128 24a104 104 0 01104 104zm-16 0a88 88 0 10-88 88 88 88 0 0088-88z" />
    </svg>
  );
}

export function IconNotePencil(props: IconProps) {
  return (
    <svg {...svgProps(props)} viewBox="0 0 256 256">
      <path d="M227.31 73.37L182.63 28.69a16 16 0 00-22.63 0L36.69 152a15.86 15.86 0 00-3.48 5.37L16.76 215a8 8 0 009.94 9.94l57.64-16.45a15.86 15.86 0 005.37-3.48L227.31 96a16 16 0 000-22.63zM124.69 195l-41.6 11.88 11.88-41.6L168 95.31 160.69 88 63.2 185.48l-11.88 41.6 41.6-11.88L191.31 104 184 96.69zM200 76.69L179.31 56 192 43.31 212.69 64z" />
    </svg>
  );
}

export function IconPlus(props: IconProps) {
  return (
    <svg {...svgProps(props)} viewBox="0 0 256 256">
      <path d="M224 128a8 8 0 01-8 8h-80v80a8 8 0 01-16 0v-80H40a8 8 0 010-16h80V40a8 8 0 0116 0v80h80a8 8 0 018 8z" />
    </svg>
  );
}

// Content
export function IconBookOpen(props: IconProps) {
  return (
    <svg {...svgProps(props)} viewBox="0 0 256 256">
      <path d="M232 56v144a8 8 0 01-8 8H32a8 8 0 01-8-8V56a8 8 0 018-8h192a8 8 0 018 8zM32 168h192V64H32v104zm32-80v64a8 8 0 01-16 0V88a8 8 0 0116 0zm128 0v64a8 8 0 01-16 0V88a8 8 0 0116 0z" />
    </svg>
  );
}

export function IconMagnifyingGlass(props: IconProps) {
  return (
    <svg {...svgProps(props)} viewBox="0 0 256 256">
      <path d="M229.66 218.34l-50.07-50.06a88.11 88.11 0 10-11.31 11.31l50.06 50.07a8 8 0 0011.32-11.32zM40 112a72 72 0 1172 72 72.08 72.08 0 01-72-72z" />
    </svg>
  );
}

export function IconHome(props: IconProps) {
  return (
    <svg {...svgProps(props)} viewBox="0 0 256 256">
      <path d="M218.83 103.77l-80-75.48a1.14 1.14 0 00-1.6 0l-80 75.48A16 16 0 0052 115.55V208a16 16 0 0016 16h40a16 16 0 0016-16v-48a8 8 0 0116 0v48a16 16 0 0016 16h40a16 16 0 0016-16v-92.45a16 16 0 00-5.17-11.78zM208 208h-40v-48a16 16 0 00-16-16h-16a16 16 0 00-16 16v48H68V115.55l.11-.1L128 59.32l59.89 56.13.11.1z" />
    </svg>
  );
}

export function IconWarning(props: IconProps) {
  return (
    <svg {...svgProps(props)} viewBox="0 0 256 256">
      <path d="M236.8 188.09L149.35 36.22a24.76 24.76 0 00-42.7 0L19.2 188.09a23.51 23.51 0 0021.2 34.91h175.2a23.51 23.51 0 0021.2-34.91zM120 144a8 8 0 0116 0v24a8 8 0 01-16 0zm8 56a12 12 0 1112-12 12 12 0 01-12 12z" />
    </svg>
  );
}

// Entities
export function IconUser(props: IconProps) {
  return (
    <svg {...svgProps(props)} viewBox="0 0 256 256">
      <path d="M230.92 212c-15.23-26.33-38.7-45.21-66.09-54.16a72 72 0 10-73.66 0C63.78 166.78 40.31 185.67 25.08 212a8 8 0 1013.85 8c18.84-32.56 52.14-52 89.07-52s70.23 19.44 89.07 52a8 8 0 1013.85-8zM72 96a56 56 0 11112 0 56 56 0 01-112 0z" />
    </svg>
  );
}

export function IconMapPin(props: IconProps) {
  return (
    <svg {...svgProps(props)} viewBox="0 0 256 256">
      <path d="M128 64a40 40 0 10 40 40 40 40 0 00-40-40zm0 64a24 24 0 1124-24 24 24 0 01-24 24zm0 112a104.36 104.36 0 01-58.57-18.16 8 8 0 118.94-13.24 88 88 0 1099.26 0 8 8 0 118.94 13.24A104.36 104.36 0 01128 240z" />
    </svg>
  );
}
