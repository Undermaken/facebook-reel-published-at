import { getReelId } from './data';

export function isReelTab(_url: string | undefined): boolean {
  return !!_url && getReelId(_url) !== null;
}
