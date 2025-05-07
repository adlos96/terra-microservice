# Terra Microservice

## Repository
```bash
git clone https://github.com/adlos96/terra-microservice.git
cd terra-microservice
```

## Prerequisiti

### Installazione su Windows
1. Installare Node.js:
   - Visita [nodejs.org](https://nodejs.org)
   - Scarica la versione LTS (Long Term Support)
   - Esegui il file .msi scaricato
   - Spunta l'opzione "Automatically install the necessary tools..."
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

## Configurazione Progetto

1. Clona il repository:
   ```bash
   git clone https://github.com/adlos96/terra-microservice.git
   cd terra-microservice
   ```

2. Crea il file mnemonic.txt:
   - Crea un nuovo file chiamato `mnemonic.txt`
   - Inserisci le tue 24 parole mnemoniche
   - Salva il file nella cartella del progetto

3. Installa le dipendenze:
   ```bash
   npm install
   ```

   Verranno installate le seguenti dipendenze:
   - @terra-money/feather.js@2.1.0-beta.3
   - @terra-money/terra.proto@5.3.0-beta.0
   - express@5.1.0
   - node-fetch@2.7.0

4. Avvia il servizio:
   ```bash
   npm start
   ```

## Note Importanti
- Il file mnemonic.txt deve contenere le tue 24 parole seed
- **SICUREZZA**: Non committare mai mnemonic.txt nel repository
- Il servizio gira sulla porta 3000 di default
- Su Windows, esegui PowerShell come Amministratore se necessario

## Risoluzione Problemi
Se incontri problemi durante l'installazione:
```bash
# Pulisci la cache di npm
npm cache clean --force

# Rimuovi node_modules
rm -rf node_modules    # Linux
rmdir /s /q node_modules   # Windows

# Reinstalla le dipendenze
npm install
```

## Repository GitHub
Il codice sorgente è disponibile su GitHub:
[https://github.com/adlos96/terra-microservice](https://github.com/adlos96/terra-microservice)