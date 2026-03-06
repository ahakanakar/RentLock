/**
 * RentLock — Freighter Cüzdan Hook'u
 *
 * @stellar/freighter-api paketini kullanır (window.freighter DEĞİL).
 * Retry mekanizması: 3 saniye timeout, 500ms aralıkla kontrol.
 * Yüklü değilse indirme linki gösterir.
 */

import { useState, useCallback, useEffect } from "react";
import {
    requestAccess,
    signTransaction,
    isConnected as checkIsConnected,
} from "@stellar/freighter-api";

// Freighter'ın yüklenmesini bekleyen retry fonksiyonu
async function waitForFreighter(timeoutMs = 3000, intervalMs = 500) {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
        try {
            const result = await checkIsConnected();
            // freighter-api v2 dönüş formatı
            const connected =
                typeof result === "object" ? result.isConnected : result;
            if (connected) {
                console.log("🔍 [Wallet] Freighter bulundu ✅");
                return true;
            }
        } catch {
            // Henüz yüklenmedi, tekrar dene
        }
        await new Promise((r) => setTimeout(r, intervalMs));
    }

    console.log("🔍 [Wallet] Freighter bulunamadı (3sn timeout) ❌");
    return false;
}

export function useWallet() {
    const [address, setAddress] = useState("");
    const [connected, setConnected] = useState(false);
    const [isFreighter, setIsFreighter] = useState(false);
    const [loading, setLoading] = useState(false);
    const [checking, setChecking] = useState(true);
    const [notInstalled, setNotInstalled] = useState(false);

    // Sayfa yüklendiğinde Freighter'ı ara (retry ile)
    useEffect(() => {
        let cancelled = false;
        const detect = async () => {
            const found = await waitForFreighter();
            if (!cancelled) {
                setIsFreighter(found);
                setNotInstalled(!found);
                setChecking(false);
            }
        };
        detect();
        return () => {
            cancelled = true;
        };
    }, []);

    const connect = useCallback(async () => {
        setLoading(true);
        try {
            // Önce Freighter varlığını tekrar kontrol et
            const connResult = await checkIsConnected();
            const isAvailable =
                typeof connResult === "object"
                    ? connResult.isConnected
                    : connResult;

            if (!isAvailable) {
                setNotInstalled(true);
                throw new Error(
                    "Freighter cüzdan eklentisi yüklü değil. Lütfen freighter.app adresinden yükleyin."
                );
            }

            // Freighter'dan erişim iste
            const result = await requestAccess();

            // v2 API dönüş formatını kontrol et
            const addr = typeof result === "object" ? result.address : result;

            if (!addr) {
                throw new Error("Freighter'dan adres alınamadı. Lütfen eklentiyi kontrol edin.");
            }

            setAddress(addr);
            setConnected(true);
            setIsFreighter(true);
            setNotInstalled(false);
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
        notInstalled,
        connect,
        disconnect,
        // Dışarıdan transaction imzalamak için export ediyoruz
        signTransaction,
    };
}
