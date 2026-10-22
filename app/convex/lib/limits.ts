/** Límites de la especificación (sección «Restricciones globales» del plan). */
export const LIMITS = {
  title: 200,
  description: 2000,
  subtasks: 20,
  subtaskText: 200,
  projectName: 100,
  journalField: 1500,
  photos: 4,
  links: 12,
  pendingInvites: 10,
  inviteDays: 7,
  nameMin: 2,
  nameMax: 60,
  photoBytes: 409600,
  eventsPage: 50,
} as const;
