import { mutation } from './_generated/server';
import { requireOwner } from './lib/actors';

/** Dirección de un solo uso para subir una imagen de evidencia. Solo la dueña. */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireOwner(ctx);
    return ctx.storage.generateUploadUrl();
  },
});
