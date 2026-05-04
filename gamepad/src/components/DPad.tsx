import React, { useCallback } from 'react';
import { View, Pressable, StyleSheet, Text } from 'react-native';

interface Props {
  onInput: (key: 'left' | 'right', pressed: boolean) => void;
}

export default function DPad({ onInput }: Props) {
  const left  = useCallback((p: boolean) => onInput('left',  p), [onInput]);
  const right = useCallback((p: boolean) => onInput('right', p), [onInput]);

  return (
    <View style={styles.container}>
      <Pressable
        style={({ pressed }) => [styles.btn, styles.btnLeft, pressed && styles.pressed]}
        onPressIn={() => left(true)}
        onPressOut={() => left(false)}
        android_disableSound
      >
        <Text style={styles.arrow}>◄</Text>
      </Pressable>

      <View style={styles.center} />

      <Pressable
        style={({ pressed }) => [styles.btn, styles.btnRight, pressed && styles.pressed]}
        onPressIn={() => right(true)}
        onPressOut={() => right(false)}
        android_disableSound
      >
        <Text style={styles.arrow}>►</Text>
      </Pressable>
    </View>
  );
}

const BTN = 72;

const styles = StyleSheet.create({
  container: {
    width: 190,
    height: 190,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  btn: {
    position: 'absolute',
    width: BTN,
    height: BTN,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pressed: {
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderColor: 'rgba(255,255,255,0.6)',
  },
  btnLeft:  { left: 0, top: (190 - BTN) / 2 },
  btnRight: { right: 0, top: (190 - BTN) / 2 },
  center: {
    width: 44,
    height: 44,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  arrow: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 30,
    fontWeight: 'bold',
  },
});
