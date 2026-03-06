/**
 * Panel 2 — Kiracı (Renter Panel)
 *
 * Mevcut ekipmanları görüntüleme, depozito kilitleme, iade.
 */

import { useState, useRef } from "react";
import { STATUS_MAP, formatUSDC, formatAddress } from "../services/soroban.js";

export default function RenterPanel({ equipments, loading, onDeposit, onEndRental, walletAddress }) {
    const [selectedRental, setSelectedRental] = useState(null);
    const [actionLoading, setActionLoading] = useState(null);
    const fileInputRef = useRef(null);

    const availableRentals = equipments.filter((r) => r.status === 0);
    const myRentals = equipments.filter((r) => r.status >= 1 && r.status <= 2);

    const handleDeposit = async (rentalId) => {
        setActionLoading(rentalId);
        try {
            await onDeposit(rentalId);
        } catch (err) {
            console.error(err);
        }
        setActionLoading(null);
    };

    const handleReturn = async (rentalId) => {
        setActionLoading(rentalId);
        try {
            await onEndRental(rentalId, false);
        } catch (err) {
            console.error(err);
        }
        setActionLoading(null);
        setSelectedRental(null);
    };

    return (
        <div className="space-y-6">

            {/* ─── Mevcut Ekipmanlar ─── */}
            <div className="glass p-6">
                <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                    <span className="text-2xl">🏪</span> Kiralık Ekipmanlar
                </h2>
                <p className="text-white/40 text-sm mb-5">Uygun ekipmanları görüntüleyin ve depozito kilitleyin</p>

                {availableRentals.length === 0 ? (
                    <div className="text-center py-8 text-white/30">
                        <p className="text-4xl mb-2">🔍</p>
                        <p>Kiralık ekipman bulunamadı</p>
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
                                        <div className="flex gap-4 text-sm text-white/50 mt-1">
                                            <span>💵 {formatUSDC(rental.daily_price)} USDC/gün</span>
                                            <span>🔒 {formatUSDC(rental.deposit_amount)} USDC depozito</span>
                                        </div>
                                        <div className="text-xs text-white/30 mt-1">
                                            Sahip: {formatAddress(rental.owner)}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleDeposit(rental.rental_id)}
                                        disabled={loading || actionLoading === rental.rental_id}
                                        className="btn-primary text-sm shrink-0"
                                    >
                                        {actionLoading === rental.rental_id ? (
                                            <span className="animate-spin">⏳</span>
                                        ) : (
                                            <>💰 Depozito Kilitle &amp; Kirala</>
                                        )}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ─── Aktif Kiralamalarım ─── */}
            <div className="glass p-6">
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <span className="text-2xl">🔑</span> Aktif Kiralamalarım
                    <span className="ml-auto text-sm font-normal text-white/40">{myRentals.length} kiralama</span>
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
                            const elapsedDays = rental.start_time > 0
                                ? ((Date.now() / 1000 - rental.start_time) / 86400).toFixed(1)
                                : "—";
                            return (
                                <div key={rental.rental_id} className="glass-hover p-4">
                                    <div className="flex items-center gap-4">
                                        <div className="text-3xl">{status.icon}</div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-semibold text-white">{rental.equipment_id}</span>
                                                <span className={`status-badge ${status.color}`}>{status.label}</span>
                                            </div>
                                            <div className="flex gap-4 text-sm text-white/40">
                                                <span>📅 {elapsedDays} gün</span>
                                                <span>🔒 {formatUSDC(rental.deposit_amount)} USDC kilitli</span>
                                            </div>
                                        </div>
                                        {rental.status === 2 && (
                                            <button
                                                onClick={() => {
                                                    setSelectedRental(rental.rental_id);
                                                    fileInputRef.current?.click();
                                                }}
                                                disabled={loading || actionLoading === rental.rental_id}
                                                className="btn-success text-sm !px-4 !py-2 shrink-0"
                                            >
                                                {actionLoading === rental.rental_id ? (
                                                    <span className="animate-spin">⏳</span>
                                                ) : (
                                                    <>📷 İade Et + Fotoğraf</>
                                                )}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

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
