import { ListIcon } from "@phosphor-icons/react";
import { LanguageToggle } from "../LanguageToggle/LanguageToggle";
import { ThemeToggle } from "../ThemeToggle/ThemeToggle";
import { useNaming } from "../../i18n/useNaming";
import styles from "./Navbar.module.css";

type NavbarProps = {
  showMenuButton?: boolean;
  title?: string;
};

export function Navbar({ showMenuButton = true, title }: NavbarProps) {
  const naming = useNaming();
  const resolvedTitle = title ?? naming.t("navbar.title");

  return (
    <header className={styles.topbar}>
      <div className={styles.left}>
        {showMenuButton && (
          <button
            className={styles.iconButton}
            onClick={() => {
              const event = new CustomEvent("pos:toggle-sidebar");
              window.dispatchEvent(event);
            }}
            aria-label="Menu"
            title="Menu"
          >
            <ListIcon size={18} />
          </button>
        )}
        <span className={styles.brandText}>{resolvedTitle}</span>
      </div>

      <div className={styles.right}>
        <LanguageToggle />
        <ThemeToggle />
      </div>
    </header>
  );
}
