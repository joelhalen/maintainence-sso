import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import api from '../api/client';

export interface AppReleaseInfo {
  versionName: string;
  versionCode: number;
  minVersionCode: number;
  apkUrl: string;
  playStoreUrl: string | null;
  appStoreUrl: string | null;
  builtAt?: string;
  sha256?: string;
}

export interface InstalledAppInfo {
  versionName: string;
  versionCode: number;
}

export type UpdateRequirement = 'none' | 'optional' | 'required';

export async function fetchReleaseInfo(): Promise<AppReleaseInfo> {
  const { data } = await api.get<AppReleaseInfo>('/app/version');
  return data;
}

export async function getInstalledAppInfo(): Promise<InstalledAppInfo | null> {
  if (!Capacitor.isNativePlatform()) return null;
  const info = await App.getInfo();
  const versionCode = parseInt(info.build, 10);
  return {
    versionName: info.version,
    versionCode: Number.isFinite(versionCode) ? versionCode : 0,
  };
}

export function getUpdateRequirement(
  installed: InstalledAppInfo,
  release: AppReleaseInfo
): UpdateRequirement {
  if (installed.versionCode < release.minVersionCode) return 'required';
  if (installed.versionCode < release.versionCode) return 'optional';
  return 'none';
}

const SNOOZE_KEY = 'app_update_snooze_until';

export function snoozeOptionalUpdate(hours = 24): void {
  const until = Date.now() + hours * 60 * 60 * 1000;
  localStorage.setItem(SNOOZE_KEY, String(until));
}

export function isOptionalUpdateSnoozed(): boolean {
  const raw = localStorage.getItem(SNOOZE_KEY);
  if (!raw) return false;
  const until = parseInt(raw, 10);
  if (!Number.isFinite(until) || Date.now() >= until) {
    localStorage.removeItem(SNOOZE_KEY);
    return false;
  }
  return true;
}

export function clearUpdateSnooze(): void {
  localStorage.removeItem(SNOOZE_KEY);
}
