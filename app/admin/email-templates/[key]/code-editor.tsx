"use client";

import { useEffect, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { html } from "@codemirror/lang-html";
import { EditorView } from "@codemirror/view";

/**
 * Dunne wrapper rond CodeMirror 6 (HTML-modus). Wordt via `next/dynamic`
 * (ssr:false) geladen omdat de editor de DOM nodig heeft. `onCreateEditor` geeft
 * de `EditorView` terug zodat de ouder placeholders op de cursor kan invoegen.
 * Zoeken/vervangen (Ctrl/Cmd-F) en undo/redo zitten in de default `basicSetup`.
 *
 * De editor volgt het app-thema (donker/licht) via `data-theme` op <html>, zodat
 * het code-vak meekleurt met de rest van de beheeromgeving.
 */
function currentTheme(): "light" | "dark" {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export default function CodeEditor({
  value,
  onChange,
  onCreateEditor,
}: {
  value: string;
  onChange: (value: string) => void;
  onCreateEditor?: (view: EditorView) => void;
}) {
  // ssr:false → `document` bestaat al bij de eerste render (lazy initializer).
  const [theme, setTheme] = useState<"light" | "dark">(currentTheme);

  // Reageer live op de thema-toggle (zet `data-theme` op <html>).
  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(currentTheme()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      onCreateEditor={onCreateEditor}
      theme={theme}
      extensions={[html(), EditorView.lineWrapping]}
      basicSetup={{ foldGutter: false }}
      height="100%"
      style={{ height: "100%", fontSize: "13px" }}
    />
  );
}
