// src/App.tsx - COMPLETELY NEW UI
import BeatLeapApp from "./components/BeatLeapApp";
import { EditorProvider } from "./state/editorStore";
import { Toaster } from "@/components/ui/sonner";
import "./App.css";

console.log("App.tsx: Loading BeatLeapApp component");

export default function App() {
  return (
    <EditorProvider>
      <BeatLeapApp />
      <Toaster />
    </EditorProvider>
  );
}
