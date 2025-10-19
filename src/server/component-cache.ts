import { parse, HTMLElement } from "node-html-parser";

const COMPONENT_TAGS = new Set([
  "header",
  "footer",
  "nav",
  "main",
  "aside",
  "section",
  "div",
]);

const COMPONENT_PLACEHOLDER_PATTERN = /\{\{component:([a-zA-Z0-9_-]+)\}\}/g;

export interface ComponentPlaceholderResult {
  html: string;
  missing: string[];
}

export interface ComponentCachePreparationResult {
  html: string;
  cache: Record<string, string>;
  nextComponentId: number;
}

export function applyComponentPlaceholders(
  html: string,
  cache: Record<string, string>
): ComponentPlaceholderResult {
  const missing = new Set<string>();
  const replaced = html.replace(
    COMPONENT_PLACEHOLDER_PATTERN,
    (_match, id: string) => {
      const cached = cache[id];
      if (typeof cached === "string") {
        return cached;
      }
      missing.add(id);
      return "";
    }
  );
  return { html: replaced, missing: [...missing] };
}

export function prepareComponentCache(
  html: string,
  options: {
    nextComponentId: number;
    idPrefix?: string;
  }
): ComponentCachePreparationResult {
  const { nextComponentId, idPrefix = "sl-gen-" } = options;
  const document = parse(html, {
    lowerCaseTagName: false,
    comment: true,
    blockTextElements: {
      script: false,
      noscript: false,
      style: false,
      pre: false,
    },
  });

  const doctypeMatch = html.match(/^<!DOCTYPE[^>]*>/i);
  const doctype = doctypeMatch ? doctypeMatch[0] : "";

  let counter = Math.max(1, nextComponentId);
  const cache: Record<string, string> = {};
  const body = document.querySelector("body");

  if (!body) {
    return {
      html: `${doctype}${document.toString()}`,
      cache,
      nextComponentId: counter,
    };
  }

  const children = body.childNodes.filter(
    (node): node is HTMLElement => node.nodeType === 1
  );

  for (const element of children) {
    const tagName = element.rawTagName?.toLowerCase();
    if (!tagName || !COMPONENT_TAGS.has(tagName)) {
      continue;
    }

    let dataId = element.getAttribute("data-id");
    if (!dataId) {
      dataId = `${idPrefix}${counter}`;
      counter += 1;
      element.setAttribute("data-id", dataId);
    }
    cache[dataId] = element.toString();
  }

  return {
    html: `${doctype}${document.toString()}`,
    cache,
    nextComponentId: counter,
  };
}
