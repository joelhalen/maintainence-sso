import { WebPlugin } from '@capacitor/core';
import type { ApkInstallerPlugin } from './apkInstaller';

export class ApkInstallerWeb extends WebPlugin implements ApkInstallerPlugin {
  async downloadAndInstall(options: { url: string }): Promise<void> {
    window.open(options.url, '_blank');
  }
}
