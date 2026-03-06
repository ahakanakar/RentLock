/**
 * RentLock — Ana Uygulama
 *
 * Rol bazlı ayrım: Giriş ekranında cüzdan bağla + rol seç.
 * Seçilen rol'e göre ilgili dashboard açılır.
 * Roller arası geçiş yok, çıkış ile tekrar rol seçim ekranına dönülür.
 */

import { useState } from "react";
import { useWallet } from "./hooks/useWallet.js";
import { useContract } from "./hooks/useContract.js";
import OwnerPanel from "./components/OwnerPanel.jsx";
import RenterPanel from "./components/RenterPanel.jsx";

export default function App() {
    const [role, setRole] = useState(null); // null | "owner" | "renter"
    const [walletError, setWalletError] = useState("");
    const wallet = useWallet();
    const contract = useContract(wallet.address);

    // Çıkış: hem rolü sıfırla hem cüzdanı kes
    const handleLogout = () => {
        setRole(null);
        wallet.disconnect();
    };

    // ─── Giriş Ekranı ───────────────────────────────────
    if (!wallet.connected || !role) {
        return (
            <div className="min-h-screen flex flex-col">
                {/* Arka plan dekorasyon */}
                <div className="fixed inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-stellar-600/5 rounded-full blur-[150px]" />
                    <div className="absolute bottom-[-300px] right-[-200px] w-[600px] h-[600px] bg-stellar-400/3 rounded-full blur-[120px]" />
                </div>

                <div className="flex-1 flex items-center justify-center px-6 relative z-10">
                    <div className="w-full max-w-xl">
                        {/* Logo & Başlık */}
                        <div className="text-center mb-10">
                            <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-stellar-600/30 to-stellar-400/10 flex items-center justify-center text-4xl mb-6 border border-stellar-500/20 shadow-lg shadow-stellar-500/10">
                                🔐
                            </div>
                            <h1 className="text-4xl font-extrabold bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent mb-3">
                                RentLock
                            </h1>
                            <p className="text-white/40 text-sm max-w-sm mx-auto leading-relaxed">
                                Stellar Soroban üzerinde merkezi olmayan ekipman kiralama protokolü.
                                Güvenli depozito, şeffaf ödeme, hash tabanlı kanıt sistemi.
                            </p>
                        </div>

                        {/* Adım 1: Cüzdan Bağlantısı */}
                        {!wallet.connected ? (
                            <div className="glass p-8 text-center">
                                <div className="text-3xl mb-4">🔗</div>
                                <h2 className="text-xl font-bold text-white mb-2">Cüzdanını Bağla</h2>
                                <p className="text-white/40 text-sm mb-6">
                                    Devam etmek için Freighter cüzdanınızı bağlayın.
                                    Tüm işlemler Stellar Testnet üzerinde gerçekleşir.
                                </p>
                                {walletError && (
                                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-4 text-red-400 text-sm">
                                        {walletError}
                                    </div>
                                )}
                                {wallet.notInstalled && !wallet.checking && (
                                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3 mb-4 text-left">
                                        <p className="text-yellow-400 text-sm font-semibold mb-1">⚠️ Freighter cüzdan eklentisi bulunamadı</p>
                                        <p className="text-yellow-400/60 text-xs mb-3">
                                            RentLock'u kullanmak için Freighter tarayıcı eklentisini yüklemeniz gerekiyor.
                                        </p>
                                        <a href="https://freighter.app" target="_blank" rel="noopener noreferrer"
                                            className="inline-block px-4 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/30 rounded-lg text-yellow-400 text-sm font-semibold transition-colors">
                                            📥 Freighter'ı İndir → freighter.app
                                        </a>
                                    </div>
                                )}
                                <button
                                    onClick={async () => {
                                        setWalletError("");
                                        try {
                                            await wallet.connect();
                                        } catch (err) {
                                            setWalletError(err.message);
                                        }
                                    }}
                                    disabled={wallet.loading || wallet.checking}
                                    className="btn-primary text-lg px-10 py-4 w-full"
                                >
                                    {wallet.checking ? (
                                        <>⏳ Freighter aranıyor...</>
                                    ) : wallet.loading ? (
                                        <span className="animate-spin">⏳</span>
                                    ) : (
                                        <>🔗 Freighter ile Bağlan</>
                                    )}
                                </button>
                                {!wallet.notInstalled && (
                                    <a href="https://freighter.app" target="_blank" rel="noopener noreferrer"
                                        className="block text-stellar-400/50 hover:text-stellar-400 text-xs mt-4 transition-colors">
                                        Freighter cüzdanı yüklü değil mi? → freighter.app
                                    </a>
                                )}
                            </div>
                        ) : (
                            /* Adım 2: Rol Seçimi */
                            <div>
                                {/* Bağlı cüzdan bilgisi */}
                                <div className="flex items-center justify-center gap-2 mb-6">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                    <span className="text-white/50 text-sm font-mono">
                                        {wallet.address.length > 12
                                            ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`
                                            : wallet.address}
                                    </span>
                                    <span className="px-2 py-0.5 rounded-md bg-stellar-500/10 text-stellar-400 text-[10px] font-semibold border border-stellar-500/20">
                                        TESTNET
                                    </span>
                                </div>

                                <h2 className="text-center text-lg font-semibold text-white/70 mb-5">
                                    Rolünüzü seçin
                                </h2>

                                <div className="grid grid-cols-2 gap-4">
                                    {/* Kiraya Veren Butonu */}
                                    <button
                                        onClick={() => setRole("owner")}
                                        className="glass-hover p-8 text-center group cursor-pointer"
                                    >
                                        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-stellar-600/20 to-stellar-400/5 flex items-center justify-center text-3xl mb-4 border border-stellar-500/10 group-hover:border-stellar-500/30 group-hover:shadow-lg group-hover:shadow-stellar-500/10 transition-all">
                                            🏠
                                        </div>
                                        <h3 className="text-lg font-bold text-white mb-1">Kiraya Veren</h3>
                                        <p className="text-white/30 text-xs leading-relaxed">
                                            Ekipmanlarınızı listeleyin, kiralama sürecini yönetin
                                        </p>
                                    </button>

                                    {/* Kiracı Butonu */}
                                    <button
                                        onClick={() => setRole("renter")}
                                        className="glass-hover p-8 text-center group cursor-pointer"
                                    >
                                        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-emerald-600/20 to-emerald-400/5 flex items-center justify-center text-3xl mb-4 border border-emerald-500/10 group-hover:border-emerald-500/30 group-hover:shadow-lg group-hover:shadow-emerald-500/10 transition-all">
                                            🔑
                                        </div>
                                        <h3 className="text-lg font-bold text-white mb-1">Kiracı</h3>
                                        <p className="text-white/30 text-xs leading-relaxed">
                                            Ekipman kiralayın, depozito yatırın, iade edin
                                        </p>
                                    </button>
                                </div>

                                <button
                                    onClick={wallet.disconnect}
                                    className="w-full mt-4 py-2 text-sm text-white/20 hover:text-white/50 transition-colors text-center"
                                >
                                    Cüzdan bağlantısını kes
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <footer className="text-center py-4 text-xs text-white/15">
                    RentLock Protocol © 2025 — Powered by Stellar Soroban
                </footer>
            </div>
        );
    }

    // ─── Dashboard ───────────────────────────────────────
    return (
        <div className="min-h-screen flex flex-col">
            {/* Header */}
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
                                {role === "owner" ? "Kiraya Veren Paneli" : "Kiracı Paneli"}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Rol badge */}
                        <span className={`px-3 py-1 rounded-lg text-xs font-semibold border ${role === "owner"
                            ? "bg-stellar-500/10 text-stellar-400 border-stellar-500/20"
                            : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            }`}>
                            {role === "owner" ? "🏠 Kiraya Veren" : "🔑 Kiracı"}
                        </span>

                        <span className="px-2 py-0.5 rounded-md bg-stellar-500/10 text-stellar-400 text-[10px] font-semibold border border-stellar-500/20">
                            TESTNET
                        </span>

                        {/* Cüzdan adresi */}
                        <div className="glass px-4 py-2 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-sm text-white/70 font-mono">
                                {wallet.address.length > 12
                                    ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`
                                    : wallet.address}
                            </span>
                        </div>

                        {/* Çıkış butonu */}
                        <button
                            onClick={handleLogout}
                            className="px-4 py-2 rounded-xl text-sm text-white/40 hover:text-white hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all"
                        >
                            🚪 Çıkış
                        </button>
                    </div>
                </div>
            </header>

            {/* Error Banner */}
            {contract.error && (
                <div className="max-w-6xl mx-auto px-6 mt-4">
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 flex items-center gap-2 text-red-400 text-sm">
                        <span>❌</span>
                        <span>{contract.error}</span>
                    </div>
                </div>
            )}

            {/* Panel İçeriği */}
            <main className="flex-1 max-w-6xl mx-auto px-6 py-6 w-full">
                {role === "owner" ? (
                    <OwnerPanel
                        equipments={contract.equipments}
                        events={contract.events}
                        totalAccrued={contract.totalAccrued}
                        loading={contract.loading}
                        onCreateRental={contract.createRental}
                        onStartRental={contract.startRental}
                        onSubmitProof={contract.submitProof}
                        onEndRental={contract.endRental}
                    />
                ) : (
                    <RenterPanel
                        equipments={contract.equipments}
                        loading={contract.loading}
                        onDeposit={contract.deposit}
                        onEndRental={contract.endRental}
                    />
                )}
            </main>

            {/* Footer */}
            <footer className="border-t border-white/5 mt-auto">
                <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between text-xs text-white/20">
                    <span>RentLock Protocol © 2025</span>
                    <span>Powered by Stellar Soroban</span>
                </div>
            </footer>
        </div>
    );
}
