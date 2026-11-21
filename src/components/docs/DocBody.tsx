import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Mermaid } from "./Mermaid";
import { slugify } from "@/lib/format";

/** A heading's anchor: the shared slug with no length limit. */
const slug = (children: React.ReactNode) => slugify(String(children), { max: Infinity });

const components: Components = {
  h1: ({ children }) => <h1 className="text-3xl font-semibold tracking-tight text-primary">{children}</h1>,
  h2: ({ children }) => <h2 id={slug(children)} className="mt-10 scroll-mt-6 border-t border-hairline pt-6 text-xl font-semibold tracking-tight text-primary">{children}</h2>,
  h3: ({ children }) => <h3 id={slug(children)} className="mt-6 scroll-mt-6 text-base font-semibold text-primary">{children}</h3>,
  p: ({ children }) => <p className="mt-3 text-sm leading-relaxed text-secondary">{children}</p>,
  ul: ({ children }) => <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-secondary">{children}</ul>,
  ol: ({ children }) => <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-secondary">{children}</ol>,
  strong: ({ children }) => <strong className="font-semibold text-primary">{children}</strong>,
  a: ({ href, children }) => <a href={href} className="text-link underline underline-offset-2">{children}</a>,
  blockquote: ({ children }) => <blockquote className="mt-4 rounded-xl border border-dutchOrange/30 bg-dutchOrange/10 px-4 py-1 [&_p]:text-primary">{children}</blockquote>,
  table: ({ children }) => (
    <div tabIndex={0} role="region" aria-label="Table, scrolls sideways" className="mt-4 overflow-x-auto rounded-xl border border-hairline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange">
      <table className="w-full text-left text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-subtle text-xs text-muted">{children}</thead>,
  th: ({ children }) => <th className="px-3 py-2 font-medium">{children}</th>,
  td: ({ children }) => <td className="border-t border-hairline px-3 py-2 align-top text-secondary">{children}</td>,
  pre: ({ children }) => <>{children}</>,
  code: ({ className, children }) => {
    const text = String(children).replace(/\n$/, "");
    if (className === "language-mermaid") return <Mermaid chart={text} />;
    if (className || text.includes("\n")) {
      return <pre tabIndex={0} className="mt-3 overflow-x-auto focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange rounded-xl border border-hairline bg-subtle p-4 font-mono text-xs leading-relaxed text-primary"><code>{text}</code></pre>;
    }
    return <code className="rounded-sm bg-subtle px-1 py-0.5 font-mono text-[0.85em] text-primary">{text}</code>;
  },
};

/**
 * The same Markdown renderer with some elements styled for another page (the concept story reads at a larger
 * size). One renderer for the whole app: react-markdown with GitHub tables, lists and links.
 */
export function Markdown({ markdown, overrides }: { markdown: string; overrides?: Components }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={overrides ? { ...components, ...overrides } : components}>
      {markdown}
    </ReactMarkdown>
  );
}

export function DocBody({ markdown }: { markdown: string }) {
  return (
    <article className="max-w-3xl">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {markdown}
      </ReactMarkdown>
    </article>
  );
}
