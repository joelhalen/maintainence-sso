import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { AppError } from '../middleware/errorHandler';
export interface AppReleaseInfo {
  versionName: string;
  versionCode: number;
  minVersionCode: number;
  apkUrl: string;
  playStoreUrl: string | null;
  appStoreUrl: string | null;
  builtAt?: string;
  sha256?: string;
  bytes?: number;
}

export interface MobileReleaseConfig {
  versionName: string;
  versionCode: number;
  minVersionCode: number;
  apkUrl: string;
  playStoreUrl: string | null;
  appStoreUrl: string | null;
}

export type MobileBuildStatus = 'idle' | 'running' | 'succeeded' | 'failed';

export interface MobileBuildState {
  status: MobileBuildStatus;
  startedAt: string | null;
  finishedAt: string | null;
  log: string;
  error: string | null;
  triggeredByUserId: string | null;
}

export interface MobileReleaseAdminView {
  config: MobileReleaseConfig;
  release: AppReleaseInfo;
  build: MobileBuildState;
  downloadPageUrl: string;
  canBuild: boolean;
  buildUnavailableReason: string | null;
}

const DEFAULT_APK_URL = process.env.APP_APK_URL || 'https://megamtx.joelhalen.net/download_apk';

function repoRoot(): string {
  if (process.env.MEGAMTX_ROOT) return process.env.MEGAMTX_ROOT;
  return path.join(process.cwd(), '..');
}

function configPath(): string {
  return process.env.MOBILE_RELEASE_CONFIG_PATH
    || path.join(process.cwd(), 'data', 'mobile-release-config.json');
}

function buildStatusPath(): string {
  return process.env.MOBILE_BUILD_STATUS_PATH
    || path.join(process.cwd(), 'data', 'mobile-build-status.json');
}

function buildInfoPath(): string {
  return process.env.APP_RELEASE_INFO_PATH
    || path.join(repoRoot(), 'releases', 'build-info.json');
}

function buildScriptPath(): string {
  return path.join(repoRoot(), 'scripts', 'build-android-apk.sh');
}

function parseVersionCode(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const DEFAULT_CONFIG: MobileReleaseConfig = {
  versionName: '1.0.0',
  versionCode: 1,
  minVersionCode: 1,
  apkUrl: DEFAULT_APK_URL,
  playStoreUrl: null,
  appStoreUrl: null,
};

const DEFAULT_BUILD_STATE: MobileBuildState = {
  status: 'idle',
  startedAt: null,
  finishedAt: null,
  log: '',
  error: null,
  triggeredByUserId: null,
};

let activeBuildProcess: ReturnType<typeof spawn> | null = null;

export async function readBuildInfoFile(): Promise<Record<string, unknown> | null> {
  try {
    const raw = await fs.readFile(buildInfoPath(), 'utf-8');
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function readMobileReleaseConfig(): Promise<MobileReleaseConfig> {
  try {
    const raw = await fs.readFile(configPath(), 'utf-8');
    const data = JSON.parse(raw) as Partial<MobileReleaseConfig>;
    return {
      versionName: String(data.versionName ?? DEFAULT_CONFIG.versionName),
      versionCode: parseVersionCode(data.versionCode, DEFAULT_CONFIG.versionCode),
      minVersionCode: parseVersionCode(data.minVersionCode, DEFAULT_CONFIG.minVersionCode),
      apkUrl: String(data.apkUrl ?? DEFAULT_CONFIG.apkUrl),
      playStoreUrl: data.playStoreUrl ?? null,
      appStoreUrl: data.appStoreUrl ?? null,
    };
  } catch {
    const build = await readBuildInfoFile();
    if (build) {
      return {
        versionName: String(build.versionName ?? build.version ?? DEFAULT_CONFIG.versionName),
        versionCode: parseVersionCode(build.versionCode ?? build.version, DEFAULT_CONFIG.versionCode),
        minVersionCode: parseVersionCode(build.minVersionCode, DEFAULT_CONFIG.minVersionCode),
        apkUrl: String(build.apkUrl ?? DEFAULT_CONFIG.apkUrl),
        playStoreUrl: (build.playStoreUrl as string | null) ?? null,
        appStoreUrl: (build.appStoreUrl as string | null) ?? null,
      };
    }
    return { ...DEFAULT_CONFIG };
  }
}

export async function writeMobileReleaseConfig(config: MobileReleaseConfig): Promise<void> {
  if (config.minVersionCode > config.versionCode) {
    throw new AppError(400, 'Minimum version code cannot be greater than current version code');
  }
  await fs.mkdir(path.dirname(configPath()), { recursive: true });
  await fs.writeFile(configPath(), JSON.stringify(config, null, 2), 'utf-8');
  await syncBuildInfoFromConfig(config);
}

async function syncBuildInfoFromConfig(config: MobileReleaseConfig): Promise<void> {
  const existing = (await readBuildInfoFile()) ?? {};
  const merged = {
    ...existing,
    versionName: config.versionName,
    versionCode: config.versionCode,
    minVersionCode: config.minVersionCode,
    apkUrl: config.apkUrl,
    playStoreUrl: config.playStoreUrl,
    appStoreUrl: config.appStoreUrl,
  };
  await fs.mkdir(path.dirname(buildInfoPath()), { recursive: true });
  await fs.writeFile(buildInfoPath(), JSON.stringify(merged, null, 2), 'utf-8');
}

export async function getEffectiveReleaseInfo(): Promise<AppReleaseInfo> {
  const config = await readMobileReleaseConfig();
  const build = await readBuildInfoFile();

  return {
    versionName: config.versionName,
    versionCode: config.versionCode,
    minVersionCode: config.minVersionCode,
    apkUrl: config.apkUrl,
    playStoreUrl: config.playStoreUrl,
    appStoreUrl: config.appStoreUrl,
    builtAt: build?.builtAt as string | undefined,
    sha256: build?.sha256 as string | undefined,
    bytes: typeof build?.bytes === 'number' ? build.bytes : undefined,
  };
}

export async function readBuildState(): Promise<MobileBuildState> {
  try {
    const raw = await fs.readFile(buildStatusPath(), 'utf-8');
    return { ...DEFAULT_BUILD_STATE, ...JSON.parse(raw) } as MobileBuildState;
  } catch {
    return { ...DEFAULT_BUILD_STATE };
  }
}

async function writeBuildState(state: MobileBuildState): Promise<void> {
  await fs.mkdir(path.dirname(buildStatusPath()), { recursive: true });
  await fs.writeFile(buildStatusPath(), JSON.stringify(state, null, 2), 'utf-8');
}

function appendLog(current: string, chunk: string, maxLen = 32_000): string {
  const next = current + chunk;
  return next.length > maxLen ? next.slice(next.length - maxLen) : next;
}

async function canRunAndroidBuild(): Promise<{ ok: boolean; reason: string | null }> {
  const sdk = process.env.ANDROID_SDK_ROOT || '/opt/android-sdk';
  const sdkManager = path.join(sdk, 'cmdline-tools/latest/bin/sdkmanager');
  const script = buildScriptPath();
  try {
    await fs.access(script);
  } catch {
    return { ok: false, reason: 'Build script not found on server' };
  }
  try {
    await fs.access(sdkManager);
  } catch {
    return { ok: false, reason: 'Android SDK not installed (run install-android-sdk.sh on the server)' };
  }
  return { ok: true, reason: null };
}

export async function getMobileReleaseAdminView(): Promise<MobileReleaseAdminView> {
  const [config, release, build, buildCheck] = await Promise.all([
    readMobileReleaseConfig(),
    getEffectiveReleaseInfo(),
    readBuildState(),
    canRunAndroidBuild(),
  ]);

  const frontendUrl = process.env.FRONTEND_URL || 'https://megamtx.joelhalen.net';
  const downloadPageUrl = `${frontendUrl.replace(/\/$/, '')}/download_apk`;

  return {
    config,
    release,
    build,
    downloadPageUrl,
    canBuild: buildCheck.ok && build.status !== 'running',
    buildUnavailableReason: build.status === 'running'
      ? 'A build is already in progress'
      : buildCheck.reason,
  };
}

export async function startMobileApkBuild(userId: string): Promise<MobileBuildState> {
  const state = await readBuildState();
  if (state.status === 'running' || activeBuildProcess) {
    throw new AppError(409, 'An APK build is already in progress');
  }

  const buildCheck = await canRunAndroidBuild();
  if (!buildCheck.ok) {
    throw new AppError(503, buildCheck.reason || 'Android build is not available on this server');
  }

  const config = await readMobileReleaseConfig();
  const script = buildScriptPath();
  const root = repoRoot();

  const running: MobileBuildState = {
    status: 'running',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    log: `[build] Starting APK build for ${config.versionName} (${config.versionCode})…\n`,
    error: null,
    triggeredByUserId: userId,
  };
  await writeBuildState(running);

  const child = spawn('bash', [script], {
    cwd: root,
    env: {
      ...process.env,
      BUILD_VERSION_NAME: config.versionName,
      BUILD_VERSION_CODE: String(config.versionCode),
      APP_MIN_VERSION_CODE: String(config.minVersionCode),
      APP_APK_URL: config.apkUrl,
    },
  });

  activeBuildProcess = child;

  const onData = (chunk: Buffer) => {
    running.log = appendLog(running.log, chunk.toString());
    void writeBuildState({ ...running });
  };

  child.stdout.on('data', onData);
  child.stderr.on('data', onData);

  child.on('close', async (code) => {
    activeBuildProcess = null;
    running.finishedAt = new Date().toISOString();
    if (code === 0) {
      running.status = 'succeeded';
      running.log = appendLog(running.log, '\n[build] Completed successfully.\n');
      const built = await readBuildInfoFile();
      if (built) {
        await writeMobileReleaseConfig({
          versionName: String(built.versionName ?? config.versionName),
          versionCode: parseVersionCode(built.versionCode, config.versionCode),
          minVersionCode: parseVersionCode(built.minVersionCode, config.minVersionCode),
          apkUrl: String(built.apkUrl ?? config.apkUrl),
          playStoreUrl: (built.playStoreUrl as string | null) ?? config.playStoreUrl,
          appStoreUrl: (built.appStoreUrl as string | null) ?? config.appStoreUrl,
        });
      }
    } else {
      running.status = 'failed';
      running.error = `Build exited with code ${code ?? 'unknown'}`;
      running.log = appendLog(running.log, `\n[build] FAILED: ${running.error}\n`);
    }
    await writeBuildState(running);
  });

  child.on('error', async (err) => {
    activeBuildProcess = null;
    running.status = 'failed';
    running.finishedAt = new Date().toISOString();
    running.error = err.message;
    running.log = appendLog(running.log, `\n[build] ERROR: ${err.message}\n`);
    await writeBuildState(running);
  });

  return running;
}
