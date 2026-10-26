import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="public-site">
      <header className="public-header">
        <Link href="/about" className="public-brand">
          <Logo />
        </Link>
        <Link href="/login" className="btn-ghost">
          Entrar
        </Link>
      </header>
      <main className="public-main">{children}</main>
      <footer className="public-footer">
        <div className="flex items-center gap-3">
          <Logo className="h-6 w-auto" />
          <span>· Mosaic Labs</span>
        </div>
        <nav aria-label="Informações públicas">
          <Link href="/about">Sobre</Link>
          <Link href="/privacy">Privacidade</Link>
          <Link href="/terms">Termos de uso</Link>
          <a href="mailto:lessonara@mosaic-labs.co">Contato</a>
        </nav>
      </footer>
    </div>
  );
}
