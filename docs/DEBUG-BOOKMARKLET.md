# 🐛 Bookmarklet Debug-Anleitung

## Problem
Die Sidebar öffnet sich nicht, wenn das Bookmarklet angeklickt wird.

## 🧪 Schritt-für-Schritt Debug

### 1. Browser Console öffnen
Drücken Sie **F12** um die Developer Tools zu öffnen.

### 2. Bookmarklet klicken
Klicken Sie auf Ihr Bookmarklet und schauen Sie in die Console.

### 3. Erwartete Console-Ausgaben

**Wenn der Code läuft, sollten Sie sehen:**
```
🚀 Bookmarklet initialized
📝 Button should be visible at bottom right
📦 Container created, iframe loading...
```

**Nach 3 Sekunden entweder:**
```
✅ Iframe loaded, extracting page data...
📂 Opening sidebar...
```

**Oder (Fallback):**
```
⚠️ Iframe load timeout, opening sidebar anyway...
```

### 4. Mögliche Probleme

#### Problem A: Gar keine Console-Ausgabe
**Ursache:** Der Bookmarklet-Code läuft nicht
**Lösung:** 
- Prüfen Sie, ob der Code mit `javascript:` beginnt
- Stellen Sie sicher, dass der komplette Code kopiert wurde
- Browser-Cache leeren

#### Problem B: "MCanvas is already defined"
**Ursache:** Bookmarklet wurde mehrmals geklickt
**Lösung:** Seite neu laden (F5)

#### Problem C: Console zeigt Fehler
**Ursache:** Verschiedene mögliche Probleme
**Lösung:** Kopieren Sie den genauen Fehler für weitere Analyse

#### Problem D: Console-Ausgaben OK, aber keine Sidebar
**Ursache:** CSS oder z-index Problem
**Lösung:** 
```javascript
// In der Console ausführen:
document.getElementById('mc-c').style.right = '0px';
document.getElementById('mc-c').style.zIndex = '999999';
```

### 5. Button-Check

Sie sollten einen **blauen runden Button mit 📝** rechts unten sehen.

**Wenn nicht:**
```javascript
// In der Console ausführen:
const buttons = document.querySelectorAll('button');
console.log('Alle Buttons:', buttons);
```

### 6. Container-Check

```javascript
// In der Console ausführen:
const container = document.getElementById('mc-c');
console.log('Container:', container);
console.log('Container style.right:', container.style.right);
console.log('Container position:', container.getBoundingClientRect());
```

## 🧪 Test-Bookmarklet

Erstellen Sie ein Test-Lesezeichen mit diesem Code:

```javascript
javascript:(function(){console.log('🧪 TEST: Simple bookmarklet started');const container=document.createElement('div');container.id='test-sidebar';container.style.cssText='position:fixed;top:0;right:0;width:400px;height:100vh;background:#1976d2;color:white;z-index:999999;padding:20px;box-sizing:border-box;';container.innerHTML='<h1 style="margin:0 0 20px 0;">✅ Sidebar Test</h1><p>Wenn Sie dies sehen, funktioniert der Bookmarklet-Code!</p><button onclick="this.parentElement.remove()" style="padding:10px 20px;margin-top:20px;cursor:pointer;">Schließen</button>';document.body.appendChild(container);console.log('✅ TEST: Sidebar should be visible on the right');})();
```

**Wenn dieser Test funktioniert**, dann ist das Problem beim iframe oder der Vercel-URL.

## 🔍 iframe-Check

Wenn die Sidebar sich öffnet, aber leer ist:

```javascript
// In der Console ausführen:
const iframe = document.querySelector('#mc-c iframe');
console.log('Iframe:', iframe);
console.log('Iframe src:', iframe.src);
console.log('Iframe loaded:', iframe.contentWindow);
```

## 🌐 Vercel-URL Test

Öffnen Sie direkt im Browser:
```
https://metadata-agent-canvas.vercel.app/?mode=bookmarklet
```

**Sollte laden:** Die Canvas-Webkomponente

**Wenn 404 oder Fehler:** Die Vercel-URL ist falsch oder die App ist nicht deployed.

## 📝 Fehlerberichte

Bitte kopieren Sie folgende Informationen:

1. **Browser & Version:**
   ```javascript
   navigator.userAgent
   ```

2. **Console-Ausgaben:**
   Kopieren Sie alle Meldungen die mit 🚀, 📝, 📦, ✅ oder ⚠️ beginnen

3. **Fehler-Meldungen:**
   Kopieren Sie die vollständigen Fehlermeldungen (rot in der Console)

4. **Container-Status:**
   ```javascript
   const c = document.getElementById('mc-c');
   console.log({
     exists: !!c,
     right: c?.style.right,
     zIndex: c?.style.zIndex,
     visible: c?.getBoundingClientRect().width > 0
   });
   ```

## ✅ Wenn alles funktioniert

Sie sollten sehen:
- ✅ Blauer Button rechts unten (📝)
- ✅ Sidebar öffnet sich von rechts (weiß, 900px breit)
- ✅ Canvas lädt im iframe
- ✅ Nach kurzer Zeit: Webseiteninfos im Textfeld

---

**Letzte Aktualisierung:** 05.11.2025 11:17
