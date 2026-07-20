# Confesercenti Pavia — Sito vetrina + Admin

Sito leggero (Node.js + Express + SQLite, ~60-80MB di RAM) con pannello admin completo, pronto per il deploy su **Railway** tramite Dockerfile.

## Sezioni del sito

Home · Associazione · Servizi · Convenzioni · Notizie · Sala stampa · **Partnership** (con Sarconix già inserita) · **Contatti** (con form che salva nell'admin e invia email via SMTP)

## Primo accesso amministratore

- URL: `https://tuodominio.it/admin`
- Email: il valore di `ADMIN_EMAIL` configurato al primo avvio (oppure quello scelto localmente)
- Password: il valore di `ADMIN_PASSWORD` configurato in Railway o nell'ambiente di produzione al primo avvio

> ⚠️ **Cambia immediatamente la password** dopo il primo accesso da *Sito & Pagine → Cambia la tua password*. Le credenziali iniziali vengono create solo alla prima esecuzione: imposta `ADMIN_EMAIL` e `ADMIN_PASSWORD` prima del primo avvio e non inserirne mai i valori in file versionati.

## Deploy su Railway

1. Pusha questa cartella su un repository GitHub e crea un nuovo progetto Railway dal repository.
2. Railway usa il `Dockerfile` incluso; la porta esposta è **3000**.
3. Configura le **Service Variables**:
   - `SESSION_SECRET` → genera con `openssl rand -hex 32` (obbligatoria)
   - `ADMIN_PASSWORD` → obbligatoria al primo avvio: senza di essa il database non può creare l'utente amministratore
   - `ADMIN_EMAIL` → opzionale, per scegliere l'indirizzo dell'amministratore iniziale
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, `MAIL_TO` → per l'invio email dei form (vedi `.env.example`)
4. Aggiungi un **Volume persistente** (fondamentale, altrimenti perdi contenuti a ogni deploy):
   - Mount path: `/app/data` (contiene database SQLite e immagini caricate)
5. Assegna il dominio e avvia il deploy.

## Sviluppo locale

```bash
npm install
npm start
# sito su http://localhost:3000 — admin su http://localhost:3000/admin
```

## Cosa può fare l'admin

- **Sito & Pagine**: nome, contatti, social, testi della home (hero + numeri), pagina Associazione, pagina Contatti
- **Servizi / Convenzioni / Notizie / Sala stampa / Partnership**: crea, modifica, elimina, ordina, pubblica/bozza, immagini, tag e link
- **Richieste**: inbox dei messaggi ricevuti dal form contatti
- **Utenti** (solo super admin): crea editor o altri super admin
- Cambio password personale

## Note tecniche

- SQLite in modalità WAL, zero database esterni da gestire
- Password con scrypt + salt, sessioni firmate via cookie, honeypot anti-spam sul form
- Immagini caricate in `/app/data/uploads` (max 3MB, solo immagini)
- Se SMTP non è configurato, i form funzionano comunque: tutto resta nell'inbox admin
