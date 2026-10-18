const OPERATORS = {
  equals: (actual, expected) => actual === expected,
  not_equals: (actual, expected) => actual !== expected,
  before_now: actual => Boolean(actual) && new Date(actual).getTime() < Date.now(),
  after_now: actual => Boolean(actual) && new Date(actual).getTime() > Date.now(),
};

const ALLOWED_FIELDS = new Set(['status', 'priority', 'dueDate']);

const legacyConditions = new Map([
  ["task.status !== 'done' && new Date(task.dueDate) < new Date()", { all: [
    { field: 'status', operator: 'not_equals', value: 'done' },
    { field: 'dueDate', operator: 'before_now' },
  ] }],
  ["task.status === 'done'", { field: 'status', operator: 'equals', value: 'done' }],
  ["task.priority === 'high'", { field: 'priority', operator: 'equals', value: 'high' }],
]);

export const parseRuleCondition = condition => {
  if (condition && typeof condition === 'object') return condition;
  if (legacyConditions.has(condition)) return legacyConditions.get(condition);
  try {
    return JSON.parse(condition);
  } catch {
    throw new Error('Unsupported rule condition. Use the structured rule builder.');
  }
};

export const evaluateRuleCondition = (condition, task) => {
  const parsed = parseRuleCondition(condition);
  if (Array.isArray(parsed.all)) return parsed.all.every(item => evaluateRuleCondition(item, task));
  if (Array.isArray(parsed.any)) return parsed.any.some(item => evaluateRuleCondition(item, task));
  if (!ALLOWED_FIELDS.has(parsed.field) || !OPERATORS[parsed.operator]) return false;
  return OPERATORS[parsed.operator](task[parsed.field], parsed.value);
};
