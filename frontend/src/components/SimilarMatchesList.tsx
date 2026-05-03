import { motion } from "framer-motion";
import { User, ChevronRight, CheckCircle2 } from "lucide-react";
import { dictionary } from "@/config/dictionary";
import type { PersonRecord } from "@/types/person";

interface SimilarMatchesListProps {
  matches: PersonRecord[];
  selectedId: string | null;
  onSelect: (person: PersonRecord) => void;
  personIdLabel: string;
}

export function SimilarMatchesList({ matches, selectedId, onSelect, personIdLabel }: SimilarMatchesListProps) {
  return (
    <div className="space-y-1.5">
      {matches.map((person, index) => {
        const isSelected = selectedId === person.id;
        
        return (
          <motion.button
            key={person.id}
            onClick={() => onSelect(person)}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.03 }}
            className={`
              w-full flex items-center gap-3 p-2.5 transition-all duration-200 font-mono text-sm
              ${isSelected 
                ? "bg-primary/20 text-primary border border-primary shadow-[0_0_10px_rgba(34,197,94,0.3)]" 
                : "bg-card/50 hover:bg-card border border-border hover:border-primary/50"
              }
            `}
          >
            <div className={`
              w-8 h-8 flex items-center justify-center border
              ${isSelected ? "border-primary bg-primary/10" : "border-border bg-muted/50"}
            `}>
              {isSelected ? (
                <CheckCircle2 className="w-4 h-4 text-primary" />
              ) : (
                <User className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
            
            <div className="flex-1 text-left min-w-0">
              <p className={`font-medium text-xs truncate ${isSelected ? "text-primary" : "text-foreground"}`}>
                {person.displayName}
              </p>
              {person.similarity !== undefined ? (
                <p className="text-[10px] text-muted-foreground font-mono">
                  {dictionary.person.confidence.toUpperCase()}: {Math.round(person.similarity)}%
                </p>
              ) : (
                <p className="text-[10px] text-muted-foreground font-mono">
                  {personIdLabel}: {person.personId ?? dictionary.person.unknownValue}
                </p>
              )}
            </div>
            
            <ChevronRight className={`w-4 h-4 flex-shrink-0 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
          </motion.button>
        );
      })}
    </div>
  );
}
