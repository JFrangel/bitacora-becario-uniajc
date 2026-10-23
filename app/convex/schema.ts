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

  workspaces: defineTable({
    name: v.string(),
    nameLower: v.string(),
    ownerMemberId: v.id('members'),
    legacyKey: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_owner', ['ownerMemberId'])
    .index('by_nameLower', ['nameLower'])
    .index('by_legacy_key', ['legacyKey']),

  workspaceMembers: defineTable({
    workspaceId: v.id('workspaces'),
    memberId: v.id('members'),
    role: v.union(v.literal('owner'), v.literal('editor')),
    createdAt: v.number(),
    revokedAt: v.optional(v.number()),
  })
    .index('by_workspace', ['workspaceId'])
    .index('by_member', ['memberId'])
    .index('by_member_workspace', ['memberId', 'workspaceId']),

  invites: defineTable({
    workspaceId: v.optional(v.id('workspaces')),
    tokenHash: v.string(),
    createdBy: v.id('members'),
    createdAt: v.number(),
    expiresAt: v.number(),
    usedBy: v.optional(v.id('members')),
    usedAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
  })
    .index('by_hash', ['tokenHash'])
    .index('by_creator', ['createdBy'])
    .index('by_workspace_creator', ['workspaceId', 'createdBy']),

  settings: defineTable({
    workspaceId: v.optional(v.id('workspaces')),
    shareToken: v.optional(v.string()),
    shareEnabled: v.boolean(),
    shareIncludesJournal: v.boolean(),
    shareShowsDescriptions: v.boolean(),
    timezone: v.string(),
  })
    .index('by_workspace', ['workspaceId'])
    .index('by_shareToken', ['shareToken']),

  profile: defineTable({
    // Opcional mientras se asocia el carné global existente con la cuenta propietaria.
    memberId: v.optional(v.id('members')),
    program: v.optional(v.string()),
    term: v.optional(v.string()),
    institution: v.optional(v.string()),
    group: v.optional(v.string()),
    frontDescription: v.optional(v.string()),
    groupLogoDataUrl: v.optional(v.string()),
    backTitle: v.optional(v.string()),
    backDescription: v.optional(v.string()),
    backFooter: v.optional(v.string()),
    badgeDesign: v.optional(v.string()),
    photoDataUrl: v.optional(v.string()),
    shareEnabled: v.optional(v.boolean()),
    shareTokenHash: v.optional(v.string()),
    sharePhoto: v.optional(v.boolean()),
    shareAcademic: v.optional(v.boolean()),
    updatedAt: v.number(),
  })
    .index('by_memberId', ['memberId'])
    .index('by_shareTokenHash', ['shareTokenHash']),

  projects: defineTable({
    workspaceId: v.optional(v.id('workspaces')),
    name: v.string(),
    nameLower: v.string(),
    colorSlot: v.number(),
  }).index('by_nameLower', ['nameLower']),

  tasks: defineTable({
    workspaceId: v.optional(v.id('workspaces')),
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
    workspaceId: v.optional(v.id('workspaces')),
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
    workspaceId: v.optional(v.id('workspaces')),
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
    .index('by_visibility_at', ['visibility', 'at'])
    .index('by_workspace_at', ['workspaceId', 'at'])
    .index('by_workspace_visibility_at', ['workspaceId', 'visibility', 'at']),
});
