/**
 * Panel 2 — Kiracı (Renter Panel)
 *
 * - Kendi kiralamalarını renter adresiyle filtreler
 * - Status 1 (Depozito): bekleme + iptal seçeneği
 * - Status 2 (Aktif): canlı maliyet sayacı + iade butonu
 */

import { useState, useEffect, useRef } from "react";
import { STATUS_MAP, formatUSDC, formatAddress } from "../services/soroban.js";

// Anlık birikmiş maliyeti hesaplar (USDC, 2 ondalık)
function calcAccrued(rental) {
    if (rental.status !== 2 || !rental.start_time || Number(rental.start_time) === 0) return null;
    const nowSec = Date.now() / 1000;
    const elapsed = nowSec - Number(rental.start_time);   // saniye
    const dailyUSDC = Number(rental.daily_price) / 10_000_000; // USDC/gün
    return ((elapsed / 86400) * dailyUSDC).toFixed(4);
}

export default function RenterPanel({ equipments, loading, onDeposit, onEndRental, walletAddress }) {
    const [selectedRental, setSelectedRental] = useState(null);
    const [actionLoading, setActionLoading] = useState(null);
    const [tick, setTick] = useState(0); // her saniye tetikler (canlı sayaç)
    const fileInputRef = useRef(null);

    // Canlı maliyet sayacı — her saniye tick
    useEffect(() => {
        const id = setInterval(() => setTick((t) => t + 1), 1000);
        return () => clearInterval(id);
    }, []);

    // Mevcut kiracıya ait olmayan kiralamalar hariç tut
    const availableRentals = equipments.filter((r) => r.status === 0);

    // Kiracının kendi kiralamalarını filtrele (renter adresi eşleşmeli)
    // renter alanı kontratdan geliyor; eşleşmiyorsa tüm status 1-2'i göster (fallback)
    const myRentals = equipments.filter((r) => {
        if (r.status < 1 || r.status > 2) return false;
        if (!r.renter || !walletAddress) return true; // adres yoksa hepsini göster
        return r.renter === walletAddress;
    });

    const handleDeposit = async (rentalId) => {
        setActionLoading(rentalId);
        try { await onDeposit(rentalId); } catch (err) { console.error(err); }
        setActionLoading(null);
    };

    const handleReturn = async (rentalId) => {
        setActionLoading(rentalId);
        try { await onEndRental(rentalId, false); } catch (err) { console.error(err); }
        setActionLoading(null);
        setSelectedRental(null);
    };

    return (
        <div className="space-y-6">

            {/* ─── Kiralanabilir Ekipmanlar ─── */}
            <div className="glass p-6">
                <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                    <span className="text-2xl">🏪</span> Kiralık Ekipmanlar
                </h2>
                <p className="text-white/40 text-sm mb-5">Depozito yatırarak ekipmanı kirala</p>

                {availableRentals.length === 0 ? (
                    <div className="text-center py-8 text-white/30">
                        <p className="text-4xl mb-2">🔍</p>
                        <p>Kiralık ekipman yok</p>
                    </div>
                ) : (
                    <div className="grid gap-3">
                        {availableRentals.map((rental) => (
                            <div key={rental.rental_id} className="glass-hover p-5 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-stellar-500/5 rounded-full blur-3xl group-hover:bg-stellar-500/10 transition-all" />
                                <div className="relative flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-stellar-600/30 to-stellar-400/10 flex items-center justify-center text-2xl border border-stellar-500/20">
                                        📦
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-bold text-white text-lg">{rental.equipment_id}</h3>
                                        <div className="flex flex-wrap gap-4 text-sm text-white/50 mt-1">
                                            <span>💵 {formatUSDC(rental.daily_price)} USDC/gün</span>
                                            <span>🔒 {formatUSDC(rental.deposit_amount)} USDC depozito</span>
                                        </div>
                                        <div className="text-xs text-white/25 mt-1">Sahip: {formatAddress(rental.owner)}</div>
                                    </div>
                                    <button
                                        onClick={() => handleDeposit(rental.rental_id)}
                                        disabled={loading || actionLoading === rental.rental_id}
                                        className="btn-primary text-sm shrink-0"
                                    >
                                        {actionLoading === rental.rental_id
                                            ? <span className="animate-spin">⏳</span>
                                            : <>💰 Depozito Kilitle &amp; Kirala</>}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ─── Benim Kiralamalarım ─── */}
            <div className="glass p-6">
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <span className="text-2xl">🔑</span> Kiralamalarım
                    <span className="ml-auto text-sm font-normal text-white/40">{myRentals.length} aktif</span>
                </h2>

                {myRentals.length === 0 ? (
                    <div className="text-center py-8 text-white/30">
                        <p className="text-4xl mb-2">🏠</p>
                        <p>Aktif kiralamanız yok</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {myRentals.map((rental) => {
                            const status = STATUS_MAP[rental.status] || STATUS_MAP[0];
                            const accrued = calcAccrued(rental); // tick bağımlı — her sn güncellenir
                            const elapsedDays = rental.status === 2 && rental.start_time > 0
                                ? ((Date.now() / 1000 - Number(rental.start_time)) / 86400).toFixed(2)
                                : null;

                            return (
                                <div key={rental.rental_id} className="glass-hover p-5">
                                    <div className="flex items-start gap-4">
                                        <div className="text-3xl mt-0.5">{status.icon}</div>

                                        <div className="flex-1 min-w-0">
                                            {/* Başlık satırı */}
                                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                <span className="font-bold text-white text-base">
                                                    {rental.equipment_id}
                                                </span>
                                                <span className={`status-badge ${status.color}`}>
                                                    {status.label}
                                                </span>
                                            </div>

                                            {/* Bilgi satırı */}
                                            <div className="flex flex-wrap gap-4 text-sm text-white/40 mb-3">
                                                <span>🔒 {formatUSDC(rental.deposit_amount)} USDC depozito</span>
                                                <span>💵 {formatUSDC(rental.daily_price)} USDC/gün</span>
                                                {elapsedDays && <span>📅 {elapsedDays} gün geçti</span>}
                                            </div>

                                            {/* Canlı maliyet (sadece aktifken) */}
                                            {rental.status === 2 && accrued !== null && (
                                                <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2">
                                                    <span className="text-emerald-400/60 text-xs">Şu ana kadar:</span>
                                                    <span className="text-emerald-400 font-bold font-mono">
                                                        ${accrued} USDC
                                                    </span>
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                                </div>
                                            )}

                                            {/* Status 1: sahibi başlatmasını bekliyor */}
                                            {rental.status === 1 && (
                                                <div className="text-yellow-400/60 text-xs mt-1">
                                                    ⏳ Ekipman sahibinin kiralamayı başlatması bekleniyor...
                                                </div>
                                            )}
                                        </div>

                                        {/* İade Butonu — status 1 veya 2 */}
                                        <div className="shrink-0 flex flex-col gap-2">
                                            {rental.status === 2 && (
                                                <button
                                                    onClick={() => {
                                                        setSelectedRental(rental.rental_id);
                                                        fileInputRef.current?.click();
                                                    }}
                                                    disabled={loading || actionLoading === rental.rental_id}
                                                    className="btn-success text-sm !px-4 !py-2"
                                                >
                                                    {actionLoading === rental.rental_id
                                                        ? <span className="animate-spin">⏳</span>
                                                        : <>📷 İade Et</>}
                                                </button>
                                            )}
                                            {rental.status === 1 && (
                                                <button
                                                    onClick={() => handleReturn(rental.rental_id)}
                                                    disabled={loading || actionLoading === rental.rental_id}
                                                    className="px-4 py-2 rounded-xl text-sm border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all"
                                                >
                                                    {actionLoading === rental.rental_id
                                                        ? <span className="animate-spin">⏳</span>
                                                        : <>↩️ Depozitoyu Geri Al</>}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Gizli dosya input — fotoğraf yükleme */}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                        if (e.target.files?.[0] && selectedRental) {
                            handleReturn(selectedRental);
                            e.target.value = "";
                        }
                    }}
                />
            </div>
        </div>
    );
}
