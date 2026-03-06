use soroban_sdk::{contracttype, Address, Env, Vec};

use crate::errors::ContractError;
use crate::types::{DisputeInfo, RentalAgreement, ValidatorInfo};

/// Ledger storage için anahtar tanımları.
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

    // ─── Validator sistemi storage anahtarları ─────
    /// Validatör bilgisi — adres ile indekslenir
    Validator(Address),
    /// Tüm validatör adreslerinin listesi
    ValidatorList,
    /// Dispute bilgisi — rental_id ile indekslenir
    Dispute(u64),
}

// ─── Admin / Token ─────────────────────────────────────────

pub fn set_admin(env: &Env, admin: &Address) {
    env.storage().persistent().set(&DataKey::Admin, admin);
}

pub fn get_admin(env: &Env) -> Result<Address, ContractError> {
    env.storage()
        .persistent()
        .get(&DataKey::Admin)
        .ok_or(ContractError::NotInitialized)
}

pub fn set_token(env: &Env, token: &Address) {
    env.storage()
        .persistent()
        .set(&DataKey::TokenAddress, token);
}

pub fn get_token(env: &Env) -> Result<Address, ContractError> {
    env.storage()
        .persistent()
        .get(&DataKey::TokenAddress)
        .ok_or(ContractError::NotInitialized)
}

// ─── Rental ────────────────────────────────────────────────

pub fn set_rental(env: &Env, rental_id: u64, rental: &RentalAgreement) {
    env.storage()
        .persistent()
        .set(&DataKey::Rental(rental_id), rental);
}

pub fn get_rental(env: &Env, rental_id: u64) -> Result<RentalAgreement, ContractError> {
    env.storage()
        .persistent()
        .get(&DataKey::Rental(rental_id))
        .ok_or(ContractError::RentalNotFound)
}

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

pub fn is_initialized(env: &Env) -> bool {
    env.storage().persistent().has(&DataKey::Admin)
}

// ─── Validator ─────────────────────────────────────────────

/// Validatör bilgisini kaydeder.
pub fn set_validator(env: &Env, validator: &ValidatorInfo) {
    env.storage()
        .persistent()
        .set(&DataKey::Validator(validator.address.clone()), validator);
}

/// Validatör bilgisini okur.
pub fn get_validator(env: &Env, address: &Address) -> Option<ValidatorInfo> {
    env.storage()
        .persistent()
        .get(&DataKey::Validator(address.clone()))
}

/// Tüm validatör adreslerini döndürür.
pub fn get_validator_list(env: &Env) -> Vec<Address> {
    env.storage()
        .persistent()
        .get(&DataKey::ValidatorList)
        .unwrap_or_else(|| Vec::new(env))
}

/// Validatör listesine yeni adres ekler.
pub fn add_to_validator_list(env: &Env, address: &Address) {
    let mut list = get_validator_list(env);
    // Çift kayıt önle
    if !list.contains(address) {
        list.push_back(address.clone());
        env.storage()
            .persistent()
            .set(&DataKey::ValidatorList, &list);
    }
}

/// Validatörü listeden çıkarır.
pub fn remove_from_validator_list(env: &Env, address: &Address) {
    let list = get_validator_list(env);
    let mut new_list: Vec<Address> = Vec::new(env);
    for a in list.iter() {
        if &a != address {
            new_list.push_back(a);
        }
    }
    env.storage()
        .persistent()
        .set(&DataKey::ValidatorList, &new_list);
}

// ─── Dispute ───────────────────────────────────────────────

/// Dispute bilgisini kaydeder.
pub fn set_dispute(env: &Env, rental_id: u64, dispute: &DisputeInfo) {
    env.storage()
        .persistent()
        .set(&DataKey::Dispute(rental_id), dispute);
}

/// Dispute bilgisini okur.
pub fn get_dispute(env: &Env, rental_id: u64) -> Result<DisputeInfo, ContractError> {
    env.storage()
        .persistent()
        .get(&DataKey::Dispute(rental_id))
        .ok_or(ContractError::DisputeNotFound)
}
