import React from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { useApp } from '../context/AppContext';
import { Ionicons } from '@expo/vector-icons';

export default function HistoryScreen() {
  const { state } = useApp();

  const handleDownloadWallpaper = (url) => {
    const downloadUrl = url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1080&auto=format&fit=crop';
    Linking.openURL(downloadUrl).catch(err => console.error("Couldn't open URL", err));
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>📜 ХРОНОЛОГИЯ И НАГРАДИ</Text>

      {/* Won Prizes Section */}
      <Text style={styles.sectionHeader}>🏆 Спечелени награди ({state.user.wonPrizesList.length})</Text>
      {state.user.wonPrizesList.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>Все още нямате спечелени награди.</Text>
          <Text style={styles.emptySub}>Играйте в реални турнири, за да спечелите материални награди или ваучери!</Text>
        </View>
      ) : (
        state.user.wonPrizesList.map((prize) => (
          <View key={prize.id} style={styles.prizeCard}>
            <View style={styles.prizeHeader}>
              <Text style={styles.prizeEmoji}>🎁</Text>
              <View style={styles.prizeTitleContainer}>
                <Text style={styles.prizeName}>{prize.prize_name || prize.prizeName}</Text>
                <Text style={styles.prizeValue}>Стойност: €{(parseFloat(prize.prize_value || prize.prizeValue || 0)).toFixed(2)}</Text>
              </View>
              <View style={[
                styles.statusBadge, 
                (prize.delivery_status || prize.deliveryStatus) === 'shipped' ? styles.statusShipped : styles.statusPending
              ]}>
                <Text style={styles.statusText}>
                  {(prize.delivery_status || prize.deliveryStatus) === 'shipped' ? "Изпратено" : "Чака доставка"}
                </Text>
              </View>
            </View>
            <Text style={styles.prizeDate}>Спечелена на: {new Date(prize.created_at).toLocaleDateString('bg-BG')}</Text>
            {prize.product_url && (
              <TouchableOpacity 
                style={styles.detailsBtn}
                onPress={() => Linking.openURL(prize.product_url)}
              >
                <Ionicons name="link-outline" size={14} color="#a855f7" />
                <Text style={styles.detailsBtnText}>Виж продукта в магазина</Text>
              </TouchableOpacity>
            )}
          </View>
        ))
      )}

      {/* Finished Games Section */}
      <Text style={styles.sectionHeader}>🎮 Завършени турнири ({state.completedTournaments.length})</Text>
      {state.completedTournaments.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>Все още не сте играли в турнири.</Text>
        </View>
      ) : (
        state.completedTournaments.map((game, idx) => {
          const isWin = game.winner === 'Вие';
          return (
            <View key={game.id || idx} style={[styles.gameCard, isWin && styles.gameCardWin]}>
              <View style={styles.gameInfo}>
                <View style={styles.gameTitleRow}>
                  <Text style={styles.gamePrize}>{game.prizeName}</Text>
                  {isWin && (
                    <View style={styles.winBadge}>
                      <Text style={styles.winBadgeText}>ПОБЕДИТЕЛ</Text>
                    </View>
                  )}
                </View>
                
                <Text style={styles.gameDetails}>
                  Вход: {game.isPractice ? 'ТРЕНИРОВКА' : `€${game.ticketPrice.toFixed(2)}`} | Награда: €{game.prizeValue.toFixed(2)}
                </Text>
                
                <Text style={styles.gamePlayers}>
                  Спечелена от: <Text style={isWin ? styles.winHighlight : styles.normalHighlight}>{game.winner}</Text>
                </Text>
              </View>

              {/* Download link for wallpaper products if won */}
              {isWin && game.productType === 'wallpaper' && (
                <TouchableOpacity 
                  style={styles.downloadBtn}
                  onPress={() => handleDownloadWallpaper(game.productUrl)}
                >
                  <Ionicons name="download-outline" size={16} color="#fff" />
                  <Text style={styles.downloadBtnText}>Изтегли Тапет</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })
      )}
    </ScrollView>
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
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 20,
    letterSpacing: 0.5,
  },
  sectionHeader: {
    color: '#a855f7',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 15,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptyCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    padding: 20,
    alignItems: 'center',
    marginBottom: 15,
  },
  emptyText: {
    color: '#71717a',
    fontSize: 12,
    fontWeight: '700',
  },
  emptySub: {
    color: '#52525b',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 5,
    lineHeight: 14,
  },
  prizeCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 15,
    marginBottom: 12,
  },
  prizeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  prizeEmoji: {
    fontSize: 24,
    marginRight: 10,
  },
  prizeTitleContainer: {
    flex: 1,
  },
  prizeName: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  prizeValue: {
    color: '#fbbf24',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusPending: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  statusShipped: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  statusText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#fff',
  },
  prizeDate: {
    color: '#71717a',
    fontSize: 9,
    marginTop: 10,
  },
  detailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    backgroundColor: 'rgba(168, 85, 247, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.15)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: 'flex-start',
    gap: 5,
  },
  detailsBtnText: {
    color: '#a855f7',
    fontSize: 10,
    fontWeight: '700',
  },
  gameCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    padding: 15,
    marginBottom: 10,
    flexDirection: 'column',
  },
  gameCardWin: {
    borderColor: 'rgba(16, 185, 129, 0.25)',
    backgroundColor: 'rgba(16, 185, 129, 0.02)',
  },
  gameInfo: {
    flex: 1,
  },
  gameTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gamePrize: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    flex: 1,
  },
  winBadge: {
    backgroundColor: '#10b981',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  winBadgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '950',
  },
  gameDetails: {
    color: '#71717a',
    fontSize: 10,
    marginTop: 4,
  },
  gamePlayers: {
    color: '#a1a1aa',
    fontSize: 11,
    marginTop: 8,
  },
  winHighlight: {
    color: '#10b981',
    fontWeight: '800',
  },
  normalHighlight: {
    color: '#d4d4d8',
    fontWeight: '700',
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    borderRadius: 8,
    padding: 8,
    marginTop: 10,
    gap: 6,
  },
  downloadBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  }
});
