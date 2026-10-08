/**
 * App entry: provides safe-area context, restores the auth session once,
 * then renders the root navigator (splash → login → app).
 */
import React, { useEffect } from 'react';
import { StatusBar, StyleSheet, useColorScheme, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/app/navigation';
import { useAuthStore } from './src/stores/authStore';

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <View style={styles.container}>
        <AppBootstrap />
      </View>
    </SafeAreaProvider>
  );
}

function AppBootstrap() {
  const bootstrap = useAuthStore(s => s.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return <RootNavigator />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default App;
