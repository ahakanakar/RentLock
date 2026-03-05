/**
 * ============================================
 * RentLock Oracle — Ana Sunucu
 * ============================================
 *
 * Express.js tabanlı REST API sunucusu.
 * Stellar Soroban kontratı ile etkileşim sağlar.
 *
 * Endpoint'ler:
 * - POST /upload-proof   → Fotoğraf yükle, SHA-256 hash üret, kontrata yaz
 * - POST /end-rental     → İade fotoğrafı ile kiralama sonlandır
 * - GET  /rental/:id     → Kiralama durumu sorgula
 * - POST /track/:id      → Kiralama takibini başlat
 * - GET  /health         → Sunucu sağlık kontrolü
 */

import "dotenv/config";
import express from "express";
import multer from "multer";

import {
    generateHash,
    submitProofToContract,
    endRentalWithHash,
    getRentalStatus,
    parseRentalStatus,
} from "./paymentVerifier.js";

import {
    startScheduler,
    trackRental,
    untrackRental,
    getActiveRentals,
} from "./scheduler.js";

// ─── Express Yapılandırma ───────────────────────────────

const app = express();
const PORT = process.env.PORT || 3001;
const TIMER_INTERVAL = parseInt(process.env.TIMER_INTERVAL_SECONDS) || 10;

// JSON body parsing
app.use(express.json());

// Dosya yükleme — bellekte tutar (disk'e kaydetmez)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // Max 10 MB
});

// ─── Middleware: İstek Loglama ──────────────────────────

app.use((req, _res, next) => {
    console.log(`\n📨 [HTTP] ${req.method} ${req.url} — ${new Date().toISOString()}`);
    next();
});

// ─── Endpoint'ler ───────────────────────────────────────

/**
 * POST /upload-proof
 *
 * Teslim anında çekilen fotoğrafı alır, SHA-256 hash üretir
 * ve Soroban kontratına submit_proof çağrısı yapar.
 *
 * Body (multipart/form-data):
 * - photo: Fotoğraf dosyası
 * - rentalId: Kiralama ID'si
 *
 * Yanıt: { success, hash, rentalId, message }
 */
app.post("/upload-proof", upload.single("photo"), async (req, res) => {
    try {
        console.log(`\n📸 ═══ UPLOAD PROOF ═══════════════════════`);

        // Dosya kontrolü
        if (!req.file) {
            console.log(`❌ [Upload] Dosya bulunamadı`);
            return res.status(400).json({ success: false, error: "Fotoğraf dosyası gerekli" });
        }

        const rentalId = parseInt(req.body.rentalId);
        if (!rentalId || isNaN(rentalId)) {
            console.log(`❌ [Upload] Geçersiz rental ID`);
            return res.status(400).json({ success: false, error: "Geçerli bir rentalId gerekli" });
        }

        console.log(`📸 [Upload] Dosya: ${req.file.originalname} (${req.file.size} bytes)`);
        console.log(`📸 [Upload] Rental ID: ${rentalId}`);

        // SHA-256 hash üret
        const hash = generateHash(req.file.buffer);
        const hashHex = hash.toString("hex");

        // Kontrata yaz
        await submitProofToContract(rentalId, hash);

        console.log(`✅ [Upload] Proof başarıyla kaydedildi`);
        console.log(`📸 ═══════════════════════════════════════\n`);

        res.json({
            success: true,
            hash: hashHex,
            rentalId,
            message: `Teslim kanıtı kontrata yazıldı`,
        });
    } catch (error) {
        console.error(`❌ [Upload] Hata:`, error.message);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * POST /end-rental
 *
 * İade fotoğrafını alır, hash üretir ve end_rental çağrısı yapar.
 * Hash'ler eşleşirse depozito iade edilir, eşleşmezse sahibine aktarılır.
 *
 * Body (multipart/form-data):
 * - photo: İade fotoğrafı
 * - rentalId: Kiralama ID'si
 *
 * Yanıt: { success, returnHash, rentalId, message }
 */
app.post("/end-rental", upload.single("photo"), async (req, res) => {
    try {
        console.log(`\n🔄 ═══ END RENTAL ═══════════════════════`);

        if (!req.file) {
            return res.status(400).json({ success: false, error: "İade fotoğrafı gerekli" });
        }

        const rentalId = parseInt(req.body.rentalId);
        if (!rentalId || isNaN(rentalId)) {
            return res.status(400).json({ success: false, error: "Geçerli bir rentalId gerekli" });
        }

        console.log(`🔄 [EndRental] Dosya: ${req.file.originalname} (${req.file.size} bytes)`);
        console.log(`🔄 [EndRental] Rental ID: ${rentalId}`);

        // İade fotoğrafının hash'ini üret
        const returnHash = generateHash(req.file.buffer);
        const returnHashHex = returnHash.toString("hex");

        // Kontrata end_rental çağrısı yap
        await endRentalWithHash(rentalId, returnHash);

        // Takipten çıkar
        untrackRental(rentalId);

        console.log(`✅ [EndRental] Kiralama sonlandırıldı`);
        console.log(`🔄 ═══════════════════════════════════════\n`);

        res.json({
            success: true,
            returnHash: returnHashHex,
            rentalId,
            message: `Kiralama sonlandırıldı. Hash karşılaştırması yapıldı.`,
        });
    } catch (error) {
        console.error(`❌ [EndRental] Hata:`, error.message);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * GET /rental/:id
 *
 * Kiralama durumunu Soroban kontratından sorgular.
 * Read-only çağrı — transaction ücreti gerektirmez.
 *
 * Yanıt: { success, rentalId, status }
 */
app.get("/rental/:id", async (req, res) => {
    try {
        const rentalId = parseInt(req.params.id);
        console.log(`\n📊 ═══ GET STATUS ═══════════════════════`);
        console.log(`📊 [Status] Rental ID: ${rentalId}`);

        if (!rentalId || isNaN(rentalId)) {
            return res.status(400).json({ success: false, error: "Geçerli bir rental ID gerekli" });
        }

        // Kontratdan durum sorgula
        const statusScVal = await getRentalStatus(rentalId);
        const status = parseRentalStatus(statusScVal);

        console.log(`✅ [Status] Durum alındı`);
        console.log(`📊 ═══════════════════════════════════════\n`);

        res.json({
            success: true,
            rentalId,
            status,
        });
    } catch (error) {
        console.error(`❌ [Status] Hata:`, error.message);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * POST /track/:id
 *
 * Kiralama ID'sini timer takip listesine ekler.
 * Timer servisi bu kiralamaları periyodik olarak kontrol eder.
 *
 * Yanıt: { success, rentalId, activeRentals }
 */
app.post("/track/:id", (req, res) => {
    const rentalId = parseInt(req.params.id);
    console.log(`\n📋 ═══ TRACK RENTAL ═════════════════════`);

    if (!rentalId || isNaN(rentalId)) {
        return res.status(400).json({ success: false, error: "Geçerli bir rental ID gerekli" });
    }

    trackRental(rentalId);

    console.log(`📋 ═══════════════════════════════════════\n`);

    res.json({
        success: true,
        rentalId,
        activeRentals: getActiveRentals(),
        message: `Rental #${rentalId} takip ediliyor`,
    });
});

/**
 * GET /health
 *
 * Sunucu sağlık kontrolü. Oracle'ın çalışır durumda olduğunu doğrular.
 */
app.get("/health", (_req, res) => {
    res.json({
        success: true,
        service: "RentLock Oracle",
        uptime: process.uptime(),
        activeRentals: getActiveRentals(),
        timerInterval: `${TIMER_INTERVAL}s`,
        timestamp: new Date().toISOString(),
    });
});

// ─── Sunucu Başlatma ────────────────────────────────────

app.listen(PORT, () => {
    console.log(`\n`);
    console.log(`🔐 ═══════════════════════════════════════════`);
    console.log(`🔐  RentLock Oracle Backend`);
    console.log(`🔐 ═══════════════════════════════════════════`);
    console.log(`🌐  Sunucu: http://localhost:${PORT}`);
    console.log(`📡  RPC:    ${process.env.SOROBAN_RPC_URL}`);
    console.log(`📝  Kontrat: ${process.env.CONTRACT_ID}`);
    console.log(`⏰  Timer:  ${TIMER_INTERVAL}s aralık`);
    console.log(`🔐 ═══════════════════════════════════════════\n`);

    console.log(`📌 Endpoint'ler:`);
    console.log(`   POST /upload-proof   — Teslim fotoğrafı hash'le + kontrata yaz`);
    console.log(`   POST /end-rental     — İade fotoğrafı ile kiralama sonlandır`);
    console.log(`   GET  /rental/:id     — Kiralama durumu sorgula`);
    console.log(`   POST /track/:id      — Kiralama takibini başlat`);
    console.log(`   GET  /health         — Sağlık kontrolü`);
    console.log(``);

    // Timer servisini başlat
    startScheduler(TIMER_INTERVAL);
});
