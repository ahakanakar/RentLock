/**
 * ============================================
 * RentLock Oracle — Ödeme Doğrulama & Hash Yönetimi
 * ============================================
 *
 * Fotoğraf dosyasından SHA-256 hash üretir ve
 * Soroban kontratına submit_proof çağrısı yapar.
 * Ayrıca iade hash'i ile end_rental çağrısını yönetir.
 */

import crypto from "crypto";
import { invokeContract, queryContract, ScVal, getOraclePublicKey } from "./sorobanClient.js";

/**
 * Dosya buffer'ından SHA-256 hash üretir.
 * Bu hash, ekipmanın teslim/iade anındaki durumunun kanıtıdır.
 *
 * @param {Buffer} fileBuffer — Fotoğraf dosya içeriği
 * @returns {Buffer} 32 byte SHA-256 hash
 */
export function generateHash(fileBuffer) {
    const hash = crypto.createHash("sha256").update(fileBuffer).digest();
    console.log(`🔑 [Hash] SHA-256 üretildi: ${hash.toString("hex")}`);
    return hash;
}

/**
 * Teslim kanıtı hash'ini kontrata yazar.
 * Ekipman teslim edildiğinde çekilecek fotoğrafın hash'i
 * zincire kaydedilir.
 *
 * @param {number} rentalId — Kiralama ID'si
 * @param {Buffer} photoHash — 32 byte SHA-256 hash
 * @returns {Promise<any>} Transaction sonucu
 */
export async function submitProofToContract(rentalId, photoHash) {
    console.log(`📸 [Proof] Teslim kanıtı gönderiliyor — Rental #${rentalId}`);

    const args = [
        ScVal.address(getOraclePublicKey()), // caller (oracle adresi)
        ScVal.u64(rentalId),                 // rental_id
        ScVal.bytes32(photoHash),            // photo_hash (32 byte)
    ];

    const result = await invokeContract("submit_proof", args);
    console.log(`✅ [Proof] Teslim kanıtı kaydedildi — Rental #${rentalId}`);
    return result;
}

/**
 * Kiralama iade sürecini başlatır.
 * İade fotoğrafının hash'i, teslim hash'i ile karşılaştırılır.
 *
 * @param {number} rentalId — Kiralama ID'si
 * @param {Buffer} returnHash — İade fotoğrafının 32 byte SHA-256 hash'i
 * @returns {Promise<any>} Transaction sonucu
 */
export async function endRentalWithHash(rentalId, returnHash) {
    console.log(`🔄 [EndRental] İade işlemi başlatılıyor — Rental #${rentalId}`);

    const args = [
        ScVal.address(getOraclePublicKey()), // caller
        ScVal.u64(rentalId),                 // rental_id
        ScVal.bytes32(returnHash),           // return_hash (32 byte)
    ];

    const result = await invokeContract("end_rental", args);
    console.log(`✅ [EndRental] Kiralama sonlandırıldı — Rental #${rentalId}`);
    return result;
}

/**
 * Kiralama durumunu kontratdan sorgular.
 * Read-only çağrı, transaction ücreti gerektirmez.
 *
 * @param {number} rentalId — Kiralama ID'si
 * @returns {Promise<object>} RentalAgreement verisi
 */
export async function getRentalStatus(rentalId) {
    console.log(`📊 [Status] Durum sorgulanıyor — Rental #${rentalId}`);

    const args = [ScVal.u64(rentalId)];
    const result = await queryContract("get_status", args);

    console.log(`✅ [Status] Durum alındı — Rental #${rentalId}`);
    return result;
}

/**
 * ScVal sonucunu okunabilir JSON'a dönüştürür.
 * Kontrat yanıtlarını frontend'e göndermeden önce parse eder.
 *
 * @param {import("@stellar/stellar-sdk").xdr.ScVal} scVal — Soroban değeri
 * @returns {object} JSON formatında kiralama bilgileri
 */
export function parseRentalStatus(scVal) {
    try {
        if (!scVal) return null;

        // ScVal map'ten alanları çıkar
        const fields = {};
        if (scVal.map && scVal.map()) {
            for (const entry of scVal.map()) {
                const key = entry.key().sym?.().toString() || entry.key().str?.().toString();
                const val = entry.val();

                switch (val.switch().name) {
                    case "scvU64":
                        fields[key] = Number(val.u64());
                        break;
                    case "scvI128": {
                        const i128 = val.i128();
                        fields[key] = Number(i128.lo().low) + Number(i128.lo().high) * 2 ** 32;
                        break;
                    }
                    case "scvString":
                        fields[key] = val.str().toString();
                        break;
                    case "scvAddress":
                        fields[key] = val.address().accountId()?.ed25519()?.toString("hex") || "contract";
                        break;
                    case "scvBytes":
                        fields[key] = Buffer.from(val.bytes()).toString("hex");
                        break;
                    case "scvU32":
                        fields[key] = val.u32();
                        break;
                    default:
                        fields[key] = val.switch().name;
                }
            }
        }

        return fields;
    } catch (error) {
        console.error(`⚠️ [Parse] Status parse hatası:`, error.message);
        return { raw: "Parse edilemedi", error: error.message };
    }
}
