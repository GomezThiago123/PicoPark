import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  color: string;
  onInput: (pressed: boolean) => void;
}

export default function JumpButton({ color, onInput }: Props) {
  const [pressed, setPressed] = useState(false);

  return (
    <View
      style={[
        styles.btn,
        {
          backgroundColor: pressed ? color : color + 'BB',
          shadowColor: color,
          borderColor: pressed ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.4)',
        },
      ]}
      onTouchStart={(e) => { e.stopPropagation(); setPressed(true);  onInput(true);  }}
      onTouchEnd={(e)   => { e.stopPropagation(); setPressed(false); onInput(false); }}
      onTouchCancel={(e)=> { e.stopPropagation(); setPressed(false); onInput(false); }}
    >
      <Text style={styles.label}>A</Text>
      <Text style={styles.sub}>SALTO</Text>
    </View>
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
