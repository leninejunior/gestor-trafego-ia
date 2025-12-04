'use client';

import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface FilterOption {
  id: string;
  name: string;
  hasData?: boolean;
}

interface ClickableFiltersProps {
  options: FilterOption[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  multiSelect?: boolean;
  emptyMessage?: string;
  className?: string;
}

export function ClickableFilters({
  options,
  selectedIds,
  onSelectionChange,
  multiSelect = true,
  emptyMessage = "Nenhuma opção disponível com dados neste período",
  className
}: ClickableFiltersProps) {
  // Filtrar apenas opções com dados
  const optionsWithData = options.filter(opt => opt.hasData !== false);

  const handleClick = (id: string) => {
    if (multiSelect) {
      if (selectedIds.includes(id)) {
        // Remover da seleção
        onSelectionChange(selectedIds.filter(selectedId => selectedId !== id));
      } else {
        // Adicionar à seleção
        onSelectionChange([...selectedIds, id]);
      }
    } else {
      // Single select
      if (selectedIds.includes(id)) {
        onSelectionChange([]);
      } else {
        onSelectionChange([id]);
      }
    }
  };

  const handleRemove = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectionChange(selectedIds.filter(selectedId => selectedId !== id));
  };

  if (optionsWithData.length === 0) {
    return (
      <div className={cn("text-center py-8 text-muted-foreground", className)}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {optionsWithData.map((option) => {
        const isSelected = selectedIds.includes(option.id);
        
        return (
          <Badge
            key={option.id}
            variant={isSelected ? "default" : "outline"}
            className={cn(
              "cursor-pointer transition-all hover:scale-105",
              "px-3 py-2 text-sm font-medium",
              isSelected 
                ? "bg-blue-600 hover:bg-blue-700 text-white" 
                : "hover:bg-accent text-foreground border-border"
            )}
            onClick={() => handleClick(option.id)}
          >
            <span>{option.name}</span>
            {isSelected && multiSelect && (
              <X 
                className="ml-2 h-3 w-3 hover:text-red-200" 
                onClick={(e) => handleRemove(option.id, e)}
              />
            )}
          </Badge>
        );
      })}
    </div>
  );
}
