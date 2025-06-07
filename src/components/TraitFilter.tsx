import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface Trait {
  trait_type: string;
  value: string;
}

interface TraitCategory {
  name: string;
  traits: {
    value: string;
    count: number;
  }[];
}

interface TraitFilterProps {
  traits: Trait[];
  selectedTraits: Record<string, string[]>;
  onTraitChange: (traitType: string, value: string, checked: boolean) => void;
}

export function TraitFilter({ traits, selectedTraits, onTraitChange }: TraitFilterProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [traitCategories, setTraitCategories] = useState<TraitCategory[]>([]);

  // Process traits into categories on mount and when traits change
  useEffect(() => {
    const categoryMap = new Map<string, Map<string, number>>();

    // Count occurrences of each trait value
    traits.forEach(trait => {
      if (!categoryMap.has(trait.trait_type)) {
        categoryMap.set(trait.trait_type, new Map());
      }
      const valueMap = categoryMap.get(trait.trait_type)!;
      valueMap.set(trait.value, (valueMap.get(trait.value) || 0) + 1);
    });

    // Convert to array format
    const categories: TraitCategory[] = Array.from(categoryMap.entries()).map(([name, valueMap]) => ({
      name,
      traits: Array.from(valueMap.entries()).map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count) // Sort by count descending
    }));

    setTraitCategories(categories);
  }, [traits]);

  const toggleCategory = (categoryName: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryName)) {
        next.delete(categoryName);
      } else {
        next.add(categoryName);
      }
      return next;
    });
  };

  return (
    <div className="w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 space-y-2">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Traits</h3>
      <div className="space-y-2">
        {traitCategories.map(category => (
          <div key={category.name} className="border-b border-gray-200 dark:border-gray-700 last:border-0 pb-2">
            <button
              onClick={() => toggleCategory(category.name)}
              className="w-full flex items-center justify-between py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg px-2"
            >
              <span className="font-medium text-gray-900 dark:text-white">{category.name}</span>
              {expandedCategories.has(category.name) ? (
                <ChevronDown className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-500" />
              )}
            </button>
            
            {expandedCategories.has(category.name) && (
              <div className="mt-2 space-y-1 pl-2">
                {category.traits.map(trait => (
                  <label
                    key={trait.value}
                    className="flex items-center space-x-2 py-1 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedTraits[category.name]?.includes(trait.value) || false}
                      onChange={(e) => onTraitChange(category.name, trait.value, e.target.checked)}
                      className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{trait.value}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">({trait.count})</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
} 