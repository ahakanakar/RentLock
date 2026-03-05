/**
 * Panel 3 — Kontrat Durumu (Admin Panel)
 *
 * Canlı ödeme sayacı, son 5 zincir eventi, anlaşmazlık simülasyonu.
 */

import { useState, useEffect } from "react";
import { STATUS_MAP, formatUSDC, timeAgo } from "../services/soroban.js";

export default function AdminPanel({ equipments, events, totalAccrued, loading, onEndRental }) {
    const [displayAccrued, setDisplayAccrued] = useState(0);
    const [disputeLoading, setDisputeLoading] = useState(null);

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

    const activeRentals = equipments.filter((r) => r.status === 2);

    const handleDispute = async (rentalId) => {
        setDisputeLoading(rentalId);
        try {
            await onEndRental(rentalId, true); // Dispute mode
        } catch (err) {
            console.error(err);
        }
        setDisputeLoading(null);
    };

    // Event tipi renkleri
    const eventColors = {
        RentalCreated: "text-blue-400",
        DepositMade: "text-yellow-400",
        RentalStarted: "text-emerald-400",
        ProofSubmitted: "text-purple-400",
        RentalEnded: "text-gray-400",
        DisputeOpened: "text-red-400",
    };

    const eventIcons = {
        RentalCreated: "📋",
        DepositMade: "💰",
        RentalStarted: "▶️",
        ProofSubmitted: "📸",
        RentalEnded: "🏁",
        DisputeOpened: "⚠️",
    };

    return (
        <div className="space-y-6">
            {/* ─── Canlı Ödeme Sayacı ─── */}
            <div className="glass p-6 relative overflow-hidden">
                {/* Animated background */}
                <div className="absolute inset-0 bg-gradient-to-r from-stellar-600/5 via-transparent to-emerald-500/5" />
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[200px] bg-stellar-500/5 rounded-full blur-[100px]" />

                <div className="relative">
                    <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                        <span className="text-2xl">💹</span> Canlı Ödeme Akışı
                    </h2>
                    <p className="text-white/40 text-sm mb-6">Aktif kiralamalarda biriken toplam ücret</p>

                    {/* Büyük sayaç */}
                    <div className="text-center py-4">
                        <div className="text-6xl font-extrabold bg-gradient-to-r from-stellar-400 via-stellar-300 to-emerald-400 bg-clip-text text-transparent mb-2 tabular-nums">
                            ${displayAccrued.toFixed(6)}
                        </div>
                        <div className="text-white/40 text-sm">
                            USDC toplam biriken ücret
                        </div>
                        <div className="flex items-center justify-center gap-2 mt-3">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-emerald-400 text-sm font-medium">
                                {activeRentals.length} aktif kiralama
                            </span>
                        </div>
                    </div>

                    {/* Aktif kiralama kartları */}
                    {activeRentals.length > 0 && (
                        <div className="grid gap-2 mt-4">
                            {activeRentals.map((rental) => {
                                const elapsed = Math.floor(Date.now() / 1000) - rental.start_time;
                                const dailyRate = rental.daily_price / 10_000_000;
                                const accrued = (elapsed / 86400) * dailyRate;

                                return (
                                    <div
                                        key={rental.rental_id}
                                        className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3 border border-white/5"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-emerald-400 font-mono text-sm">#{rental.rental_id}</span>
                                            <span className="text-white/70 text-sm">{rental.equipment_id}</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-emerald-400 font-bold font-mono">
                                                ${accrued.toFixed(4)}
                                            </span>
                                            <span className="text-white/30 text-xs ml-2">
                                                ({formatUSDC(rental.daily_price)}/gün)
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* ─── Son Zincir Eventleri ─── */}
            <div className="glass p-6">
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <span className="text-2xl">⛓️</span> Son Zincir Eventleri
                </h2>

                {events.length === 0 ? (
                    <div className="text-center py-6 text-white/30">
                        <p className="text-3xl mb-2">📡</p>
                        <p>Henüz event yok</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {events.map((event, i) => (
                            <div
                                key={i}
                                className="flex items-center gap-3 bg-white/3 rounded-xl px-4 py-3 border border-white/5 hover:bg-white/5 transition-colors"
                            >
                                <span className="text-xl shrink-0">{eventIcons[event.type] || "📌"}</span>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-sm font-semibold ${eventColors[event.type] || "text-white"}`}>
                                            {event.type}
                                        </span>
                                        <span className="text-white/20 text-xs font-mono">
                                            Rental #{event.rental_id}
                                        </span>
                                    </div>
                                    <p className="text-white/40 text-xs truncate">{event.detail}</p>
                                </div>
                                <span className="text-white/20 text-xs shrink-0">
                                    {timeAgo(event.time)}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ─── Anlaşmazlık Simülasyonu ─── */}
            <div className="glass p-6 border-red-500/20">
                <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                    <span className="text-2xl">⚠️</span> Anlaşmazlık Simülasyonu
                </h2>
                <p className="text-white/40 text-sm mb-5">
                    Aktif bir kiralama için hash uyuşmazlığı simüle edin. Depozito ekipman sahibine aktarılır.
                </p>

                {activeRentals.length === 0 ? (
                    <div className="text-center py-4 text-white/30">
                        <p>Simülasyon için aktif kiralama gerekli</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {activeRentals.map((rental) => (
                            <div
                                key={rental.rental_id}
                                className="flex items-center justify-between bg-red-500/5 rounded-xl px-4 py-3 border border-red-500/10"
                            >
                                <div>
                                    <span className="text-white font-semibold">{rental.equipment_id}</span>
                                    <span className="text-white/30 text-sm ml-3">
                                        Depozito: {formatUSDC(rental.deposit_amount)} USDC
                                    </span>
                                </div>
                                <button
                                    onClick={() => handleDispute(rental.rental_id)}
                                    disabled={loading || disputeLoading === rental.rental_id}
                                    className="btn-danger text-sm !px-4 !py-2"
                                >
                                    {disputeLoading === rental.rental_id ? (
                                        <span className="animate-spin">⏳</span>
                                    ) : (
                                        <>🔥 Anlaşmazlık Başlat</>
                                    )}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
