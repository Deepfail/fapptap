import { createRoot } from "react-dom/client";
import "./App.css";
import "./ui/theme-neon.css";
document.documentElement.classList.add("theme-neon");

import { EditorProvider } from "@/state/editorStore";
import { StaticUnifiedApp } from "@/components/StaticUnifiedApp";

createRoot(document.getElementById("root")!).render(
  <EditorProvider>
    <StaticUnifiedApp />
  </EditorProvider>
);
