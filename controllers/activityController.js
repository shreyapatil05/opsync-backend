import Activity from '../models/Activity.js';

export const getMyActivity = async (req, res) => {
 try {
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 50);
  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
  const filter = req.query.filter || 'all';
  const query = { $or: [{ actor: req.user.id }, { recipients: req.user.id }] };

  if (filter === 'mentions') query.recipients = req.user.id;
  if (filter === 'system') query.isSystem = true;
  if (filter === 'saved') query.savedBy = req.user.id;
  if (req.query.module && req.query.module !== 'all') query.category = req.query.module;
  if (req.query.from || req.query.to) {
    query.createdAt = {};
    if (req.query.from) query.createdAt.$gte = new Date(req.query.from);
    if (req.query.to) query.createdAt.$lte = new Date(req.query.to);
  }

  const [activities, total] = await Promise.all([
    Activity.find(query).populate('actor', 'name avatar role').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Activity.countDocuments(query),
  ]);

  res.json({ activities, pagination: { page, limit, total, hasMore: page * limit < total } });
 } catch (error) {
  res.status(500).json({ error: 'Unable to load activity' });
 }
};

export const toggleSaved = async (req, res) => {
 try {
  const activity = await Activity.findOne({ _id: req.params.id, $or: [{ actor: req.user.id }, { recipients: req.user.id }] });
  if (!activity) return res.status(404).json({ error: 'Activity not found' });
  const saved = activity.savedBy.some(id => id.toString() === req.user.id);
  await Activity.updateOne({ _id: activity._id }, saved ? { $pull: { savedBy: req.user.id } } : { $addToSet: { savedBy: req.user.id } });
  res.json({ saved: !saved });
 } catch (error) {
  res.status(500).json({ error: 'Unable to update activity' });
 }
};
