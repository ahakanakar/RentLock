/**
 * ============================================
 * RentLock Oracle — Soroban RPC İstemcisi
 * ============================================
 *
 * Stellar JS SDK kullanarak Soroban RPC node'una bağlanır.
 * Transaction oluşturma, imzalama ve kontrat çağırma
 * işlemlerini soyutlar.
 */

import * as StellarSdk from "@stellar/stellar-sdk";
import * as rpc from "@stellar/stellar-sdk/rpc";

// ─── Yapılandırma ───────────────────────────────────────

const RPC_URL = process.env.SOROBAN_RPC_URL;
const NETWORK_PASSPHRASE = process.env.NETWORK_PASSPHRASE;
const CONTRACT_ID = process.env.CONTRACT_ID;
const ORACLE_SECRET_KEY = process.env.ORACLE_SECRET_KEY;

// ─── İstemciler ─────────────────────────────────────────

/** Soroban RPC sunucusuna bağlantı */
const server = new rpc.Server(RPC_URL);

/** Oracle cüzdanı (kontrat çağrıları için imza atar) */
const oracleKeypair = StellarSdk.Keypair.fromSecret(ORACLE_SECRET_KEY);

/**
 * Oracle hesabının genel adresini döndürür.
 * @returns {string} Stellar public key
 */
export function getOraclePublicKey() {
    return oracleKeypair.publicKey();
}

/**
 * Kontrat fonksiyonu çağırır ve sonucu döndürür.
 *
 * @param {string} functionName — Çağrılacak kontrat fonksiyon adı
 * @param {StellarSdk.xdr.ScVal[]} args — Fonksiyon argümanları (ScVal formatında)
 * @returns {Promise<any>} İşlem sonucu
 */
export async function invokeContract(functionName, args = []) {
    console.log(`📡 [Soroban] Kontrat çağrısı: ${functionName}`);

    try {
        // Oracle hesap bilgilerini al
        const account = await server.getAccount(oracleKeypair.publicKey());

        // Kontrat çağrısı operasyonu oluştur
        const contract = new StellarSdk.Contract(CONTRACT_ID);
        const operation = contract.call(functionName, ...args);

        // Transaction oluştur
        let transaction = new StellarSdk.TransactionBuilder(account, {
            fee: StellarSdk.BASE_FEE,
            networkPassphrase: NETWORK_PASSPHRASE,
        })
            .addOperation(operation)
            .setTimeout(60)
            .build();

        // Transaction'ı simüle et (gas hesaplama)
        console.log(`⏳ [Soroban] Simülasyon yapılıyor...`);
        const simulated = await server.simulateTransaction(transaction);

        if (rpc.Api.isSimulationError(simulated)) {
            console.error(`❌ [Soroban] Simülasyon hatası:`, simulated.error);
            throw new Error(`Simülasyon hatası: ${simulated.error}`);
        }

        // Simülasyon sonucuyla transaction'ı hazırla
        const preparedTx = rpc.assembleTransaction(
            transaction,
            simulated
        );
        preparedTx.sign(oracleKeypair);

        // Transaction'ı gönder
        console.log(`🚀 [Soroban] Transaction gönderiliyor...`);
        const sendResponse = await server.sendTransaction(preparedTx.build());

        if (sendResponse.status === "ERROR") {
            console.error(`❌ [Soroban] Gönderim hatası:`, sendResponse);
            throw new Error(`Transaction gönderim hatası`);
        }

        // Sonucu bekle
        console.log(
            `⏳ [Soroban] Transaction onay bekleniyor... Hash: ${sendResponse.hash}`
        );
        const txResult = await waitForTransaction(sendResponse.hash);

        console.log(`✅ [Soroban] ${functionName} başarılı!`);
        return txResult;
    } catch (error) {
        console.error(
            `❌ [Soroban] ${functionName} çağrısı başarısız:`,
            error.message
        );
        throw error;
    }
}

/**
 * Read-only kontrat fonksiyonu çağırır (transaction göndermeden).
 * get_status gibi sadece veri okuyan fonksiyonlar için kullanılır.
 *
 * @param {string} functionName — Çağrılacak kontrat fonksiyon adı
 * @param {StellarSdk.xdr.ScVal[]} args — Fonksiyon argümanları
 * @returns {Promise<StellarSdk.xdr.ScVal>} Simülasyon sonucu
 */
export async function queryContract(functionName, args = []) {
    console.log(`🔍 [Soroban] Read-only sorgu: ${functionName}`);

    try {
        const account = await server.getAccount(oracleKeypair.publicKey());
        const contract = new StellarSdk.Contract(CONTRACT_ID);
        const operation = contract.call(functionName, ...args);

        const transaction = new StellarSdk.TransactionBuilder(account, {
            fee: StellarSdk.BASE_FEE,
            networkPassphrase: NETWORK_PASSPHRASE,
        })
            .addOperation(operation)
            .setTimeout(30)
            .build();

        const simulated = await server.simulateTransaction(transaction);

        if (rpc.Api.isSimulationError(simulated)) {
            console.error(`❌ [Soroban] Sorgu hatası:`, simulated.error);
            throw new Error(`Sorgu hatası: ${simulated.error}`);
        }

        console.log(`✅ [Soroban] ${functionName} sorgusu başarılı`);
        return simulated.result?.retval;
    } catch (error) {
        console.error(
            `❌ [Soroban] ${functionName} sorgusu başarısız:`,
            error.message
        );
        throw error;
    }
}

/**
 * Transaction'ın tamamlanmasını bekler.
 * Soroban transaction'ları asenkron çalışır, bu fonksiyon
 * sonucu polling ile takip eder.
 *
 * @param {string} hash — Transaction hash
 * @returns {Promise<any>} Transaction sonucu
 */
async function waitForTransaction(hash) {
    const maxAttempts = 30;
    const delay = 2000; // 2 saniye

    for (let i = 0; i < maxAttempts; i++) {
        try {
            const result = await server.getTransaction(hash);

            if (result.status === "SUCCESS") {
                return result;
            } else if (result.status === "FAILED") {
                throw new Error(`Transaction başarısız: ${JSON.stringify(result)}`);
            }

            // NOT_FOUND — henüz işlenmedi, tekrar dene
            console.log(
                `⏳ [Soroban] Bekleniyor... (${i + 1}/${maxAttempts})`
            );
        } catch (error) {
            if (error.message?.includes("Transaction başarısız")) throw error;
            // getTransaction hatası — muhtemelen henüz bulunamadı
        }

        await new Promise((resolve) => setTimeout(resolve, delay));
    }

    throw new Error(`Transaction zaman aşımı: ${hash}`);
}

/**
 * Native Stellar tiplerine dönüşüm yardımcıları.
 * Kontrat çağrılarında argüman oluşturmak için kullanılır.
 */
export const ScVal = {
    /** u64 değeri oluşturur */
    u64: (value) => StellarSdk.nativeToScVal(value, { type: "u64" }),

    /** i128 değeri oluşturur */
    i128: (value) => StellarSdk.nativeToScVal(value, { type: "i128" }),

    /** Address değeri oluşturur */
    address: (value) => new StellarSdk.Address(value).toScVal(),

    /** String değeri oluşturur */
    string: (value) => StellarSdk.nativeToScVal(value, { type: "string" }),

    /** BytesN<32> değeri oluşturur (SHA-256 hash için) */
    bytes32: (buffer) =>
        StellarSdk.xdr.ScVal.scvBytes(buffer),
};

export { server, oracleKeypair, CONTRACT_ID };
