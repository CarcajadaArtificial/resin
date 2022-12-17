//----------

import { arrayDiallel, groupArrayItems, uniqueArrayItems } from "./helpers.ts";

function transformCssBodyTextToNormalizedLines(cssBodyText: string) {
  return (
    cssBodyText
      //remove comments
      .replace(/\/\*.*\*\//g, "")
      .replace(/\/\/.*\r?\n/g, "")
      //remove spaces
      .replace(/\s*([:{\.;>+~,])\s*/g, (_, p1) => p1)
      //normalize newlines
      .replace(/\r?\n/g, "")
      .replace(/[;{}]/g, (m) => `${m}\n`)
      //split lines
      .split("\n")
      .map((a) => a.trim())
      .filter((a) => !!a)
  );
}

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

export function concatPathSegmentEx(srcPath: string, inputSeg: string) {
  const srcPaths = srcPath.split(",");
  const inputSegs = inputSeg.split(",");
  return arrayDiallel(srcPaths, inputSegs)
    .map((z) => concatPathSegment(z[0], z[1]))
    .join(",");
}

export function combineSelectorPaths(selectorPaths: string[]) {
  if (selectorPaths.length >= 2) {
    const head = selectorPaths[0];
    const tails = selectorPaths.slice(1);
    return tails.reduce(concatPathSegmentEx, head);
  } else {
    return selectorPaths[0];
  }
}

export function combineMediaQueries(mediaQuerySpecs: string[]): string {
  if (mediaQuerySpecs.length == 0) {
    return "";
  }
  const srcParts = mediaQuerySpecs
    .map((mq) =>
      mq
        .replace(/^@media\s/, "")
        .split("and")
        .map((it) => it.trim())
    )
    .flat();
  const parts = uniqueArrayItems(srcParts);
  return `@media ${parts.join(" and ")}`;
}

type CssSlot = {
  selectorPath: string;
  mediaQuerySpec: string;
  cssLines: string[];
};

function prepareCssSlot(
  narrowers: string[],
  cssSlots: Record<string, CssSlot>
) {
  const pathParts = narrowers.filter((it) => !it.startsWith("@media"));
  const mediaQueryParts = narrowers.filter((it) => it.startsWith("@media"));
  const selectorPath = combineSelectorPaths(pathParts);
  const mediaQuerySpec = combineMediaQueries(mediaQueryParts);
  const slotKey = `${mediaQuerySpec}${selectorPath}`;
  if (!cssSlots[slotKey]) {
    cssSlots[slotKey] = {
      selectorPath,
      mediaQuerySpec,
      cssLines: [],
    };
  }
  return slotKey;
}

function stringifyCssSlots(slots: CssSlot[]) {
  const { mediaQuerySpec } = slots[0];
  const cssContentLines = slots.map(
    (slot) => `${slot.selectorPath}{${slot.cssLines.join(" ")}}`
  );
  if (mediaQuerySpec) {
    const cssContents = cssContentLines.map((line) => `  ${line}`).join("\n");
    return `${mediaQuerySpec}{\n${cssContents}\n}`;
  } else {
    return cssContentLines.join("\n");
  }
}

export function extractNestedCss(
  cssBodyText: string,
  topSelector: string
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
  const slotsGroupedByMediaQuery = groupArrayItems(
    Object.values(cssSlots),
    (slot) => slot.mediaQuerySpec
  );
  return Object.values(slotsGroupedByMediaQuery)
    .map(stringifyCssSlots)
    .join("\n");
}
