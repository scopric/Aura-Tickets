function Fix-Permissions ($path) {
    if (Test-Path $path) {
        $item = Get-Item $path -Force
        try {
            $acl = Get-Acl $path
            # Desabilitar herança e preservar as regras existentes como explícitas
            $acl.SetAccessRuleProtection($true, $true)
            
            # Remover todas as regras de negação (Deny)
            $rules = $acl.GetAccessRules($true, $true, [System.Security.Principal.NTAccount])
            foreach ($rule in $rules) {
                if ($rule.AccessControlType -eq [System.Security.AccessControl.AccessControlType]::Deny) {
                    $acl.RemoveAccessRuleSpecific($rule) | Out-Null
                }
            }
            
            # Conceder FullControl para o usuário atual
            $currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
            if ($item.PSIsContainer) {
                $allowRule = New-Object System.Security.AccessControl.FileSystemAccessRule($currentUser, "FullControl", "ContainerInherit,ObjectInherit", "None", "Allow")
            } else {
                $allowRule = New-Object System.Security.AccessControl.FileSystemAccessRule($currentUser, "FullControl", "None", "None", "Allow")
            }
            $acl.SetAccessRule($allowRule)
            
            Set-Acl $path $acl -ErrorAction SilentlyContinue
        } catch {
            Write-Warning "Falha ao processar permissões de: $path - $_"
        }
        
        # Recursividade para subpastas e arquivos
        if ($item.PSIsContainer) {
            Get-ChildItem $path -Force | ForEach-Object { Fix-Permissions $_.FullName }
        }
    }
}

Write-Host "Iniciando a remoção de regras de Deny NTFS na pasta node_modules..."
Fix-Permissions "node_modules"
Write-Host "Limpeza de permissões concluída. Tentando apagar node_modules..."
Remove-Item "node_modules" -Recurse -Force -ErrorAction SilentlyContinue
if (Test-Path "node_modules") {
    Write-Host "Falha na exclusão padrão. Tentando via rmdir do cmd..."
    cmd /c "rmdir /s /q node_modules"
}
if (Test-Path "node_modules") {
    Write-Error "A pasta node_modules ainda não pôde ser excluída!"
} else {
    Write-Host "Pasta node_modules excluída com sucesso!"
}
