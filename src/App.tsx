// src/App.tsx
import { StaticUnifiedApp } from "./components/StaticUnifiedApp";
import { EditorProvider } from "./state/editorStore";
import "./App.css";

export default function App() {
  return (
    <EditorProvider>
      <StaticUnifiedApp />
    </EditorProvider>
  );
}
