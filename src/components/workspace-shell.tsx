"use client";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { Logo } from "./logo";
import { Icon } from "./icon";
import { Button } from "./button";
import { ActionForm, SubmitButton } from "./action-form";
import { signOut } from "@/app/login/actions";
import { useI18n } from "./browser-preferences-provider";
const collapseKey = "lessonara:menu-collapsed";
const subscribeMenu = (callback: () => void) => {
  window.addEventListener("lessonara:menu", callback);
  window.addEventListener("storage", callback);
  window.addEventListener("resize", callback);
  return () => {
    window.removeEventListener("lessonara:menu", callback);
    window.removeEventListener("storage", callback);
    window.removeEventListener("resize", callback);
  };
};
let mobileCollapsed = true;
const subscribeReady = () => () => {};
const readMobile = () => window.matchMedia("(max-width: 767px)").matches;
const readMenu = () => {
  if (readMobile()) return mobileCollapsed;
  try {
    const stored = localStorage.getItem(collapseKey);
    return stored === null ? window.matchMedia("(max-width: 767px)").matches : stored === "true";
  } catch {
    return false;
  }
};
export function WorkspaceShell({
  name,
  nav,
  children,
}: {
  name: string;
  nav: ReactNode;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const ready = useSyncExternalStore(
    subscribeReady,
    () => true,
    () => false,
  );
  const collapsed = useSyncExternalStore(subscribeMenu, readMenu, () => false);
  const mobile = useSyncExternalStore(subscribeMenu, readMobile, () => false);
  const sidebar = useRef<HTMLElement>(null);
  const [menu, setMenu] = useState(false);
  const profile = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function close(e: PointerEvent) {
      if (!profile.current?.contains(e.target as Node)) setMenu(false);
    }
    function escape(e: KeyboardEvent) {
      if (e.key === "Escape") setMenu(false);
    }
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  function closeMobile() {
    if (!readMobile()) return;
    mobileCollapsed = true;
    window.dispatchEvent(new Event("lessonara:menu"));
    document.getElementById("workspace-menu-opener")?.focus();
  }
  useEffect(() => {
    if (!mobile || collapsed) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    sidebar.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        mobileCollapsed = true;
        window.dispatchEvent(new Event("lessonara:menu"));
        previous?.focus();
      }
      if (event.key === "Tab") {
        const items = sidebar.current?.querySelectorAll<HTMLElement>(
          "a[href],button:not(:disabled)",
        );
        if (!items?.length) return;
        const first = items[0],
          last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("keydown", escape);
      previous?.focus();
    };
  }, [mobile, collapsed]);
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase() || "P";
  function toggle() {
    if (readMobile()) {
      mobileCollapsed = !collapsed;
      window.dispatchEvent(new Event("lessonara:menu"));
      return;
    }
    try {
      localStorage.setItem(collapseKey, String(!collapsed));
    } catch {}
    window.dispatchEvent(new Event("lessonara:menu"));
  }
  return (
    <div data-menu-ready={ready} className={`app-shell ${collapsed ? "menu-collapsed" : ""}`}>
      <a href="#content" className="skip-link">
        {t("Pular para o conteúdo")}
      </a>
      {mobile && !collapsed && (
        <>
          <div className="workspace-menu-backdrop" aria-hidden="true" />
          <button
            type="button"
            className="workspace-menu-dismiss"
            aria-label={t("Fechar menu")}
            tabIndex={-1}
            onClick={closeMobile}
          />
        </>
      )}
      <aside
        ref={sidebar}
        id="workspace-menu"
        className="sidebar"
        aria-label={t("Menu principal")}
        role={mobile && !collapsed ? "dialog" : undefined}
        aria-modal={mobile && !collapsed ? true : undefined}
        inert={mobile && collapsed ? true : undefined}
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("a[href]")) closeMobile();
        }}
      >
        <div className="sidebar-head">
          <Link
            href="/"
            className="brand"
            aria-label="Lessonara"
            aria-hidden={collapsed}
            tabIndex={collapsed ? -1 : undefined}
          >
            <Logo className="brand-word h-7 w-auto" />
          </Link>
          <Button
            icon={mobile ? "close" : "menu"}
            variant="menu"
            className="icon-button sidebar-toggle"
            aria-label={t(mobile ? "Fechar menu" : collapsed ? "Expandir menu" : "Recolher menu")}
            aria-controls="workspace-menu"
            aria-expanded={!collapsed}
            onClick={toggle}
          />
        </div>
        {nav}
      </aside>
      <div className="workspace" inert={mobile && !collapsed ? true : undefined}>
        <header className="workspace-header">
          <Button
            id="workspace-menu-opener"
            icon="menu"
            variant="menu"
            className="icon-button mobile-menu-toggle"
            aria-label={t(collapsed ? "Expandir menu" : "Recolher menu")}
            aria-controls="workspace-menu"
            aria-expanded={!collapsed}
            onClick={toggle}
          />
          <div ref={profile} className="profile-menu">
            <button
              type="button"
              className="profile-trigger"
              aria-label={`${t("Sua conta")}: ${name}`}
              aria-expanded={menu}
              aria-controls="profile-options"
              onClick={() => setMenu(!menu)}
            >
              <span className="profile-initials">{initials}</span>
              <span className="profile-name">{name}</span>
              <Icon name="chevron" className="h-4 w-4" />
            </button>
            {menu && (
              <div id="profile-options" className="profile-options">
                <ActionForm action={signOut}>
                  <SubmitButton className="menu-action" pendingLabel="" icon="logout">
                    {t("Sair")}
                  </SubmitButton>
                </ActionForm>
              </div>
            )}
          </div>
        </header>
        <div id="content" className="workspace-content">
          {children}
        </div>
        <footer className="workspace-footer">
          <Logo className="h-5 w-auto" />
        </footer>
      </div>
    </div>
  );
}
