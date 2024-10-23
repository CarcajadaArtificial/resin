/**
 * Core functions for processing and extracting nested CSS styles.
 * Provides utilities to manipulate CSS templates and selectors,
 * and to generate normalized CSS outputs.
 */

import { arrayDiallel, groupArrayItems, uniqueArrayItems } from "./helpers.ts";

/**
 * Processes a CSS template string, interpolating values and handling class names.
 * @param template - The template strings array.
 * @param values - The interpolated values, which can be strings, numbers, objects with sourceCssText, or booleans.
 * @param classNameToSourceCssTextMap - Optional mapping of class names to their source CSS text.
 * @returns A processed CSS string.
 */
export function extractCssTemplate(
  template: TemplateStringsArray,
  values: (string | number | { sourceCssText: string } | boolean)[],
  classNameToSourceCssTextMap?: Record<string, string>,
): string {
  let text = "";
  let i = 0;
  for (i = 0; i < values.length; i++) {
    text += template[i];
    const value = values[i];
    if (typeof value === "string" && classNameToSourceCssTextMap?.[value]) {
      text += classNameToSourceCssTextMap[value];
    } else if (
      value === false ||
      value === null ||
      value === undefined ||
      value === ""
    ) {
      // Skip falsy values.
    } else {
      text += value.toString();
    }
  }
  text += template[i];
  return (
    text
      // Remove newlines.
      .replace(/\s*\r?\n\s*/g, "")
      // Remove spaces around certain characters.
      .replace(/\s*([:{;~,])\s*/g, (_, p1) => p1)
      // Remove double semicolons.
      .replace(/;;/g, ";")
  );
}

/**
 * Transforms CSS body text into normalized lines for further processing.
 * Removes comments, unnecessary spaces, and splits into individual lines.
 * @param cssBodyText - The raw CSS body text.
 * @returns An array of normalized CSS lines.
 */
function transformCssBodyTextToNormalizedLines(cssBodyText: string) {
  return (
    cssBodyText
      // Remove comments.
      .replace(/\/\*.*?\*\//g, "")
      .replace(/\/\/.*\r?\n/g, "")
      // Remove spaces around certain characters.
      .replace(/\s*([:{;~,])\s*/g, (_, p1) => p1)
      .replace(/&\s+\./g, "&.")
      // Normalize newlines.
      .replace(/\r?\n/g, "")
      .replace(/[;{}]/g, (m) => `${m}\n`)
      // Split into lines.
      .split("\n")
      .map((a) => a.trim())
      .filter((a) => !!a)
  );
}

/**
 * Concatenates a CSS selector path with a segment, handling special cases like '&'.
 * @param path - The base CSS selector path.
 * @param seg - The segment to concatenate.
 * @returns The concatenated CSS selector path.
 */
export function concatPathSegment(path: string, seg: string) {
  if (seg.includes("&")) {
    return seg.replace(/&/g, path).trim();
  }
  if (path.match(/\w$/) && seg.match(/^[a-zA-Z.#*\[:]/)) {
    return `${path} ${seg}`;
  } else {
    return `${path}${seg}`;
  }
}

/**
 * Extends concatPathSegment to handle multiple paths and segments, generating combinations.
 * @param srcPath - The source selector paths, possibly comma-separated.
 * @param inputSeg - The input segments to concatenate, possibly comma-separated.
 * @returns A string of concatenated selector paths.
 */
export function concatPathSegmentEx(srcPath: string, inputSeg: string) {
  const srcPaths = srcPath.split(",");
  const inputSegs = inputSeg.split(",");
  return arrayDiallel(srcPaths, inputSegs)
    .map((z) => concatPathSegment(z[0], z[1]))
    .join(",");
}

/**
 * Combines multiple CSS selector paths into a single path.
 * @param selectorPaths - An array of selector paths to combine.
 * @returns The combined selector path.
 */
export function combineSelectorPaths(selectorPaths: string[]) {
  if (selectorPaths.length >= 2) {
    const head = selectorPaths[0];
    const tails = selectorPaths.slice(1);
    return tails.reduce(concatPathSegmentEx, head);
  } else {
    return selectorPaths[0];
  }
}

/**
 * Combines multiple media query specifications into a single media query.
 * @param mediaQuerySpecs - An array of media query strings.
 * @returns A combined media query string.
 */
export function combineMediaQueries(mediaQuerySpecs: string[]): string {
  if (mediaQuerySpecs.length == 0) {
    return "";
  }
  const srcParts = mediaQuerySpecs
    .map((mq) =>
      mq
        .replace(/^(@media|@container)\s/, "")
        .split("and")
        .map((it) => it.trim())
    )
    .flat();
  const parts = uniqueArrayItems(srcParts);
  const head = mediaQuerySpecs[0].split(" ")[0];
  return `${head} ${parts.join(" and ")}`;
}

/**
 * Represents a slot for CSS rules, including selector paths, group rules, and CSS lines.
 */
type CssSlot = {
  selectorPath: string;
  groupRuleSpec: string;
  cssLines: string[];
};

/**
 * Prepares a CSS slot by combining narrowers (selectors and media queries) and updating the cssSlots map.
 * @param narrowers - An array of selectors and media queries.
 * @param cssSlots - The map of existing CSS slots.
 * @returns The key of the prepared CSS slot.
 */
function prepareCssSlot(
  narrowers: string[],
  cssSlots: Record<string, CssSlot>,
) {
  let selectorPath: string;
  let groupRuleSpec: string;

  const pathPartsKeyframeIndex = narrowers.findIndex((it) =>
    it.startsWith("@keyframes")
  );
  if (pathPartsKeyframeIndex >= 0) {
    groupRuleSpec = narrowers[pathPartsKeyframeIndex];
    const pathParts = narrowers.slice(pathPartsKeyframeIndex + 1);
    selectorPath = combineSelectorPaths(pathParts);
  } else {
    const pathParts = narrowers.filter((it) =>
      !it.match(/^(@media|@container)/)
    );
    const mediaQueryParts = narrowers.filter((it) =>
      it.match(/^(@media|@container)/)
    );
    selectorPath = combineSelectorPaths(pathParts);
    groupRuleSpec = combineMediaQueries(mediaQueryParts);
  }

  const slotKey = `${groupRuleSpec}${selectorPath}`;
  if (!cssSlots[slotKey]) {
    cssSlots[slotKey] = {
      selectorPath,
      groupRuleSpec,
      cssLines: [],
    };
  }
  return slotKey;
}

/**
 * Converts an array of CSS slots into a formatted CSS string.
 * @param slots - An array of CSS slots to stringify.
 * @returns A formatted CSS string representing the slots.
 */
function stringifyCssSlots(slots: CssSlot[]) {
  const { groupRuleSpec } = slots[0];
  const cssContentLines = slots.map(
    (slot) => `${slot.selectorPath}{${slot.cssLines.join(" ")}}`,
  );
  if (groupRuleSpec) {
    const cssContents = cssContentLines.map((line) => `  ${line}`).join("\n");
    return `${groupRuleSpec}{\n${cssContents}\n}`;
  } else {
    return cssContentLines.join("\n");
  }
}

/**
 * Collects unique keyframe names from an array of CSS slots.
 * @param slots - An array of CSS slots to process.
 * @returns An array of unique keyframe names.
 */
function collectKeyframeNames(slots: CssSlot[]): string[] {
  return uniqueArrayItems(
    slots.filter((slot) => slot.groupRuleSpec.startsWith("@keyframes"))
      .map((slot) => slot.groupRuleSpec.match(/^@keyframes ([\w-]+)/)?.[1])
      .filter((it) => !!it) as string[],
  );
}

/**
 * Extracts nested CSS from a given CSS body text, starting from a top-level selector.
 * Processes nested rules, media queries, and keyframes, and normalizes selectors.
 * @param cssBodyText - The raw CSS body text to process.
 * @param topSelector - The top-level selector to scope the CSS under.
 * @returns The processed, flattened CSS text.
 */
export function extractNestedCss(
  cssBodyText: string,
  topSelector: string,
): string {
  const srcLines = transformCssBodyTextToNormalizedLines(cssBodyText);

  const cssSlots: Record<string, CssSlot> = {};
  const narrowers: string[] = [topSelector];
  let slotKey = prepareCssSlot(narrowers, cssSlots);

  for (const line of srcLines) {
    if (line.endsWith("{")) {
      const selector = line.slice(0, line.length - 1);
      narrowers.push(selector);
      slotKey = prepareCssSlot(narrowers, cssSlots);
    } else if (line.endsWith("}")) {
      narrowers.pop();
      slotKey = prepareCssSlot(narrowers, cssSlots);
    } else {
      cssSlots[slotKey].cssLines.push(line);
    }
  }
  for (const key in cssSlots) {
    if (cssSlots[key].cssLines.length == 0) {
      delete cssSlots[key];
    }
  }

  const listSlots = Object.values(cssSlots);
  const slotsGroupedByConditionalGroupRule = groupArrayItems(
    listSlots,
    (slot) => slot.groupRuleSpec,
  );

  let cssText = [
    ...Object.values(slotsGroupedByConditionalGroupRule).map(stringifyCssSlots),
  ].join("\n");

  const keyframeNames = collectKeyframeNames(listSlots);
  const topClassName = topSelector.slice(1);
  for (const keyframeName of keyframeNames) {
    cssText = cssText.replaceAll(
      keyframeName,
      `${topClassName}_${keyframeName}`,
    );
  }

  return cssText;
}
