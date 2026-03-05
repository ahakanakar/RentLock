/**
 * Panel 1 — Kiraya Veren (Owner Panel)
 *
 * Ekipman listeleme, aktif kiralama durumları, kiralama başlatma.
 */

import { useState } from "react";
import { STATUS_MAP, formatUSDC, formatAddress } from "../services/soroban.js";

export default function OwnerPanel({ equipments, loading, onCreateRental, onStartRental, onSubmitProof }) {
    const [equipmentId, setEquipmentId] = useState("");
    const [dailyPrice, setDailyPrice] = useState("");
    const [depositAmount, setDepositAmount] = useState("");
    const [creating, setCreating] = useState(false);

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

    return (
        <div className="space-y-6">
            {/* ─── Ekipman Ekleme Formu ─── */}
            <div className="glass p-6">
                <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                    <span className="text-2xl">📦</span> Yeni Ekipman Ekle
                </h2>
                <p className="text-white/40 text-sm mb-5">Ekipmanınızı sisteme ekleyerek kiralık hale getirin</p>

                <form onSubmit={handleCreate} className="space-y-4">
                    <div>
                        <label className="block text-white/60 text-sm mb-1.5">Ekipman Adı / ID</label>
                        <input
                            type="text"
                            className="input-field"
                            placeholder="Örn: DRONE-DJI-MAVIC-3"
                            value={equipmentId}
                            onChange={(e) => setEquipmentId(e.target.value)}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-white/60 text-sm mb-1.5">Günlük Fiyat (USDC)</label>
                            <input
                                type="number"
                                step="0.01"
                                className="input-field"
                                placeholder="15.00"
                                value={dailyPrice}
                                onChange={(e) => setDailyPrice(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-white/60 text-sm mb-1.5">Depozito (USDC)</label>
                            <input
                                type="number"
                                step="0.01"
                                className="input-field"
                                placeholder="100.00"
                                value={depositAmount}
                                onChange={(e) => setDepositAmount(e.target.value)}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={creating || !equipmentId || !dailyPrice || !depositAmount}
                        className="btn-primary w-full flex items-center justify-center gap-2"
                    >
                        {creating ? (
                            <>
                                <span className="animate-spin">⏳</span> İşleniyor...
                            </>
                        ) : (
                            <>🚀 Ekipmanı Sisteme Ekle</>
                        )}
                    </button>
                </form>
            </div>

            {/* ─── Aktif Kiralamalar ─── */}
            <div className="glass p-6">
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <span className="text-2xl">📋</span> Kiralamalarım
                    <span className="ml-auto text-sm font-normal text-white/40">
                        {equipments.length} kayıt
                    </span>
                </h2>

                {equipments.length === 0 ? (
                    <div className="text-center py-8 text-white/30">
                        <p className="text-4xl mb-2">📭</p>
                        <p>Henüz kiralama yok</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {equipments.map((rental) => {
                            const status = STATUS_MAP[rental.status] || STATUS_MAP[0];
                            return (
                                <div
                                    key={rental.rental_id}
                                    className="glass-hover p-4 flex items-center gap-4"
                                >
                                    <div className="text-3xl">{status.icon}</div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-semibold text-white truncate">
                                                {rental.equipment_id}
                                            </span>
                                            <span className={`status-badge ${status.color}`}>
                                                {status.label}
                                            </span>
                                        </div>
                                        <div className="flex gap-4 text-sm text-white/40">
                                            <span>💵 {formatUSDC(rental.daily_price)} USDC/gün</span>
                                            <span>🔒 {formatUSDC(rental.deposit_amount)} USDC depozito</span>
                                            {rental.renter && rental.status >= 1 && (
                                                <span>👤 {formatAddress(rental.renter)}</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Aksiyon butonları */}
                                    <div className="flex gap-2 shrink-0">
                                        {rental.status === 1 && (
                                            <button
                                                onClick={() => onStartRental(rental.rental_id)}
                                                disabled={loading}
                                                className="btn-success text-sm !px-4 !py-2"
                                            >
                                                ▶ Başlat
                                            </button>
                                        )}
                                        {rental.status === 2 && rental.proof_hash === "0".repeat(64) && (
                                            <button
                                                onClick={() => onSubmitProof(rental.rental_id)}
                                                disabled={loading}
                                                className="btn-primary text-sm !px-4 !py-2"
                                            >
                                                📸 Proof
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
