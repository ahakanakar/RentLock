use soroban_sdk::contracttype;

/// Kiralama durumunu temsil eden enum.
/// Her kiralama bu durumlardan birinde bulunur.
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
    /// Anlaşmazlık: hash'ler uyuşmadı, depozito sahibine aktarıldı
    Disputed = 4,
}

/// Bir kiralama sözleşmesinin tüm bilgilerini tutan yapı.
/// Zincir üzerinde persistent storage'da saklanır.
#[contracttype]
#[derive(Clone, Debug)]
pub struct RentalAgreement {
    /// Kiralama benzersiz kimliği
    pub rental_id: u64,
    /// Ekipman sahibinin adresi
    pub owner: soroban_sdk::Address,
    /// Kiracının adresi (depozito yatırıldığında set edilir)
    pub renter: soroban_sdk::Address,
    /// Ekipman tanımlayıcısı
    pub equipment_id: soroban_sdk::String,
    /// Günlük kiralama fiyatı (USDC, 7 ondalık)
    pub daily_price: i128,
    /// Depozito miktarı (USDC, 7 ondalık)
    pub deposit_amount: i128,
    /// Mevcut kiralama durumu
    pub status: RentalStatus,
    /// Kiralama başlangıç zamanı (unix timestamp)
    pub start_time: u64,
    /// Teslim anında yüklenen fotoğraf hash'i
    pub proof_hash: soroban_sdk::BytesN<32>,
    /// İade anında yüklenen fotoğraf hash'i
    pub return_hash: soroban_sdk::BytesN<32>,
    /// USDC token kontrat adresi
    pub token_address: soroban_sdk::Address,
}
