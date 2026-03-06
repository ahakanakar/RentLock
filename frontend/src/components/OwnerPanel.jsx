/**
 * Kiraya Veren Paneli (Owner Dashboard)
 *
 * - Ekipman ekleme formu
 * - Aktif kiralamalar listesi (başlatma, proof gönderme)
 * - Canlı ödeme akışı
 * - Anlaşmazlık açma
 */

import { useState, useEffect } from "react";
import { STATUS_MAP, formatUSDC, formatAddress, timeAgo } from "../services/soroban.js";

const EMPTY_HASH = "0".repeat(64);

export default function OwnerPanel({
    equipments, events, totalAccrued, loading,
    onCreateRental, onStartRental, onApproveReturn, onOpenDispute,
}) {
    const [equipmentId, setEquipmentId] = useState("");
    const [dailyPrice, setDailyPrice] = useState("");
    const [depositAmount, setDepositAmount] = useState("");
    const [creating, setCreating] = useState(false);
    const [displayAccrued, setDisplayAccrued] = useState(0);
    const [actionLoading, setActionLoading] = useState(null); // rental_id | null
    const [actionError, setActionError] = useState(null);

    // Yumuşak animasyonlu sayaç
    useEffect(() => {
        const step = (totalAccrued - displayAccrued) / 10;
        if (Math.abs(step) > 0.0001) {
            const timer = setTimeout(() => setDisplayAccrued((prev) => prev + step), 50);
            return () => clearTimeout(timer);
        } else {
            setDisplayAccrued(totalAccrued);
        }
    }, [totalAccrued, displayAccrued]);

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!equipmentId || !dailyPrice || !depositAmount) return;
        setCreating(true);
        try {
            await onCreateRental(equipmentId, parseFloat(dailyPrice), parseFloat(depositAmount));
            setEquipmentId("");
            setDailyPrice("");
            setDepositAmount("");
        } catch (err) {
            console.error(err);
        }
        setCreating(false);
    };

    const handleStart = async (rentalId) => {
        setActionLoading(rentalId);
        setActionError(null);
        try {
            await onStartRental(rentalId);
        } catch (err) {
            setActionError(err.message || "start_rental başarısız oldu");
        } finally {
            setActionLoading(null);
        }
    };

    // Genel aksiyon handler (approveReturn / openDispute)
    const handleAction = async (rentalId, fn) => {
        setActionLoading(rentalId);
        setActionError(null);
        try {
            await fn(rentalId);
        } catch (err) {
            setActionError(err.message || "İşlem başarısız oldu");
        } finally {
            setActionLoading(null);
        }
    };

    const activeRentals = equipments.filter((r) => r.status === 2);

    const eventIcons = {
        RentalCreated: "📋", DepositMade: "💰", RentalStarted: "▶️",
        ProofSubmitted: "📸", RentalEnded: "🏁", DisputeOpened: "⚠️",
    };
    const eventColors = {
        RentalCreated: "text-blue-400", DepositMade: "text-yellow-400", RentalStarted: "text-emerald-400",
        ProofSubmitted: "text-purple-400", RentalEnded: "text-gray-400", DisputeOpened: "text-red-400",
    };

    return (
        <div className="space-y-6">
            {/* ─── Üst: Sayaç + Form ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Canlı Ödeme Akışı */}
                <div className="glass p-6 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-stellar-600/5 via-transparent to-emerald-500/5" />
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[200px] bg-stellar-500/5 rounded-full blur-[100px]" />
                    <div className="relative">
                        <h2 className="text-base font-bold text-white mb-1 flex items-center gap-2">
                            <span className="text-xl">💹</span> Canlı Ödeme Akışı
                        </h2>
                        <p className="text-white/30 text-xs mb-4">Aktif kiralamalarda biriken ücret</p>
                        <div className="text-center py-2">
                            <div className="text-4xl font-extrabold bg-gradient-to-r from-stellar-400 via-stellar-300 to-emerald-400 bg-clip-text text-transparent mb-1 tabular-nums">
                                ${displayAccrued.toFixed(6)}
                            </div>
                            <div className="text-white/30 text-xs">USDC toplam</div>
                            <div className="flex items-center justify-center gap-2 mt-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                <span className="text-emerald-400 text-xs">{activeRentals.length} aktif kiralama</span>
                            </div>
                        </div>
                        {activeRentals.length > 0 && (
                            <div className="space-y-1 mt-3">
                                {activeRentals.map((r) => {
                                    const elapsed = Math.floor(Date.now() / 1000) - r.start_time;
                                    const accrued = (elapsed / 86400) * (r.daily_price / 10_000_000);
                                    return (
                                        <div key={r.rental_id} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2 text-xs">
                                            <span className="text-white/50">#{r.rental_id} {r.equipment_id}</span>
                                            <span className="text-emerald-400 font-mono font-bold">${accrued.toFixed(4)}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Ekipman Ekleme Formu */}
                <div className="glass p-6">
                    <h2 className="text-base font-bold text-white mb-1 flex items-center gap-2">
                        <span className="text-xl">📦</span> Yeni Ekipman Ekle
                    </h2>
                    <p className="text-white/30 text-xs mb-4">Ekipmanınızı kiralık olarak listeleyin</p>
                    <form onSubmit={handleCreate} className="space-y-3">
                        <div>
                            <label className="block text-white/50 text-xs mb-1">Ekipman Adı / ID</label>
                            <input type="text" className="input-field !py-2.5 text-sm" placeholder="Örn: DRONE-DJI-MAVIC-3"
                                value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-white/50 text-xs mb-1">Günlük Fiyat (USDC)</label>
                                <input type="number" step="0.01" className="input-field !py-2.5 text-sm" placeholder="15.00"
                                    value={dailyPrice} onChange={(e) => setDailyPrice(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-white/50 text-xs mb-1">Depozito (USDC)</label>
                                <input type="number" step="0.01" className="input-field !py-2.5 text-sm" placeholder="100.00"
                                    value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} />
                            </div>
                        </div>
                        <button type="submit" disabled={creating || !equipmentId || !dailyPrice || !depositAmount}
                            className="btn-primary w-full text-sm !py-2.5 flex items-center justify-center gap-2">
                            {creating ? <><span className="animate-spin">⏳</span> İşleniyor...</> : <>🚀 Ekipmanı Sisteme Ekle</>}
                        </button>
                    </form>
                </div>
            </div>

            {/* ─── Aktif Kiralamalar ─── */}
            <div className="glass p-6">
                <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                    <span className="text-xl">📋</span> Kiralamalarım
                    <span className="ml-auto text-sm font-normal text-white/30">{equipments.length} kayıt</span>
                </h2>
                {actionError && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-4 flex items-center gap-2 text-red-400 text-sm">
                        <span>❌</span>
                        <span>{actionError}</span>
                        <button onClick={() => setActionError(null)} className="ml-auto text-red-400/50 hover:text-red-400">✕</button>
                    </div>
                )}
                {equipments.length === 0 ? (
                    <div className="text-center py-8 text-white/20">
                        <p className="text-4xl mb-2">📭</p><p>Henüz kiralama yok</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {equipments.map((rental) => {
                            const status = STATUS_MAP[rental.status] || STATUS_MAP[0];
                            return (
                                <div key={rental.rental_id} className="glass-hover p-4 flex items-center gap-4">
                                    <div className="text-2xl">{status.icon}</div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className="font-semibold text-white text-sm truncate">{rental.equipment_id}</span>
                                            <span className={`status-badge text-[10px] ${status.color}`}>{status.label}</span>
                                        </div>
                                        <div className="flex gap-3 text-xs text-white/30">
                                            <span>💵 {formatUSDC(rental.daily_price)}/gün</span>
                                            <span>🔒 {formatUSDC(rental.deposit_amount)} depozito</span>
                                            {rental.renter && rental.status >= 1 && <span>👤 {formatAddress(rental.renter)}</span>}
                                        </div>
                                    </div>
                                    <div className="flex gap-2 shrink-0 flex-wrap justify-end">
                                        {/* Depozito yatırıldı → başlat */}
                                        {rental.status === 1 && (
                                            <button
                                                onClick={() => handleStart(rental.rental_id)}
                                                disabled={loading || actionLoading === rental.rental_id}
                                                className="btn-success text-xs !px-3 !py-1.5"
                                            >
                                                {actionLoading === rental.rental_id
                                                    ? <span className="animate-spin">⏳</span>
                                                    : <>▶ Başlat</>}
                                            </button>
                                        )}
                                        {/* Aktif + proof geldi → Onayla veya Reddet */}
                                        {rental.status === 2 && rental.proof_hash !== EMPTY_HASH && (
                                            <>
                                                <button
                                                    onClick={() => handleAction(rental.rental_id, onApproveReturn)}
                                                    disabled={loading || actionLoading === rental.rental_id}
                                                    className="btn-success text-xs !px-3 !py-1.5"
                                                >
                                                    {actionLoading === rental.rental_id
                                                        ? <span className="animate-spin">⏳</span>
                                                        : <>✅ Onayla</>}
                                                </button>
                                                <button
                                                    onClick={() => handleAction(rental.rental_id, onOpenDispute)}
                                                    disabled={loading || actionLoading === rental.rental_id}
                                                    className="btn-danger text-xs !px-3 !py-1.5"
                                                >
                                                    ⚠️ Reddet
                                                </button>
                                            </>
                                        )}
                                        {/* Aktif + proof henüz gelmedi → bilgi */}
                                        {rental.status === 2 && rental.proof_hash === EMPTY_HASH && (
                                            <span className="text-white/25 text-xs px-2">
                                                ⏳ İade bekleniyor
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ─── Son Eventler ─── */}
            <div className="glass p-6">
                <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                    <span className="text-xl">⛓️</span> Son Zincir Eventleri
                </h2>
                {events.length === 0 ? (
                    <div className="text-center py-4 text-white/20"><p>Henüz event yok</p></div>
                ) : (
                    <div className="space-y-1.5">
                        {events.map((event, i) => (
                            <div key={i} className="flex items-center gap-3 bg-white/3 rounded-xl px-4 py-2.5 border border-white/5 hover:bg-white/5 transition-colors">
                                <span className="text-lg shrink-0">{eventIcons[event.type] || "📌"}</span>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs font-semibold ${eventColors[event.type] || "text-white"}`}>{event.type}</span>
                                        <span className="text-white/15 text-[10px] font-mono">#{event.rental_id}</span>
                                    </div>
                                    <p className="text-white/30 text-[11px] truncate">{event.detail}</p>
                                </div>
                                <span className="text-white/15 text-[10px] shrink-0">{timeAgo(event.time)}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
