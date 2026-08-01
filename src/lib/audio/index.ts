/**
 * src/lib/audio/index.ts
 * نقطة التصدير الموحّدة لنظام إدارة المحتوى الصوتي
 */

// ── AudioType ─────────────────────────────────────────────────────────────────
export type { AudioType } from './audio-types';

// ── Manifest (Single Source of Truth لـ AudioPackage) ────────────────────────
export type { AudioPackage }    from './audio-manifest';
export type { LocalizedString } from './audio-manifest';
export type { PackageLicense }  from './audio-manifest';
export type { Category }        from './audio-manifest';
export type { Manifest }        from './audio-manifest';
export {
  isManifestValid,
  findPackage,
  packagesByType,
  builtInPackages,
  downloadablePackages,
  SAMPLE_MANIFEST,
} from './audio-manifest';

// ── Package Validator ─────────────────────────────────────────────────────────
export type { PackageValidationResult, ValidatorTestReport } from './package-validator';
export {
  PackageValidator,
  packageValidator,
  testValidator,
} from './package-validator';

// ── Catalog Service (قراءة الكتالوج من CatalogSource فقط) ────────────────────
export type { CatalogSource, CatalogTestReport } from './catalog-service';
export {
  LocalCatalogSource,
  CatalogService,
  catalogService,
  testCatalog,
} from './catalog-service';

// ── Cloudflare Catalog Source ─────────────────────────────────────────────────
export type { CloudflareCatalogTestReport } from './cloudflare-catalog-source';
export {
  CATALOG_URL,
  CloudflareCatalogSource,
  testCloudflareCatalog,
} from './cloudflare-catalog-source';

// ── Audio Repository (Facade — نقطة الدخول الوحيدة) ─────────────────────────
// compareWithInstalled هنا — Repository ينسّق Catalog + Registry
export type { AudioRepositoryResult, RepositoryTestReport, PackageComparisonResult } from './audio-repository';
export {
  AudioRepository,
  audioRepository,
  testRepository,
} from './audio-repository';

// ── Package State Machine ─────────────────────────────────────────────────────
export type { PackageState }           from './package-state';
export type { PackageStatus }          from './package-state';
export type { StateMachineTestReport } from './package-state';
export {
  DEFAULT_PACKAGE_STATUS,
  ALLOWED_TRANSITIONS,
  PackageStateMachine,
  packageStateMachine,
  testStateMachine,
  isInstalled,
  isDownloading,
  isFailed,
  isCorrupted,
  needsUpdate,
  canInstall,
  canDownload,
  isInProgress,
} from './package-state';

// ── Storage Layout ────────────────────────────────────────────────────────────
export {
  AUDIO_ROOT,
  PACKAGES_DIRECTORY,
  CACHE_DIRECTORY,
  TEMP_DIRECTORY,
  AUDIO_DIRECTORY,
  ASSETS_DIRECTORY,
  MANIFEST_FILENAME,
  THUMBNAIL_FILENAME,
  REGISTRY_FILENAME,
  REGISTRY_SCHEMA_VERSION,
} from './storage-layout';

// ── Audio Registry ────────────────────────────────────────────────────────────
export type { InstalledRegistry, RegistryTestReport } from './audio-registry';
export {
  RegistryService,
  registryService,
  testRegistry,
} from './audio-registry';

// ── Constants ─────────────────────────────────────────────────────────────────
export {
  AUDIO_ROOT_DIRECTORY,
  AUDIO_INDEX_FILENAME,
  AUDIO_FILE_EXTENSION,
  SUPPORTED_AUDIO_TYPES,
  AUDIO_MANIFEST_SCHEMA_VERSION,
  AUDIO_BUILTIN_DIRECTORY,
  AUDIO_USER_DIRECTORY,
} from './constants';

// ── Audio Storage (إدارة الملفات فقط) ────────────────────────────────────────
export type { InstalledPackageInfo, StorageReport, InstallationTestReport } from './audio-storage';
export {
  rootPath,
  packagesPath,
  cachePath,
  tempPath,
  packagePath,
  audioPath,
  assetsPath,
  manifestPath,
  thumbnailPath,
  AudioStorageService,
  audioStorage,
  testStorageInit,
  testLocalInstallation,
} from './audio-storage';

// ── Package Manager (Orchestrator) ────────────────────────────────────────────
export type {
  PackageManagerResult,
  VerifyResult,
  RepairResult,
  InstallOptions,
} from './package-manager';
export { PackageManager, packageManager } from './package-manager';

// ── AudioService (Facade — نقطة الدخول الوحيدة لبقية التطبيق) ───────────────
export type {
  AudioTrack,
  AudioServiceState,
  AudioServiceResult,
  AudioServiceStatus,
  AudioServiceEventType,
  AudioServiceEvent,
  AudioServiceListener,
  AudioServiceUnsubscribe,
  SurahPlayOptions,
  PlaylistPlayOptions,
} from './service';
export { AudioService, audioService } from './service';

// ── Playlist / Queue Layer (فوق AudioController) ─────────────────────────────
export type {
  PlaylistItem,
  PlaylistState,
  PlaylistStatus,
  PlaylistResult,
  PlaylistError,
  PlaylistErrorCode,
  PlaylistEventType,
  PlaylistEvent,
  PlaylistListener,
  PlaylistUnsubscribe,
  PlaylistStateChangedPayload,
  PlaylistTrackChangedPayload,
  PlaylistQueueChangedPayload,
  PlaylistErrorPayload,
} from './playlist';
export { PlaylistManager, playlistManager } from './playlist';

// ── Audio Controller (نقطة الدخول الوحيدة لمنظومة الصوت) ─────────────────────
export type {
  AudioControllerState,
  AudioControllerStatus,
  AudioControllerResult,
  AudioControllerError,
  AudioControllerErrorCode,
  AudioControllerEventType,
  AudioControllerEvent,
  AudioControllerListener,
  AudioControllerUnsubscribe,
  ControllerStateChangedPayload,
  ControllerProgressPayload,
  ControllerErrorPayload,
} from './controller';
export { AudioController, audioController } from './controller';

// ── Audio Session types فقط — لا تصدير Singleton أو Class ───────────────────
// AudioSession وaudioSession غير مُصدَّران عمداً.
// الوصول للجلسة يتم فقط عبر AudioController.
export type {
  AudioSessionState,
  AudioSessionConfig,
  AudioSessionResult,
  AudioSessionError,
  AudioSessionErrorCode,
  AudioSessionEventType,
  AudioSessionEvent,
  AudioSessionListener,
  AudioSessionUnsubscribe,
  AudioInterruptionMode,
  AudioRoute,
  SessionStateChangedPayload,
  SessionConfiguredPayload,
  SessionErrorPayload,
} from './session';
export { DEFAULT_SESSION_CONFIG } from './session';

// ── Audio Runtime types فقط — لا تصدير Singleton أو Class ───────────────────
// AudioRuntime وaudioRuntime غير مُصدَّران عمداً.
// التشغيل يتم فقط عبر AudioController.
export type {
  AudioPlaybackState,
  AudioRuntimeStatus,
  AudioRuntimeResult,
  AudioRuntimeError,
  AudioRuntimeErrorCode,
  AudioRuntimeEventType,
  AudioRuntimeEvent,
  AudioRuntimeListener,
  AudioRuntimeUnsubscribe,
  PlaybackProgressPayload,
  StateChangedPayload,
  PlaybackErrorPayload,
} from './runtime';
