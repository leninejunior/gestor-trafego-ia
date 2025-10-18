# Script para corrigir imports antigos do Supabase
# Substitui createRouteHandlerClient por createClient

Write-Host "Corrigindo imports do Supabase..." -ForegroundColor Cyan

$files = @(
    "src/app/api/objectives/route.ts",
    "src/app/api/objectives/alerts/route.ts",
    "src/app/api/metrics/calculate/route.ts",
    "src/app/api/dashboard/views/route.ts"
)

foreach ($file in $files) {
    if (Test-Path $file) {
        Write-Host "Corrigindo: $file" -ForegroundColor Yellow
        
        # Ler conteudo
        $content = Get-Content $file -Raw
        
        # Substituir todas as ocorrencias
        $content = $content -replace 'createRouteHandlerClient\(\{ cookies \}\)', 'await createClient()'
        
        # Salvar
        Set-Content $file $content -NoNewline
        
        Write-Host "Corrigido: $file" -ForegroundColor Green
    } else {
        Write-Host "Arquivo nao encontrado: $file" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Todos os arquivos foram corrigidos!" -ForegroundColor Green
Write-Host ""
Write-Host "Resumo das correcoes:" -ForegroundColor Cyan
Write-Host "- Substituido: createRouteHandlerClient({ cookies })" -ForegroundColor White
Write-Host "- Por: await createClient()" -ForegroundColor White
Write-Host ""
Write-Host "Reinicie o servidor de desenvolvimento para aplicar as mudancas" -ForegroundColor Yellow
