const runBtn = document.getElementById('runBtn');
const editor = document.getElementById('editor');
const outputEl = document.getElementById('output');
const errorEl = document.getElementById('error');
const toggleThemeBtn = document.getElementById('toggleTheme');

runBtn.addEventListener('click', () => {
    const code = editor.innerText;
    fetch('/run', {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: 'code=' + encodeURIComponent(code)
    })
    .then(res => res.json())
    .then(data => {
        outputEl.innerText = data.output;
        errorEl.innerText = data.error;
    })
    .catch(err => { errorEl.innerText = err; });
});

toggleThemeBtn.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    document.body.classList.toggle('light-mode');
});