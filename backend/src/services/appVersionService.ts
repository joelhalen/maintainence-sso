import { getEffectiveReleaseInfo, type AppReleaseInfo } from './mobileReleaseService';

export type { AppReleaseInfo };

export async function getAppReleaseInfo(): Promise<AppReleaseInfo> {
  return getEffectiveReleaseInfo();
}
