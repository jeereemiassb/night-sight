import type { LucideIcon } from "lucide-react";
import {
  BadgeInfo,
  Briefcase,
  Building2,
  Calendar,
  CreditCard,
  Database,
  FileText,
  Hash,
  Mail,
  MapPin,
  Phone,
  Shield,
  User,
} from "lucide-react";

const explicitIconMap: Record<string, LucideIcon> = {
  badge: BadgeInfo,
  briefcase: Briefcase,
  building: Building2,
  calendar: Calendar,
  credit_card: CreditCard,
  database: Database,
  file: FileText,
  hash: Hash,
  mail: Mail,
  map_pin: MapPin,
  phone: Phone,
  shield: Shield,
  user: User,
};

function inferIconFromKey(key: string): LucideIcon {
  const normalized = key.toLowerCase();
  if (normalized.includes("mail")) return Mail;
  if (normalized.includes("phone")) return Phone;
  if (normalized.includes("date") || normalized.includes("expires")) return Calendar;
  if (normalized.includes("status")) return Shield;
  if (normalized.includes("role") || normalized.includes("department")) return Briefcase;
  if (normalized.includes("address") || normalized.includes("city")) return MapPin;
  if (normalized.includes("document") || normalized.includes("card")) return CreditCard;
  if (normalized.includes("name")) return User;
  if (normalized.includes("id")) return Database;
  return BadgeInfo;
}

export function getFieldIcon(key: string, iconName?: string | null): LucideIcon {
  if (iconName) {
    const normalized = iconName.trim().toLowerCase().replace(/[-\s]+/g, "_");
    if (explicitIconMap[normalized]) {
      return explicitIconMap[normalized];
    }
  }

  return inferIconFromKey(key);
}
