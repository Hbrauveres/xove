import { useEffect, useState } from "react";
import { XoveIcon } from "../components/brand/XoveIcon";
import { XoveMark } from "../components/brand/XoveMark";
import { isApple } from "../install/device";
import { installPrompt, onInstalled } from "../install/prompt";
import styles from "./InstallPage.module.css";

function ShareIcon() {
  return (
    <svg className={styles.safari} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3v12M8 7l4-4 4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 11v9h12v-9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AddIcon() {
  return (
    <svg className={styles.safari} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M12 8v8M8 12h8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * On a phone or tablet in a browser tab (spec 0171): Xovê is used from the home screen, so this
 * is all a tab shows. The same card everywhere; only the action differs: one button on Android
 * (the browser's install prompt), Safari's Share steps on iPhone and iPad.
 */
export function InstallPage() {
  const [why, setWhy] = useState(false);
  const [pointToMenu, setPointToMenu] = useState(false);
  const [installed, setInstalled] = useState(false);
  useEffect(() => onInstalled(() => setInstalled(true)), []);
  const apple = isApple();

  const get = () => {
    const prompt = installPrompt();
    if (prompt) void prompt.prompt();
    else setPointToMenu(true);
  };

  return (
    <main className={styles.wrap}>
      <section className={styles.card} aria-labelledby="install-title">
        <p className={styles.brand}>
          <XoveMark height={30} />
        </p>
        <span className={styles.tile} aria-hidden="true">
          <XoveIcon size={68} />
        </span>
        <h1 id="install-title" className={styles.title}>
          Xovê works best from your <em>home screen</em>
          <button
            type="button"
            className={styles.info}
            aria-label="Why the home screen?"
            aria-expanded={why}
            aria-controls="install-why"
            onClick={() => setWhy(!why)}
          >
            i
          </button>
        </h1>
        {why && (
          <p id="install-why" className={styles.why}>
            Opened from your home screen, Xovê fills the whole screen: no address bar or browser buttons in the way,
            just the stage.
          </p>
        )}
        <p className={styles.copy}>Start watching and sharing moments with your friends.</p>

        {installed ? (
          <p className={styles.done} role="status">
            Installed. Open Xovê from your home screen.
          </p>
        ) : apple ? (
          <ol className={styles.steps}>
            <li>
              Tap <ShareIcon />
              <b>Share</b> in Safari's bar
            </li>
            <li>
              Choose <AddIcon />
              <b>Add to Home Screen</b>
            </li>
            <li>
              Open <b>Xovê</b> from your home screen
            </li>
          </ol>
        ) : (
          <div className={styles.action}>
            <button type="button" className={styles.get} onClick={get}>
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path d="M12 4v11M7 10l5 5 5-5M5 20h14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Get Xovê
            </button>
            <p className={styles.menu} data-highlight={pointToMenu || undefined}>
              No prompt? Open the menu <b>⋮</b> and choose <b>Add to Home screen</b>.
            </p>
          </div>
        )}

        <p className={styles.note}>Already added? Open Xovê from your home screen.</p>
      </section>
    </main>
  );
}
