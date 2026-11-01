import type { TermsDocument, TermsLocale } from "@edaya/account";
import type { DefaultTreeAdapterTypes } from "parse5";
import { createHash } from "node:crypto";
import { parse, parseFragment } from "parse5";

type Node = DefaultTreeAdapterTypes.Node;
type Element = DefaultTreeAdapterTypes.Element;
const blocks = new Set(["h1", "h2", "h3", "h4", "p", "ul", "ol", "li", "blockquote"]);
const inline = new Set(["strong", "em", "b", "i", "u", "s", "a", "br"]);
const omitted = new Set(["script", "style", "template", "noscript", "svg", "math", "iframe", "object", "embed", "form", "input", "button", "nav", "header", "footer"]);
const escapeHtml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\"", "&quot;");
const children = (node: Node): Node[] => "childNodes" in node ? node.childNodes : [];
const attribute = (node: Element, name: string) => node.attrs.find(attr => attr.name === name)?.value;
const hasClass = (node: Element, value: string) => attribute(node, "class")?.split(/\s+/).includes(value);
const normalizeText = (value: string) => value.normalize("NFC").replace(/\s+/g, " ");

function find(node: Node, predicate: (element: Element) => boolean): Element | undefined {
  if ("tagName" in node && predicate(node))
    return node;
  for (const child of children(node)) {
    const found = find(child, predicate);
    if (found)
      return found;
  }
}

function safeLink(value: string | undefined, sourceUrl: string): string | undefined {
  if (!value)
    return undefined;
  try {
    const url = new URL(value, sourceUrl);
    if (["https:", "http:", "mailto:"].includes(url.protocol) && !url.username && !url.password)
      return url.href;
  }
  catch { /* Invalid links retain their visible text. */ }
}

/** Render a small allowlist from a parsed tree; never copy source attributes or markup. */
function render(node: Node, sourceUrl: string): string {
  if (node.nodeName === "#text" && "value" in node)
    return escapeHtml(normalizeText(node.value));
  if (!("tagName" in node))
    return "";
  if (node.namespaceURI !== "http://www.w3.org/1999/xhtml" || omitted.has(node.tagName) || hasClass(node, "legal-back"))
    return "";
  const content = children(node).map(child => render(child, sourceUrl)).join("");
  if (node.tagName === "br")
    return "<br>";
  if (!blocks.has(node.tagName) && !inline.has(node.tagName))
    return content;
  const href = node.tagName === "a" ? safeLink(attribute(node, "href"), sourceUrl) : undefined;
  if (node.tagName === "a" && !href)
    return content;
  const attrs = href ? ` href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer"` : "";
  const block = blocks.has(node.tagName);
  return `${block ? "\n" : ""}<${node.tagName}${attrs}>${block ? content.trim() : content}</${node.tagName}>${block ? "\n" : ""}`;
}

function plainText(node: Node): string {
  if (node.nodeName === "#text" && "value" in node)
    return node.value;
  const text = children(node).map(plainText).join("");
  if ("tagName" in node && node.tagName === "br")
    return " ";
  if ("tagName" in node && node.tagName === "a") {
    const href = attribute(node, "href");
    return href && text.trim() !== href && text.trim() !== href.replace(/^mailto:/, "") ? `${text} (${href})` : text;
  }
  return text;
}

export type LiveTermsContent = Omit<TermsDocument, "version">;

export function extractTermsContent(source: string, locale: TermsLocale, sourceUrl: string): LiveTermsContent {
  const page = parse(source, { sourceCodeLocationInfo: true });
  const root = find(page, node => node.tagName === "html");
  const language = root && attribute(root, "lang");
  if (language && language.toLowerCase().split("-")[0] !== locale)
    throw new Error("Incorrect legal document language");
  const main = find(page, node => node.tagName === "main" && !!hasClass(node, "legal"));
  // The HTML parser repairs truncated input; never publish a partially received agreement.
  if (!main?.sourceCodeLocation?.endTag)
    throw new Error("Missing legal document");
  const html = render(main, sourceUrl).replace(/ *\n\s*/g, "\n").trim();
  const fragment = parseFragment(html);
  const heading = find(fragment, node => node.tagName === "h1");
  const title = heading ? normalizeText(plainText(heading)).trim() : "";
  const sections: TermsDocument["sections"] = [];
  let current = { heading: title, paragraphs: [] as string[] };
  function visit(node: Node) {
    if ("tagName" in node) {
      if (/^h[1-4]$/.test(node.tagName)) {
        if (current.paragraphs.length)
          sections.push(current);
        current = { heading: normalizeText(plainText(node)).trim(), paragraphs: [] };
        return;
      }
      if (["p", "li", "blockquote"].includes(node.tagName)) {
        const text = normalizeText(plainText(node)).trim();
        if (text)
          current.paragraphs.push(text);
        return;
      }
    }
    children(node).forEach(visit);
  }
  visit(fragment);
  if (current.paragraphs.length)
    sections.push(current);
  if (!title || !sections.length || !find(fragment, node => node.tagName === "h2"))
    throw new Error("Incomplete legal document");
  // Preserve block structure and link destinations; typographic emphasis is display-only.
  const legalContent = html.replace(/<\/?(?:strong|em|[biu])>/g, "").replace(/ +/g, " ");
  const documentHash = createHash("sha256").update(JSON.stringify({ locale, legalContent })).digest("hex");
  return { locale, title, status: "published", sections, sourceUrl, html, documentHash };
}
