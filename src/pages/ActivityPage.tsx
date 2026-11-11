import { useEffect, useState } from 'react';
import { api, errorMessage } from '../lib/api';
import type { Activity } from '../lib/types';
import ActivityList from '../components/ActivityList';
import { Button, Card, ErrorBanner, PageLoader } from '../components/ui';

export default function ActivityPage() {
  const [items, setItems] = useState<Activity[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const fetchPage = async (beforeId?: number) => {
    const d = await api<{ activity: Activity[]; has_more: boolean }>(`/activity?limit=50${beforeId ? `&before_id=${beforeId}` : ''}`);
    setHasMore(d.has_more);
    return d.activity;
  };

  useEffect(() => {
    fetchPage().then(setItems).catch((err) => setError(errorMessage(err)));
  }, []);

  const loadMore = async () => {
    if (!items?.length) return;
    setLoadingMore(true);
    try {
      const more = await fetchPage(items[items.length - 1].id);
      setItems([...items, ...more]);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Activity</h1>
        <p className="mt-0.5 text-sm text-slate-500">Every change made in the Flow Manager — who did it and when.</p>
      </div>
      {error && <ErrorBanner message={error} />}
      <Card>
        {items ? <ActivityList items={items} /> : !error && <PageLoader />}
        {hasMore && (
          <div className="border-t border-slate-100 p-3 text-center">
            <Button variant="secondary" size="sm" onClick={loadMore} loading={loadingMore}>Load older</Button>
          </div>
        )}
      </Card>
    </div>
  );
}
