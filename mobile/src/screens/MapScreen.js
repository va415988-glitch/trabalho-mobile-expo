import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Image, Platform, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import * as Location from 'expo-location';

import { initPhotosTable, listPhotos } from '../db/photosDb';
import { setLastCoords } from '../utils/locationCache';

function getDefaultRegion() {
  return {
    latitude: -23.55052,
    longitude: -46.633308,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  };
}

function isValidLatLng(latitude, longitude) {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return false;
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) return false;
  if (latitude < -90 || latitude > 90) return false;
  if (longitude < -180 || longitude > 180) return false;
  return true;
}

export default function MapScreen({ focusCoords }) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [region, setRegion] = useState(getDefaultRegion());

  const mapKey = useMemo(() => {
    const lat = Number.isFinite(region.latitude) ? region.latitude : 0;
    const lng = Number.isFinite(region.longitude) ? region.longitude : 0;
    return `${lat.toFixed(5)}:${lng.toFixed(5)}`;
  }, [region.latitude, region.longitude]);

  const { width: windowWidth } = useWindowDimensions();
  const LIST_PADDING = 12;

  const cardWidth = Math.min(560, Math.max(220, windowWidth - LIST_PADDING * 2));

  const cardImageHeight = Math.round(cardWidth * 0.54);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await initPhotosTable();
      const rows = await listPhotos();
      setPhotos(rows);
    } catch (e) {
      Alert.alert('Erro', 'Falha ao carregar dados do mapa.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadInitialRegion = useCallback(async () => {
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        const firstWithCoords = photos.find((p) => isValidLatLng(p.latitude, p.longitude));
        if (firstWithCoords) {
          setRegion({
            latitude: firstWithCoords.latitude,
            longitude: firstWithCoords.longitude,
            latitudeDelta: 0.06,
            longitudeDelta: 0.06,
          });
          setLastCoords({ latitude: firstWithCoords.latitude, longitude: firstWithCoords.longitude });
        }
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setRegion({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.06,
        longitudeDelta: 0.06,
      });
      setLastCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
    } catch (e) {
      const firstWithCoords = photos.find((p) => isValidLatLng(p.latitude, p.longitude));
      if (firstWithCoords) {
        setRegion({
          latitude: firstWithCoords.latitude,
          longitude: firstWithCoords.longitude,
          latitudeDelta: 0.06,
          longitudeDelta: 0.06,
        });
        setLastCoords({ latitude: firstWithCoords.latitude, longitude: firstWithCoords.longitude });
      }
    }
  }, [photos]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!focusCoords) return;
    const { latitude, longitude } = focusCoords;

    if (!isValidLatLng(latitude, longitude)) return;

    setRegion({
      latitude,
      longitude,
      latitudeDelta: 0.06,
      longitudeDelta: 0.06,
    });
    setLastCoords({ latitude, longitude });
  }, [focusCoords]);

  useEffect(() => {
    if (focusCoords && isValidLatLng(focusCoords.latitude, focusCoords.longitude)) {
      return;
    }

    if (photos.length > 0 && Platform.OS !== 'web') {
      loadInitialRegion();
    }
  }, [photos, loadInitialRegion, focusCoords]);

  const markers = useMemo(() => {
    return photos
      .filter((p) => isValidLatLng(p.latitude, p.longitude))
      .map((p) => ({
        id: p.id,
        title: p.title,
        imageUri: p.imageUri,
        latitude: p.latitude,
        longitude: p.longitude,
      }));
  }, [photos]);

  const onPressMarker = useCallback((p) => {
    Alert.alert(p.title, `(${p.latitude.toFixed(4)}, ${p.longitude.toFixed(4)})`);
  }, []);

  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <View style={styles.webHeader}>
          <Text style={styles.headerTitle}>Mapa (web)</Text>
          <Text style={styles.webHint}>O mapa com marcadores funciona apenas no app mobile.</Text>
        </View>

        {loading ? (
          <View style={styles.loadingOverlay}>
            <Text style={styles.loadingText}>Carregando...</Text>
          </View>
        ) : (
          <FlatList
            data={markers}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.card, { width: cardWidth }]}
                onPress={() => onPressMarker(item)}
                activeOpacity={0.85}
              >
                <Image
                  source={{ uri: item.imageUri }}
                  style={[styles.cardImage, { height: cardImageHeight }]}
                />
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.cardCoords}>
                  {item.latitude.toFixed(4)} , {item.longitude.toFixed(4)}
                </Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>Nenhuma imagem com coordenadas</Text>
                <Text style={styles.emptySubtitle}>Cadastre na Galeria para aparecer no mapa.</Text>
              </View>
            }
          />
        )}
      </View>
    );
  }

  const MapView = require('react-native-maps').default;

  const { Callout, Marker } = require('react-native-maps');

  return (
    <View style={styles.container}>
      <MapView key={mapKey} style={styles.map} initialRegion={region}>
        {markers.map((p) => (
          <Marker
            key={String(p.id)}
            coordinate={{ latitude: p.latitude, longitude: p.longitude }}
            title={p.title}
          >
            <Callout tooltip={false} onPress={() => onPressMarker(p)}>
              <View style={styles.callout}>
                <Text style={styles.calloutTitle} numberOfLines={1}>
                  {p.title}
                </Text>
                <Image source={{ uri: p.imageUri }} style={styles.calloutImage} />
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>

      {loading ? (
        <View style={styles.loadingOverlay}>
          <Text style={styles.loadingText}>Carregando mapa...</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  map: { flex: 1 },

  webHeader: { padding: 12, borderBottomWidth: 2, borderBottomColor: '#000', gap: 6 },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#000' },
  webHint: { fontWeight: '800', color: '#333' },

  loadingOverlay: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 3,
    borderColor: '#000',
    borderRadius: 12,
  },
  loadingText: { fontWeight: '900', color: '#000' },

  list: { padding: 12, gap: 12, alignItems: 'flex-start' },

  card: {
    borderWidth: 3,
    borderColor: '#000',
    borderRadius: 16,
    padding: 10,
    backgroundColor: '#fff',
    gap: 8,
    alignSelf: 'flex-start',
  },
  cardImage: {
    width: '100%',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 12,
    backgroundColor: '#eee',
    resizeMode: 'contain',
  },
  cardTitle: { fontSize: 16, fontWeight: '900', color: '#000' },
  cardCoords: { fontWeight: '800', color: '#333' },

  empty: { padding: 20, alignItems: 'center', gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: '#000' },
  emptySubtitle: { fontSize: 14, fontWeight: '700', color: '#333', textAlign: 'center' },

  callout: {
    width: 180,
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: '#000',
    borderRadius: 14,
    padding: 10,
    gap: 8,
  },
  calloutTitle: {
    fontWeight: '900',
    color: '#000',
    fontSize: 16,
  },
  calloutImage: {
    width: '100%',
    height: 150,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#eee',
    resizeMode: 'cover',
  },
});
