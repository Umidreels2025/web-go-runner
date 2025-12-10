// DOM elementlari
const runBtn = document.getElementById('runBtn');
const editor = document.getElementById('editor');
const outputEl = document.getElementById('output');
const errorEl = document.getElementById('error');
const toggleThemeBtn = document.getElementById('toggleTheme');

// Run tugmasi bosilganda
runBtn.addEventListener('click', () => {
    // Editor ichidagi kodni olish
    let code = editor.innerText;

    // Windows style \r\n va Mac style \r ni \n ga o'zgartirish
    code = code.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    // Serverga POST so'rov
    fetch('/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'code=' + encodeURIComponent(code)
    })
    .then(res => res.json())
    .then(data => {
        // Output va errorni chiqarish
        outputEl.innerText = data.output;
        errorEl.innerText = data.error;
    })
    .catch(err => {
        errorEl.innerText = "Fetch error: " + err;
    });
});

// Dark / Light mode toggle
toggleThemeBtn.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    document.body.classList.toggle('light-mode');
});

// Monaco Editor initsializatsiyasi (optional, agar siz Monaco ishlatmoqchi bo'lsangiz)
require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' }});
require(['vs/editor/editor.main'], function() {
    const monacoEditor = monaco.editor.create(document.getElementById('editor'), {
        value: editor.innerText,
        language: 'go',
        theme: document.body.classList.contains('dark-mode') ? 'vs-dark' : 'vs',
        automaticLayout: true,
        minimap: { enabled: false }
    });

    // Run button monaco editor bilan ishlaydi
    runBtn.addEventListener('click', () => {
        let code = monacoEditor.getValue();
        code = code.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

        fetch('/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'code=' + encodeURIComponent(code)
        })
        .then(res => res.json())
        .then(data => {
            outputEl.innerText = data.output;
            errorEl.innerText = data.error;
        })
        .catch(err => { errorEl.innerText = "Fetch error: " + err; });
    });
});
