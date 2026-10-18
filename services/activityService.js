import Activity from '../models/Activity.js';

export const recordActivity = async data => {
  try {
    return await Activity.create(data);
  } catch (error) {
    // Activity recording must not break the user's primary operation.
    console.error('Activity recording failed:', error.message);
    return null;
  }
};

export const buildChanges = (before, after, fields) => fields
  .filter(field => after[field] !== undefined && String(before[field] ?? '') !== String(after[field] ?? ''))
  .map(field => ({ field, from: before[field], to: after[field] }));
