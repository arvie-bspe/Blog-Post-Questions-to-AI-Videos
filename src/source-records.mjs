// An empty re-inspection can point to a refreshed article with an existing review history.
// Keep the empty record for traceability; never replace another script or video record.
export function adoptSourceIdentity(store,job,identity,hasVideos=()=>false){
 const match=store.db.prepare('SELECT id FROM jobs WHERE identity=? AND id<>?').get(identity,job.id);
 if(match){
  const other=store.get(match.id);
  if(other.plan||other.reviews?.length||other.history?.some(h=>h.plan||h.reviews?.length)||hasVideos(other.id))return false;
  other.supersededBy=job.id;other.identity='superseded-inspection-'+other.id;
  store.db.prepare('UPDATE jobs SET identity=? WHERE id=?').run(other.identity,other.id);store.save(other);
  job.relatedInspections=[...new Set([...(job.relatedInspections||[]),other.id])];
 }
 job.identity=identity;store.db.prepare('UPDATE jobs SET identity=? WHERE id=?').run(identity,job.id);return true;
}
