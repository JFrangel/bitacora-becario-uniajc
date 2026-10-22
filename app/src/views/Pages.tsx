import type { Tab } from '../router';
import { BoardPage } from './BoardPage';
import { CalendarPage } from './CalendarPage';
import { HistoryPage } from './HistoryPage';
import { JournalPage } from './JournalPage';
import { Placeholder } from './Placeholder';

/** La sección activa. */
export function Page({ tab }: { tab: Tab }) {
  switch (tab) {
    case 'board':
      return <BoardPage />;
    case 'calendar':
      return <CalendarPage />;
    case 'journal':
      return <JournalPage />;
    case 'history':
      return <HistoryPage />;
    default:
      return <Placeholder tab={tab} />;
  }
}
