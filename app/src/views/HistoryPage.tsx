import { useEffect, useState } from 'react';
import { useSession } from '../audience';
import { useBoardData } from '../data/useBoardData';
import { useEvents } from '../data/useEvents';
import { History } from '../features/history/History';

export function HistoryPage() {
  const { memberId } = useSession();
  const [actorId, setActorId] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const { people } = useBoardData();
  const { events, hasMore, loading, loadMore } = useEvents({ actorId });

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  return <History events={events} people={people} actorId={actorId} onActor={setActorId} hasMore={hasMore} loadingMore={loading} onLoadMore={loadMore} meId={memberId ?? null} now={now} />;
}
