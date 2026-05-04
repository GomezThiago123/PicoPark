import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

interface Props {
  onConnect: (address: string) => void;
}

export default function ConnectionScreen({ onConnect }: Props) {
  const [ip, setIp]             = useState('');
  const [scanning, setScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const handleScanPress = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Permiso denegado', 'Necesitás dar permiso a la cámara para escanear el QR.');
        return;
      }
    }
    setScanning(true);
  };

  const handleBarCode = ({ data }: { data: string }) => {
    setScanning(false);
    onConnect(data.trim());
  };

  const handleConnect = () => {
    const addr = ip.trim();
    if (!addr) return Alert.alert('Error', 'Ingresá la dirección IP del servidor (ej: 192.168.1.10:3000)');
    onConnect(addr);
  };

  if (scanning) {
    return (
      <View style={styles.scannerContainer}>
        <CameraView
          style={StyleSheet.absoluteFillObject}
          onBarcodeScanned={handleBarCode}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        />
        <View style={styles.scanOverlay}>
          <View style={styles.scanFrame} />
          <Text style={styles.scanHint}>Apuntá al código QR del juego</Text>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setScanning(false)}>
            <Text style={styles.cancelText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Text style={styles.title}>PICO PARK</Text>
      <Text style={styles.subtitle}>Gamepad — Conectar al servidor</Text>

      <TextInput
        style={styles.input}
        placeholder="192.168.1.10:3000"
        placeholderTextColor="#555"
        value={ip}
        onChangeText={setIp}
        keyboardType="numbers-and-punctuation"
        autoCorrect={false}
        autoCapitalize="none"
        onSubmitEditing={handleConnect}
      />

      <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={handleConnect}>
        <Text style={styles.btnText}>CONECTAR</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={handleScanPress}>
        <Text style={styles.btnText}>ESCANEAR QR</Text>
      </TouchableOpacity>

      <Text style={styles.hint}>
        Abrí el juego en la PC y apuntá con la cámara al código QR que aparece en pantalla.
      </Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0d1a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  title: {
    fontSize: 38,
    fontWeight: 'bold',
    color: '#FFD700',
    letterSpacing: 4,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    marginBottom: 44,
  },
  input: {
    width: '100%',
    backgroundColor: '#16213e',
    color: 'white',
    borderRadius: 10,
    padding: 16,
    fontSize: 20,
    borderWidth: 1,
    borderColor: '#2a2a5a',
    marginBottom: 14,
    textAlign: 'center',
  },
  btn: {
    width: '100%',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  btnPrimary:   { backgroundColor: '#e74c3c' },
  btnSecondary: { backgroundColor: '#2980b9' },
  btnText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    letterSpacing: 1,
  },
  hint: {
    marginTop: 16,
    color: '#555',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  scannerContainer: { flex: 1, backgroundColor: 'black' },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 220,
    height: 220,
    borderWidth: 3,
    borderColor: '#FFD700',
    borderRadius: 12,
    marginBottom: 24,
  },
  scanHint: {
    color: 'white',
    fontSize: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 24,
  },
  cancelBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingVertical: 12,
    paddingHorizontal: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  cancelText: { color: 'white', fontSize: 16 },
});
