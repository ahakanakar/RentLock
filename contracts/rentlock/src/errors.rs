use soroban_sdk::contracterror;

/// Kontrat hata kodları.
/// Her hata benzersiz bir u32 değerine sahiptir.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ContractError {
    /// Çağıran adres bu işlem için yetkili değil
    NotAuthorized = 1,
    /// Belirtilen rental_id ile kiralama bulunamadı
    RentalNotFound = 2,
    /// Kiralama bu işlem için uygun durumda değil
    InvalidState = 3,
    /// Yatırılan depozito yetersiz
    InsufficientDeposit = 4,
    /// Bu ekipman ID zaten kullanımda
    AlreadyExists = 5,
    /// Teslim ve iade hash'leri uyuşmuyor
    HashMismatch = 6,
    /// Kontrat zaten initialize edilmiş
    AlreadyInitialized = 7,
    /// Kontrat henüz initialize edilmemiş
    NotInitialized = 8,
}
