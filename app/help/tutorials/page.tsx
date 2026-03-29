import { buildMetadata, breadcrumbJsonLd, SITE_URL } from "@/lib/seo";
import { Navbar } from "@/app/components/navbar";
import { Footer } from "@/app/components/footer";
import { TutorialsPageContent } from "@/app/components/help-tutorials-content";

export const metadata = buildMetadata({
  title: "Tutorials",
  description:
    "Step-by-step video tutorials for Curator — learn AI pricing, inventory management, marketing tools, payments, and team collaboration.",
  path: "/help/tutorials",
});

export default function TutorialsPage() {
  return (
    <div className="min-h-screen bg-stone-50 dark:bg-zinc-950 font-sans selection:bg-stone-200 dark:selection:bg-zinc-800">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbJsonLd([
              { name: "Help", url: `${SITE_URL}/help` },
              { name: "Tutorials", url: `${SITE_URL}/help/tutorials` },
            ]),
          ),
        }}
      />
      <Navbar />
      <main>
        <TutorialsPageContent basePath="/help" />
      </main>
      <Footer />
    </div>
  );
}
