/**
 * RentLock — Soroban Servis Katmanı
 *
 * Kontrat bağlantısı yoksa mock data ile çalışır.
 * Gerçek kontrat bağlantısı varsa Stellar SDK kullanır.
 */

// ─── Mock Data ──────────────────────────────────────

const MOCK_EQUIPMENTS = [
    {
        rental_id: 1,
        equipment_id: "DRONE-DJI-001",
        owner: "GBXYZ...OWNER1",
        renter: "",
        daily_price: 15_0000000, // 15 USDC
        deposit_amount: 100_0000000, // 100 USDC
        status: 0, // Created
        start_time: 0,
        proof_hash: "0".repeat(64),
        return_hash: "0".repeat(64),
    },
    {
        rental_id: 2,
        equipment_id: "CAMERA-SONY-A7",
        owner: "GBXYZ...OWNER1",
        renter: "GCABC...RENTER1",
        daily_price: 25_0000000, // 25 USDC
        deposit_amount: 200_0000000, // 200 USDC
        status: 2, // Active
        start_time: Math.floor(Date.now() / 1000) - 86400, // 1 gün önce
        proof_hash: "a1b2c3d4e5f6".padEnd(64, "0"),
        return_hash: "0".repeat(64),
    },
    {
        rental_id: 3,
        equipment_id: "LENS-CANON-70-200",
        owner: "GBXYZ...OWNER2",
        renter: "GCABC...RENTER2",
        daily_price: 10_0000000, // 10 USDC
        deposit_amount: 80_0000000, // 80 USDC
        status: 1, // Deposited
        start_time: 0,
        proof_hash: "0".repeat(64),
        return_hash: "0".repeat(64),
    },
];

const MOCK_EVENTS = [
    { type: "RentalCreated", rental_id: 1, time: Date.now() - 300000, detail: "DRONE-DJI-001 listelendi" },
    { type: "DepositMade", rental_id: 3, time: Date.now() - 240000, detail: "80 USDC depozito kilitledi" },
    { type: "RentalCreated", rental_id: 2, time: Date.now() - 180000, detail: "CAMERA-SONY-A7 listelendi" },
    { type: "DepositMade", rental_id: 2, time: Date.now() - 120000, detail: "200 USDC depozito kilitledi" },
    { type: "RentalStarted", rental_id: 2, time: Date.now() - 60000, detail: "Kiralama başladı" },
];

let mockData = [...MOCK_EQUIPMENTS];
let mockEvents = [...MOCK_EVENTS];
let nextId = 4;

// ─── Status Helpers ─────────────────────────────────

export const STATUS_MAP = {
    0: { label: "Oluşturuldu", color: "bg-blue-500/20 text-blue-400", icon: "📋" },
    1: { label: "Depozito Yatırıldı", color: "bg-yellow-500/20 text-yellow-400", icon: "💰" },
    2: { label: "Aktif", color: "bg-emerald-500/20 text-emerald-400", icon: "✅" },
    3: { label: "Tamamlandı", color: "bg-gray-500/20 text-gray-400", icon: "🏁" },
    4: { label: "Anlaşmazlık", color: "bg-red-500/20 text-red-400", icon: "⚠️" },
};

export function formatUSDC(amount) {
    return (amount / 10_000_000).toFixed(2);
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

// ─── Mock API Functions ─────────────────────────────

export async function getEquipments() {
    // Simulate network delay
    await new Promise((r) => setTimeout(r, 300));
    return [...mockData];
}

export async function createRental(equipmentId, dailyPrice, depositAmount) {
    await new Promise((r) => setTimeout(r, 500));
    const rental = {
        rental_id: nextId++,
        equipment_id: equipmentId,
        owner: "GBXYZ...YOU",
        renter: "",
        daily_price: Math.round(dailyPrice * 10_000_000),
        deposit_amount: Math.round(depositAmount * 10_000_000),
        status: 0,
        start_time: 0,
        proof_hash: "0".repeat(64),
        return_hash: "0".repeat(64),
    };
    mockData.push(rental);
    addEvent("RentalCreated", rental.rental_id, `${equipmentId} listelendi`);
    return rental;
}

export async function depositRental(rentalId) {
    await new Promise((r) => setTimeout(r, 800));
    const rental = mockData.find((r) => r.rental_id === rentalId);
    if (!rental) throw new Error("Kiralama bulunamadı");
    if (rental.status !== 0) throw new Error("Bu kiralama depozito için uygun değil");
    rental.status = 1;
    rental.renter = "GCABC...YOU";
    addEvent("DepositMade", rentalId, `${formatUSDC(rental.deposit_amount)} USDC depozito kilitledi`);
    return rental;
}

export async function startRental(rentalId) {
    await new Promise((r) => setTimeout(r, 600));
    const rental = mockData.find((r) => r.rental_id === rentalId);
    if (!rental) throw new Error("Kiralama bulunamadı");
    if (rental.status !== 1) throw new Error("Bu kiralama başlatmak için uygun değil");
    rental.status = 2;
    rental.start_time = Math.floor(Date.now() / 1000);
    addEvent("RentalStarted", rentalId, `Kiralama başladı`);
    return rental;
}

export async function endRental(rentalId, isDisputed = false) {
    await new Promise((r) => setTimeout(r, 1000));
    const rental = mockData.find((r) => r.rental_id === rentalId);
    if (!rental) throw new Error("Kiralama bulunamadı");
    if (rental.status !== 2) throw new Error("Bu kiralama sonlandırmak için uygun değil");

    if (isDisputed) {
        rental.status = 4;
        rental.return_hash = "ff".repeat(32);
        addEvent("DisputeOpened", rentalId, `Hash uyuşmazlığı — depozito sahibine aktarıldı`);
    } else {
        rental.status = 3;
        rental.return_hash = rental.proof_hash;
        addEvent("RentalEnded", rentalId, `Kiralama tamamlandı — depozito iade edildi`);
    }
    return rental;
}

export async function submitProof(rentalId) {
    await new Promise((r) => setTimeout(r, 700));
    const rental = mockData.find((r) => r.rental_id === rentalId);
    if (!rental) throw new Error("Kiralama bulunamadı");
    const hash = Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    rental.proof_hash = hash;
    addEvent("ProofSubmitted", rentalId, `Teslim kanıtı kaydedildi`);
    return rental;
}

export async function getRentalStatus(rentalId) {
    await new Promise((r) => setTimeout(r, 200));
    return mockData.find((r) => r.rental_id === rentalId) || null;
}

export function getEvents() {
    return [...mockEvents].sort((a, b) => b.time - a.time).slice(0, 5);
}

function addEvent(type, rentalId, detail) {
    mockEvents.push({ type, rental_id: rentalId, time: Date.now(), detail });
}
