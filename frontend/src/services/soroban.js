/**
 * RentLock — Stellar Soroban Kontrat Servisi
 *
 * Gerçek Stellar Testnet kontratına bağlanır.
 * Mock data KULLANMAZ — tüm veriler zincirden gelir.
 * Freighter cüzdan ile transaction imzalama.
 */

import * as StellarSdk from "@stellar/stellar-sdk";
import * as rpc from "@stellar/stellar-sdk/rpc";
import { signTransaction } from "@stellar/freighter-api";

// ─── Sabitler ───────────────────────────────────────────

const CONTRACT_ID = "CCAASSOQIDBRZYLQVNPT3W77UU5GPTYSI4PYAD6X5XFGOLRHZWIH2NIY";
const RPC_URL = "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE = StellarSdk.Networks.TESTNET;

/** Soroban RPC sunucusu */
const server = new rpc.Server(RPC_URL);

// ─── Durum ve Yardımcılar ───────────────────────────────

export const STATUS_MAP = {
    0: { label: "Oluşturuldu", color: "bg-blue-500/20 text-blue-400", icon: "📋" },
    1: { label: "Depozito Yatırıldı", color: "bg-yellow-500/20 text-yellow-400", icon: "💰" },
    2: { label: "Aktif", color: "bg-emerald-500/20 text-emerald-400", icon: "✅" },
    3: { label: "Tamamlandı", color: "bg-gray-500/20 text-gray-400", icon: "🏁" },
    4: { label: "Anlaşmazlık", color: "bg-red-500/20 text-red-400", icon: "⚠️" },
};

export function formatUSDC(amount) {
    return (Number(amount) / 10_000_000).toFixed(2);
}

export function formatAddress(addr) {
    if (!addr || addr.length < 10) return addr || "—";
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

export function timeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}sn önce`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}dk önce`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}sa önce`;
    return `${Math.floor(seconds / 86400)}g önce`;
}

// ─── Event takibi (lokal — başarılı tx'lerden oluşur) ───

let localEvents = [];

export function getEvents() {
    return [...localEvents].sort((a, b) => b.time - a.time).slice(0, 10);
}

function addEvent(type, rentalId, detail) {
    localEvents.push({ type, rental_id: rentalId, time: Date.now(), detail });
}

// ─── ScVal Dönüşüm Yardımcıları ────────────────────────

function toScAddress(publicKey) {
    return new StellarSdk.Address(publicKey).toScVal();
}

function toScString(value) {
    return StellarSdk.nativeToScVal(value, { type: "string" });
}

function toScU64(value) {
    return StellarSdk.nativeToScVal(BigInt(value), { type: "u64" });
}

function toScI128(value) {
    return StellarSdk.nativeToScVal(BigInt(value), { type: "i128" });
}

function toScBytes32(hexOrBytes) {
    let bytes;
    if (typeof hexOrBytes === "string") {
        bytes = new Uint8Array(hexOrBytes.match(/.{2}/g).map((b) => parseInt(b, 16)));
    } else {
        bytes = hexOrBytes;
    }
    return StellarSdk.xdr.ScVal.scvBytes(bytes);
}

// ─── ScVal → JS Parse ───────────────────────────────────

function parseScVal(scVal) {
    if (!scVal) return null;
    const type = scVal.switch().name;

    switch (type) {
        case "scvVoid":
            return null;
        case "scvBool":
            return scVal.b();
        case "scvU32":
            return scVal.u32();
        case "scvI32":
            return scVal.i32();
        case "scvU64":
            return Number(scVal.u64());
        case "scvI64":
            return Number(scVal.i64());
        case "scvU128": {
            const parts = scVal.u128();
            return Number(parts.lo()) + Number(parts.hi()) * 2n ** 64n;
        }
        case "scvI128": {
            const parts = scVal.i128();
            return Number(parts.lo()) + Number(parts.hi()) * 2n ** 64n;
        }
        case "scvString":
            return scVal.str().toString();
        case "scvSymbol":
            return scVal.sym().toString();
        case "scvBytes":
            return Array.from(scVal.bytes())
                .map((b) => b.toString(16).padStart(2, "0"))
                .join("");
        case "scvAddress": {
            try {
                return StellarSdk.Address.fromScVal(scVal).toString();
            } catch {
                return "unknown";
            }
        }
        case "scvMap": {
            const obj = {};
            for (const entry of scVal.map()) {
                const key = parseScVal(entry.key());
                obj[key] = parseScVal(entry.val());
            }
            return obj;
        }
        case "scvVec": {
            return scVal.vec().map(parseScVal);
        }
        default:
            return `[${type}]`;
    }
}

// ─── Transaction Oluşturma & İmzalama ──────────────────

/**
 * Kontrat çağrısı transaction'ı oluşturur, simüle eder,
 * Freighter ile imzalatır ve ağa gönderir.
 *
 * @param {string} functionName — Kontrat fonksiyon adı
 * @param {Array} args — ScVal argümanları
 * @param {string} publicKey — İmzacı public key (Freighter'dan)
 * @returns {Promise<any>} Transaction sonucu
 */
async function callContract(functionName, args, publicKey) {
    console.log(`📡 [Soroban] Kontrat çağrısı: ${functionName}`);

    try {
        // 1. Hesap bilgilerini al
        const account = await server.getAccount(publicKey);

        // 2. Ham transaction oluştur (footprint olmadan)
        const contract = new StellarSdk.Contract(CONTRACT_ID);
        const rawTx = new StellarSdk.TransactionBuilder(account, {
            fee: "1000000", // Soroban için yüksek fee gerekli
            networkPassphrase: NETWORK_PASSPHRASE,
        })
            .addOperation(contract.call(functionName, ...args))
            .setTimeout(60)
            .build();

        // 3. server.prepareTransaction: simüle et + footprint ekle + hazır Transaction döndür
        // SDK v13'te bu tek çağrı tüm assembly işini yapar
        console.log(`⏳ [Soroban] Transaction hazırlanıyor (prepareTransaction)...`);
        let preparedTx;
        try {
            preparedTx = await server.prepareTransaction(rawTx);
        } catch (prepErr) {
            console.error(`❌ [Soroban] prepareTransaction hatası:`, prepErr);
            throw new Error(`Kontrat simülasyon hatası: ${prepErr.message}`);
        }

        // 4. Transaction'ı base64 XDR string'e çevir
        const xdrString = preparedTx.toXDR("base64");
        console.log(`📦 [Soroban] XDR hazır (${xdrString.length} karakter)`);

        // 5. Freighter API v2 ile imzala
        // v2'de network parametresi "TESTNET" string olarak geçiyor
        console.log(`🔏 [Soroban] Freighter imza isteniyor...`);
        let signedXdr;
        try {
            const signResult = await signTransaction(xdrString, {
                networkPassphrase: NETWORK_PASSPHRASE,
                network: "TESTNET",
            });
            // Freighter v2 dönüşü: { signedTxXdr: string } veya doğrudan string
            signedXdr =
                signResult && typeof signResult === "object" && signResult.signedTxXdr
                    ? signResult.signedTxXdr
                    : typeof signResult === "string"
                        ? signResult
                        : null;
            if (!signedXdr) throw new Error("Freighter geçersiz bir yanıt döndürdü");
        } catch (signErr) {
            if (signErr.message?.includes("geçersiz")) throw signErr;
            throw new Error(`İmzalama iptal edildi veya başarısız: ${signErr.message}`);
        }

        console.log(`✍️ [Soroban] İmzalı XDR alındı`);

        // 6. İmzalı XDR'ı parse et ve ağa gönder
        const signedTx = StellarSdk.TransactionBuilder.fromXDR(
            signedXdr,
            NETWORK_PASSPHRASE
        );
        console.log(`🚀 [Soroban] Transaction gönderiliyor...`);
        const sendResponse = await server.sendTransaction(signedTx);

        if (sendResponse.status === "ERROR") {
            const detail = JSON.stringify(sendResponse.errorResult ?? sendResponse);
            console.error(`❌ [Soroban] Gönderim hatası:`, detail);
            throw new Error(`Transaction reddedildi: ${detail}`);
        }

        // 7. Onay bekle
        console.log(`⏳ [Soroban] Onay bekleniyor... Hash: ${sendResponse.hash}`);
        const result = await waitForTransaction(sendResponse.hash);
        console.log(`✅ [Soroban] ${functionName} başarılı!`);
        return result;
    } catch (error) {
        console.error(`❌ [Soroban] ${functionName} başarısız:`, error.message);
        throw error;
    }
}

/**
 * Read-only kontrat sorgusu — Freighter imzası gerekmez.
 * Sadece simülasyon yapar, transaction göndermez.
 *
 * @param {string} functionName — Kontrat fonksiyon adı
 * @param {Array} args — ScVal argümanları
 * @param {string} publicKey — Kaynak hesap (fee hesabı için)
 * @returns {Promise<any>} Parse edilmiş sonuç
 */
async function queryContract(functionName, args, publicKey) {
    try {
        const account = await server.getAccount(publicKey);
        const contract = new StellarSdk.Contract(CONTRACT_ID);

        const tx = new StellarSdk.TransactionBuilder(account, {
            fee: StellarSdk.BASE_FEE,
            networkPassphrase: NETWORK_PASSPHRASE,
        })
            .addOperation(contract.call(functionName, ...args))
            .setTimeout(30)
            .build();

        const simulated = await server.simulateTransaction(tx);

        if (rpc.Api.isSimulationError(simulated)) {
            return null; // Veri bulunamadı (örn: olmayan rental ID)
        }

        return simulated.result?.retval ? parseScVal(simulated.result.retval) : null;
    } catch (error) {
        console.error(`❌ [Soroban] ${functionName} sorgusu başarısız:`, error.message);
        return null;
    }
}

/**
 * Transaction onayını bekler (polling).
 */
async function waitForTransaction(hash) {
    const maxAttempts = 30;
    const delay = 2000;

    for (let i = 0; i < maxAttempts; i++) {
        try {
            const result = await server.getTransaction(hash);
            if (result.status === "SUCCESS") return result;
            if (result.status === "FAILED") {
                throw new Error(`Transaction başarısız oldu`);
            }
        } catch (error) {
            if (error.message?.includes("başarısız")) throw error;
        }
        console.log(`⏳ [Soroban] Bekleniyor... (${i + 1}/${maxAttempts})`);
        await new Promise((r) => setTimeout(r, delay));
    }

    throw new Error("Transaction zaman aşımı");
}

// ─── Public API: Kontrat Fonksiyonları ──────────────────

/**
 * Kontratdaki tüm kiralamaları okur.
 * Sıralı get_status çağrılarıyla ID 1'den başlayarak tarar.
 *
 * @param {string} publicKey — Sorgulayan hesap
 * @returns {Promise<Array>} Kiralama listesi
 */
export async function getEquipments(publicKey) {
    if (!publicKey) return [];
    console.log(`🔍 [Soroban] Kiralama listesi çekiliyor...`);

    const rentals = [];

    for (let id = 1; id <= 50; id++) {
        const result = await queryContract("get_status", [toScU64(id)], publicKey);
        if (!result) break; // Bu ID'de kiralama yok → son

        // Parse edilen struct'a rental_id ekle
        result.rental_id = id;

        // Status alanını sayıya çevir (enum variant olabilir)
        if (typeof result.status === "string") {
            const statusNames = ["Created", "Deposited", "Active", "Completed", "Disputed"];
            result.status = statusNames.indexOf(result.status);
            if (result.status === -1) result.status = 0;
        }

        rentals.push(result);
    }

    console.log(`✅ [Soroban] ${rentals.length} kiralama bulundu`);
    return rentals;
}

/**
 * Yeni kiralama oluşturur — create_rental kontrat çağrısı.
 * Freighter imza ister.
 */
export async function createRental(publicKey, equipmentId, dailyPrice, depositAmount) {
    const args = [
        toScAddress(publicKey),
        toScString(equipmentId),
        toScI128(Math.round(dailyPrice * 10_000_000)),
        toScI128(Math.round(depositAmount * 10_000_000)),
    ];

    const result = await callContract("create_rental", args, publicKey);
    addEvent("RentalCreated", "?", `${equipmentId} listelendi`);
    return result;
}

/**
 * Depozito yatırır — deposit kontrat çağrısı.
 * Kiracının USDC'si kontrata kilitlenir.
 */
export async function depositRental(publicKey, rentalId) {
    const args = [
        toScAddress(publicKey),
        toScU64(rentalId),
    ];

    const result = await callContract("deposit", args, publicKey);
    addEvent("DepositMade", rentalId, `Depozito kilitledi`);
    return result;
}

/**
 * Kiralamayı başlatır — start_rental kontrat çağrısı.
 * Ekipman sahibi tarafından çağrılır.
 */
export async function startRental(publicKey, rentalId) {
    const args = [
        toScAddress(publicKey),
        toScU64(rentalId),
    ];

    const result = await callContract("start_rental", args, publicKey);
    addEvent("RentalStarted", rentalId, `Kiralama başladı`);
    return result;
}

/**
 * Teslim kanıtı gönderir — submit_proof kontrat çağrısı.
 * Rastgele bir SHA-256 hash üretir (demo amaçlı).
 */
export async function submitProof(publicKey, rentalId) {
    // Demo: rastgele 32 byte hash üret
    const randomHash = new Uint8Array(32);
    crypto.getRandomValues(randomHash);
    const hashHex = Array.from(randomHash)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

    const args = [
        toScAddress(publicKey),
        toScU64(rentalId),
        toScBytes32(randomHash),
    ];

    const result = await callContract("submit_proof", args, publicKey);
    addEvent("ProofSubmitted", rentalId, `Hash: ${hashHex.slice(0, 16)}...`);
    return result;
}

/**
 * Kiralamayı sonlandırır — end_rental kontrat çağrısı.
 * isDisputed=true ise farklı hash gönderir (anlaşmazlık simülasyonu).
 */
export async function endRental(publicKey, rentalId, isDisputed = false) {
    let returnHash;
    if (isDisputed) {
        // Farklı hash → anlaşmazlık
        returnHash = new Uint8Array(32);
        crypto.getRandomValues(returnHash);
    } else {
        // Aynı hash'i almak için kontratdan oku
        const rental = await queryContract("get_status", [toScU64(rentalId)], publicKey);
        if (rental && rental.proof_hash) {
            returnHash = new Uint8Array(
                rental.proof_hash.match(/.{2}/g).map((b) => parseInt(b, 16))
            );
        } else {
            returnHash = new Uint8Array(32);
        }
    }

    const args = [
        toScAddress(publicKey),
        toScU64(rentalId),
        toScBytes32(returnHash),
    ];

    const result = await callContract("end_rental", args, publicKey);
    if (isDisputed) {
        addEvent("DisputeOpened", rentalId, `Hash uyuşmazlığı — depozito sahibine`);
    } else {
        addEvent("RentalEnded", rentalId, `Kiralama tamamlandı — depozito iade`);
    }
    return result;
}

/**
 * Tek bir kiralamanın durumunu sorgular.
 */
export async function getRentalStatus(publicKey, rentalId) {
    return await queryContract("get_status", [toScU64(rentalId)], publicKey);
}
