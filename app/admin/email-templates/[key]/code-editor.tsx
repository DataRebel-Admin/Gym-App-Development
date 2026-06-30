"use client";

import CodeMirror from "@uiw/react-codemirror";
import { html } from "@codemirror/lang-html";
import { EditorView } from "@codemirror/view";

/**
 * Dunne wrapper rond CodeMirror 6 (HTML-modus). Wordt via `next/dynamic`
 * (ssr:false) geladen omdat de editor de DOM nodig heeft. `onCreateEditor` geeft
 * de `EditorView` terug zodat de ouder placeholders op de cursor kan invoegen.
 * Zoeken/vervangen (Ctrl/Cmd-F) en undo/redo zitten in de default `basicSetup`.
 */
export default function CodeEditor({
  value,
  onChange,
  onCreateEditor,
}: {
  value: string;
  onChange: (value: string) => void;
  onCreateEditor?: (view: EditorView) => void;
}) {
  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      onCreateEditor={onCreateEditor}
      extensions={[html(), EditorView.lineWrapping]}
      basicSetup={{ foldGutter: false }}
      height="100%"
      style={{ height: "100%", fontSize: "13px" }}
    />
  );
}
