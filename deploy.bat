@echo off
chcp 65001 >nul
echo ===================================================
echo   PEDEPRONTO - DEPLOY SIMULTANEO (GITHUB + FIREBASE)
echo ===================================================
echo.

set msg=%1
if "%msg%"=="" set msg="Atualizacao rapida do sistema"

echo [1/4] Adicionando arquivos modificados (git add .)...
git add .

echo [2/4] Salvando historico (git commit)...
git commit -m %msg%

echo [3/4] Enviando backup para o GitHub (git push)...
git push

echo [4/4] Publicando aplicacao no ar (firebase deploy)...
call npx firebase-tools deploy --only hosting

echo.
echo ===================================================
echo   DEU TUDO CERTO! O sistema foi atualizado!
echo ===================================================
pause
