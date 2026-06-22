import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ActivityIndicator, StatusBar } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AppProvider, useApp } from './context/AppContext';
import { StripeProvider } from '@stripe/stripe-react-native';

// Screens
import LobbiesScreen from './screens/LobbiesScreen';
import HistoryScreen from './screens/HistoryScreen';
import WalletScreen from './screens/WalletScreen';
import ProfileScreen from './screens/ProfileScreen';
import LeagueClanScreen from './screens/LeagueClanScreen';
import GameScreen from './screens/GameScreen';
import AdminScreen from './screens/AdminScreen';
import SplashScreen from './screens/SplashScreen';
import AuthScreen from './screens/AuthScreen';

// Components
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import LuckyWheelModal from './components/LuckyWheelModal';
import LootboxModal from './components/LootboxModal';
import AdminAuthModal from './components/AdminAuthModal';
import FriendDuelModal from './components/FriendDuelModal';
import OnboardingModal from './components/OnboardingModal';

const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';

function AppNavigator() {
  const { loading, state, updateState } = useApp();
  const [showSplash, setShowSplash] = useState(true);
  const [currentScreen, setCurrentScreen] = useState('Lobbies');
  const [routeParams, setRouteParams] = useState({});

  // Modals Visibility
  const [luckyWheelVisible, setLuckyWheelVisible] = useState(false);
  const [lootboxVisible, setLootboxVisible] = useState(false);
  const [adminAuthVisible, setAdminAuthVisible] = useState(false);
  const [friendDuelVisible, setFriendDuelVisible] = useState(false);

  // Auto-open Lucky Wheel once per day
  useEffect(() => {
    if (!loading && state.user && state.user.verified) {
      const today = new Date().toDateString();
      if (state.lastSpinDate !== today) {
        // Wait a short moment after rendering the app before popping it up
        const timer = setTimeout(() => {
          setLuckyWheelVisible(true);
        }, 1200);
        return () => clearTimeout(timer);
      }
    }
  }, [loading, state.user, state.lastSpinDate]);

  // Custom simple navigation routing
  const navigation = {
    navigate: (screenName, params = {}) => {
      setCurrentScreen(screenName);
      setRouteParams(params);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#a855f7" />
      </View>
    );
  }

  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  if (!state.user || !state.user.verified) {
    return <AuthScreen />;
  }

  // Render correct active screen content
  const renderScreen = () => {
    switch (currentScreen) {
      case 'Lobbies':
        return (
          <LobbiesScreen 
            navigation={navigation}
            onOpenLuckyWheel={() => setLuckyWheelVisible(true)}
            onOpenFriendDuel={() => setFriendDuelVisible(true)}
          />
        );
      case 'History':
        return <HistoryScreen />;
      case 'Wallet':
        return <WalletScreen />;
      case 'Profile':
        return (
          <ProfileScreen 
            onOpenLootbox={() => setLootboxVisible(true)}
          />
        );
      case 'LeagueClan':
        return <LeagueClanScreen />;
      case 'Game':
        return <GameScreen route={{ params: routeParams }} navigation={navigation} />;
      case 'Admin':
        return <AdminScreen navigation={navigation} />;
      default:
        return <LobbiesScreen navigation={navigation} />;
    }
  };

  const showHeaderAndNav = currentScreen !== 'Game';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a051b" />
      
      {showHeaderAndNav && (
        <Header 
          onOpenAdminAuth={() => setAdminAuthVisible(true)} 
        />
      )}

      {/* Main Content View */}
      <View style={styles.mainContent}>
        {renderScreen()}
      </View>

      {showHeaderAndNav && (
        <BottomNav 
          currentScreen={currentScreen} 
          onSelectScreen={(screenKey) => navigation.navigate(screenKey)} 
        />
      )}

      {/* Popups and Modals */}
      <LuckyWheelModal 
        visible={luckyWheelVisible} 
        onClose={() => setLuckyWheelVisible(false)} 
      />

      <LootboxModal 
        visible={lootboxVisible} 
        onClose={() => setLootboxVisible(false)} 
      />

      <AdminAuthModal 
        visible={adminAuthVisible} 
        onClose={() => setAdminAuthVisible(false)}
        onAuthSuccess={() => navigation.navigate('Admin')}
      />

      <FriendDuelModal
        visible={friendDuelVisible}
        onClose={() => setFriendDuelVisible(false)}
        onStartGame={(lobbyId) => navigation.navigate('Game', { lobbyId })}
      />

      <OnboardingModal
        visible={state.showTutorial}
        onClose={() => updateState({ showTutorial: false })}
      />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StripeProvider 
        publishableKey={STRIPE_PUBLISHABLE_KEY}
        merchantIdentifier="merchant.com.tombola"
        urlScheme="tombola"
    >
        <AppProvider>
          <AppNavigator />
        </AppProvider>
      </StripeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a051b',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0a051b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainContent: {
    flex: 1,
  },
});
