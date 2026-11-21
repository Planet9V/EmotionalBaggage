import { PreviewFrame } from "@/components/content/PreviewFrame";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PreviewFrame id={id} />;
}
