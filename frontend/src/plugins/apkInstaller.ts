import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export interface ApkInstallerPlugin {
  downloadAndInstall(options: { url: string }): Promise<void>;
  addListener(
    eventName: 'progress',
    listenerFunc: (event: { percent: number }) => void
  ): Promise<PluginListenerHandle>;
}

export const ApkInstaller = registerPlugin<ApkInstallerPlugin>('ApkInstaller', {
  web: () => import('./apkInstaller.web').then((m) => new m.ApkInstallerWeb()),
});
