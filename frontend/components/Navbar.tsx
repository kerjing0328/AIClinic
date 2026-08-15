"use client";

// components/Navbar.tsx
// Floating glass pill navbar with Home / Patients / Consultation navigation
// plus the signed-in doctor status.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/session";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/patients", label: "Patients" },
  { href: "/consultation", label: "Consultation" },
  { href: "/references", label: "References" },
];

export default function Navbar() {
  const pathname = usePathname();
  const { doctor, signOut, ready } = useSession();

  return (
    <header className="sticky top-6 z-30 mt-6">
      <nav className="glass mx-auto flex items-center justify-between rounded-full px-6 py-3">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-3">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-full text-white"
            style={{ background: "var(--color-primary)" }}
            aria-hidden
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 3v18M3 12h18"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <span className="hidden text-sm font-semibold tracking-tight text-[var(--color-primary)] sm:block">
            Notedr.
          </span>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          {LINKS.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-[var(--color-primary)] text-white"
                    : "text-[var(--color-text-muted)] hover:bg-white/60 hover:text-[var(--color-text-main)]"
                }`}
                aria-current={active ? "page" : undefined}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* Doctor status */}
        <div className="flex min-w-[3rem] items-center justify-end">
          {ready && doctor ? (
            <div className="flex items-center gap-2">
              <span className="hidden text-sm font-medium text-[var(--color-text-main)] sm:block">
                Dr. {doctor.name?.split(" ")[0]}
              </span>
              <button
                onClick={signOut}
                className="rounded-full px-3 py-1.5 text-xs font-medium text-[var(--color-text-muted)] transition hover:bg-white/60 hover:text-[var(--color-text-main)]"
              >
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </nav>
    </header>
  );
}
