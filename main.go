package main

import (
    "bytes"
    "fmt"
    "io/ioutil"
    "net/http"
    "os"
    "os/exec"
)

func runHandler(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodPost {
        http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
        return
    }

    code := r.FormValue("code")
    tmpFile := "temp_code.go"
    ioutil.WriteFile(tmpFile, []byte(code), 0644)

    cmd := exec.Command("go", "run", tmpFile)
    var outBuf, errBuf bytes.Buffer
    cmd.Stdout = &outBuf
    cmd.Stderr = &errBuf

    err := cmd.Run()
    output := outBuf.String()
    errOutput := errBuf.String()

    if err != nil && errOutput == "" {
        errOutput = err.Error()
    }

    fmt.Fprintf(w, `{"output":%q, "error":%q}`, output, errOutput)
    os.Remove(tmpFile)
}

func main() {
    fs := http.FileServer(http.Dir("./"))
    http.Handle("/", fs)
    http.HandleFunc("/run", runHandler)

    fmt.Println("Server running on :5000")
    http.ListenAndServe(":5000", nil)
}
