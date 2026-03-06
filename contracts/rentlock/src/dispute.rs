//! dispute.rs — Validator tabanlı anlaşmazlık çözüm sistemi
//!
//! Akış:
//!  1. open_dispute: Hash mismatch → DisputeInfo oluştur + 3 validatör ata
//!  2. cast_vote: Atanmış validatör oy kullanır
//!  3. Tüm 3 oy gelince finalize_dispute otomatik tetiklenir:
//!     - Çoğunluk (>=2) kiracı lehine → depozito kiracıya
//!     - Çoğunluk (>=2) sahip lehine → depozito sahibe
//!     - Her validatöre dispute_amount * 2% ödül
//!     - Azınlıkta kalan validatörün stake'i %10 slash edilir

use soroban_sdk::{token, Address, BytesN, Env, Vec};

use crate::errors::ContractError;
use crate::events;
use crate::storage;
use crate::types::{DisputeInfo, DisputeVote, RentalStatus, ValidatorInfo};

/// Minimum validatör stake miktarı: 10 USDC (7 ondalıklı = 100_000_000)
pub const MIN_STAKE: i128 = 100_000_000;

/// Ödül oranı: dispute miktarının %2'si (10_000 = binde 200 = %2)
const REWARD_BPS: i128 = 200; // basis points

/// Slash oranı: stake'in %10'u
const SLASH_BPS: i128 = 1000; // basis points

// ─────────────────────────────────────────────────────────
//  REGISTER VALIDATOR — Validatör kaydı
// ─────────────────────────────────────────────────────────

/// Yeni bir validatör kaydeder. Minimum 10 USDC stake gerekli.
/// Stake, USDC kontrata kilitlenir.
pub fn register_validator(
    env: &Env,
    validator: Address,
    stake_amount: i128,
) -> Result<(), ContractError> {
    validator.require_auth();

    // Minimum stake kontrolü
    if stake_amount < MIN_STAKE {
        return Err(ContractError::InsufficientStake);
    }

    // Zaten kayıtlı mı?
    if let Some(existing) = storage::get_validator(env, &validator) {
        if existing.active {
            return Err(ContractError::AlreadyExists);
        }
    }

    // USDC kontrata kilitle
    let token_address = storage::get_token(env)?;
    let token_client = token::Client::new(env, &token_address);
    token_client.transfer(&validator, &env.current_contract_address(), &stake_amount);

    // Validatör bilgisini kaydet
    let info = ValidatorInfo {
        address: validator.clone(),
        stake_amount,
        active: true,
        total_votes: 0,
        correct_votes: 0,
    };
    storage::set_validator(env, &info);
    storage::add_to_validator_list(env, &validator);

    events::validator_registered(env, &validator, stake_amount);

    Ok(())
}

// ─────────────────────────────────────────────────────────
//  UNREGISTER VALIDATOR — Validatör çıkışı
// ─────────────────────────────────────────────────────────

/// Validatörü sistemden çıkarır ve stake'ini iade eder.
/// Aktif bir dispute'u yoksa iade yapılır.
pub fn unregister_validator(env: &Env, validator: Address) -> Result<(), ContractError> {
    validator.require_auth();

    let mut info = storage::get_validator(env, &validator).ok_or(ContractError::NotAValidator)?;

    if !info.active {
        return Err(ContractError::NotAValidator);
    }

    // Stake'i iade et
    let token_address = storage::get_token(env)?;
    let token_client = token::Client::new(env, &token_address);
    token_client.transfer(&env.current_contract_address(), &validator, &info.stake_amount);

    // Validatörü deaktive et
    info.active = false;
    info.stake_amount = 0;
    storage::set_validator(env, &info);
    storage::remove_from_validator_list(env, &validator);

    Ok(())
}

// ─────────────────────────────────────────────────────────
//  OPEN DISPUTE — Anlaşmazlık açma (iç fonksiyon)
// ─────────────────────────────────────────────────────────

/// Hash mismatch durumunda dispute açar ve rastgele 3 validatör atar.
/// end_rental tarafından otomatik çağrılır.
pub fn open_dispute(
    env: &Env,
    rental_id: u64,
    return_hash: &BytesN<32>,
) -> Result<(), ContractError> {
    // Aktif validatörleri al
    let all_validators = storage::get_validator_list(env);
    let mut active: Vec<Address> = Vec::new(env);

    for addr in all_validators.iter() {
        if let Some(v) = storage::get_validator(env, &addr) {
            if v.active {
                active.push_back(addr);
            }
        }
    }

    // En az 3 aktif validatör gerekli
    if active.len() < 3 {
        return Err(ContractError::NotEnoughValidators);
    }

    // Pseudo-rastgele seçim — ledger hash kullan
    let ledger_hash = env.ledger().sequence();
    let mut assigned: Vec<Address> = Vec::new(env);
    let count = active.len() as u64;

    // 3 farklı indekste validatör seç
    for i in 0u64..3 {
        let seed = (ledger_hash as u64).wrapping_add(i).wrapping_mul(2654435761);
        let idx = (seed % count) as u32;
        let chosen = active.get(idx).unwrap();
        if !assigned.contains(&chosen) {
            assigned.push_back(chosen);
        } else {
            // Çakışma — sıradaki al
            let next_idx = ((seed.wrapping_add(1)) % count) as u32;
            let next = active.get(next_idx).unwrap();
            if !assigned.contains(&next) {
                assigned.push_back(next);
            } else {
                // Üçüncü seçenek
                let third_idx = ((seed.wrapping_add(2)) % count) as u32;
                assigned.push_back(active.get(third_idx).unwrap());
            }
        }
    }

    // Dispute kaydını oluştur
    let dispute = DisputeInfo {
        rental_id,
        assigned_validators: assigned,
        votes: Vec::new(env),
        finalized: false,
        opened_at: env.ledger().timestamp(),
    };

    // Return hash'i kiralamanın return_hash alanına kaydet
    let mut rental = storage::get_rental(env, rental_id)?;
    rental.return_hash = return_hash.clone();
    rental.status = RentalStatus::Disputed;
    storage::set_rental(env, rental_id, &rental);

    storage::set_dispute(env, rental_id, &dispute);

    Ok(())
}

// ─────────────────────────────────────────────────────────
//  CAST VOTE — Oy kullanma
// ─────────────────────────────────────────────────────────

/// Atanmış validatör oyu kullanır.
/// 3. oy kullanılınca `finalize_dispute` otomatik tetiklenir.
pub fn cast_vote(
    env: &Env,
    rental_id: u64,
    voter: Address,
    in_favor_of_renter: bool,
) -> Result<(), ContractError> {
    voter.require_auth();

    let mut dispute = storage::get_dispute(env, rental_id)?;

    if dispute.finalized {
        return Err(ContractError::DisputeAlreadyFinalized);
    }

    // Atanmış validatör mu?
    if !dispute.assigned_validators.contains(&voter) {
        return Err(ContractError::NotAValidator);
    }

    // Daha önce oy kullandı mı?
    for v in dispute.votes.iter() {
        if v.validator == voter {
            return Err(ContractError::AlreadyVoted);
        }
    }

    // Oyu kaydet
    let vote = DisputeVote {
        validator: voter.clone(),
        in_favor_of_renter,
        timestamp: env.ledger().timestamp(),
    };
    dispute.votes.push_back(vote);

    events::vote_cast(env, rental_id, &voter, in_favor_of_renter);

    // Tüm 3 oy kullanıldıysa → otomatik sonuçlandır
    let all_voted = dispute.votes.len() >= 3;
    storage::set_dispute(env, rental_id, &dispute);

    if all_voted {
        finalize_dispute_internal(env, rental_id)?;
    }

    Ok(())
}

// ─────────────────────────────────────────────────────────
//  FINALIZE DISPUTE — Sonuçlandırma (iç fonksiyon)
// ─────────────────────────────────────────────────────────

fn finalize_dispute_internal(env: &Env, rental_id: u64) -> Result<(), ContractError> {
    let mut dispute = storage::get_dispute(env, rental_id)?;

    if dispute.finalized {
        return Err(ContractError::DisputeAlreadyFinalized);
    }

    let mut renter_votes: u32 = 0;
    let mut owner_votes: u32 = 0;

    for vote in dispute.votes.iter() {
        if vote.in_favor_of_renter {
            renter_votes += 1;
        } else {
            owner_votes += 1;
        }
    }

    let renter_wins = renter_votes > owner_votes;

    let rental = storage::get_rental(env, rental_id)?;
    let token_address = storage::get_token(env)?;
    let token_client = token::Client::new(env, &token_address);
    let contract_addr = env.current_contract_address();

    let deposit = rental.deposit_amount;
    let reward_per_validator = (deposit * REWARD_BPS) / 10_000;

    // Toplam ödül miktarını depozito'dan düş
    let total_rewards = reward_per_validator * 3;
    let net_payout = deposit.saturating_sub(total_rewards);

    // Kazanana kalan depozitoyu öde
    if renter_wins {
        token_client.transfer(&contract_addr, &rental.renter, &net_payout);
    } else {
        token_client.transfer(&contract_addr, &rental.owner, &net_payout);
    }

    // Her validatöre ödül öde + doğruluk takibi yap
    for vote in dispute.votes.iter() {
        let correct = vote.in_favor_of_renter == renter_wins;

        if let Some(mut validator_info) = storage::get_validator(env, &vote.validator) {
            validator_info.total_votes += 1;
            if correct {
                validator_info.correct_votes += 1;
                // Ödül öde
                token_client.transfer(
                    &contract_addr,
                    &vote.validator,
                    &reward_per_validator,
                );
            } else {
                // Yanlış oy — stake %10 slash
                let slash_amount = (validator_info.stake_amount * SLASH_BPS) / 10_000;
                validator_info.stake_amount = validator_info
                    .stake_amount
                    .saturating_sub(slash_amount);

                events::validator_slashed(env, &vote.validator, slash_amount);
            }
            storage::set_validator(env, &validator_info);
        }
    }

    // Kiralama durumunu güncelle
    let mut updated_rental = storage::get_rental(env, rental_id)?;
    updated_rental.status = RentalStatus::DisputeResolved;
    storage::set_rental(env, rental_id, &updated_rental);

    // Dispute'u sonuçlandırılmış olarak işaretle
    dispute.finalized = true;
    storage::set_dispute(env, rental_id, &dispute);

    events::dispute_finalized(env, rental_id, renter_wins, renter_votes, owner_votes);

    Ok(())
}

/// Herkese açık manuel sonuçlandırma (admin veya herhangi biri çağırabilir).
pub fn finalize_dispute(env: &Env, rental_id: u64) -> Result<(), ContractError> {
    let dispute = storage::get_dispute(env, rental_id)?;

    if dispute.finalized {
        return Err(ContractError::DisputeAlreadyFinalized);
    }

    // Sadece tüm oylar kullanılmışsa sonuçlandırılabilir
    if dispute.votes.len() < 3 {
        return Err(ContractError::InvalidState);
    }

    finalize_dispute_internal(env, rental_id)
}
