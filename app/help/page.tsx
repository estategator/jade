"use client";

import { Navbar } from "@/app/components/navbar";
import { Footer } from "@/app/components/footer";
import { HelpHubContent } from "@/app/components/help-hub-content";

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-stone-50 dark:bg-zinc-950 font-sans selection:bg-stone-200 dark:selection:bg-zinc-800 font-body">
      <Navbar />
      <main>
        <HelpHubContent basePath="/help" />
      </main>
      <Footer />
    </div>
  );
}
