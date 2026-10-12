const MB = 1024 * 1024;

// single source of truth: mime -> how we store/validate it
const MIME_RULES = {
    'image/jpeg': { ext: 'jpg',  resourceType: 'image', maxBytes: 10 * MB },
    'image/png':  { ext: 'png',  resourceType: 'image', maxBytes: 10 * MB },
    'image/webp': { ext: 'webp', resourceType: 'image', maxBytes: 10 * MB },
    'image/gif':  { ext: 'gif',  resourceType: 'image', maxBytes: 10 * MB },
    'application/pdf': { ext: 'pdf', resourceType: 'raw', maxBytes: 10 * MB },
    'text/plain':      { ext: 'txt', resourceType: 'raw', maxBytes: 10 * MB },
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        { ext: 'docx', resourceType: 'raw', maxBytes: 10 * MB },
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        { ext: 'xlsx', resourceType: 'raw', maxBytes: 10 * MB },
    'application/vnd.openxmlformats-officedocument.presentationml.presentation':
        { ext: 'pptx', resourceType: 'raw', maxBytes: 10 * MB }
};

const ALLOWED_EXTS = {
    image: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
    raw: ['pdf', 'txt', 'docx', 'xlsx', 'pptx']
};

const MAX_BYTES = { image: 10 * MB, raw: 10 * MB };

module.exports = { MIME_RULES, ALLOWED_EXTS, MAX_BYTES };
