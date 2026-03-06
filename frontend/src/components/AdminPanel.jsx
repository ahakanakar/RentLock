/**
 * Panel 3 — Admin Paneli
 *
 * Disputed (status 4) kiralamaları listeler.
 * NOT: Mevcut kontrat resolve_dispute fonksiyonunu desteklemiyor.
 * end_rental sırasında hash uyuşmazlığı olursa depozito anında sahibine
 * aktarılır; admin müdahalesi için on-chain mekanizma yok.
 */

import { formatUSDC, formatAddress, timeAgo } from "../services/soroban.js";

export default function AdminPanel({ equipments, events }) {
    const disputedRentals = equipments.filter((r) => r.status === 4);
    const activeRentals   = equipments.filter((r) => r.status === 2);
    const totalRentals    = equipments.length;

    const eventIcons = {
        RentalCreated: "📋", DepositMade: "💰", RentalStarted: "▶️",
        ProofSubmitted: "📸", RentalEnded: "🏁", DisputeOpened: "⚠️",
    };
    const eventColors = {
        RentalCreated: "text-blue-400", DepositMade: "text-yellow-400",
        RentalStarted: "text-emerald-400", ProofSubmitted: "text-purple-400",
        RentalEnded: "text-gray-400", DisputeOpened: "text-red-400",
    };

    return (
        <div className="space-y-6">

            {/* ─── Özet İstatistikler ─── */}
            <div className="grid grid-cols-3 gap-4">
                <div className="glass p-4 text-center">
                    <div className="text-3xl font-bold text-white">{totalRentals}</div>
                    <div className="text-white/40 text-xs mt-1">Toplam Kiralama</div>
                </div>
                <div className="glass p-4 text-center">
                    <div className="text-3xl font-bold text-emerald-400">{activeRentals.length}</div>
                    <div className="text-white/40 text-xs mt-1">Aktif Kiralama</div>
                </div>
                <div className="glass p-4 text-center">
                    <div className="text-3xl font-bold text-red-400">{disputedRentals.length}</div>
                    <div className="text-white/40 text-xs mt-1">Anlaşmazlık</div>
                </div>
            </div>

            {/* ─── Anlaşmazlıklar ─── */}
            <div className="glass p-6">
                <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                    <span className="text-2xl">⚠️</span> Anlaşmazlıklar
                </h2>
                <p className="text-white/40 text-sm mb-3">
                    Hash uyuşmazlığıyla sonuçlanan kiralamalar. Depozito kiraya verene aktarılmıştır.
                </p>

                {/* Kontrat sınırlaması uyarısı */}
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3 mb-5 text-yellow-400 text-xs leading-relaxed">
                    ℹ️ Mevcut kontrat <strong>resolve_dispute</strong> fonksiyonunu desteklemiyor.
                    Anlaşmazlık çözümü için kontrata bu fonksiyonun eklenmesi gerekir.
                    Depozito <em>end_rental</em> sırasında otomatik olarak kiraya verene aktarılmıştır.
                </div>

                {disputedRentals.length === 0 ? (
                    <div className="text-center py-8 text-white/25">
                        <p className="text-4xl mb-2">✅</p>
                        <p>Açık anlaşmazlık yok</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {disputedRentals.map((rental) => (
                            <div key={rental.rental_id} className="bg-red-500/5 border border-red-500/15 rounded-xl p-4">
                                <div className="flex items-start gap-4">
                                    <div className="text-2xl mt-0.5">⚠️</div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                            <span className="font-bold text-white">{rental.equipment_id}</span>
                                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-red-500/20 text-red-400 border border-red-500/20">
                                                Anlaşmazlık
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap gap-3 text-xs text-white/40">
                                            <span>🔒 {formatUSDC(rental.deposit_amount)} USDC</span>
                                            <span>👤 Sahip: {formatAddress(rental.owner)}</span>
                                            <span>🔑 Kiracı: {formatAddress(rental.renter)}</span>
                                        </div>
                                        <div className="mt-2 text-xs text-red-400/60">
                                            Depozito kiraya verene aktarıldı. On-chain müdahale mümkün değil.
                                        </div>
                                    </div>
                                    <div className="text-white/20 text-xs shrink-0">#{rental.rental_id}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ─── Son Eventler ─── */}
            <div className="glass p-6">
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <span className="text-2xl">⛓️</span> Son Zincir Eventleri
                </h2>
                {events.length === 0 ? (
                    <div className="text-center py-4 text-white/25"><p>Henüz event yok</p></div>
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
