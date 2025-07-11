const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path'); // <<< HINZUGEFÜGT: Modul zum Arbeiten mit Dateipfaden

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Bestimme den Port: Verwende den Port, den Render zur Verfügung stellt (process.env.PORT),
// oder standardmäßig 10000, wenn es lokal läuft.
const PORT = process.env.PORT || 10000;

// Hier wird der statische Ordner definiert.
// WICHTIG: 'public' wurde zu 'docs' geändert, da deine Frontend-Dateien jetzt im 'docs'-Ordner liegen.
// path.join(__dirname, 'docs') erstellt einen robusten Pfad zum 'docs'-Ordner.
app.use(express.static(path.join(__dirname, 'docs'))); // <<< GEÄNDERT: von 'public' zu 'docs'

// Deine Socket.IO-Logik und Spiellogik beginnt hier
let players = {};
let playerNames = {};
let currentStichwort = '';
let currentWords = {};
let score = 0;
let roundCounter = 0; // Zähler für die Runden
const MAX_ROUNDS = 8; // Maximal 8 Runden

const words = [
    "Freiheit", "Liebe", "Sport", "Natur", "Technik", "Kunst", "Glück", "Abenteuer",
    "Freundschaft", "Musik", "Essen", "Reisen", "Arbeit", "Familie", "Gesundheit", "Wissen",
    "Geld", "Träume", "Hoffnung", "Zeit", "Zukunft", "Vergangenheit", "Licht", "Schatten",
    "Mut", "Angst", "Sonne", "Mond", "Sterne", "Wasser", "Feuer", "Erde", "Luft",
    "Stille", "Lärm", "Farbe", "Form", "Geschwindigkeit", "Kraft", "Ruhe", "Chaos",
    "Ordnung", "Energie", "Geduld", "Hektik", "Fantasie", "Realität", "Sinn", "Unsinn"
];

function getRandomStichwort() {
    const randomIndex = Math.floor(Math.random() * words.length);
    return words[randomIndex];
}

io.on('connection', (socket) => {
    console.log('Ein Spieler verbunden:', socket.id);

    // Spieler zum Pool hinzufügen
    players[socket.id] = { id: socket.id, name: 'Unbekannt' };

    // Namen senden, wenn der Spieler verbunden ist
    socket.emit('playerNames', playerNames);

    // Wenn ein Spieler seinen Namen eingibt
    socket.on('setPlayerName', (name) => {
        if (Object.keys(playerNames).length < 2) {
            playerNames[socket.id] = name;
            players[socket.id].name = name; // Update name in players object
            io.emit('playerNames', playerNames); // Alle Spieler über neue Namen informieren
            console.log(`Spieler ${socket.id} hat sich als ${name} angemeldet.`);

            if (Object.keys(playerNames).length === 2) {
                console.log('Zwei Spieler bereit. Starte Spiel.');
                startGame();
            } else {
                socket.emit('status', 'Warte auf weiteren Spieler...');
            }
        } else {
            // Falls schon 2 Spieler da sind, aber ein dritter versucht beizutreten
            socket.emit('status', 'Spiel ist bereits voll.');
        }
    });

    // Wenn ein Spieler ein Wort sendet
    socket.on('submitWord', (word) => {
        if (Object.keys(currentWords).length < 2 && !currentWords[socket.id]) {
            currentWords[socket.id] = word;
            console.log(`${playerNames[socket.id]} hat das Wort "${word}" gesendet.`);

            if (Object.keys(currentWords).length === 2) {
                // Beide Spieler haben ein Wort gesendet, zeige sie an
                io.emit('wordsReceived', currentWords);
                io.emit('allWordsSubmitted', true); // Signalisiert, dass beide Wörter da sind
            }
        }
    });

    // Wenn der "Weiter"-Button geklickt wird
    socket.on('nextRound', () => {
        console.log('Weiter-Button gedrückt. Nächste Runde wird gestartet.');
        score++; // Erhöhe den Score
        roundCounter++; // Erhöhe den Runden-Zähler
        io.emit('updateScore', score, MAX_ROUNDS); // Score aktualisieren

        if (roundCounter >= MAX_ROUNDS) {
            console.log('Maximal 8 Runden erreicht. Spiel beendet.');
            endGame();
        } else {
            startNewRound();
        }
    });

    // Wenn der "Falsch"-Button geklickt wird
    socket.on('resetRound', () => {
        console.log('Falsch-Button gedrückt. Runde wird zurückgesetzt.');
        // Score bleibt gleich, nur Stichwort und Wörter werden zurückgesetzt
        roundCounter++; // Auch bei "Falsch" wird eine Runde gezählt
        io.emit('updateScore', score, MAX_ROUNDS); // Score aktualisieren (nur Anzeige der Runden)

        if (roundCounter >= MAX_ROUNDS) {
            console.log('Maximal 8 Runden erreicht. Spiel beendet.');
            endGame();
        } else {
            startNewRound();
        }
    });

    socket.on('disconnect', () => {
        console.log('Ein Spieler getrennt:', socket.id);
        delete players[socket.id];
        delete playerNames[socket.id];
        delete currentWords[socket.id]; // Entferne auch die Wörter des Spielers
        io.emit('playerNames', playerNames); // Aktualisiere Namen für verbleibende Spieler

        if (Object.keys(playerNames).length < 2) {
            console.log('Nicht genügend Spieler. Setze Spiel zurück.');
            resetGame(); // Spiel zurücksetzen, wenn ein Spieler geht
        }
    });
});

function startGame() {
    score = 0;
    roundCounter = 0;
    io.emit('gameStarted', playerNames); // Sende Player Names an alle Clients beim Spielstart
    startNewRound();
}

function startNewRound() {
    currentStichwort = getRandomStichwort();
    currentWords = {}; // Wörter für die neue Runde zurücksetzen
    io.emit('newStichwort', currentStichwort);
    io.emit('allWordsSubmitted', false); // Buttons deaktivieren, bis neue Wörter da sind
    io.emit('clearWords'); // Alte Wörter löschen
    io.emit('updateScore', score, MAX_ROUNDS); // Score aktualisieren
    console.log(`Neue Runde gestartet. Stichwort: ${currentStichwort}`);
}

function resetGame() {
    players = {};
    playerNames = {};
    currentStichwort = '';
    currentWords = {};
    score = 0;
    roundCounter = 0;
    io.emit('resetGame'); // Signal an Clients, das Spiel zurückzusetzen
    console.log('Spiel komplett zurückgesetzt.');
}

function endGame() {
    io.emit('gameEnded', score); // Sende finalen Score
    // Optional: Hier könnten weitere Aktionen für den Spiel-Endbildschirm erfolgen
}

server.listen(PORT, () => {
    console.log(`Server läuft auf Port ${PORT}`);
    console.log(`Öffne im Browser: http://localhost:${PORT}`);
});