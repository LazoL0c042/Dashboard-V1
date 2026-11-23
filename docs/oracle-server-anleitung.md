# Eigener Server bei Oracle Cloud (Always Free) – Anleitung fürs iPad

Ziel: ein Server, der rund um die Uhr läuft, nichts kostet und nur über Tailscale
erreichbar ist. Darauf laufen später Werkbank, das Investment-Tool und weitere Projekte.

Alles geht vom iPad in Safari. Du brauchst kein Terminal-App, weil Oracle eine
Kommandozeile im Browser mitbringt (Cloud Shell). Für später ist **Termius** oder
**Blink Shell** aus dem App Store bequemer.

> Hinweis: Oracle ändert Menüs und Limits gelegentlich. Wenn ein Knopf anders heißt,
> such nach dem sinngemäßen Begriff. Die Grundschritte bleiben gleich.

---

## Was du kostenlos bekommst

- 1 Server mit **Ampere A1 (ARM)**, bis zu **4 CPU-Kerne und 24 GB RAM** (Always Free)
- bis zu **200 GB** Festplatte
- dauerhaft kostenlos, solange du nur „Always Free“-Ressourcen anlegst

**Zwei Haken, die du kennen musst:**

1. **Kreditkarte nötig** bei der Anmeldung (zur Identitätsprüfung, es wird eine kleine
   Summe reserviert und wieder freigegeben).
2. **Ungenutzte Server können zurückgefordert werden.** Oracle darf Always-Free-Server
   abschalten, die über 7 Tage kaum CPU, Netz und Speicher nutzen. Mit Werkbank,
   Investment-Tool und Backups ist das meist kein Problem. Sicher davor bist du nur,
   wenn du das Konto auf „Pay As You Go“ hochstufst (Schritt 9) – das bleibt kostenlos,
   solange du nur Always-Free-Dinge nutzt, aber dann *könnten* Fehler Geld kosten.
   Deshalb dort sofort ein Budget-Alarm.

---

## 1. Konto anlegen

1. Safari: `https://www.oracle.com/cloud/free/` → **Start for free**.
2. Daten eingeben, E-Mail bestätigen.
3. **Home Region** wählen: **Germany Central (Frankfurt)**.
   - Wichtig: Die Home Region kann man **nie mehr ändern**, und Always-Free-ARM-Server
     gibt es nur dort.
   - Frankfurt ist beliebt und manchmal voll (siehe Schritt 4, „Out of capacity“).
     Ausweichen ginge auf **Netherlands Northwest (Amsterdam)**. Daten blieben in der EU.
4. Kreditkarte hinterlegen, abschließen. Die Freischaltung kann 5–30 Minuten dauern.

## 2. Cloud Shell öffnen und SSH-Schlüssel erzeugen

1. In der Oracle-Konsole oben rechts auf das Symbol **`>_`** (Cloud Shell) tippen.
   Unten öffnet sich ein Terminal im Browser.
2. Eingeben:

   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/oracle_server -N ""
   cat ~/.ssh/oracle_server.pub
   ```

3. Die ausgegebene Zeile (beginnt mit `ssh-ed25519 …`) markieren und kopieren.
   Das ist der **öffentliche** Schlüssel, den darf Oracle sehen.

## 3. Server anlegen

1. Menü (☰) → **Compute** → **Instances** → **Create instance**.
2. **Name:** `server` (oder beliebig).
3. **Image and shape** → **Edit**:
   - **Image:** *Change image* → **Canonical Ubuntu 24.04** (nicht „Minimal“).
   - **Shape:** *Change shape* → **Ampere** → **VM.Standard.A1.Flex**
     → **4 OCPUs, 24 GB** Speicher.
   - Achte auf das Label **„Always Free-eligible“**.
4. **Networking:** Standard lassen (neues VCN, öffentliches Subnetz,
   **öffentliche IPv4-Adresse zuweisen: ja** – brauchen wir für die Ersteinrichtung).
5. **Add SSH keys** → **Paste public keys** → die kopierte Zeile einfügen.
6. **Boot volume:** Größe auf **100 GB** setzen (Always Free erlaubt bis 200 GB gesamt).
7. **Create**.

## 4. Wenn „Out of capacity“ kommt

Häufig in Frankfurt. Möglichkeiten:

- Anderes **Availability Domain** im selben Formular wählen (AD-1, AD-2, AD-3), erneut versuchen.
- Kleiner starten: **2 OCPUs, 12 GB** – reicht für deine Projekte locker.
- Zu einer anderen Tageszeit (früh morgens) erneut versuchen.

## 5. Verbinden

1. Warten, bis die Instanz **Running** ist. Auf der Instanz-Seite die
   **Public IP address** kopieren.
2. In der Cloud Shell:

   ```bash
   ssh -i ~/.ssh/oracle_server ubuntu@DEINE_IP
   ```

   Bei der Frage `Are you sure…` mit `yes` antworten.

Du bist jetzt auf deinem Server.

## 6. System aktualisieren und Grundwerkzeuge

```bash
sudo apt update && sudo apt -y upgrade
sudo apt -y install git python3-venv python3-pip sqlite3 unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades   # "Yes": Sicherheitsupdates automatisch
sudo timedatectl set-timezone Europe/Berlin
```

Docker (für Werkbank und spätere Projekte):

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu
```

Danach einmal ab- und wieder anmelden (`exit`, dann erneut `ssh …`).

## 7. Tailscale installieren

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up --ssh
```

1. Es erscheint ein Link. In Safari öffnen und mit **demselben Tailscale-Konto**
   anmelden wie auf iPad und iPhone.
2. In der Tailscale-Verwaltung (`login.tailscale.com/admin`):
   - Den Server umbenennen in z. B. `server`.
   - Bei dem Gerät **„Disable key expiry“** wählen, sonst fliegt der Server nach
     180 Tagen aus dem Netz.
   - Unter **DNS**: **MagicDNS** und **HTTPS Certificates** aktivieren.

Ab jetzt erreichst du den Server über Tailscale, z. B. mit Termius auf dem iPad
unter `server` (Benutzer `ubuntu`). Dank `--ssh` übernimmt Tailscale die Anmeldung.

## 8. Öffentlichen Zugang schließen

Erst prüfen, dass SSH über Tailscale klappt (Termius → Host `server`). Dann:

1. Oracle-Konsole → **Networking** → **Virtual cloud networks** → dein VCN
   → **Security Lists** → **Default Security List**.
2. Die **Ingress Rule** für **Port 22** löschen.

Jetzt ist der Server aus dem Internet nicht mehr erreichbar, nur noch über dein
Tailscale-Netz. Genau wie bei der Werkbank wird **nie** ein öffentlicher Port geöffnet.

> Notfall: Sperrst du dich aus, kannst du über die Instanz-Seite →
> **Console connection** trotzdem drauf.

## 9. Schutz vor Kosten (wichtig)

1. Menü → **Billing & Cost Management** → **Budgets** → **Create budget**:
   Betrag **1 €**, Alarm bei **1 %** an deine E-Mail.
2. Optional, gegen das Zurückfordern: **Upgrade to Pay As You Go**.
   Nur machen, wenn der Budget-Alarm steht. Und nie Ressourcen ohne das Label
   „Always Free“ anlegen.

## 10. Freunde Zugriff geben (für das Investment-Tool)

In der Tailscale-Verwaltung beim Gerät `server` → **Share…** → Einladungslink
an den Freund schicken. Er installiert Tailscale, nimmt die Einladung an und sieht
**nur diesen Server**, nicht deine anderen Geräte. Im kostenlosen Tailscale-Plan
reicht das für einen kleinen Freundeskreis.

Welche Seite er dort öffnen darf, regelt dann das Login des Investment-Tools.

## 11. Projekte darauf starten (später)

```bash
git clone https://github.com/LazoL0c042/Dashboard-V1.git
```

Werkbank und Investment-Tool bekommen je einen eigenen Port und werden mit
`tailscale serve` unter eigenen Pfaden oder Ports veröffentlicht. Die genauen
Befehle stehen in der README des jeweiligen Projekts, sobald es gebaut ist.

---

## Checkliste

- [ ] Konto, Home Region Frankfurt (oder Amsterdam)
- [ ] Instanz A1.Flex, Ubuntu 24.04, „Always Free-eligible“
- [ ] Updates + automatische Sicherheitsupdates
- [ ] Docker
- [ ] Tailscale mit `--ssh`, Key Expiry aus, MagicDNS + HTTPS an
- [ ] Port 22 öffentlich geschlossen
- [ ] Budget-Alarm 1 €
