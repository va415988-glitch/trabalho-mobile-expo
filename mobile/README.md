# Mobile App (Expo) — Galeria + Mapa

App mobile (Expo / React Native) com:

- **Tela Galeria**
  - listar imagens cadastradas (imagem + título + data)
  - adicionar nova imagem (câmera ou galeria)
  - excluir imagens
  - botão **“Ver no Maps”** em fotos que possuem coordenadas (centraliza a aba **Mapa** no ponto da foto)

- **Tela Mapa**
  - exibir marcadores (mobile) com *callout* mostrando título e miniatura
  - no **web**, o mapa vira uma lista/cards (porque `react-native-maps` não funciona como esperado no web)

- **Persistência local**
  - dados das fotos em **SQLite**
  - imagem copiada/armazenada no storage do app quando suportado

---

## O que você precisa ter

- **Node.js** e **npm**
- (Recomendado) **Expo Go** instalado no celular
- Para testar em dispositivos/emulador: conhecimento básico para abrir o app via Expo

---

## Compatibilidade (importante)

Seu projeto precisa rodar com uma versão compatível do **Expo Go**.

- `expo`: **54.0.34**
- **Expo Go no celular deve ser compatível com SDK 54**

### Como checar o SDK do Expo Go
No celular:
1. Abra o **Expo Go**
2. Procure “Sobre / Settings”
3. Verifique o “SDK x.y.z”

Se o SDK do Expo Go for diferente, você pode ver erro do tipo *“Project incompatible with this version of Expo Go”*.

---

## Como rodar o projeto

> Execute os comandos **dentro da pasta `mobile/`**

### 0) (Opcional) Iniciar com `npx expo start`

```bash
npx expo start
```

Use esse comando para iniciar o Expo manualmente. Depois, no terminal, você pode abrir o app no **Expo Go** (QR code), ou seguir as opções de Web/Android/iOS.

### 1) Instalar dependências

```bash
npm install
```

### 2) Rodar na Web

```bash
npm run web
```

- Geralmente fica em: `http://localhost:8081`

**Observação (web):** o `MapScreen` mostra fallback em forma de lista/cards.

### 3) Rodar no Android (com Expo Go)

```bash
npm run android
```

- Abra o QR code no **Expo Go** no celular.

### 4) Rodar no iOS (se necessário)

```bash
npm run ios
```

---

## Como o app funciona (fluxo completo)

### 1) Tela Galeria
Na Galeria, você pode:

#### A) Adicionar imagem
Ao tocar em **“Adicionar imagem”**, você escolhe:

- **Câmera**: captura uma foto
- **Galeria**: escolhe uma foto existente

Durante esse processo, o app pode solicitar permissões:

- **Câmera**
- **Galeria / mídia**
- **Localização** (para salvar latitude/longitude)

#### B) Capturar coordenadas da foto
A lógica do app tenta associar coordenadas **o mais próximo possível do momento da captura/seleção**:

- ao retornar da câmera/galeria, o app tenta obter a localização naquele instante
- se não conseguir (ou se a localização estiver negada), a foto é salva **sem coordenadas** (`latitude/longitude` ficam `null`)

#### C) Salvar no SQLite + armazenar imagem
Ao clicar em **“Salvar no SQLite”**:

1. a imagem é copiada para o storage do app (quando suportado)
2. uma linha é inserida no SQLite contendo:
   - `title`
   - `imageUri`
   - `latitude` / `longitude` (quando disponíveis)
   - `createdAt`

Depois disso, a lista da Galeria recarrega.

---

### 2) Tela Mapa
O `MapScreen` faz:

1. carregar o SQLite (`listPhotos`)
2. filtrar apenas fotos com coordenadas válidas
3. renderizar marcadores no mapa (mobile)
4. exibir um *callout* com o título e a miniatura ao tocar no marcador

#### Centralizar o mapa em um ponto (botão “Ver no Maps”)
Nas fotos com coordenadas válidas, aparece o botão **“Ver no Maps”**.

Esse botão **não abre nenhum app externo**. Ele:
- muda para a aba **Mapa** dentro do próprio app
- passa a coordenada selecionada para o `MapScreen`
- o `MapScreen` ajusta a região para centralizar no ponto da foto

---

## Permissões (o que acontece se negar)

Ao adicionar imagem, o app pode pedir:

- **Câmera**
- **Galeria / mídia**
- **Localização**

Se você **negar Localização**:
- o app ainda salva a imagem e o título no SQLite
- mas a foto vai aparecer **sem marcador** no Mapa (porque `latitude/longitude` ficam `null`)

---

## Teste sugerido (validação rápida)

1. Abra **Galeria**
2. Toque em **Adicionar imagem**
3. Capture/seleciona uma foto e informe um **título**
4. Salve
5. Vá em **Mapa**
6. Confirme que aparece um marcador no local (se você concedeu localização)
7. Na Galeria, toque em **“Ver no Maps”** e confirme que o mapa centraliza no ponto da foto

---

## Estrutura de código (resumo)

- `src/screens/GalleryScreen.js`: Galeria (lista + modal de adicionar + excluir)
- `src/screens/MapScreen.js`: Mapa (markers + callout; web com fallback)
- `src/db/photosDb.js`: persistência (SQLite; fallback web quando aplicável)
- `src/utils/photoStorage.js`: cópia da imagem para storage do app

---

## Troubleshooting

### “O mapa não aparece no mobile”
- verifique se a foto tem coordenadas (o botão “Ver no Maps” só aparece quando há latitude/longitude)
- confirme se a permissão de localização foi concedida durante a captura/seleção

### “Erro ao rodar”
- confira se instalou dependências em `mobile/` (e não na raiz)
- confira compatibilidade do Expo Go com SDK 54
