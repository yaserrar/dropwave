import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";

export function SiteHeader() {
  return (
    <header className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
      <Link href="/" aria-label="Dropwave home" className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        <Logo />
      </Link>
      <ThemeToggle />
    </header>
  );
}
