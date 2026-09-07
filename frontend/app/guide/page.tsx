import { AboutNote } from "@/components/shared/AboutNote";
import { SiteHeader } from "@/components/site-chrome";
import { GuidePageContent } from "@/components/guide/GuidePageContent";

export const metadata = {
  title: "New to F1? — Jalur APEXGP",
  description:
    "A plain-English guide to F1's current rules — Overtake Mode, tyre compounds, flags, pit strategy — plus a quiz to test what stuck.",
};

export default function GuidePage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <GuidePageContent />
        <AboutNote />
      </main>
    </>
  );
}
