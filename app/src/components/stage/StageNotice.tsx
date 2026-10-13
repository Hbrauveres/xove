import styles from "./StageNotice.module.css";

type Props = {
  title: string;
  text: string;
  spinner?: boolean;
};

/** A message in the middle of the stage, when there's no video to show. */
export function StageNotice({ title, text, spinner = false }: Props) {
  return (
    <div className={styles.notice} role="status">
      {spinner && <span className={styles.spinner} aria-hidden="true" />}
      <p className={styles.title}>{title}</p>
      <p className={styles.text}>{text}</p>
    </div>
  );
}
