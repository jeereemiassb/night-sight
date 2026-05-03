import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, CreditCard, Loader2, User } from "lucide-react";
import { dictionary } from "@/config/dictionary";
import { getFieldIcon } from "@/config/fieldIcons";
import type { DirectoryFieldDefinition, PersonRecord } from "@/types/person";

interface PersonDetailsProps {
  person: PersonRecord;
  selectedFields: string[];
  fieldDefinitions: DirectoryFieldDefinition[];
  isLoading?: boolean;
}

export function PersonDetails({ person, selectedFields, fieldDefinitions, isLoading = false }: PersonDetailsProps) {
  const visibleFields = fieldDefinitions.filter((field) => selectedFields.includes(field.key));

  return (
    <div className="h-full">
      <div className="relative overflow-hidden bg-card border-2 border-primary p-3 sm:p-5 shadow-[0_0_20px_rgba(34,197,94,0.2)]">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent" />

        <div className="relative flex items-center gap-3 sm:gap-4">
          <motion.div
            className="relative flex-shrink-0"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", bounce: 0.3 }}
          >
            <div className="w-16 h-16 sm:w-20 sm:h-20 overflow-hidden border-2 border-primary shadow-[0_0_15px_rgba(34,197,94,0.4)] bg-muted/40 flex items-center justify-center">
              {person.photo ? (
                <img src={person.photo} alt={person.displayName} className="w-full h-full object-cover" />
              ) : isLoading ? (
                <div className="w-full h-full bg-primary/10 animate-pulse" />
              ) : (
                <User className="w-8 h-8 text-muted-foreground" />
              )}
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 bg-primary flex items-center justify-center">
              <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4 text-primary-foreground" />
            </div>
          </motion.div>

          <div className="flex-1 min-w-0">
            <motion.div
              className="text-[9px] sm:text-xs text-primary font-mono mb-0.5 sm:mb-1 flex items-center gap-1.5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>{dictionary.person.loadingProfile}</span>
                </>
              ) : (
                <span>{dictionary.person.selected}</span>
              )}
            </motion.div>
            <motion.h2
              className="text-sm sm:text-lg font-bold text-foreground font-mono uppercase truncate"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {person.displayName}
            </motion.h2>
            {person.similarity !== undefined && (
              <motion.div
                className="mt-1 sm:mt-1.5 inline-flex items-center gap-1.5 sm:gap-2 bg-primary/20 border border-primary/50 px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-xs"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
              >
                <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-primary rounded-full animate-pulse" />
                <span className="font-mono text-primary">{dictionary.person.confidence.toUpperCase()}: {Math.round(person.similarity)}%</span>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-card border-2 border-t-0 border-border p-3 sm:p-4">
        <AnimatePresence mode="popLayout">
          {visibleFields.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-6 sm:py-8"
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 border-2 border-dashed border-border flex items-center justify-center">
                <CreditCard className="w-5 h-5 sm:w-6 sm:h-6 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground text-[10px] sm:text-xs font-mono">{dictionary.person.noFields}</p>
            </motion.div>
          ) : (
            <motion.div key="fields" className="space-y-2" layout>
              {visibleFields.map((field, index) => {
                const Icon = getFieldIcon(field.key, field.icon);
                const value = person.fields[field.key] ?? dictionary.person.unknownValue;

                return (
                  <motion.div
                    key={field.key}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ delay: index * 0.03 }}
                    layout
                    className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-muted/30 border border-border hover:border-primary/50 transition-colors"
                  >
                    <div className="w-8 h-8 sm:w-9 sm:h-9 border border-primary/50 bg-primary/5 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] sm:text-[10px] font-semibold text-primary uppercase tracking-wider font-mono">
                        {field.label}
                      </p>
                      {isLoading ? (
                        <div className="mt-1 h-4 w-2/3 bg-primary/15 rounded animate-pulse" />
                      ) : (
                        <p className="text-xs sm:text-sm text-foreground mt-0.5 break-words font-mono">{value}</p>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
