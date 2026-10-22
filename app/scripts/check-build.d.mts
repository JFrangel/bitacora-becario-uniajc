export const BUDGET: { mainKb: number; badge3dKb: number };

export type BuildFacts = { mainKb?: number; badge3dKb?: number; badge3dChunks?: string[]; scanned?: number };

export function checkBuild(options?: { dist?: string; app?: string }): { problems: string[]; facts: BuildFacts };
