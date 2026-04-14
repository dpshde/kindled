import type { ArrowTemplate } from "@arrow-js/core";
import {
  IconBookOpen,
  IconMapPin,
  IconNotePencil,
  IconSparkle,
  IconUser,
  type IconProps,
} from "../ui/icons/icons";

const TYPE_ICON: Record<string, (p?: IconProps) => ArrowTemplate> = {
  scripture: IconBookOpen,
  person: IconUser,
  place: IconMapPin,
  theme: IconSparkle,
  note: IconNotePencil,
};

export function hearthTypeIcon(type: string): (p?: IconProps) => ArrowTemplate {
  return TYPE_ICON[type] ?? IconBookOpen;
}
