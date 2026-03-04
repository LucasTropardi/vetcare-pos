import { useEffect } from "react";
import { useNaming } from "../../i18n/useNaming";
import styles from "./HomePage.module.css";

export function HomePage() {
  const naming = useNaming();
  const cashboxTitle = naming.t("home.cashbox");

  useEffect(() => {
    document.title = `${cashboxTitle} • ${naming.getApp("name")}`;
  }, [cashboxTitle, naming]);

  return (
    <section className={styles.page}>
      <header className={styles.hero}>
        <h1>{cashboxTitle}</h1>
        
      </header>

      <section className={styles.grid}>
       
      </section>
    </section>
  );
}
