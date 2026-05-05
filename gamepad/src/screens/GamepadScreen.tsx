import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Dimensions,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useGameSocket } from '../hooks/useGameSocket';

const { width: SW } = Dimensions.get('window');

// Zonas de toque (pantalla landscape):
//   x < 40%          → D-Pad (izquierda/derecha según si es < 20% o 20-40%)
//   x > 60%          → Salto
const LEFT_MAX  = SW * 0.20;
const RIGHT_MAX = SW * 0.42;
const JUMP_MIN  = SW * 0.58;

type Zone = 'left' | 'right' | 'jump';

interface Props {
  address: string;
  onDisconnect: () => void;
}

export default function GamepadScreen({ address, onDisconnect }: Props) {
  const { connected, player, sendInput, error } = useGameSocket(address);

  // Mapa de touchId → zona activa
  const touchMap  = useRef<Map<number, Zone>>(new Map());
  // Estado actual de cada input (evita emitir duplicados)
  const inputRef  = useRef({ left: false, right: false, jump: false });

  // Solo para feedback visual
  const [vis, setVis] = useState({ left: false, right: false, jump: false });

  const fire = (key: Zone, pressed: boolean) => {
    if (inputRef.current[key] === pressed) return;
    inputRef.current[key] = pressed;
    sendInput(key, pressed);
    setVis(v => ({ ...v, [key]: pressed }));
  };

  const zoneOf = (x: number): Zone | null => {
    if (x < LEFT_MAX)  return 'left';
    if (x < RIGHT_MAX) return 'right';
    if (x > JUMP_MIN)  return 'jump';
    return null;
  };

  const onTouchStart = (e: any) => {
    for (const t of e.nativeEvent.changedTouches) {
      const zone = zoneOf(t.pageX);
      if (!zone) continue;
      touchMap.current.set(t.identifier, zone);
      fire(zone, true);
    }
  };

  const onTouchEnd = (e: any) => {
    const remaining = new Set(
      (e.nativeEvent.touches as any[]).map(t => t.identifier)
    );
    for (const t of e.nativeEvent.changedTouches) {
      const zone = touchMap.current.get(t.identifier);
      touchMap.current.delete(t.identifier);
      if (!zone) continue;
      // Solo liberar si ningún otro dedo sigue en esa zona
      const stillHeld = [...touchMap.current.entries()]
        .some(([id, z]) => z === zone && remaining.has(id));
      if (!stillHeld) fire(zone, false);
    }
  };

  const playerColor = player?.color ?? '#888';

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

  return (
    <View style={[styles.container, connected && player ? { borderColor: playerColor, borderWidth: 3 } : {}]}>

      {/* Barra superior */}
      <View style={styles.header}>
        <View style={[styles.led, { backgroundColor: connected ? '#2ecc71' : '#e74c3c' }]} />
        <Text style={styles.statusText} numberOfLines={1}>
          {connected
            ? player ? `${player.name}  ·  ${address}` : 'Conectado — esperando...'
            : 'Conectando...'}
        </Text>
        <TouchableOpacity onPress={onDisconnect} style={styles.disconnectBtn}>
          <Text style={styles.disconnectText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Zona de control — UN SOLO View captura todos los toques */}
      <View
        style={styles.touchArea}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        {/* D-Pad visual (izquierda) */}
        <View style={styles.dpad} pointerEvents="none">
          <View style={[styles.dpadBtn, vis.left  && styles.dpadPressed]}>
            <Text style={styles.arrow}>◄</Text>
          </View>
          <View style={styles.dpadCenter} />
          <View style={[styles.dpadBtn, vis.right && styles.dpadPressed]}>
            <Text style={styles.arrow}>►</Text>
          </View>
        </View>

        {/* Info del jugador (centro) */}
        <View style={styles.centerArea} pointerEvents="none">
          {!connected && <ActivityIndicator color="#FFD700" size="large" />}
          {connected && player && (
            <>
              <View style={[styles.playerBadge, { backgroundColor: playerColor }]}>
                <Text style={styles.playerInitial}>{player.name[0]}</Text>
              </View>
              <Text style={[styles.playerName, { color: playerColor }]}>{player.name}</Text>
            </>
          )}
        </View>

        {/* Botón de salto visual (derecha) */}
        <View
          style={[styles.jumpBtn, { backgroundColor: vis.jump ? playerColor : playerColor + 'BB', shadowColor: playerColor }]}
          pointerEvents="none"
        >
          <Text style={styles.jumpLabel}>A</Text>
          <Text style={styles.jumpSub}>SALTO</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d1a', borderColor: 'transparent' },

  errorContainer: { flex: 1, backgroundColor: '#0d0d1a', justifyContent: 'center', alignItems: 'center', padding: 32 },
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
  led:            { width: 12, height: 12, borderRadius: 6, marginRight: 10 },
  statusText:     { flex: 1, color: '#aaa', fontSize: 13 },
  disconnectBtn:  { padding: 4, paddingHorizontal: 10 },
  disconnectText: { color: '#666', fontSize: 20 },

  touchArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },

  // D-Pad
  dpad: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dpadBtn: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dpadPressed: {
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderColor: 'rgba(255,255,255,0.6)',
  },
  dpadCenter: {
    width: 40, height: 40, borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  arrow: { color: 'rgba(255,255,255,0.85)', fontSize: 30, fontWeight: 'bold' },

  // Centro
  centerArea:    { alignItems: 'center', justifyContent: 'center', minWidth: 80 },
  playerBadge:   { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  playerInitial: { color: 'white', fontSize: 26, fontWeight: 'bold' },
  playerName:    { fontSize: 14, fontWeight: 'bold' },

  // Salto
  jumpBtn: {
    width: 110, height: 110, borderRadius: 55,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.4)',
    elevation: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.7, shadowRadius: 6,
  },
  jumpLabel: { color: 'white', fontSize: 36, fontWeight: 'bold', lineHeight: 40 },
  jumpSub:   { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
});
