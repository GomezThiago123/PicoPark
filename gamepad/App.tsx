import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import ConnectionScreen from './src/screens/ConnectionScreen';
import GamepadScreen from './src/screens/GamepadScreen';

export default function App() {
  const [serverAddress, setServerAddress] = useState<string | null>(null);

  useEffect(() => {
    activateKeepAwakeAsync();
    return () => { deactivateKeepAwake(); };
  }, []);

  return (
    <>
      <StatusBar hidden />
      {serverAddress ? (
        <GamepadScreen
          address={serverAddress}
          onDisconnect={() => setServerAddress(null)}
        />
      ) : (
        <ConnectionScreen onConnect={setServerAddress} />
      )}
    </>
  );
}
