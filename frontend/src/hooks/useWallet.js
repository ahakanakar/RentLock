/**
 * RentLock — Freighter Cüzdan Hook'u
 *
 * Gerçek Freighter cüzdan entegrasyonu.
 * Freighter yüklü değilse bağlantı yapılamaz.
 */

import { useState, useCallback, useEffect } from "react";

export function useWallet() {
    const [address, setAddress] = useState("");
    const [connected, setConnected] = useState(false);
    const [isFreighter, setIsFreighter] = useState(false);
    const [loading, setLoading] = useState(false);
    const [checking, setChecking] = useState(true);

    // Freighter varlığını kontrol et
    useEffect(() => {
        const check = async () => {
            // Freighter inject olana kadar biraz bekle
            await new Promise((r) => setTimeout(r, 800));
            try {
                if (window.freighterApi) {
                    const { isConnected } = await window.freighterApi.isConnected();
                    setIsFreighter(isConnected);
                    console.log(`🔍 [Wallet] Freighter ${isConnected ? "bulundu ✅" : "bulunamadı ❌"}`);
                } else {
                    setIsFreighter(false);
                    console.log("🔍 [Wallet] Freighter yüklü değil");
                }
            } catch {
                setIsFreighter(false);
            }
            setChecking(false);
        };
        check();
    }, []);

    const connect = useCallback(async () => {
        setLoading(true);
        try {
            if (!window.freighterApi) {
                throw new Error("Freighter cüzdan yüklü değil. Lütfen Freighter eklentisini yükleyin: https://freighter.app");
            }

            // Freighter'dan erişim iste
            const result = await window.freighterApi.requestAccess();

            if (result.error) {
                throw new Error(result.error);
            }

            const addr = result.address;
            setAddress(addr);
            setConnected(true);
            setIsFreighter(true);
            console.log("🔗 [Wallet] Freighter bağlandı:", addr);
        } catch (error) {
            console.error("❌ [Wallet] Bağlantı hatası:", error.message);
            throw error;
        } finally {
            setLoading(false);
        }
    }, []);

    const disconnect = useCallback(() => {
        setAddress("");
        setConnected(false);
        console.log("🔌 [Wallet] Bağlantı kesildi");
    }, []);

    return {
        address,
        connected,
        isFreighter,
        loading,
        checking,
        connect,
        disconnect,
    };
}
