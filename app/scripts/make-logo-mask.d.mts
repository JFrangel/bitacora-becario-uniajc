export type Image = { width: number; height: number; rgba: Uint8Array };

export function decodePng(file: Buffer): Image;
export function encodePng(image: Image): Buffer;
export function makeMask(image: Image): Image;
