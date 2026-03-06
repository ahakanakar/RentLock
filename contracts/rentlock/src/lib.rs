#![no_std]

//! # RentLock — Decentralized Equipment Rental Protocol
//!
//! Stellar Soroban üzerinde çalışan ekipman kiralama akıllı kontratı.
//! Depozito escrow mekanizması, hash tabanlı kanıt doğrulama,
//! USDC token entegrasyonu ve validatör tabanlı anlaşmazlık çözümü içerir.

use soroban_sdk::{contract, contractimpl, token, Address, BytesN, Env, String};

mod dispute;
mod errors;
mod events;
mod storage;
mod types;

use errors::ContractError;
use types::{DisputeInfo, RentalAgreement, RentalStatus, ValidatorInfo};

#[contract]
pub struct RentLockContract;

#[contractimpl]
impl RentLockContract {
    // ─────────────────────────────────────────────
    //  INITIALIZE — Kontratı başlat
    // ─────────────────────────────────────────────

    pub fn initialize(
        env: Env,
        admin: Address,
        token_address: Address,
    ) -> Result<(), ContractError> {
        if storage::is_initialized(&env) {
            return Err(ContractError::AlreadyInitialized);
        }
        admin.require_auth();
        storage::set_admin(&env, &admin);
        storage::set_token(&env, &token_address);
        Ok(())
    }

    // ─────────────────────────────────────────────
    //  1. CREATE RENTAL — Ekipman listeleme
    // ─────────────────────────────────────────────

    pub fn create_rental(
        env: Env,
        owner: Address,
        equipment_id: String,
        daily_price: i128,
        deposit_amount: i128,
    ) -> Result<u64, ContractError> {
        if !storage::is_initialized(&env) {
            return Err(ContractError::NotInitialized);
        }
        owner.require_auth();

        let token_address = storage::get_token(&env)?;
        let rental_id = storage::get_and_inc_counter(&env);
        let empty_hash = BytesN::from_array(&env, &[0u8; 32]);

        let rental = RentalAgreement {
            rental_id,
            owner: owner.clone(),
            renter: owner.clone(),
            equipment_id: equipment_id.clone(),
            daily_price,
            deposit_amount,
            status: RentalStatus::Created,
            start_time: 0,
            proof_hash: empty_hash.clone(),
            return_hash: empty_hash,
            token_address,
        };

        storage::set_rental(&env, rental_id, &rental);
        events::rental_created(&env, rental_id, &owner, &equipment_id);

        Ok(rental_id)
    }

    // ─────────────────────────────────────────────
    //  2. DEPOSIT — Depozito kilitleme
    // ─────────────────────────────────────────────

    pub fn deposit(env: Env, renter: Address, rental_id: u64) -> Result<(), ContractError> {
        renter.require_auth();
        let mut rental = storage::get_rental(&env, rental_id)?;

        if rental.status != RentalStatus::Created {
            return Err(ContractError::InvalidState);
        }

        let token_client = token::Client::new(&env, &rental.token_address);
        token_client.transfer(
            &renter,
            &env.current_contract_address(),
            &rental.deposit_amount,
        );

        rental.renter = renter.clone();
        rental.status = RentalStatus::Deposited;
        storage::set_rental(&env, rental_id, &rental);
        events::deposit_made(&env, rental_id, &renter, rental.deposit_amount);

        Ok(())
    }

    // ─────────────────────────────────────────────
    //  3. START RENTAL — Kiralama başlatma
    // ─────────────────────────────────────────────

    pub fn start_rental(env: Env, owner: Address, rental_id: u64) -> Result<(), ContractError> {
        owner.require_auth();
        let mut rental = storage::get_rental(&env, rental_id)?;

        if rental.owner != owner {
            return Err(ContractError::NotAuthorized);
        }
        if rental.status != RentalStatus::Deposited {
            return Err(ContractError::InvalidState);
        }

        let timestamp = env.ledger().timestamp();
        rental.start_time = timestamp;
        rental.status = RentalStatus::Active;
        storage::set_rental(&env, rental_id, &rental);
        events::rental_started(&env, rental_id, timestamp);

        Ok(())
    }

    // ─────────────────────────────────────────────
    //  4. SUBMIT PROOF — Teslim kanıtı gönderme
    // ─────────────────────────────────────────────

    pub fn submit_proof(
        env: Env,
        caller: Address,
        rental_id: u64,
        photo_hash: BytesN<32>,
    ) -> Result<(), ContractError> {
        caller.require_auth();
        let mut rental = storage::get_rental(&env, rental_id)?;

        if rental.owner != caller && rental.renter != caller {
            return Err(ContractError::NotAuthorized);
        }
        if rental.status != RentalStatus::Active {
            return Err(ContractError::InvalidState);
        }

        rental.proof_hash = photo_hash;
        storage::set_rental(&env, rental_id, &rental);
        events::proof_submitted(&env, rental_id, &caller);

        Ok(())
    }

    // ─────────────────────────────────────────────
    //  5. END RENTAL — Kiralama sonlandırma
    // ─────────────────────────────────────────────
    //
    //  Hash eşleşirse → depozito kiracıya iade
    //  Hash uyuşmazsa VE validatör yeterli → dispute aç
    //  Hash uyuşmazsa VE validatör yetersiz → direkt sahibe öde

    pub fn end_rental(
        env: Env,
        caller: Address,
        rental_id: u64,
        return_hash: BytesN<32>,
    ) -> Result<(), ContractError> {
        caller.require_auth();
        let mut rental = storage::get_rental(&env, rental_id)?;

        if rental.owner != caller && rental.renter != caller {
            return Err(ContractError::NotAuthorized);
        }
        if rental.status != RentalStatus::Active {
            return Err(ContractError::InvalidState);
        }

        let token_client = token::Client::new(&env, &rental.token_address);
        let contract_address = env.current_contract_address();
        rental.return_hash = return_hash.clone();

        if rental.proof_hash == return_hash {
            // ✅ Hash eşleşti — hasarsız iade
            token_client.transfer(&contract_address, &rental.renter, &rental.deposit_amount);
            rental.status = RentalStatus::Completed;
            storage::set_rental(&env, rental_id, &rental);
            events::rental_ended(&env, rental_id, false);
        } else {
            // ⚠️ Hash uyuşmazlığı — validatör dispute sistemi dene
            match dispute::open_dispute(&env, rental_id, &return_hash) {
                Ok(_) => {
                    // Dispute açıldı — validatörler oy kullanacak
                    events::rental_ended(&env, rental_id, true);
                }
                Err(ContractError::NotEnoughValidators) => {
                    // Validatör yok → direkt sahibe öde
                    token_client.transfer(
                        &contract_address,
                        &rental.owner,
                        &rental.deposit_amount,
                    );
                    rental.status = RentalStatus::Disputed;
                    storage::set_rental(&env, rental_id, &rental);
                    events::rental_ended(&env, rental_id, true);
                }
                Err(e) => return Err(e),
            }
        }

        Ok(())
    }

    // ─────────────────────────────────────────────
    //  6. GET STATUS — Durum sorgulama
    // ─────────────────────────────────────────────

    pub fn get_status(env: Env, rental_id: u64) -> Result<RentalAgreement, ContractError> {
        storage::get_rental(&env, rental_id)
    }

    // ─────────────────────────────────────────────
    //  7. REGISTER VALIDATOR — Validatör kaydı
    // ─────────────────────────────────────────────

    /// Yeni validatör kaydeder. Minimum 10 USDC stake kontrata kilitlenir.
    pub fn register_validator(
        env: Env,
        validator: Address,
        stake_amount: i128,
    ) -> Result<(), ContractError> {
        dispute::register_validator(&env, validator, stake_amount)
    }

    /// Validatörü sistemden çıkarır, stake iade edilir.
    pub fn unregister_validator(
        env: Env,
        validator: Address,
    ) -> Result<(), ContractError> {
        dispute::unregister_validator(&env, validator)
    }

    // ─────────────────────────────────────────────
    //  8. CAST VOTE — Oy kullanma
    // ─────────────────────────────────────────────

    /// Atanmış validatör dispute için oy kullanır.
    /// 3. oy sonrası otomatik sonuçlandırılır.
    pub fn cast_vote(
        env: Env,
        rental_id: u64,
        voter: Address,
        in_favor_of_renter: bool,
    ) -> Result<(), ContractError> {
        dispute::cast_vote(&env, rental_id, voter, in_favor_of_renter)
    }

    // ─────────────────────────────────────────────
    //  9. FINALIZE DISPUTE — Manuel sonuçlandırma
    // ─────────────────────────────────────────────

    /// Tüm oylar kullanıldıktan sonra manuel olarak sonuçlandırma
    /// (normalde 3. oy gelince otomatik tetiklenir).
    pub fn finalize_dispute(env: Env, rental_id: u64) -> Result<(), ContractError> {
        dispute::finalize_dispute(&env, rental_id)
    }

    // ─────────────────────────────────────────────
    //  10. GET DISPUTE — Dispute sorgu
    // ─────────────────────────────────────────────

    pub fn get_dispute(env: Env, rental_id: u64) -> Result<DisputeInfo, ContractError> {
        storage::get_dispute(&env, rental_id)
    }

    // ─────────────────────────────────────────────
    //  11. GET VALIDATOR — Validatör sorgu
    // ─────────────────────────────────────────────

    pub fn get_validator(env: Env, address: Address) -> Option<ValidatorInfo> {
        storage::get_validator(&env, &address)
    }
}
