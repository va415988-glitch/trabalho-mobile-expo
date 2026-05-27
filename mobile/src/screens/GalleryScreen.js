import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Image, Modal, Platform, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';

import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';

import { createPhoto, deletePhoto, listPhotos, initPhotosTable } from '../db/photosDb';
import { copyImageToAppStorage } from '../utils/photoStorage';
import { isValidCoords } from '../utils/locationCache';

function formatDateIso(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString();
}

function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(message)), ms)
    ),
  ]);
}

function Card({ item, onDelete, onOpenMaps, cardWidth, cardImageHeight }) {
  const hasCoords = isValidCoords({ latitude: item.latitude, longitude: item.longitude });

  return (
    <View
      style={[
        styles.card,
        {
          width: cardWidth,
          maxWidth: cardWidth,
          alignSelf: 'flex-start',
        },
      ]}
    >
      <Image source={{ uri: item.imageUri }} style={[styles.cardImage, { height: cardImageHeight }]} />

      <View style={styles.cardMeta}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.cardDate}>{formatDateIso(item.createdAt)}</Text>
      </View>

      {hasCoords ? (
        <TouchableOpacity style={styles.mapsButton} onPress={onOpenMaps}>
          <Text style={styles.mapsButtonText}>Ver no Maps</Text>
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity style={styles.deleteButton} onPress={onDelete}>
        <Text style={styles.deleteButtonText}>Excluir</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function GalleryScreen({ onOpenMapsForCoords }) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(false);

  const { width: screenWidth } = useWindowDimensions();
  const LIST_HORIZONTAL_PADDING = 12;
  const [listContainerWidth, setListContainerWidth] = useState(null);

  const numColumns = Platform.OS === 'web' ? 1 : 2;

  const cardWidthBase = (listContainerWidth ?? screenWidth) - LIST_HORIZONTAL_PADDING * 2;

  const cardWidth =
    Platform.OS === 'web'
      ? Math.min(560, Math.max(220, cardWidthBase))
      : cardWidthBase / 2;

  
  const cardImageHeight = Math.round(cardWidth * 0.54);

  const [modalVisible, setModalVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [saveStep, setSaveStep] = useState(null);

  const [pickedUri, setPickedUri] = useState(null);
  const [pickedCoords, setPickedCoords] = useState(null);

  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteDebug, setDeleteDebug] = useState(null);

  const requestMediaPermission = useCallback(async () => {
    const res = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!res.granted) return false;
    return true;
  }, []);

  const requestCameraPermission = useCallback(async () => {
    const res = await ImagePicker.requestCameraPermissionsAsync();
    if (!res.granted) return false;
    return true;
  }, []);

  const requestLocationPermission = useCallback(async () => {
    const res = await Location.requestForegroundPermissionsAsync();
    if (!res.granted) return false;
    return true;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await initPhotosTable();
      const rows = await listPhotos();
      setPhotos(rows);
    } catch (e) {
      Alert.alert('Erro', 'Falha ao carregar galeria.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openPicker = useCallback(async (mode) => {
    setPickedUri(null);
    setPickedCoords(null);
    setTitle('');
    setModalVisible(true);
    setBusy(false);
    setSaveStep(null);

    
    if (mode === 'camera') {
      const ok = await requestCameraPermission();
      if (!ok) {
        Alert.alert('Permissão negada', 'Permissão de câmera foi negada.');
        setModalVisible(false);
        return;
      }
    } else {
      const ok = await requestMediaPermission();
      if (!ok) {
        Alert.alert('Permissão negada', 'Permissão de galeria foi negada.');
        setModalVisible(false);
        return;
      }
    }

    const pickerResult =
      mode === 'camera'
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.85,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.85,
          });

    if (pickerResult.canceled) {
      setModalVisible(false);
      return;
    }

    const asset = pickerResult.assets?.[0];
    if (!asset?.uri) {
      Alert.alert('Erro', 'Não foi possível capturar/selecionar imagem.');
      setModalVisible(false);
      return;
    }

    setPickedUri(asset.uri);

    try {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        setPickedCoords(null);
      } else {
        const loc = await withTimeout(
          Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
            timeout: 8000,
            maximumAge: 5000,
          }),
          12000,
          'Tempo esgotado ao obter localização'
        );

        const latitude = loc?.coords?.latitude ?? null;
        const longitude = loc?.coords?.longitude ?? null;

        if (isValidCoords({ latitude, longitude })) {
          setPickedCoords({ latitude, longitude });
        } else {
          setPickedCoords(null);
        }
      }
    } catch {
      setPickedCoords(null);
    }
  }, [requestCameraPermission, requestMediaPermission, requestLocationPermission]);

  const canSave = useMemo(() => {
    if (!pickedUri) return false;
    if (!title.trim()) return false;
    return true;
  }, [pickedUri, title]);

  const onSave = useCallback(async () => {
    if (!canSave || busy) return;

    setBusy(true);
    setSaveStep('Solicitando permissão de localização...');


    const watchdog = setTimeout(() => {
      setSaveStep('Tempo esgotado. Verifique permissões e tente novamente.');
      setModalVisible(true);
      setBusy(false);
    }, 30000);

    try {
      setSaveStep('Obtendo localização...');

      let latitude = null;
      let longitude = null;

      
      if (pickedCoords && isValidCoords(pickedCoords)) {
        latitude = pickedCoords.latitude;
        longitude = pickedCoords.longitude;
      } else {
        const hasPermission = await requestLocationPermission();
        if (!hasPermission) {
          setSaveStep('Salvando sem localização...');
        } else {
          try {
            const loc = await withTimeout(
              Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
                timeout: 8000,
                maximumAge: 5000,
              }),
              12000,
              'Tempo esgotado ao obter localização'
            );

            latitude = loc?.coords?.latitude ?? null;
            longitude = loc?.coords?.longitude ?? null;

            if (isValidCoords({ latitude, longitude })) setPickedCoords({ latitude, longitude });
          } catch {
            setSaveStep('Salvando sem localização...');
          }
        }
      }

      setSaveStep('Copiando imagem...');

      const imageUriToStore = await withTimeout(
        copyImageToAppStorage(pickedUri),
        20000,
        'Tempo esgotado ao copiar imagem'
      );

      setSaveStep('Salvando no SQLite...');
      await withTimeout(
        createPhoto({
          title: title.trim(),
          imageUri: imageUriToStore,
          latitude,
          longitude,
          createdAt: new Date().toISOString(),
        }),
        15000,
        'Tempo esgotado ao salvar no banco'
      );

      setModalVisible(false);
      setPickedUri(null);
      setTitle('');
      setSaveStep(null);
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha ao salvar item no banco.';
      setSaveStep(`Erro: ${msg}`);
      setModalVisible(true);
      Alert.alert('Erro ao salvar', msg);
    } finally {
      clearTimeout(watchdog);
      setBusy(false);
    }
  }, [busy, canSave, load, pickedUri, pickedCoords, title]);


  const onDelete = useCallback(
    (id) => {
      const targetId = Number(id);

      if (Number.isNaN(targetId)) {
        setDeleteDebug(`Erro: ID inválido para excluir (${String(id)})`);
        return;
      }

      setPhotos((prev) => prev.filter((p) => Number(p.id) !== targetId));

      setDeleteBusy(true);
      setDeleteDebug(`Excluindo... ID=${targetId}`);

      void (async () => {
        try {
          const deletedRows = await deletePhoto(targetId);

          await initPhotosTable();
          const rows = await listPhotos();
          setPhotos(rows);

          const stillExists = rows.some((p) => Number(p.id) === targetId);

          if (deletedRows === 0 || stillExists) {
            setDeleteDebug(
              `Falha ao excluir ID=${targetId} deletedRows=${deletedRows} stillExists=${String(
                stillExists
              )}`
            );
          } else {
            setDeleteDebug(`Excluído ID=${targetId} deletedRows=${deletedRows}`);
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          setDeleteDebug(`Erro ao excluir ID=${targetId}: ${msg}`);
        } finally {
          setDeleteBusy(false);
        }
      })();
    },
    [setDeleteBusy, setDeleteDebug]
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Galeria</Text>

        <TouchableOpacity style={styles.addButton} onPress={() => openPicker('gallery')}>
          <Text style={styles.addButtonText}>Adicionar imagem</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <Text style={styles.loadingText}>Carregando...</Text>
      ) : (
        <FlatList
          data={photos}
          keyExtractor={(item) => String(item.id)}
          numColumns={numColumns}
          contentContainerStyle={styles.list}
          columnWrapperStyle={numColumns === 1 ? undefined : styles.columnWrapper}
          renderItem={({ item }) => (
            <Card
              item={item}
              onDelete={() => onDelete(item.id)}
              onOpenMaps={() => onOpenMapsForCoords?.({ latitude: item.latitude, longitude: item.longitude })}
              cardWidth={cardWidth}
              cardImageHeight={cardImageHeight}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Nenhuma imagem cadastrada</Text>
              <Text style={styles.emptySubtitle}>Toque em “Adicionar imagem”.</Text>
              <View style={styles.emptyActions}>
                <Pressable style={styles.choiceButton} onPress={() => openPicker('gallery')}>
                  <Text style={styles.choiceButtonText}>Galeria</Text>
                </Pressable>
                <Pressable style={styles.choiceButton} onPress={() => openPicker('camera')}>
                  <Text style={styles.choiceButtonText}>Câmera</Text>
                </Pressable>
              </View>
            </View>
          }
        />
      )}

      <Modal visible={modalVisible} animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Nova imagem</Text>

            <TouchableOpacity style={styles.modalClose} onPress={() => setModalVisible(false)}>
              <Text style={styles.modalCloseText}>Fechar</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalBody}>
            <View style={styles.choiceRow}>
              <Pressable
                style={[styles.choiceButton, styles.choiceButtonPrimary]}
                onPress={() => openPicker('gallery')}
              >
                <Text style={styles.choiceButtonText}>Galeria</Text>
              </Pressable>
              <Pressable
                style={[styles.choiceButton, styles.choiceButtonPrimary]}
                onPress={() => openPicker('camera')}
              >
                <Text style={styles.choiceButtonText}>Câmera</Text>
              </Pressable>
            </View>

            <View style={styles.previewBox}>
              {pickedUri ? (
                <Image source={{ uri: pickedUri }} style={styles.previewImage} />
              ) : (
                <Text style={styles.previewPlaceholder}>Selecione uma imagem</Text>
              )}
            </View>

            <Text style={styles.label}>Título</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Praia, Museu, Trabalho..."
              value={title}
              onChangeText={setTitle}
            />

            <View style={styles.saveStepBox}>
              <Text style={styles.saveStepText} numberOfLines={3}>
                {busy ? saveStep || 'Salvando...' : ' '}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
              onPress={onSave}
              disabled={!canSave || busy}
            >
              <Text style={styles.saveButtonText}>
                {busy ? 'Salvando...' : 'Salvar no SQLite'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelButton} onPress={() => setModalVisible(false)} disabled={busy}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  header: {
    padding: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#000',
    backgroundColor: '#fff',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    marginBottom: 10,
    color: '#000',
  },

  addButton: {
    backgroundColor: '#E6F4FE',
    borderWidth: 3,
    borderColor: '#000',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  addButtonText: { fontSize: 16, fontWeight: '900', color: '#000' },

  list: { padding: 12, alignItems: 'flex-start' },
  columnWrapper: { justifyContent: 'space-between', alignItems: 'flex-start' },

  card: {
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: '#000',
    borderRadius: 16,
    padding: 10,
    marginBottom: 0,
    gap: 0,
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 12,
    backgroundColor: '#eee',
    resizeMode: 'contain',
  },
  cardMeta: { marginTop: 0 },
  cardTitle: { fontSize: 16, fontWeight: '900', color: '#000' },
  cardDate: { marginTop: 0, fontSize: 12, fontWeight: '800', color: '#333' },

  mapsButton: {
    marginTop: 0,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
    marginBottom: 8,
  },
  mapsButtonText: { fontWeight: '900', color: '#000' },

  deleteButton: {
    marginTop: 0,
    backgroundColor: '#ff6b6b',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  deleteButtonText: { fontWeight: '900', color: '#000' },

  loadingText: { padding: 16, fontSize: 16, fontWeight: '900' },

  empty: { padding: 20, alignItems: 'center', gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '900' },
  emptySubtitle: { fontSize: 14, fontWeight: '700', color: '#333', textAlign: 'center' },
  emptyActions: { flexDirection: 'row', gap: 12, marginTop: 10 },

  choiceRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  choiceButton: {
    flex: 1,
    paddingVertical: 12,
    borderWidth: 3,
    borderColor: '#000',
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceButtonPrimary: { backgroundColor: '#E6F4FE' },
  choiceButtonText: { fontWeight: '900', color: '#000' },

  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeader: { padding: 16, borderBottomWidth: 2, borderBottomColor: '#000', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: 24, fontWeight: '900', color: '#000' },
  modalClose: { paddingVertical: 10, paddingHorizontal: 12, borderWidth: 3, borderColor: '#000', borderRadius: 10, backgroundColor: '#fff' },
  modalCloseText: { fontWeight: '900', color: '#000' },

  modalBody: { padding: 16, gap: 12 },
  previewBox: { width: '100%', height: 240, borderWidth: 3, borderColor: '#000', borderRadius: 16, backgroundColor: '#eee', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  previewImage: { width: '100%', height: '100%', borderRadius: 16, resizeMode: 'contain' },
  previewPlaceholder: { fontWeight: '900', color: '#222' },

  label: { fontSize: 14, fontWeight: '900', color: '#000' },
  input: {
    borderWidth: 3,
    borderColor: '#000',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '800',
    backgroundColor: '#fff',
    color: '#000',
  },

  saveButton: {
    backgroundColor: '#E6F4FE',
    borderWidth: 3,
    borderColor: '#000',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: { fontSize: 16, fontWeight: '900', color: '#000' },

  cancelButton: {
    borderWidth: 3,
    borderColor: '#000',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  cancelButtonText: { fontSize: 16, fontWeight: '900', color: '#000' },

  debugText: {
    marginTop: 6,
    marginHorizontal: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    fontWeight: '900',
    color: '#000',
    backgroundColor: '#fff3cd',
    borderWidth: 3,
    borderColor: '#000',
    borderRadius: 12,
  },
});
