import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const AppContext = createContext();

const BACKEND_URL = 'http://193.46.243.232:3080';

const DEFAULT_QUESTS = [
  { id: "spin", desc: "Завъртете Колелото на Късмета", target: 1, current: 0, reward: 0.50, claimed: false },
  { id: "practice", desc: "Изиграйте 2 Тренировки", target: 2, current: 0, reward: 1.00, claimed: false },
  { id: "win", desc: "Спечелете 1 Реална Игра", target: 1, current: 0, reward: 1.50, claimed: false }
];

const INITIAL_STATE = {
  balance: 100.00,
  role: "user",
  lobbies: [],
  currentLobbyId: null,
  practiceModeActive: false,
  lastSpinDate: null,
  practiceGamesPlayed: 0,
  xp: 0,
  league: "Бронз",
  clanId: null,
  unlockedAvatars: ["👤"],
  activeAvatar: "👤",
  activeTheme: "default",
  unlockedThemes: ["default"],
  lootBoxesOwned: 0,
  unlockedAchievements: [],
  dailyQuests: DEFAULT_QUESTS,
  walletHistory: [
    { id: 1, desc: "Начален бонус (Демо)", amount: 100.00, type: "deposit", date: "Днес" }
  ],
  completedTournaments: [],
  showTutorial: false,
  user: {
    email: null,
    phone: null,
    fullname: null,
    city: null,
    address: null,
    verified: false,
    gamesPlayed: 0,
    gamesWon: 0,
    prizesWonValue: 0,
    wonPrizesList: []
  }
};

export function AppProvider({ children }) {
  const [state, setState] = useState(INITIAL_STATE);
  const [loading, setLoading] = useState(true);
  const [adminPassword, setAdminPassword] = useState(null);

  // Helper to map PostgreSQL snake_case properties to camelCase
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
      image: lobby.image || null,
      productUrl: lobby.product_url !== undefined ? lobby.product_url : lobby.productUrl,
      status: lobby.status || 'waiting',
      players: typeof lobby.players === 'string' ? JSON.parse(lobby.players) : lobby.players || [],
      winner: lobby.winner || null,
      isFriendDuel: lobby.is_friend_duel !== undefined ? lobby.is_friend_duel : lobby.isFriendDuel,
      isPractice: lobby.is_practice !== undefined ? lobby.is_practice : lobby.isPractice,
      completedAt: lobby.completed_at !== undefined ? lobby.completed_at : lobby.completedAt,
      archiveId: lobby.archive_id !== undefined ? parseInt(lobby.archive_id) : lobby.archiveId,
      deliveryStatus: lobby.delivery_status !== undefined ? lobby.delivery_status : lobby.deliveryStatus
    };
  }

  // Load state on startup
  useEffect(() => {
    async function loadInitialState() {
      try {
        const localData = await AsyncStorage.getItem('winblitz_state');
        let loadedState = INITIAL_STATE;
        if (localData) {
          loadedState = { ...INITIAL_STATE, ...JSON.parse(localData) };
        }
        
        // Sync with Backend if online
        const lobbiesRes = await fetch(`${BACKEND_URL}/api/lobbies`);
        if (lobbiesRes.ok) {
          const lobbiesData = await lobbiesRes.json();
          loadedState.lobbies = lobbiesData.map(mapLobbyToClient);
        }

        if (loadedState.user && (loadedState.user.email || loadedState.user.phone)) {
          const authHeaders = {};
          if (loadedState.user.email) {
            authHeaders['X-User-Email'] = loadedState.user.email;
          } else {
            authHeaders['X-User-Phone'] = loadedState.user.phone;
          }
          
          const userRes = await fetch(`${BACKEND_URL}/api/user/state`, {
            headers: authHeaders
          });
          if (userRes.ok) {
            const data = await userRes.json();
            if (data.user) {
              loadedState.balance = parseFloat(data.user.balance);
              loadedState.xp = parseInt(data.user.xp);
              loadedState.clanId = data.user.clan_id;
              loadedState.activeAvatar = data.user.active_avatar;
              loadedState.activeTheme = data.user.active_theme;
              loadedState.unlockedAvatars = data.user.unlocked_avatars || ['👤'];
              loadedState.unlockedThemes = data.user.unlocked_themes || ['default'];
              loadedState.lootBoxesOwned = data.user.loot_boxes_owned || 0;
              loadedState.unlockedAchievements = data.user.unlocked_achievements || [];
              loadedState.dailyQuests = typeof data.user.daily_quests === 'string' ? JSON.parse(data.user.daily_quests) : data.user.daily_quests || DEFAULT_QUESTS;
              loadedState.walletHistory = data.walletHistory || [];
              loadedState.completedTournaments = (data.completedGames || []).map(mapLobbyToClient);
              loadedState.lastSpinDate = data.user.last_spin_date || null;
              
              // Recalculate stats
              let played = 0;
              let won = 0;
              let wonVal = 0;
              loadedState.completedTournaments.forEach(game => {
                if (!game.isPractice) {
                  played++;
                  if (game.winner === "Вие") {
                    won++;
                    wonVal += game.prizeValue;
                  }
                }
              });
 
              loadedState.user = {
                email: data.user.email,
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
        
        setState(loadedState);
      } catch (err) {
        console.warn("Backend sync failed on load, running offline mode:", err);
      } finally {
        setLoading(false);
      }
    }
    loadInitialState();
  }, []);

  // Save state to AsyncStorage
  const saveLocalState = async (updatedState) => {
    try {
      await AsyncStorage.setItem('winblitz_state', JSON.stringify(updatedState));
    } catch (e) {
      console.error("AsyncStorage save failed", e);
    }
  };

  const updateState = (updater) => {
    setState((prev) => {
      const nextState = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
      saveLocalState(nextState);
      return nextState;
    });
  };

  // Wrapper for API fetch requests
  const apiFetch = async (endpoint, options = {}) => {
    if (!options.headers) options.headers = {};
    if (state.user && state.user.email) {
      options.headers['X-User-Email'] = state.user.email;
    } else if (state.user && state.user.phone) {
      options.headers['X-User-Phone'] = state.user.phone;
    }
    if (adminPassword) {
      options.headers['X-Admin-Password'] = adminPassword;
    }
    if (options.body && !options.headers['Content-Type']) {
      options.headers['Content-Type'] = 'application/json';
    }
    return fetch(`${BACKEND_URL}${endpoint}`, options);
  };

  // Auth Operations
  const checkEmail = async (email) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/check-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      if (res.ok) {
        return await res.json();
      }
      return { success: false, error: "Грешка при проверка на имейл" };
    } catch (e) {
      return { registered: false, offline: true };
    }
  };

  const registerEmail = async (email, fullname, city, address) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/register-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, fullname, city, address })
      });
      if (res.ok) {
        const data = await res.json();
        return { success: true, code: data.code };
      } else {
        const err = await res.json();
        return { success: false, error: err.error };
      }
    } catch (e) {
      const code = Math.floor(1000 + Math.random() * 9000).toString();
      return { success: true, code, offline: true };
    }
  };

  const verifyEmailCode = async (email, code, emailSimulatedCode, tempDetails) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code })
      });
      if (res.ok) {
        const data = await res.json();
        const isRegistering = !!tempDetails.fullname;
        updateState(prev => ({
          ...prev,
          showTutorial: isRegistering,
          user: {
            ...prev.user,
            verified: true,
            email: data.user.email,
            phone: data.user.phone,
            fullname: data.user.fullname,
            city: data.user.city,
            address: data.user.address
          }
        }));
        triggerSync(data.user.email);
        return { success: true };
      } else {
        return { success: false, error: "Невалиден верификационен код." };
      }
    } catch (e) {
      if (code === emailSimulatedCode) {
        const isRegistering = !!tempDetails.fullname;
        updateState(prev => ({
          ...prev,
          showTutorial: isRegistering,
          user: {
            ...prev.user,
            verified: true,
            email,
            fullname: tempDetails.fullname || prev.user.fullname || '',
            city: tempDetails.city || prev.user.city || '',
            address: tempDetails.address || prev.user.address || ''
          }
        }));
        return { success: true, offline: true };
      }
      return { success: false, error: "Невалиден код." };
    }
  };

  const triggerSync = async (email = state.user.email) => {
    if (!email) return;
    try {
      const authHeaders = { 'X-User-Email': email };
      const userRes = await fetch(`${BACKEND_URL}/api/user/state`, {
        headers: authHeaders
      });
      if (userRes.ok) {
        const data = await userRes.json();
        updateState(prev => {
          const completedTournaments = (data.completedGames || []).map(mapLobbyToClient);
          let played = 0, won = 0, wonVal = 0;
          completedTournaments.forEach(game => {
            if (!game.isPractice) {
              played++;
              if (game.winner === "Вие") {
                won++;
                wonVal += game.prizeValue;
              }
            }
          });

          return {
            ...prev,
            balance: parseFloat(data.user.balance),
            xp: parseInt(data.user.xp),
            clanId: data.user.clan_id,
            activeAvatar: data.user.active_avatar,
            activeTheme: data.user.active_theme,
            unlockedAvatars: data.user.unlocked_avatars || ['👤'],
            unlockedThemes: data.user.unlocked_themes || ['default'],
            lootBoxesOwned: data.user.loot_boxes_owned || 0,
            unlockedAchievements: data.user.unlocked_achievements || [],
            dailyQuests: typeof data.user.daily_quests === 'string' ? JSON.parse(data.user.daily_quests) : data.user.daily_quests || DEFAULT_QUESTS,
            walletHistory: data.walletHistory || [],
            completedTournaments,
            lastSpinDate: data.user.last_spin_date || null,
            user: {
              ...prev.user,
              email: data.user.email,
              phone: data.user.phone,
              fullname: data.user.fullname,
              city: data.user.city,
              address: data.user.address,
              verified: data.user.verified,
              gamesPlayed: played,
              gamesWon: won,
              prizesWonValue: wonVal,
              wonPrizesList: data.wonPrizes || []
            }
          };
        });
      }
    } catch (e) {
      console.warn("Async sync error:", e);
    }
  };

  // Reset App state
  const resetApp = async () => {
    try {
      const response = await apiFetch('/api/user/reset-state', { method: 'POST' });
      if (response.ok) {
        updateState(INITIAL_STATE);
        triggerSync();
        return true;
      }
    } catch (e) {
      // Offline reset
      updateState(INITIAL_STATE);
      return true;
    }
    return false;
  };

  // Join Lobby
  const joinLobby = async (lobbyId, isPractice) => {
    try {
      const response = await apiFetch('/api/lobbies/join', {
        method: 'POST',
        body: JSON.stringify({ lobbyId, isPractice })
      });
      if (response.ok) {
        const data = await response.json();
        updateState(prev => ({
          ...prev,
          lobbies: prev.lobbies.map(l => l.id === lobbyId ? mapLobbyToClient(data.lobby) : l)
        }));
        triggerSync();
        return { success: true };
      } else {
        const err = await response.json();
        return { success: false, error: err.error };
      }
    } catch (e) {
      // Offline join
      const targetLobby = state.lobbies.find(l => l.id === lobbyId);
      if (!targetLobby) return { success: false, error: "Лобито не е намерено." };

      if (!isPractice && state.balance < targetLobby.ticketPrice) {
        return { success: false, error: "Недостатъчен баланс." };
      }

      updateState(prev => {
        const newBalance = isPractice ? prev.balance : prev.balance - targetLobby.ticketPrice;
        const newLootBoxes = isPractice ? prev.lootBoxesOwned : prev.lootBoxesOwned + 1;
        const players = [...targetLobby.players];
        if (!players.some(p => p.isMe)) {
          players.push({ name: "Вие (Участник)", isMe: true, time: null, errors: 0, finished: false });
        }
        
        const newHistory = isPractice ? prev.walletHistory : [
          { id: Date.now(), desc: `Вход за турнир: ${targetLobby.prizeName}`, amount: -targetLobby.ticketPrice, type: "withdrawal", date: "Днес" },
          ...prev.walletHistory
        ];

        return {
          ...prev,
          balance: newBalance,
          lootBoxesOwned: newLootBoxes,
          walletHistory: newHistory,
          lobbies: prev.lobbies.map(l => l.id === lobbyId ? { ...l, players, status: 'playing', isPractice } : l)
        };
      });

      return { success: true, offline: true };
    }
  };

  const logout = async () => {
    updateState(INITIAL_STATE);
  };

  return (
    <AppContext.Provider value={{
      state,
      loading,
      adminPassword,
      setAdminPassword,
      updateState,
      apiFetch,
      checkEmail,
      registerEmail,
      verifyEmailCode,
      resetApp,
      joinLobby,
      triggerSync,
      mapLobbyToClient,
      logout,
      BACKEND_URL
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
