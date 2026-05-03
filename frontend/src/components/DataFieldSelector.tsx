import { motion } from "framer-motion";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { getFieldIcon } from "@/config/fieldIcons";
import type { DirectoryFieldDefinition } from "@/types/person";

interface DataFieldSelectorProps {
  fields: DirectoryFieldDefinition[];
  selectedFields: string[];
  onFieldToggle: (field: string) => void;
}

export function DataFieldSelector({ fields, selectedFields, onFieldToggle }: DataFieldSelectorProps) {
  return (
    <div className="space-y-1.5">
      {fields.map((field, index) => {
        const Icon = getFieldIcon(field.key, field.icon);
        const isChecked = selectedFields.includes(field.key);

        return (
          <motion.div
            key={field.key}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.02 }}
          >
            <Label
              htmlFor={`field-${field.key}`}
              className={`
                flex items-center gap-2.5 p-2 cursor-pointer transition-all duration-200 font-mono text-xs
                ${isChecked
                  ? "bg-primary/20 border border-primary text-primary"
                  : "bg-card/50 border border-border hover:border-primary/50 text-foreground"
                }
              `}
            >
              <Checkbox
                id={`field-${field.key}`}
                checked={isChecked}
                onCheckedChange={() => onFieldToggle(field.key)}
                className="data-[state=checked]:bg-primary data-[state=checked]:border-primary h-4 w-4"
              />
              <Icon className={`w-3.5 h-3.5 ${isChecked ? "text-primary" : "text-muted-foreground"}`} />
              <span className="flex-1 tracking-wide">
                {field.label}
              </span>
            </Label>
          </motion.div>
        );
      })}
    </div>
  );
}
