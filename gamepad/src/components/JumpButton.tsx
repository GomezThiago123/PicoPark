import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

interface Props {
  color: string;
  onInput: (pressed: boolean) => void;
}

export default function JumpButton({ color, onInput }: Props) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: pressed ? color : color + 'BB',
          shadowColor: color,
        },
      ]}
      onPressIn={() => onInput(true)}
      onPressOut={() => onInput(false)}
      android_disableSound
    >
      <Text style={styles.label}>A</Text>
      <Text style={styles.sub}>SALTO</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 110,
    height: 110,
    borderRadius: 55,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.4)',
    elevation: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.7,
    shadowRadius: 6,
  },
  label: {
    color: 'white',
    fontSize: 36,
    fontWeight: 'bold',
    lineHeight: 40,
  },
  sub: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
