import type { JSX } from "solid-js";
import {
  IconBookOpen,
  IconMapPin,
  IconNotePencil,
  IconSparkle,
  IconUser,
  type IconProps,
} from "../ui/icons/icons";

const TYPE_ICON: Record<string, (p?: IconProps) => JSX.Element> = {
  scripture: IconBookOpen,
  person: IconUser,
  place: IconMapPin,
  theme: IconSparkle,
  note: IconNotePencil,
};

export function hearthTypeIcon(type: string): (p?: IconProps) => JSX.Element {
  return TYPE_ICON[type] ?? IconBookOpen;
}
