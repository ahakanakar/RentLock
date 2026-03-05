/**
 * RentLock — Ana Uygulama
 *
 * 3 sekmeli layout: Kiraya Veren, Kiracı, Kontrat Durumu
 * Freighter cüzdan bağlantısı + kontrat etkileşimleri
 */

import { useState } from "react";
import { useWallet } from "./hooks/useWallet.js";
import { useContract } from "./hooks/useContract.js";
import OwnerPanel from "./components/OwnerPanel.jsx";
import RenterPanel from "./components/RenterPanel.jsx";
import AdminPanel from "./components/AdminPanel.jsx";

const TABS = [
    { id: "owner", label: "Kiraya Veren", icon: "🏠", desc: "Ekipman yönetimi" },
    { id: "renter", label: "Kiracı", icon: "🔑", desc: "Ekipman kiralama" },
    { id: "admin", label: "Kontrat Durumu", icon: "📊", desc: "Canlı takip" },
];

export default function App() {
    const [activeTab, setActiveTab] = useState("owner");
    const wallet = useWallet();
    const contract = useContract();

    return (
        <div className="min-h-screen">
            {/* ─── Header ─── */}
            <header className="border-b border-white/5">
                <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-stellar-500 to-stellar-700 flex items-center justify-center text-xl shadow-lg shadow-stellar-500/20">
                            🔐
                        </div>
                        <div>
                            <h1 className="text-xl font-bold bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">
                                RentLock
                            </h1>
                            <p className="text-[10px] text-white/30 -mt-0.5 tracking-wider uppercase">
                                Decentralized Equipment Rental
                            </p>
                        </div>
                    </div>

                    {/* Cüzdan Bağlantısı */}
                    <div className="flex items-center gap-3">
                        {wallet.connected ? (
                            <div className="flex items-center gap-3">
                                {wallet.isMock && (
                                    <span className="px-2 py-0.5 rounded-md bg-yellow-500/10 text-yellow-400 text-[10px] font-semibold border border-yellow-500/20">
                                        MOCK MODE
                                    </span>
                                )}
                                <div className="glass px-4 py-2 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                    <span className="text-sm text-white/70 font-mono">
                                        {wallet.address.length > 12
                                            ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`
                                            : wallet.address}
                                    </span>
                                </div>
                                <button
                                    onClick={wallet.disconnect}
                                    className="px-3 py-2 rounded-xl text-sm text-white/40 hover:text-white/70 hover:bg-white/5 transition-all"
                                >
                                    Çıkış
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={wallet.connect}
                                disabled={wallet.loading}
                                className="btn-primary text-sm"
                            >
                                {wallet.loading ? (
                                    <span className="animate-spin">⏳</span>
                                ) : (
                                    <>🔗 Cüzdan Bağla</>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {/* ─── Tab Navigation ─── */}
            <nav className="border-b border-white/5">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="flex gap-1">
                        {TABS.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`
                  relative px-6 py-4 text-sm font-medium transition-all duration-200
                  ${activeTab === tab.id
                                        ? "text-white"
                                        : "text-white/40 hover:text-white/70"
                                    }
                `}
                            >
                                <span className="flex items-center gap-2">
                                    <span className="text-lg">{tab.icon}</span>
                                    <span>{tab.label}</span>
                                    <span className="hidden sm:inline text-xs text-white/20">
                                        {tab.desc}
                                    </span>
                                </span>
                                {/* Active indicator */}
                                {activeTab === tab.id && (
                                    <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-gradient-to-r from-stellar-500 to-stellar-400 rounded-full" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </nav>

            {/* ─── Error Banner ─── */}
            {contract.error && (
                <div className="max-w-6xl mx-auto px-6 mt-4">
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 flex items-center gap-2 text-red-400 text-sm">
                        <span>❌</span>
                        <span>{contract.error}</span>
                    </div>
                </div>
            )}

            {/* ─── Bağlantı Gerekli Uyarısı ─── */}
            {!wallet.connected ? (
                <div className="max-w-6xl mx-auto px-6 mt-16">
                    <div className="text-center">
                        <div className="w-24 h-24 mx-auto rounded-2xl bg-gradient-to-br from-stellar-600/20 to-stellar-400/5 flex items-center justify-center text-5xl mb-6 border border-stellar-500/10">
                            🔐
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">
                            RentLock'a Hoş Geldiniz
                        </h2>
                        <p className="text-white/40 max-w-md mx-auto mb-8">
                            Stellar Soroban üzerinde merkezi olmayan ekipman kiralama protokolü.
                            Başlamak için cüzdanınızı bağlayın.
                        </p>
                        <button onClick={wallet.connect} className="btn-primary text-lg px-8 py-4">
                            🔗 Cüzdan Bağla
                        </button>
                        <p className="text-white/20 text-xs mt-4">
                            Freighter cüzdan yüklü değilse mock modda çalışır
                        </p>
                    </div>
                </div>
            ) : (
                /* ─── Panel İçeriği ─── */
                <main className="max-w-6xl mx-auto px-6 py-6">
                    {activeTab === "owner" && (
                        <OwnerPanel
                            equipments={contract.equipments}
                            loading={contract.loading}
                            onCreateRental={contract.createRental}
                            onStartRental={contract.startRental}
                            onSubmitProof={contract.submitProof}
                        />
                    )}
                    {activeTab === "renter" && (
                        <RenterPanel
                            equipments={contract.equipments}
                            loading={contract.loading}
                            onDeposit={contract.deposit}
                            onEndRental={contract.endRental}
                        />
                    )}
                    {activeTab === "admin" && (
                        <AdminPanel
                            equipments={contract.equipments}
                            events={contract.events}
                            totalAccrued={contract.totalAccrued}
                            loading={contract.loading}
                            onEndRental={contract.endRental}
                        />
                    )}
                </main>
            )}

            {/* ─── Footer ─── */}
            <footer className="border-t border-white/5 mt-auto">
                <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between text-xs text-white/20">
                    <span>RentLock Protocol © 2025</span>
                    <span>Powered by Stellar Soroban</span>
                </div>
            </footer>
        </div>
    );
}
