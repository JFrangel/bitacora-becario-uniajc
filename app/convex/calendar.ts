import { v } from 'convex/values';
import { query } from './_generated/server';
import { memberView } from './lib/audience';
import { monthData } from './lib/calendar';

/** `month` va de 0 (enero) a 11 (diciembre). Las horas por día solo las ve la dueña. */
export const month = query({
  args: { year: v.number(), month: v.number(), workspaceId: v.optional(v.id('workspaces')) },
  handler: async (ctx, { year, month, workspaceId }) => monthData(ctx, await memberView(ctx, workspaceId), year, month),
});
