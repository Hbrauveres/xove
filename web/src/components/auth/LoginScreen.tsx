import { Button } from "../ui/Button";
import styles from "./LoginScreen.module.css";

type Props = {
  onSignIn: () => void;
};

/**
 * Entry gate. The real version redirects to /api/auth/google and checks the
 * email against ALLOWED_EMAILS. Here the button just lets you in.
 */
export function LoginScreen({ onSignIn }: Props) {
  return (
    <main className={styles.wrap}>
      <section className={styles.card} aria-labelledby="login-title">
        <p className={styles.domain}>xovê · live.hbrauveres.dev</p>
        <h1 id="login-title" className={styles.title}>
          One screen.
          <br />
          Everyone watching.
        </h1>
        <p className={styles.copy}>
          A private room for your group. Whoever shares takes the stage; everyone else sees it live.
          Invite only.
        </p>
        <Button onClick={onSignIn} className={styles.signIn}>
          Continue with Google
        </Button>
        <p className={styles.note}>Mock: this signs you in as Henrique. No real login happens.</p>
      </section>
    </main>
  );
}
