const cloudinary = require('../config/cloudinary');
const { ALLOWED_EXTS, MAX_BYTES } = require('../config/uploadRules');

// errors with expose=true are safe to show to the client
const fail = (message) => Object.assign(new Error(message), { expose: true });

const cleanName = (name, ext) => {
    const base = String(name || `file.${ext}`)
        .replace(/[\\/]/g, '_')
        .replace(/[\u0000-\u001f]/g, '')
        .trim()
        .slice(0, 100);
    return base || `file.${ext}`;
};

/**
 * Never trust what the client says about an upload. Ask Cloudinary what is
 * really stored under that public_id, then check conversation, type and size.
 */
const verifyAttachment = async (attachment, conversationId) => {
    const { publicId, resourceType, originalName } = attachment || {};

    if (!['image', 'raw'].includes(resourceType)) throw fail('Invalid attachment');

    // the file must have been signed for THIS conversation
    const prefix = `chatora/${conversationId}/`;
    if (typeof publicId !== 'string' || !publicId.startsWith(prefix) || publicId.includes('..')) {
        throw fail('Invalid attachment');
    }

    let info;
    try {
        info = await cloudinary.api.resource(publicId, { resource_type: resourceType });
    } catch {
        throw fail('Upload not found');
    }

    const ext = resourceType === 'raw'
        ? publicId.split('.').pop().toLowerCase()
        : String(info.format).toLowerCase();

    if (!ALLOWED_EXTS[resourceType].includes(ext) || info.bytes > MAX_BYTES[resourceType]) {
        // reject and clean up so bad files don't pile up in storage
        await cloudinary.uploader.destroy(publicId, { resource_type: resourceType }).catch(() => {});
        throw fail('File type or size not allowed');
    }

    return {
        url: info.secure_url,
        publicId,
        resourceType,
        format: ext,
        bytes: info.bytes,
        width: info.width,
        height: info.height,
        originalName: cleanName(originalName, ext)
    };
};

module.exports = { verifyAttachment };
