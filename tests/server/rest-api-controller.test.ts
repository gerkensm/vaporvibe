
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RestApiController } from '../../src/server/rest-api-controller.js';
import { SessionStore } from '../../src/server/session-store.js';
import { createLlmClient } from '../../src/llm/factory.js';
import { logger } from '../../src/logger.js';
import { RuntimeConfig } from '../../src/types.js';

// Mock dependencies
vi.mock('../../src/server/session-store.js');
vi.mock('../../src/llm/factory.js');
vi.mock('../../src/logger.js');

describe('RestApiController - extractAttachmentsFromBody', () => {
    let controller: RestApiController;

    beforeEach(() => {
        const mockSessionStore = {} as SessionStore;
        const mockOptions = {
            sessionStore: mockSessionStore,
            adminPath: '/api/admin',
            getEnvironment: vi.fn()
        };

        controller = new RestApiController(mockOptions);
    });

    // Acces private method
    const extractAttachments = (body: any) => (controller as any).extractAttachmentsFromBody(body);

    it('should extract valid attachments and strip base64 from body', () => {
        const body = {
            someField: 'value',
            attachments: [
                {
                    name: 'image.png',
                    mimeType: 'image/png',
                    base64: 'base64data123'
                },
                {
                    name: 'text.txt',
                    mimeType: 'text/plain',
                    base64: 'base64text456'
                }
            ]
        };

        const files = extractAttachments(body);

        // Check return value
        expect(files).toHaveLength(2);
        expect(files[0].mimeType).toBe('image/png');
        expect(files[0].base64).toBe('base64data123');
        expect(files[1].mimeType).toBe('text/plain');
        expect(files[1].base64).toBe('base64text456');

        // Check body mutation (should be replaced with summary)
        expect(body.attachments).toHaveLength(2);
        expect((body.attachments as any)[0]).toBe('[Attachment: image.png (image/png), 9 bytes]');
        expect((body.attachments as any)[1]).toBe('[Attachment: text.txt (text/plain), 9 bytes]');
    });

    it('should ignore invalid attachment objects', () => {
        const body = {
            attachments: [
                { mimeType: 'image/png' }, // Missing base64
                { base64: 'data' },        // Missing mimeType
                'not-an-object',           // Not an object
                null
            ]
        };

        const files = extractAttachments(body);

        expect(files).toHaveLength(0);
        // Body should remain mostly untouched or contain mixed results if some were valid
        // In this case, none were valid, so no replacements happen for those specific indices?
        // Actually the code iterates and replaces if valid.
    });

    it('should handle missing attachments array', () => {
        const body = { foo: 'bar' };
        const files = extractAttachments(body);
        expect(files).toHaveLength(0);
        expect(body).toEqual({ foo: 'bar' });
    });

    it('should handle non-array attachments field', () => {
        const body = { attachments: 'not-an-array' };
        const files = extractAttachments(body);
        expect(files).toHaveLength(0);
    });
});
