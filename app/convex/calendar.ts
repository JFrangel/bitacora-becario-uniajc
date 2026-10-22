import { v } from 'convex/values';
import { query } from './_generated/server';
import { memberView } from './lib/audience';
import { monthData } from './lib/calendar';

/** `month` va de 0 (enero) a 11 (diciembre). Las horas por día solo las ve la dueña. */
export const month = query({
  args: { year: v.number(), month: v.number() },
  handler: async (ctx, { year, month }) => monthData(ctx, await memberView(ctx), year, month),
});
