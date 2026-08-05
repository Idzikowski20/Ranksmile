export { CIA_ZONES, isForbiddenImport } from './zones';
export type { CiaZone, CiaZoneId } from './zones';
export { extractImportSpecifiers } from './scanImports';
export {
  checkSourceAgainstZone,
  findCiaBoundaryViolations,
} from './checkBoundaries';
export type { BoundaryViolation } from './checkBoundaries';
