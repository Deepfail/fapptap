import { createRoot } from "react-dom/client";
import App from "./App";
import "./App.css";

console.log("main.tsx: Using NEW BeatLeap App component");

createRoot(document.getElementById("root")!).render(<App />);
