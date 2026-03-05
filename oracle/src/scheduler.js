/**
 * ============================================
 * RentLock Oracle — Zamanlayıcı Servisi
 * ============================================
 *
 * Aktif kiralamaları periyodik olarak kontrol eder.
 * Demo modunda 10 saniyede bir "ödeme tetikle" komutu gönderir.
 * Production'da bu süre 1 saat (3600 saniye) olarak ayarlanır.
 */

import { getRentalStatus, parseRentalStatus } from "./paymentVerifier.js";

/** Takip edilen aktif kiralama ID'leri */
const activeRentals = new Set();

/** Timer referansı */
let timerInterval = null;

/**
 * Yeni bir kiralama ID'sini takip listesine ekler.
 * Timer servisi bu listedeki kiralamaları düzenli olarak kontrol eder.
 *
 * @param {number} rentalId — Takip edilecek kiralama ID'si
 */
export function trackRental(rentalId) {
    activeRentals.add(rentalId);
    console.log(
        `📋 [Scheduler] Rental #${rentalId} takip listesine eklendi. Aktif: ${activeRentals.size}`
    );
}

/**
 * Bir kiralama ID'sini takip listesinden çıkarır.
 *
 * @param {number} rentalId — Çıkarılacak kiralama ID'si
 */
export function untrackRental(rentalId) {
    activeRentals.delete(rentalId);
    console.log(
        `📋 [Scheduler] Rental #${rentalId} takip listesinden çıkarıldı. Aktif: ${activeRentals.size}`
    );
}

/**
 * Timer servisini başlatır.
 * Belirtilen aralıkla aktif kiralamaları kontrol eder ve
 * ödeme tetikleme logunu yazar.
 *
 * @param {number} intervalSeconds — Kontrol aralığı (saniye)
 */
export function startScheduler(intervalSeconds = 10) {
    console.log(`\n⏰ ═══════════════════════════════════════════`);
    console.log(`⏰  Timer Servisi Başlatıldı`);
    console.log(`⏰  Aralık: ${intervalSeconds} saniye`);
    console.log(
        `⏰  Mod: ${intervalSeconds <= 60 ? "DEMO" : "PRODUCTION"}`
    );
    console.log(`⏰ ═══════════════════════════════════════════\n`);

    timerInterval = setInterval(async () => {
        if (activeRentals.size === 0) {
            console.log(
                `⏰ [Scheduler] Tick — Aktif kiralama yok, bekleniyor...`
            );
            return;
        }

        console.log(
            `\n⏰ [Scheduler] ── Tick ── ${new Date().toISOString()} ──`
        );
        console.log(
            `⏰ [Scheduler] ${activeRentals.size} aktif kiralama kontrol ediliyor...\n`
        );

        for (const rentalId of activeRentals) {
            try {
                console.log(`💳 [Scheduler] Ödeme tetikleniyor — Rental #${rentalId}`);

                // Kiralama durumunu sorgula
                const statusScVal = await getRentalStatus(rentalId);
                const status = parseRentalStatus(statusScVal);

                if (status) {
                    console.log(`📊 [Scheduler] Rental #${rentalId} durumu:`, JSON.stringify(status, null, 2));

                    // Eğer kiralama tamamlanmış veya dispute açılmışsa takipten çıkar
                    const rentalStatus = status.status;
                    if (rentalStatus === 3 || rentalStatus === 4) {
                        // 3 = Completed, 4 = Disputed
                        console.log(
                            `🏁 [Scheduler] Rental #${rentalId} sonlandı, takipten çıkarılıyor`
                        );
                        untrackRental(rentalId);
                    }
                }

                console.log(
                    `✅ [Scheduler] Ödeme tetikleme tamamlandı — Rental #${rentalId}`
                );
            } catch (error) {
                console.error(
                    `❌ [Scheduler] Rental #${rentalId} kontrol hatası:`,
                    error.message
                );
            }
        }
    }, intervalSeconds * 1000);

    console.log(`⏰ [Scheduler] Timer aktif — her ${intervalSeconds}s çalışacak`);
}

/**
 * Timer servisini durdurur.
 */
export function stopScheduler() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
        console.log(`⏰ [Scheduler] Timer durduruldu`);
    }
}

/**
 * Aktif kiralama listesini döndürür.
 * @returns {number[]} Aktif kiralama ID'leri
 */
export function getActiveRentals() {
    return Array.from(activeRentals);
}
