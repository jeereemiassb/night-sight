import { useState } from "react";
import { Loader2, Search, Terminal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { dictionary } from "@/config/dictionary";

interface SearchBarProps {
  onSearch: (name: string) => void;
  disabled?: boolean;
  isLoading?: boolean;
  minLength?: number;
}

export function SearchBar({ onSearch, disabled = false, isLoading = false, minLength = 1 }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (normalizedQuery.length >= minLength) {
      onSearch(normalizedQuery);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="relative group">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-accent/20 rounded-lg blur-sm opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="relative flex items-center gap-1.5 sm:gap-2 bg-card border-2 border-border rounded-lg overflow-hidden">
          <div className="pl-2 sm:pl-4">
            <Terminal className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          </div>
          <span className="text-muted-foreground text-xs sm:text-sm">$</span>
          <Input
            type="text"
            placeholder={dictionary.search.placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={disabled}
            className="flex-1 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 font-mono text-xs sm:text-sm placeholder:text-muted-foreground/60"
          />
          <Button 
            type="submit" 
            disabled={disabled || normalizedQuery.length < minLength}
            className="m-0.5 sm:m-1 bg-primary hover:bg-primary/90 text-primary-foreground font-mono text-[10px] sm:text-xs uppercase tracking-wider h-7 sm:h-8 px-2 sm:px-3"
          >
            {isLoading ? (
              <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1 animate-spin" />
            ) : (
              <Search className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />
            )}
            <span className="hidden sm:inline">{isLoading ? dictionary.search.loading : dictionary.search.button}</span>
          </Button>
        </div>
      </div>
    </form>
  );
}
