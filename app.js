/* ==========================================
   WinBlitz - Core Application Logic
   ========================================== */

// --- Default Lobbies Database ---
const DEFAULT_LOBBIES = [
    {
        id: 1,
        prizeName: "Елегантен сервиз за кафе",
        prizeValue: 20,
        ticketPrice: 5,
        maxPlayers: 5,
        productType: "wallpaper",
        gameType: "math",
        image: "coffee_set.png",
        productUrl: "https://www.ikea.bg/products/tableware/cups-mugs/fargklar-cup-and-saucer-matte-dark-grey/",
        deliveryStatus: "pending",
        status: "waiting", // waiting, ready, finished
        players: [
            { name: "Мартин С.", isMe: false, time: null, errors: 0, finished: false },
            { name: "Иван П.", isMe: false, time: null, errors: 0, finished: false },
            { name: "Елена Д.", isMe: false, time: null, errors: 0, finished: false }
        ],
        winner: null
    }
];

// --- App State ---
let state = {
    balance: 20.00,
    role: "user", // user | admin
    lobbies: [],
    currentLobbyId: null,
    walletHistory: [
        { desc: "Демо захранване", amount: 20.00, type: "deposit", date: "" }
    ],
    completedTournaments: [],
    user: {
        phone: null,
        verified: false,
        gamesPlayed: 0,
        gamesWon: 0,
        prizesWonValue: 0,
        wonPrizesList: []
    },
    // Game variables
    game: {
        timerInterval: null,
        startTime: null,
        elapsedTime: 0,
        questions: [],
        currentQuestionIndex: 0,
        errors: 0,
        penaltyTime: 0, // in seconds
        gameType: "math",
        totalSteps: 5
    }
};

// --- Initialization ---
document.addEventListener("DOMContentLoaded", () => {
    loadState();
    applyActiveTheme();
    renderLobbies();
    updateUI();
    bindKeyboardEvents();
    bindAdminPreviewEvents();
});

// Helper to call backend with user phone header
async function apiFetch(url, options = {}) {
    if (!options.headers) options.headers = {};
    if (state.user && state.user.phone) {
        options.headers['X-User-Phone'] = state.user.phone;
    }
    if (options.body && !(options.body instanceof FormData) && !options.headers['Content-Type']) {
        options.headers['Content-Type'] = 'application/json';
    }
    return fetch(url, options);
}

// Helper to map DB snake_case columns to camelCase client properties
function mapLobbyToClient(lobby) {
    if (!lobby) return null;
    return {
        id: lobby.id,
        prizeName: lobby.prize_name !== undefined ? lobby.prize_name : lobby.prizeName,
        prizeValue: lobby.prize_value !== undefined ? parseFloat(lobby.prize_value) : lobby.prizeValue,
        ticketPrice: lobby.ticket_price !== undefined ? parseFloat(lobby.ticket_price) : lobby.ticketPrice,
        maxPlayers: lobby.max_players !== undefined ? lobby.max_players : lobby.maxPlayers,
        productType: lobby.product_type !== undefined ? lobby.product_type : lobby.productType,
        gameType: lobby.game_type !== undefined ? lobby.game_type : lobby.gameType,
        image: lobby.image !== undefined ? lobby.image : lobby.image,
        productUrl: lobby.product_url !== undefined ? lobby.product_url : lobby.productUrl,
        status: lobby.status !== undefined ? lobby.status : lobby.status,
        players: typeof lobby.players === 'string' ? JSON.parse(lobby.players) : lobby.players || [],
        winner: lobby.winner !== undefined ? lobby.winner : lobby.winner,
        isFriendDuel: lobby.is_friend_duel !== undefined ? lobby.is_friend_duel : lobby.isFriendDuel,
        isPractice: lobby.is_practice !== undefined ? lobby.is_practice : lobby.isPractice,
        completedAt: lobby.completed_at !== undefined ? lobby.completed_at : lobby.completedAt,
        archiveId: lobby.archive_id !== undefined ? (typeof lobby.archive_id === 'string' ? parseInt(lobby.archive_id) : lobby.archive_id) : lobby.archiveId,
        deliveryStatus: lobby.delivery_status !== undefined ? lobby.delivery_status : lobby.deliveryStatus
    };
}

// Helper to set private duel fee manually or from quick options
function setDuelFee(amount) {
    const input = document.getElementById("duel-entry-fee");
    if (input) {
        input.value = amount.toFixed(2);
    }
}

// Load state from localStorage or initialize defaults, synced with backend if online
async function loadState() {
    const savedState = localStorage.getItem("winblitz_state");
    if (savedState) {
        try {
            state = JSON.parse(savedState);
            state.game.timerInterval = null;
        } catch (e) {
            console.error(e);
        }
    }
    
    // Apply local state validation defaults
    if (!state.completedTournaments) state.completedTournaments = [];
    if (state.practiceModeActive === undefined) state.practiceModeActive = false;
    if (state.lastSpinDate === undefined) state.lastSpinDate = null;
    if (state.practiceGamesPlayed === undefined) state.practiceGamesPlayed = 0;
    if (state.xp === undefined) state.xp = 0;
    if (state.league === undefined) state.league = "Бронз";
    if (state.clanId === undefined) state.clanId = null;
    if (state.unlockedAvatars === undefined) state.unlockedAvatars = ["👤"];
    if (state.activeAvatar === undefined) state.activeAvatar = "👤";
    if (state.activeTheme === undefined) state.activeTheme = "default";
    if (state.unlockedThemes === undefined) state.unlockedThemes = ["default"];
    if (state.lootBoxesOwned === undefined) state.lootBoxesOwned = 0;
    if (state.unlockedAchievements === undefined) state.unlockedAchievements = [];
    if (state.dailyQuests === undefined || state.dailyQuests.length === 0) {
        state.dailyQuests = generateDailyQuests();
    }
    if (state.balance === undefined) state.balance = 100.00;
    if (!state.user) {
        state.user = { phone: null, fullname: null, city: null, address: null, verified: false, gamesPlayed: 0, gamesWon: 0, prizesWonValue: 0, wonPrizesList: [] };
    }

    try {
        // 1. Sync lobbies
        const lobbiesRes = await fetch('/api/lobbies');
        if (lobbiesRes.ok) {
            const lobbiesData = await lobbiesRes.json();
            state.lobbies = lobbiesData.map(mapLobbyToClient);
        }
        
        // 2. Sync user state
        if (state.user && state.user.phone) {
            const res = await apiFetch('/api/user/state');
            if (res.ok) {
                const data = await res.json();
                if (data.user) {
                    state.balance = parseFloat(data.user.balance);
                    state.xp = parseInt(data.user.xp);
                    state.clanId = data.user.clan_id;
                    state.activeAvatar = data.user.active_avatar;
                    state.activeTheme = data.user.active_theme;
                    state.unlockedAvatars = data.user.unlocked_avatars || ['👤'];
                    state.unlockedThemes = data.user.unlocked_themes || ['default'];
                    state.lootBoxesOwned = data.user.loot_boxes_owned || 0;
                    state.unlockedAchievements = data.user.unlocked_achievements || [];
                    state.dailyQuests = typeof data.user.daily_quests === 'string' ? JSON.parse(data.user.daily_quests) : data.user.daily_quests || [];
                    state.walletHistory = data.walletHistory || [];
                    state.completedTournaments = (data.completedGames || []).map(mapLobbyToClient);
                    state.lastSpinDate = data.user.last_spin_date || null;
                    
                    let played = 0;
                    let won = 0;
                    let wonVal = 0;
                    state.completedTournaments.forEach(game => {
                        if (!game.isPractice) {
                            played++;
                            if (game.winner === "Вие") {
                                won++;
                                wonVal += game.prizeValue;
                            }
                        }
                    });
                    
                    state.user = {
                        phone: data.user.phone,
                        fullname: data.user.fullname,
                        city: data.user.city,
                        address: data.user.address,
                        verified: data.user.verified,
                        gamesPlayed: played,
                        gamesWon: won,
                        prizesWonValue: wonVal,
                        wonPrizesList: data.wonPrizes || []
                    };
                }
            }
        }
    } catch (err) {
        console.warn("Backend connection failed, running in offline mode:", err);
    }
    
    applyActiveTheme();
    renderLobbies();
    updateUI();
}

function resetStateToDefault() {
    state.balance = 100.00;
    state.role = "user";
    state.lobbies = JSON.parse(JSON.stringify(DEFAULT_LOBBIES));
    state.currentLobbyId = null;
    state.practiceModeActive = false;
    state.lastSpinDate = null;
    state.practiceGamesPlayed = 0;
    state.xp = 0;
    state.league = "Бронз";
    state.clanId = null;
    state.unlockedAvatars = ["👤"];
    state.activeAvatar = "👤";
    state.activeTheme = "default";
    state.unlockedThemes = ["default"];
    state.lootBoxesOwned = 0;
    state.unlockedAchievements = [];
    state.dailyQuests = generateDailyQuests();
    state.walletHistory = [
        { desc: "Начален бонус (Демо)", amount: 100.00, type: "deposit", date: getFormattedDate() }
    ];
    state.completedTournaments = [];
    state.user = {
        phone: null,
        fullname: null,
        city: null,
        address: null,
        verified: false,
        gamesPlayed: 0,
        gamesWon: 0,
        prizesWonValue: 0,
        wonPrizesList: []
    };
    saveState();
}

function saveState() {
    localStorage.setItem("winblitz_state", JSON.stringify(state));
}

// Format date helper
function getFormattedDate() {
    const now = new Date();
    return now.toLocaleTimeString("bg-BG", { hour: "2-digit", minute: "2-digit" }) + " - " + now.toLocaleDateString("bg-BG");
}



// --- Render Lobbies ---
function renderLobbies() {
    const listContainer = document.getElementById("lobbies-list");
    if (!listContainer) return;

    listContainer.innerHTML = "";

    // Sync practice toggle state on screen
    const toggleEl = document.getElementById("practice-mode-toggle");
    if (toggleEl) {
        toggleEl.checked = state.practiceModeActive;
    }

    // 1. New active lobbies at the top, sorted by ID descending (newest created first)
    const activeLobbies = [...state.lobbies].reverse();

    // 2. Completed lobbies below, sorted by completed time/archiveId descending (newest completed first)
    const completedLobbies = state.completedTournaments || [];

    // Render active lobbies first
    activeLobbies.forEach(lobby => {
        const playerCount = lobby.players.length;
        const progressPercent = (playerCount / lobby.maxPlayers) * 100;
        const isMeInLobby = lobby.players.some(p => p.isMe);
        const isFull = playerCount >= lobby.maxPlayers;
        
        let statusBadgeText = "";
        let statusClass = "";
        let isHot = false;
        let cardClass = "lobby-card";

        if (!isFull && playerCount === lobby.maxPlayers - 1) {
            isHot = true;
            cardClass += " hot-lobby";
        }

        if (isFull) {
            statusBadgeText = "Готов за старт";
            statusClass = "ready";
        } else if (isMeInLobby) {
            statusBadgeText = "Записан (Изчакване...)";
            statusClass = "ready";
        } else {
            statusBadgeText = isHot ? "🔥 ПОСЛЕДНО МЕСТО!" : "Набиращ играчи";
            statusClass = isHot ? "badge-danger" : "";
        }

        const ticketPriceVal = state.practiceModeActive ? 0 : lobby.ticketPrice;
        const ticketPriceText = state.practiceModeActive ? "Безплатно" : `€${ticketPriceVal.toFixed(2)}`;
        const prizeValueText = state.practiceModeActive ? "Практика (Демо)" : `€${lobby.prizeValue}`;

        const card = document.createElement("div");
        card.className = cardClass;
        card.onclick = () => openLobbyDetail(lobby.id);

        card.innerHTML = `
            <img src="${lobby.image}" class="lobby-card-bg" alt="${lobby.prizeName}">
            <div class="lobby-card-overlay"></div>
            <div class="lobby-card-content">
                <div class="lobby-card-top">
                    <span class="badge status-badge ${statusClass}">${statusBadgeText}</span>
                    <span class="badge prize-badge">Награда: ${prizeValueText}</span>
                </div>
                <h3>${lobby.prizeName}</h3>
                <div class="lobby-game-type-badge">🎯 Игра: ${getGameTypeNameBg(lobby.gameType || 'math')}</div>
                <div class="lobby-progress-container">
                    <div class="lobby-progress-text">
                        <span>Пакет + Билет: ${ticketPriceText}</span>
                        <span>${playerCount} / ${lobby.maxPlayers}</span>
                    </div>
                    <div class="lobby-progress-bar">
                        <div class="progress-bar-fill ${isFull ? 'full' : ''}" style="width: ${progressPercent}%"></div>
                    </div>
                </div>
            </div>
        `;
        listContainer.appendChild(card);
    });

    // Then render completed lobbies
    completedLobbies.forEach(lobby => {
        const card = document.createElement("div");
        card.className = "lobby-card finished";
        card.onclick = () => showLeaderboard(lobby, "user-lobbies");

        const prizeValText = lobby.isPractice ? "Практика (Демо)" : `€${lobby.prizeValue}`;
        const ticketPriceText = lobby.isPractice ? "Свободна практика" : `Пакет + Билет: €${lobby.ticketPrice.toFixed(2)}`;

        card.innerHTML = `
            <img src="${lobby.image}" class="lobby-card-bg" alt="${lobby.prizeName}">
            <div class="lobby-card-overlay" style="background: rgba(0, 0, 0, 0.75);"></div>
            <div class="lobby-card-content" style="opacity: 0.85;">
                <div class="lobby-card-top">
                    <span class="badge status-badge finished">🏆 Победител: ${lobby.winner}</span>
                    <span class="badge prize-badge" style="background: rgba(255,255,255,0.08);">Награда: ${prizeValText}</span>
                </div>
                <h3 style="color: #ccc;">${lobby.prizeName} <span style="font-size: 11px; color: var(--text-gray); font-weight: normal;">(Приключил)</span></h3>
                <div class="lobby-game-type-badge" style="color: var(--text-muted);">🎯 Игра: ${getGameTypeNameBg(lobby.gameType || 'math')}</div>
                <div class="lobby-progress-container">
                    <div class="lobby-progress-text" style="color: var(--text-gray);">
                        <span>${ticketPriceText}</span>
                        <span>${lobby.maxPlayers} / ${lobby.maxPlayers}</span>
                    </div>
                    <div class="lobby-progress-bar">
                        <div class="progress-bar-fill finished-bar" style="width: 100%"></div>
                    </div>
                </div>
            </div>
        `;
        listContainer.appendChild(card);
    });
}

// --- Open Screens ---
function showScreen(screenId) {
    // Hide all normal screens
    document.querySelectorAll(".app-screen:not(.pop-screen)").forEach(s => s.classList.remove("active"));
    
    // Hide popups unless targeted
    if (!screenId.endsWith("-screen") || !document.getElementById(screenId).classList.contains("pop-screen")) {
        document.querySelectorAll(".pop-screen").forEach(s => s.classList.remove("active"));
    }

    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add("active");
    }
}

function closePopScreen() {
    document.querySelectorAll(".pop-screen").forEach(s => s.classList.remove("active"));
    navSwitch("user-lobbies");
}

function navSwitch(tab) {
    // Update active nav button
    document.querySelectorAll(".nav-item").forEach(item => item.classList.remove("active"));
    
    if (tab === "user-lobbies") {
        document.querySelector(".nav-item:nth-child(1)").classList.add("active");
        showScreen("user-lobbies-screen");
    } else if (tab === "history") {
        document.querySelector(".nav-item:nth-child(2)").classList.add("active");
        renderHistory();
        showScreen("history-screen");
    } else if (tab === "wallet") {
        document.querySelector(".nav-item:nth-child(3)").classList.add("active");
        showScreen("wallet-screen");
    } else if (tab === "profile") {
        document.querySelector(".nav-item:nth-child(4)").classList.add("active");
        renderProfile();
        showScreen("profile-screen");
    } else if (tab === "league") {
        document.querySelector(".nav-item:nth-child(5)").classList.add("active");
        renderLeagueClan();
        showScreen("league-clan-screen");
    } else if (tab === "rules") {
        showScreen("rules-screen");
    }
}

// --- Detail Screen ---
function openLobbyDetail(lobbyId) {
    const lobby = state.lobbies.find(l => l.id === lobbyId);
    if (!lobby) return;

    state.currentLobbyId = lobbyId;
    saveState();

    // Check if user is already in this lobby and it hasn't finished
    const hasJoined = lobby.players.some(p => p.isMe);

    if (lobby.status === "finished") {
        showLeaderboard(lobby);
        return;
    }

    if (hasJoined) {
        openWaitingLobby(lobby);
        return;
    }

    // Set product details
    document.getElementById("detail-prize-image").src = lobby.image || "coffee_set.png";
    document.getElementById("detail-prize-title").textContent = lobby.prizeName;
    document.getElementById("detail-prize-value").textContent = `Награда: €${lobby.prizeValue.toFixed(2)}`;
    document.getElementById("detail-bundle-price").textContent = `€${lobby.ticketPrice.toFixed(2)}`;

    // Show/hide product external link
    const linkEl = document.getElementById("detail-product-link");
    if (lobby.productUrl) {
        linkEl.href = lobby.productUrl;
        linkEl.style.display = "inline-flex";
    } else {
        linkEl.style.display = "none";
    }

    showScreen("product-detail-screen");
}

// --- Buy Ticket (Bundle Purchase) ---
async function purchaseTicket() {
    const lobby = state.lobbies.find(l => l.id === state.currentLobbyId);
    if (!lobby) return;

    if (!state.practiceModeActive) {
        if (!state.user || !state.user.verified) {
            alert("Моля, регистрирайте и верифицирайте профила си с SMS от таб 'Профил', преди да участвате в турнир!");
            navSwitch("profile");
            return;
        }

        if (state.balance < lobby.ticketPrice) {
            alert("Нямате достатъчно баланс! Захранете го от левия контролен панел.");
            return;
        }
    }

    try {
        const response = await apiFetch('/api/lobbies/join', {
            method: 'POST',
            body: JSON.stringify({ lobbyId: lobby.id, isPractice: state.practiceModeActive })
        });
        
        if (response.ok) {
            const data = await response.json();
            
            // Sync user state and lobby state returned from backend
            if (data.user) {
                state.balance = parseFloat(data.user.balance);
                state.lootBoxesOwned = data.user.loot_boxes_owned || 0;
            }
            
            const updatedLobby = mapLobbyToClient(data.lobby);
            const index = state.lobbies.findIndex(l => l.id === lobby.id);
            if (index !== -1) {
                state.lobbies[index] = updatedLobby;
            }
            
            // Re-render UI
            saveState();
            await loadState(); // Reload fully to sync history etc
            
            // Award loot box if real game
            if (!state.practiceModeActive) {
                setTimeout(() => {
                    if (confirm("Честито! Спечелихте подаръчна Мистериозна Кутия! Искате ли да я отворите сега?")) {
                        openLootBoxScreen();
                    }
                }, 600);
            }
            
            // Go to waiting lobby
            openWaitingLobby(updatedLobby);
            
            // Auto-bot trigger simulation: after 2.5 seconds, a bot joins if lobby is not full
            if (!updatedLobby.isFriendDuel) {
                setTimeout(() => {
                    simulateBotJoin(updatedLobby.id);
                }, 2500);
            }
        } else {
            const err = await response.json();
            alert("Грешка при покупка: " + err.error);
        }
    } catch (err) {
        console.error("purchaseTicket error:", err);
        // Fallback for offline mode
        if (!state.practiceModeActive) {
            state.balance -= lobby.ticketPrice;
            state.walletHistory.unshift({
                desc: `Покупка тапет + билет (Турнир #${lobby.id})`,
                amount: lobby.ticketPrice,
                type: "withdraw",
                date: getFormattedDate()
            });
        } else {
            state.walletHistory.unshift({
                desc: `Свободна тренировка (Турнир #${lobby.id})`,
                amount: 0,
                type: "withdraw",
                date: getFormattedDate()
            });
        }
        lobby.isPractice = state.practiceModeActive;
        if (!lobby.players.some(p => p.isMe)) {
            lobby.players.push({
                name: "Вие (Участник)",
                isMe: true,
                time: null,
                errors: 0,
                finished: false
            });
        }
        saveState();
        updateUI();
        renderLobbies();
        if (!state.practiceModeActive) {
            state.lootBoxesOwned = (state.lootBoxesOwned || 0) + 1;
            setTimeout(() => {
                if (confirm("Честито! Спечелихте подаръчна Мистериозна Кутия! Искате ли да я отворите сега?")) {
                    openLootBoxScreen();
                }
            }, 600);
        }
        openWaitingLobby(lobby);
        if (!lobby.isFriendDuel) {
            setTimeout(() => {
                simulateBotJoin(lobby.id);
            }, 2500);
        }
    }
}

// --- Waiting Lobby Screen ---
function openWaitingLobby(lobby) {
    showScreen("waiting-lobby-screen");
    
    const statusText = document.getElementById("lobby-status-text");
    const ratio = document.getElementById("lobby-queue-ratio");
    const progress = document.getElementById("lobby-queue-progress-bar");
    const playersList = document.getElementById("lobby-players-list");
    const startContainer = document.getElementById("game-start-container");

    document.getElementById("lobby-prize-name").textContent = lobby.prizeName;

    // Render list
    playersList.innerHTML = "";
    lobby.players.forEach(p => {
        const row = document.createElement("div");
        row.className = `player-row ${p.isMe ? 'me' : ''}`;
        row.innerHTML = `
            <div class="player-info">
                <span class="player-avatar">${p.name[0]}</span>
                <span class="player-name">${p.name}</span>
            </div>
            <span class="player-status">${p.isMe ? 'Записан' : 'В готовност'}</span>
        `;
        playersList.appendChild(row);
    });

    const currentCount = lobby.players.length;
    ratio.textContent = `${currentCount} / ${lobby.maxPlayers}`;
    progress.style.width = `${(currentCount / lobby.maxPlayers) * 100}%`;

    if (currentCount >= lobby.maxPlayers) {
        statusText.textContent = "Лобито е пълно! Готови за игра.";
        statusText.classList.add("ready");
        progress.classList.add("full");
        startContainer.style.display = "block";
    } else {
        statusText.textContent = "Изчакване на участници...";
        statusText.classList.remove("ready");
        progress.classList.remove("full");
        startContainer.style.display = "none";
    }
}

// --- Simulate Bot Joins ---
async function simulateBotJoin(lobbyId) {
    const lobby = state.lobbies.find(l => l.id === lobbyId);
    if (!lobby || lobby.status === "finished" || lobby.players.length >= lobby.maxPlayers) return;

    const botNames = ["Христо В.", "Димитър К.", "Теодора А.", "Стефан Р.", "Мария Г."];
    let newName = botNames.find(name => !lobby.players.some(p => p.name === name));
    if (!newName) newName = `Играч_${Math.floor(Math.random() * 100)}`;

    try {
        const response = await apiFetch('/api/lobbies/bot-join', {
            method: 'POST',
            body: JSON.stringify({ lobbyId, botName: newName })
        });
        
        if (response.ok) {
            const data = await response.json();
            const updatedLobby = mapLobbyToClient(data.lobby);
            
            const index = state.lobbies.findIndex(l => l.id === lobbyId);
            if (index !== -1) {
                state.lobbies[index] = updatedLobby;
            }
            
            saveState();
            renderLobbies();
            
            if (state.currentLobbyId === lobbyId && document.getElementById("waiting-lobby-screen").classList.contains("active")) {
                openWaitingLobby(updatedLobby);
            }
        }
    } catch (err) {
        console.error("simulateBotJoin error:", err);
        // Fallback for offline mode
        lobby.players.push({
            name: newName,
            isMe: false,
            time: null,
            errors: 0,
            finished: false
        });
        saveState();
        renderLobbies();
        if (state.currentLobbyId === lobbyId && document.getElementById("waiting-lobby-screen").classList.contains("active")) {
            openWaitingLobby(lobby);
        }
    }
}

function simulateLobbyFill() {
    const lobby = state.lobbies.find(l => l.id === state.currentLobbyId);
    if (!lobby) {
        alert("Моля, първо влезте в конкретен турнир от списъка.");
        return;
    }
    if (lobby.status === "finished") {
        alert("Тази стая вече е приключила.");
        return;
    }

    // Ensure the user is in the room
    const hasMe = lobby.players.some(p => p.isMe);
    if (!hasMe) {
        // Buy automatically
        if (state.balance < lobby.ticketPrice) {
            state.balance += lobby.ticketPrice; // Give funds to make sure it works
        }
        purchaseTicket();
    }

    // Fill remaining spots
    while (lobby.players.length < lobby.maxPlayers) {
        simulateBotJoin(lobby.id);
    }
}

// --- SKILL GAME LOGIC (10 DYNAMIC GAMES) ---
function startSkillGame() {
    showScreen("game-arena-screen");
    document.getElementById("app-navigation-bar").style.display = "none"; // Hide bottom nav during play
    
    // Find current lobby
    const lobby = state.lobbies.find(l => l.id === state.currentLobbyId);
    const gameType = lobby ? (lobby.gameType || "math") : "math";
    
    state.game.gameType = gameType;
    state.game.currentQuestionIndex = 0;
    state.game.errors = 0;
    state.game.penaltyTime = 0;
    state.game.elapsedTime = 0;

    // Reset progress dots and render game board
    initializeGame(gameType);
    updateProgressDots();

    // Start Timer
    state.game.startTime = Date.now();
    state.game.timerInterval = setInterval(updateTimerDisplay, 37); // update at ~27fps

    // Initialize live opponent progress panel if we have bots in this lobby
    if (lobby) {
        initLiveOpponentsSimulation(lobby);
    }
}

function initializeGame(gameType) {
    const container = document.getElementById("game-board-container");
    container.innerHTML = "";
    
    // Hide numeric keypad by default
    document.getElementById("game-numeric-keypad").style.display = "none";
    
    // Update title/label
    const label = document.getElementById("game-title-label");
    
    if (gameType === "math") {
        label.textContent = "МАТЕМАТИКА";
        state.game.totalSteps = 5;
        state.game.currentQuestionIndex = 0;
        state.game.questions = generateMathQuestions(5);
        
        // Show keypad
        document.getElementById("game-numeric-keypad").style.display = "grid";
        
        // Render math board
        container.innerHTML = `
            <div class="math-board">
                <div class="math-question-box" id="math-expression"></div>
                <div class="math-input-box">
                    <input type="text" id="math-answer-input" readonly>
                </div>
            </div>
        `;
        showQuestion();
    }
    else if (gameType === "memory") {
        label.textContent = "КАРТИ ЗА ПАМЕТ";
        state.game.totalSteps = 6; // 6 pairs to match
        state.game.currentQuestionIndex = 0;
        state.game.matchedCount = 0;
        state.game.flippedCards = [];
        
        // 12 cards, 6 emojis
        const emojis = ["☕", "📱", "🎧", "🚗", "🍕", "💡"];
        let deck = [...emojis, ...emojis];
        // Shuffle
        deck.sort(() => Math.random() - 0.5);
        state.game.memoryCards = deck;
        
        const grid = document.createElement("div");
        grid.className = "memory-grid";
        for (let i = 0; i < 12; i++) {
            const card = document.createElement("div");
            card.className = "memory-card";
            card.dataset.index = i;
            card.onclick = () => handleMemoryCardClick(i);
            grid.appendChild(card);
        }
        container.appendChild(grid);
    }
    else if (gameType === "reflex") {
        label.textContent = "БЪРЗ РЕФЛЕКС";
        state.game.totalSteps = 3; // 3 rounds
        state.game.currentQuestionIndex = 0;
        state.game.reflexRound = 0;
        
        const board = document.createElement("div");
        board.className = "reflex-board";
        const btn = document.createElement("button");
        btn.className = "reflex-btn wait";
        btn.id = "reflex-button";
        btn.innerHTML = `<span>ИЗЧАКАЙТЕ...</span>`;
        btn.onclick = () => handleReflexClick();
        board.appendChild(btn);
        container.appendChild(board);
        
        startReflexRound();
    }
    else if (gameType === "scramble") {
        label.textContent = "РАЗБЪРКАНИ ДУМИ";
        state.game.totalSteps = 3; // 3 words
        state.game.currentQuestionIndex = 0;
        
        const wordsList = ["БЛИЦ", "НАГРАДА", "УСПЕХ", "ИГРА", "ПЪЗЕЛ", "ТАКСА", "КАФЕ"];
        const shuffledWords = wordsList.sort(() => Math.random() - 0.5).slice(0, 3);
        state.game.scrambleWords = shuffledWords;
        state.game.scrambleSpelled = "";
        
        renderScrambleWord();
    }
    else if (gameType === "stroop") {
        label.textContent = "ЦВЕТЕН ТЕСТ";
        state.game.totalSteps = 5;
        state.game.currentQuestionIndex = 0;
        state.game.stroopQuestions = generateStroopQuestions(5);
        
        const board = document.createElement("div");
        board.className = "stroop-board";
        board.innerHTML = `
            <span class="stroop-label">Съвпада ли цвят и текст?</span>
            <div class="stroop-word" id="stroop-word-display">ЧЕРВЕНО</div>
            <div class="stroop-actions">
                <button class="stroop-btn yes" onclick="handleStroopAnswer(true)">ДА</button>
                <button class="stroop-btn no" onclick="handleStroopAnswer(false)">НЕ</button>
            </div>
        `;
        container.appendChild(board);
        showStroopQuestion();
    }
    else if (gameType === "numbers") {
        label.textContent = "ПОДРЕДИ ЧИСЛАТА";
        state.game.totalSteps = 9; // click 1 to 9
        state.game.currentQuestionIndex = 0;
        state.game.targetNumber = 1;
        
        const grid = document.createElement("div");
        grid.className = "numbers-grid";
        
        const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5);
        nums.forEach(n => {
            const cell = document.createElement("div");
            cell.className = "number-cell";
            cell.textContent = n;
            cell.onclick = () => handleNumberClick(n, cell);
            grid.appendChild(cell);
        });
        container.appendChild(grid);
    }
    else if (gameType === "target") {
        label.textContent = "ХВАНИ ЦЕЛТА";
        state.game.totalSteps = 5;
        state.game.currentQuestionIndex = 0;
        
        const board = document.createElement("div");
        board.className = "target-board";
        
        const target = document.createElement("div");
        target.className = "target-circle";
        target.id = "target-circle-btn";
        target.textContent = "1/5";
        target.onclick = () => handleTargetClick();
        board.appendChild(target);
        container.appendChild(board);
        
        moveTarget();
    }
    else if (gameType === "simon") {
        label.textContent = "САЙМЪН КАЗВА";
        state.game.totalSteps = 4; // 4 flashing colors
        state.game.currentQuestionIndex = 0;
        state.game.simonSequence = Array.from({length: 4}, () => Math.floor(Math.random() * 4));
        state.game.simonPlayerStep = 0;
        state.game.simonFlashing = false;
        
        const grid = document.createElement("div");
        grid.className = "simon-grid";
        
        const colors = ["green", "red", "blue", "yellow"];
        colors.forEach((c, idx) => {
            const btn = document.createElement("div");
            btn.className = `simon-btn ${c}`;
            btn.dataset.colorIdx = idx;
            btn.onclick = () => handleSimonClick(idx);
            grid.appendChild(btn);
        });
        container.appendChild(grid);
        
        setTimeout(() => {
            playSimonSequence();
        }, 800);
    }
    else if (gameType === "grid") {
        label.textContent = "РЕШЕТЪЧЕН ШАБЛОН";
        state.game.totalSteps = 2; // 2 rounds
        state.game.currentQuestionIndex = 0;
        state.game.gridRound = 0;
        state.game.gridActivePattern = [];
        state.game.gridSelectedPattern = [];
        
        const grid = document.createElement("div");
        grid.className = "grid-match";
        for (let i = 0; i < 9; i++) {
            const cell = document.createElement("div");
            cell.className = "grid-cell";
            cell.dataset.cellIdx = i;
            cell.onclick = () => handleGridCellClick(i, cell);
            grid.appendChild(cell);
        }
        container.appendChild(grid);
        
        startGridRound();
    }
    else if (gameType === "logic") {
        label.textContent = "ЛОГИЧЕСКИ ЗАГАДКИ";
        state.game.totalSteps = 3; // 3 questions
        state.game.currentQuestionIndex = 0;
        state.game.logicQuestions = generateLogicQuestions(3);
        
        const board = document.createElement("div");
        board.className = "logic-board";
        board.innerHTML = `
            <div class="logic-question" id="logic-question-text"></div>
            <div class="logic-actions">
                <button class="logic-btn true" onclick="handleLogicAnswer(true)">Истина</button>
                <button class="logic-btn false" onclick="handleLogicAnswer(false)">Лъжа</button>
            </div>
        `;
        container.appendChild(board);
        showLogicQuestion();
    }
}

// 1. Math Game helpers
function generateMathQuestions(count) {
    const questions = [];
    for (let i = 0; i < count; i++) {
        const type = Math.floor(Math.random() * 3); // 0: +, 1: -, 2: *
        let num1, num2, expr, ans;

        if (type === 0) { // Addition
            num1 = Math.floor(Math.random() * 20) + 5;
            num2 = Math.floor(Math.random() * 20) + 5;
            expr = `${num1} + ${num2} = ?`;
            ans = num1 + num2;
        } else if (type === 1) { // Subtraction
            num1 = Math.floor(Math.random() * 25) + 15;
            num2 = Math.floor(Math.random() * 12) + 2;
            expr = `${num1} - ${num2} = ?`;
            ans = num1 - num2;
        } else { // Multiplication
            num1 = Math.floor(Math.random() * 8) + 2;
            num2 = Math.floor(Math.random() * 8) + 2;
            expr = `${num1} × ${num2} = ?`;
            ans = num1 * num2;
        }
        questions.push({ expr, ans });
    }
    return questions;
}

function showQuestion() {
    const currentQ = state.game.questions[state.game.currentQuestionIndex];
    const expr = document.getElementById("math-expression");
    if (expr) {
        expr.textContent = currentQ.expr;
    }
}

function keypadPress(num) {
    const input = document.getElementById("math-answer-input");
    if (input) {
        input.value += num;
    }
}

function keypadClear() {
    const input = document.getElementById("math-answer-input");
    if (input) {
        input.value = "";
    }
}

function keypadSubmit() {
    const input = document.getElementById("math-answer-input");
    if (!input) return;
    const val = parseInt(input.value);
    if (isNaN(val)) return;

    checkAnswer(val);
}

function checkAnswer(userAnswer) {
    const currentQ = state.game.questions[state.game.currentQuestionIndex];
    const input = document.getElementById("math-answer-input");

    if (userAnswer === currentQ.ans) {
        triggerCorrectEffects();
        state.game.currentQuestionIndex++;
        if (state.game.currentQuestionIndex >= state.game.questions.length) {
            finishGame();
        } else {
            updateProgressDots();
            showQuestion();
            if (input) {
                input.value = "";
                input.focus();
            }
        }
    } else {
        state.game.errors++;
        state.game.penaltyTime += 3;
        triggerPenaltyToast();
        if (input) {
            input.value = "";
            input.focus();
        }
    }
}

// 2. Memory Game helpers
function handleMemoryCardClick(idx) {
    if (state.game.flippedCards.length >= 2) return;
    const cardEl = document.querySelector(`.memory-card[data-index="${idx}"]`);
    if (!cardEl || cardEl.classList.contains("flipped") || cardEl.classList.contains("matched")) return;
    
    cardEl.classList.add("flipped");
    cardEl.textContent = state.game.memoryCards[idx];
    state.game.flippedCards.push({ idx, element: cardEl, val: state.game.memoryCards[idx] });
    
    if (state.game.flippedCards.length === 2) {
        const [first, second] = state.game.flippedCards;
        if (first.val === second.val) {
            triggerCorrectEffects();
            first.element.classList.add("matched");
            second.element.classList.add("matched");
            first.element.classList.remove("flipped");
            second.element.classList.remove("flipped");
            state.game.matchedCount++;
            state.game.currentQuestionIndex = state.game.matchedCount;
            updateProgressDots();
            state.game.flippedCards = [];
            
            if (state.game.matchedCount === 6) {
                setTimeout(finishGame, 300);
            }
        } else {
            state.game.errors++;
            state.game.penaltyTime += 3;
            triggerPenaltyToast();
            
            setTimeout(() => {
                first.element.classList.remove("flipped");
                second.element.classList.remove("flipped");
                first.element.textContent = "";
                second.element.textContent = "";
                state.game.flippedCards = [];
            }, 600);
        }
    }
}

// 3. Reflex Game helpers
function startReflexRound() {
    state.game.reflexState = "wait";
    const btn = document.getElementById("reflex-button");
    if (!btn) return;
    btn.className = "reflex-btn wait";
    btn.innerHTML = `<span>ИЗЧАКАЙТЕ...</span>`;
    
    if (state.game.reflexTimeout) clearTimeout(state.game.reflexTimeout);
    
    const randomDelay = Math.floor(Math.random() * 2000) + 1200; // 1.2s to 3.2s
    state.game.reflexTimeout = setTimeout(() => {
        state.game.reflexState = "go";
        btn.className = "reflex-btn go";
        btn.innerHTML = `<span>НАТИСНИ СЕГА!</span>`;
        state.game.reflexGoTime = Date.now();
    }, randomDelay);
}

function handleReflexClick() {
    if (state.game.reflexState === "wait") {
        state.game.errors++;
        state.game.penaltyTime += 3;
        triggerPenaltyToast();
        startReflexRound();
    } else if (state.game.reflexState === "go") {
        triggerCorrectEffects();
        state.game.reflexState = "idle";
        state.game.reflexRound++;
        state.game.currentQuestionIndex = state.game.reflexRound;
        updateProgressDots();
        
        if (state.game.reflexRound >= 3) {
            finishGame();
        } else {
            startReflexRound();
        }
    }
}

// 4. Word Scramble helpers
function renderScrambleWord() {
    const container = document.getElementById("game-board-container");
    const board = container.querySelector(".scramble-board") || document.createElement("div");
    board.className = "scramble-board";
    
    const word = state.game.scrambleWords[state.game.currentQuestionIndex];
    let letterArray = word.split("");
    let scrambled = [...letterArray].sort(() => Math.random() - 0.5);
    while (scrambled.join("") === word && word.length > 1) {
        scrambled.sort(() => Math.random() - 0.5);
    }
    
    state.game.scrambleSpelled = "";
    
    board.innerHTML = `
        <div class="scramble-word-box" id="scramble-target-letters">${scrambled.join(" ")}</div>
        <div class="scramble-spelled" id="scramble-spelled-area"></div>
        <div class="scramble-letters-grid" id="scramble-btn-grid"></div>
    `;
    
    if (!container.querySelector(".scramble-board")) {
        container.appendChild(board);
    }
    
    const btnGrid = document.getElementById("scramble-btn-grid");
    scrambled.forEach((letter, idx) => {
        const btn = document.createElement("button");
        btn.className = "letter-btn";
        btn.textContent = letter;
        btn.onclick = () => handleScrambleLetterClick(letter, btn);
        btnGrid.appendChild(btn);
    });
}

function handleScrambleLetterClick(letter, btn) {
    if (btn.classList.contains("used")) return;
    
    btn.classList.add("used");
    state.game.scrambleSpelled += letter;
    document.getElementById("scramble-spelled-area").textContent = state.game.scrambleSpelled.split("").join(" ");
    
    const currentWord = state.game.scrambleWords[state.game.currentQuestionIndex];
    if (state.game.scrambleSpelled.length === currentWord.length) {
        if (state.game.scrambleSpelled === currentWord) {
            triggerCorrectEffects();
            state.game.currentQuestionIndex++;
            updateProgressDots();
            
            if (state.game.currentQuestionIndex >= 3) {
                setTimeout(finishGame, 300);
            } else {
                setTimeout(renderScrambleWord, 300);
            }
        } else {
            state.game.errors++;
            state.game.penaltyTime += 3;
            triggerPenaltyToast();
            
            setTimeout(() => {
                state.game.scrambleSpelled = "";
                document.getElementById("scramble-spelled-area").textContent = "";
                document.querySelectorAll(".letter-btn").forEach(b => b.classList.remove("used"));
            }, 500);
        }
    }
}

// 5. Stroop Game helpers
function generateStroopQuestions(count) {
    const colors = [
        { name: "ЧЕРВЕНО", code: "#ef4444", key: "red" },
        { name: "ЗЕЛЕНО", code: "#10b981", key: "green" },
        { name: "СИНЬО", code: "#3b82f6", key: "blue" },
        { name: "ЖЪЛТО", code: "#f59e0b", key: "yellow" }
    ];
    
    const questions = [];
    for (let i = 0; i < count; i++) {
        const textIdx = Math.floor(Math.random() * 4);
        const shouldMatch = Math.random() < 0.5;
        let colorIdx;
        if (shouldMatch) {
            colorIdx = textIdx;
        } else {
            colorIdx = (textIdx + Math.floor(Math.random() * 3) + 1) % 4;
        }
        questions.push({
            word: colors[textIdx].name,
            colorCode: colors[colorIdx].code,
            isMatch: textIdx === colorIdx
        });
    }
    return questions;
}

function showStroopQuestion() {
    const q = state.game.stroopQuestions[state.game.currentQuestionIndex];
    const display = document.getElementById("stroop-word-display");
    if (display) {
        display.textContent = q.word;
        display.style.color = q.colorCode;
    }
}

function handleStroopAnswer(userChoice) {
    const q = state.game.stroopQuestions[state.game.currentQuestionIndex];
    if (userChoice === q.isMatch) {
        triggerCorrectEffects();
        state.game.currentQuestionIndex++;
        updateProgressDots();
        if (state.game.currentQuestionIndex >= 5) {
            finishGame();
        } else {
            showStroopQuestion();
        }
    } else {
        state.game.errors++;
        state.game.penaltyTime += 3;
        triggerPenaltyToast();
        
        state.game.currentQuestionIndex++;
        updateProgressDots();
        if (state.game.currentQuestionIndex >= 5) {
            finishGame();
        } else {
            showStroopQuestion();
        }
    }
}

// 6. Number Order helpers
function handleNumberClick(num, cell) {
    if (num === state.game.targetNumber) {
        triggerCorrectEffects();
        cell.classList.add("clicked");
        state.game.targetNumber++;
        state.game.currentQuestionIndex = state.game.targetNumber - 1;
        updateProgressDots();
        
        if (state.game.targetNumber > 9) {
            setTimeout(finishGame, 300);
        }
    } else {
        state.game.errors++;
        state.game.penaltyTime += 3;
        triggerPenaltyToast();
    }
}

// 7. Catch Target helpers
function moveTarget() {
    const target = document.getElementById("target-circle-btn");
    if (!target) return;
    
    const board = document.querySelector(".target-board");
    if (!board) return;
    
    const boardWidth = board.clientWidth || 300;
    const boardHeight = board.clientHeight || 200;
    
    const maxLeft = boardWidth - 45;
    const maxTop = boardHeight - 45;
    
    const randomLeft = Math.floor(Math.random() * maxLeft) + 5;
    const randomTop = Math.floor(Math.random() * maxTop) + 5;
    
    target.style.left = `${randomLeft}px`;
    target.style.top = `${randomTop}px`;
}

function handleTargetClick() {
    triggerCorrectEffects();
    state.game.currentQuestionIndex++;
    updateProgressDots();
    
    if (state.game.currentQuestionIndex >= 5) {
        finishGame();
    } else {
        const target = document.getElementById("target-circle-btn");
        if (target) {
            target.textContent = `${state.game.currentQuestionIndex + 1}/5`;
        }
        moveTarget();
    }
}

// 8. Simon Says helpers
async function playSimonSequence() {
    state.game.simonFlashing = true;
    const buttons = document.querySelectorAll(".simon-btn");
    buttons.forEach(b => b.style.pointerEvents = "none");
    
    for (let i = 0; i < state.game.simonSequence.length; i++) {
        const colorIdx = state.game.simonSequence[i];
        const btn = document.querySelector(`.simon-btn[data-color-idx="${colorIdx}"]`);
        if (btn) {
            await new Promise(resolve => {
                setTimeout(() => {
                    btn.classList.add("active");
                    resolve();
                }, 100);
            });
            await new Promise(resolve => {
                setTimeout(() => {
                    btn.classList.remove("active");
                    resolve();
                }, 400);
            });
        }
        await new Promise(resolve => setTimeout(resolve, 150));
    }
    
    state.game.simonFlashing = false;
    state.game.simonPlayerStep = 0;
    buttons.forEach(b => b.style.pointerEvents = "auto");
}

function handleSimonClick(colorIdx) {
    if (state.game.simonFlashing) return;
    
    const btn = document.querySelector(`.simon-btn[data-color-idx="${colorIdx}"]`);
    if (btn) {
        btn.classList.add("active");
        setTimeout(() => btn.classList.remove("active"), 150);
    }
    
    const targetColorIdx = state.game.simonSequence[state.game.simonPlayerStep];
    if (colorIdx === targetColorIdx) {
        triggerCorrectEffects();
        state.game.simonPlayerStep++;
        state.game.currentQuestionIndex = state.game.simonPlayerStep;
        updateProgressDots();
        
        if (state.game.simonPlayerStep >= state.game.simonSequence.length) {
            setTimeout(finishGame, 400);
        }
    } else {
        state.game.errors++;
        state.game.penaltyTime += 3;
        triggerPenaltyToast();
        
        state.game.simonPlayerStep = 0;
        state.game.currentQuestionIndex = 0;
        updateProgressDots();
        setTimeout(() => {
            playSimonSequence();
        }, 1000);
    }
}

// 9. Grid Match helpers
function startGridRound() {
    const cells = document.querySelectorAll(".grid-cell");
    cells.forEach(c => {
        c.classList.remove("highlight", "selected");
        c.style.pointerEvents = "none";
    });
    
    const indices = [0, 1, 2, 3, 4, 5, 6, 7, 8].sort(() => Math.random() - 0.5).slice(0, 3);
    state.game.gridActivePattern = indices;
    state.game.gridSelectedPattern = [];
    
    indices.forEach(idx => {
        const cell = document.querySelector(`.grid-cell[data-cell-idx="${idx}"]`);
        if (cell) cell.classList.add("highlight");
    });
    
    setTimeout(() => {
        indices.forEach(idx => {
            const cell = document.querySelector(`.grid-cell[data-cell-idx="${idx}"]`);
            if (cell) cell.classList.remove("highlight");
        });
        cells.forEach(c => c.style.pointerEvents = "auto");
    }, 1200);
}

function handleGridCellClick(idx, cell) {
    if (cell.classList.contains("selected")) return;
    
    cell.classList.add("selected");
    state.game.gridSelectedPattern.push(idx);
    
    if (state.game.gridSelectedPattern.length === 3) {
        const isMatch = state.game.gridActivePattern.every(val => state.game.gridSelectedPattern.includes(val));
        if (isMatch) {
            triggerCorrectEffects();
            state.game.gridRound++;
            state.game.currentQuestionIndex = state.game.gridRound;
            updateProgressDots();
            
            if (state.game.gridRound >= 2) {
                setTimeout(finishGame, 400);
            } else {
                setTimeout(startGridRound, 600);
            }
        } else {
            state.game.errors++;
            state.game.penaltyTime += 3;
            triggerPenaltyToast();
            setTimeout(() => {
                startGridRound();
            }, 600);
        }
    }
}

// 10. Logic Quiz helpers
function generateLogicQuestions(count) {
    const logicBank = [
        { q: "Ако днес е вторник, вчера беше понеделник.", a: true },
        { q: "3 + 5 > 9 - 2 (8 е по-голямо от 7)", a: true },
        { q: "Котката по класификация е влечуго.", a: false },
        { q: "Слънцето изгрява от запад.", a: false },
        { q: "София е столицата на Република България.", a: true },
        { q: "Числото осем е по-малко от числото пет.", a: false },
        { q: "Ако утре е събота, днес е четвъртък.", a: false },
        { q: "Делтата на река Дунав се намира в Румъния.", a: true }
    ];
    return logicBank.sort(() => Math.random() - 0.5).slice(0, count);
}

function showLogicQuestion() {
    const q = state.game.logicQuestions[state.game.currentQuestionIndex];
    const textEl = document.getElementById("logic-question-text");
    if (textEl) {
        textEl.textContent = q.q;
    }
}

function handleLogicAnswer(userChoice) {
    const q = state.game.logicQuestions[state.game.currentQuestionIndex];
    if (userChoice === q.a) {
        triggerCorrectEffects();
        state.game.currentQuestionIndex++;
        updateProgressDots();
        
        if (state.game.currentQuestionIndex >= 3) {
            finishGame();
        } else {
            showLogicQuestion();
        }
    } else {
        state.game.errors++;
        state.game.penaltyTime += 3;
        triggerPenaltyToast();
        
        state.game.currentQuestionIndex++;
        updateProgressDots();
        
        if (state.game.currentQuestionIndex >= 3) {
            finishGame();
        } else {
            showLogicQuestion();
        }
    }
}

// Shared timers and toasts
function updateTimerDisplay() {
    const elapsed = Date.now() - state.game.startTime + (state.game.penaltyTime * 1000);
    state.game.elapsedTime = elapsed;
    
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    const ms = Math.floor((elapsed % 1000) / 10);

    const mStr = String(minutes).padStart(2, "0");
    const sStr = String(seconds).padStart(2, "0");
    const msStr = String(ms).padStart(2, "0");

    const timerDisp = document.getElementById("game-timer-display");
    if (timerDisp) {
        timerDisp.textContent = `${mStr}:${sStr}.${msStr}`;
    }
}

function updateProgressDots() {
    const dotsContainer = document.getElementById("game-dots");
    if (!dotsContainer) return;
    dotsContainer.innerHTML = "";
    
    const total = state.game.totalSteps || 5;
    for (let i = 0; i < total; i++) {
        const dot = document.createElement("span");
        dot.className = "dot";
        if (i < state.game.currentQuestionIndex) {
            dot.classList.add("completed");
        } else if (i === state.game.currentQuestionIndex) {
            dot.classList.add("active");
        }
        dotsContainer.appendChild(dot);
    }
}

function triggerPenaltyToast() {
    const toast = document.getElementById("penalty-alert");
    if (toast) {
        toast.classList.add("show");
        setTimeout(() => {
            toast.classList.remove("show");
        }, 1200);
    }
    // Sound and visual effects for errors
    playErrorSound();
    triggerErrorEffects();
}

function bindKeyboardEvents() {
    document.addEventListener("keydown", (e) => {
        const arenaActive = document.getElementById("game-arena-screen").classList.contains("active");
        if (!arenaActive) return;
        
        if (state.game.gameType === "math") {
            if (e.key === "Enter") {
                keypadSubmit();
            } else if (e.key === "Escape" || e.key === "c" || e.key === "C") {
                keypadClear();
            } else if (e.key >= "0" && e.key <= "9") {
                keypadPress(parseInt(e.key));
            }
        }
    });
}

// --- Finish Game & Leaderboard Calculation ---
function finishGame() {
    clearInterval(state.game.timerInterval);
    if (state.game.reflexTimeout) {
        clearTimeout(state.game.reflexTimeout);
        state.game.reflexTimeout = null;
    }
    document.getElementById("app-navigation-bar").style.display = "flex"; // Restore nav bar
    
    // Stop live opponents simulation chimes/updates
    stopLiveOpponentsSimulation();
    
    // Play sound and visual celebration!
    playWinSound();
    startConfetti();
    
    const finalTimeInSeconds = (state.game.elapsedTime / 1000).toFixed(2);
    
    // Attempt backend sync if online
    const apiCallPromise = (async () => {
        try {
            const response = await apiFetch('/api/lobbies/finish', {
                method: 'POST',
                body: JSON.stringify({
                    lobbyId: state.currentLobbyId,
                    finalTime: finalTimeInSeconds,
                    errors: state.game.errors
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                const mappedLobbyState = mapLobbyToClient(data.finalLobbyState);
                
                // Reload user state and history completely to make sure it's accurate
                saveState();
                await loadState();
                
                // Render
                renderLobbies();
                
                // Show leaderboard
                showLeaderboard(mappedLobbyState, "game");
                return true;
            }
        } catch (err) {
            console.warn("finishGame backend call failed, falling back to offline mode:", err);
        }
        return false;
    })();

    apiCallPromise.then(success => {
        if (success) return;

        // Fallback for offline mode
        const lobby = state.lobbies.find(l => l.id === state.currentLobbyId);
        if (lobby) {
            const me = lobby.players.find(p => p.isMe);
            if (me) {
                me.time = parseFloat(finalTimeInSeconds);
                me.errors = state.game.errors;
                me.finished = true;
            }

            // Simulate other players finishing times
            lobby.players.forEach(p => {
                if (!p.isMe) {
                    const botBaseTime = (Math.random() * 3.5 + 4.2).toFixed(2);
                    const botErrors = Math.floor(Math.random() * 2);
                    const botPenalty = botErrors * 3;
                    p.time = parseFloat(botBaseTime) + botPenalty;
                    p.errors = botErrors;
                    p.finished = true;
                }
            });

            // Determine Winner: lowest time
            const sortedPlayers = [...lobby.players].sort((a, b) => a.time - b.time);
            lobby.winner = sortedPlayers[0].name === "Вие (Участник)" ? "Вие" : sortedPlayers[0].name;
            lobby.status = "finished";

            // Snapshot finished tournament to history for full transparency
            if (!state.completedTournaments) {
                state.completedTournaments = [];
            }
            const archiveCopy = JSON.parse(JSON.stringify(lobby));
            archiveCopy.completedAt = getFormattedDate();
            archiveCopy.archiveId = Date.now();
            archiveCopy.isPractice = state.practiceModeActive || (lobby.isFriendDuel && lobby.isPractice);
            state.completedTournaments.unshift(archiveCopy);

            // Update User Profile Stats if user participated (exclude practice mode from real statistics)
            if (me) {
                if (!state.user) {
                    state.user = { phone: null, verified: false, gamesPlayed: 0, gamesWon: 0, prizesWonValue: 0, wonPrizesList: [] };
                }
                if (!state.practiceModeActive) {
                    state.user.gamesPlayed++;
                    if (lobby.winner === "Вие") {
                        state.user.gamesWon++;
                        state.user.prizesWonValue += lobby.prizeValue;
                        
                        if (lobby.isFriendDuel) {
                            // Friend duel: add cash prize to balance
                            state.balance = (state.balance || 0) + lobby.prizeValue;
                            if (!state.walletHistory) state.walletHistory = [];
                            state.walletHistory.unshift({
                                desc: `Спечелен Частен дуел (${lobby.prizeName}) 🏆`,
                                amount: lobby.prizeValue,
                                type: "deposit",
                                date: archiveCopy.completedAt
                            });
                            
                            if (state.balance >= 50.00) {
                                unlockAchievement("millionaire");
                            }
                        } else {
                            // Tournament: add physical prize to delivery list
                            if (!state.user.wonPrizesList) {
                                state.user.wonPrizesList = [];
                            }
                            state.user.wonPrizesList.unshift({
                                prizeName: lobby.prizeName,
                                prizeValue: lobby.prizeValue,
                                date: archiveCopy.completedAt,
                                archiveId: archiveCopy.archiveId,
                                deliveryStatus: "pending"
                            });
                        }
                    }
                } else {
                    state.practiceGamesPlayed++;
                }
            }

            // Reset the active lobby back to "waiting" so it can be re-played
            if (lobby.isFriendDuel) {
                state.lobbies = state.lobbies.filter(l => l.id !== lobby.id);
            } else {
                lobby.status = "waiting";
                lobby.winner = null;
                lobby.players = [];

                // Prepopulate with a random number of bots (1 to 3) so it looks active
                const startBotsCount = Math.min(lobby.maxPlayers - 2, Math.floor(Math.random() * 3));
                const botNames = ["Христо В.", "Иван П.", "Мартин С.", "Теодора А.", "Стефан Р.", "Мария Г."];
                for (let i = 0; i < startBotsCount; i++) {
                    lobby.players.push({
                        name: botNames[i],
                        isMe: false,
                        time: null,
                        errors: 0,
                        finished: false
                    });
                }
            }

            // XP and Quest Calculations
            if (me) {
                let xpGained = 0;
                if (state.practiceModeActive) {
                    xpGained = 10;
                    updateQuestProgress("practice", 1);
                } else if (lobby.isFriendDuel) {
                    xpGained = lobby.winner === "Вие" ? 150 : 70;
                    updateQuestProgress("duel", 1);
                    if (lobby.winner === "Вие") {
                        updateQuestProgress("win_duel", 1);
                    }
                } else {
                    xpGained = lobby.winner === "Вие" ? 150 : 50;
                    if (lobby.winner === "Вие") {
                        updateQuestProgress("win", 1);
                    }
                }
                
                // Apply XP
                awardXP(xpGained);
                
                // Check Achievements
                if (lobby.winner === "Вие") {
                    const finalTimeNum = parseFloat(finalTimeInSeconds);
                    if (finalTimeNum < 6.00) {
                        unlockAchievement("speed");
                    }
                    if (state.game.errors === 0) {
                        unlockAchievement("flawless");
                    }
                    if (state.user && state.user.gamesWon >= 3) {
                        unlockAchievement("collector");
                    }
                }
            }

            saveState();
            renderLobbies();
            
            // Show leaderboard of the snapshot run we just archived
            showLeaderboard(archiveCopy, "game");
        }
    });
}

// --- Leaderboard View ---
function showLeaderboard(lobby, source = "game") {
    state.lastLeaderboardSource = source;
    state.lastViewedLobbyForShare = lobby; // Save for social sharing
    showScreen("leaderboard-screen");
    document.getElementById("leaderboard-prize-title").textContent = `Турнир за: ${lobby.prizeName}`;

    const me = lobby.players.find(p => p.isMe);
    const myScoreBanner = document.getElementById("my-score-banner");
    const myFinalResult = document.getElementById("my-final-result");

    if (me && me.finished) {
        myScoreBanner.style.display = "block";
        myFinalResult.textContent = `${me.time.toFixed(2)} сек (${me.errors} грешки)`;
        
        if (lobby.winner === "Вие") {
            myScoreBanner.className = "my-score-banner glass";
            myScoreBanner.querySelector("span").textContent = "🏆 Честито! Вие спечелихте!";
        } else {
            myScoreBanner.className = "my-score-banner lose glass";
            myScoreBanner.querySelector("span").textContent = "Участието приключи";
        }
    } else {
        myScoreBanner.style.display = "none";
    }

    // Toggle share container visibility
    const shareContainer = document.getElementById("share-victory-container");
    if (shareContainer) {
        if (lobby.winner === "Вие") {
            shareContainer.style.display = "block";
        } else {
            shareContainer.style.display = "none";
        }
    }

    // Render leaderboard rows
    const rankingList = document.getElementById("ranking-list");
    rankingList.innerHTML = "";

    // Sort players by time
    const sorted = [...lobby.players].sort((a, b) => {
        if (!a.time) return 1;
        if (!b.time) return -1;
        return a.time - b.time;
    });

    sorted.forEach((p, idx) => {
        const row = document.createElement("div");
        const isWinner = idx === 0;
        row.className = `ranking-row ${isWinner ? 'winner' : ''} ${p.isMe ? 'me' : ''}`;
        
        let positionIcon = `${idx + 1}.`;
        if (idx === 0) positionIcon = "🥇";
        else if (idx === 1) positionIcon = "🥈";
        else if (idx === 2) positionIcon = "🥉";

        row.innerHTML = `
            <div class="player-info">
                <span class="ranking-pos">${positionIcon}</span>
                <span class="player-avatar">${p.name[0]}</span>
                <span class="player-name">${p.name} ${p.isMe ? '(Вие)' : ''}</span>
            </div>
            <span class="ranking-score">${p.time ? p.time.toFixed(2) + 'с' : 'Няма опит'}</span>
        `;
        rankingList.appendChild(row);
    });
}

function closeLeaderboard() {
    if (state.lastLeaderboardSource === "history") {
        showScreen("history-screen");
        navSwitch("history");
    } else {
        showScreen("user-lobbies-screen");
        navSwitch("user-lobbies");
    }
}

// --- History View ---
function renderHistory() {
    const listContainer = document.getElementById("history-list");
    if (!listContainer) return;

    listContainer.innerHTML = "";

    const completed = state.completedTournaments || [];
    if (completed.length === 0) {
        listContainer.innerHTML = `
            <div class="empty-state text-center" style="padding: 40px 15px; color: var(--text-muted);">
                <span style="font-size: 36px; display: block; margin-bottom: 10px;">⏳</span>
                <p style="font-size: 13px; font-weight: 600;">Все още няма приключили турнири.</p>
                <p style="font-size: 11px; margin-top: 5px;">След приключване на игра, резултатите се появяват тук за прозрачност.</p>
            </div>
        `;
        return;
    }

    completed.forEach(run => {
        const card = document.createElement("div");
        card.className = "history-tournament-card glass";
        
        const me = run.players.find(p => p.isMe);
        const userWon = run.winner === "Вие";
        
        let participantText = "Не сте участвали";
        let badgeClass = "badge-neutral";
        if (me) {
            participantText = userWon ? "Спечелен от Вас 🏆" : "Участие (Загуба)";
            badgeClass = userWon ? "badge-success" : "badge-danger";
        }
        
        card.innerHTML = `
            <div class="history-card-header">
                <div>
                    <span class="badge ${badgeClass}">${participantText}</span>
                    <span class="history-date">${run.completedAt || ''}</span>
                </div>
                <h3 style="margin: 8px 0 2px 0; color: #fff; font-size: 14px;">${run.prizeName}</h3>
            </div>
            <div class="history-card-body" style="font-size: 11px; display: flex; justify-content: space-between; color: var(--text-muted); margin-bottom: 10px;">
                <span><strong>Победител:</strong> ${run.winner}</span>
                <span><strong>Игра:</strong> ${getGameTypeNameBg(run.gameType)}</span>
            </div>
            <button class="btn btn-secondary btn-sm w-100" style="font-size: 10px; padding: 6px;" onclick="showArchivedLeaderboard(${run.archiveId})">
                Виж детайлно класиране 📊
            </button>
        `;
        listContainer.appendChild(card);
    });
}

function getGameTypeNameBg(gameType) {
    const names = {
        "math": "Математически Блиц",
        "memory": "Карти за Памет",
        "reflex": "Тест за Бърз Рефлекс",
        "scramble": "Разбъркани Думи",
        "stroop": "Тест на Струп",
        "numbers": "Подреди Числата 1-9",
        "target": "Хвани Бързо Целта",
        "simon": "Саймън Казва",
        "grid": "Решетъчен Шаблон",
        "logic": "Логически Загадки"
    };
    return names[gameType] || gameType;
}

function showArchivedLeaderboard(archiveId) {
    const run = state.completedTournaments.find(t => t.archiveId === archiveId);
    if (run) {
        showLeaderboard(run, "history");
    }
}

// --- Profile & SMS Verification Logic ---
async function sendSMSVerificationCode() {
    const fullnameInput = document.getElementById("profile-fullname-input").value.trim();
    const cityInput = document.getElementById("profile-city-input").value.trim();
    const addressInput = document.getElementById("profile-address-input").value.trim();
    const phoneInput = document.getElementById("profile-phone-input").value.trim();
    
    if (!fullnameInput || fullnameInput.length < 4) {
        alert("Моля, въведете Две Имена (Име и Фамилия).");
        return;
    }
    if (!cityInput || cityInput.length < 2) {
        alert("Моля, въведете населено място (Град/Село).");
        return;
    }
    if (!addressInput || addressInput.length < 5) {
        alert("Моля, въведете пълен адрес за доставка.");
        return;
    }
    if (!phoneInput || phoneInput.length < 8) {
        alert("Моля, въведете валиден телефонен номер.");
        return;
    }
    
    try {
        const response = await fetch('/api/auth/register-sms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phone: phoneInput,
                fullname: fullnameInput,
                city: cityInput,
                address: addressInput
            })
        });
        
        if (response.ok) {
            const res = await response.json();
            
            state.game.smsSimulatedCode = res.code;
            state.game.smsTempPhone = phoneInput;
            state.game.smsTempFullname = fullnameInput;
            state.game.smsTempCity = cityInput;
            state.game.smsTempAddress = addressInput;
            
            // Show simulator alert
            const alertBox = document.getElementById("sms-simulation-alert");
            const codeDisplay = document.getElementById("sms-simulated-code");
            if (alertBox && codeDisplay) {
                alertBox.style.display = "block";
                codeDisplay.textContent = res.code;
            }
            
            // Show code input group
            const codeInputGroup = document.getElementById("code-input-group");
            if (codeInputGroup) {
                codeInputGroup.style.display = "block";
            }
        } else {
            const err = await response.json();
            alert("Грешка при изпращане на SMS: " + err.error);
        }
    } catch (err) {
        console.error("SMS register error:", err);
        // Fallback for offline mode
        const code = Math.floor(1000 + Math.random() * 9000);
        state.game.smsSimulatedCode = code.toString();
        state.game.smsTempPhone = phoneInput;
        state.game.smsTempFullname = fullnameInput;
        state.game.smsTempCity = cityInput;
        state.game.smsTempAddress = addressInput;
        
        const alertBox = document.getElementById("sms-simulation-alert");
        const codeDisplay = document.getElementById("sms-simulated-code");
        if (alertBox && codeDisplay) {
            alertBox.style.display = "block";
            codeDisplay.textContent = code;
        }
        
        const codeInputGroup = document.getElementById("code-input-group");
        if (codeInputGroup) {
            codeInputGroup.style.display = "block";
        }
    }
}

async function verifySMSCode() {
    const codeInput = document.getElementById("profile-code-input").value.trim();
    const phone = state.game.smsTempPhone;
    
    try {
        const response = await fetch('/api/auth/verify-sms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, code: codeInput })
        });
        
        if (response.ok) {
            const res = await response.json();
            
            state.user.verified = true;
            state.user.phone = res.user.phone;
            state.user.fullname = res.user.fullname;
            state.user.city = res.user.city;
            state.user.address = res.user.address;
            
            saveState();
            await loadState(); // Reload state from backend to sync
            renderProfile();
            alert("Успешна верификация и регистрация! Профилът Ви беше отключен.");
        } else {
            alert("Невалиден верификационен код. Моля, опитайте отново.");
        }
    } catch (err) {
        console.error("SMS verify error:", err);
        // Fallback
        if (codeInput === state.game.smsSimulatedCode) {
            state.user.verified = true;
            state.user.phone = state.game.smsTempPhone;
            state.user.fullname = state.game.smsTempFullname;
            state.user.city = state.game.smsTempCity;
            state.user.address = state.game.smsTempAddress;
            saveState();
            renderProfile();
            alert("Успешна верификация и регистрация! (Офлайн режим).");
        } else {
            alert("Невалиден верификационен код. Моля, опитайте отново.");
        }
    }
}

function renderProfile() {
    const unverifiedView = document.getElementById("profile-unverified-view");
    const verifiedView = document.getElementById("profile-verified-view");
    if (!unverifiedView || !verifiedView) return;
    
    if (state.user.verified) {
        unverifiedView.style.display = "none";
        verifiedView.style.display = "block";
        
        document.getElementById("profile-phone-display").textContent = state.user.phone;
        
        // Update avatar display
        const avatarDisplay = document.getElementById("profile-avatar-display");
        if (avatarDisplay) {
            avatarDisplay.textContent = state.activeAvatar || "👤";
        }
        
        // Update XP details and league details
        const leagueDetails = getLeagueDetails(state.xp);
        const leagueNameEl = document.getElementById("profile-league-name");
        const xpTextEl = document.getElementById("profile-xp-text");
        const xpFillEl = document.getElementById("profile-xp-fill");
        const avatarTitleEl = document.getElementById("profile-avatar-title");
        
        if (avatarTitleEl) avatarTitleEl.textContent = leagueDetails.title;
        if (leagueNameEl) leagueNameEl.textContent = leagueDetails.name;
        
        if (xpTextEl && xpFillEl) {
            if (state.xp >= 5000) {
                xpTextEl.textContent = state.xp + " XP";
                xpFillEl.style.width = "100%";
            } else {
                xpTextEl.textContent = `${state.xp} / ${leagueDetails.maxXp} XP`;
                const pct = Math.max(0, Math.min(100, ((state.xp - leagueDetails.minXp) / (leagueDetails.maxXp - leagueDetails.minXp)) * 100));
                xpFillEl.style.width = pct + "%";
            }
        }
        
        // Render daily quests
        const questsListEl = document.getElementById("quests-list");
        if (questsListEl) {
            questsListEl.innerHTML = "";
            if (!state.dailyQuests || state.dailyQuests.length === 0) {
                state.dailyQuests = generateDailyQuests();
            }
            state.dailyQuests.forEach(quest => {
                const isCompleted = quest.current >= quest.target;
                const isClaimed = quest.claimed;
                
                let actionHtml = "";
                if (isClaimed) {
                    actionHtml = `<span style="font-size: 10px; color: var(--success); font-weight: bold;">✓ Взета</span>`;
                } else if (isCompleted) {
                    actionHtml = `<button class="btn btn-accent btn-sm" onclick="claimQuestReward('${quest.id}')" style="font-size: 8px; padding: 2px 6px; height: auto;">Вземи €${quest.reward.toFixed(2)}</button>`;
                } else {
                    actionHtml = `<span style="font-size: 9px; color: var(--text-muted); font-family: monospace;">${quest.current}/${quest.target}</span>`;
                }
                
                const div = document.createElement("div");
                div.style = "display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.02); padding: 6px 8px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.04);";
                div.innerHTML = `
                    <div style="text-align: left; max-width: 70%;">
                        <p style="font-size: 10px; color: #fff; font-weight: 500; margin: 0; line-height: 1.2;">${quest.desc}</p>
                        <p style="font-size: 8px; color: var(--text-muted); margin: 2px 0 0 0;">Награда: <span style="color: var(--success); font-weight: 600;">€${quest.reward.toFixed(2)}</span></p>
                    </div>
                    <div>
                        ${actionHtml}
                    </div>
                `;
                questsListEl.appendChild(div);
            });
        }
        
        // Render achievements
        const badgeGridEl = document.getElementById("achievements-badge-grid");
        if (badgeGridEl) {
            badgeGridEl.innerHTML = "";
            ACHIEVEMENTS.forEach(achievement => {
                const isUnlocked = state.unlockedAchievements && state.unlockedAchievements.includes(achievement.id);
                
                const div = document.createElement("div");
                div.style = "display: flex; flex-direction: column; align-items: center;";
                div.innerHTML = `
                    <div class="achievement-badge-icon ${isUnlocked ? 'unlocked' : ''}">${achievement.icon}</div>
                    <span style="font-size: 8px; color: #fff; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 60px; display: block;" title="${achievement.name}">${achievement.name}</span>
                    <span style="font-size: 7px; color: var(--text-muted); line-height: 1.1; margin-top: 1px; display: block; max-width: 65px; height: 16px; overflow: hidden;" title="${achievement.desc}">${achievement.desc}</span>
                `;
                badgeGridEl.appendChild(div);
            });
        }
        
        // Show delivery details
        document.getElementById("profile-display-fullname").textContent = state.user.fullname || "-";
        document.getElementById("profile-display-city").textContent = state.user.city || "-";
        document.getElementById("profile-display-address").textContent = state.user.address || "-";
        document.getElementById("profile-display-phone").textContent = state.user.phone || "-";
        
        document.getElementById("profile-stat-played").textContent = state.user.gamesPlayed;
        document.getElementById("profile-stat-won").textContent = state.user.gamesWon;
        document.getElementById("profile-stat-prizes-value").textContent = `€${state.user.prizesWonValue.toFixed(2)}`;
        
        // Calculate win rate
        const winRate = state.user.gamesPlayed > 0 
            ? Math.round((state.user.gamesWon / state.user.gamesPlayed) * 100) 
            : 0;
        document.getElementById("profile-stat-winrate").textContent = `${winRate}%`;
        
        // Render won prizes list
        const list = document.getElementById("profile-won-prizes-list");
        if (list) {
            list.innerHTML = "";
            
            if (!state.user.wonPrizesList || state.user.wonPrizesList.length === 0) {
                list.innerHTML = `<p style="font-size: 11px; color: var(--text-gray); text-align: center; padding: 10px 0;">Все още нямате спечелени награди.</p>`;
            } else {
                state.user.wonPrizesList.forEach(prize => {
                    // Check if delivery status was updated in completedTournaments
                    const completedRun = state.completedTournaments.find(t => t.archiveId === prize.archiveId);
                    const status = completedRun ? completedRun.deliveryStatus : prize.deliveryStatus;
                    
                    const isShipped = status === "shipped";
                    const statusText = isShipped ? "Изпратена" : "За обработка";
                    const statusClass = isShipped ? "badge-success" : "badge-neutral";
                    
                    const item = document.createElement("div");
                    item.className = "won-prize-item";
                    item.innerHTML = `
                        <div class="won-prize-item-left">
                            <span class="won-prize-title">${prize.prizeName}</span>
                            <span class="won-prize-date">${prize.date}</span>
                        </div>
                        <span class="badge ${statusClass}">${statusText}</span>
                    `;
                    list.appendChild(item);
                });
            }
        }
    } else {
        unverifiedView.style.display = "block";
        verifiedView.style.display = "none";
        
        document.getElementById("profile-fullname-input").value = state.user.fullname || "";
        document.getElementById("profile-city-input").value = state.user.city || "";
        document.getElementById("profile-address-input").value = state.user.address || "";
        document.getElementById("profile-phone-input").value = state.user.phone || "+359 ";
        
        document.getElementById("profile-code-input").value = "";
        document.getElementById("sms-simulation-alert").style.display = "none";
        document.getElementById("code-input-group").style.display = "none";
    }
}

// --- ADMIN CREATE LOBBY ---
async function adminCreateLobby(event) {
    event.preventDefault();

    const name = document.getElementById("admin-prize-name").value;
    const val = parseFloat(document.getElementById("admin-prize-value").value);
    const ticket = parseFloat(document.getElementById("admin-ticket-price").value);
    const max = parseInt(document.getElementById("admin-max-players").value);
    const prod = document.getElementById("admin-product-type").value;
    const gameType = document.getElementById("admin-game-type").value;
    
    let prodUrl = document.getElementById("admin-prize-product-url").value.trim();
    if (prodUrl && !/^https?:\/\//i.test(prodUrl)) {
        prodUrl = "https://" + prodUrl;
    }
    const imgUrl = document.getElementById("admin-prize-image-url").value.trim();
    const resolvedImage = imgUrl || resolveProductImage(name, prodUrl);

    try {
        const response = await apiFetch('/api/admin/create-lobby', {
            method: 'POST',
            body: JSON.stringify({
                prizeName: name,
                prizeValue: val,
                ticketPrice: ticket,
                maxPlayers: max,
                productType: prod,
                gameType: gameType,
                image: resolvedImage,
                productUrl: prodUrl || null
            })
        });
        
        if (response.ok) {
            document.getElementById("admin-create-lobby-form").reset();
            document.getElementById("admin-image-preview-box").style.display = "none";
            document.getElementById("admin-image-preview").src = "";
            
            saveState();
            await loadState(); // Sync lists from DB
            
            alert(`Турнирът за "${name}" беше създаден успешно!`);
            switchRole("user");
            return;
        }
    } catch (err) {
        console.error("adminCreateLobby error:", err);
    }
    
    // Fallback for offline mode
    const newLobby = {
        id: state.lobbies.length + 1,
        prizeName: name,
        prizeValue: val,
        ticketPrice: ticket,
        maxPlayers: max,
        productType: prod,
        gameType: gameType,
        image: resolvedImage,
        productUrl: prodUrl || null,
        deliveryStatus: "pending",
        status: "waiting",
        players: [],
        winner: null
    };

    const startBotsCount = Math.min(max - 2, Math.floor(Math.random() * 3));
    const botNames = ["Христо В.", "Иван П.", "Мартин С.", "Теодора А.", "Стефан Р.", "Мария Г."];
    for (let i = 0; i < startBotsCount; i++) {
        newLobby.players.push({
            name: botNames[i],
            isMe: false,
            time: null,
            errors: 0,
            finished: false
        });
    }

    state.lobbies.push(newLobby);
    saveState();
    
    document.getElementById("admin-create-lobby-form").reset();
    document.getElementById("admin-image-preview-box").style.display = "none";
    document.getElementById("admin-image-preview").src = "";
    
    renderLobbies();
    updateUI();
    
    alert(`Турнирът за "${name}" беше създаден успешно! (Офлайн)`);
    switchRole("user");
}

// --- Demo State Modifier (Control Panel) ---
function addDemoFunds(amount) {
    state.balance += amount;
    
    state.walletHistory.unshift({
        desc: "Демо захранване от конзола",
        amount: amount,
        type: "deposit",
        date: getFormattedDate()
    });

    saveState();
    updateUI();
}

function switchRole(role) {
    state.role = role;
    saveState();
    updateUI();
}

async function resetApp() {
    if (confirm("Сигурни ли сте, че искате да нулирате състоянието и лобитата?")) {
        try {
            const response = await apiFetch('/api/user/reset-state', {
                method: 'POST'
            });
            if (response.ok) {
                resetStateToDefault();
                await loadState();
                renderLobbies();
                showScreen("user-lobbies-screen");
                navSwitch("user-lobbies");
                alert("Системата беше нулирана.");
                return;
            }
        } catch (err) {
            console.error("resetApp error:", err);
        }
        
        // Fallback for offline mode
        resetStateToDefault();
        renderLobbies();
        updateUI();
        showScreen("user-lobbies-screen");
        navSwitch("user-lobbies");
        alert("Системата беше нулирана. (Офлайн)");
    }
}

// --- Synchronize UI Elements ---
function updateUI() {
    const formattedBalance = `€${state.balance.toFixed(2)}`;
    
    // Updates
    document.getElementById("dev-balance").textContent = formattedBalance;
    document.getElementById("user-balance-header").textContent = formattedBalance;
    document.getElementById("wallet-balance-num").textContent = formattedBalance;

    // Update role active classes in Control Panel
    if (state.role === "admin") {
        document.getElementById("btn-role-admin").classList.add("active");
        document.getElementById("btn-role-user").classList.remove("active");
        
        // Inside Phone simulator, show admin screen, hide bottom nav
        showScreen("admin-screen");
        document.getElementById("app-navigation-bar").style.display = "none";
    } else {
        document.getElementById("btn-role-user").classList.add("active");
        document.getElementById("btn-role-admin").classList.remove("active");
        
        // Inside Phone simulator, show lobbies screen, show bottom nav
        showScreen("user-lobbies-screen");
        document.getElementById("app-navigation-bar").style.display = "flex";
        navSwitch("user-lobbies");
    }

    // Refresh transactions list
    const historyList = document.getElementById("wallet-history-list");
    if (historyList) {
        historyList.innerHTML = "";
        state.walletHistory.forEach(item => {
            const li = document.createElement("li");
            li.className = "history-item";
            const sign = item.type === "deposit" ? "+" : "-";
            const colorClass = item.type === "deposit" ? "text-success" : "text-danger";
            li.innerHTML = `
                <div>
                    <span>${item.desc}</span>
                    <p style="font-size: 9px; color: var(--text-muted); margin-top: 2px;">${item.date}</p>
                </div>
                <span class="${colorClass}">${sign} €${item.amount.toFixed(2)}</span>
            `;
            historyList.appendChild(li);
        });
    }

    // Update Admin Stats
    const grossRevEl = document.getElementById("admin-stat-gross-revenue");
    const netProfitEl = document.getElementById("admin-stat-net-profit");
    const totalPayoutsEl = document.getElementById("admin-stat-total-payouts");
    const userPayoutsEl = document.getElementById("admin-stat-user-payouts");
    
    const activeRoomsEl = document.getElementById("admin-stat-active-rooms");
    const pendingDelEl = document.getElementById("admin-stat-pending-deliveries");
    const shippedDelEl = document.getElementById("admin-stat-shipped-deliveries");

    if (grossRevEl || netProfitEl || totalPayoutsEl || userPayoutsEl) {
        let grossRevenue = 0;
        let netProfit = 0;
        let totalPayouts = 0;
        let userPayouts = 0;
        
        let activeRooms = 0;
        let pendingDeliveries = 0;
        let shippedDeliveries = 0;

        let feesCollected = 0;
        let tournamentFees = 0;
        let duelFees = 0;
        let realCashPayouts = 0;
        let realPhysicalPayouts = 0;
        let botSavings = 0;
        let netAppEarnings = 0;

        // Count active lobbies
        state.lobbies.forEach(lobby => {
            if (lobby.status !== "finished") {
                activeRooms++;
            }
        });

        // Count completed entries
        (state.completedTournaments || []).forEach(lobby => {
            if (lobby.isPractice) return; // Exclude practice mode from financial stats
            
            if (lobby.isFriendDuel) {
                // Friend duel:
                // Collected from bets: 2 * bet
                // Paid out to winner: 1.8 * bet
                // Platform profit: 0.2 * bet
                const bet = lobby.ticketPrice || 0;
                const collected = bet * 2;
                const paidOut = bet * 1.8;
                const profit = bet * 0.2;

                grossRevenue += collected;
                totalPayouts += paidOut;
                netProfit += profit;

                feesCollected += collected;
                duelFees += collected;

                if (lobby.winner === "Вие") {
                    userPayouts += paidOut;
                    realCashPayouts += paidOut;
                } else {
                    botSavings += paidOut;
                }
            } else {
                // Tournament:
                // Collected from tickets: players.length * ticketPrice
                // Paid out prize: prizeValue
                // Platform profit: (players.length * ticketPrice) - prizeValue
                const collected = lobby.players.length * lobby.ticketPrice;
                const paidOut = lobby.prizeValue;
                const profit = collected - paidOut;

                grossRevenue += collected;
                totalPayouts += paidOut;
                netProfit += profit;

                feesCollected += collected;
                tournamentFees += collected;

                if (lobby.winner === "Вие") {
                    userPayouts += paidOut;
                    realPhysicalPayouts += paidOut;
                } else {
                    botSavings += paidOut;
                }

                if (lobby.productUrl) {
                    if (lobby.deliveryStatus === "shipped") {
                        shippedDeliveries++;
                    } else {
                        pendingDeliveries++;
                    }
                }
            }
        });

        netAppEarnings = feesCollected - realCashPayouts - realPhysicalPayouts;

        if (grossRevEl) grossRevEl.textContent = `€${grossRevenue.toFixed(2)}`;
        if (netProfitEl) netProfitEl.textContent = `€${netProfit.toFixed(2)}`;
        if (totalPayoutsEl) totalPayoutsEl.textContent = `€${totalPayouts.toFixed(2)}`;
        if (userPayoutsEl) userPayoutsEl.textContent = `€${userPayouts.toFixed(2)}`;
        
        // Render detailed elements
        const feesCollEl = document.getElementById("admin-stat-fees-collected");
        const tourFeesEl = document.getElementById("admin-stat-tournament-fees");
        const duelFeesEl = document.getElementById("admin-stat-duel-fees");
        const realCashPayEl = document.getElementById("admin-stat-real-cash-payouts");
        const realPhysPayEl = document.getElementById("admin-stat-real-physical-payouts");
        const botSavEl = document.getElementById("admin-stat-bot-savings");
        const netAppEarnEl = document.getElementById("admin-stat-net-app-earnings");

        if (feesCollEl) feesCollEl.textContent = `€${feesCollected.toFixed(2)}`;
        if (tourFeesEl) tourFeesEl.textContent = `€${tournamentFees.toFixed(2)}`;
        if (duelFeesEl) duelFeesEl.textContent = `€${duelFees.toFixed(2)}`;
        if (realCashPayEl) realCashPayEl.textContent = `€${realCashPayouts.toFixed(2)}`;
        if (realPhysPayEl) realPhysPayEl.textContent = `€${realPhysicalPayouts.toFixed(2)}`;
        if (botSavEl) botSavEl.textContent = `€${botSavings.toFixed(2)}`;
        if (netAppEarnEl) netAppEarnEl.textContent = `€${netAppEarnings.toFixed(2)}`;
        
        if (activeRoomsEl) activeRoomsEl.textContent = activeRooms;
        if (pendingDelEl) pendingDelEl.textContent = pendingDeliveries;
        if (shippedDelEl) shippedDelEl.textContent = shippedDeliveries;
    }

    // Render Admin Orders List
    const ordersList = document.getElementById("admin-orders-list");
    if (ordersList) {
        ordersList.innerHTML = "";
        
        // Filter finished lobbies that have a product URL from completed tournaments
        const finishedLobbies = (state.completedTournaments || []).filter(l => l.productUrl);
        
        if (finishedLobbies.length === 0) {
            ordersList.innerHTML = `<p style="font-size: 11px; color: var(--text-gray); text-align: center; padding: 15px 0;">Няма приключили турнири за изпращане.</p>`;
        } else {
            finishedLobbies.forEach(lobby => {
                const card = document.createElement("div");
                card.className = "order-card";
                
                const isPending = lobby.deliveryStatus !== "shipped";
                const statusText = isPending ? "За закупуване" : "Изпратено";
                const statusClass = isPending ? "pending" : "shipped";
                
                let winnerDetails = "";
                if (lobby.winner === "Вие" && state.user.verified) {
                    winnerDetails = `
                        <div style="background: rgba(255,255,255,0.03); border: 1px dashed var(--border-light); padding: 8px; border-radius: 6px; margin-top: 5px; font-size: 11px; line-height: 1.4;">
                            <strong style="color: var(--success);">📦 Данни за доставка на победителя:</strong><br>
                            • Име: ${state.user.fullname || 'Неизвестно'}<br>
                            • Град: ${state.user.city || 'Неизвестно'}<br>
                            • Адрес: ${state.user.address || 'Неизвестно'}<br>
                            • Телефон: ${state.user.phone || 'Неизвестно'}
                        </div>
                    `;
                } else {
                    winnerDetails = `
                        <div style="background: rgba(255,255,255,0.03); border: 1px dashed var(--border-light); padding: 8px; border-radius: 6px; margin-top: 5px; font-size: 11px; line-height: 1.4;">
                            <strong style="color: var(--primary);">📦 Данни за доставка на победителя (Бот/Симулация):</strong><br>
                            • Име: ${lobby.winner}<br>
                            • Град: София<br>
                            • Адрес: Симулиран адрес на победителя<br>
                            • Телефон: +359 888 999 999
                        </div>
                    `;
                }

                card.innerHTML = `
                    <div class="order-header">
                        <span class="order-title">${lobby.prizeName} (Турнир #${lobby.id})</span>
                        <span class="order-status-badge ${statusClass}">${statusText}</span>
                    </div>
                    <div class="order-meta">
                        <span><strong>Победител:</strong> ${lobby.winner}</span>
                        ${winnerDetails}
                        <span><strong>Завършен на:</strong> ${lobby.completedAt || ''}</span>
                        <span><strong>Оборот от вход:</strong> €${(lobby.players.length * lobby.ticketPrice).toFixed(2)}</span>
                    </div>
                    <div class="order-actions">
                        <button class="btn btn-accent" onclick="window.open('${lobby.productUrl}', '_blank')">
                            Купи (Отвори линк) ↗
                        </button>
                        ${isPending ? `
                        <button class="btn btn-success" onclick="adminMarkShipped(${lobby.archiveId})">
                            Маркирай като изпратено
                        </button>
                        ` : ''}
                    </div>
                `;
                ordersList.appendChild(card);
            });
        }
    }
}

// --- Admin Delivery Actions ---
async function adminMarkShipped(archiveId) {
    try {
        const response = await apiFetch('/api/admin/mark-shipped', {
            method: 'POST',
            body: JSON.stringify({ archiveId })
        });
        
        if (response.ok) {
            const lobby = state.completedTournaments.find(l => l.archiveId === archiveId);
            const prizeNameText = lobby ? lobby.prizeName : `Турнир #${archiveId}`;
            
            saveState();
            await loadState(); // Sync lists from DB
            
            alert(`Турнирът за "${prizeNameText}" е маркиран като изпратен до победителя!`);
            return;
        }
    } catch (err) {
        console.error("adminMarkShipped error:", err);
    }
    
    // Fallback for offline mode
    const lobby = state.completedTournaments.find(l => l.archiveId === archiveId);
    if (lobby) {
        lobby.deliveryStatus = "shipped";
        if (state.user && state.user.wonPrizesList) {
            const prize = state.user.wonPrizesList.find(p => p.archiveId === archiveId);
            if (prize) {
                prize.deliveryStatus = "shipped";
            }
        }
        saveState();
        updateUI();
        alert(`Турнирът за "${lobby.prizeName}" е маркиран като изпратен до победителя! (Офлайн)`);
    }
}

// --- Smart Image Resolver Mock ---
function resolveProductImage(prizeName, productUrl) {
    const text = (prizeName + " " + productUrl).toLowerCase();
    
    if (text.includes("кафе") || text.includes("кофе") || text.includes("coffee") || text.includes("espresso") || text.includes("еспресо") || text.includes("cup") || text.includes("ikea")) {
        return "coffee_set.png"; // Fallback to our local premium coffee set asset!
    }
    if (text.includes("fryer") || text.includes("фритюрник") || text.includes("tefal") || text.includes("philips") || text.includes("уред за готвене") || text.includes("grill") || text.includes("easy fry") || text.includes("ey905d10")) {
        return "https://images.unsplash.com/photo-1621972750749-0fbb1abb7736?w=600&auto=format&fit=crop";
    }
    if (text.includes("phone") || text.includes("телефон") || text.includes("gsm") || text.includes("iphone") || text.includes("samsung") || text.includes("xiaomi") || text.includes("mobile")) {
        return "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&auto=format&fit=crop";
    }
    if (text.includes("watch") || text.includes("часовник") || text.includes("smartwatch") || text.includes("garmin") || text.includes("fitbit") || text.includes("часовни")) {
        return "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop";
    }
    if (text.includes("headphones") || text.includes("слушалки") || text.includes("airpools") || text.includes("airpods") || text.includes("audio") || text.includes("speaker") || text.includes("колонка")) {
        return "https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=600&auto=format&fit=crop";
    }
    if (text.includes("laptop") || text.includes("лаптоп") || text.includes("macbook") || text.includes("компютър") || text.includes("computer") || text.includes("asus") || text.includes("dell")) {
        return "https://images.unsplash.com/photo-1496181130204-755241524eab?w=600&auto=format&fit=crop";
    }
    if (text.includes("backpack") || text.includes("раница") || text.includes("bag") || text.includes("чанта") || text.includes("куфар")) {
        return "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&auto=format&fit=crop";
    }
    if (text.includes("camera") || text.includes("камера") || text.includes("фотоапарат") || text.includes("gopro") || text.includes("sony")) {
        return "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&auto=format&fit=crop";
    }
    if (text.includes("shoes") || text.includes("обувки") || text.includes("кецове") || text.includes("sneakers") || text.includes("nike") || text.includes("adidas")) {
        return "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop";
    }
    if (text.includes("perfume") || text.includes("парфюм") || text.includes("козметика")) {
        return "https://images.unsplash.com/photo-1541643600914-78b084683601?w=600&auto=format&fit=crop";
    }
    // Fallback to Polaroid camera photo, very aesthetic product photo
    return "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&auto=format&fit=crop";
}

// --- Admin Real-time Image Preview & Web Scraper Simulation ---
function bindAdminPreviewEvents() {
    const nameInput = document.getElementById("admin-prize-name");
    const urlInput = document.getElementById("admin-prize-product-url");
    const imageInput = document.getElementById("admin-prize-image-url");
    const fileInput = document.getElementById("admin-prize-image-file");
    const previewBox = document.getElementById("admin-image-preview-box");
    const previewImg = document.getElementById("admin-image-preview");
    const spinner = document.getElementById("admin-preview-spinner");

    if (!nameInput || !urlInput || !imageInput || !fileInput) return;

    async function resolveAndFetchImage() {
        // If a file was manually uploaded, don't overwrite it with URL scrapers
        if (fileInput.files && fileInput.files.length > 0) return;

        const name = nameInput.value.trim();
        let url = urlInput.value.trim();
        if (url && !/^https?:\/\//i.test(url)) {
            url = "https://" + url;
        }

        if (!name && !url) {
            previewBox.style.display = "none";
            return;
        }

        previewBox.style.display = "flex";
        
        // Step 1: Run local category resolver immediately as a fallback/fast response
        const fallbackImage = resolveProductImage(name, url);
        previewImg.src = fallbackImage;
        imageInput.value = fallbackImage;

        // If URL is empty or invalid, stop here
        if (!url || !url.startsWith("http")) return;

        // Step 2: Fire asynchronous fetch to microlink metadata scraper
        spinner.style.display = "flex";
        try {
            const scrapeUrl = `https://api.microlink.io/?url=${encodeURIComponent(url)}`;
            const response = await fetch(scrapeUrl);
            const json = await response.json();

            if (json.status === "success" && json.data.image && json.data.image.url) {
                const scrapedImg = json.data.image.url;
                
                // Filter out generic logos, SVGs or Amazon Prime logos unless it's a valid product image
                const isGenericLogo = scrapedImg.includes("logo") || scrapedImg.endsWith(".svg") || scrapedImg.includes("Prime_Logo") || scrapedImg.includes("favicon");
                
                if (!isGenericLogo) {
                    previewImg.src = scrapedImg;
                    imageInput.value = scrapedImg;
                } else {
                    console.log("Scraped image was a generic logo, keeping category fallback:", fallbackImage);
                }
            }
        } catch (err) {
            console.error("Error scraping metadata:", err);
        } finally {
            spinner.style.display = "none";
        }
    }

    // Debounce to prevent hitting the API too frequently while typing
    let debounceTimer;
    const triggerResolve = () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(resolveAndFetchImage, 800);
    };

    nameInput.addEventListener("input", triggerResolve);
    urlInput.addEventListener("input", triggerResolve);

    // If the admin manually edits the image input, update the preview immediately
    imageInput.addEventListener("input", () => {
        // Clear file input since they are manually writing a URL
        fileInput.value = "";
        previewBox.style.display = "flex";
        previewImg.src = imageInput.value || "coffee_set.png";
    });

    // Handle file upload
    fileInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const base64Img = evt.target.result;
            previewBox.style.display = "flex";
            previewImg.src = base64Img;
            imageInput.value = base64Img; // Set as input value to be saved
        };
        reader.readAsDataURL(file);
    });
}

/* ==========================================
   WinBlitz - Premium Gamification & Interactive Features
   ========================================== */

// --- 1. Daily Lucky Spin Wheel ---
function openLuckySpin() {
    showScreen("lucky-spin-modal");
    
    const btn = document.getElementById("btn-spin-wheel");
    const alertBox = document.getElementById("spin-result-alert");
    
    if (alertBox) alertBox.style.display = "none";
    
    if (state.lastSpinDate === new Date().toDateString()) {
        if (btn) {
            btn.disabled = true;
            btn.style.opacity = "0.5";
            btn.style.cursor = "not-allowed";
        }
        if (alertBox) {
            alertBox.style.display = "block";
            alertBox.innerHTML = `<strong>🎡 Вече завъртяхте колелото днес!</strong><br>Елате отново утре за нов шанс.`;
        }
    } else {
        if (btn) {
            btn.disabled = false;
            btn.style.opacity = "1";
            btn.style.cursor = "pointer";
        }
    }
}

let currentWheelRotation = 0;
function spinWheel() {
    const btn = document.getElementById("btn-spin-wheel");
    const alertBox = document.getElementById("spin-result-alert");
    const wheel = document.getElementById("lucky-wheel");
    
    if (state.lastSpinDate === new Date().toDateString()) {
        alert("Вече сте въртели днес!");
        return;
    }
    
    if (btn) {
        btn.disabled = true;
        btn.style.opacity = "0.5";
        btn.style.cursor = "not-allowed";
    }
    if (alertBox) alertBox.style.display = "none";
    
    // Select random segment (0 to 5)
    const targetSegment = Math.floor(Math.random() * 6);
    
    // Calculate rotation to make targetSegment land at the top pointer (0 degrees)
    // segment i is located between i*60 and (i+1)*60 degrees.
    // to bring its center (i*60 + 30) to the top (0 degrees):
    // we must rotate by 360 - (i*60 + 30).
    // Add 5 full spins (1800 degrees) to create a premium-looking spin animation.
    const extraSpins = 5 * 360;
    const targetAngle = 360 - (targetSegment * 60 + 30);
    
    // Subtract current rotation modulo 360 to keep cumulative rotation smooth
    const baseRotation = currentWheelRotation - (currentWheelRotation % 360);
    currentWheelRotation = baseRotation + extraSpins + targetAngle;
    
    if (wheel) {
        wheel.style.transform = `rotate(${currentWheelRotation}deg)`;
    }
    
    // Simulate ticking sounds while rotating
    let tickTime = 100;
    let spinTimer = 0;
    for (let i = 0; i < 25; i++) {
        spinTimer += tickTime;
        tickTime += 15; // Slow down over time
        setTimeout(() => {
            playTickSound();
        }, spinTimer);
    }
    
    // Wait for animation to finish (5s)
    setTimeout(() => {
        // Define rewards
        const rewards = [
            { type: "cash", val: 0.20, name: "€0.20 Бонус Баланс" },
            { type: "wallpaper", val: 0, name: "Premium Тапет (HD)" },
            { type: "cash", val: 1.00, name: "€1.00 Бонус Баланс" },
            { type: "cash", val: 5.00, name: "Безплатен Пакет Тапети на стойност €5.00" }, // gives €5 cash
            { type: "spin", val: 0, name: "Допълнително безплатно завъртане! 🎡" },
            { type: "cash", val: 0.50, name: "€0.50 Бонус Баланс" }
        ];
        
        const reward = rewards[targetSegment];
        const spinDate = new Date().toDateString();
        
        // Play success chime
        playWinSound();
        
        // Process rewards using API if online
        const syncPromise = (async () => {
            try {
                const response = await apiFetch('/api/user/lucky-spin', {
                    method: 'POST',
                    body: JSON.stringify({
                        rewardType: reward.type,
                        rewardVal: reward.val,
                        rewardName: reward.name,
                        spinDate: spinDate
                    })
                });
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.user) {
                        state.balance = parseFloat(data.user.balance);
                        state.lastSpinDate = data.user.last_spin_date;
                        state.dailyQuests = typeof data.user.daily_quests === 'string' ? JSON.parse(data.user.daily_quests) : data.user.daily_quests || [];
                        state.unlockedAchievements = data.user.unlocked_achievements || [];
                    }
                    saveState();
                    await loadState(); // Sync history
                    updateUI();
                    renderProfile();
                    return true;
                }
            } catch (err) {
                console.warn("lucky-spin sync failed, falling back to offline mode:", err);
            }
            return false;
        })();
        
        syncPromise.then(synced => {
            if (synced) {
                // If it was a spin-again reward, unlock the button immediately
                if (reward.type === "spin") {
                    if (btn) {
                        btn.disabled = false;
                        btn.style.opacity = "1";
                        btn.style.cursor = "pointer";
                    }
                }
            } else {
                // Fallback for offline mode
                if (reward.type === "cash") {
                    state.balance += reward.val;
                    state.walletHistory.unshift({
                        desc: `Ежедневен бонус колело: ${reward.name}`,
                        amount: reward.val,
                        type: "deposit",
                        date: getFormattedDate()
                    });
                    state.lastSpinDate = spinDate;
                } else if (reward.type === "wallpaper") {
                    state.walletHistory.unshift({
                        desc: `Ежедневен бонус колело: Premium Тапет (HD) [Изтегли]`,
                        amount: 0,
                        type: "deposit",
                        date: getFormattedDate()
                    });
                    state.lastSpinDate = spinDate;
                } else if (reward.type === "spin") {
                    if (btn) {
                        btn.disabled = false;
                        btn.style.opacity = "1";
                        btn.style.cursor = "pointer";
                    }
                }
                
                saveState();
                updateUI();
                updateQuestProgress("spin", 1);
            }
            
            if (alertBox) {
                alertBox.style.display = "block";
                if (reward.type === "spin") {
                    alertBox.innerHTML = `<strong>🎉 Късмет!</strong><br>Спечелихте: <strong>${reward.name}</strong><br>Въртете колелото отново веднага!`;
                } else if (reward.type === "wallpaper") {
                    alertBox.innerHTML = `<strong>🎉 Поздравления!</strong><br>Спечелихте: <strong>${reward.name}</strong><br>Можете да свалите Вашия арт тапет от историята в портфейла си.`;
                } else {
                    alertBox.innerHTML = `<strong>🎉 Страхотно!</strong><br>Спечелихте: <strong>${reward.name}</strong><br>Бонусът е добавен към баланса Ви!`;
                }
            }
        });
    }, 5000);
}

// --- 2. Practice Mode Toggle ---
function togglePracticeMode(checkbox) {
    state.practiceModeActive = checkbox.checked;
    saveState();
    renderLobbies();
    updateUI();
}

// --- 3. Friend Duels settings & actions ---
function openFriendDuelSettings() {
    document.getElementById("friend-duel-form").reset();
    document.getElementById("duel-invite-box").style.display = "none";
    showScreen("friend-duel-modal");
}

async function createFriendDuel(event) {
    event.preventDefault();
    const gameType = document.getElementById("duel-game-type").value;
    const entryFee = parseFloat(document.getElementById("duel-entry-fee").value);
    
    if (isNaN(entryFee) || entryFee < 0.50) {
        alert("Моля, въведете залог от минимум €0.50!");
        return;
    }
    
    if (!state.practiceModeActive) {
        if (!state.user || !state.user.verified) {
            alert("Моля, първо регистрирайте и верифицирайте профила си с SMS от таб 'Профил'!");
            navSwitch("profile");
            return;
        }
        if (state.balance < entryFee) {
            alert("Нямате достатъчно баланс за този залог!");
            return;
        }
    }
    
    try {
        const response = await apiFetch('/api/lobbies/create-duel', {
            method: 'POST',
            body: JSON.stringify({ gameType, entryFee, isPractice: state.practiceModeActive })
        });
        
        if (response.ok) {
            const data = await response.json();
            const mappedLobby = mapLobbyToClient(data.lobby);
            
            state.currentLobbyId = mappedLobby.id;
            state.lobbies.push(mappedLobby);
            
            if (data.user) {
                state.balance = parseFloat(data.user.balance);
            }
            
            saveState();
            await loadState(); // Sync list and history fully
            
            // Generate simulated link
            const inviteLinkInput = document.getElementById("duel-invite-link");
            if (inviteLinkInput) {
                inviteLinkInput.value = `https://winblitz.bg/join-duel?room=WB-${mappedLobby.id}-${Math.floor(1000 + Math.random() * 9000)}`;
            }
            
            const inviteBox = document.getElementById("duel-invite-box");
            if (inviteBox) inviteBox.style.display = "block";
        } else {
            const err = await response.json();
            alert("Грешка при създаване на дуел: " + err.error);
        }
    } catch (err) {
        console.error("createFriendDuel error:", err);
        // Fallback for offline mode
        const prizeValue = entryFee * 1.8;
        if (!state.practiceModeActive) {
            state.balance -= entryFee;
            state.walletHistory.unshift({
                desc: `Създаване на стая за Частен дуел (${getGameTypeNameBg(gameType)})`,
                amount: entryFee,
                type: "withdraw",
                date: getFormattedDate()
            });
        } else {
            state.walletHistory.unshift({
                desc: `Създаване на стая за Частен дуел (Тренировка)`,
                amount: 0,
                type: "withdraw",
                date: getFormattedDate()
            });
        }
        const newDuelLobby = {
            id: state.lobbies.length + 1,
            prizeName: `Частен дуел (${getGameTypeNameBg(gameType)})`,
            prizeValue: prizeValue,
            ticketPrice: entryFee,
            maxPlayers: 2,
            productType: "duel",
            gameType: gameType,
            image: "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=600&auto=format&fit=crop",
            productUrl: null,
            deliveryStatus: "pending",
            status: "waiting",
            players: [
                { name: "Вие (Участник)", isMe: true, time: null, errors: 0, finished: false }
            ],
            winner: null,
            isFriendDuel: true,
            isPractice: state.practiceModeActive
        };
        state.currentLobbyId = newDuelLobby.id;
        state.lobbies.push(newDuelLobby);
        saveState();
        updateUI();
        renderLobbies();
        
        const inviteLinkInput = document.getElementById("duel-invite-link");
        if (inviteLinkInput) {
            inviteLinkInput.value = `https://winblitz.bg/join-duel?room=WB-${newDuelLobby.id}-${Math.floor(1000 + Math.random() * 9000)}`;
        }
        const inviteBox = document.getElementById("duel-invite-box");
        if (inviteBox) inviteBox.style.display = "block";
    }
}

function copyDuelInviteLink() {
    const inviteInput = document.getElementById("duel-invite-link");
    if (inviteInput) {
        inviteInput.select();
        inviteInput.setSelectionRange(0, 99999);
        try {
            navigator.clipboard.writeText(inviteInput.value);
            alert("Връзката за покана беше копирана в клипборда!");
        } catch (err) {
            alert("Копирано: " + inviteInput.value);
        }
    }
}

async function simulateOpponentJoin() {
    const lobby = state.lobbies.find(l => l.id === state.currentLobbyId);
    if (!lobby) return;
    
    if (lobby.players.length >= 2) {
        alert("Стаята вече е пълна!");
        return;
    }
    
    const botNames = ["Алекс С.", "Калоян И.", "Николай Т.", "Виктор Г."];
    const botName = botNames[Math.floor(Math.random() * botNames.length)];
    
    try {
        const response = await apiFetch('/api/lobbies/bot-join', {
            method: 'POST',
            body: JSON.stringify({ lobbyId: lobby.id, botName })
        });
        
        if (response.ok) {
            const data = await response.json();
            const updatedLobby = mapLobbyToClient(data.lobby);
            
            const index = state.lobbies.findIndex(l => l.id === lobby.id);
            if (index !== -1) {
                state.lobbies[index] = updatedLobby;
            }
            
            saveState();
            renderLobbies();
            
            // Close popup screen
            document.getElementById("friend-duel-modal").classList.remove("active");
            
            // Go to waiting room
            openWaitingLobby(updatedLobby);
        }
    } catch (err) {
        console.error("simulateOpponentJoin error:", err);
        // Fallback for offline mode
        lobby.players.push({
            name: botName,
            isMe: false,
            time: null,
            errors: 0,
            finished: false
        });
        saveState();
        updateUI();
        renderLobbies();
        document.getElementById("friend-duel-modal").classList.remove("active");
        openWaitingLobby(lobby);
    }
}

// --- 4. Live Opponent Simulation during Gameplay ---
let opponentProgressInterval = null;
function initLiveOpponentsSimulation(lobby) {
    const list = document.getElementById("live-opponents-list");
    const panel = document.getElementById("opponents-live-progress");
    
    const bots = lobby.players.filter(p => !p.isMe);
    if (bots.length === 0 || !list || !panel) {
        if (panel) panel.style.display = "none";
        return;
    }
    
    panel.style.display = "block";
    list.innerHTML = "";
    
    // Initialize state for live opponent progress
    state.game.liveOpponents = bots.map(b => ({
        name: b.name,
        step: 0,
        totalSteps: state.game.totalSteps,
        finished: false,
        time: null
    }));
    
    renderLiveOpponents();
    startLiveOpponentsSimulation();
}

function renderLiveOpponents() {
    const list = document.getElementById("live-opponents-list");
    if (!list || !state.game.liveOpponents) return;
    
    list.innerHTML = "";
    state.game.liveOpponents.forEach(bot => {
        const row = document.createElement("div");
        row.className = "live-opponent-row";
        
        const isDone = bot.finished;
        const dotClass = isDone ? "live-opponent-dot completed" : "live-opponent-dot playing";
        const statusClass = isDone ? "live-opponent-status done" : "live-opponent-status";
        
        let statusText = `${bot.step}/${bot.totalSteps}`;
        if (isDone) statusText = `Готов! (${bot.time}с)`;
        
        row.innerHTML = `
            <div class="live-opponent-info">
                <span class="${dotClass}"></span>
                <span class="live-opponent-name">${bot.name}</span>
            </div>
            <span class="${statusClass}">${statusText}</span>
        `;
        list.appendChild(row);
    });
}

function startLiveOpponentsSimulation() {
    if (opponentProgressInterval) clearInterval(opponentProgressInterval);
    
    opponentProgressInterval = setInterval(() => {
        if (!state.game.liveOpponents) return;
        
        // Select a random unfinished bot
        const unfinished = state.game.liveOpponents.filter(b => !b.finished);
        if (unfinished.length === 0) {
            clearInterval(opponentProgressInterval);
            return;
        }
        
        const target = unfinished[Math.floor(Math.random() * unfinished.length)];
        target.step++;
        
        // Simulating occasional ticking sounds for bots to increase atmosphere
        if (Math.random() < 0.3) {
            playTickSound();
        }
        
        if (target.step >= target.totalSteps) {
            target.finished = true;
            const elapsed = (Date.now() - state.game.startTime) / 1000;
            // Bot time is slightly offset from current elapsed time
            target.time = (elapsed + Math.random() * 1.5).toFixed(2);
        }
        
        renderLiveOpponents();
    }, 1400 + Math.random() * 800); // randomize updates slightly
}

function stopLiveOpponentsSimulation() {
    if (opponentProgressInterval) {
        clearInterval(opponentProgressInterval);
        opponentProgressInterval = null;
    }
    const panel = document.getElementById("opponents-live-progress");
    if (panel) panel.style.display = "none";
}

// --- 5. Juicy Feedback Sound Synthesis & Effects ---
let audioCtx = null;
function getAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    // Resume if suspended (browser security)
    if (audioCtx && audioCtx.state === "suspended") {
        audioCtx.resume();
    }
    return audioCtx;
}

function playCorrectSound() {
    try {
        const ctx = getAudioContext();
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.type = "sine";
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
        
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
    } catch (e) {
        console.log("Audio play blocked or failed", e);
    }
}

function playErrorSound() {
    try {
        const ctx = getAudioContext();
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(140, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(70, ctx.currentTime + 0.25);
        
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
    } catch (e) {
        console.log("Audio play blocked or failed", e);
    }
}

function playWinSound() {
    try {
        const ctx = getAudioContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        const notes = [261.63, 329.63, 392.00, 523.25, 659.25]; // C4, E4, G4, C5, E5 arpeggio
        notes.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.type = "triangle";
            osc.frequency.setValueAtTime(freq, now + idx * 0.12);
            
            gain.gain.setValueAtTime(0.15, now + idx * 0.12);
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.35);
            
            osc.start(now + idx * 0.12);
            osc.stop(now + idx * 0.12 + 0.35);
        });
    } catch (e) {
        console.log("Audio play blocked or failed", e);
    }
}

function playTickSound() {
    try {
        const ctx = getAudioContext();
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.type = "sine";
        osc.frequency.setValueAtTime(1100, ctx.currentTime);
        
        gain.gain.setValueAtTime(0.03, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);
        
        osc.start();
        osc.stop(ctx.currentTime + 0.03);
    } catch (e) {
        console.log("Audio play blocked or failed", e);
    }
}

function triggerErrorEffects() {
    const phoneScreen = document.querySelector(".phone-screen");
    if (phoneScreen) {
        phoneScreen.classList.add("screen-shake");
        // Flash red
        const originalBoxShadow = phoneScreen.style.boxShadow;
        phoneScreen.style.boxShadow = "inset 0 0 40px rgba(239, 68, 68, 0.9)";
        
        setTimeout(() => {
            phoneScreen.classList.remove("screen-shake");
            phoneScreen.style.boxShadow = originalBoxShadow;
        }, 400);
    }
    if (navigator.vibrate) {
        navigator.vibrate(200);
    }
}

function triggerCorrectEffects() {
    playCorrectSound();
    const phoneScreen = document.querySelector(".phone-screen");
    if (phoneScreen) {
        const originalBoxShadow = phoneScreen.style.boxShadow;
        phoneScreen.style.boxShadow = "inset 0 0 35px rgba(16, 185, 129, 0.45)";
        setTimeout(() => {
            phoneScreen.style.boxShadow = originalBoxShadow;
        }, 200);
    }
}

// --- 6. Canvas Confetti Effect ---
function startConfetti() {
    const canvas = document.getElementById("confetti-canvas");
    if (!canvas) return;
    
    canvas.style.display = "block";
    const ctx = canvas.getContext("2d");
    
    const phoneScreen = document.querySelector(".phone-screen");
    canvas.width = phoneScreen ? phoneScreen.clientWidth : 360;
    canvas.height = phoneScreen ? phoneScreen.clientHeight : 740;
    
    const colors = ["#8b5cf6", "#d946ef", "#10b981", "#fbbf24", "#3b82f6", "#ef4444"];
    const particles = [];
    
    for (let i = 0; i < 90; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * -canvas.height - 10,
            size: Math.random() * 6 + 4,
            color: colors[Math.floor(Math.random() * colors.length)],
            speedY: Math.random() * 3 + 2,
            speedX: Math.random() * 2 - 1,
            rotation: Math.random() * 360,
            rotationSpeed: Math.random() * 4 - 2,
            wobble: Math.random() * 10,
            wobbleSpeed: Math.random() * 0.05 + 0.02
        });
    }
    
    let animationFrameId;
    const startTime = Date.now();
    
    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        let active = false;
        particles.forEach(p => {
            p.y += p.speedY;
            p.x += p.speedX + Math.sin(p.wobble) * 0.5;
            p.wobble += p.wobbleSpeed;
            p.rotation += p.rotationSpeed;
            
            if (p.y < canvas.height) {
                active = true;
            } else if (Date.now() - startTime < 4000) {
                // Reset to top if still within active time window
                p.y = -20;
                p.x = Math.random() * canvas.width;
            }
            
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate((p.rotation * Math.PI) / 180);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
            ctx.restore();
        });
        
        if (active && Date.now() - startTime < 5500) {
            animationFrameId = requestAnimationFrame(draw);
        } else {
            canvas.style.display = "none";
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }
    
    draw();
}

// --- 7. Social Share Victory Card ---
function openShareVictory() {
    const lobby = state.lastViewedLobbyForShare;
    if (!lobby) return;
    
    const me = lobby.players.find(p => p.isMe);
    const myTime = me ? me.time : 0.00;
    
    // Populate Story
    const shareName = document.getElementById("share-prize-name");
    const shareTime = document.getElementById("share-prize-time");
    const shareGame = document.getElementById("share-game-name");
    const shareImg = document.getElementById("share-prize-img");
    
    if (shareName) shareName.textContent = lobby.prizeName;
    if (shareTime) shareTime.textContent = `Време: ${myTime.toFixed(2)} сек`;
    if (shareGame) shareGame.textContent = `Игра: ${getGameTypeNameBg(lobby.gameType)}`;
    if (shareImg) shareImg.src = lobby.image || "coffee_set.png";
    
    showScreen("share-victory-modal");
}

function copySharePostText() {
    const lobby = state.lastViewedLobbyForShare;
    if (!lobby) return;
    
    const me = lobby.players.find(p => p.isMe);
    const myTime = me ? me.time : 0.00;
    
    const text = `🏆 Йес! Спечелих "${lobby.prizeName}" в WinBlitz с рекордно време от ${myTime.toFixed(2)} сек на играта "${getGameTypeNameBg(lobby.gameType)}"! ⚡ Тествай интелекта и рефлексите си и спечели и ти! #winblitz #tombola #game #bulgaria`;
    
    try {
        navigator.clipboard.writeText(text);
        alert("Текстът за споделяне е копиран в клипборда!");
    } catch (e) {
        alert("Текстът е: " + text);
    }
}

function downloadStoryImageSimulated() {
    const lobby = state.lastViewedLobbyForShare;
    if (!lobby) return;
    
    const me = lobby.players.find(p => p.isMe);
    const myTime = me ? me.time : 0.00;
    
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext("2d");
    
    // 1. Draw premium gradient background
    const grad = ctx.createLinearGradient(0, 0, 0, 1920);
    grad.addColorStop(0, "#090714");
    grad.addColorStop(0.5, "#170d30");
    grad.addColorStop(1, "#290a2c");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1080, 1920);
    
    // 2. Draw glow circles
    ctx.fillStyle = "rgba(217, 70, 239, 0.12)";
    ctx.beginPath();
    ctx.arc(900, 200, 500, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = "rgba(139, 92, 246, 0.1)";
    ctx.beginPath();
    ctx.arc(100, 1700, 600, 0, Math.PI * 2);
    ctx.fill();
    
    // 3. Draw border
    ctx.strokeStyle = "#d946ef";
    ctx.lineWidth = 15;
    ctx.strokeRect(40, 40, 1000, 1840);
    
    // 4. Header: WinBlitz
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 80px sans-serif";
    ctx.fillText("⚡ WinBlitz", 540, 240);
    
    // 5. Championship Ribbon/Badge
    const rGrad = ctx.createLinearGradient(340, 0, 740, 0);
    rGrad.addColorStop(0, "#fbbf24");
    rGrad.addColorStop(1, "#d97706");
    ctx.fillStyle = rGrad;
    ctx.beginPath();
    ctx.roundRect(320, 310, 440, 90, 45);
    ctx.fill();
    
    ctx.fillStyle = "#111111";
    ctx.font = "900 42px sans-serif";
    ctx.fillText("🏆 ШАМПИОН", 540, 372);
    
    // 6. Draw central photo container circle
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(540, 780, 250, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
    ctx.beginPath();
    ctx.arc(540, 780, 246, 0, Math.PI * 2);
    ctx.fill();
    
    // 7. Prize Name
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 64px sans-serif";
    ctx.fillText(lobby.prizeName, 540, 1180);
    
    // 8. Stats card block
    ctx.fillStyle = "rgba(16, 185, 129, 0.08)";
    ctx.strokeStyle = "rgba(16, 185, 129, 0.25)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(190, 1280, 700, 160, 20);
    ctx.fill();
    ctx.stroke();
    
    ctx.fillStyle = "#10b981";
    ctx.font = "bold 56px sans-serif";
    ctx.fillText(`ВРЕМЕ: ${myTime.toFixed(2)} сек`, 540, 1380);
    
    // 9. Game detail
    ctx.fillStyle = "#a1a1aa";
    ctx.font = "500 38px sans-serif";
    ctx.fillText(`Игра: ${getGameTypeNameBg(lobby.gameType)}`, 540, 1550);
    
    // 10. Footer info
    ctx.fillStyle = "#71717a";
    ctx.font = "bold 32px sans-serif";
    ctx.fillText("СВАЛИ WINBLITZ & СПЕЧЕЛИ НАГРАДИ!", 540, 1750);
    
    // Helper to render image in circle
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = function() {
        ctx.save();
        ctx.beginPath();
        ctx.arc(540, 780, 240, 0, Math.PI * 2);
        ctx.clip();
        // Draw image centered and cropped
        ctx.drawImage(img, 540 - 240, 780 - 240, 480, 480);
        ctx.restore();
        triggerDownload();
    };
    img.onerror = function() {
        // If image fails to load (CORS block or missing), draw nice default icon
        ctx.fillStyle = "#d946ef";
        ctx.font = "140px sans-serif";
        ctx.fillText("🎁", 540, 830);
        triggerDownload();
    };
    
    // Prepend protocol if it starts with //
    let imgSrc = lobby.image || "coffee_set.png";
    if (imgSrc.startsWith("//")) {
        imgSrc = "https:" + imgSrc;
    }
    img.src = imgSrc;
    
    function triggerDownload() {
        try {
            const link = document.createElement("a");
            link.download = `winblitz-victory-${lobby.id}.png`;
            link.href = canvas.toDataURL("image/png");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            alert("Премиум Story картичката беше генерирана! (Свалянето не бе завършено автоматично поради CORS защита на изображението на наградата).");
        }
    }
}

// --- GAMIFICATION & ENGAGEMENT HELPERS ---

const ACHIEVEMENTS = [
    { id: "speed", name: "Светкавица", desc: "Математическа игра под 12 сек.", icon: "⚡" },
    { id: "flawless", name: "Безгрешен", desc: "Спечелена игра с 0 грешки", icon: "🎯" },
    { id: "collector", name: "Колекционер", desc: "Притежавайте поне 3 аватара", icon: "🎒" },
    { id: "millionaire", name: "Милионер", desc: "Баланс над €50.00", icon: "💰" }
];

const BOT_LEAGUE_PLAYERS = [
    { name: "Мартин С.", xp: 3200, avatar: "👑" },
    { name: "Стефан Р.", xp: 1200, avatar: "🥇" },
    { name: "Теодора А.", xp: 850, avatar: "🥈" },
    { name: "Мария Г.", xp: 200, avatar: "🥉" }
];

const CLANS_DATA = {
    1: { name: "БГ Нинджи", icon: "🛡️", xp: 12500, members: ["Никола В.", "Борис П.", "Явор К.", "Даниел С."] },
    2: { name: "Блиц Шампиони", icon: "⚡", xp: 9800, members: ["Мартин С.", "Иван П.", "Христо В.", "Теодора А."] },
    3: { name: "Томбола Мастърс", icon: "🏆", xp: 15400, members: ["Елена Г.", "Стефан Р.", "Мария Г.", "Лилия Б."] }
};

const SHOP_AVATARS = [
    { avatar: "👑", price: 3.00, name: "Корона" },
    { avatar: "🦄", price: 2.00, name: "Еднорог" },
    { avatar: "🕵️", price: 1.50, name: "Детектив" },
    { avatar: "🤖", price: 1.50, name: "Робот" },
    { avatar: "🦁", price: 2.00, name: "Лъв" },
    { avatar: "👽", price: 2.50, name: "Извънземно" }
];

const SHOP_THEMES = [
    { id: "default", name: "Стандартна Неон", desc: "Оригинален лилав неон", price: 0 },
    { id: "cyberpunk", name: "Cyberpunk", desc: "Електриково синьо и розово", price: 5.00 },
    { id: "emerald", name: "Emerald", desc: "Дълбоко изумрудено зелено", price: 4.00 },
    { id: "gold", name: "Gold Royale", desc: "Кралско златно и черно", price: 7.00 }
];

function getLeagueDetails(xp) {
    if (xp < 300) {
        return {
            name: "Бронз",
            fullName: "Бронзова Лига",
            badge: "🥉",
            title: "Новак",
            minXp: 0,
            maxXp: 300,
            desc: "Изиграйте игри, за да преминете в Сребърна лига."
        };
    } else if (xp < 1000) {
        return {
            name: "Сребро",
            fullName: "Сребърна Лига",
            badge: "🥈",
            title: "Сребърен ветеран",
            minXp: 300,
            maxXp: 1000,
            desc: "Продължавайте напред към Златната лига."
        };
    } else if (xp < 2500) {
        return {
            name: "Злато",
            fullName: "Златна Лига",
            badge: "🥇",
            title: "Златен майстор",
            minXp: 1000,
            maxXp: 2500,
            desc: "Близо сте до върха на Томбола Мастърс."
        };
    } else if (xp < 5000) {
        return {
            name: "Шампион",
            fullName: "Шампионска Лига",
            badge: "🏆",
            title: "Гранд Шампион",
            minXp: 2500,
            maxXp: 5000,
            desc: "Само най-добрите достигат Легендарна лига!"
        };
    } else {
        return {
            name: "Легенда",
            fullName: "Легендарна Лига",
            badge: "👑",
            title: "Жива Легенда",
            minXp: 5000,
            maxXp: 5000,
            desc: "Вие сте на самия връх!"
        };
    }
}

function generateDailyQuests() {
    return [
        { id: "spin", desc: "Завъртете Колелото на Късмета", target: 1, current: 0, reward: 0.50, claimed: false },
        { id: "practice", desc: "Изиграйте 2 Тренировки", target: 2, current: 0, reward: 1.00, claimed: false },
        { id: "win", desc: "Спечелете 1 Реална Игра", target: 1, current: 0, reward: 1.50, claimed: false }
    ];
}

function updateQuestProgress(action, value) {
    if (!state.dailyQuests) {
        state.dailyQuests = generateDailyQuests();
    }
    const quest = state.dailyQuests.find(q => q.id === action);
    if (quest && !quest.claimed) {
        quest.current = Math.min(quest.target, quest.current + value);
        saveState();
        renderProfile();
    }
}

async function claimQuestReward(questId) {
    if (!state.dailyQuests) return;
    const quest = state.dailyQuests.find(q => q.id === questId);
    if (!quest) return;

    try {
        const response = await apiFetch('/api/user/claim-quest', {
            method: 'POST',
            body: JSON.stringify({ questId })
        });
        
        if (response.ok) {
            const data = await response.json();
            
            // Sync user state returned from backend
            if (data.user) {
                state.balance = parseFloat(data.user.balance);
                state.unlockedAchievements = data.user.unlocked_achievements || [];
                state.dailyQuests = typeof data.user.daily_quests === 'string' ? JSON.parse(data.user.daily_quests) : data.user.daily_quests || [];
            }
            
            saveState();
            await loadState(); // Sync history
            renderProfile();
            updateUI();
            
            alert(`🎉 Взехте награда от €${quest.reward.toFixed(2)}!`);
        } else {
            const err = await response.json();
            alert("Грешка при вземане на награда: " + err.error);
        }
    } catch (err) {
        console.error("claimQuestReward error:", err);
        // Fallback for offline mode
        if (quest.current >= quest.target && !quest.claimed) {
            quest.claimed = true;
            state.balance = (state.balance || 0) + quest.reward;
            
            if (!state.walletHistory) state.walletHistory = [];
            state.walletHistory.unshift({
                desc: `Награда от мисия: ${quest.desc}`,
                amount: quest.reward,
                type: "deposit",
                date: getFormattedDate()
            });
            
            if (state.balance >= 50.00) {
                unlockAchievement("millionaire");
            }
            
            saveState();
            updateUI();
            renderProfile();
            alert(`🎉 Взехте награда от €${quest.reward.toFixed(2)}! (Офлайн)`);
        }
    }
}

async function simulateNewDay() {
    try {
        const response = await apiFetch('/api/user/simulate-new-day', {
            method: 'POST'
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.user) {
                state.dailyQuests = typeof data.user.daily_quests === 'string' ? JSON.parse(data.user.daily_quests) : data.user.daily_quests || [];
                state.lastSpinDate = data.user.last_spin_date || null;
            }
            
            saveState();
            renderProfile();
            alert("⏳ Дневните мисии и колелото на късмета бяха занулени за новия ден!");
        }
    } catch (err) {
        console.error("simulateNewDay error:", err);
        // Fallback for offline mode
        state.dailyQuests = generateDailyQuests();
        state.lastSpinDate = null;
        saveState();
        renderProfile();
        alert("⏳ Дневните мисии и колелото на късмета бяха занулени за новия ден! (Офлайн)");
    }
}

function unlockAchievement(id) {
    if (!state.unlockedAchievements) {
        state.unlockedAchievements = [];
    }
    if (!state.unlockedAchievements.includes(id)) {
        state.unlockedAchievements.push(id);
        saveState();
        renderProfile();
        
        const ach = ACHIEVEMENTS.find(a => a.id === id);
        if (ach) {
            alert(`🏆 ПОСТИЖЕНИЕ ОТКЛЮЧЕНО!\n\n"${ach.name}" - ${ach.desc} ${ach.icon}`);
        }
    }
}

function awardXP(amount) {
    if (state.xp === undefined) state.xp = 0;
    
    const oldLeague = getLeagueDetails(state.xp);
    state.xp += amount;
    const newLeague = getLeagueDetails(state.xp);
    
    if (newLeague.name !== oldLeague.name && newLeague.minXp > oldLeague.minXp) {
        setTimeout(() => {
            alert(`🎉 ЧЕСТИТО! Вие се изкачихте в по-горна лига!\n\nДобре дошли в ${newLeague.fullName} ${newLeague.badge}!`);
        }, 500);
    }
    
    saveState();
    renderProfile();
    
    if (document.getElementById("league-clan-screen").classList.contains("active")) {
        renderLeagueClan();
    }
}

function renderLeagueClan() {
    const league = getLeagueDetails(state.xp);
    const badgeBig = document.getElementById("league-badge-big");
    const nameBig = document.getElementById("league-name-big");
    const descBig = document.getElementById("league-desc-big");
    
    if (badgeBig) badgeBig.textContent = league.badge;
    if (nameBig) nameBig.textContent = league.fullName;
    if (descBig) descBig.textContent = league.desc;
    
    const leaderboardList = document.getElementById("league-leaderboard-list");
    if (leaderboardList) {
        leaderboardList.innerHTML = "";
        
        const players = [
            { name: "Вие (Участник)", xp: state.xp, avatar: state.activeAvatar || "👤", isMe: true },
            ...BOT_LEAGUE_PLAYERS
        ];
        
        players.sort((a, b) => b.xp - a.xp);
        
        players.forEach((p, idx) => {
            const row = document.createElement("div");
            row.style = `display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,0.03); ${p.isMe ? 'background: rgba(139, 92, 246, 0.08);' : ''}`;
            
            const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}.`;
            
            row.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 10px; font-weight: 700; width: 18px; text-align: center; color: var(--text-muted);">${medal}</span>
                    <span style="font-size: 16px;">${p.avatar}</span>
                    <span style="font-size: 11px; font-weight: ${p.isMe ? 'bold' : 'normal'}; color: ${p.isMe ? '#fff' : '#ddd'};">${p.name}</span>
                </div>
                <span style="font-size: 10px; font-weight: 600; color: var(--accent); font-family: monospace;">${p.xp} XP</span>
            `;
            leaderboardList.appendChild(row);
        });
    }
    
    const unjoinedView = document.getElementById("clan-unjoined-view");
    const joinedView = document.getElementById("clan-joined-view");
    
    if (state.clanId) {
        if (unjoinedView) unjoinedView.style.display = "none";
        if (joinedView) joinedView.style.display = "block";
        
        const clan = CLANS_DATA[state.clanId];
        if (clan) {
            document.getElementById("my-clan-icon").textContent = clan.icon;
            document.getElementById("my-clan-name").textContent = clan.name;
            
            const totalMembers = clan.members.length + 1;
            const clanTotalXp = clan.xp + state.xp;
            document.getElementById("my-clan-members-count").textContent = `${totalMembers}/5 членове • ${clanTotalXp} Общо XP`;
            
            const membersList = document.getElementById("clan-members-list");
            if (membersList) {
                membersList.innerHTML = "";
                
                const members = [
                    { name: "Вие (Участник)", xp: state.xp, avatar: state.activeAvatar || "👤", role: "Член", isMe: true },
                    ...clan.members.map((name, i) => ({
                        name: name,
                        xp: Math.round(clan.xp / 4 - (i * 200) + Math.sin(i) * 50),
                        avatar: ["🛡️", "🦊", "🐯", "🐼"][i % 4],
                        role: i === 0 ? "Лидер" : "Член",
                        isMe: false
                    }))
                ];
                
                members.sort((a, b) => b.xp - a.xp);
                
                members.forEach((m, idx) => {
                    const row = document.createElement("div");
                    row.style = `display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; border-bottom: 1px solid rgba(255,255,255,0.03); ${m.isMe ? 'background: rgba(139, 92, 246, 0.08);' : ''}`;
                    row.innerHTML = `
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 14px;">${m.avatar}</span>
                            <div style="text-align: left;">
                                <div style="font-size: 11px; font-weight: ${m.isMe ? 'bold' : 'normal'}; color: #fff;">${m.name}</div>
                                <div style="font-size: 8px; color: var(--text-muted);">${m.role}</div>
                            </div>
                        </div>
                        <span style="font-size: 10px; font-weight: bold; color: var(--primary); font-family: monospace;">${m.xp} XP</span>
                    `;
                    membersList.appendChild(row);
                });
            }
            
            const clansLeaderboardList = document.getElementById("clans-leaderboard-list");
            if (clansLeaderboardList) {
                clansLeaderboardList.innerHTML = "";
                
                const rankings = Object.keys(CLANS_DATA).map(id => {
                    const c = CLANS_DATA[id];
                    const isMyClan = parseInt(id) === state.clanId;
                    return {
                        id: parseInt(id),
                        name: c.name,
                        icon: c.icon,
                        xp: isMyClan ? c.xp + state.xp : c.xp,
                        isMyClan: isMyClan
                    };
                });
                
                rankings.sort((a, b) => b.xp - a.xp);
                
                rankings.forEach((c, idx) => {
                    const row = document.createElement("div");
                    row.style = `display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,0.03); ${c.isMyClan ? 'background: rgba(139, 92, 246, 0.08);' : ''}`;
                    
                    const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}.`;
                    
                    row.innerHTML = `
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 10px; font-weight: 700; width: 18px; text-align: center; color: var(--text-muted);">${medal}</span>
                            <span style="font-size: 16px;">${c.icon}</span>
                            <span style="font-size: 11px; font-weight: ${c.isMyClan ? 'bold' : 'normal'}; color: #fff;">${c.name} ${c.isMyClan ? '(Моят Клан)' : ''}</span>
                        </div>
                        <span style="font-size: 10px; font-weight: 600; color: var(--success); font-family: monospace;">${c.xp} XP</span>
                    `;
                    clansLeaderboardList.appendChild(row);
                });
            }
        }
    } else {
        if (unjoinedView) unjoinedView.style.display = "block";
        if (joinedView) joinedView.style.display = "none";
    }
}

function switchLeagueClanTab(tab) {
    const btnLeague = document.getElementById("btn-tab-league");
    const btnClan = document.getElementById("btn-tab-clan");
    const viewLeague = document.getElementById("league-view-container");
    const viewClan = document.getElementById("clan-view-container");
    
    if (tab === "league") {
        if (btnLeague) btnLeague.className = "btn btn-sm btn-accent w-100";
        if (btnClan) btnClan.className = "btn btn-sm btn-secondary w-100";
        if (viewLeague) viewLeague.style.display = "block";
        if (viewClan) viewClan.style.display = "none";
    } else {
        if (btnLeague) btnLeague.className = "btn btn-sm btn-secondary w-100";
        if (btnClan) btnClan.className = "btn btn-sm btn-accent w-100";
        if (viewLeague) viewLeague.style.display = "none";
        if (viewClan) viewClan.style.display = "block";
    }
    renderLeagueClan();
}

async function joinClan(clanId) {
    try {
        const response = await apiFetch('/api/user/join-clan', {
            method: 'POST',
            body: JSON.stringify({ clanId })
        });
        if (response.ok) {
            const data = await response.json();
            if (data.user) {
                state.clanId = data.user.clan_id;
            }
            saveState();
            renderLeagueClan();
            const clanName = CLANS_DATA[clanId].name;
            alert(`🛡️ Вие се присъединихте към клана "${clanName}"!`);
        }
    } catch (err) {
        console.error("joinClan error:", err);
        state.clanId = clanId;
        saveState();
        renderLeagueClan();
        const clanName = CLANS_DATA[clanId].name;
        alert(`🛡️ Вие се присъединихте към клана "${clanName}"! (Офлайн)`);
    }
}

async function leaveClan() {
    if (confirm("Сигурни ли сте, че искате да напуснете клана?")) {
        try {
            const response = await apiFetch('/api/user/leave-clan', {
                method: 'POST'
            });
            if (response.ok) {
                const data = await response.json();
                if (data.user) {
                    state.clanId = data.user.clan_id;
                }
                saveState();
                renderLeagueClan();
            }
        } catch (err) {
            console.error("leaveClan error:", err);
            state.clanId = null;
            saveState();
            renderLeagueClan();
        }
    }
}

function openLootBoxScreen() {
    showScreen("loot-box-modal");
    
    const chest = document.getElementById("loot-box-chest");
    const result = document.getElementById("lootbox-result-alert");
    const btnOpen = document.getElementById("btn-open-lootbox");
    
    if (chest) {
        chest.className = "loot-box-chest";
        chest.textContent = "🎁";
        chest.style.opacity = "1";
    }
    if (result) {
        result.style.display = "none";
        result.innerHTML = "";
    }
    if (btnOpen) {
        btnOpen.disabled = false;
        btnOpen.textContent = "ОТВОРИ КУТИЯТА";
    }
}

function openLootBox() {
    const btnOpen = document.getElementById("btn-open-lootbox");
    if (btnOpen && btnOpen.disabled) return;
    
    if (btnOpen) btnOpen.disabled = true;
    
    const chest = document.getElementById("loot-box-chest");
    const result = document.getElementById("lootbox-result-alert");
    
    if (chest) {
        chest.classList.add("shake");
        
        setTimeout(async () => {
            chest.classList.remove("shake");
            chest.classList.add("open");
            
            try {
                const response = await apiFetch('/api/user/open-lootbox', {
                    method: 'POST'
                });
                
                if (response.ok) {
                    const data = await response.json();
                    
                    if (data.user) {
                        state.balance = parseFloat(data.user.balance);
                        state.unlockedAvatars = data.user.unlocked_avatars || ['👤'];
                        state.lootBoxesOwned = data.user.loot_boxes_owned || 0;
                        state.unlockedAchievements = data.user.unlocked_achievements || [];
                    }
                    
                    saveState();
                    await loadState(); // Sync history
                    updateUI();
                    renderProfile();
                    
                    if (result) {
                        result.style.display = "block";
                        result.innerHTML = data.rewardText;
                    }
                }
            } catch (err) {
                console.error("openLootBox error:", err);
                // Fallback for offline mode
                const rand = Math.random();
                let rewardText = "";
                
                if (rand < 0.60) {
                    const amounts = [0.50, 1.00, 2.00, 5.00];
                    const amount = amounts[Math.floor(Math.random() * amounts.length)];
                    state.balance = (state.balance || 0) + amount;
                    
                    if (!state.walletHistory) state.walletHistory = [];
                    state.walletHistory.unshift({
                        desc: "Награда от Мистериозна Кутия 🎁",
                        amount: amount,
                        type: "deposit",
                        date: getFormattedDate()
                    });
                    
                    rewardText = `🎉 Спечелихте допълнителен баланс от <strong>€${amount.toFixed(2)}</strong>!`;
                    
                    if (state.balance >= 50.00) {
                        unlockAchievement("millionaire");
                    }
                } else {
                    const avs = ["🦊", "🐯", "🐼", "👾", "🚀", "💎", "🐉"];
                    const possibleAvs = avs.filter(a => !state.unlockedAvatars.includes(a));
                    
                    if (possibleAvs.length > 0) {
                        const newAv = possibleAvs[Math.floor(Math.random() * possibleAvs.length)];
                        state.unlockedAvatars.push(newAv);
                        rewardText = `🎉 Отключихте нов уникален аватар: <span style="font-size: 24px; vertical-align: middle;">${newAv}</span>! Можете да го сложите от профила си.`;
                        
                        if (state.unlockedAvatars.length >= 3) {
                            unlockAchievement("collector");
                        }
                    } else {
                        const amount = 3.00;
                        state.balance = (state.balance || 0) + amount;
                        if (!state.walletHistory) state.walletHistory = [];
                        state.walletHistory.unshift({
                            desc: "Награда от Мистериозна Кутия 🎁",
                            amount: amount,
                            type: "deposit",
                            date: getFormattedDate()
                        });
                        rewardText = `🎉 Тъй като имате всички аватари, получихте <strong>€${amount.toFixed(2)}</strong> баланс!`;
                        
                        if (state.balance >= 50.00) {
                            unlockAchievement("millionaire");
                        }
                    }
                }
                
                if (state.lootBoxesOwned > 0) {
                    state.lootBoxesOwned--;
                }
                
                saveState();
                updateUI();
                renderProfile();
                
                if (result) {
                    result.style.display = "block";
                    result.innerHTML = rewardText;
                }
            } finally {
                if (btnOpen) {
                    btnOpen.textContent = "ГОТОВО";
                    btnOpen.disabled = false;
                    btnOpen.onclick = () => {
                        closePopScreen();
                        btnOpen.onclick = openLootBox;
                    };
                }
            }
        }, 1200);
    }
}

function openCosmeticsShop() {
    showScreen("cosmetics-shop-modal");
    switchShopTab("avatars");
}

function switchShopTab(tab) {
    const btnAvatars = document.getElementById("btn-shop-avatars");
    const btnThemes = document.getElementById("btn-shop-themes");
    const avatarsContainer = document.getElementById("shop-avatars-container");
    const themesContainer = document.getElementById("shop-themes-container");
    
    if (tab === "avatars") {
        if (btnAvatars) btnAvatars.className = "btn btn-sm btn-accent w-100";
        if (btnThemes) btnThemes.className = "btn btn-sm btn-secondary w-100";
        if (avatarsContainer) avatarsContainer.style.display = "block";
        if (themesContainer) themesContainer.style.display = "none";
        renderShopAvatars();
    } else {
        if (btnAvatars) btnAvatars.className = "btn btn-sm btn-secondary w-100";
        if (btnThemes) btnThemes.className = "btn btn-sm btn-accent w-100";
        if (avatarsContainer) avatarsContainer.style.display = "none";
        if (themesContainer) themesContainer.style.display = "block";
        renderShopThemes();
    }
}

function renderShopAvatars() {
    const container = document.getElementById("avatars-shop-list");
    if (!container) return;
    
    container.innerHTML = "";
    SHOP_AVATARS.forEach(item => {
        const isUnlocked = state.unlockedAvatars.includes(item.avatar);
        const isActive = state.activeAvatar === item.avatar;
        
        let actionBtn = "";
        if (isActive) {
            actionBtn = `<button class="btn btn-success btn-sm w-100" style="font-size: 9px; padding: 4px;" disabled>Активен</button>`;
        } else if (isUnlocked) {
            actionBtn = `<button class="btn btn-accent btn-sm w-100" onclick="selectAvatar('${item.avatar}')" style="font-size: 9px; padding: 4px;">Избери</button>`;
        } else {
            actionBtn = `<button class="btn btn-primary btn-sm w-100" onclick="buyAvatar('${item.avatar}', ${item.price})" style="font-size: 9px; padding: 4px;">Купи (€${item.price.toFixed(2)})</button>`;
        }
        
        const card = document.createElement("div");
        card.className = `cosmetics-card ${isActive ? 'active' : ''}`;
        card.innerHTML = `
            <span style="font-size: 32px; display: block; margin-bottom: 4px;">${item.avatar}</span>
            <span style="font-size: 10px; font-weight: bold; color: #fff; display: block; margin-bottom: 6px;">${item.name}</span>
            ${actionBtn}
        `;
        container.appendChild(card);
    });
}

function renderShopThemes() {
    const container = document.getElementById("themes-shop-list");
    if (!container) return;
    
    container.innerHTML = "";
    SHOP_THEMES.forEach(item => {
        if (!state.unlockedThemes) {
            state.unlockedThemes = ["default"];
        }
        const isUnlocked = state.unlockedThemes.includes(item.id);
        const isActive = state.activeTheme === item.id;
        
        let actionBtn = "";
        if (isActive) {
            actionBtn = `<button class="btn btn-success btn-sm" style="font-size: 9px; padding: 4px 10px;" disabled>Активна</button>`;
        } else if (isUnlocked) {
            actionBtn = `<button class="btn btn-accent btn-sm" onclick="selectTheme('${item.id}')" style="font-size: 9px; padding: 4px 10px;">Приложи</button>`;
        } else {
            actionBtn = `<button class="btn btn-primary btn-sm" onclick="buyTheme('${item.id}', ${item.price})" style="font-size: 9px; padding: 4px 10px;">Купи (€${item.price.toFixed(2)})</button>`;
        }
        
        const card = document.createElement("div");
        card.className = `cosmetics-card ${isActive ? 'active' : ''}`;
        card.style = "flex-direction: row; justify-content: space-between; min-height: auto; padding: 10px 15px; width: 100%; text-align: left; align-items: center;";
        card.innerHTML = `
            <div style="text-align: left;">
                <span style="font-size: 11px; font-weight: 700; color: #fff; display: block;">${item.name}</span>
                <span style="font-size: 8px; color: var(--text-muted); display: block; margin-top: 2px;">${item.desc}</span>
            </div>
            <div>
                ${actionBtn}
            </div>
        `;
        container.appendChild(card);
    });
}

async function selectAvatar(avatar) {
    try {
        const response = await apiFetch('/api/user/select-avatar', {
            method: 'POST',
            body: JSON.stringify({ avatar })
        });
        if (response.ok) {
            const data = await response.json();
            if (data.user) {
                state.activeAvatar = data.user.active_avatar;
            }
            saveState();
            renderProfile();
            renderShopAvatars();
            alert("Аватарът беше променен успешно!");
        }
    } catch (err) {
        console.error("selectAvatar error:", err);
        state.activeAvatar = avatar;
        saveState();
        renderProfile();
        renderShopAvatars();
        alert("Аватарът беше променен успешно! (Офлайн)");
    }
}

async function selectTheme(themeId) {
    try {
        const response = await apiFetch('/api/user/select-theme', {
            method: 'POST',
            body: JSON.stringify({ themeId })
        });
        if (response.ok) {
            const data = await response.json();
            if (data.user) {
                state.activeTheme = data.user.active_theme;
            }
            saveState();
            applyActiveTheme();
            renderShopThemes();
            alert("Темата на апликацията беше променена успешно!");
        }
    } catch (err) {
        console.error("selectTheme error:", err);
        state.activeTheme = themeId;
        saveState();
        applyActiveTheme();
        renderShopThemes();
        alert("Темата на апликацията беше променена успешно! (Офлайн)");
    }
}

async function buyAvatar(avatar, price) {
    if ((state.balance || 0) < price) {
        alert("Нямате достатъчно баланс за този аватар! Участвайте в игри или завъртете колелото, за да спечелите.");
        return;
    }
    
    if (confirm(`Искате ли да купите аватара "${avatar}" за €${price.toFixed(2)}?`)) {
        try {
            const response = await apiFetch('/api/user/buy-avatar', {
                method: 'POST',
                body: JSON.stringify({ avatar, price })
            });
            if (response.ok) {
                const data = await response.json();
                
                if (data.user) {
                    state.balance = parseFloat(data.user.balance);
                    state.unlockedAvatars = data.user.unlocked_avatars || ['👤'];
                    state.unlockedAchievements = data.user.unlocked_achievements || [];
                }
                
                saveState();
                await loadState(); // Sync history
                renderProfile();
                renderShopAvatars();
                alert(`Успешна покупка! Вече можете да изберете аватара "${avatar}".`);
            } else {
                const err = await response.json();
                alert("Грешка при покупка: " + err.error);
            }
        } catch (err) {
            console.error("buyAvatar error:", err);
            // Fallback for offline mode
            state.balance -= price;
            state.unlockedAvatars.push(avatar);
            
            if (!state.walletHistory) state.walletHistory = [];
            state.walletHistory.unshift({
                desc: `Покупка на аватар: ${avatar}`,
                amount: -price,
                type: "withdrawal",
                date: getFormattedDate()
            });
            
            if (state.unlockedAvatars.length >= 3) {
                unlockAchievement("collector");
            }
            
            saveState();
            updateUI();
            renderProfile();
            renderShopAvatars();
            alert(`Успешна покупка! Вече можете да изберете аватара "${avatar}". (Офлайн)`);
        }
    }
}

async function buyTheme(themeId, price) {
    if ((state.balance || 0) < price) {
        alert("Нямате достатъчно баланс за тази тема! Участвайте в игри или завъртете колелото, за да спечелите.");
        return;
    }
    
    const themeName = SHOP_THEMES.find(t => t.id === themeId).name;
    
    if (confirm(`Искате ли да купите темата "${themeName}" за €${price.toFixed(2)}?`)) {
        try {
            const response = await apiFetch('/api/user/buy-theme', {
                method: 'POST',
                body: JSON.stringify({ themeId, price, themeName })
            });
            
            if (response.ok) {
                const data = await response.json();
                
                if (data.user) {
                    state.balance = parseFloat(data.user.balance);
                    state.unlockedThemes = data.user.unlocked_themes || ['default'];
                }
                
                saveState();
                await loadState(); // Sync history
                renderProfile();
                renderShopThemes();
                alert(`Успешна покупка! Вече можете да приложите темата "${themeName}".`);
            } else {
                const err = await response.json();
                alert("Грешка при покупка: " + err.error);
            }
        } catch (err) {
            console.error("buyTheme error:", err);
            // Fallback for offline mode
            state.balance -= price;
            if (!state.unlockedThemes) {
                state.unlockedThemes = ["default"];
            }
            state.unlockedThemes.push(themeId);
            
            if (!state.walletHistory) state.walletHistory = [];
            state.walletHistory.unshift({
                desc: `Покупка на тема: ${themeName}`,
                amount: -price,
                type: "withdrawal",
                date: getFormattedDate()
            });
            
            saveState();
            updateUI();
            renderProfile();
            renderShopThemes();
            alert(`Успешна покупка! Вече можете да приложите темата "${themeName}". (Офлайн)`);
        }
    }
}

function applyActiveTheme() {
    const screens = document.querySelectorAll(".phone-screen");
    screens.forEach(screen => {
        screen.classList.remove("theme-cyberpunk", "theme-emerald", "theme-gold");
        if (state.activeTheme && state.activeTheme !== "default") {
            screen.classList.add("theme-" + state.activeTheme);
        }
    });
}
