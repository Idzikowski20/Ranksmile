// Mock for sequelize — avoids ESM SyntaxError in Jest (uuid ESM dep).
// Op keys are strings (not Symbols) so that JSON.stringify serialises WHERE clauses
// in tests that assert on the stringified query (e.g. toContain('6')).
const Op = {
  in: 'Op.in',
  notIn: 'Op.notIn',
  eq: 'Op.eq',
  ne: 'Op.ne',
  gt: 'Op.gt',
  gte: 'Op.gte',
  lt: 'Op.lt',
  lte: 'Op.lte',
  like: 'Op.like',
  or: 'Op.or',
  and: 'Op.and',
};

export { Op };
export default { Op };
