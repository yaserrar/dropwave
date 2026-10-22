import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "iconsax-react";
import { PageBackground } from "@/components/page-background";
import { SharedFile } from "@/components/share/shared-file";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Download a file · Dropwave",
  description: "Someone shared a file with you on Dropwave.",
  // Share links are private; keep them out of search results.
  robots: { index: false, follow: false },
};

export default async function SharePage({ params }: PageProps<"/s/[id]">) {
  const { id } = await params;

  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-hidden">
      <PageBackground />
      <SiteHeader />

      <main id="main" className="mx-auto w-full max-w-md flex-1 px-4 pt-10 pb-20 sm:pt-20">
        <SharedFile id={id} />

        <p className="animate-fade-up mt-8 text-center text-sm text-muted-foreground [animation-delay:400ms]">
          Have something to send?{" "}
          <Link
            href="/"
            className="group inline-flex items-center gap-1 font-medium text-foreground underline decoration-brand-border underline-offset-4 transition-colors hover:decoration-brand-muted"
          >
            Share a file
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" color="currentColor" />
          </Link>
        </p>
      </main>

      <footer className="mx-auto w-full max-w-5xl px-4 py-6 text-center text-xs text-muted-foreground sm:px-6">
        Dropwave · made with care
      </footer>
    </div>
  );
}
