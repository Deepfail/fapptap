// src/App.tsx
import { StaticUnifiedApp } from "./components/StaticUnifiedApp";
import { EditorProvider } from "./state/editorStore";
import "./App.css";
import "./styles/overrides-debug.css";
import { useEffect } from "react";

export default function App() {
  useEffect(() => {
    // Add a debug class to body so our debug overrides can target it
    try {
      document.body.classList.add("debug-theme-loaded");
    } catch (e) {
      // ignore
    }
    return () => {
      try {
        document.body.classList.remove("debug-theme-loaded");
      } catch (e) {
        // ignore
      }
    };
  }, []);

  return (
    <EditorProvider>
      {/* Debug Banner shows when overrides are loaded */}
      <div id="fapptap-debug-banner" style={{ display: "block" }}>NEON THEME ACTIVE (DEBUG)</div>
      <StaticUnifiedApp />
    </EditorProvider>
  );
}
