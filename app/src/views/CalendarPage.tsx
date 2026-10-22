import { useState } from 'react';
import { useSession } from '../audience';
import { useBoardData } from '../data/useBoardData';
import { useCalendarHours } from '../data/useCalendarHours';
import { Calendar } from '../features/calendar/Calendar';
import { shiftMonth } from '../features/calendar/month';
import { useTaskPanel } from '../features/tasks/TaskPanelHost';
import { useToday } from '../lib/useToday';
import { Placeholder } from './Placeholder';

export function CalendarPage() {
  const { audience, memberId } = useSession();
  const today = useToday();
  const [{ year, month }, setMonth] = useState(() => ({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) - 1 }));
  const data = useBoardData();
  const hoursByDay = useCalendarHours(year, month);
  const panel = useTaskPanel();

  if (data.loading) return <Placeholder tab="calendar" />;
  return (
    <Calendar
      year={year}
      month={month}
      tasks={data.tasks}
      hoursByDay={hoursByDay}
      today={today}
      me={memberId ?? null}
      canEdit={audience !== 'viewer'}
      onPrev={() => setMonth((m) => shiftMonth(m.year, m.month, -1))}
      onNext={() => setMonth((m) => shiftMonth(m.year, m.month, 1))}
      onOpenTask={panel.openTask}
      onNewTask={(date) => panel.newTask({ date })}
    />
  );
}
