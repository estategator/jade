import { Navbar } from "@/app/components/navbar";
import { Footer } from "@/app/components/footer";
import { TutorialsPageContent } from "@/app/components/help-tutorials-content";

export default function TutorialsPage() {
  return (
    <div className="min-h-screen bg-stone-50 dark:bg-zinc-950 font-sans selection:bg-stone-200 dark:selection:bg-zinc-800">
      <Navbar />
      <main>
        <TutorialsPageContent basePath="/help" />
      </main>
      <Footer />
    </div>
  );
}
