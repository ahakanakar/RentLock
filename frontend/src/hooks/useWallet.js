/**
 * RentLock — Freighter Cüzdan Hook'u
 *
 * Freighter cüzdan bağlantısını yönetir.
 * Cüzdan yüklü değilse mock modda çalışır.
 */

import { useState, useCallback, useEffect } from "react";

const MOCK_ADDRESS = "GBXYZ...MOCK_WALLET";

export function useWallet() {
    const [address, setAddress] = useState("");
    const [connected, setConnected] = useState(false);
    const [isFreighter, setIsFreighter] = useState(false);
    const [loading, setLoading] = useState(false);

    // Freighter varlığını kontrol et
    useEffect(() => {
        const check = async () => {
            try {
                if (window.freighterApi) {
                    setIsFreighter(true);
                }
            } catch {
                setIsFreighter(false);
            }
        };
        // Freighter yüklenmesini biraz bekle
        setTimeout(check, 500);
    }, []);

    const connect = useCallback(async () => {
        setLoading(true);
        try {
            if (isFreighter && window.freighterApi) {
                const { address: addr } = await window.freighterApi.requestAccess();
                setAddress(addr);
                setConnected(true);
                console.log("🔗 [Wallet] Freighter bağlandı:", addr);
            } else {
                // Mock mode — Freighter yüklü değil
                setAddress(MOCK_ADDRESS);
                setConnected(true);
                console.log("🔗 [Wallet] Mock cüzdan bağlandı");
            }
        } catch (error) {
            console.error("❌ [Wallet] Bağlantı hatası:", error);
            // Fallback to mock
            setAddress(MOCK_ADDRESS);
            setConnected(true);
        } finally {
            setLoading(false);
        }
    }, [isFreighter]);

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
        connect,
        disconnect,
        isMock: connected && !isFreighter,
    };
}
