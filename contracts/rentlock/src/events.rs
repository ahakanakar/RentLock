use soroban_sdk::{Address, Env, String, symbol_short};

/// Kiralama oluşturulduğunda yayınlanan event.
/// Frontend ve oracle bu event'i dinleyerek yeni kiralamaları takip eder.
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
/// `disputed` true ise hash'ler uyuşmadı demektir.
pub fn rental_ended(env: &Env, rental_id: u64, disputed: bool) {
    env.events().publish(
        (symbol_short!("rental"), symbol_short!("ended")),
        (rental_id, disputed),
    );
}
