/**
 * RentLock — Kontrat Etkileşim Hook'u
 *
 * Tüm kontrat operasyonlarını React state ile yönetir.
 * Mock data veya gerçek kontrat ile çalışır.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import * as soroban from "../services/soroban.js";

export function useContract() {
    const [equipments, setEquipments] = useState([]);
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [totalAccrued, setTotalAccrued] = useState(0);
    const intervalRef = useRef(null);

    // Ekipman listesini yükle
    const fetchEquipments = useCallback(async () => {
        try {
            const data = await soroban.getEquipments();
            setEquipments(data);
            setEvents(soroban.getEvents());
        } catch (err) {
            setError(err.message);
        }
    }, []);

    // İlk yüklemede veriyi çek
    useEffect(() => {
        fetchEquipments();
    }, [fetchEquipments]);

    // Canlı sayaç — aktif kiralama ücretlerini saniyede bir güncelle
    useEffect(() => {
        intervalRef.current = setInterval(() => {
            setEquipments((prev) => {
                const now = Math.floor(Date.now() / 1000);
                let total = 0;
                prev.forEach((r) => {
                    if (r.status === 2 && r.start_time > 0) {
                        const elapsed = now - r.start_time;
                        const dailyRate = r.daily_price / 10_000_000;
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

    // Event'leri periyodik güncelle
    useEffect(() => {
        const ev = setInterval(() => {
            setEvents(soroban.getEvents());
        }, 2000);
        return () => clearInterval(ev);
    }, []);

    // Yeni kiralama oluştur
    const createRental = useCallback(async (equipmentId, dailyPrice, depositAmount) => {
        setLoading(true);
        setError(null);
        try {
            await soroban.createRental(equipmentId, dailyPrice, depositAmount);
            await fetchEquipments();
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [fetchEquipments]);

    // Depozito yatır
    const deposit = useCallback(async (rentalId) => {
        setLoading(true);
        setError(null);
        try {
            await soroban.depositRental(rentalId);
            await fetchEquipments();
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [fetchEquipments]);

    // Kiralama başlat
    const startRental = useCallback(async (rentalId) => {
        setLoading(true);
        setError(null);
        try {
            await soroban.startRental(rentalId);
            await fetchEquipments();
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [fetchEquipments]);

    // Proof gönder
    const submitProof = useCallback(async (rentalId) => {
        setLoading(true);
        setError(null);
        try {
            await soroban.submitProof(rentalId);
            await fetchEquipments();
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [fetchEquipments]);

    // Kiralama sonlandır
    const endRental = useCallback(async (rentalId, isDisputed = false) => {
        setLoading(true);
        setError(null);
        try {
            await soroban.endRental(rentalId, isDisputed);
            await fetchEquipments();
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [fetchEquipments]);

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
        refresh: fetchEquipments,
    };
}
