// server.js - FINALE VERSION (mit "Falsch"-Bestätigung & intelligentem Reset)

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// ----- Spiel Variablen -----
// Speichert die Socket-IDs und Namen der Spieler: { socketId: { name: 'Spielername', score: 0, isReady: false } }
let players = {};
// Reihenfolge der Spieler-Sockets (wichtig für Spieler 1 und Spieler 2 Zuordnung)
let playerSockets = [];
let currentWord = ''; // Das aktuelle Stichwort für die Runde
let playerInputs = {}; // { socketId: 'eingegebenes Wort' } - speichert die Eingaben der aktuellen Runde
let gameRound = 0; // Aktuelle Rundenzahl
const MAX_ROUNDS = 8; // Maximale Runden pro Spiel
const WORD_LIST = [ // Liste der möglichen Stichwörter
    "Apfel", "Baum", "Wasser", "Sonne", "Hund", "Katze", "Haus", "Buch", "Stuhl", "Tisch",
    "Blume", "Regen", "Wolke", "Berg", "Fluss", "Auto", "Fahrrad", "Schule", "Freund", "Glück",
    "Musik", "Essen", "Trinken", "Sport", "Computer", "Telefon", "Stadt", "Land", "Meer", "Himmel",
    "Mond", "Stern", "Feuer", "Erde", "Wind", "Schlaf", "Traum", "Zeit", "Geld", "Liebe",
    "Freiheit", "Frieden", "Hoffnung", "Reise", "Urlaub", "Arbeit", "Spiel", "Lachen", "Wein", "Kaffee"
];

let nextRoundClicks = 0;
// NEU: Zähler für "Falsch"-Klicks
let resetClicks = 0;

// ----- Helferfunktionen -----

// Wählt ein zufälliges Wort aus der WORD_LIST
function getRandomWord() {
    return WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)];
}

// Setzt den Spielzustand zurück, bewahrt aber die Spielernamen
function resetGame(keepNames = false) {
    // Wenn Namen behalten werden sollen, nur Score und Bereitschaft zurücksetzen
    if (keepNames) {
        for (let socketId of playerSockets) {
            if (players[socketId]) {
                players[socketId].score = 0;
                players[socketId].isReady = true; // Nach Reset sind Spieler direkt wieder bereit
            }
        }
    } else { // Komplettes Reset, wenn Spieler gehen oder initialer Start
        players = {};
        playerSockets = [];
    }
    currentWord = '';
    playerInputs = {};
    gameRound = 0;
    nextRoundClicks = 0;
    resetClicks = 0; // NEU: Zähler zurücksetzen
    console.log(`Spiel zurückgesetzt. Namen ${keepNames ? 'beibehalten' : 'gelöscht'}.`);
}

// Startet eine neue Spielrunde (oder initialisiert die erste Runde)
function startGame() {
    if (playerSockets.length === 2 && players[playerSockets[0]].isReady && players[playerSockets[1]].isReady) {
        gameRound = 1; // Spiel beginnt mit Runde 1
        currentWord = getRandomWord(); // Neues Stichwort wählen
        playerInputs = {}; // Eingaben für die neue Runde zurücksetzen
        nextRoundClicks = 0; // Sicherstellen, dass der Zähler zurückgesetzt ist
        resetClicks = 0; // Sicherstellen, dass der Zähler zurückgesetzt ist

        // Scores zurücksetzen (nur hier, wenn ein NEUES Spiel gestartet wird, nicht bei "play again")
        // Wenn startGame nach einem Reset (keepNames=true) aufgerufen wird, sind die Scores schon 0
        if (players[playerSockets[0]].score !== 0 || players[playerSockets[1]].score !== 0) {
            for (let socketId in players) {
                players[socketId].score = 0;
            }
        }

        // Sende das gameStarted-Event an alle Clients
        io.emit('gameStarted', {
            currentWord: currentWord,
            scores: { // Sende die initialen Scores (alle 0)
                [playerSockets[0]]: players[playerSockets[0]].score,
                [playerSockets[1]]: players[playerSockets[1]].score
            },
            round: gameRound // Sende die aktuelle Rundenzahl
        });
        console.log(`Spiel gestartet. Aktuelles Wort: ${currentWord}. Runde: ${gameRound}`);
    } else {
        console.log("Kann Spiel nicht starten: Nicht genügend oder nicht alle Spieler bereit.");
    }
}

// Führt die Logik für eine neue Runde aus (nachdem beide Spieler geklickt haben)
function proceedToNextRound() {
    const p1Id = playerSockets[0];
    const p2Id = playerSockets[1];

    // --- Punkte vergeben ---
    // Sicherstellen, dass beide Spieler Wörter eingegeben haben, bevor Punkte vergeben werden
    if (playerInputs[p1Id] && playerInputs[p2Id]) {
        // Case-insensitive Vergleich
        if (playerInputs[p1Id].toLowerCase() === playerInputs[p2Id].toLowerCase()) {
            players[p1Id].score++; // Spieler 1 bekommt Punkt
            players[p2Id].score++; // Spieler 2 bekommt Punkt
            console.log(`Punkte für Übereinstimmung vergeben! Aktuelle Scores: Spieler 1 (${players[p1Id].name}): ${players[p1Id].score}, Spieler 2 (${players[p2Id].name}): ${players[p2Id].score}`);
        } else {
            console.log("Keine Übereinstimmung der Wörter, keine Punkte vergeben.");
        }
    } else {
        console.log("Nicht beide Spieler hatten Wörter eingegeben, keine Punkte vergeben.");
    }

    // Erhöhe die Rundenzahl und überprüfe, ob die maximale Rundenzahl erreicht ist
    gameRound++;
    if (gameRound <= MAX_ROUNDS) {
        currentWord = getRandomWord(); // Neues Wort für die nächste Runde wählen
        playerInputs = {}; // Eingaben für die nächste Runde zurücksetzen
        nextRoundClicks = 0; // Zähler für "Weiter"-Klicks für die neue Runde zurücksetzen
        resetClicks = 0; // NEU: Zähler für Falsch-Klicks zurücksetzen (wichtig, falls jemand Falsch drückt und dann Weiter)
        
        // Aktualisierte Scores für die nächste Runde sammeln
        const updatedScores = {
            [p1Id]: players[p1Id].score,
            [p2Id]: players[p2Id].score
        };

        // Sende die Informationen zur neuen Runde an alle Clients
        io.emit('newRound', {
            currentWord: currentWord,
            scores: updatedScores, // Die aktualisierten Scores mitsenden
            round: gameRound
        });
        console.log(`Nächste Runde gestartet. Neues Wort: ${currentWord}. Runde: ${gameRound}/${MAX_ROUNDS}`);
    } else {
        // Spiel beendet, wenn MAX_ROUNDS erreicht
        io.emit('gameOver', {
            winner: 'Beide', // Oder logik für echten Gewinner bei unterschiedlichen Punkten
            scores: {
                [p1Id]: players[p1Id].score,
                [p2Id]: players[p2Id].score
            }
        });
        console.log('Spiel beendet. Max. Runden erreicht.');
        resetGame(true); // Spiel nach Ende zurücksetzen, Namen bleiben aber erhalten
        // Client wird über 'gameOver' benachrichtigt und wechselt zum WinScreen,
        // von dort aus kann 'playAgainButton' ein resetGame(true) triggern,
        // was dann startGame() aufruft
    }
}


// ----- Statische Dateien bereitstellen (HTML, CSS, JS für den Browser) -----
app.use(express.static(path.join(__dirname, 'public')));

// Standard-Route für die Startseite
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ----- Socket.IO Verbindungslogik -----
io.on('connection', (socket) => {
    console.log(`Ein Benutzer verbunden: ${socket.id}`);

    if (playerSockets.length < 2) {
        playerSockets.push(socket.id);
        players[socket.id] = { name: `Spieler ${playerSockets.length}`, score: 0, isReady: false };
        
        console.log(`Spieler ${playerSockets.length} verbunden: ${socket.id}`);
        socket.emit('playerAssigned', { id: socket.id, name: players[socket.id].name, numPlayers: playerSockets.length });

        const p1Name = players[playerSockets[0]] ? players[playerSockets[0]].name : '';
        const p2Name = (playerSockets.length > 1 && players[playerSockets[1]]) ? players[playerSockets[1]].name : '';
        io.emit('updatePlayerNames', { player1: p1Name, player2: p2Name });

        if (playerSockets.length === 2) {
            io.emit('waitingForPlayers', 'Beide Spieler verbunden. Bitte Namen eingeben und "Fertig" klicken.');
        } else {
            io.emit('waitingForPlayers', 'Warte auf einen zweiten Spieler...');
        }
    } else {
        socket.emit('gameFull', 'Das Spiel ist bereits voll. Bitte später erneut versuchen.');
        socket.disconnect();
        return;
    }

    // Event-Handler: Spieler sendet seinen Namen und signalisiert Bereitschaft
    socket.on('setPlayerName', (data) => {
        const name = data.name;
        const isReady = data.isReady;

        if (players[socket.id]) {
            players[socket.id].name = name;
            if (isReady) {
                players[socket.id].isReady = true;
            }
            
            const p1Name = players[playerSockets[0]] ? players[playerSockets[0]].name : '';
            const p2Name = (playerSockets.length > 1 && players[playerSockets[1]]) ? players[playerSockets[1]].name : '';
            io.emit('updatePlayerNames', { player1: p1Name, player2: p2Name });
            console.log(`Spieler ${socket.id} hat sich umbenannt zu: ${name}. Bereit: ${isReady}`);

            const allPlayersReady = playerSockets.length === 2 && players[playerSockets[0]].isReady && players[playerSockets[1]].isReady;
            if (allPlayersReady) {
                console.log('Beide Spieler sind bereit. Starte Spiel...');
                startGame();
            } else if (playerSockets.length === 2) {
                io.emit('waitingForPlayers', 'Beide Spieler verbunden. Warte auf Bestätigung des anderen Spielers...');
            }
        }
    });

    // Event-Handler: Spieler sendet sein Wort
    socket.on('submitWord', (word) => {
        if (gameRound === 0 || !players[socket.id]) {
            console.log(`Fehler: Wort von ${socket.id} in ungültigem Zustand erhalten.`);
            return;
        }

        playerInputs[socket.id] = word;
        console.log(`Spieler ${players[socket.id].name} (${socket.id}) hat eingegeben: ${word}`);

        if (Object.keys(playerInputs).length === 2) {
            const p1Id = playerSockets[0];
            const p2Id = playerSockets[1];

            io.emit('showResults', {
                player1Name: players[p1Id].name,
                player1Word: playerInputs[p1Id],
                player2Name: players[p2Id].name,
                player2Word: playerInputs[p2Id],
                scores: {
                    [p1Id]: players[p1Id].score,
                    [p2Id]: players[p2Id].score
                }
            });
            console.log(`Beide Spieler haben eingegeben. Ergebnisse gesendet.`);
        }
    });

    // Event-Handler: "Weiter"-Button wurde geklickt (nächste Runde)
    socket.on('nextRound', () => {
        if (gameRound === 0 || Object.keys(playerInputs).length !== 2) {
            console.log(`Fehler: "Weiter" Klick von ${socket.id} in ungültigem Zustand erhalten.`);
            return;
        }

        nextRoundClicks++;
        console.log(`Spieler ${players[socket.id].name} hat auf "Weiter" geklickt. Klicks: ${nextRoundClicks}/2`);

        if (nextRoundClicks === 2) {
            nextRoundClicks = 0; // Zähler zurücksetzen
            resetClicks = 0; // WICHTIG: Reset-Zähler auch zurücksetzen, falls er inkrementiert wurde
            proceedToNextRound(); // Führe die Logik für die nächste Runde aus
        } else {
            socket.emit('waitingForNextRoundClick', 'Warte auf den anderen Spieler...');
        }
    });

    // NEU: Event-Handler für "Falsch"-Button Klick
    socket.on('requestResetGame', () => {
        if (gameRound === 0) { // Falls Spiel noch gar nicht gestartet ist
            resetGame(false); // Kompletter Reset
            io.emit('gameReset', 'Spiel wurde manuell zurückgesetzt.');
            return;
        }

        resetClicks++;
        console.log(`Spieler ${players[socket.id].name} hat auf "Falsch" geklickt. Reset-Klicks: ${resetClicks}/2`);

        if (resetClicks === 2) {
            resetGame(true); // Spiel zurücksetzen, Namen behalten, Scores auf 0
            io.emit('gameReset', 'Beide Spieler haben das Spiel zurückgesetzt. Starte neu...');
            // Da resetGame(true) die Spieler auf isReady=true setzt, können wir startGame() direkt aufrufen
            startGame(); // Startet das Spiel direkt neu mit den gleichen Spielernamen
        } else {
            socket.emit('waitingForResetClick', 'Warte auf den anderen Spieler zum Zurücksetzen...');
        }
    });

    // Event-Handler: Verbindung getrennt
    socket.on('disconnect', () => {
        console.log(`Ein Benutzer getrennt: ${socket.id}`);
        const disconnectedPlayerId = socket.id;

        delete players[disconnectedPlayerId];
        playerSockets = playerSockets.filter(id => id !== disconnectedPlayerId);
        playerInputs = {};
        nextRoundClicks = 0;
        resetClicks = 0; // NEU: Reset-Zähler zurücksetzen

        if (playerSockets.length < 2) {
            resetGame(false); // Kompletter Reset, wenn ein Spieler geht (Namen auch weg)
            io.emit('gameReset', 'Ein Spieler hat die Verbindung getrennt. Das Spiel wurde zurückgesetzt. Warte auf neue Spieler.');
        }

        const p1Name = players[playerSockets[0]] ? players[playerSockets[0]].name : '';
        const p2Name = (playerSockets.length > 1 && players[playerSockets[1]]) ? players[playerSockets[1]].name : '';
        io.emit('updatePlayerNames', { player1: p1Name, player2: p2Name });
    });
});

// Server starten
server.listen(PORT, () => {
    console.log(`Server läuft auf Port ${PORT}`);
    console.log(`Öffne im Browser: http://localhost:${PORT}`);
});