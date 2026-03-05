#![no_std]

//! # RentLock — Decentralized Equipment Rental Protocol
//!
//! Stellar Soroban üzerinde çalışan ekipman kiralama akıllı kontratı.
//! Depozito escrow mekanizması, hash tabanlı kanıt doğrulama ve
//! USDC token entegrasyonu içerir.

use soroban_sdk::{contract, contractimpl, token, Address, BytesN, Env, String};

mod errors;
mod events;
mod storage;
mod types;

use errors::ContractError;
use types::{RentalAgreement, RentalStatus};

#[contract]
pub struct RentLockContract;

#[contractimpl]
impl RentLockContract {
    // ─────────────────────────────────────────────
    //  INITIALIZE — Kontratı başlat
    // ─────────────────────────────────────────────

    /// Kontratı initialize eder. Deploy sonrası bir kez çağrılmalıdır.
    ///
    /// # Parametreler
    /// - `admin`: Kontrat yöneticisi adresi
    /// - `token_address`: USDC token kontrat adresi (SAC)
    ///
    /// # Hatalar
    /// - `AlreadyInitialized`: Kontrat daha önce initialize edilmişse
    pub fn initialize(
        env: Env,
        admin: Address,
        token_address: Address,
    ) -> Result<(), ContractError> {
        // Tekrar initialize edilmesini engelle
        if storage::is_initialized(&env) {
            return Err(ContractError::AlreadyInitialized);
        }

        // Admin yetkisini doğrula
        admin.require_auth();

        // Admin ve token adresini kaydet
        storage::set_admin(&env, &admin);
        storage::set_token(&env, &token_address);

        Ok(())
    }

    // ─────────────────────────────────────────────
    //  1. CREATE RENTAL — Ekipman listeleme
    // ─────────────────────────────────────────────

    /// Yeni bir kiralama teklifi oluşturur.
    /// Ekipman sahibi bu fonksiyonu çağırarak ekipmanını kiralık olarak listeler.
    ///
    /// # Parametreler
    /// - `owner`: Ekipman sahibinin adresi (imza gerekli)
    /// - `equipment_id`: Ekipmanı tanımlayan benzersiz string
    /// - `daily_price`: Günlük kiralama ücreti (USDC, 7 ondalık)
    /// - `deposit_amount`: Gereken depozito miktarı (USDC, 7 ondalık)
    ///
    /// # Dönüş
    /// - `u64`: Oluşturulan kiralamanın benzersiz ID'si
    pub fn create_rental(
        env: Env,
        owner: Address,
        equipment_id: String,
        daily_price: i128,
        deposit_amount: i128,
    ) -> Result<u64, ContractError> {
        // Kontratın initialize edildiğini doğrula
        if !storage::is_initialized(&env) {
            return Err(ContractError::NotInitialized);
        }

        // Ekipman sahibinin imzasını doğrula
        owner.require_auth();

        // Token adresini al
        let token_address = storage::get_token(&env)?;

        // Yeni kiralama ID'si oluştur
        let rental_id = storage::get_and_inc_counter(&env);

        // Boş hash oluştur (henüz kanıt yüklenmedi)
        let empty_hash = BytesN::from_array(&env, &[0u8; 32]);

        // Kiralama sözleşmesi oluştur
        let rental = RentalAgreement {
            rental_id,
            owner: owner.clone(),
            renter: owner.clone(), // Henüz kiracı yok, geçici olarak owner
            equipment_id: equipment_id.clone(),
            daily_price,
            deposit_amount,
            status: RentalStatus::Created,
            start_time: 0,
            proof_hash: empty_hash.clone(),
            return_hash: empty_hash,
            token_address,
        };

        // Storage'a kaydet
        storage::set_rental(&env, rental_id, &rental);

        // Event yayınla
        events::rental_created(&env, rental_id, &owner, &equipment_id);

        Ok(rental_id)
    }

    // ─────────────────────────────────────────────
    //  2. DEPOSIT — Depozito kilitleme
    // ─────────────────────────────────────────────

    /// Kiracı, belirtilen kiralama için depozitoyu kontrata kilitler.
    /// USDC token'lar kiracının hesabından kontrat adresine transfer edilir.
    ///
    /// # Parametreler
    /// - `renter`: Kiracının adresi (imza gerekli)
    /// - `rental_id`: Kiralama ID'si
    ///
    /// # Hatalar
    /// - `RentalNotFound`: Kiralama bulunamazsa
    /// - `InvalidState`: Kiralama "Created" durumunda değilse
    pub fn deposit(env: Env, renter: Address, rental_id: u64) -> Result<(), ContractError> {
        // Kiracının imzasını doğrula
        renter.require_auth();

        // Kiralama verisini al
        let mut rental = storage::get_rental(&env, rental_id)?;

        // Durumu kontrol et — sadece "Created" durumunda depozito kabul edilir
        if rental.status != RentalStatus::Created {
            return Err(ContractError::InvalidState);
        }

        // USDC token client oluştur
        let token_client = token::Client::new(&env, &rental.token_address);

        // Kiracıdan kontrata USDC transfer et (depozito kilitleme)
        token_client.transfer(
            &renter,
            &env.current_contract_address(),
            &rental.deposit_amount,
        );

        // Kiralama bilgilerini güncelle
        rental.renter = renter.clone();
        rental.status = RentalStatus::Deposited;

        // Güncellenmiş kiralama verisini kaydet
        storage::set_rental(&env, rental_id, &rental);

        // Event yayınla
        events::deposit_made(&env, rental_id, &renter, rental.deposit_amount);

        Ok(())
    }

    // ─────────────────────────────────────────────
    //  3. START RENTAL — Kiralama başlatma
    // ─────────────────────────────────────────────

    /// Ekipman sahibi kiralama sürecini başlatır.
    /// Zaman damgası kaydedilir ve kiralama "Active" durumuna geçer.
    ///
    /// # Parametreler
    /// - `owner`: Ekipman sahibinin adresi (imza gerekli)
    /// - `rental_id`: Kiralama ID'si
    ///
    /// # Hatalar
    /// - `RentalNotFound`: Kiralama bulunamazsa
    /// - `InvalidState`: Kiralama "Deposited" durumunda değilse
    /// - `NotAuthorized`: Çağıran ekipman sahibi değilse
    pub fn start_rental(env: Env, owner: Address, rental_id: u64) -> Result<(), ContractError> {
        // Sahibin imzasını doğrula
        owner.require_auth();

        // Kiralama verisini al
        let mut rental = storage::get_rental(&env, rental_id)?;

        // Sadece ekipman sahibi başlatabilir
        if rental.owner != owner {
            return Err(ContractError::NotAuthorized);
        }

        // Durumu kontrol et — sadece "Deposited" durumunda başlatılabilir
        if rental.status != RentalStatus::Deposited {
            return Err(ContractError::InvalidState);
        }

        // Zaman damgasını kaydet ve durumu güncelle
        let timestamp = env.ledger().timestamp();
        rental.start_time = timestamp;
        rental.status = RentalStatus::Active;

        // Kaydet
        storage::set_rental(&env, rental_id, &rental);

        // Event yayınla
        events::rental_started(&env, rental_id, timestamp);

        Ok(())
    }

    // ─────────────────────────────────────────────
    //  4. SUBMIT PROOF — Teslim kanıtı gönderme
    // ─────────────────────────────────────────────

    /// Teslim anında fotoğraf hash'ini zincire yazar.
    /// Bu hash, iade sırasında karşılaştırma için referans olarak kullanılır.
    /// Sadece ekipman sahibi veya kiracı tarafından çağrılabilir.
    ///
    /// # Parametreler
    /// - `caller`: Çağıran adres (owner veya renter, imza gerekli)
    /// - `rental_id`: Kiralama ID'si
    /// - `photo_hash`: Ekipmanın teslim anındaki durumunu gösteren fotoğraf hash'i (32 byte)
    ///
    /// # Hatalar
    /// - `RentalNotFound`: Kiralama bulunamazsa
    /// - `InvalidState`: Kiralama "Active" durumunda değilse
    /// - `NotAuthorized`: Çağıran ne sahip ne de kiracıysa
    pub fn submit_proof(
        env: Env,
        caller: Address,
        rental_id: u64,
        photo_hash: BytesN<32>,
    ) -> Result<(), ContractError> {
        // İmza doğrula
        caller.require_auth();

        // Kiralama verisini al
        let mut rental = storage::get_rental(&env, rental_id)?;

        // Sadece sahip veya kiracı proof gönderebilir
        if rental.owner != caller && rental.renter != caller {
            return Err(ContractError::NotAuthorized);
        }

        // Durumu kontrol et — sadece "Active" durumunda proof gönderilebilir
        if rental.status != RentalStatus::Active {
            return Err(ContractError::InvalidState);
        }

        // Hash'i kaydet
        rental.proof_hash = photo_hash;

        // Kaydet
        storage::set_rental(&env, rental_id, &rental);

        // Event yayınla
        events::proof_submitted(&env, rental_id, &caller);

        Ok(())
    }

    // ─────────────────────────────────────────────
    //  5. END RENTAL — Kiralama sonlandırma
    // ─────────────────────────────────────────────

    /// Kiralama sürecini sonlandırır ve depozito kararını verir.
    ///
    /// İade hash'i, teslim hash'i ile karşılaştırılır:
    /// - **Eşleşirse**: Ekipman hasarsız iade edildi → depozito kiracıya iade edilir ✅
    /// - **Eşleşmezse**: Ekipman hasarlı → depozito ekipman sahibine aktarılır ⚠️
    ///
    /// # Parametreler
    /// - `caller`: Çağıran adres (owner veya renter, imza gerekli)
    /// - `rental_id`: Kiralama ID'si
    /// - `return_hash`: İade anındaki fotoğraf hash'i (32 byte)
    ///
    /// # Hatalar
    /// - `RentalNotFound`: Kiralama bulunamazsa
    /// - `InvalidState`: Kiralama "Active" durumunda değilse
    /// - `NotAuthorized`: Çağıran ne sahip ne de kiracıysa
    pub fn end_rental(
        env: Env,
        caller: Address,
        rental_id: u64,
        return_hash: BytesN<32>,
    ) -> Result<(), ContractError> {
        // İmza doğrula
        caller.require_auth();

        // Kiralama verisini al
        let mut rental = storage::get_rental(&env, rental_id)?;

        // Sadece sahip veya kiracı sonlandırabilir
        if rental.owner != caller && rental.renter != caller {
            return Err(ContractError::NotAuthorized);
        }

        // Durumu kontrol et — sadece "Active" durumunda sonlandırılabilir
        if rental.status != RentalStatus::Active {
            return Err(ContractError::InvalidState);
        }

        // USDC token client oluştur
        let token_client = token::Client::new(&env, &rental.token_address);
        let contract_address = env.current_contract_address();

        // İade hash'ini kaydet
        rental.return_hash = return_hash.clone();

        // Hash karşılaştırması yap
        if rental.proof_hash == return_hash {
            // ✅ Hash'ler eşleşiyor — ekipman hasarsız iade edildi
            // Depozito kiracıya iade et
            token_client.transfer(&contract_address, &rental.renter, &rental.deposit_amount);
            rental.status = RentalStatus::Completed;

            // Event yayınla — dispute yok
            events::rental_ended(&env, rental_id, false);
        } else {
            // ⚠️ Hash'ler uyuşmuyor — ekipman hasarlı
            // Depozito ekipman sahibine aktar
            token_client.transfer(&contract_address, &rental.owner, &rental.deposit_amount);
            rental.status = RentalStatus::Disputed;

            // Event yayınla — dispute var
            events::rental_ended(&env, rental_id, true);
        }

        // Güncellenmiş kiralama verisini kaydet
        storage::set_rental(&env, rental_id, &rental);

        Ok(())
    }

    // ─────────────────────────────────────────────
    //  6. GET STATUS — Durum sorgulama
    // ─────────────────────────────────────────────

    /// Belirtilen kiralama ID'sine ait tüm bilgileri döndürür.
    /// Read-only fonksiyon — herhangi bir değişiklik yapmaz.
    ///
    /// # Parametreler
    /// - `rental_id`: Sorgulanacak kiralama ID'si
    ///
    /// # Dönüş
    /// - `RentalAgreement`: Kiralamanın tüm detayları
    ///
    /// # Hatalar
    /// - `RentalNotFound`: Kiralama bulunamazsa
    pub fn get_status(env: Env, rental_id: u64) -> Result<RentalAgreement, ContractError> {
        storage::get_rental(&env, rental_id)
    }
}
