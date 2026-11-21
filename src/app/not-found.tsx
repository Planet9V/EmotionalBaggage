import { NotFoundPanel } from "@/components/NotFoundPanel";

export const metadata = { title: "Page not found" };

/** Every unknown address: a section, a guide or a page that does not exist. Inside the shell, with a way on. */
export default function NotFound() {
  return <NotFoundPanel />;
}
