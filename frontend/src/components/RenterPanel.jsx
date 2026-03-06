/**
 * Panel 2 — Kiracı (Renter Panel)
 *
 * İade akışı:
 *  1. Kiracı "İade Et" tıklar
 *  2. submitProof çağrılır (hash zincire yazılır)
 *  3. endRental çağrılır (hash karşılaştırılır, depozito iade)
 */

import { useState, useEffect } from "react";
import { STATUS_MAP, formatUSDC, formatAddress } from "../services/soroban.js";

function calcAccrued(rental) {
    if (rental.status !== 2 || !rental.start_time || Number(rental.start_time) === 0) return null;
    const elapsed = Date.now() / 1000 - Number(rental.start_time);
    const dailyUSDC = Number(rental.daily_price) / 10_000_000;
    return ((elapsed / 86400) * dailyUSDC).toFixed(4);
}

export default function RenterPanel({ equipments, loading, onDeposit, onSubmitProof, onEndRental, walletAddress }) {
    const [actionLoading, setActionLoading] = useState(null);
    const [actionError, setActionError] = useState("");
    const [tick, setTick] = useState(0);

    const [returnModalOpen, setReturnModalOpen] = useState(false);
    const [selectedRentalId, setSelectedRentalId] = useState(null);
    const [returnFile, setReturnFile] = useState(null);

    useEffect(() => {
        const id = setInterval(() => setTick((t) => t + 1), 1000);
        return () => clearInterval(id);
    }, []);

    const availableRentals = equipments.filter((r) => r.status === 0);

    const myRentals = equipments.filter((r) => {
        if (r.status < 1 || r.status > 2) return false;
        if (!r.renter || !walletAddress) return true;
        return r.renter === walletAddress;
    });

    const handleDeposit = async (rentalId) => {
        setActionLoading(rentalId);
        setActionError("");
        try {
            await onDeposit(rentalId);
        } catch (err) {
            setActionError(err.message || "Depozito kilitlenemedi");
        }
        setActionLoading(null);
    };

    const openReturnModal = (rentalId) => {
        setSelectedRentalId(rentalId);
        setReturnFile(null);
        setReturnModalOpen(true);
        setActionError("");
    };

    const handleReturnSubmit = async () => {
        if (!selectedRentalId) return;
        if (!returnFile) {
            setActionError("Lütfen iade kanıtı için bir fotoğraf veya dosya seçin.");
            return;
        }

        setActionLoading(selectedRentalId);
        setActionError("");
        setReturnModalOpen(false);

        try {
            if (onSubmitProof) {
                await onSubmitProof(selectedRentalId, returnFile);
            }
            if (onEndRental) {
                await onEndRental(selectedRentalId, false);
            }
        } catch (err) {
            setActionError(err.message || "İade işlemi başarısız");
        }
        setActionLoading(null);
    };

    const handleCancelDeposit = async (rentalId) => {
        setActionLoading(rentalId);
        setActionError("");
        try {
            if (onEndRental) await onEndRental(rentalId, false);
        } catch (err) {
            setActionError(err.message || "İptal başarısız");
        }
        setActionLoading(null);
    };

    return (
        <div className="space-y-6">

            {/* Hata banner */}
            {actionError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 flex items-center gap-2 text-red-400 text-sm">
                    <span>❌</span>
                    <span className="flex-1 text-xs">{actionError}</span>
                    <button onClick={() => setActionError("")} className="text-red-400/50 hover:text-red-400">✕</button>
                </div>
            )}

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
                            const accrued = calcAccrued(rental);
                            const elapsedDays = rental.status === 2 && rental.start_time > 0
                                ? ((Date.now() / 1000 - Number(rental.start_time)) / 86400).toFixed(2)
                                : null;

                            return (
                                <div key={rental.rental_id} className="glass-hover p-5">
                                    <div className="flex items-start gap-4">
                                        <div className="text-3xl mt-0.5">{status.icon}</div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                <span className="font-bold text-white text-base">{rental.equipment_id}</span>
                                                <span className={`status-badge ${status.color}`}>{status.label}</span>
                                            </div>

                                            <div className="flex flex-wrap gap-4 text-sm text-white/40 mb-3">
                                                <span>🔒 {formatUSDC(rental.deposit_amount)} USDC depozito</span>
                                                <span>💵 {formatUSDC(rental.daily_price)} USDC/gün</span>
                                                {elapsedDays && <span>📅 {elapsedDays} gün geçti</span>}
                                            </div>

                                            {/* Canlı maliyet sayacı */}
                                            {rental.status === 2 && accrued !== null && (
                                                <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2">
                                                    <span className="text-emerald-400/60 text-xs">Şu ana kadar:</span>
                                                    <span className="text-emerald-400 font-bold font-mono">${accrued} USDC</span>
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                                </div>
                                            )}

                                            {rental.status === 1 && (
                                                <p className="text-yellow-400/60 text-xs mt-1">
                                                    ⏳ Kiralama sahibin onayı bekleniyor ("Başlat" butonu)
                                                </p>
                                            )}
                                        </div>

                                        {/* Butonlar */}
                                        <div className="shrink-0 flex flex-col gap-2">
                                            {/* Aktif (status 2) → İade Et */}
                                            {rental.status === 2 && (
                                                <button
                                                    onClick={() => handleReturn(rental.rental_id)}
                                                    disabled={loading || actionLoading === rental.rental_id}
                                                    className="btn-success text-sm !px-4 !py-2"
                                                >
                                                    {actionLoading === rental.rental_id
                                                        ? <><span className="animate-spin">⏳</span></>
                                                        : <>📦 İade Et</>}
                                                </button>
                                            )}
                                            {/* Depozito yatırıldı (status 1) → İptal */}
                                            {rental.status === 1 && (
                                                <button
                                                    onClick={() => handleCancelDeposit(rental.rental_id)}
                                                    disabled={loading || actionLoading === rental.rental_id}
                                                    className="px-4 py-2 rounded-xl text-sm border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all"
                                                >
                                                    {actionLoading === rental.rental_id
                                                        ? <span className="animate-spin">⏳</span>
                                                        : <>↩️ İptal</>}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Fotoğraf Yükleme Modalı */}
            {returnModalOpen && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                    <div className="bg-[#0b1021] border border-stellar-500/30 rounded-2xl w-full max-w-md p-6 relative shadow-2xl shadow-stellar-500/10">
                        <button
                            onClick={() => setReturnModalOpen(false)}
                            className="absolute top-4 right-4 text-white/40 hover:text-white"
                        >
                            ✕
                        </button>
                        <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                            <span>📸</span> İade Kanıtı Yükle
                        </h3>
                        <p className="text-white/50 text-sm mb-6">
                            Ekipmanı iade ettiğinizi kanıtlamak için bir fotoğraf yükleyin. Fotoğrafın kriptografik özeti (hash) güvenlik için blok zincirine kaydedilecektir.
                        </p>

                        <div className="mb-6">
                            <label className="block text-sm font-medium text-white/70 mb-2">Fotoğraf Seç</label>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => setReturnFile(e.target.files?.[0] || null)}
                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-stellar-500 transition-colors file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-stellar-500/20 file:text-stellar-400 hover:file:bg-stellar-500/30"
                            />
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setReturnModalOpen(false)}
                                className="flex-1 px-4 py-3 rounded-xl border border-white/10 text-white/70 hover:bg-white/5 hover:text-white transition-all font-semibold"
                            >
                                İptal
                            </button>
                            <button
                                onClick={handleReturnSubmit}
                                disabled={actionLoading === selectedRentalId}
                                className="flex-1 btn-primary py-3"
                            >
                                {actionLoading === selectedRentalId ? <span className="animate-spin">⏳</span> : "Kanıtı Yükle & İade Et"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
