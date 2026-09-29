"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { marketingNav, CTA } from "@/lib/site";

export function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-line/60 bg-canvas/75 backdrop-blur-xl">
      <Container className="flex h-[72px] items-center justify-between gap-6">
        <Logo />

        <nav
          aria-label="Principal"
          className="hidden items-center gap-0.5 lg:flex"
        >
          {marketingNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full px-4 py-2 text-[0.92rem] font-medium text-ink-soft transition-colors hover:text-deep"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-1.5 lg:flex">
          <Link
            href="/login"
            className="rounded-full px-4 py-2 text-[0.92rem] font-medium text-ink-soft transition-colors hover:text-deep"
          >
            Ingresar
          </Link>
          <Button href={CTA.primary.href} variant="primary" size="md">
            {CTA.primary.label}
          </Button>
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-deep hover:bg-ice-soft lg:hidden"
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </Container>

      {open ? (
        <div className="border-t border-line bg-canvas lg:hidden">
          <Container className="flex flex-col gap-1 py-5">
            {marketingNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-2.5 text-base font-medium text-ink-soft hover:bg-ice-soft hover:text-deep"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-3 flex flex-col gap-2">
              <Button href="/login" variant="secondary" size="lg">
                Ingresar
              </Button>
              <Button href={CTA.primary.href} variant="primary" size="lg">
                {CTA.primary.label}
              </Button>
            </div>
          </Container>
        </div>
      ) : null}
    </header>
  );
}
