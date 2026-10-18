/** Selection follows students; email deduplication belongs to delivery. */
export function selectFilteredRecipients(selected: string[], matches: {id:string}[], limit=100):string[] {
 return [...new Set([...selected,...matches.map(student=>student.id)])].slice(0,limit);
}
