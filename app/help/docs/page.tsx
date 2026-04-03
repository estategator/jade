import { Navbar } from "@/app/components/navbar";
import { Footer } from "@/app/components/footer";
import { DocsPageContent } from "@/app/components/help-docs-content";

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-stone-50 dark:bg-zinc-950 font-sans selection:bg-stone-200 dark:selection:bg-zinc-800 font-body">
      <Navbar />
      <main>
        <DocsPageContent basePath="/help" />
      </main>
      <Footer />
    </div>
  );
}
