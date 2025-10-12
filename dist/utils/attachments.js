export function cloneAttachments(attachments) {
    return attachments.map((attachment) => ({ ...attachment }));
}
