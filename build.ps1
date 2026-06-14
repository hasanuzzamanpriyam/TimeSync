param(
    [string]$Action = "check",
    [switch]$Release
)

$vcVars = "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"

# Run vcvars64.bat and capture environment
$envVars = cmd /c "`"$vcVars`" >nul 2>&1 && set"
foreach ($line in $envVars) {
    $eq = $line.IndexOf('=')
    if ($eq -gt 0) {
        $name = $line.Substring(0, $eq)
        $value = $line.Substring($eq + 1)
        Set-Item -Path "env:$name" -Value $value -ErrorAction SilentlyContinue
    }
}

$manifest = @("--manifest-path", "src-tauri\Cargo.toml")
if ($Release) { $manifest += "--release" }

switch ($Action) {
    "check" { cargo check @manifest }
    "build" { cargo build @manifest }
    "run" { cargo run @manifest }
    "test" { cargo test @manifest }
    default { cargo $Action @manifest }
}
