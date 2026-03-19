import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useCallback, useState } from 'react';
import { useEngramStore } from '../stores/engramStore';
import SearchBar from '../components/SearchBar';
import EngramCard from '../components/EngramCard';
import EmptyState from '../components/EmptyState';
import EngramModal from '../components/EngramModal';
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
  const activePersonId = useEngramStore((s) => s.activePersonId);
  const itemCreated = useEngramStore((s) => s.itemCreated);

  const [createModalOpen, setCreateModalOpen] = useState(false);

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

  const handleCreate = (data: {
    cloud_type: CloudType;
    title: string;
    content: string;
    date: string | null;
    life_phase_id: number | null;
  }) => {
    if (!activePersonId) return;

    // In full wiring: repo.create() first, then surgical update
    const newItem: EngramItem = {
      id: Date.now(), // temp ID — replaced by DB in real flow
      uuid: '',
      person_id: activePersonId,
      cloud_type: data.cloud_type,
      title: data.title,
      content: data.content,
      date: data.date,
      life_phase_id: data.life_phase_id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    } as EngramItem;
    itemCreated(newItem);
    setCreateModalOpen(false);
  };

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      if (!hasMore || isLoading) return;
      const el = e.currentTarget;
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
        // loadMore wired when connected to real DB
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
        <div className="flex items-center gap-3">
          <span className="text-text-secondary text-xs">
            {items.length} engram{items.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="px-3 py-1.5 bg-accent-gold text-background rounded-lg text-sm font-medium hover:bg-accent-gold/90 transition-colors"
          >
            + New
          </button>
        </div>
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
          onCreateClick={() => setCreateModalOpen(true)}
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

      {/* Create modal */}
      <EngramModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSave={handleCreate}
      />
    </div>
  );
}
