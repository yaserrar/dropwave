import { PageBackground } from "@/components/page-background";
import { SiteHeader } from "@/components/site-header";
import { Uploader } from "@/components/upload/uploader";

export default function Home() {
  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-hidden">
      <PageBackground />
      <SiteHeader />

      <main id="main" className="mx-auto w-full max-w-2xl flex-1 px-4 pt-10 pb-20 sm:pt-16">
        <div className="mb-10 flex flex-col items-center text-center sm:mb-12">
          <span className="animate-fade-up mb-6 inline-flex items-center gap-2 rounded-full border bg-card/80 py-1 pr-3 pl-1 text-xs text-muted-foreground shadow-xs backdrop-blur">
            <span className="rounded-full bg-brand-subtle px-2 py-0.5 font-medium text-brand-muted">Beta</span>
            Free file sharing · no sign-up
          </span>
          <h1 className="animate-fade-up font-heading text-[40px] leading-none font-medium tracking-tighter [animation-delay:80ms] sm:text-6xl">
            Drop it here.
            <br />
            Share it <span className="text-dia pr-[0.04em]">anywhere.</span>
          </h1>
          <p className="animate-fade-up mt-5 max-w-md text-base leading-relaxed text-pretty text-muted-foreground [animation-delay:160ms]">
            Upload a file and get a private link you can send to anyone. No account, no app to install.
          </p>
        </div>

        <div className="animate-fade-up [animation-delay:240ms]">
          <Uploader />
        </div>
      </main>

      <footer className="mx-auto w-full max-w-5xl px-4 py-6 text-center text-xs text-muted-foreground sm:px-6">
        Dropwave · made with care
      </footer>
    </div>
  );
}
