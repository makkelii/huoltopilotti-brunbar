import * as Dialog from "@radix-ui/react-dialog";
import {
  LayoutDashboard,
  Wrench,
  Box,
  Package,
  Radio,
  Settings,
  HelpCircle,
  X,
  Factory,
} from "lucide-react";
import { translate, type Lang } from "./i18n";
export type Page =
  | "dashboard"
  | "jobs"
  | "assets"
  | "inventory"
  | "radar"
  | "settings"
  | "reports"
  | "templates";
export const primaryPages = [
  { page: "dashboard", icon: LayoutDashboard },
  { page: "jobs", icon: Wrench },
  { page: "assets", icon: Box },
  { page: "inventory", icon: Package },
  { page: "radar", icon: Radio },
  { page: "settings", icon: Settings },
] as const;
export const isPage = (value: string): value is Page =>
  primaryPages.some((p) => p.page === value) ||
  value === "reports" ||
  value === "templates";
export function AppNavigation({
  page,
  lang,
  organizationName,
  userName,
  role,
  live,
  onNavigate,
  onHelp,
  mobile = false,
}: {
  page: Page;
  lang: Lang;
  organizationName: string;
  userName: string;
  role: string;
  live: boolean;
  onNavigate: (page: Page) => void;
  onHelp: () => void;
  mobile?: boolean;
}) {
  const t = (key: Parameters<typeof translate>[1]) => translate(lang, key);
  const active = page === "reports" || page === "templates" ? "settings" : page;
  const initials = userName
    .split(/\s+/)
    .slice(0, 2)
    .map((name) => name[0])
    .join("")
    .toUpperCase();
  return (
    <>
      <div className="navigation-brand">
        <a
          href="#dashboard"
          onClick={(e) => {
            e.preventDefault();
            onNavigate("dashboard");
          }}
          className="brand"
        >
          <span className="brand-mark">
            <Wrench size={21} aria-hidden="true" />
          </span>
          huoltopilotti<span className="brand-period">.</span>
        </a>
        {mobile && (
          <Dialog.Close asChild>
            <button className="icon-button" aria-label={t("close")}>
              <X size={22} />
            </button>
          </Dialog.Close>
        )}
      </div>
      <div className="navigation-workspace">
        <Factory size={19} aria-hidden="true" />
        <span>
          <strong>{organizationName}</strong>
          <small>{t(live ? "workspaceLabel" : "demo")}</small>
        </span>
      </div>
      <nav aria-label={t("primaryNavigation")}>
        {primaryPages.map(({ page: target, icon: Icon }) => (
          <button
            key={target}
            className={`nav-item ${active === target ? "active" : ""}`}
            aria-current={active === target ? "page" : undefined}
            onClick={() => onNavigate(target)}
          >
            <Icon size={20} aria-hidden="true" />
            {t(target)}
          </button>
        ))}
      </nav>
      <div className="navigation-footer">
        <button className="nav-item" onClick={onHelp}>
          <HelpCircle size={19} aria-hidden="true" />
          {t("help")}
        </button>
        <button
          className="navigation-profile"
          onClick={() => onNavigate("settings")}
        >
          <span className="avatar">{initials}</span>
          <span>
            <strong>{userName}</strong>
            <small>
              {t(role as "owner" | "administrator" | "technician" | "viewer")}
            </small>
          </span>
        </button>
      </div>
    </>
  );
}
