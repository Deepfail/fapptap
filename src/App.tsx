// src/App.tsx
import { BeatleapApp } from "./components/BeatleapApp";
import { EditorProvider } from "./state/editorStore";
import "./App.css";

export default function App() {
  return (
    <EditorProvider>
      <BeatleapApp />
    </EditorProvider>
  );
}
