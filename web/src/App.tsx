import { useState } from "react";
import { LoginScreen } from "./components/auth/LoginScreen";
import { ActivityFeed } from "./components/activity/ActivityFeed";
import { ShareControls } from "./components/controls/ShareControls";
import { AppHeader } from "./components/layout/AppHeader";
import { MockPanel } from "./components/mock/MockPanel";
import { Stage } from "./components/stage/Stage";
import { ViewerList } from "./components/viewers/ViewerList";
import { useMockSession } from "./mock/useMockSession";
import styles from "./App.module.css";

export default function App() {
  // Real app: comes from GET /api/me after the Google login redirect.
  const [signedIn, setSignedIn] = useState(true);

  if (!signedIn) return <LoginScreen onSignIn={() => setSignedIn(true)} />;
  return <Room onSignOut={() => setSignedIn(false)} />;
}

/** The whole app is one room: the stage, its controls, and who's here. */
function Room({ onSignOut }: { onSignOut: () => void }) {
  // Swap useMockSession for the real LiveKit-backed hook later. Same shape.
  const session = useMockSession();
  const onlineCount = session.people.filter((p) => p.online).length;

  return (
    <div className={styles.shell}>
      <AppHeader
        me={session.me}
        connection={session.connection}
        onlineCount={onlineCount}
        onSignOut={onSignOut}
      />

      <div className={styles.layout}>
        <main className={styles.main}>
          <Stage
            share={session.share}
            sharer={session.sharer}
            stats={session.stats}
            isMeSharing={session.isMeSharing}
            connection={session.connection}
            onStartSharing={session.startSharing}
          />
          <ShareControls
            sharer={session.sharer}
            isMeSharing={session.isMeSharing}
            onStart={session.startSharing}
            onTake={session.takeScreen}
            onStop={session.stopSharing}
          />
        </main>

        <aside className={styles.side}>
          <ViewerList people={session.people} meId={session.me.id} sharerId={session.share?.sharerId ?? null} />
          <ActivityFeed events={session.activity} people={session.people} meId={session.me.id} />
          <MockPanel simulate={session.simulate} isMeSharing={session.isMeSharing} />
        </aside>
      </div>
    </div>
  );
}
