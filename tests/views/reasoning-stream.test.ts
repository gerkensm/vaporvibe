import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { JSDOM } from 'jsdom';

const SCRIPT_PATH = path.resolve(__dirname, '../../src/views/loading-shell/assets/reasoning-stream.js');
const SCRIPT_CONTENT = fs.readFileSync(SCRIPT_PATH, 'utf-8');

describe('Reasoning Stream Frontend Logic', () => {
    let dom: JSDOM;
    let mockEventSource: any;
    let eventHandlers: Record<string, Function> = {};
    let rafCallbacks: FrameRequestCallback[] = [];
    let currentTime = 1000;

    beforeEach(() => {
        // Setup JSDOM
        dom = new JSDOM('<!DOCTYPE html><body><div data-reasoning-panel><div id="panel" data-reasoning-log></div></div><div data-status></div></body>', {
            url: 'http://localhost:3000/',
            runScripts: 'dangerously',
            resources: 'usable',
        });

        // Reset event handlers and callbacks
        eventHandlers = {};
        rafCallbacks = [];
        currentTime = 1000;

        // Mock EventSource constructor
        mockEventSource = {
            addEventListener: vi.fn((event, handler) => {
                eventHandlers[event] = handler;
            }),
            close: vi.fn(),
        };

        // Attach mocks directly to JSDOM window before assigning to global
        // Use a proper constructor function (not arrow function) for EventSource
        const EventSourceMock = function (this: any, url: string) {
            return mockEventSource;
        };
        dom.window.EventSource = EventSourceMock as any;

        dom.window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
            rafCallbacks.push(callback);
            return 1;
        }) as any;

        dom.window.cancelAnimationFrame = vi.fn() as any;

        // Setup config in JSDOM window
        (dom.window as any).__vaporVibeReasoningStream = {
            token: 'test-token',
            routePrefix: '/__vaporvibe/reasoning',
        };

        // Now assign JSDOM window to global (after all mocks are in place)
        global.window = dom.window as any;
        global.document = dom.window.document;
        global.Node = dom.window.Node;
        global.HTMLElement = dom.window.HTMLElement;
        global.CustomEvent = dom.window.CustomEvent;
        global.MutationObserver = dom.window.MutationObserver;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const runScript = () => {
        let debugScript = SCRIPT_CONTENT;

        // Expose registerDisplay to window for manual invocation in tests
        debugScript = debugScript.replace(
            'function registerDisplay(log) {',
            'window.__testRegisterDisplay = function registerDisplay(log) {'
        );

        // Fix instanceof Function check for JSDOM compatibility
        // JSDOM has issues with instanceof across contexts, so we use typeof instead
        debugScript = debugScript.replace(
            /if \(log\.closest instanceof Function\) \{/g,
            'if (typeof log.closest === "function") {'
        );

        debugScript = debugScript.replace(
            /if \(root\.querySelectorAll instanceof Function\)/g,
            'if (typeof root.querySelectorAll === "function")'
        );

        dom.window.eval(debugScript);
    };

    const flushAnimations = () => {
        let iterations = 0;
        while (rafCallbacks.length > 0 && iterations < 1000) {
            const cb = rafCallbacks.shift();
            currentTime += 100;
            if (cb) cb(currentTime);
            iterations++;
        }
    };

    const registerDisplay = () => {
        const log = document.querySelector('[data-reasoning-log]') as HTMLElement;
        if ((dom.window as any).__testRegisterDisplay && log) {
            (dom.window as any).__testRegisterDisplay(log);
        }
    };

    it('initializes and connects to EventSource', () => {
        runScript();
        // EventSource is created inside the IIFE, so we can't directly check the mock
        // But we can verify event handlers are registered
        expect(eventHandlers['reasoning']).toBeDefined();
        expect(eventHandlers['final']).toBeDefined();
        expect(eventHandlers['complete']).toBeDefined();
    });

    it('updates DOM on "thinking" event', () => {
        runScript();
        registerDisplay();

        const reasoningEvent = {
            data: JSON.stringify({ kind: 'thinking', text: 'Hello world' }),
        };

        eventHandlers['reasoning'](reasoningEvent);
        flushAnimations();

        const log = document.querySelector('[data-reasoning-log]');
        expect(log?.textContent).toContain('Hello world');
    });

    it('handles "summary" events separately from "thinking"', () => {
        runScript();
        registerDisplay();

        // Send summary
        eventHandlers['reasoning']({
            data: JSON.stringify({ kind: 'summary', text: 'This is a summary.' }),
        });

        // Send thinking
        eventHandlers['reasoning']({
            data: JSON.stringify({ kind: 'thinking', text: 'I am thinking.' }),
        });

        flushAnimations();

        const log = document.querySelector('[data-reasoning-log]');
        const content = log?.innerHTML || '';

        expect(content).toContain('This is a summary.');
        expect(content).toContain('I am thinking.');

        // Verify order: Summary comes before thinking content
        const summaryIndex = content.indexOf('This is a summary.');
        const thinkingIndex = content.indexOf('I am thinking.');
        expect(summaryIndex).toBeLessThan(thinkingIndex);
    });

    it('does not flicker/clear when receiving mixed events', () => {
        runScript();
        registerDisplay();

        // 1. Thinking
        eventHandlers['reasoning']({
            data: JSON.stringify({ kind: 'thinking', text: 'Step 1.' }),
        });

        flushAnimations();

        let log = document.querySelector('[data-reasoning-log]');
        expect(log?.textContent).toContain('Step 1.');

        // 2. Summary (should append to summary buffer, not replace thinking)
        eventHandlers['reasoning']({
            data: JSON.stringify({ kind: 'summary', text: 'Summary A.' }),
        });

        flushAnimations();

        log = document.querySelector('[data-reasoning-log]');
        expect(log?.textContent).toContain('Step 1.');
        expect(log?.textContent).toContain('Summary A.');

        // 3. More Thinking
        eventHandlers['reasoning']({
            data: JSON.stringify({ kind: 'thinking', text: ' Step 2.' }),
        });

        flushAnimations();

        log = document.querySelector('[data-reasoning-log]');
        expect(log?.textContent).toContain('Step 1. Step 2.');
    });

    it('handles markdown rendering', () => {
        runScript();
        registerDisplay();

        eventHandlers['reasoning']({
            data: JSON.stringify({ kind: 'thinking', text: '**Bold** and *Italic*' }),
        });

        flushAnimations();

        const log = document.querySelector('[data-reasoning-log]');
        const content = log?.innerHTML || '';

        expect(content).toContain('<strong>Bold</strong>');
        expect(content).toContain('<em>Italic</em>');
    });
});
