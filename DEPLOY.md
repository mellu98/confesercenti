# Deploy su Railway

Questa app Express/EJS usa SQLite e upload locali. Su Railway va eseguita dal `Dockerfile` e deve avere un volume persistente, altrimenti database e immagini caricate si perdono a ogni redeploy.

## Percorso rapido

1. Pubblica il repository su GitHub senza file locali o segreti.
2. In Railway crea un progetto e scegli **Deploy from GitHub repo**.
3. Railway userà `railway.json` per costruire il `Dockerfile`.
4. Configura le variabili e monta il volume in `/app/data`.
5. Genera il dominio Railway e verifica sito e `/admin`.

## Variabili Railway

Imposta queste variabili nel servizio Railway prima del primo deploy:

```text
SESSION_SECRET=<generate-a-long-random-value>
ADMIN_EMAIL=<admin-email-address>
ADMIN_PASSWORD=<choose-a-strong-password>
```

`SESSION_SECRET` e `ADMIN_PASSWORD` sono obbligatorie in produzione. `ADMIN_EMAIL` è consigliata: viene usata solo quando il database non contiene ancora utenti. Non inserire valori reali in file versionati.

Per l'invio email, configura facoltativamente:

```text
SMTP_HOST=<smtp-host>
SMTP_PORT=587
SMTP_USER=<smtp-user>
SMTP_PASS=<smtp-password>
MAIL_FROM=<sender-address>
MAIL_TO=<recipient-address>
```

## Volume SQLite e upload

Nel servizio Railway aggiungi un **Volume** con mount path:

```text
/app/data
```

L'app usa `DATA_DIR=/app/data`; qui vivono sia `site.db` sia gli upload (`/app/data/uploads`). Non eliminare o rimontare il volume durante un redeploy se vuoi mantenere i dati.

> **SQLite richiede una singola replica.** Railway consente un solo volume per servizio e le repliche non possono condividere questo volume: non aumentare le repliche finché l'app usa SQLite.

## GitHub e aggiornamenti

Collega il repository GitHub a Railway e abilita i deploy dal branch scelto (di norma `main`). Ogni push su quel branch può avviare un nuovo deploy; Railway fornisce `PORT` automaticamente e l'app ascolta su tutte le interfacce.

Prima di collegare GitHub, controlla che non siano inclusi `.env*`, `data/`, `.railway/`, `node_modules/` o log locali. I segreti vanno configurati solo nella dashboard Railway.

## Verifica dopo il deploy

- Apri il dominio generato da Railway e verifica la home page.
- Apri `/admin` e accedi con `ADMIN_EMAIL` e `ADMIN_PASSWORD` scelti al primo avvio.
- Carica un'immagine di prova e verifica che resti disponibile dopo un redeploy.
