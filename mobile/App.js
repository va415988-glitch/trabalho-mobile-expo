import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import GalleryScreen from './src/screens/GalleryScreen';
import MapScreen from './src/screens/MapScreen';

export default function App() {
  const [tab, setTab] = useState('gallery');
  const [mapFocusCoords, setMapFocusCoords] = useState(null);

  const openMapsTabForCoords = useCallback((coords) => {
    setMapFocusCoords(coords);
    setTab('map');
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      <View style={styles.body}>
        {tab === 'gallery' ? (
          <GalleryScreen onOpenMapsForCoords={openMapsTabForCoords} />
        ) : (
          <MapScreen focusCoords={mapFocusCoords} />
        )}
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabButton, tab === 'gallery' && styles.tabButtonActive]}
          onPress={() => setTab('gallery')}
        >
          <Text style={[styles.tabLabel, tab === 'gallery' && styles.tabLabelActive]}>Galeria</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, tab === 'map' && styles.tabButtonActive]}
          onPress={() => setTab('map')}
        >
          <Text style={[styles.tabLabel, tab === 'map' && styles.tabLabelActive]}>Mapa</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  body: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 2,
    borderTopColor: '#000',
    paddingVertical: 6,
    backgroundColor: '#fff',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 2,
    borderRightColor: '#000',
    paddingVertical: 6,
  },
  tabButtonActive: {
    backgroundColor: '#E6F4FE',
  },
  tabLabel: {
    fontSize: 18,
    fontWeight: '800',
    color: '#000',
  },
  tabLabelActive: {
    color: '#000',
    textDecorationLine: 'underline',
  },
});
