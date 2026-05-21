import Domain from '../database/models/domain';

/**
 * Sprawdza czy dany userId ma prawo dostępu do domeny.
 * Zwraca domenę jeśli dostęp OK, null jeśli brak domeny, false jeśli brak uprawnień.
 *
 * Reguła: userId pasuje LUB domena jest legacy (userId = null).
 */
export async function verifyDomainOwnership(
   domainName: string,
   userId: string | null,
): Promise<Domain | null | false> {
   const domainRecord = await Domain.findOne({ where: { domain: domainName } });
   if (!domainRecord) return null;
   if (domainRecord.userId && domainRecord.userId !== userId) return false;
   return domainRecord;
}

/**
 * Jak wyżej, ale wyszukuje po slug zamiast domain name.
 */
export async function verifyDomainOwnershipBySlug(
   slug: string,
   userId: string | null,
): Promise<Domain | null | false> {
   const domainRecord = await Domain.findOne({ where: { slug } });
   if (!domainRecord) return null;
   if (domainRecord.userId && domainRecord.userId !== userId) return false;
   return domainRecord;
}
