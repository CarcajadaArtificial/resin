/**
 * Resin CSS module for styling components using CSS-in-JS with Preact.
 * Provides utilities for defining CSS styles, attaching them to components,
 * and managing styles in both server-side rendering and browser environments.
 */

import { FunctionComponent, h, JSX } from "preact";
import { crc32 } from "./helpers.ts";
import { extractCssTemplate, extractNestedCss } from "./resin_css_core.ts";

//----------

// For Preact, use 'h' to create elements and 'class' as the className key.
const jsxCreateElementFunction = h;
const classNameKey = "class";
type FC<T> = FunctionComponent<T>;

//----------

type JSXElement = JSX.Element;
type JSXIntrinsicElements = JSX.IntrinsicElements;

/**
 * Type alias for class names used in the module.
 */
type T_ClassName = string;

/**
 * Represents a CSS block with associated class name and CSS text.
 */
type CssBall = {
  className: string;
  sourceCssText: string;
  cssText: string;
};

//----------
// Stateless helpers

/**
 * Indicates whether the code is running in a browser environment.
 */
const IS_BROWSER = typeof document !== "undefined";

/**
 * Adds a CSS class to a JSX element's properties.
 * @param vdom - The JSX element.
 * @param className - The CSS class name to add.
 * @returns A new JSX element with the class name added.
 */
function addClassToVdom(vdom: JSXElement, className: string): JSXElement {
  const originalClass = vdom.props[classNameKey];
  return {
    ...vdom,
    props: {
      ...vdom.props,
      [classNameKey]: originalClass
        ? `${className} ${originalClass}`
        : className,
    },
  };
}

//----------
// Common module state

/**
 * Common local state shared across the module.
 * Stores CSS blocks and mapping of class names to source CSS text.
 */
const moduleLocalStateCommon = {
  cssBalls: [] as CssBall[],
  classNameToSourceCssTextMap: {} as Record<string, string>,
};

/**
 * Creates a CSS block (CssBall) from source CSS text, caching it if already created.
 * Generates a unique class name based on the CRC32 hash of the CSS text.
 * @param sourceCssText - The source CSS text.
 * @returns The generated class name.
 */
function createCssBallCached(sourceCssText: string): T_ClassName {
  const { cssBalls, classNameToSourceCssTextMap } = moduleLocalStateCommon;
  let cssBall = cssBalls.find((ball) => ball.sourceCssText === sourceCssText);
  if (!cssBall) {
    const inputCssTextMod = sourceCssText.replace(/,\r?\n/g, ",");
    const className = `cs_${crc32(inputCssTextMod)}`;
    const cssText = extractNestedCss(inputCssTextMod, `.${className}`);
    cssBall = { className, sourceCssText, cssText };
    cssBalls.push(cssBall);
    classNameToSourceCssTextMap[className] = sourceCssText;
    emitCssBallToDom(cssBall);
  }
  return cssBall.className;
}

/**
 * Emits the CSS block to the DOM, handling both SSR and browser environments.
 * @param cssBall - The CSS block to emit.
 */
function emitCssBallToDom(cssBall: CssBall) {
  const { className, cssText } = cssBall;
  if (!IS_BROWSER) {
    pushCssTextToEmitterForSsr(className, cssText);
  } else {
    pushCssTextToEmitterForBrowser(className, cssText);
  }
}

//----------
// Server-Side Rendering (SSR)

/**
 * Local state for server-side rendering.
 * Stores CSS texts for the page.
 */
const moduleLocalStateForSsr = {
  pageCssTexts: {} as Record<T_ClassName, string>,
};

/**
 * Adds the CSS text to the emitter for server-side rendering.
 * @param className - The class name associated with the CSS text.
 * @param cssText - The CSS text to emit.
 */
function pushCssTextToEmitterForSsr(className: string, cssText: string) {
  const { pageCssTexts } = moduleLocalStateForSsr;
  if (!pageCssTexts[className]) {
    pageCssTexts[className] = cssText;
  }
}

/**
 * Retrieves the full CSS text for the page during server-side rendering.
 * @returns The concatenated CSS text for all emitted CSS blocks.
 */
function getPageCssFullTextForSsr() {
  return Object.values(moduleLocalStateForSsr.pageCssTexts).join("\n") + "\n";
}

//----------
// Browser environment

/**
 * Local state for the browser environment.
 * Keeps track of class names that have been injected into the page.
 */
const moduleLocalStateForBrowser = {
  pageCssClassNames: undefined as Set<string> | undefined,
};

/**
 * Retrieves the DOM element where the page's CSS is injected.
 * @returns The HTML element for the CSS.
 */
function getReginCssPageTagNode(): HTMLElement {
  const el = document.getElementById("resin-css-page-css-tag")!;
  if (!el) {
    throw new Error(`page css tag not found for resin-css`);
  }
  return el;
}

/**
 * Injects the CSS text into the DOM during browser rendering.
 * Ensures that the same CSS is not injected multiple times.
 * @param className - The class name associated with the CSS text.
 * @param cssText - The CSS text to inject.
 */
function pushCssTextToEmitterForBrowser(className: string, cssText: string) {
  const sb = moduleLocalStateForBrowser;
  if (!sb.pageCssClassNames) {
    sb.pageCssClassNames = new Set();
    const el = getReginCssPageTagNode();
    const matches = el.innerHTML.match(/cs_[0-9a-f]{8}/g);
    if (matches) {
      for (const m of matches) {
        sb.pageCssClassNames.add(m);
      }
    }
  }
  if (!sb.pageCssClassNames.has(className)) {
    const el = getReginCssPageTagNode();
    el.innerHTML += cssText;
    sb.pageCssClassNames.add(className);
  }
}

//----------
// Entry functions

/**
 * Main function to define CSS styles.
 * Processes a CSS template and returns a generated class name.
 * @param template - The template strings array.
 * @param templateParameters - The interpolated values in the template.
 * @returns The generated class name for the CSS.
 */
export function css(
  template: TemplateStringsArray,
  ...templateParameters: (string | number | CssBall | boolean)[]
): T_ClassName {
  const { classNameToSourceCssTextMap } = moduleLocalStateCommon;
  const inputCssText = extractCssTemplate(
    template,
    templateParameters,
    classNameToSourceCssTextMap,
  );
  return createCssBallCached(inputCssText);
}

/**
 * Retrieves the CSS block associated with a given class name.
 * @param className - The class name to look up.
 * @returns The corresponding CssBall, or undefined if not found.
 */
export function getCssBallFromClassName(
  className: string,
): CssBall | undefined {
  const { cssBalls } = moduleLocalStateCommon;
  return cssBalls.find((ball) => ball.className === className);
}

/**
 * Adds a CSS class to a JSX element, effectively styling it.
 * @param vdom - The JSX element to style.
 * @param className - The CSS class name to add.
 * @returns A new JSX element with the class name added.
 */
export function domStyled(vdom: JSXElement, className: string): JSXElement {
  return addClassToVdom(vdom, className);
}

/**
 * React component that emits the collected CSS styles into the page.
 * Used for server-side rendering to inject styles into the HTML.
 */
export const ResinCssEmitter: FunctionComponent = () => {
  const pageCssFullText = !IS_BROWSER ? getPageCssFullTextForSsr() : "";
  return jsxCreateElementFunction(
    "style",
    {
      id: "resin-css-page-css-tag",
      dangerouslySetInnerHTML: { __html: pageCssFullText },
    },
  );
};

/**
 * React component that injects global CSS styles into the page.
 * Used to apply global styles defined using the css() function.
 * @param css - The class name associated with the global CSS styles.
 */
export const ResinCssGlobalStyle: FunctionComponent<{ css: T_ClassName }> = ({
  css: className,
}) => {
  const ball = getCssBallFromClassName(className);
  if (!ball) {
    return null;
  }
  const { cssText } = ball;
  const cssOutputText = cssText.replace(new RegExp(`.${className}`, "g"), "");
  return jsxCreateElementFunction("style", {
    dangerouslySetInnerHTML: { __html: cssOutputText },
  });
};

/**
 * Utility function to concatenate class names, filtering out falsy values.
 * @param args - Class names or falsy values.
 * @returns A concatenated string of class names.
 */
export function cx(...args: (string | null | undefined | false)[]) {
  return args.filter((a) => !!a).join(" ");
}

/**
 * Additional properties for components created with createFCX.
 * Supports conditional rendering and additional class names.
 */
type IComponentExtraProps = {
  if?: boolean | undefined;
  class?: string | false;
};

/**
 * Creates a function component with extended properties and optional attached CSS class.
 * Allows conditional rendering and additional class names.
 * @param baseFC - The base function component.
 * @param attachedCssClassName - An optional CSS class name to attach.
 * @returns A new function component with extended properties.
 */
// deno-lint-ignore ban-types
export function createFCX<T extends {}>(
  baseFC: FunctionComponent<T>,
  attachedCssClassName?: string,
): FunctionComponent<T & IComponentExtraProps> {
  return (props: T & IComponentExtraProps) => {
    const { if: propIf = true, class: propClassName, ...baseProps } = props;
    if (!propIf) {
      return null;
    }
    const vdom = baseFC(baseProps as T) as JSXElement;
    const className = cx(propClassName, attachedCssClassName);
    return className ? addClassToVdom(vdom, className) : vdom;
  };
}

/**
 * Styled components factory that creates components with attached CSS styles.
 * Supports all intrinsic JSX elements.
 */
export const styled: {
  [K in keyof JSXIntrinsicElements]: (
    ...args: Parameters<typeof css>
  ) => FC<JSXIntrinsicElements[K]>;
} = new Proxy(
  {},
  {
    get<K extends keyof JSXIntrinsicElements>(_target: unknown, tagName: K) {
      return (...args: Parameters<typeof css>) => {
        const attachedCssClassName = css(...args);
        return (props: JSXIntrinsicElements[K]) => {
          const modProps = {
            ...props,
            [classNameKey]: cx(
              props[classNameKey] as string,
              attachedCssClassName,
            ),
          };
          // deno-lint-ignore no-explicit-any
          return jsxCreateElementFunction(tagName as any, modProps);
        };
      };
    },
  },
  // deno-lint-ignore no-explicit-any
) as any;
