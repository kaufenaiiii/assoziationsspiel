// public/script.js - FINALE VERSION (mit "Falsch"-Bestätigung & intelligentem Reset)

const socket = io('https://assoziationsspiel-server.onrender.com'); // Stellt eine Verbindung zum Socket.IO Server her

// --- DOM-Elemente holen ---
const startScreen = document.getElementById('startScreen');
const player1NameInput = document.getElementById('player1NameInput');
const startGameButton = document.getElementById('startGameButton');
const statusMessage = document.getElementById('statusMessage');

const gameScreen = document.getElementById('gameScreen');
const currentStichwort = document.getElementById('currentStichwort');
const wordInput = document.getElementById('wordInput');
const submitWordButton = document.getElementById('submitWordButton');
const player1NameDisplay = document.getElementById('player1NameDisplay');
const player1WordDisplay = document.getElementById('player1WordDisplay');
const player2NameDisplay = document.getElementById('player2NameDisplay');
const player2WordDisplay = document.getElementById('player2WordDisplay');
const nextButton = document.getElementById('nextButton');
const resetButton = document.getElementById('resetButton'); // Das ist der "Falsch"-Button
const scoreDisplay = document.getElementById('scoreDisplay');

const winScreen = document.getElementById('winScreen');
const finalScoreMessage = document.getElementById('finalScoreMessage');
const playAgainButton = document.getElementById('playAgainButton');

// NEU: Logo und Titel Element
const gameTitleLogo = document.getElementById('gameTitleLogo'); // Optional: Falls du ein Image-Element dafür hast
const gameTitleText = document.getElementById('gameTitleText'); // Text-Element

let myPlayerId = null;
let myPlayerName = '';
let playerSocketsClient = [];


// --- Event Listener ---

startGameButton.addEventListener('click', () => {
    myPlayerName = player1NameInput.value.trim();
    if (myPlayerName === '') {
        myPlayerName = 'Spieler';
    }
    socket.emit('setPlayerName', { name: myPlayerName, isReady: true });
    
    player1NameInput.disabled = true;
    startGameButton.disabled = true;
    statusMessage.textContent = 'Warten auf den anderen Spieler...';
});

submitWordButton.addEventListener('click', () => {
    const word = wordInput.value.trim();
    if (word) {
        socket.emit('submitWord', word);
        wordInput.value = '';
        wordInput.disabled = true;
        submitWordButton.disabled = true;
    }
});

wordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !wordInput.disabled) {
        submitWordButton.click();
    }
});

nextButton.addEventListener('click', () => {
    socket.emit('nextRound'); // Sendet 'nextRound' Event
    nextButton.disabled = true; // Deaktiviere eigenen Button
    resetButton.disabled = true; // Deaktiviere Falsch-Button (warten auf andere Bestätigung)
    // Optional: Meldung an den Spieler, dass auf den anderen gewartet wird
    player1WordDisplay.textContent = 'Warte auf Bestätigung...'; // Oder eine andere visuelle Rückmeldung
    player2WordDisplay.textContent = ''; // Sicherstellen, dass nur die eigene Meldung angezeigt wird
});

// NEU: Event Listener für den "Falsch"-Button
resetButton.addEventListener('click', () => {
    socket.emit('requestResetGame'); // Sendet 'requestResetGame' Event
    resetButton.disabled = true; // Deaktiviere eigenen Button
    nextButton.disabled = true; // Deaktiviere Weiter-Button
    // Optional: Meldung an den Spieler, dass auf den anderen gewartet wird
    player1WordDisplay.textContent = 'Warte auf Reset Bestätigung...';
    player2WordDisplay.textContent = '';
});

playAgainButton.addEventListener('click', () => {
    socket.emit('requestResetGame'); // "Nochmal spielen" ruft auch den Reset auf
});


// --- Socket.IO Event Handler (Empfang von Nachrichten vom Server) ---

socket.on('playerAssigned', (data) => {
    myPlayerId = data.id;
    console.log(`Du bist Spieler: ${myPlayerId}, Name: ${data.name}`);
    
    player1NameInput.value = data.name;
    player1NameInput.disabled = false;
    startGameButton.disabled = false;

    if (data.numPlayers === 1) {
        statusMessage.textContent = 'Warte auf einen zweiten Spieler...';
    } else {
        statusMessage.textContent = 'Beide Spieler verbunden. Gib deinen Namen ein und klicke "Fertig".';
    }
});

socket.on('waitingForPlayers', (message) => {
    statusMessage.textContent = message;
});

socket.on('updatePlayerNames', (names) => {
    player1NameDisplay.textContent = names.player1 || '';
    player2NameDisplay.textContent = names.player2 || '';

    if (player1NameInput.disabled && names.player1 && names.player2) {
        statusMessage.textContent = 'Beide Spieler bereit. Warte auf Spielstart...';
    } else if (player1NameInput.disabled && names.player1 && !names.player2) {
        statusMessage.textContent = 'Dein Name ist gesetzt. Warte auf den zweiten Spieler...';
    } else if (!player1NameInput.disabled && names.player1 && names.player2) {
        statusMessage.textContent = 'Beide Spieler verbunden. Gib deinen Namen ein und klicke "Fertig".';
    }
});

socket.on('gameStarted', (data) => {
    startScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    winScreen.classList.add('hidden');

    currentStichwort.textContent = data.currentWord;
    playerSocketsClient = Object.keys(data.scores);
    
    updateScoreDisplay(data.scores);
    wordInput.disabled = false;
    submitWordButton.disabled = false;
    // Sicherstellen, dass Weiter/Falsch Buttons deaktiviert sind am Rundenstart
    nextButton.disabled = true;
    resetButton.disabled = true;
    player1WordDisplay.textContent = ''; // Ergebnisse leeren
    player2WordDisplay.textContent = '';
    console.log('Spiel gestartet:', data.currentWord);
});

socket.on('showResults', (data) => {
    player1NameDisplay.textContent = data.player1Name;
    player1WordDisplay.textContent = data.player1Word;
    player2NameDisplay.textContent = data.player2Name;
    player2WordDisplay.textContent = data.player2Word;

    nextButton.disabled = false; // "Weiter"-Button aktivieren
    resetButton.disabled = false; // "Falsch"-Button aktivieren
});

socket.on('newRound', (data) => {
    currentStichwort.textContent = data.currentWord;
    updateScoreDisplay(data.scores);
    wordInput.disabled = false;
    submitWordButton.disabled = false;
    nextButton.disabled = true; // Buttons wieder deaktivieren für neue Runde
    resetButton.disabled = true;
    player1WordDisplay.textContent = ''; // Ergebnisse von der Vorrunde leeren
    player2WordDisplay.textContent = '';
    console.log(`Neue Runde: ${data.currentWord}, Scores: Spieler 1: ${data.scores[playerSocketsClient[0]] || 0}, Spieler 2: ${data.scores[playerSocketsClient[1]] || 0}. Runde: ${data.round}`);
});

// NEU: Nachricht vom Server, dass auf den anderen Spieler gewartet wird (Weiter-Klick)
socket.on('waitingForNextRoundClick', (message) => {
    // Optional: Visuelle Rückmeldung nur für den Spieler, der geklickt hat
    // statusMessage.textContent = message; // Könnte hier überlagern, lieber intern anzeigen
    console.log(message);
    // player1WordDisplay.textContent = 'Warte auf anderen Spieler...'; // Wurde schon oben im Event Listener gesetzt
});

// NEU: Nachricht vom Server, dass auf den anderen Spieler gewartet wird (Reset-Klick)
socket.on('waitingForResetClick', (message) => {
    console.log(message);
    // player1WordDisplay.textContent = 'Warte auf Reset Bestätigung...'; // Wurde schon oben im Event Listener gesetzt
});


socket.on('gameReset', (message) => {
    console.log(message);
    // NEU: Keine Rückkehr zum Startbildschirm, wenn die Namen beibehalten werden
    // Stattdessen wird das Spiel direkt neu gestartet durch 'gameStarted' Event vom Server
    if (message.includes('Spiel wurde manuell zurückgesetzt.') || message.includes('Ein Spieler hat die Verbindung getrennt')) {
        // Dies ist ein kompletter Reset, hier gehen wir zum Startbildschirm
        startScreen.classList.remove('hidden');
        gameScreen.classList.add('hidden');
        winScreen.classList.add('hidden');

        player1NameInput.value = ''; // Eigenes Namensfeld leeren
        player1NameInput.disabled = false; // Eigenes Namensfeld aktivieren
        startGameButton.disabled = false; // "Fertig" Button aktivieren
        statusMessage.textContent = 'Warte auf 2 Spieler...'; // Initialer Status
    } else {
        // Dies ist ein Reset, bei dem die Namen beibehalten werden (z.B. nach GameOver oder beidseitigem Falsch)
        // Der Server wird ein 'gameStarted' Event senden, das den gameScreen wieder anzeigt.
        // Hier leeren wir nur die Anzeigen, bis das neue Stichwort kommt.
        currentStichwort.textContent = 'Wird geladen...';
        wordInput.value = '';
        wordInput.disabled = true;
        submitWordButton.disabled = true;
        player1WordDisplay.textContent = '';
        player2WordDisplay.textContent = '';
        scoreDisplay.textContent = '0/8'; // Score auf 0 setzen
        nextButton.disabled = true;
        resetButton.disabled = true;
        
        // WICHTIG: Hier keine Umschaltung zum StartScreen,
        // da das Spiel direkt über 'gameStarted' neu startet.
        console.log("Spiel wurde mit Namen zurückgesetzt. Warte auf 'gameStarted' für neuen Rundenbeginn.");
    }

    playerSocketsClient = []; // Client-seitige Spieler-ID-Liste leeren
});

socket.on('gameOver', (data) => {
    gameScreen.classList.add('hidden');
    winScreen.classList.remove('hidden');
    finalScoreMessage.textContent = `Das Spiel ist beendet! Spieler 1: ${data.scores[playerSocketsClient[0]] || 0} Punkte, Spieler 2: ${data.scores[playerSocketsClient[1]] || 0} Punkte.`;
    console.log('Spiel beendet. Endstand:', data.scores);
});

socket.on('gameFull', (message) => {
    alert(message);
    window.location.reload();
});


// --- Hilfsfunktion zur Aktualisierung der Punkteanzeige ---
function updateScoreDisplay(scores) {
    if (playerSocketsClient.length < 2) {
        scoreDisplay.textContent = `0/8`;
        return; 
    }

    const p1Score = scores[playerSocketsClient[0]] || 0;
    const p2Score = scores[playerSocketsClient[1]] || 0;

    let displayString = '';
    // Zeige die Punktzahl des aktuellen Spielers an
    if (myPlayerId === playerSocketsClient[0]) {
        displayString = `${p1Score}/8`;
    } else if (myPlayerId === playerSocketsClient[1]) {
        displayString = `${p2Score}/8`;
    } else {
        displayString = `0/8`;
    }
    scoreDisplay.textContent = displayString;
}


// --- Initialisierung beim Laden der Seite ---
document.addEventListener('DOMContentLoaded', () => {
    startScreen.classList.remove('hidden');
    gameScreen.classList.add('hidden');
    winScreen.classList.add('hidden');
    
    startGameButton.disabled = true;
    
    // Optional: Logo/Titel dynamisch einfügen (siehe Teil 3)
    // if (gameTitleLogo) {
    //     gameTitleLogo.src = 'path/to/your/logo.png'; // Pfad zu deinem Logo
    // }
    // if (gameTitleText) {
    //     gameTitleText.textContent = 'Assoziationsspiel';
    // }
});

player1NameInput.addEventListener('input', () => {
    startGameButton.disabled = player1NameInput.value.trim() === '';
});