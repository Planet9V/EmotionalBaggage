import Link from "next/link";
import { notFound } from "next/navigation";
import { DocBody } from "@/components/docs/DocBody";
import { DOC_PAGES, findDoc, readDoc } from "@/lib/docs";

export const dynamicParams = false;
export const generateStaticParams = () => DOC_PAGES.map((d) => ({ slug: d.slug }));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  return { title: findDoc((await params).slug)?.title ?? "Documentation" };
}

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const doc = findDoc((await params).slug);
  if (!doc) notFound();
  return (
    <div className="px-8 py-8">
      <nav aria-label="Guides" className="mb-8 flex flex-wrap gap-2 text-sm">
        <Link href="/docs" className="rounded-full border border-hairline px-3 py-1 text-secondary hover:text-primary">All guides</Link>
        {DOC_PAGES.map((d) => (
          <Link
            key={d.slug}
            href={`/docs/${d.slug}`}
            aria-current={d.slug === doc.slug ? "page" : undefined}
            className={
              d.slug === doc.slug
                ? "rounded-full border border-dutchOrange/40 bg-dutchOrange/10 px-3 py-1 font-medium text-dutchOrange"
                : "rounded-full border border-hairline px-3 py-1 text-secondary hover:text-primary"
            }
          >
            {d.title}
          </Link>
        ))}
      </nav>
      <DocBody markdown={readDoc(doc.slug)} />
    </div>
  );
}
