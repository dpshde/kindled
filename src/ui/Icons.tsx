// Phosphor Icons - wrapped to maintain size prop API
// https://phosphoricons.com/

import type { JSX } from "solid-js";

// @ts-ignore
import IconArrowLeftRaw from "phosphor-icons-solid/IconArrowLeftRegular";
// @ts-ignore
import IconXRaw from "phosphor-icons-solid/IconXRegular";
// @ts-ignore
import IconCheckRaw from "phosphor-icons-solid/IconCheckRegular";
// @ts-ignore
import IconPlantRaw from "phosphor-icons-solid/IconPlantRegular";
// @ts-ignore
import IconTreeRaw from "phosphor-icons-solid/IconTreeRegular";
// @ts-ignore
import IconLeafRaw from "phosphor-icons-solid/IconLeafRegular";
// @ts-ignore
import IconFireRaw from "phosphor-icons-solid/IconFireRegular";
// @ts-ignore
import IconSparkleRaw from "phosphor-icons-solid/IconSparkleRegular";
// @ts-ignore
import IconDropRaw from "phosphor-icons-solid/IconDropRegular";
// @ts-ignore
import IconArrowUpRaw from "phosphor-icons-solid/IconArrowUpRegular";
// @ts-ignore
import IconCheckCircleRaw from "phosphor-icons-solid/IconCheckCircleRegular";
// @ts-ignore
import IconPencilSimpleRaw from "phosphor-icons-solid/IconPencilSimpleRegular";
// @ts-ignore
import IconPlusRaw from "phosphor-icons-solid/IconPlusRegular";
// @ts-ignore
import IconBookOpenRaw from "phosphor-icons-solid/IconBookOpenRegular";
// @ts-ignore
import IconMagnifyingGlassRaw from "phosphor-icons-solid/IconMagnifyingGlassRegular";
// @ts-ignore
import IconHouseRaw from "phosphor-icons-solid/IconHouseRegular";
// @ts-ignore
import IconWarningRaw from "phosphor-icons-solid/IconWarningRegular";
// @ts-ignore
import IconUserRaw from "phosphor-icons-solid/IconUserRegular";
// @ts-ignore
import IconMapPinRaw from "phosphor-icons-solid/IconMapPinRegular";
// @ts-ignore
import IconTrashRaw from "phosphor-icons-solid/IconTrashRegular";
// @ts-ignore
import IconClockRaw from "phosphor-icons-solid/IconClockRegular";
// @ts-ignore
import IconLinkRaw from "phosphor-icons-solid/IconLinkRegular";

interface IconProps {
  size?: number;
  class?: string;
  color?: string;
}

function wrapIcon(
  IconComponent: (p: { class?: string }) => JSX.Element
): (props: IconProps) => JSX.Element {
  return (props: IconProps) => {
    const size = props.size ?? 20;
    const className = props.class ?? "";
    return <span style={{ display: "inline-flex", width: `${size}px`, height: `${size}px`, color: props.color }}><IconComponent class={className} /></span>;
  };
}

// Export wrapped icons with size prop support
export const IconArrowLeft = wrapIcon(IconArrowLeftRaw);
export const IconX = wrapIcon(IconXRaw);
export const IconCheck = wrapIcon(IconCheckRaw);
export const IconSeedling = wrapIcon(IconPlantRaw);
export const IconPlant = wrapIcon(IconPlantRaw);
export const IconTree = wrapIcon(IconTreeRaw);
export const IconLeaf = wrapIcon(IconLeafRaw);
export const IconFire = wrapIcon(IconFireRaw);
export const IconSparkle = wrapIcon(IconSparkleRaw);
export const IconDrop = wrapIcon(IconDropRaw);
export const IconArrowUp = wrapIcon(IconArrowUpRaw);
export const IconCheckCircle = wrapIcon(IconCheckCircleRaw);
export const IconNotePencil = wrapIcon(IconPencilSimpleRaw);
export const IconPlus = wrapIcon(IconPlusRaw);
export const IconBookOpen = wrapIcon(IconBookOpenRaw);
export const IconMagnifyingGlass = wrapIcon(IconMagnifyingGlassRaw);
export const IconHome = wrapIcon(IconHouseRaw);
export const IconWarning = wrapIcon(IconWarningRaw);
export const IconUser = wrapIcon(IconUserRaw);
export const IconMapPin = wrapIcon(IconMapPinRaw);
export const IconTrash = wrapIcon(IconTrashRaw);
export const IconClock = wrapIcon(IconClockRaw);
export const IconLink = wrapIcon(IconLinkRaw);
