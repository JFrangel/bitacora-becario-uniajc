import { ConvexError } from 'convex/values';

export type ErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'VALIDATION'
  | 'LIMIT'
  | 'NOT_FOUND'
  | 'TASK_NOT_FOUND'
  | 'INVITE_USED'
  | 'INVITE_EXPIRED'
  | 'INVITE_REVOKED'
  | 'INVITE_INVALID'
  | 'ALREADY_MEMBER';

/** Error de aplicación con un código estable que el cliente puede interpretar. */
export const fail = (code: ErrorCode, message?: string) => new ConvexError({ code, message: message ?? code });

export const taskNotFound = () => fail('TASK_NOT_FOUND', 'La tarea ya no existe.');
