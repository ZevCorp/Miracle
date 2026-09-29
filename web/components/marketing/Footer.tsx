import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { Container } from "@/components/ui/Container";
import { marketingNav } from "@/lib/site";

const legalNav = [
  { label: "Seguridad y privacidad", href: "/seguridad" },
  { label: "Recursos", href: "/recursos" },
  { label: "Contacto", href: "/contacto" },
  { label: "Ingresar", href: "/login" },
];

export function Footer() {
  return (
    <footer className="border-t border-line bg-canvas">
      <Container className="py-16">
        <div className="flex flex-col gap-10 md:flex-row md:justify-between">
          <div className="max-w-sm">
            <Logo />
            <p className="mt-4 text-sm leading-relaxed text-ink-soft">
              Miracle escucha la consulta y prepara la nota clínica —
              estructurada, codificada y auditable — para que el médico deje de
              vivir frente al computador y vuelva a centrarse en el paciente.
              Siempre con revisión y aprobación médica.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-2">
            <nav aria-label="Producto">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
                Producto
              </h3>
              <ul className="mt-3 space-y-2">
                {marketingNav.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="text-sm text-ink-soft transition-colors hover:text-accent"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <nav aria-label="Institucional">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
                Institucional
              </h3>
              <ul className="mt-3 space-y-2">
                {legalNav.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="text-sm text-ink-soft transition-colors hover:text-accent"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
        <div className="mt-10 flex flex-col gap-2 border-t border-line pt-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Miracle. Todos los derechos reservados.</p>
          <p>
            La documentación generada siempre requiere revisión y aprobación
            médica.
          </p>
        </div>
      </Container>
    </footer>
  );
}
