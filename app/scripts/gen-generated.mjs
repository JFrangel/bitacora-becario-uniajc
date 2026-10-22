// Genera convex/_generated/* a mano mientras no exista un despliegue de Convex.
// `npx convex dev` (o `npx convex codegen`) los reemplaza por los oficiales.
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'convex');
const out = join(root, '_generated');
mkdirSync(out, { recursive: true });

const skip = new Set(['schema.ts', 'auth.config.ts']);
const modules = readdirSync(root, { withFileTypes: true })
  .filter((d) => d.isFile() && d.name.endsWith('.ts') && !d.name.endsWith('.d.ts') && !skip.has(d.name))
  .map((d) => d.name.replace(/\.ts$/, ''))
  .sort();

const imports = modules.map((m) => `import type * as ${m} from "../${m}.js";`).join('\n');
const entries = modules.map((m) => `  "${m}": typeof ${m};`).join('\n');

writeFileSync(join(out, 'api.d.ts'), `/* generado a mano por scripts/gen-generated.mjs; \`npx convex dev\` lo reemplaza */
import type { ApiFromModules, FilterApi, FunctionReference } from "convex/server";
${imports}

declare const fullApi: ApiFromModules<{
${entries}
}>;

export declare const api: FilterApi<typeof fullApi, FunctionReference<any, "public">>;
export declare const internal: FilterApi<typeof fullApi, FunctionReference<any, "internal">>;
export declare const components: {};
`);

writeFileSync(join(out, 'api.js'), `/* generado a mano por scripts/gen-generated.mjs */
import { anyApi, componentsGeneric } from "convex/server";

export const api = anyApi;
export const internal = anyApi;
export const components = componentsGeneric();
`);

writeFileSync(join(out, 'dataModel.d.ts'), `/* generado a mano por scripts/gen-generated.mjs */
import type { DataModelFromSchemaDefinition, DocumentByName, SystemTableNames, TableNamesInDataModel } from "convex/server";
import type { GenericId } from "convex/values";
import schema from "../schema.js";

export type TableNames = TableNamesInDataModel<DataModel>;
export type Doc<TableName extends TableNames> = DocumentByName<DataModel, TableName>;
export type Id<TableName extends TableNames | SystemTableNames> = GenericId<TableName>;
export type DataModel = DataModelFromSchemaDefinition<typeof schema>;
`);

writeFileSync(join(out, 'server.d.ts'), `/* generado a mano por scripts/gen-generated.mjs */
import type {
  ActionBuilder, GenericActionCtx, GenericDatabaseReader, GenericDatabaseWriter, GenericMutationCtx, GenericQueryCtx,
  HttpActionBuilder, MutationBuilder, QueryBuilder,
} from "convex/server";
import type { DataModel } from "./dataModel.js";

export declare const query: QueryBuilder<DataModel, "public">;
export declare const internalQuery: QueryBuilder<DataModel, "internal">;
export declare const mutation: MutationBuilder<DataModel, "public">;
export declare const internalMutation: MutationBuilder<DataModel, "internal">;
export declare const action: ActionBuilder<DataModel, "public">;
export declare const internalAction: ActionBuilder<DataModel, "internal">;
export declare const httpAction: HttpActionBuilder;

export type QueryCtx = GenericQueryCtx<DataModel>;
export type MutationCtx = GenericMutationCtx<DataModel>;
export type ActionCtx = GenericActionCtx<DataModel>;
export type DatabaseReader = GenericDatabaseReader<DataModel>;
export type DatabaseWriter = GenericDatabaseWriter<DataModel>;
`);

writeFileSync(join(out, 'server.js'), `/* generado a mano por scripts/gen-generated.mjs */
import {
  actionGeneric, httpActionGeneric, internalActionGeneric, internalMutationGeneric, internalQueryGeneric, mutationGeneric, queryGeneric,
} from "convex/server";

export const query = queryGeneric;
export const internalQuery = internalQueryGeneric;
export const mutation = mutationGeneric;
export const internalMutation = internalMutationGeneric;
export const action = actionGeneric;
export const internalAction = internalActionGeneric;
export const httpAction = httpActionGeneric;
`);
console.log('convex/_generated listo con módulos:', modules.join(', ') || '(ninguno)');
