import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useCallback } from 'react';
import { useEngramStore } from '../stores/engramStore';
import SearchBar from '../components/SearchBar';
import EngramCard from '../components/EngramCard';
import EmptyState from '../components/EmptyState';
import type { CloudType, EngramItem } from '../types/engram';
import { VALID_CLOUD_TYPES } from '../types/engram';

export default function Cloud() {
  const { cloudType } = useParams<{ cloudType: string }>();
  const navigate = useNavigate();
  const setActiveCloudType = useEngramStore((s) => s.setActiveCloudType);
  const getFilteredItems = useEngramStore((s) => s.getFilteredItems);
  const searchQuery = useEngramStore((s) => s.searchQuery);
  const isLoading = useEngramStore((s) => s.isLoading);
  const hasMore = useEngramStore((s) => s.hasMore);

  // Sync URL param → store
  useEffect(() => {
    if (cloudType && VALID_CLOUD_TYPES.includes(cloudType as CloudType)) {
      setActiveCloudType(cloudType as CloudType);
    }
  }, [cloudType, setActiveCloudType]);

  const items = getFilteredItems();
  const validCloudType = cloudType && VALID_CLOUD_TYPES.includes(cloudType as CloudType)
    ? (cloudType as CloudType)
    : null;

  const handleCardClick = useCallback(
    (item: EngramItem) => {
      navigate(`/experience/${item.id}`);
    },
    [navigate],
  );

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      if (!hasMore || isLoading) return;
      const el = e.currentTarget;
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
        // loadMore will be wired in Phase 2.3 when we connect to real DB
      }
    },
    [hasMore, isLoading],
  );

  return (
    <div className="flex flex-col h-full" onScroll={handleScroll}>
      {/* Header */}
      <div className="p-4 pb-0 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary">
          {validCloudType
            ? validCloudType.charAt(0).toUpperCase() + validCloudType.slice(1) + ' Cloud'
            : 'All Clouds'}
        </h2>
        <span className="text-text-secondary text-xs">
          {items.length} engram{items.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Search */}
      <div className="px-4 py-3">
        <SearchBar />
      </div>

      {/* Grid */}
      {items.length === 0 ? (
        <EmptyState
          cloudType={validCloudType}
          isSearch={searchQuery.length > 0}
        />
      ) : (
        <div className="flex-1 overflow-auto px-4 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {items.map((item) => (
              <EngramCard key={item.id} item={item} onClick={handleCardClick} />
            ))}
          </div>
          {isLoading && (
            <div className="flex justify-center py-4">
              <span className="text-text-secondary text-sm">Loading…</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
