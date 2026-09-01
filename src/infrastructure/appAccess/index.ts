export type {
  AccessRedirect,
  AccessSnapshot,
  AppState,
  AppStateReason,
  BillingState,
  ResolveAppStateInput,
  ResolvedAppState,
  RouteCapability,
  WorkspaceState,
} from '@/src/infrastructure/appAccess/types';
export {
  ACCESS_POLICY_VERSION,
  ACCESS_SCHEMA_VERSION,
} from '@/src/infrastructure/appAccess/types';
export {
  resolveAppState,
  projectBillingState,
  projectWorkspaceState,
} from '@/src/infrastructure/appAccess/resolveAppState';
export {
  resolveRedirect,
  redirectLoopKey,
} from '@/src/infrastructure/appAccess/resolveRedirect';
export {
  allowsApi,
  allowsCapability,
  allowsFrontend,
  apiRouteCapability,
  capabilitiesForState,
  frontendPathCapability,
} from '@/src/infrastructure/appAccess/accessPolicy';
export { buildAccessSnapshot } from '@/src/infrastructure/appAccess/buildAccessSnapshot';
export type { BuildAccessSnapshotInput } from '@/src/infrastructure/appAccess/buildAccessSnapshot';
export {
  emitAccessTimeline,
  subscribeAccessTimeline,
} from '@/src/infrastructure/appAccess/navigationTimeline';
export type { AccessTimelineEvent } from '@/src/infrastructure/appAccess/navigationTimeline';
// ApplicationShell is React/Next — import from '@/src/infrastructure/appAccess/ApplicationShell' directly (keep barrel pure).
