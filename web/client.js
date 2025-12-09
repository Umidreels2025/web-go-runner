// client.js
require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' }});

require(['vs/editor/editor.main'], function() {
  const editor = monaco.editor.create(document.getElementById('editor'), {
    value: `package main

import "fmt"

func main() {
    fmt.Println("Hello TinyGo WASM")
}
`,
    language: 'go',
    theme: 'vs-dark',
    automaticLayout: true,
    minimap: { enabled: false },
    fontSize: 14
  });

  // Monaco: basic autocompletion + go snippets
  monaco.languages.registerCompletionItemProvider('go', {
    provideCompletionItems: () => {
      const suggestions = [
        { label: 'fmt.Println', kind: monaco.languages.CompletionItemKind.Function, insertText: 'fmt.Println(${1})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, detail: 'fmt.Println' },
        { label: 'package main', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'package main\n\n' }
      ];
      return { suggestions: suggestions };
    }
  });

  // Simple diagnostics by attempting to compile via server /format endpoint (server returns formatted code or error)
  // We will use formatting endpoint to help detect basic syntax errors after formatting attempt.

  const formatBtn = document.getElementById('formatBtn');
  const runBtn = document.getElementById('runBtn');
  const outputEl = document.getElementById('output');
  const statusEl = document.getElementById('status');
  const targetSelect = document.getElementById('targetSelect');

  async function setStatus(s) { statusEl.innerText = s; }

  formatBtn.addEventListener('click', async () => {
    setStatus('Formatting...');
    const code = editor.getValue();
    try {
      const resp = await fetch('/format', { method: 'POST', body: code, headers: { 'Content-Type': 'text/plain' } });
      if (!resp.ok) {
        const err = await resp.text();
        outputEl.innerText = 'Format error:\n' + err;
      } else {
        const formatted = await resp.text();
        editor.setValue(formatted);
        outputEl.innerText = 'Formatted.';
      }
    } catch (e) {
      outputEl.innerText = 'Format request failed: ' + e;
    } finally { setStatus('Ready'); }
  });

  runBtn.addEventListener('click', async () => {
    setStatus('Compiling...');
    runBtn.disabled = true;
    formatBtn.disabled = true;
    outputEl.innerText = '';

    const code = editor.getValue();
    const target = targetSelect.value || 'wasm'; // wasm or wasi

    try {
      const resp = await fetch(`/compile?target=${encodeURIComponent(target)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: code
      });

      if (!resp.ok) {
        const err = await resp.text();
        outputEl.innerText = 'Compile error:\n' + err;
        return;
      }

      const wasmBuffer = await resp.arrayBuffer();
      setStatus('Instantiating WASM...');
      // Choose instantiation based on target
      if (target === 'wasi') {
        // If compiled for WASI, we need a WASI runtime in JS (not bundled here).
        outputEl.innerText = 'WASI target selected. Browser-side WASI runtime required (not included).';
      } else {
        // target === 'wasm' (TinyGo small runtime)
        // Try instantiate with minimal imports:
        const importObj = {
          env: {
            // tinygo may expect memory, table or other imports; for many programs this suffices
            // If required, the server can compile with wasm target that exports functions usable directly.
            // We provide an abort handler to capture panics.
            abort: function() { console.error('abort called'); }
          }
        };
        const { instance } = await WebAssembly.instantiate(wasmBuffer, importObj);

        setStatus('Running...');
        // Try exported functions. TinyGo often exposes "main" or "_start".
        try {
          if (instance.exports._start) {
            instance.exports._start();
            outputEl.innerText = 'Program executed (no stdout capture configured).';
          } else if (instance.exports.main) {
            instance.exports.main();
            outputEl.innerText = 'Program executed (no stdout capture configured).';
          } else {
            outputEl.innerText = 'No entry point found in wasm exports.';
          }
        } catch (e) {
          outputEl.innerText = 'Runtime error: ' + e;
        }
      }
    } catch (e) {
      outputEl.innerText = 'Error: ' + e;
    } finally {
      runBtn.disabled = false;
      formatBtn.disabled = false;
      setStatus('Ready');
    }
  });

  // Basic keyboard shortcuts
  window.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      runBtn.click();
    }
  });
});