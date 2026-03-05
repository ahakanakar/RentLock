# 🔐 RentLock — Decentralized Equipment Rental Protocol

> Stellar Soroban üzerinde çalışan, güvenilir ve şeffaf bir ekipman kiralama protokolü.

RentLock, ekipman sahipleri ile kiracılar arasında **akıllı kontrat tabanlı** bir kiralama sözleşmesi oluşturur. Depozito escrow'da tutulur, kiralama süresi oracle tarafından takip edilir ve anlaşmazlıklar zincir üzerinde çözümlenir.

---

## 📐 Mimari Genel Bakış

```
┌─────────────┐     ┌─────────────┐     ┌──────────────────┐
│   Frontend   │────▶│   Oracle    │────▶│  Soroban Smart   │
│  (React UI)  │     │  (Node.js)  │     │    Contract      │
└─────────────┘     └─────────────┘     └──────────────────┘
       │                   │                      │
   Freighter          Stellar SDK           On-chain Logic
   Wallet             RPC Calls          Escrow / Dispute
```

---

## 📁 Proje Yapısı

```
RentLock/
├── contracts/                  # Soroban akıllı kontrat (Rust)
│   └── rentlock/
│       ├── Cargo.toml          # Crate bağımlılıkları & metadata
│       ├── src/
│       │   ├── lib.rs          # Kontrat giriş noktası, public fonksiyonlar
│       │   ├── rental.rs       # Kiralama oluşturma, başlatma, bitirme mantığı
│       │   ├── escrow.rs       # Depozito kilitleme, serbest bırakma, iade
│       │   ├── dispute.rs      # Anlaşmazlık açma ve çözümleme
│       │   ├── types.rs        # Struct & enum tanımları (RentalAgreement, Status vb.)
│       │   ├── errors.rs       # Özel hata tipleri (ContractError enum)
│       │   ├── events.rs       # Zincir üstü event tanımları
│       │   └── storage.rs      # Ledger storage yardımcı fonksiyonları
│       └── tests/
│           ├── test_rental.rs  # Kiralama akış testleri
│           ├── test_escrow.rs  # Escrow mekanizma testleri
│           └── test_dispute.rs # Dispute çözüm testleri
│
├── oracle/                     # Node.js Oracle Backend
│   ├── package.json            # Node.js bağımlılıkları
│   ├── .env.example            # Ortam değişkenleri şablonu
│   └── src/
│       ├── index.js            # Express sunucu giriş noktası
│       ├── sorobanClient.js    # Soroban RPC bağlantı istemcisi
│       ├── paymentVerifier.js  # Ödeme doğrulama & kontrat çağrıları
│       └── scheduler.js        # Zamanlayıcı (cron): süre aşımı kontrolleri
│
├── frontend/                   # React Kullanıcı Arayüzü (Vite)
│   ├── package.json            # Frontend bağımlılıkları
│   ├── index.html              # HTML giriş sayfası
│   ├── vite.config.js          # Vite yapılandırması
│   ├── .env.example            # Frontend ortam değişkenleri şablonu
│   └── src/
│       ├── main.jsx            # React DOM render giriş noktası
│       ├── App.jsx             # Ana uygulama bileşeni & yönlendirme
│       ├── index.css           # Global stiller
│       ├── components/
│       │   ├── OwnerPanel.jsx  # Ekipman sahibi paneli (listeleme, durum takibi)
│       │   ├── RenterPanel.jsx # Kiracı paneli (kiralama, depozito, iade)
│       │   └── AdminPanel.jsx  # Yönetici/hakem paneli (dispute çözümleme)
│       ├── hooks/
│       │   ├── useWallet.js    # Freighter cüzdan bağlantı hook'u
│       │   └── useContract.js  # Kontrat okuma/yazma hook'u
│       └── services/
│           └── soroban.js      # Soroban SDK sarmalayıcı fonksiyonları
│
├── demo/                       # Demo Senaryosu
│   ├── SCENARIO.md             # Adım adım demo senaryosu dokümantasyonu
│   ├── setup.sh                # Testnet hesap & deploy hazırlık scripti
│   └── run_demo.sh             # Uçtan uca demo çalıştırma scripti
│
├── Cargo.toml                  # Cargo workspace tanımı
├── .gitignore                  # Git ignore kuralları
└── README.md                   # Bu dosya
```

---

## 🧩 Bileşen Detayları

### 1. Soroban Akıllı Kontrat (`contracts/rentlock/`)

Tüm iş mantığını zincir üzerinde tutan Rust/Soroban kontratı.

| Dosya | Açıklama |
|-------|----------|
| `lib.rs` | Kontratın ana giriş noktası. `create_rental`, `start_rental`, `end_rental`, `open_dispute`, `resolve_dispute` gibi public fonksiyonları dışarıya açar. |
| `rental.rs` | Kiralama sözleşmesi oluşturma, başlatma ve sonlandırma iş mantığı. Kiralama süresini, günlük ücreti ve tarafları yönetir. |
| `escrow.rs` | Depozito yönetimi. Kiracıdan alınan depozitoyu kontrat adresinde kilitler, kiralama tamamlanınca serbest bırakır veya hasar durumunda sahibine aktarır. |
| `dispute.rs` | Anlaşmazlık çözüm mekanizması. Taraflardan biri dispute açabilir; admin/hakem rolündeki adres nihai kararı verir. |
| `types.rs` | `RentalAgreement`, `RentalStatus`, `DisputeInfo` gibi veri yapıları ve enum tanımları. |
| `errors.rs` | `ContractError` enum'u: `NotAuthorized`, `RentalNotFound`, `InvalidState`, `InsufficientDeposit` gibi hata kodları. |
| `events.rs` | Zincir üstü event'ler: `RentalCreated`, `RentalStarted`, `RentalEnded`, `DisputeOpened`, `DisputeResolved`. Frontend ve oracle bu event'leri dinler. |
| `storage.rs` | Soroban ledger storage ile etkileşim yardımcıları. Kiralama kayıtlarını persistent/temporary storage'da saklar ve sorgular. |

### 2. Oracle Backend (`oracle/`)

Zincir dışı (off-chain) işlemleri yöneten Node.js servisi.

| Dosya | Açıklama |
|-------|----------|
| `index.js` | Express.js sunucusu. REST API endpoint'lerini tanımlar, webhook'ları dinler. |
| `sorobanClient.js` | `@stellar/stellar-sdk` kullanarak Soroban RPC node'una bağlanır. Transaction oluşturma, imzalama ve gönderme işlemlerini soyutlar. |
| `paymentVerifier.js` | Kiracının ödeme yaptığını doğrular ve kontrat üzerinde `confirm_payment` fonksiyonunu çağırır. |
| `scheduler.js` | `node-cron` ile periyodik kontroller yapar: süre aşımına uğramış kiralamaları tespit eder, otomatik penaltı uygular. |

### 3. React Frontend (`frontend/`)

Vite ile oluşturulan 3 panelli kullanıcı arayüzü.

| Dosya | Açıklama |
|-------|----------|
| `main.jsx` | React uygulamasını DOM'a render eder. |
| `App.jsx` | Ana layout: sekme/tab yapısıyla Owner, Renter ve Admin panellerini organize eder. |
| `index.css` | Global CSS değişkenleri, tema renkleri ve temel stiller. |
| `OwnerPanel.jsx` | **Ekipman Sahibi Paneli** — Yeni ekipman listeleme, aktif kiralama durumlarını görme, gelir takibi. |
| `RenterPanel.jsx` | **Kiracı Paneli** — Mevcut ekipmanları görüntüleme, kiralama başlatma, depozito yatırma, ekipmanı iade etme. |
| `AdminPanel.jsx` | **Yönetici Paneli** — Açık dispute'ları listeleme, kanıtları inceleme, dispute çözümleme (depozito iadesi veya sahibine aktarma). |
| `useWallet.js` | Freighter cüzdan bağlantısını yöneten React hook'u. Bağlanma, adres alma, imzalama. |
| `useContract.js` | Kontrat fonksiyonlarını çağırmak için React hook'u. Read/write işlemlerini soyutlar. |
| `soroban.js` | Stellar SDK üzerinden kontrat etkileşim fonksiyonları: `invokeContract`, `getContractData`, transaction oluşturma. |

### 4. Demo Senaryosu (`demo/`)

Projeyi uçtan uca test etmek için hazır senaryo.

| Dosya | Açıklama |
|-------|----------|
| `SCENARIO.md` | Demo senaryosunun adım adım açıklaması: hesap oluşturma → ekipman listeleme → kiralama → iade → dispute akışı. |
| `setup.sh` | Stellar Testnet'te hesap oluşturma, Friendbot ile fonlama ve kontratı deploy etme scripti. |
| `run_demo.sh` | Tüm demo akışını otomatik çalıştıran script: CLI üzerinden kontratı çağırarak senaryoyu baştan sona oynatır. |

### 5. Kök Dosyalar

| Dosya | Açıklama |
|-------|----------|
| `Cargo.toml` | Cargo workspace tanımı. `contracts/rentlock` crate'ini workspace üyesi olarak içerir. |
| `.gitignore` | `target/`, `node_modules/`, `.env`, `*.wasm` gibi dosyaları Git'ten hariç tutar. |
| `README.md` | Proje dokümantasyonu (bu dosya). |

---

## 🔄 Kiralama Akışı

```
0. Admin          → initialize()         → Kontratı başlatır (admin + USDC adresi)
1. Ekipman Sahibi → create_rental()      → Ekipmanı listeler (fiyat, depozito)
2. Kiracı         → deposit()            → Depozitoyu kontrata kilitler (USDC)
3. Ekipman Sahibi → start_rental()       → Kiralama başlar, zaman damgası kaydedilir
4. Sahip/Kiracı   → submit_proof()       → Teslim anı fotoğraf hash'i zincire yazılır
5. Sahip/Kiracı   → end_rental()         → İade hash'i ile teslim hash'i karşılaştırılır
   5a. Eşleşirse  →                      → Depozito kiracıya iade edilir ✅
   5b. Uyuşmazsa  →                      → Depozito sahibine aktarılır ⚠️
6. Herkes         → get_status()         → Kiralama durumunu sorgular
```

---

## 🛠️ Gereksinimler

| Araç | Versiyon | Kullanım |
|------|----------|----------|
| Rust | 1.74+ | Soroban kontrat geliştirme |
| Stellar CLI | 22.x+ | Kontrat build, deploy, invoke |
| Node.js | 18+ | Oracle backend |
| npm/yarn | — | Paket yönetimi |
| Freighter | — | Tarayıcı cüzdan eklentisi |

---

## 🚀 Deploy Rehberi (Stellar Testnet)

### 1. Gerekli Araçları Kur

```bash
# Rust kur
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# WASM target ekle
rustup target add wasm32-unknown-unknown

# Stellar CLI kur
cargo install --locked stellar-cli --features opt
```

### 2. Testnet Hesabı Oluştur

```bash
# Yeni bir anahtar çifti oluştur
stellar keys generate --global deployer --network testnet

# Friendbot ile fonla (otomatik 10.000 XLM)
stellar keys fund deployer --network testnet

# Adresini gör
stellar keys address deployer
```

### 3. Kontratı Derle

```bash
# Proje kök dizininde
stellar contract build
# Çıktı: target/wasm32-unknown-unknown/release/rentlock.wasm
```

### 4. Kontratı Deploy Et

```bash
# Testnet'e deploy et
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/rentlock.wasm \
  --source deployer \
  --network testnet

# Çıktı: CONTRACT_ID (örn: CABC...XYZ)
```

### 5. Kontratı Initialize Et

```bash
# USDC Testnet SAC adresi ile initialize et
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source deployer \
  --network testnet \
  -- \
  initialize \
  --admin <DEPLOYER_ADDRESS> \
  --token_address <USDC_SAC_ADDRESS>
```

### 6. Fonksiyonları Test Et

```bash
# Yeni kiralama oluştur
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source deployer \
  --network testnet \
  -- \
  create_rental \
  --owner <OWNER_ADDRESS> \
  --equipment_id "DRONE-001" \
  --daily_price 10000000 \
  --deposit_amount 50000000

# Durum sorgula
stellar contract invoke \
  --id <CONTRACT_ID> \
  --network testnet \
  -- \
  get_status \
  --rental_id 1
```

---

## 📝 Notlar

- Soroban akıllı kontrat kodu tamamlanmıştır (`contracts/rentlock/src/`)
- USDC miktarları 7 ondalık basamak kullanır (1 USDC = 10_000_000)
- Geliştirme sırası: **Kontrat ✅ → Oracle → Frontend → Demo**
- Testnet üzerinde çalışılacaktır (Stellar Testnet)
