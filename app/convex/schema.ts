import { authTables } from '@convex-dev/auth/server';
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import { activityStatus, docStatus, eventType, eventVisibility, journalLink, journalPhoto, subtask, taskStatus } from './lib/validators';

export default defineSchema({
  ...authTables,

  members: defineTable({
    name: v.string(),
    roleLabel: v.string(),
    isOwner: v.boolean(),
    userId: v.id('users'),
    email: v.string(),
    invitedBy: v.optional(v.id('members')),
    createdAt: v.number(),
    lastSeenAt: v.number(),
    revokedAt: v.optional(v.number()),
  })
    .index('by_userId', ['userId'])
    .index('by_email', ['email']),

  invites: defineTable({
    tokenHash: v.string(),
    createdBy: v.id('members'),
    createdAt: v.number(),
    expiresAt: v.number(),
    usedBy: v.optional(v.id('members')),
    usedAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
  })
    .index('by_hash', ['tokenHash'])
    .index('by_creator', ['createdBy']),

  settings: defineTable({
    shareToken: v.optional(v.string()),
    shareEnabled: v.boolean(),
    shareIncludesJournal: v.boolean(),
    shareShowsDescriptions: v.boolean(),
    timezone: v.string(),
  }),

  profile: defineTable({
    program: v.optional(v.string()),
    term: v.optional(v.string()),
    institution: v.optional(v.string()),
    group: v.optional(v.string()),
    badgeDesign: v.optional(v.string()),
    photoDataUrl: v.optional(v.string()),
    updatedAt: v.number(),
  }),

  projects: defineTable({
    name: v.string(),
    nameLower: v.string(),
    colorSlot: v.number(),
  }).index('by_nameLower', ['nameLower']),

  tasks: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    projectId: v.id('projects'),
    assigneeId: v.optional(v.id('members')),
    dueDate: v.optional(v.string()),
    priority: v.number(),
    status: taskStatus,
    order: v.number(),
    createdBy: v.id('members'),
    createdAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
    subtasks: v.array(subtask),
    searchText: v.string(),
  })
    .index('by_status_order', ['status', 'order'])
    .index('by_assignee', ['assigneeId'])
    .index('by_due', ['dueDate'])
    .searchIndex('search_text', { searchField: 'searchText' }),

  journalEntries: defineTable({
    taskId: v.optional(v.id('tasks')),
    taskTitleSnapshot: v.optional(v.string()),
    date: v.string(),
    projectId: v.id('projects'),
    activity: v.string(),
    objective: v.optional(v.string()),
    development: v.optional(v.string()),
    result: v.optional(v.string()),
    observations: v.optional(v.string()),
    hours: v.optional(v.number()),
    docStatus,
    activityStatus,
    links: v.array(journalLink),
    photos: v.array(journalPhoto),
    dayOrder: v.number(),
    legacyId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_date', ['date'])
    .index('by_task', ['taskId'])
    .index('by_legacyId', ['legacyId']),

  events: defineTable({
    at: v.number(),
    actorId: v.id('members'),
    actorName: v.string(),
    actorRole: v.string(),
    type: eventType,
    subjectKind: v.string(),
    subjectId: v.optional(v.string()),
    subjectTitle: v.optional(v.string()),
    detail: v.optional(v.any()),
    visibility: eventVisibility,
  })
    .index('by_at', ['at'])
    .index('by_visibility_at', ['visibility', 'at']),
});
