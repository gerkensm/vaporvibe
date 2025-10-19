import { parse, HTMLElement } from "node-html-parser";

const STRUCTURAL_COMPONENT_TAGS = new Set([
  "header",
  "footer",
  "nav",
  "main",
  "aside",
  "section",
  "div",
]);

const PLACEHOLDER_PATTERN = /\{\{(component|style):([a-zA-Z0-9_-]+)\}\}/g;
const STYLE_DATA_ATTR = "data-style-id";

export interface PlaceholderApplyResult {
  html: string;
  missingComponentIds: string[];
  missingStyleIds: string[];
  replacedComponentIds: string[];
  replacedStyleIds: string[];
}

export interface ReusableCachePreparationResult {
  html: string;
  componentCache: Record<string, string>;
  styleCache: Record<string, string>;
  nextComponentId: number;
  nextStyleId: number;
}

export function applyReusablePlaceholders(
  html: string,
  caches: {
    componentCache: Record<string, string>;
    styleCache: Record<string, string>;
  }
): PlaceholderApplyResult {
  const missingComponents = new Set<string>();
  const missingStyles = new Set<string>();
  const replacedComponentIds: string[] = [];
  const replacedStyleIds: string[] = [];

  const replaced = html.replace(
    PLACEHOLDER_PATTERN,
    (_match, placeholderType: string, id: string) => {
      if (placeholderType === "component") {
        const cachedComponent = caches.componentCache[id];
        if (typeof cachedComponent === "string") {
          replacedComponentIds.push(id);
          return cachedComponent;
        }
        missingComponents.add(id);
        return "";
      }

      const cachedStyle = caches.styleCache[id];
      if (typeof cachedStyle === "string") {
        replacedStyleIds.push(id);
        return cachedStyle;
      }
      missingStyles.add(id);
      return "";
    }
  );

  return {
    html: replaced,
    missingComponentIds: [...missingComponents],
    missingStyleIds: [...missingStyles],
    replacedComponentIds,
    replacedStyleIds,
  };
}

export function prepareReusableCaches(
  html: string,
  options: {
    nextComponentId: number;
    nextStyleId: number;
    componentIdPrefix?: string;
    styleIdPrefix?: string;
  }
): ReusableCachePreparationResult {
  const {
    nextComponentId,
    nextStyleId,
    componentIdPrefix = "sl-gen-",
    styleIdPrefix = "sl-style-",
  } = options;

  const document = parse(html, {
    lowerCaseTagName: false,
    comment: true,
  });

  const doctypeMatch = html.match(/^<!DOCTYPE[^>]*>/i);
  const doctype = doctypeMatch ? doctypeMatch[0] : "";

  let componentCounter = Math.max(1, nextComponentId);
  let styleCounter = Math.max(1, nextStyleId);

  const componentCache: Record<string, string> = {};
  const styleCache: Record<string, string> = {};

  const htmlElement = document.querySelector("html") as HTMLElement | null;
  const head = document.querySelector("head") as HTMLElement | null;
  const body = document.querySelector("body") as HTMLElement | null;

  const ensureComponentId = (element: HTMLElement): string => {
    let dataId = element.getAttribute("data-id");
    if (!dataId) {
      dataId = `${componentIdPrefix}${componentCounter}`;
      componentCounter += 1;
      element.setAttribute("data-id", dataId);
    }
    return dataId;
  };

  if (head) {
    const styleElements = head.childNodes.filter(
      (node): node is HTMLElement =>
        node.nodeType === 1 && node.rawTagName?.toLowerCase() === "style"
    );

    for (const styleElement of styleElements) {
      let styleId = styleElement.getAttribute(STYLE_DATA_ATTR);
      if (!styleId) {
        styleId = `${styleIdPrefix}${styleCounter}`;
        styleCounter += 1;
        styleElement.setAttribute(STYLE_DATA_ATTR, styleId);
      }
      styleCache[styleId] = styleElement.toString();
    }
  }

  const structuralChildren: HTMLElement[] = [];
  if (body) {
    const children = body.childNodes.filter(
      (node): node is HTMLElement => node.nodeType === 1
    );

    for (const element of children) {
      const tagName = element.rawTagName?.toLowerCase();
      if (!tagName || !STRUCTURAL_COMPONENT_TAGS.has(tagName)) {
        continue;
      }
      structuralChildren.push(element);
    }
  }

  const scriptElements = document.querySelectorAll("script") as HTMLElement[];

  for (const element of structuralChildren) {
    ensureComponentId(element);
  }
  for (const scriptElement of scriptElements) {
    ensureComponentId(scriptElement);
  }
  if (body) {
    ensureComponentId(body);
  }
  if (head) {
    ensureComponentId(head);
  }
  if (htmlElement) {
    ensureComponentId(htmlElement);
  }

  if (head) {
    const headId = head.getAttribute("data-id");
    if (headId) {
      componentCache[headId] = head.toString();
    }
  }

  for (const element of structuralChildren) {
    const id = element.getAttribute("data-id");
    if (id) {
      componentCache[id] = element.toString();
    }
  }

  if (body) {
    const bodyId = body.getAttribute("data-id");
    if (bodyId) {
      componentCache[bodyId] = body.toString();
    }
  }

  if (htmlElement) {
    const htmlId = htmlElement.getAttribute("data-id");
    if (htmlId) {
      componentCache[htmlId] = htmlElement.toString();
    }
  }

  for (const scriptElement of scriptElements) {
    const scriptId = scriptElement.getAttribute("data-id");
    if (scriptId) {
      componentCache[scriptId] = scriptElement.toString();
    }
  }

  const serialized = document.toString();
  const htmlWithDoctype = ensureDoctype(serialized, doctype);

  return {
    html: htmlWithDoctype,
    componentCache,
    styleCache,
    nextComponentId: componentCounter,
    nextStyleId: styleCounter,
  };
}

function ensureDoctype(html: string, fallbackDoctype: string): string {
  if (startsWithDoctype(html)) {
    return html;
  }
  return `${fallbackDoctype}${html}`;
}

function startsWithDoctype(input: string): boolean {
  return /^<!DOCTYPE/i.test(input.trimStart());
}
