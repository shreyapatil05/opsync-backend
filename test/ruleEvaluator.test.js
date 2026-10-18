import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateRuleCondition, parseRuleCondition } from '../services/ruleEvaluator.js';

test('evaluates structured equality conditions', () => {
  assert.equal(evaluateRuleCondition(JSON.stringify({ field: 'status', operator: 'equals', value: 'done' }), { status: 'done' }), true);
});

test('evaluates grouped overdue conditions', () => {
  const condition = { all: [
    { field: 'status', operator: 'not_equals', value: 'done' },
    { field: 'dueDate', operator: 'before_now' },
  ] };
  assert.equal(evaluateRuleCondition(condition, { status: 'todo', dueDate: '2020-01-01' }), true);
});

test('rejects arbitrary JavaScript conditions', () => {
  assert.throws(() => parseRuleCondition('process.exit(1)'), /Unsupported rule condition/);
});

test('rejects unknown fields and operators', () => {
  assert.equal(evaluateRuleCondition({ field: 'constructor', operator: 'equals', value: 'x' }, {}), false);
  assert.equal(evaluateRuleCondition({ field: 'status', operator: 'execute', value: 'x' }, {}), false);
});
