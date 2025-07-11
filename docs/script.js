// Verbindung zum Socket.IO-Server herstellen
// WICHTIG: Ersetze 'https://assoziationsspiel-server.onrender.com' mit der tatsächlichen URL deines Render-Servers!
const socket = io('https://assoziationsspiel-server.onrender.com');

// Referenzen zu DOM-Elementen
const startScreen = document.getElementById('startScreen');
const gameScreen = document.getElementById('gameScreen');
const playerNameInput = document.getElementById('playerNameInput');
const setPlayerNameButton = document.getElementById('setPlayerNameButton');
const statusMessage = document.getElementById('statusMessage');
const currentStichwortElement = document.getElementById('currentStichwort');
const wordInput = document.getElementById('wordInput');
const submitWordButton = document.getElementById('submitWordButton');
const player1NameElement = document.getElementById('player1Name');
const player2NameElement = document.getElementById('player2Name');
const player1WordElement = document.getElementById('player1Word');
const player2WordElement = document.getElementById('player2Word');
const nextRoundButton = document.getElementById('nextRoundButton');
const resetRoundButton = document.getElementById('resetRoundButton');
const scoreDisplay = document.getElementById('scoreDisplay');
const maxRoundsDisplay = document.getElementById('maxRoundsDisplay');

let localPlayerName = '';
let isGameActive = false; // Flag, um den Spielstatus zu verfolgen

// Event-Listener für Buttons
setPlayerNameButton.addEventListener('click', () => {
    const name = playerNameInput.value.trim();
    if (name) {
        localPlayerName = name; // Speichere den Namen lokal
        socket.emit('setPlayerName', name);
        playerNameInput.disabled = true; // Deaktiviere das Eingabefeld
        setPlayerNameButton.disabled = true; // Deaktiviere den Button
        statusMessage.textContent = 'Warte auf weiteren Spieler...'; // Setze Status für den ersten Spieler
    } else {
        alert('Bitte gib deinen Namen ein.');
    }
});

submitWordButton.addEventListener('click', () => {
    const word = wordInput.value.trim();
    if (word) {
        socket.emit('submitWord', word);
        wordInput.value = ''; // Eingabefeld leeren
        submitWordButton.disabled = true; // Senden-Button deaktivieren, bis beide Wörter da sind
    } else {
        alert('Bitte gib ein Wort ein.');
    }
});

nextRoundButton.addEventListener('click', () => {
    socket.emit('nextRound');
    nextRoundButton.classList.add('hidden'); // Buttons wieder ausblenden
    resetRoundButton.classList.add('hidden');
});

resetRoundButton.addEventListener('click', () => {
    socket.emit('resetRound');
    nextRoundButton.classList.add('hidden'); // Buttons wieder ausblenden
    resetRoundButton.classList.add('hidden');
});

// Socket.IO Events
socket.on('connect', () => {
    console.log('Verbunden mit Server:', socket.id);
});

socket.on('disconnect', () => {
    console.log('Verbindung zum Server verloren.');
    isGameActive = false;
    // Hier könntest du eine Meldung anzeigen, dass die Verbindung verloren wurde
    alert('Verbindung zum Spielserver unterbrochen. Bitte lade die Seite neu.');
    resetUI(); // Setze das UI zurück, falls Server trennt
});

socket.on('playerNames', (playerNames) => {
    const pIds = Object.keys(playerNames);
    player1NameElement.textContent = playerNames[pIds[0]] || 'Spieler 1';
    player2NameElement.textContent = playerNames[pIds[1]] || 'Spieler 2';

    // Wenn der lokale Spieler der erste ist, stelle sicher, dass sein Name richtig zugeordnet wird
    if (pIds[0] === socket.id) {
        player1NameElement.textContent = localPlayerName;
        player2NameElement.textContent = playerNames[pIds[1]] || 'Spieler 2';
    } else if (pIds[1] === socket.id) {
        player2NameElement.textContent = localPlayerName;
        player1NameElement.textContent = playerNames[pIds[0]] || 'Spieler 1';
    }
});

socket.on('gameStarted', (playerNames) => {
    console.log('Spiel gestartet!');
    isGameActive = true;
    startScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    statusMessage.textContent = ''; // Statusmeldung leeren

    const pIds = Object.keys(playerNames);
    player1NameElement.textContent = playerNames[pIds[0]] || 'Spieler 1';
    player2NameElement.textContent = playerNames[pIds[1]] || 'Spieler 2';

    // Setze die Namen basierend auf der tatsächlichen Zuordnung,
    // damit der Spieler seine eigene Box als "Dein Wort" sehen könnte (optional)
    if (pIds[0] === socket.id) {
        player1NameElement.textContent = localPlayerName;
    } else if (pIds[1] === socket.id) {
        player2NameElement.textContent = localPlayerName;
    }
});

socket.on('newStichwort', (stichwort) => {
    currentStichwortElement.textContent = stichwort;
    wordInput.value = ''; // Eingabefeld leeren
    submitWordButton.disabled = false; // Senden-Button aktivieren
    player1WordElement.textContent = ''; // Wörter der vorherigen Runde löschen
    player2WordElement.textContent = '';
    console.log('Neues Stichwort erhalten:', stichwort);
});

socket.on('wordsReceived', (words) => {
    const playerIds = Object.keys(words);
    // Stelle sicher, dass die Wörter den richtigen Spielern zugeordnet werden
    playerIds.forEach(id => {
        if (socket.id === id) {
            // Dies ist das Wort des lokalen Spielers
            // Finde heraus, ob der lokale Spieler P1 oder P2 ist
            if (player1NameElement.textContent === localPlayerName) {
                player1WordElement.textContent = words[id];
            } else if (player2NameElement.textContent === localPlayerName) {
                player2WordElement.textContent = words[id];
            }
        } else {
            // Dies ist das Wort des anderen Spielers
            if (player1NameElement.textContent !== localPlayerName) {
                player1WordElement.textContent = words[id];
            } else if (player2NameElement.textContent !== localPlayerName) {
                player2WordElement.textContent = words[id];
            }
        }
    });

    submitWordButton.disabled = true; // Senden-Button nach dem Absenden deaktivieren
});

socket.on('allWordsSubmitted', (status) => {
    if (status) {
        // Zeige die Buttons "Weiter" und "Falsch" an
        nextRoundButton.classList.remove('hidden');
        resetRoundButton.classList.remove('hidden');
    }
});

socket.on('updateScore', (score, maxRounds) => {
    scoreDisplay.textContent = score;
    maxRoundsDisplay.textContent = maxRounds;
});

socket.on('gameEnded', (finalScore) => {
    alert(`Spiel beendet! Dein finaler Score ist: ${finalScore}`);
    resetUI(); // UI zurücksetzen nach Spielende
});

socket.on('resetGame', () => {
    resetUI();
    statusMessage.textContent = 'Warte auf 2 Spieler...';
    alert('Ein Spieler hat das Spiel verlassen. Spiel wurde zurückgesetzt.');
});

// Hilfsfunktion zum Zurücksetzen des UI
function resetUI() {
    startScreen.classList.remove('hidden');
    gameScreen.classList.add('hidden');
    playerNameInput.value = '';
    playerNameInput.disabled = false;
    setPlayerNameButton.disabled = false;
    statusMessage.textContent = 'Warte auf 2 Spieler...';
    currentStichwortElement.textContent = '';
    wordInput.value = '';
    submitWordButton.disabled = false;
    player1NameElement.textContent = 'Spieler 1';
    player2NameElement.textContent = 'Spieler 2';
    player1WordElement.textContent = '';
    player2WordElement.textContent = '';
    nextRoundButton.classList.add('hidden');
    resetRoundButton.classList.add('hidden');
    scoreDisplay.textContent = '0';
    maxRoundsDisplay.textContent = '8';
    localPlayerName = '';
    isGameActive = false;
}

socket.on('status', (message) => {
    statusMessage.textContent = message;
    // Wenn das Spiel schon gestartet ist, nicht die Start-Statusmeldung überschreiben
    if (!isGameActive) {
        startScreen.classList.remove('hidden');
        gameScreen.classList.add('hidden');
    }
});