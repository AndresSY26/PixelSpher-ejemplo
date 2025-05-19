
"use client";

import type { MediaItem, GroupedMedia, UserPreferences } from '@/types';
import MediaItemCard from './MediaItemCard';
import { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

interface MediaGridProps {
  items: MediaItem[];
  isSelectMode: boolean;
  selectedItems: Set<string>;
  onItemSelect: (itemId: string) => void;
  onOpenViewer: (item: MediaItem) => void; 
  passPropsToCards?: { 
    getInitialIsFavorite?: (itemId: string) => boolean;
    onFavoriteToggle?: (itemId: string, isFavorite: boolean) => void;
  };
  gallerySortOrder?: UserPreferences['defaultGallerySort']; // To decide on grouping
}

export default function MediaGrid({ 
  items, 
  isSelectMode, 
  selectedItems, 
  onItemSelect, 
  onOpenViewer,
  passPropsToCards,
  gallerySortOrder = 'chronological_desc' // Default to chronological if not provided
}: MediaGridProps) {
  const groupedItems: GroupedMedia[] = useMemo(() => {
    if (!items || items.length === 0) return [];
    
    // If sorting is by name, don't group by date, just return one group.
    if (gallerySortOrder === 'name_asc' || gallerySortOrder === 'name_desc') {
      return [{ date: "Todos los Elementos (Ordenados por Nombre)", items: items }];
    }

    const groups: { [key: string]: MediaItem[] } = {};
    // Items are expected to be pre-sorted by the parent component (GalleryPage)
    // So, no need to sort them again here if gallerySortOrder is chronological
    items.forEach(item => {
      const date = parseISO(item.uploadTimestamp);
      const formattedDate = format(date, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es });
      if (!groups[formattedDate]) {
        groups[formattedDate] = [];
      }
      groups[formattedDate].push(item);
    });
    
    return Object.entries(groups).map(([date, dateItems]) => ({ date, items: dateItems }));

  }, [items, gallerySortOrder]);

  if (items.length === 0) {
    return <p className="text-center text-muted-foreground py-10">No se encontraron archivos. ¡Sube algo!</p>;
  }

  return (
    <div className="space-y-8">
      {groupedItems.map(group => (
        <div key={group.date}>
          <h2 className="text-xl font-semibold mb-4 capitalize">{group.date}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {group.items.map(item => (
              <MediaItemCard 
                key={item.id} 
                item={item} 
                isSelectMode={isSelectMode}
                isSelected={selectedItems.has(item.id)}
                onSelect={onItemSelect}
                onOpenViewer={onOpenViewer}
                initialIsFavorite={passPropsToCards?.getInitialIsFavorite?.(item.id)}
                onFavoriteToggle={passPropsToCards?.onFavoriteToggle}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

