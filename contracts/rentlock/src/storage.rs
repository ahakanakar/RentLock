use soroban_sdk::{contracttype, Address, Env};

use crate::errors::ContractError;
use crate::types::RentalAgreement;

/// Ledger storage için anahtar tanımları.
/// Her veri tipi kendi anahtarıyla persistent storage'da saklanır.
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// Kiralama verisi — rental_id ile indekslenir
    Rental(u64),
    /// Kontrat yöneticisi adresi
    Admin,
    /// USDC token kontrat adresi
    TokenAddress,
    /// Otomatik artan kiralama sayacı
    RentalCounter,
}

/// Kontrat admin adresini storage'a yazar.
pub fn set_admin(env: &Env, admin: &Address) {
    env.storage().persistent().set(&DataKey::Admin, admin);
}

/// Kontrat admin adresini storage'dan okur.
pub fn get_admin(env: &Env) -> Result<Address, ContractError> {
    env.storage()
        .persistent()
        .get(&DataKey::Admin)
        .ok_or(ContractError::NotInitialized)
}

/// USDC token adresini storage'a yazar.
pub fn set_token(env: &Env, token: &Address) {
    env.storage()
        .persistent()
        .set(&DataKey::TokenAddress, token);
}

/// USDC token adresini storage'dan okur.
pub fn get_token(env: &Env) -> Result<Address, ContractError> {
    env.storage()
        .persistent()
        .get(&DataKey::TokenAddress)
        .ok_or(ContractError::NotInitialized)
}

/// Kiralama verisini persistent storage'a yazar.
pub fn set_rental(env: &Env, rental_id: u64, rental: &RentalAgreement) {
    env.storage()
        .persistent()
        .set(&DataKey::Rental(rental_id), rental);
}

/// Kiralama verisini persistent storage'dan okur.
pub fn get_rental(env: &Env, rental_id: u64) -> Result<RentalAgreement, ContractError> {
    env.storage()
        .persistent()
        .get(&DataKey::Rental(rental_id))
        .ok_or(ContractError::RentalNotFound)
}

/// Kiralama sayacını bir artırır ve yeni değeri döndürür.
/// İlk çağrıda sayaç 0'dan başlar ve 1 döner.
pub fn get_and_inc_counter(env: &Env) -> u64 {
    let count: u64 = env
        .storage()
        .persistent()
        .get(&DataKey::RentalCounter)
        .unwrap_or(0);
    let new_count = count + 1;
    env.storage()
        .persistent()
        .set(&DataKey::RentalCounter, &new_count);
    new_count
}

/// Kontratın initialize edilip edilmediğini kontrol eder.
pub fn is_initialized(env: &Env) -> bool {
    env.storage().persistent().has(&DataKey::Admin)
}
