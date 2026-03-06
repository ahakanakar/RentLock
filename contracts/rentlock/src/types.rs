use soroban_sdk::{contracttype, Address, Vec};

/// Kiralama durumunu temsil eden enum.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum RentalStatus {
    /// Kiralama oluşturuldu, depozito bekleniyor
    Created = 0,
    /// Depozito yatırıldı, kiralama başlatılmayı bekliyor
    Deposited = 1,
    /// Kiralama aktif, ekipman kiracıda
    Active = 2,
    /// Kiralama tamamlandı, depozito iade edildi
    Completed = 3,
    /// Anlaşmazlık açıldı, validatör oylaması sürüyor
    Disputed = 4,
    /// Anlaşmazlık karar verildi ve sonuçlandı
    DisputeResolved = 5,
}

/// Bir kiralama sözleşmesinin tüm bilgilerini tutan yapı.
#[contracttype]
#[derive(Clone, Debug)]
pub struct RentalAgreement {
    pub rental_id: u64,
    pub owner: soroban_sdk::Address,
    pub renter: soroban_sdk::Address,
    pub equipment_id: soroban_sdk::String,
    pub daily_price: i128,
    pub deposit_amount: i128,
    pub status: RentalStatus,
    pub start_time: u64,
    pub proof_hash: soroban_sdk::BytesN<32>,
    pub return_hash: soroban_sdk::BytesN<32>,
    pub token_address: soroban_sdk::Address,
}

// ─── Validator Sistemi Tipleri ────────────────────────────

/// Validatör bilgileri.
/// Her validatör minimum stake yatırarak sisteme katılır.
#[contracttype]
#[derive(Clone, Debug)]
pub struct ValidatorInfo {
    /// Validatörün Stellar adresi
    pub address: Address,
    /// Yatırılan stake miktarı (USDC, 7 ondalık). Min: 10 USDC = 100_000_000
    pub stake_amount: i128,
    /// Validatörün aktif olup olmadığı
    pub active: bool,
    /// Toplam oy sayısı (geçmiş)
    pub total_votes: u32,
    /// Doğru oy sayısı (çoğunlukla aynı tarafı seçti)
    pub correct_votes: u32,
}

/// Bir validatörün bir dispute için kullandığı oy.
#[contracttype]
#[derive(Clone, Debug)]
pub struct DisputeVote {
    /// Oy kullanan validatör adresi
    pub validator: Address,
    /// true = kiracı lehine, false = sahip lehine
    pub in_favor_of_renter: bool,
    /// Oy zamanı (unix timestamp)
    pub timestamp: u64,
}

/// Bir anlaşmazlığın tüm bilgilerini tutan yapı.
#[contracttype]
#[derive(Clone, Debug)]
pub struct DisputeInfo {
    /// Hangi kiralama için dispute açıldı
    pub rental_id: u64,
    /// Atanmış validatör adresleri (rastgele 3 seçilir)
    pub assigned_validators: Vec<Address>,
    /// Kullanılan oylar
    pub votes: Vec<DisputeVote>,
    /// Dispute sonuçlandırıldı mı
    pub finalized: bool,
    /// Dispute açılma zamanı
    pub opened_at: u64,
}
