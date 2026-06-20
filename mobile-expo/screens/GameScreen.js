import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Alert, Animated, Easing, ActivityIndicator } from 'react-native';
import { useApp } from '../context/AppContext';
import { Ionicons } from '@expo/vector-icons';

export default function GameScreen({ route, navigation }) {
  const { lobbyId } = route.params || {};
  const { state, apiFetch, triggerSync } = useApp();

  const lobby = (state.lobbies || []).find(l => l.id === lobbyId);
  const gameType = lobby ? lobby.gameType : 'math';
  const isPractice = lobby ? lobby.isPractice : state.practiceModeActive;

  // Game States
  const [isPlaying, setIsPlaying] = useState(true);
  const [showResults, setShowResults] = useState(false);
  const [resultsList, setResultsList] = useState([]);
  const [winnerName, setWinnerName] = useState('');
  
  // Timer & Errors
  const [elapsedTime, setElapsedTime] = useState(0);
  const [errors, setErrors] = useState(0);
  const [penaltyTime, setPenaltyTime] = useState(0);

  const startTimeRef = useRef(Date.now());
  const timerIntervalRef = useRef(null);
  const botIntervalRef = useRef(null);

  // Live Bots State
  const [liveBots, setLiveBots] = useState([]);

  // Toast / Penalty alert
  const [showToast, setShowToast] = useState(false);
  const [toastText, setToastText] = useState('');
  const toastAnim = useRef(new Animated.Value(0)).current;

  // --- SPECIFIC GAME STATE VARIABLES ---
  // Math Blitz
  const [mathQuestions, setMathQuestions] = useState([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [mathInput, setMathInput] = useState('');

  // Memory
  const [memoryCards, setMemoryCards] = useState([]);
  const [flippedCards, setFlippedCards] = useState([]);
  const [matchedIndices, setMatchedIndices] = useState([]);

  // Reflex
  const [reflexRound, setReflexRound] = useState(0);
  const [reflexState, setReflexState] = useState('wait'); // 'wait', 'go', 'idle'
  const [reflexGoTime, setReflexGoTime] = useState(0);
  const reflexTimeoutRef = useRef(null);

  // Scramble
  const [scrambleWords, setScrambleWords] = useState([]);
  const [scrambleSpelled, setScrambleSpelled] = useState('');
  const [usedLetterIndices, setUsedLetterIndices] = useState([]);
  const [currentWordLetters, setCurrentWordLetters] = useState([]);

  // Numbers
  const [numbersGrid, setNumbersGrid] = useState([]);
  const [targetNumber, setTargetNumber] = useState(1);

  // Total steps for progress indicator
  const totalSteps = 
    gameType === 'math' ? 5 : 
    gameType === 'memory' ? 6 : 
    gameType === 'reflex' ? 3 : 
    gameType === 'scramble' ? 3 : 9;

  // --- TRIGGER PENALTY EFFECT ---
  const triggerPenalty = (text) => {
    setToastText(text);
    setShowToast(true);
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.delay(1000),
      Animated.timing(toastAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setShowToast(false));
  };

  // --- INITIALIZE GAME ---
  useEffect(() => {
    startTimeRef.current = Date.now();
    
    // Start running timer
    timerIntervalRef.current = setInterval(() => {
      setElapsedTime(((Date.now() - startTimeRef.current) / 1000));
    }, 100);

    // Initialize bot progress simulation
    const bots = lobby ? lobby.players.filter(p => !p.isMe) : [];
    const initialBots = bots.map(b => ({
      name: b.name,
      step: 0,
      totalSteps: totalSteps,
      finished: false,
      time: null
    }));
    setLiveBots(initialBots);

    if (initialBots.length > 0) {
      botIntervalRef.current = setInterval(() => {
        setLiveBots(prevBots => {
          const unfinished = prevBots.filter(b => !b.finished);
          if (unfinished.length === 0) {
            clearInterval(botIntervalRef.current);
            return prevBots;
          }
          // Pick random bot to increment
          const target = unfinished[Math.floor(Math.random() * unfinished.length)];
          const newStep = target.step + 1;
          const isDone = newStep >= target.totalSteps;
          const elapsed = (Date.now() - startTimeRef.current) / 1000;
          const botTime = isDone ? parseFloat((elapsed + Math.random() * 1.5).toFixed(2)) : null;

          return prevBots.map(b => b.name === target.name ? { 
            ...b, 
            step: newStep, 
            finished: isDone,
            time: botTime 
          } : b);
        });
      }, 1500 + Math.random() * 1000);
    }

    // Set up game types
    if (gameType === 'math') {
      // Generate math questions
      const generated = [];
      for (let i = 0; i < 5; i++) {
        const type = Math.floor(Math.random() * 3); // 0: +, 1: -, 2: *
        let num1, num2, expr, ans;
        if (type === 0) {
          num1 = Math.floor(Math.random() * 20) + 5;
          num2 = Math.floor(Math.random() * 20) + 5;
          expr = `${num1} + ${num2} = ?`;
          ans = num1 + num2;
        } else if (type === 1) {
          num1 = Math.floor(Math.random() * 25) + 15;
          num2 = Math.floor(Math.random() * 12) + 2;
          expr = `${num1} - ${num2} = ?`;
          ans = num1 - num2;
        } else {
          num1 = Math.floor(Math.random() * 8) + 2;
          num2 = Math.floor(Math.random() * 8) + 2;
          expr = `${num1} × ${num2} = ?`;
          ans = num1 * num2;
        }
        generated.push({ expr, ans });
      }
      setMathQuestions(generated);
    } 
    else if (gameType === 'memory') {
      const emojis = ["☕", "📱", "🎧", "🚗", "🍕", "💡"];
      const deck = [...emojis, ...emojis].sort(() => Math.random() - 0.5);
      setMemoryCards(deck.map((emoji, index) => ({ id: index, emoji, flipped: false, matched: false })));
    } 
    else if (gameType === 'reflex') {
      setupReflexRound(0);
    } 
    else if (gameType === 'scramble') {
      const wordsList = ["БЛИЦ", "НАГРАДА", "УСПЕХ", "ИГРА", "ПЪЗЕЛ", "ТАКСА", "КАФЕ"];
      const shuffled = wordsList.sort(() => Math.random() - 0.5).slice(0, 3);
      setScrambleWords(shuffled);
      setupScrambleWord(shuffled[0]);
    } 
    else if (gameType === 'numbers') {
      const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5);
      setNumbersGrid(nums);
    }

    return () => {
      clearInterval(timerIntervalRef.current);
      clearInterval(botIntervalRef.current);
      if (reflexTimeoutRef.current) clearTimeout(reflexTimeoutRef.current);
    };
  }, [gameType, lobbyId]);

  // --- FINISH GAME ---
  const handleFinishGame = async (finalErrors = errors, finalPenalty = penaltyTime) => {
    // Stop timers
    clearInterval(timerIntervalRef.current);
    clearInterval(botIntervalRef.current);
    if (reflexTimeoutRef.current) clearTimeout(reflexTimeoutRef.current);

    setIsPlaying(false);
    setLoading(true);

    const actualElapsed = (Date.now() - startTimeRef.current) / 1000;
    const totalFinishedTime = parseFloat((actualElapsed + finalPenalty).toFixed(2));

    try {
      const res = await apiFetch('/api/lobbies/finish', {
        method: 'POST',
        body: JSON.stringify({
          lobbyId,
          finalTime: totalFinishedTime,
          errors: finalErrors
        })
      });

      if (res.ok) {
        const data = await res.json();
        // Sort players by finished time
        const players = data.lobby.players || [];
        const sorted = [...players].sort((a, b) => a.time - b.time);
        setResultsList(sorted);
        setWinnerName(data.lobby.winner);
        setShowResults(true);
        triggerSync();
      } else {
        throw new Error("Lobby finish failed");
      }
    } catch (e) {
      // Offline Finish Simulation
      const actualElapsed = (Date.now() - startTimeRef.current) / 1000;
      const myTime = parseFloat((actualElapsed + finalPenalty).toFixed(2));

      // Build simulated bot results
      const finalPlayers = [
        { name: "Вие (Участник)", isMe: true, time: myTime, errors: finalErrors, finished: true }
      ];

      const botNames = ["Христо В.", "Иван П.", "Мартин С.", "Теодора А.", "Стефан Р.", "Мария Г."];
      const botCount = lobby ? lobby.players.filter(p => !p.isMe).length : 2;

      for (let i = 0; i < botCount; i++) {
        const botBaseTime = parseFloat((Math.random() * 3.5 + 4.2).toFixed(2));
        const botErr = Math.floor(Math.random() * 2);
        const botPen = botErr * 3;
        finalPlayers.push({
          name: botNames[i],
          isMe: false,
          time: botBaseTime + botPen,
          errors: botErr,
          finished: true
        });
      }

      const sorted = [...finalPlayers].sort((a, b) => a.time - b.time);
      const offlineWinner = sorted[0].name === "Вие (Участник)" ? "Вие" : sorted[0].name;

      // Handle rewards if user is winner and it is not a practice mode
      if (offlineWinner === "Вие" && !isPractice) {
        updateState(prev => {
          const prizeVal = lobby ? lobby.prizeValue : 10;
          const newBalance = prev.balance + prizeVal;
          const newHistory = [
            {
              id: Date.now(),
              desc: `Спечелен Частен дуел (${lobby ? lobby.prizeName : 'Игра'}) 🏆`,
              amount: prizeVal,
              type: "deposit",
              date: "Днес"
            },
            ...prev.walletHistory
          ];

          // Add to won prizes list
          const wonPrizes = [...(prev.user.wonPrizesList || [])];
          wonPrizes.push({
            id: Date.now(),
            prize_name: lobby ? lobby.prizeName : 'Игра',
            prize_value: prizeVal,
            delivery_status: 'pending',
            created_at: new Date().toISOString()
          });

          return {
            ...prev,
            balance: newBalance,
            walletHistory: newHistory,
            user: { ...prev.user, wonPrizesList: wonPrizes }
          };
        });
      }

      setResultsList(sorted);
      setWinnerName(offlineWinner);
      setShowResults(true);
    } finally {
      setLoading(false);
    }
  };

  // --- GAME 1: MATH BLITZ LOGIC ---
  const handleKeypadPress = (num) => {
    setMathInput(prev => prev + num);
  };

  const handleKeypadClear = () => {
    setMathInput('');
  };

  const handleKeypadSubmit = () => {
    if (!mathInput) return;
    const currentQ = mathQuestions[currentQIndex];
    const ans = parseInt(mathInput);
    if (ans === currentQ.ans) {
      // Correct!
      const nextIdx = currentQIndex + 1;
      if (nextIdx >= mathQuestions.length) {
        handleFinishGame(errors, penaltyTime);
      } else {
        setCurrentQIndex(nextIdx);
        setMathInput('');
      }
    } else {
      // Wrong!
      const newErrors = errors + 1;
      const newPenalty = penaltyTime + 3;
      setErrors(newErrors);
      setPenaltyTime(newPenalty);
      setMathInput('');
      triggerPenalty("Грешен отговор! +3 сек.");
    }
  };

  // --- GAME 2: MEMORY LOGIC ---
  const handleCardPress = (id) => {
    if (flippedCards.length >= 2) return;
    const cardIndex = memoryCards.findIndex(c => c.id === id);
    if (memoryCards[cardIndex].flipped || memoryCards[cardIndex].matched) return;

    // Flip card
    const updatedCards = [...memoryCards];
    updatedCards[cardIndex].flipped = true;
    setMemoryCards(updatedCards);

    const nextFlipped = [...flippedCards, { index: cardIndex, emoji: updatedCards[cardIndex].emoji }];
    setFlippedCards(nextFlipped);

    if (nextFlipped.length === 2) {
      const [first, second] = nextFlipped;
      if (first.emoji === second.emoji) {
        // Match!
        setTimeout(() => {
          setMemoryCards(prev => {
            const nextDeck = [...prev];
            nextDeck[first.index].matched = true;
            nextDeck[second.index].matched = true;
            nextDeck[first.index].flipped = false;
            nextDeck[second.index].flipped = false;
            
            // Check win
            const allMatched = nextDeck.every(c => c.matched);
            if (allMatched) {
              handleFinishGame(errors, penaltyTime);
            }
            return nextDeck;
          });
          setFlippedCards([]);
        }, 300);
      } else {
        // No match
        const newErrors = errors + 1;
        const newPenalty = penaltyTime + 3;
        setErrors(newErrors);
        setPenaltyTime(newPenalty);
        triggerPenalty("Няма съвпадение! +3 сек.");
        
        setTimeout(() => {
          setMemoryCards(prev => {
            const nextDeck = [...prev];
            nextDeck[first.index].flipped = false;
            nextDeck[second.index].flipped = false;
            return nextDeck;
          });
          setFlippedCards([]);
        }, 700);
      }
    }
  };

  // --- GAME 3: REFLEX LOGIC ---
  const setupReflexRound = (round) => {
    setReflexState('wait');
    setReflexRound(round);

    if (reflexTimeoutRef.current) clearTimeout(reflexTimeoutRef.current);

    const delay = Math.floor(Math.random() * 2000) + 1200; // 1.2s to 3.2s
    reflexTimeoutRef.current = setTimeout(() => {
      setReflexState('go');
      setReflexGoTime(Date.now());
    }, delay);
  };

  const handleReflexPress = () => {
    if (reflexState === 'wait') {
      // Clicked too early!
      const newErrors = errors + 1;
      const newPenalty = penaltyTime + 3;
      setErrors(newErrors);
      setPenaltyTime(newPenalty);
      triggerPenalty("Рано! Изчакайте зеленото! +3 сек.");
      setupReflexRound(reflexRound);
    } 
    else if (reflexState === 'go') {
      // Success!
      setReflexState('idle');
      const reactionTime = (Date.now() - reflexGoTime) / 1000;
      
      const nextRound = reflexRound + 1;
      if (nextRound >= 3) {
        handleFinishGame(errors, penaltyTime);
      } else {
        setupReflexRound(nextRound);
      }
    }
  };

  // --- GAME 4: SCRAMBLE LOGIC ---
  const setupScrambleWord = (word) => {
    const letters = word.split("").map((letter, index) => ({ id: index, letter }));
    const scrambled = [...letters].sort(() => Math.random() - 0.5);
    setCurrentWordLetters(scrambled);
    setScrambleSpelled('');
    setUsedLetterIndices([]);
  };

  const handleScrambleLetterPress = (item, index) => {
    if (usedLetterIndices.includes(index)) return;

    const newSpelled = scrambleSpelled + item.letter;
    setScrambleSpelled(newSpelled);
    setUsedLetterIndices([...usedLetterIndices, index]);

    const targetWord = scrambleWords[currentQIndex];
    if (newSpelled.length === targetWord.length) {
      if (newSpelled === targetWord) {
        // Correct
        const nextQ = currentQIndex + 1;
        if (nextQ >= 3) {
          handleFinishGame(errors, penaltyTime);
        } else {
          setCurrentQIndex(nextQ);
          setupScrambleWord(scrambleWords[nextQ]);
        }
      } else {
        // Wrong
        const newErrors = errors + 1;
        const newPenalty = penaltyTime + 3;
        setErrors(newErrors);
        setPenaltyTime(newPenalty);
        triggerPenalty("Грешна дума! Опитайте пак! +3 сек.");
        
        // Reset spelling
        setTimeout(() => {
          setScrambleSpelled('');
          setUsedLetterIndices([]);
        }, 500);
      }
    }
  };

  // --- GAME 5: NUMBERS LOGIC ---
  const handleNumberPress = (num) => {
    if (num === targetNumber) {
      const nextNum = targetNumber + 1;
      if (nextNum > 9) {
        handleFinishGame(errors, penaltyTime);
      } else {
        setTargetNumber(nextNum);
      }
    } else {
      const newErrors = errors + 1;
      const newPenalty = penaltyTime + 3;
      setErrors(newErrors);
      setPenaltyTime(newPenalty);
      triggerPenalty("Грешно число! Натиснете " + targetNumber + "! +3 сек.");
    }
  };

  // --- VIEW RENDERING HELPERS ---
  const renderGameBoard = () => {
    if (gameType === 'math') {
      const currentQ = mathQuestions[currentQIndex];
      if (!currentQ) return <ActivityIndicator color="#a855f7" />;
      return (
        <View style={styles.gameBoard}>
          <Text style={styles.mathExpression}>{currentQ.expr}</Text>
          <View style={styles.mathInputBox}>
            <Text style={styles.mathInputText}>{mathInput || "?"}</Text>
          </View>

          {/* Custom keypad */}
          <View style={styles.keypad}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
              <TouchableOpacity key={num} style={styles.keypadBtn} onPress={() => handleKeypadPress(num.toString())}>
                <Text style={styles.keypadText}>{num}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[styles.keypadBtn, styles.keypadBtnClear]} onPress={handleKeypadClear}>
              <Text style={styles.keypadText}>C</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.keypadBtn} onPress={() => handleKeypadPress('0')}>
              <Text style={styles.keypadText}>0</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.keypadBtn, styles.keypadBtnSubmit]} onPress={handleKeypadSubmit}>
              <Text style={styles.keypadText}>✓</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    } 
    else if (gameType === 'memory') {
      return (
        <View style={styles.memoryGrid}>
          {memoryCards.map((card) => {
            const showValue = card.flipped || card.matched;
            return (
              <TouchableOpacity 
                key={card.id} 
                style={[
                  styles.memoryCard, 
                  showValue && styles.memoryCardFlipped,
                  card.matched && styles.memoryCardMatched
                ]}
                activeOpacity={0.8}
                onPress={() => handleCardPress(card.id)}
              >
                {showValue ? (
                  <Text style={styles.memoryCardEmoji}>{card.emoji}</Text>
                ) : (
                  <Text style={styles.memoryCardBack}>?</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      );
    } 
    else if (gameType === 'reflex') {
      const isGo = reflexState === 'go';
      return (
        <View style={styles.reflexBoard}>
          <TouchableOpacity 
            style={[styles.reflexBtn, isGo ? styles.reflexBtnGo : styles.reflexBtnWait]} 
            activeOpacity={0.9}
            onPress={handleReflexPress}
          >
            <Text style={styles.reflexBtnText}>
              {isGo ? "НАТИСНИ СЕГА!" : "ИЗЧАКАЙТЕ..."}
            </Text>
          </TouchableOpacity>
          <Text style={styles.reflexHelper}>Натиснете бутона веднага след като се оцвети в зелено.</Text>
        </View>
      );
    } 
    else if (gameType === 'scramble') {
      return (
        <View style={styles.scrambleBoard}>
          <Text style={styles.scrambleTarget}>
            {currentWordLetters.map((c, i) => usedLetterIndices.includes(i) ? '_ ' : c.letter + ' ')}
          </Text>
          <View style={styles.scrambleSpelledBox}>
            <Text style={styles.scrambleSpelledText}>{scrambleSpelled.split("").join(" ") || "..."}</Text>
          </View>

          {/* Letter grid */}
          <View style={styles.lettersGrid}>
            {currentWordLetters.map((item, index) => {
              const isUsed = usedLetterIndices.includes(index);
              return (
                <TouchableOpacity 
                  key={index} 
                  style={[styles.letterBtn, isUsed && styles.letterBtnUsed]} 
                  disabled={isUsed}
                  onPress={() => handleScrambleLetterPress(item, index)}
                >
                  <Text style={[styles.letterText, isUsed && styles.letterTextUsed]}>{item.letter}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      );
    } 
    else if (gameType === 'numbers') {
      return (
        <View style={styles.numbersGrid}>
          {numbersGrid.map((num) => {
            const isClicked = num < targetNumber;
            return (
              <TouchableOpacity 
                key={num} 
                style={[styles.numberCell, isClicked && styles.numberCellClicked]} 
                disabled={isClicked}
                onPress={() => handleNumberPress(num)}
              >
                <Text style={[styles.numberCellText, isClicked && styles.numberCellTextClicked]}>{num}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      );
    }
    return null;
  };

  const getStepProgress = () => {
    if (gameType === 'math') return currentQIndex;
    if (gameType === 'memory') return memoryCards.filter(c => c.matched).length / 2;
    if (gameType === 'reflex') return reflexRound;
    if (gameType === 'scramble') return currentQIndex;
    if (gameType === 'numbers') return targetNumber - 1;
    return 0;
  };

  const stepProgress = getStepProgress();

  return (
    <View style={styles.container}>
      {/* Toast Alert */}
      {showToast && (
        <Animated.View style={[styles.toast, { opacity: toastAnim }]}>
          <Text style={styles.toastText}>{toastText}</Text>
        </Animated.View>
      )}

      {isPlaying && (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Header Progress and Timer */}
          <View style={styles.gameHeader}>
            <View>
              <Text style={styles.gameTitleLabel}>
                {gameType === 'math' ? '🧮 МАТЕМАТИКА' : 
                 gameType === 'memory' ? '🃏 КАРТИ ЗА ПАМЕТ' : 
                 gameType === 'reflex' ? '⚡ БЪРЗ РЕФЛЕКС' :
                 gameType === 'scramble' ? '🔤 РАЗБЪРКАНИ ДУМИ' : '🔢 ПОДРЕДИ ЧИСЛАТА'}
              </Text>
              <Text style={styles.stepProgressText}>Стъпка {stepProgress}/{totalSteps}</Text>
            </View>

            <View style={styles.timerBox}>
              <Text style={styles.timerValue}>{elapsedTime.toFixed(1)} с</Text>
              {penaltyTime > 0 && <Text style={styles.penaltyText}>+{penaltyTime}с штраф</Text>}
            </View>
          </View>

          {/* Main game board */}
          {renderGameBoard()}

          {/* Opponent Progress Simulation Tracker */}
          {liveBots.length > 0 && (
            <View style={styles.opponentsLiveProgress}>
              <Text style={styles.liveProgressTitle}>📊 НАПРЕДЪК НА ОПОНЕНТИТЕ (НА ЖИВО)</Text>
              <View style={styles.liveOpponentsList}>
                {liveBots.map((bot) => {
                  return (
                    <View key={bot.name} style={styles.liveOpponentRow}>
                      <View style={styles.botInfo}>
                        <View style={[styles.statusDot, bot.finished ? styles.statusDotFinished : styles.statusDotPlaying]} />
                        <Text style={styles.botName}>{bot.name}</Text>
                      </View>
                      <Text style={styles.botStepText}>
                        {bot.finished ? `Готов! (${bot.time}с)` : `${bot.step}/${bot.totalSteps}`}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </ScrollView>
      )}

      {/* Results View Modal */}
      {showResults && (
        <View style={styles.resultsOverlay}>
          <View style={styles.resultsContent}>
            <Text style={styles.resultsTitle}>🏆 КРАЙНИ РЕЗУЛТАТИ</Text>
            <Text style={styles.resultsSubtitle}>
              Турнир: {lobby ? lobby.prizeName : 'Частен дуел'}
            </Text>

            <View style={styles.winnerAnnounce}>
              <Text style={styles.winnerEmoji}>👑</Text>
              <Text style={styles.winnerNameText}>Победител: {winnerName}</Text>
              {winnerName === 'Вие' ? (
                <Text style={styles.winnerRewardText}>
                  Наградата е добавена в Профила Ви!
                </Text>
              ) : (
                <Text style={styles.loserRewardText}>Повече късмет следващия път!</Text>
              )}
            </View>

            <Text style={styles.leaderboardHeader}>Класиране по време (с наказанията):</Text>
            <View style={styles.resultsList}>
              {resultsList.map((player, idx) => {
                const isMe = player.isMe || player.name.includes("Вие");
                return (
                  <View key={idx} style={[styles.resultItem, isMe && styles.resultItemMe]}>
                    <Text style={styles.resultIdx}>{idx + 1}.</Text>
                    <Text style={[styles.resultName, isMe && styles.resultNameMe]}>{player.name}</Text>
                    <Text style={styles.resultErrors}>Грешки: {player.errors}</Text>
                    <Text style={styles.resultTime}>{player.time.toFixed(2)} с</Text>
                  </View>
                );
              })}
            </View>

            <TouchableOpacity 
              style={styles.closeResultsBtn}
              onPress={() => navigation.navigate('Lobbies')}
            >
              <Text style={styles.closeResultsBtnText}>КЪМ ТУРНИРИТЕ</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a051b',
  },
  content: {
    padding: 15,
    paddingBottom: 40,
  },
  toast: {
    position: 'absolute',
    top: 40,
    left: '10%',
    right: '10%',
    backgroundColor: '#ef4444',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    zIndex: 999,
  },
  toastText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  gameHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    padding: 15,
  },
  gameTitleLabel: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '850',
  },
  stepProgressText: {
    color: '#71717a',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
  },
  timerBox: {
    alignItems: 'flex-end',
  },
  timerValue: {
    color: '#fbbf24',
    fontSize: 18,
    fontWeight: '900',
  },
  penaltyText: {
    color: '#ef4444',
    fontSize: 9,
    fontWeight: '700',
    marginTop: 2,
  },
  gameBoard: {
    alignItems: 'center',
    marginBottom: 20,
  },
  mathExpression: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '900',
    marginVertical: 15,
    letterSpacing: 1,
  },
  mathInputBox: {
    width: '100%',
    height: 50,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  mathInputText: {
    color: '#a855f7',
    fontSize: 22,
    fontWeight: '900',
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    justifyContent: 'space-between',
    gap: 10,
  },
  keypadBtn: {
    width: '30%',
    aspectRatio: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  keypadBtnClear: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  keypadBtnSubmit: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  keypadText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  memoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 20,
  },
  memoryCard: {
    width: '22%',
    aspectRatio: 0.8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memoryCardFlipped: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    borderColor: '#8b5cf6',
  },
  memoryCardMatched: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10b981',
    opacity: 0.8,
  },
  memoryCardEmoji: {
    fontSize: 24,
  },
  memoryCardBack: {
    color: '#71717a',
    fontSize: 18,
    fontWeight: '700',
  },
  reflexBoard: {
    alignItems: 'center',
    marginVertical: 20,
  },
  reflexBtn: {
    width: '90%',
    aspectRatio: 1.2,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 10,
  },
  reflexBtnWait: {
    backgroundColor: '#374151',
    borderColor: '#4b5563',
    borderWidth: 2,
    shadowColor: '#000',
  },
  reflexBtnGo: {
    backgroundColor: '#10b981',
    borderColor: '#34d399',
    borderWidth: 2,
    shadowColor: '#10b981',
  },
  reflexBtnText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
  },
  reflexHelper: {
    color: '#71717a',
    fontSize: 10,
    textAlign: 'center',
  },
  scrambleBoard: {
    alignItems: 'center',
    marginBottom: 20,
  },
  scrambleTarget: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
    marginVertical: 15,
    letterSpacing: 2,
  },
  scrambleSpelledBox: {
    width: '100%',
    height: 50,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  scrambleSpelledText: {
    color: '#d946ef',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 2,
  },
  lettersGrid: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    flexWrap: 'wrap',
  },
  letterBtn: {
    width: 45,
    height: 45,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  letterBtnUsed: {
    backgroundColor: 'rgba(255, 255, 255, 0.01)',
    borderColor: 'rgba(255, 255, 255, 0.02)',
    opacity: 0.3,
  },
  letterText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  letterTextUsed: {
    color: '#52525b',
  },
  numbersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
    gap: 10,
    marginBottom: 20,
  },
  numberCell: {
    width: '30%',
    aspectRatio: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberCellClicked: {
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    borderColor: '#a855f7',
    opacity: 0.6,
  },
  numberCellText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
  numberCellTextClicked: {
    color: '#a855f7',
  },
  opponentsLiveProgress: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 15,
    marginTop: 10,
  },
  liveProgressTitle: {
    color: '#a855f7',
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  liveOpponentsList: {
    gap: 8,
  },
  liveOpponentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  botInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusDotPlaying: {
    backgroundColor: '#38bdf8',
  },
  statusDotFinished: {
    backgroundColor: '#10b981',
  },
  botName: {
    color: '#a1a1aa',
    fontSize: 11,
    fontWeight: '700',
  },
  botStepText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  resultsOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5, 2, 15, 0.98)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 15,
    zIndex: 999,
  },
  resultsContent: {
    width: '95%',
    backgroundColor: '#0f0a24',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.3)',
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
  },
  resultsTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  resultsSubtitle: {
    color: '#71717a',
    fontSize: 11,
    marginTop: 5,
    marginBottom: 20,
  },
  winnerAnnounce: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    borderRadius: 16,
    padding: 15,
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  winnerEmoji: {
    fontSize: 34,
    marginBottom: 5,
  },
  winnerNameText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '850',
  },
  winnerRewardText: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 5,
  },
  loserRewardText: {
    color: '#71717a',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 5,
  },
  leaderboardHeader: {
    color: '#a855f7',
    fontSize: 11,
    fontWeight: '800',
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  resultsList: {
    width: '100%',
    gap: 8,
    marginBottom: 25,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    padding: 10,
  },
  resultItemMe: {
    backgroundColor: 'rgba(168, 85, 247, 0.08)',
    borderColor: 'rgba(168, 85, 247, 0.2)',
  },
  resultIdx: {
    color: '#71717a',
    fontSize: 11,
    width: 20,
    fontWeight: '700',
  },
  resultName: {
    color: '#a1a1aa',
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
  },
  resultNameMe: {
    color: '#fff',
  },
  resultErrors: {
    color: '#71717a',
    fontSize: 9,
    marginRight: 10,
  },
  resultTime: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  closeResultsBtn: {
    width: '100%',
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#8b5cf6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeResultsBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  }
});
