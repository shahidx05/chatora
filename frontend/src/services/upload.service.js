import axios from "axios";
import api from "../api/axios";

// mirrors backend/src/config/uploadRules.js (server re-validates everything)
const MB = 1024 * 1024;
export const ALLOWED_TYPES = {
    "image/jpeg": 10 * MB,
    "image/png": 10 * MB,
    "image/webp": 10 * MB,
    "image/gif": 10 * MB,
    "application/pdf": 10 * MB,
    "text/plain": 10 * MB,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": 10 * MB,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": 10 * MB,
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": 10 * MB,
};

export const ACCEPT_ATTR = ".jpg,.jpeg,.png,.webp,.gif,.pdf,.txt,.docx,.xlsx,.pptx";

export const validateFile = (file) => {
    const max = ALLOWED_TYPES[file.type];
    if (!max) return "This file type is not supported";
    if (file.size > max) return `File too large (max ${Math.round(max / MB)} MB)`;
    return null;
};

export const formatSize = (bytes = 0) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < MB) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / MB).toFixed(1)} MB`;
};

// 1) ask our server for a signature  2) upload straight to Cloudinary
export const uploadAttachment = async (file, conversationId, onProgress) => {
    const { data: sig } = await api.post("/uploads/sign", {
        conversationId,
        mime: file.type,
        size: file.size,
    });

    const form = new FormData();
    form.append("file", file);
    form.append("api_key", sig.apiKey);
    form.append("timestamp", sig.timestamp);
    form.append("public_id", sig.publicId);
    form.append("signature", sig.signature);

    // plain axios on purpose: the `api` instance would attach our JWT to a third-party request
    await axios.post(sig.uploadUrl, form, {
        onUploadProgress: (e) => {
            if (e.total) onProgress?.(Math.round((e.loaded * 100) / e.total));
        },
    });

    return {
        publicId: sig.publicId,
        resourceType: sig.resourceType,
        originalName: file.name,
    };
};
