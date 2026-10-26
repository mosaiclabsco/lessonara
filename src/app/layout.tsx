import { UploadProvider } from "@/components/upload-provider";
import { Suspense } from "react";
import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { LocaleFrame } from "@/components/locale-frame";
import { Logo } from "@/components/logo";
import { SiteAnalytics } from "@/components/site-analytics";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Lessonara",
  description: "Controle de aulas e pacotes",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${geistSans.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(()=>{try{const value=document.cookie.split('; ').find(v=>v.startsWith('lessonara_theme='))?.split('=').slice(1).join('=');const theme=decodeURIComponent(value||'light');document.documentElement.dataset.theme=theme==='dark'||(theme==='system'&&matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light';}catch{document.documentElement.dataset.theme='light';}})();",
          }}
        />
      </head>
      <body className="min-h-full font-sans">
        <Suspense
          fallback={
            <div className="preferences-loading" role="status">
              <Logo />
              <span className="sr-only">Carregando Lessonara…</span>
            </div>
          }
        >
          <LocaleFrame>
            <UploadProvider>{children}</UploadProvider>
            <Suspense fallback={null}>
              <SiteAnalytics />
            </Suspense>
          </LocaleFrame>
        </Suspense>
      </body>
    </html>
  );
}
