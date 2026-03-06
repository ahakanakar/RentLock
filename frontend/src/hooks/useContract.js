/**
 * RentLock — Kontrat Etkileşim Hook'u
 *
 * Stellar Testnet kontratına gerçek bağlantı.
 * Her 5 saniyede bir kontratdan veri çeker (polling).
 * Mock data KULLANMAZ.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import * as soroban from "../services/soroban.js";

export function useContract(walletAddress) {
    const [equipments, setEquipments] = useState([]);
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [totalAccrued, setTotalAccrued] = useState(0);
    const intervalRef = useRef(null);
    const pollingRef = useRef(null);

    // Ekipman listesini kontratdan çek
    const fetchEquipments = useCallback(async () => {
        if (!walletAddress) return;
        try {
            const data = await soroban.getEquipments(walletAddress);
            setEquipments(data);
            setEvents(soroban.getEvents());
        } catch (err) {
            console.error("❌ [Contract] Fetch error:", err.message);
        }
    }, [walletAddress]);

    // Kontratdan 7 saniyede bir sıralı (overlap olmadan) polling
    useEffect(() => {
        if (!walletAddress) return;

        let isActive = true;

        const poll = async () => {
            if (!isActive) return;
            await fetchEquipments();
            if (isActive) {
                pollingRef.current = setTimeout(poll, 7000); // 7s delay after finish
            }
        };

        poll(); // İlk yükleme ve döngüyü başlat

        return () => {
            isActive = false;
            if (pollingRef.current) clearTimeout(pollingRef.current);
        };
    }, [walletAddress, fetchEquipments]);

    // Canlı USDC sayacı — her saniye güncelle
    useEffect(() => {
        intervalRef.current = setInterval(() => {
            setEquipments((prev) => {
                const now = Math.floor(Date.now() / 1000);
                let total = 0;
                prev.forEach((r) => {
                    if (r.status === 2 && r.start_time > 0) {
                        const elapsed = now - Number(r.start_time);
                        const dailyRate = Number(r.daily_price) / 10_000_000;
                        const accrued = (elapsed / 86400) * dailyRate;
                        total += accrued;
                    }
                });
                setTotalAccrued(total);
                return prev;
            });
        }, 1000);

        return () => clearInterval(intervalRef.current);
    }, []);

    // ─── Kontrat İşlemleri ──────────────────────────────

    const createRental = useCallback(async (equipmentId, dailyPrice, depositAmount) => {
        setLoading(true);
        setError(null);
        try {
            await soroban.createRental(walletAddress, equipmentId, dailyPrice, depositAmount);
            await fetchEquipments();
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [walletAddress, fetchEquipments]);

    const deposit = useCallback(async (rentalId) => {
        setLoading(true);
        setError(null);
        try {
            await soroban.depositRental(walletAddress, rentalId);
            await fetchEquipments();
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [walletAddress, fetchEquipments]);

    const startRental = useCallback(async (rentalId) => {
        setLoading(true);
        setError(null);
        try {
            await soroban.startRental(walletAddress, rentalId);
            await fetchEquipments();
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [walletAddress, fetchEquipments]);

    // description: kiracının girdiği serbest metin; SHA-256 hash'e çevrilip zincire yazılır
    const submitProof = useCallback(async (rentalId, description) => {
        setLoading(true);
        setError(null);
        try {
            await soroban.submitProof(walletAddress, rentalId, description);
            await fetchEquipments();
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [walletAddress, fetchEquipments]);

    const endRental = useCallback(async (rentalId, isDisputed = false) => {
        setLoading(true);
        setError(null);
        try {
            await soroban.endRental(walletAddress, rentalId, isDisputed);
            await fetchEquipments();
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [walletAddress, fetchEquipments]);

    // Kiraya veren: iade talebini onaylar → proof_hash ile aynı hash → Completed
    const approveReturn = useCallback(async (rentalId) => {
        setLoading(true);
        setError(null);
        try {
            await soroban.approveReturn(walletAddress, rentalId);
            await fetchEquipments();
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [walletAddress, fetchEquipments]);

    // Kiraya veren: iade talebini reddeder → farklı hash → Disputed → depozito sahibine
    const openDispute = useCallback(async (rentalId) => {
        setLoading(true);
        setError(null);
        try {
            await soroban.openDispute(walletAddress, rentalId);
            await fetchEquipments();
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [walletAddress, fetchEquipments]);

    return {
        equipments,
        events,
        loading,
        error,
        totalAccrued,
        createRental,
        deposit,
        startRental,
        submitProof,
        endRental,
        approveReturn,
        openDispute,
        refresh: fetchEquipments,
    };
}
