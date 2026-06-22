import React, { useState } from 'react';
import { StyleSheet, SafeAreaView, View, ActivityIndicator, StatusBar, Platform } from 'react-native';
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
    <StripeProvider 
      publishableKey="pk_test_51P8e83J3J2WWqOA7GU79gD3JNqJmsZYjp96ifElKXeSwVhoCme3GcgcgbBxQppXbaCcydIBtSpjeVsm3ikAewyH1003Zz8ojZm"
      merchantIdentifier="merchant.com.tombola"
      urlScheme="tombola"
    >
      <AppProvider>
        <AppNavigator />
      </AppProvider>
    </StripeProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a051b',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
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
