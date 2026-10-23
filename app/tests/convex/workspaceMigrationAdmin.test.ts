import { afterEach, describe, expect, it } from 'vitest';
import { api } from '../../convex/_generated/api';
import { newTest, setupOwner } from './helpers';

const originalSecret = process.env.WORKSPACE_MIGRATION_SECRET;
afterEach(() => {
  if (originalSecret === undefined) delete process.env.WORKSPACE_MIGRATION_SECRET;
  else process.env.WORKSPACE_MIGRATION_SECRET = originalSecret;
});

describe('workspaceMigrationAdmin', () => {
  it('allows status through the CLI bridge only with the deployment secret', async () => {
    process.env.WORKSPACE_MIGRATION_SECRET = 'test-only-secret';
    const t = newTest();
    await setupOwner(t);

    await expect(t.action(api.workspaceMigrationAdmin.statusAction, { secret: 'wrong-secret' })).rejects.toMatchObject({ data: { code: 'FORBIDDEN' } });
    await expect(t.action(api.workspaceMigrationAdmin.statusAction, { secret: 'test-only-secret' })).resolves.toMatchObject({
      unassigned: { settings: 1 },
      inconsistentReferences: 0,
    });
  });
});
