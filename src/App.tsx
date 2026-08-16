import { useEffect, useState } from "react";
import { AppShell } from "./components/layout/AppShell";
import { ToastProvider } from "./components/ToastProvider";
import { seedInitialData } from "./db/seed";

function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    seedInitialData().then(() => setReady(true));
  }, []);

  if (!ready) return null;

  return (
    <ToastProvider>
      <AppShell />
    </ToastProvider>
  );
}

export default App;
