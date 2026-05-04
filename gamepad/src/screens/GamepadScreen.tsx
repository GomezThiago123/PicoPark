import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import DPad from '../components/DPad';
import JumpButton from '../components/JumpButton';
import { useGameSocket } from '../hooks/useGameSocket';

interface Props {
  address: string;
  onDisconnect: () => void;
}

export default function GamepadScreen({ address, onDisconnect }: Props) {
  const { connected, player, sendInput, error } = useGameSocket(address);

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorIcon}>⚠</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={onDisconnect}>
          <Text style={styles.backBtnText}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const playerColor = player?.color ?? '#888';

  return (
    <View style={[styles.container, connected && player ? { borderColor: playerColor, borderWidth: 3 } : {}]}>

      {/* Barra superior */}
      <View style={styles.header}>
        <View style={[styles.led, { backgroundColor: connected ? '#2ecc71' : '#e74c3c' }]} />
        <Text style={styles.statusText} numberOfLines={1}>
          {connected
            ? player
              ? `${player.name}  ·  ${address}`
              : 'Conectado — esperando partida...'
            : 'Conectando...'}
        </Text>
        <TouchableOpacity onPress={onDisconnect} style={styles.disconnectBtn}>
          <Text style={styles.disconnectText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Zona del control */}
      <View style={styles.padArea}>

        {/* D-PAD izquierda */}
        <DPad onInput={(key, pressed) => sendInput(key, pressed)} />

        {/* Centro: info del jugador */}
        <View style={styles.centerArea}>
          {!connected && <ActivityIndicator color="#FFD700" size="large" />}
          {connected && !player && (
            <Text style={styles.waitText}>Esperando personaje...</Text>
          )}
          {connected && player && (
            <>
              <View style={[styles.playerBadge, { backgroundColor: playerColor }]}>
                <Text style={styles.playerInitial}>{player.name[0]}</Text>
              </View>
              <Text style={[styles.playerName, { color: playerColor }]}>{player.name}</Text>
              <Text style={styles.playerSub}>Jugador {player.index + 1}</Text>
            </>
          )}
        </View>

        {/* Botón de salto derecha */}
        <JumpButton
          color={playerColor}
          onInput={(pressed) => sendInput('jump', pressed)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0d1a',
    borderColor: 'transparent',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#0d0d1a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorIcon:  { fontSize: 48, marginBottom: 16 },
  errorText:  { color: '#e74c3c', fontSize: 17, textAlign: 'center', marginBottom: 28, lineHeight: 24 },
  backBtn:    { backgroundColor: '#2980b9', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 10 },
  backBtnText:{ color: 'white', fontWeight: 'bold', fontSize: 16 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  led: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  statusText: {
    flex: 1,
    color: '#aaa',
    fontSize: 13,
  },
  disconnectBtn: { padding: 4, paddingHorizontal: 10 },
  disconnectText: { color: '#666', fontSize: 20 },

  padArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
  },

  centerArea: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
  },
  playerBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
  },
  playerInitial: { color: 'white', fontSize: 30, fontWeight: 'bold' },
  playerName:    { fontSize: 16, fontWeight: 'bold', marginBottom: 2 },
  playerSub:     { color: '#555', fontSize: 12 },
  waitText:      { color: '#555', fontSize: 13, textAlign: 'center' },
});
