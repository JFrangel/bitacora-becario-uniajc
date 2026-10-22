/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as calendar from "../calendar.js";
import type * as events from "../events.js";
import type * as files from "../files.js";
import type * as http from "../http.js";
import type * as invites from "../invites.js";
import type * as journal from "../journal.js";
import type * as legacyImport from "../legacyImport.js";
import type * as lib_actors from "../lib/actors.js";
import type * as lib_audience from "../lib/audience.js";
import type * as lib_calendar from "../lib/calendar.js";
import type * as lib_dates from "../lib/dates.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_eventPages from "../lib/eventPages.js";
import type * as lib_events from "../lib/events.js";
import type * as lib_hours from "../lib/hours.js";
import type * as lib_journalDraft from "../lib/journalDraft.js";
import type * as lib_journalDto from "../lib/journalDto.js";
import type * as lib_journalFields from "../lib/journalFields.js";
import type * as lib_journalQueries from "../lib/journalQueries.js";
import type * as lib_legacy from "../lib/legacy.js";
import type * as lib_limits from "../lib/limits.js";
import type * as lib_order from "../lib/order.js";
import type * as lib_profile from "../lib/profile.js";
import type * as lib_projects from "../lib/projects.js";
import type * as lib_taskQueries from "../lib/taskQueries.js";
import type * as lib_text from "../lib/text.js";
import type * as lib_tokens from "../lib/tokens.js";
import type * as lib_types from "../lib/types.js";
import type * as lib_validate from "../lib/validate.js";
import type * as lib_validators from "../lib/validators.js";
import type * as members from "../members.js";
import type * as profile from "../profile.js";
import type * as projects from "../projects.js";
import type * as session from "../session.js";
import type * as settings from "../settings.js";
import type * as tasks from "../tasks.js";
import type * as testing from "../testing.js";
import type * as viewer from "../viewer.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  calendar: typeof calendar;
  events: typeof events;
  files: typeof files;
  http: typeof http;
  invites: typeof invites;
  journal: typeof journal;
  legacyImport: typeof legacyImport;
  "lib/actors": typeof lib_actors;
  "lib/audience": typeof lib_audience;
  "lib/calendar": typeof lib_calendar;
  "lib/dates": typeof lib_dates;
  "lib/errors": typeof lib_errors;
  "lib/eventPages": typeof lib_eventPages;
  "lib/events": typeof lib_events;
  "lib/hours": typeof lib_hours;
  "lib/journalDraft": typeof lib_journalDraft;
  "lib/journalDto": typeof lib_journalDto;
  "lib/journalFields": typeof lib_journalFields;
  "lib/journalQueries": typeof lib_journalQueries;
  "lib/legacy": typeof lib_legacy;
  "lib/limits": typeof lib_limits;
  "lib/order": typeof lib_order;
  "lib/profile": typeof lib_profile;
  "lib/projects": typeof lib_projects;
  "lib/taskQueries": typeof lib_taskQueries;
  "lib/text": typeof lib_text;
  "lib/tokens": typeof lib_tokens;
  "lib/types": typeof lib_types;
  "lib/validate": typeof lib_validate;
  "lib/validators": typeof lib_validators;
  members: typeof members;
  profile: typeof profile;
  projects: typeof projects;
  session: typeof session;
  settings: typeof settings;
  tasks: typeof tasks;
  testing: typeof testing;
  viewer: typeof viewer;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
