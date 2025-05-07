# Guida Installazione Terra Microservice ./terra-microservizzi

## Prerequisiti

### Installazione su Windows
1. Installare Node.js:
   - Visita [nodejs.org](https://nodejs.org)
   - Scarica la versione LTS (Long Term Support)
   - Esegui il file .msi scaricato
   - Verifica l'installazione aprendo PowerShell:
     ```powershell
     node --version
     npm --version
     ```

### Installazione su Linux
1. Installare Node.js tramite nvm:
   ```bash
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
   source ~/.bashrc
   nvm install --lts
   nvm use --lts
   ```

## Configurazione Progetto (Windows e Linux)

1. Crea cartella del progetto:
   ```bash
   mkdir terra-microservice
   cd terra-microservice
   ```

2. Copia i file necessari:
   - package.json
   - index2.js
   - terraOperations.js
   - mnemonic.txt (contenente le tue 24 parole mnemoniche)

3. Installa le dipendenze:
   ```bash
   npm install
   ```

   Questo installerà:
   - @terra-money/feather.js@2.1.0-beta.3
   - @terra-money/terra.proto@5.3.0-beta.0
   - express@5.1.0
   - node-fetch@2.7.0

4. Avvia il servizio:
   ```bash
   npm start
   ```

## Note Importanti
- Assicurati che mnemonic.txt contenga le tue 24 parole seed
- Mantieni mnemonic.txt al sicuro e non condividerlo mai
- Il servizio gira sulla porta 3000 di default
- Su Windows, esegui PowerShell come Amministratore se incontri problemi di permessi

## Risoluzione Problemi
Se incontri problemi durante l'installazione:
```bash
npm cache clean --force
npm install
```