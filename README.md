# energy-card

Der Pulse-Screen der Tibber-App als Lovelace-Karte für Home Assistant — mit den
Zeiträumen, die die App ohne Stromvertrag nicht hergibt.

- Live-Leistung mit Ring und pulsierendem Live-Punkt
- Verlaufskurve mit vertikalem Farbverlauf: ruhige Grundlast grün, Spitzen orange
- Zeiträume **5 Min · 1 Std · 24 Std · 7 T · 30 T**, auf Wunsch dazu **6 Std**
  und **12 Std** — kurze Fenster aus der Rohhistorie, lange aus den
  Langzeitstatistiken
- Scrubbing, Pinch-Zoom und Pan
- Kacheln für Verbrauch, Maximum und Minimum des gewählten Zeitraums, optional
  eine zweite Reihe mit den Tageswerten und eine dritte mit den Kosten
- **Analyse-Ansicht**: Verbrauch als Balken über Tage, Wochen, Monate und Jahre,
  mit Vergleich zur Vorperiode, Hochrechnung, Grundlast und einer Wochen-Heatmap
- **Kosten** aus dem Energie-Dashboard von Home Assistant
- Deutsch und Englisch, hell und dunkel, Handy bis Desktop

## Installation über HACS

Die Karte ist noch nicht im HACS-Standardkatalog, lässt sich aber als eigenes
Repository hinzufügen — danach kommen Updates automatisch.

1. In HACS oben rechts auf **⋮ → Custom repositories**
2. Repository: `https://github.com/c0ball/energy-dashboard`
   Typ: **Dashboard**
3. Auf **Add**, dann in der Liste **Energy Card** öffnen und
   **Download** wählen
4. Home Assistant neu starten, wenn HACS danach fragt
5. Im Dashboard *Karte hinzufügen → Energy Card*

Die Lovelace-Ressource legt HACS selbst an — der Weg über *Einstellungen →
Dashboards → Ressourcen* entfällt. Das gilt allerdings nur für Dashboards im
**Storage-Modus** (der Normalfall). Wer seine Dashboards in YAML pflegt, trägt
die Ressource weiterhin von Hand ein:

```yaml
lovelace:
  resources:
    - url: /hacsfiles/energy-dashboard/energy-card.js
      type: module
```

## Installation von Hand

Ohne HACS genügt die gebündelte Datei aus dem
[jüngsten Release](https://github.com/c0ball/energy-dashboard/releases) —
`src/` wird dafür nicht gebraucht.

1. `energy-card.js` nach `/config/www/energy-card/` kopieren
   (per Samba-Freigabe, SSH-Add-on oder Studio Code Server).
2. **Musste der Ordner `www/` dafür erst angelegt werden: Home Assistant
   neu starten** (*Einstellungen → System → Neu starten*). Der Pfad `/local`
   wird nur beim Start registriert — existiert `www/` zu diesem Zeitpunkt
   nicht, liefert HA darunter dauerhaft 404 aus, und kein Cache-Leeren der Welt
   hilft. Ein blosses Neuladen der Konfiguration genügt nicht.
3. *Einstellungen → Dashboards → ⋮ → Ressourcen → Ressource hinzufügen*
   - URL: `/local/energy-card/energy-card.js?v=1`
   - Typ: **JavaScript-Modul**
4. Browser hart neu laden (Strg/Cmd + Shift + R), dann im Dashboard
   *Karte hinzufügen → Energy Card*.

Nach jeder Aktualisierung die Versionsnummer in der Ressourcen-URL hochzählen
(`?v=2`, `?v=3`, …) — sonst liefert der Browser die alte Fassung aus. Über HACS
erledigt sich das von selbst.

### Erscheint die Karte nicht im Auswahldialog?

Dann wurde das Modul nicht geladen. Prüfen lässt sich das ohne Anmeldung direkt
im Browser oder per `curl` — die Datei muss mit Status 200 antworten:

```bash
# bei Installation über HACS
curl -I http://homeassistant.local:8123/hacsfiles/energy-dashboard/energy-card.js
# bei Installation von Hand
curl -I http://homeassistant.local:8123/local/energy-card/energy-card.js
```

Kommt hier 404, liegt es bei der Handinstallation fast immer am fehlenden
Neustart (oder der Ordner liegt nicht in `/config/www/`). Kommt 200 und die
Karte fehlt trotzdem, steht der Grund in der Browser-Konsole.

## Beispiel für eine Abschnittsansicht

Damit die Karte die volle Breite bekommt, muss der **Abschnitt** über alle
Spalten gehen — die Karte selbst meldet mit `columns: "full"` bereits die volle
Abschnittsbreite an:

```yaml
views:
  - type: sections
    max_columns: 4          # Anzahl Abschnittsspalten der Ansicht
    sections:
      - type: grid
        column_span: 4      # Abschnitt über alle vier Spalten
        cards:
          - type: heading
            heading: Strom
          - type: custom:energy-card
            title: Pulse
            power_entity: sensor.tibber_pulse_zuhause_leistung
            energy_today_entity: sensor.tibber_pulse_zuhause_kumulierter_verbrauch
```

Ohne `column_span` belegt der Abschnitt nur eine von vier Spalten — die Karte
bleibt dann bei rund 500 px, egal wie breit der Bildschirm ist.

Einen `grid_options`-Block braucht es nicht. Ohne ihn gelten die Vorgaben der
Karte (`columns: "full"`, `rows: "auto"`); eine feste Zeilenzahl würde die Karte
auf breiten Dashboards unten abschneiden, weil das Chart mit der Breite wächst.

**Zur Entity-Wahl:** Bei der Tibber-Integration ist
`..._kumulierter_verbrauch` der Tagesverbrauch — nicht zu verwechseln mit
`..._kumulierter_verbrauch_aktuelle_stunde`, der nur die laufende Stunde zählt
und unter der Überschrift „Heute verbraucht" falsch wäre.

Jede Abschnittsspalte ist auf 500 px gedeckelt. Wer wirklich bis zum
Bildschirmrand will, hebt die Grenze im Theme an:

```yaml
mein-theme:
  ha-view-sections-column-max-width: 800px
```

## Beispiel für eine Panel-Ansicht

Soll die Karte eine Ansicht ganz für sich haben — etwa auf einem Wandtablet —,
ist `type: panel` der direktere Weg. Dort gibt es weder die 500-px-Grenze noch
`column_span`:

```yaml
views:
  - type: panel
    title: Tibber
    cards:
      - type: custom:energy-card
        title: Pulse
        power_entity: sensor.tibber_pulse_zuhause_leistung
        energy_today_entity: sensor.tibber_pulse_zuhause_kumulierter_verbrauch
        ranges: [5min, 1h, 6h, 12h, 24h, 7d, 30d]
        show_today_tiles: true
```

Auf einem Wandtablet ist genug Platz für alle sieben Zeiträume in einer Zeile
und für die zweite Kachelreihe — auf dem Handy würde beides umbrechen.

Umstellen lässt sich das auch per UI: Ansicht bearbeiten → *Ansichtstyp* →
**Panel (einzelne Karte)**.

Die Karte füllt dort Breite **und** Höhe: das Chart wächst in den freien Raum
statt darunter Leerraum zu lassen — auf einem 1280 × 900-Bildschirm etwa auf
482 px statt 380 px. Wird es eng, schrumpft es bis auf 170 px, bevor die Karte
über den Rand liefe. Rahmen und Eckenrundung übernimmt sie vom Thema
(`--ha-card-border-radius`), wird in der Panel-Ansicht also automatisch eckig.

Zwei Dinge sind zu beachten:

- **Nur eine Karte pro Ansicht.** Für Überschrift plus Karte braucht es einen
  `vertical-stack` als einzige Karte.
- **Die Kopfzeile des Dashboards bleibt.** Home Assistant kennt keine Option,
  sie auszublenden — dafür braucht es die HACS-Integration *kiosk-mode*:

  ```yaml
  kiosk_mode:
    hide_header: true
  ```

## Konfiguration

Ohne jede Option sucht sich die Karte selbst einen passenden Sensor
(`device_class: power`, bevorzugt einer mit „Pulse" oder „Tibber" im Namen):

```yaml
type: custom:energy-card
```

Vollständig ausgeschrieben:

```yaml
type: custom:energy-card
title: Pulse                      # leer lassen blendet die Überschrift aus
power_entity: sensor.power_s19
energy_today_entity: sensor.accumulated_consumption_s19
ranges: [5min, 1h, 6h, 12h, 24h, 7d, 30d]
default_range: 1h                 # womit die Live-Ansicht aufmacht
default_level: month              # womit die Analyse aufmacht
gauge_max: 3000                   # weglassen: Ring folgt dem Tagesniveau
stats_scope: range                # range | today
show_stats: true
show_today_tiles: false           # zweite Kachelreihe mit den Tageswerten
show_minmax_band: true
thresholds:
  - { value: 0,   color: "#3ED2AC" }
  - { value: 300, color: "#3ED2AC" }
  - { value: 900, color: "#F06B1C" }
interactions:
  scrub: true
  zoom: true
  pan: true
```

| Option | Vorgabe | Bedeutung |
|---|---|---|
| `view` | `live` | `live`, `analysis` oder `tabs` — siehe [Die beiden Ansichten](#die-beiden-ansichten) |
| `power_entity` | Auto-Discovery | Sensor für die Momentanleistung (W, kW, MW) |
| `energy_today_entity` | Auto-Discovery | Zählt den heutigen Verbrauch. Fehlt er, integriert die Karte den Leistungsverlauf selbst |
| `ranges` | `[5min, 1h, 24h, 7d, 30d]` | Welche Zeitraum-Pillen erscheinen. `6h` und `12h` sind zusätzlich verfügbar; die Leiste sortiert selbst von kurz nach lang |
| `default_range` | `1h` | Mit welchem Zeitraum die Live-Ansicht aufmacht — siehe [Womit die Karte aufmacht](#womit-die-karte-aufmacht) |
| `gauge_max` | Tagesniveau | Bezugswert für den Ring in Watt |
| `stats_scope` | `range` | Worauf sich die obere Kachelreihe bezieht — siehe unten |
| `show_stats` | `true` | Die drei Kacheln unter dem Chart |
| `show_today_tiles` | `false` | Zweite Kachelreihe, die immer den laufenden Tag zeigt |
| `show_cost_tiles` | `false` | Dritte Kachelreihe mit den Kosten — siehe [Kosten](#kosten) |
| `show_minmax_band` | `true` | Streuungsband bei 24 Std und länger — siehe unten |
| `thresholds` | grün bis 300 W, orange ab 900 W | Farbverlauf, an absolute Wattwerte gekoppelt |
| `interactions` | alles an | Einzelne Gesten abschaltbar |
| `default_level` | `month` | Mit welcher Ebene die Analyse aufmacht: `day`, `week`, `month`, `year` |
| `analysis_levels` | alle | Welche Ebenen zur Auswahl stehen |
| `compare` | `true` | Vorperiode als Schattenbalken und Prozentangabe |
| `show_pattern` | `true` | Wochen-Heatmap unter den Balken |
| `show_baseload` | `true` | Grundlast-Zeile unter dem Chart |
| `pattern_weeks` | `4` | Wie viele Wochen die Heatmap zusammenfasst |
| `cost_entity` | Auto | Kostensensor, falls die Erkennung danebengreift |
| `price` | — | Fester Arbeitspreis je kWh, wenn kein Energie-Dashboard existiert |

Ein visueller Editor ist eingebaut — die Optionen lassen sich also auch ohne
YAML einstellen.

### Womit die Karte aufmacht

Beide Ansichten haben eine eigene Vorgabe: `default_range` für die Live-Ansicht,
`default_level` für die Analyse. Wer auf einem Wandtablet den Tagesverlauf sehen
will, stellt `default_range: 24h` ein; wer die Karte zum Beobachten einzelner
Geräte nutzt, eher `5min`.

```yaml
type: custom:energy-card
view: tabs
default_range: 24h        # Live öffnet mit dem Tagesverlauf
default_level: week       # Analyse öffnet mit der Woche
```

Der Startzeitraum muss unter den sichtbaren Pillen sein. Steht er nicht in
`ranges`, nimmt die Karte die erste Pille — ein Zeitraum, den man nicht wieder
anwählen könnte, wäre eine Sackgasse.

Umschalten zur Laufzeit hat Vorrang vor der Vorgabe: Wer gerade auf 7 T steht
und im Editor eine ganz andere Option ändert, bleibt auf 7 T. Nur wenn die
Vorgabe **selbst** geändert wird, springt die Karte sofort dorthin — sonst
liesse sich im Editor nicht sehen, was man gerade einstellt.

## Die beiden Ansichten

Die Karte kann zwei Dinge zeigen, und `view` entscheidet, welche:

| `view` | Was erscheint |
|---|---|
| `live` (Vorgabe) | Nur der Pulse-Screen. Bestehende Konfigurationen bleiben unverändert |
| `tabs` | Beides, umschaltbar über eine Reiterleiste am Kopf |
| `analysis` | Nur die Analyse. So lassen sich Live und Analyse als zwei getrennte Karten nebeneinander legen |

Der verborgene Reiter meldet sein Verlaufsabo ab und stoppt seinen Taktgeber —
ein Live-Abo weiterlaufen zu lassen, das niemand sieht, kostet den Core bei
jedem Messwert eine Nachricht. Beim Zurückschalten lädt er frisch nach.

### Die Analyse-Ansicht

Balken statt Kurve: jeder Balken ist ein Zeitraum mit einer Summe. Fünf Ebenen,
durch die sich mit den Pfeilen, einem Zwei-Finger-Wisch oder dem Mausrad
blättern lässt:

| Ebene | Ein Balken ist | Balken |
|---|---|---|
| Tag | eine Stunde | 23–25 |
| Woche | ein Tag | 7 |
| Monat | ein Tag | 28–31 |
| Jahr | ein Monat | 12 |

Darunter steht dauerhaft die [Musteransicht](#die-musteransicht).

Dass „Tag" mal 23 und mal 25 Balken hat, ist kein Fehler: an den beiden
Umstellungssonntagen im Jahr hat der Tag genau so viele Stunden. Die Karte
rechnet durchgehend mit lokalen Kalendergrenzen statt mit 86 400 000
Millisekunden, sonst verrutschten Balken und Datum zweimal jährlich
gegeneinander.

**Ein Finger liest, zwei Finger blättern.** Bewusst kein Blättern per
Einfinger-Wisch: waagerechtes Ziehen liest hier Werte ab, genau wie in der
Live-Ansicht. Würde derselbe Wisch je nach Tempo mal das eine und mal das andere
tun, wäre keine der beiden Gesten verlässlich.

Unter der Kopfzahl steht das Mittel je Balken und, solange der Zeitraum läuft,
eine Hochrechnung. Beide rechnen nur auf **abgeschlossenen** Balken — die
angebrochene Stunde mitzumitteln würde die Prognose morgens früh systematisch zu
niedrig ausfallen lassen. Der laufende Balken wird trotzdem gezeichnet, nur die
noch nicht gelaufenen erscheinen blass auf Höhe des Mittelwerts.

### Vergleich mit der Vorperiode

Die Vorperiode liegt als blasser Schatten hinter den Balken, das Ergebnis steht
als Prozentangabe unter der Summe. Zwei Vorkehrungen sorgen dafür, dass die Zahl
etwas aussagt:

- **Bei einer laufenden Periode wird nur so weit verglichen, wie sie
  fortgeschritten ist** — am 15. August gegen den 1.–15. Juli. Gegen den ganzen
  Juli gerechnet stünde dort zwangsläufig „−50 %", und das sagt nichts über den
  Verbrauch aus, sondern nur über das Datum.
- **Gezählt werden nur Balken, für die beide Perioden Daten haben.** Bei einem
  Zähler, der erst seit ein paar Monaten läuft, ist die Vorperiode halb leer;
  ohne diese Regel stünde dort „+900 % gegenüber dem Vorjahr", obwohl schlicht
  die Vergleichsdaten fehlen. Deckt der Vergleich weniger als die Hälfte ab,
  entfällt er ganz.

Mit `compare: false` verschwinden Schatten und Prozentangabe.

### Die Musteransicht

Balken zeigen, *wie viel* verbraucht wurde — das Raster darunter zeigt, *wann*.
Die letzten vier Wochen (`pattern_weeks`) werden auf 7 × 24 Felder gefaltet und
nach Verbrauch eingefärbt. Über mehrere Wochen gemittelt treten Gewohnheiten
hervor, die in keiner Summe auftauchen: der Waschtag am Samstagvormittag, das
Kochfenster zwischen sechs und acht, die Stunde, in der jeden Werktag jemand
duscht.

Es steht **dauerhaft unter den Balken**, nicht als eigene Ebene: die beiden
beantworten verschiedene Fragen, und sie nebeneinander zu sehen ist der
eigentliche Gewinn. Rechts in der Kopfzeile steht die stärkste Stunde der Woche;
beim Überfahren eines Feldes tritt dessen Wert an ihre Stelle. Weil das Muster
nicht am gewählten Zeitraum hängt, wird es beim Blättern nicht neu geholt.

Mit `show_pattern: false` verschwindet der Abschnitt.

Gemittelt wird über die Vorkommen, nicht summiert — sonst käme ein Wochentag,
der im Fenster fünfmal vorkam, automatisch höher heraus als einer mit vier
Vorkommen. Felder ohne Daten bleiben blasse Platzhalter statt Nullen: „nie
gemessen" und „nichts verbraucht" sind verschiedene Aussagen.

### Die Grundlast

Unter dem Chart steht, was das Haus zieht, während niemand etwas tut — der
Median der Tagesminima der letzten Woche, hochgerechnet auf Tag und Monat.
Erfahrungsgemäss der überraschendste Posten einer Stromrechnung: 40 W Dauerlast
sind knapp 1 kWh am Tag, ohne dass je ein Schalter betätigt wurde.

Der Median statt des Mittelwerts, weil ein einzelner Tag mit durchlaufender
Waschmaschine sonst die ganze Aussage verschiebt.

## Kosten

Die Karte holt den Preis aus dem **Energie-Dashboard** von Home Assistant, statt
einen eigenen zu verlangen: wer die Energieseite einmal eingerichtet hat, soll
nichts doppelt pflegen. Gesucht wird der Reihe nach, von der genauesten Quelle
zur gröbsten:

1. `cost_entity` aus der Kartenkonfiguration
2. `stat_cost` aus den Energie-Einstellungen — eine fertige Kostenstatistik, die
   auch vergangene Preiswechsel korrekt abbildet
3. der von Home Assistant erzeugte Kostensensor
4. ein Preissensor (`entity_energy_price`), je Zeitblock im damaligen Mittel
5. ein fester Arbeitspreis aus den Energie-Einstellungen
6. `price` aus der Kartenkonfiguration

Die ersten drei liefern echte Kosten aus der Statistik, die letzten drei rechnen
Kilowattstunden mal Preis — bei einem festen Tarif dasselbe, rückwirkend aber
mit dem heutigen Preis gerechnet. Findet sich nichts, verschwinden alle
Kostenfunktionen stillschweigend; eine Fehlermeldung gibt es nicht.

**In der Analyse** schaltet ein kleiner Regler rechts neben der Summe zwischen
kWh und Euro um. Die Balken folgen mit, und beim Antippen eines Balkens steht
die jeweils andere Einheit daneben.

**Im Live-Screen** hängt `show_cost_tiles: true` eine dritte Kachelreihe an:

| | |
|---|---|
| `Kosten ‹Zeitraum›` | folgt derselben Spanne wie die Reihe darüber |
| `Kosten heute` | der laufende Tag |
| `Monat (Prognose)` | hochgerechnet aus den abgeschlossenen Tagen, darunter die erwarteten kWh |

Für Fenster unter zwei Stunden greift die Karte nicht auf die Blockstatistik zu:
die läge um bis zu einen ganzen Block daneben. Stattdessen rechnet sie mit dem
Arbeitspreis — und wo nur eine Kostenstatistik existiert, mit dem daraus
abgeleiteten Durchschnittspreis des Tages.

### Wenn kein Energie-Dashboard eingerichtet ist

Dann genügt ein fester Preis in der Karte:

```yaml
type: custom:energy-card
view: tabs
price: 0.324          # € je kWh
show_cost_tiles: true
```

### Das Min/Max-Band

Ab 24 Std kommen die Werte aus den Langzeitstatistiken, wo jeder Punkt ein
Stunden- oder Tagesmittel ist. Der Mittelwert allein verschweigt, dass in einer
Stunde mit Durchschnitt 200 W zwischendurch der Wasserkocher lief — deshalb legt
die Karte hinter die Kurve eine schwache Schattierung, die von der niedrigsten
bis zur höchsten Leistung jedes Intervalls reicht. Farblos, damit die
Watt-Färbung der Kurve die Aussage behält.

Die **Y-Achse richtet sich allein nach der Mittelwertkurve**, nicht nach dem
Band: eine einzelne Spitze würde die Skala sonst verdoppeln und den Tagesverlauf
zu einer flachen Linie am unteren Rand drücken. Das Band läuft stattdessen nach
oben aus dem Bild. Die tatsächliche Spitze steht weiterhin in der Kachel
„Maximum", auch wenn sie über die Achse hinausreicht.

Mit `show_minmax_band: false` verschwindet die Schattierung ganz.

### Bezug der Kacheln

Die Kacheln zeigen das, was das Chart gerade zeigt — bei 6 Std also die Spitze
dieser sechs Stunden und nicht die des ganzen Tages:

| Ansicht | Kacheln |
|---|---|
| ein gewählter Zeitraum | `Verbrauch 6 Std · Maximum 6 Std · Minimum 6 Std` |
| nach Zoom oder Pan | `Verbrauch Ausschnitt · Maximum Ausschnitt · Minimum Ausschnitt` |

Für den Ausschnitt ist kein zusätzlicher Abruf nötig, gerechnet wird auf den
bereits geladenen Punkten — die Zahlen folgen der Geste unmittelbar. Über
mehrere Tage hinweg steht unter Maximum und Minimum das Datum statt nur der
Uhrzeit, und unter 0,1 kWh wechselt die Verbrauchskachel auf Wattstunden, damit
ein Fünf-Minuten-Fenster nicht dauerhaft auf „0,00" steht.

Mit `stats_scope: today` bleibt die Reihe stattdessen fest beim laufenden Tag,
unabhängig vom Zeitraum.

#### Zweite Reihe mit den Tageswerten

`show_today_tiles: true` hängt unter die Kacheln eine zweite, etwas flachere
Reihe, die **immer** `Heute verbraucht · Maximum heute · Minimum heute` zeigt.
Damit lässt sich der gewählte Zeitraum direkt gegen den Tag halten, ohne den
Zeitraum zu wechseln. Auf schmalen Karten wischen beide Reihen gemeinsam, sodass
die Spalten untereinander bleiben.

Der Verbrauch kommt aus den Zählerstatistiken des Energiesensors; fehlt der,
integriert die Karte den Leistungsverlauf — das weicht erfahrungsgemäss um
einige Prozent ab. Unterhalb von zwei Stunden rechnet die Karte grundsätzlich
selbst: die Statistik liegt in festen Blöcken, und bei einem Fünf-Minuten-Fenster
bekäme die Kachel sonst den Verbrauch eines ganzen Blocks untergeschoben.

### Der Ring

Der Ring füllt sich relativ zum **95. Perzentil des heutigen Verlaufs**, nicht
zum Tagesmaximum: sonst würde ein einziger Wasserkocher-Peak am Vormittag den
Ring für den Rest des Tages auf einen Stummel schrumpfen. Läuft gerade ein
grosser Verbraucher, zieht der aktuelle Wert die Obergrenze mit hoch. Wer eine
feste Skala bevorzugt, setzt `gauge_max` auf einen Wattwert.

## Bedienung

| Geste | Wirkung |
|---|---|
| Ziehen mit einem Finger / der Maus | Wert an dieser Stelle ablesen; die Kopfzeile zeigt Uhrzeit und Leistung |
| Zwei Finger | Zoomen und Verschieben der Zeitachse |
| Mausrad | Zoomen; mit Shift oder seitlichem Wischen verschieben |
| Doppeltipp | Zurück zum gewählten Zeitraum |
| Tippen auf Kopfzeile oder Kachel | Öffnet den gewohnten Entitätsdialog |

Vertikales Wischen bleibt dem Dashboard überlassen — die Karte fängt es nicht ab.

## Woher die Daten kommen

| Zeitraum | Quelle | Auflösung |
|---|---|---|
| 5 Min, 1 Std | `history/stream` (Live-Abo) | Rohwerte, im Takt des Pulse |
| 24 Std | Langzeitstatistik, `5minute` | 288 Punkte |
| 7 T, 30 T | Langzeitstatistik, `hour` | 168 bzw. 720 Punkte |
| darüber hinaus (gezoomt) | Langzeitstatistik, `day` | ein Punkt je Tag |

Beim Zoomen wechselt die Karte selbsttätig in die passende Auflösung.

**Voraussetzung für die langen Zeiträume:** der Sensor braucht
`state_class: measurement`, sonst legt der Recorder keine Statistiken an. Die
Tibber-Integration bringt das mit. Fehlen Statistiken, weicht die Karte
stillschweigend auf die Rohhistorie aus — die reicht standardmässig aber nur
`purge_keep_days` (Vorgabe: 10 Tage) zurück. Aus demselben Grund existieren
5-Minuten-Statistiken nur für die letzten Tage; Stundenwerte bleiben dauerhaft.

## Entwicklung

Im Ordner `energy-card/dev/` liegt ein Prüfstand mit nachgebildeter
Home-Assistant-Instanz — ohne laufendes Home Assistant:

```bash
python3 -m http.server 8899
open http://localhost:8899/energy-card/dev/index.html
```

Über die Leiste oben lassen sich Lastszenario, Sprache, Thema und Kartenbreite
umschalten. Nützliche Parameter:

- `?scenario=low|high` — die beiden Referenzverläufe aus den App-Screenshots
- `?lang=de|en`, `?theme=dark|light`, `?w=430|800|1200`
- `?t=2026-08-14T20:19:00` — feste Uhrzeit für vergleichbare Screenshots
- `?live=0` — Uhr anhalten
- `?bundle=1` — statt der Quellmodule das gebaute Bündel laden
- `?start=2026-08-01` — Zähler mit kurzer Historie nachstellen

Die Messreihen leitet der Prüfstand aus einer einzigen Lastfunktion ab, sodass
sich Rohhistorie und Statistiken zueinander so verhalten wie beim echten
Recorder.

### Bauen

Entwickelt wird ohne Build: der Browser lädt die Module unter `src/` einzeln
als native ES-Module. Nur das ausgelieferte Artefakt wird gebündelt.

```bash
npm install
npm run build     # -> dist/energy-card.js
```

**Warum überhaupt gebündelt:** Home Assistant liefert `/hacsfiles/` mit langen
Cache-Headern aus, und HACS hängt seinen Versionsstempel nur an die
Einstiegsdatei. Bei 17 einzelnen Modulen könnten nach einem Update alte und neue
Teile aufeinandertreffen — ein Fehlerbild, das wie ein Kartenfehler aussieht und
sich nur durch einen harten Reload beheben lässt. Eine Datei, ein Stempel, kein
Zwischenzustand.

Mit `?bundle=1` läuft der Prüfstand gegen das Bündel statt gegen die Quelle.
Beides muss sich identisch verhalten — das ist die Prüfung, die vor einem
Release zählt.

### Ein Release veröffentlichen

1. `VERSION` in `energy-card/energy-card.js` und `version` in
   `package.json` auf die neue Nummer setzen
2. `npm run build`, Änderungen samt `dist/` committen
3. Auf GitHub ein Release mit dem Tag `vX.Y.Z` anlegen

Der Release-Lauf unter `.github/workflows/` baut das Bündel erneut, vergleicht
die Version im Bündel mit dem Tag und hängt die Datei an das Release. Passt die
Version nicht, schlägt der Lauf fehl, statt eine falsch beschriftete Fassung zu
veröffentlichen.

## Aufbau

```
hacs.json                          HACS-Manifest
package.json                       nur der Build — die Karte selbst hat keine Abhängigkeiten
dist/energy-card.js         gebündeltes Artefakt, das ausgeliefert wird
.github/workflows/release.yml      baut und hängt es an jedes Release

energy-card/
  energy-card.js            Einstiegspunkt, Registrierung
  dev/                             Prüfstand mit nachgebildetem Home Assistant
  src/card.js                      Kartenelement: Zustand, Layout, Orchestrierung
  src/analysis.js                  Analyse-Ansicht: Ebenen, Blättern, Kennzahlen
  src/chart.js                     Linienchart: Pfade, Farbverlauf, Achsen
  src/bars.js                      Balkenchart der Analyse
  src/heatmap.js                   Wochen-Heatmap (7 × 24)
  src/periods.js                   Kalenderrechnung für Tag/Woche/Monat/Jahr
  src/cost.js                      Preis- und Kostenauflösung
  src/interactions.js              Scrub, Pinch-Zoom, Pan, Balkenauswahl
  src/data.js                      WebSocket-Abfragen, Auflösung, Downsampling
  src/discovery.js                 Auto-Discovery der Entities
  src/editor.js                    Visueller Editor
  src/i18n.js                      Übersetzungen
  src/theme.js                     Farbtoken und Schwellenlogik
  src/scale.js                     Achsenteilung, von beiden Charts genutzt
  src/svg.js                       SVG-Helfer, von beiden Charts genutzt
  src/styles.js                    Stylesheet
  src/format.js                    Zahlen-, Zeit- und Währungsformate
```
