const signatures = {
  'image/jpeg': buffer => buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])),
  'image/png': buffer => buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/gif': buffer => ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii')),
  'image/webp': buffer => buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP',
  'application/pdf': buffer => buffer.subarray(0, 5).toString('ascii') === '%PDF-',
  'video/mp4': buffer => buffer.subarray(4, 8).toString('ascii') === 'ftyp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': buffer => buffer.subarray(0, 2).toString('hex') === '504b',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': buffer => buffer.subarray(0, 2).toString('hex') === '504b',
  'application/msword': buffer => buffer.subarray(0, 8).toString('hex') === 'd0cf11e0a1b11ae1',
  'application/vnd.ms-excel': buffer => buffer.subarray(0, 8).toString('hex') === 'd0cf11e0a1b11ae1',
};

export const validateFileSignature = (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: { code: 'FILE_REQUIRED', message: 'A file is required' } });
  const validator = signatures[req.file.mimetype];
  if (!validator || !validator(req.file.buffer)) {
    return res.status(415).json({ error: { code: 'INVALID_FILE_CONTENT', message: 'File content does not match its declared type' } });
  }
  next();
};
