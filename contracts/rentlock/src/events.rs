use soroban_sdk::{Address, Env, symbol_short, String};

/// Kiralama oluşturulduğunda yayınlanan event.
pub fn rental_created(env: &Env, rental_id: u64, owner: &Address, equipment_id: &String) {
    env.events().publish(
        (symbol_short!("rental"), symbol_short!("created")),
        (rental_id, owner.clone(), equipment_id.clone()),
    );
}

/// Depozito yatırıldığında yayınlanan event.
pub fn deposit_made(env: &Env, rental_id: u64, renter: &Address, amount: i128) {
    env.events().publish(
        (symbol_short!("rental"), symbol_short!("deposit")),
        (rental_id, renter.clone(), amount),
    );
}

/// Kiralama başladığında yayınlanan event.
pub fn rental_started(env: &Env, rental_id: u64, start_time: u64) {
    env.events().publish(
        (symbol_short!("rental"), symbol_short!("started")),
        (rental_id, start_time),
    );
}

/// Kanıt hash'i gönderildiğinde yayınlanan event.
pub fn proof_submitted(env: &Env, rental_id: u64, caller: &Address) {
    env.events().publish(
        (symbol_short!("rental"), symbol_short!("proof")),
        (rental_id, caller.clone()),
    );
}

/// Kiralama sonlandığında yayınlanan event.
pub fn rental_ended(env: &Env, rental_id: u64, disputed: bool) {
    env.events().publish(
        (symbol_short!("rental"), symbol_short!("ended")),
        (rental_id, disputed),
    );
}

// ─── Validator Sistemi Eventleri ──────────────────────────

/// Validatör kayıt olduğunda yayınlanan event.
pub fn validator_registered(env: &Env, validator: &Address, stake_amount: i128) {
    env.events().publish(
        (symbol_short!("valid"), symbol_short!("register")),
        (validator.clone(), stake_amount),
    );
}

/// Validatör oy kullandığında yayınlanan event.
pub fn vote_cast(env: &Env, rental_id: u64, voter: &Address, in_favor_of_renter: bool) {
    env.events().publish(
        (symbol_short!("dispute"), symbol_short!("vote")),
        (rental_id, voter.clone(), in_favor_of_renter),
    );
}

/// Anlaşmazlık sonuçlandırıldığında yayınlanan event.
/// `renter_wins`: true → kiracı kazandı, false → sahip kazandı
pub fn dispute_finalized(env: &Env, rental_id: u64, renter_wins: bool, renter_votes: u32, owner_votes: u32) {
    env.events().publish(
        (symbol_short!("dispute"), symbol_short!("final")),
        (rental_id, renter_wins, renter_votes, owner_votes),
    );
}

/// Validatör stake'i kesildiğinde (slash) yayınlanan event.
pub fn validator_slashed(env: &Env, validator: &Address, slash_amount: i128) {
    env.events().publish(
        (symbol_short!("valid"), symbol_short!("slash")),
        (validator.clone(), slash_amount),
    );
}
